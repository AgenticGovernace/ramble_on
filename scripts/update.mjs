#!/usr/bin/env node
/**
 * scripts/update.mjs
 *
 * Repo-driven update: pulls the latest source, rebuilds the .app, and
 * atomically swaps it in for /Applications/Ramble On.app while keeping
 * one rollback backup at dist-electron/.backup/Ramble On.app.previous.
 *
 * Flags:
 *   --no-pull       Skip git fetch/pull (useful when local changes drive the update)
 *   --no-build      Skip electron-builder (assume an existing built bundle is current)
 *   --rollback      Restore the previous backup over /Applications/Ramble On.app
 *   --yes           Skip confirmations
 *   --keep-quarantine  Don't strip com.apple.quarantine (debug only)
 */

import { mkdir, rename, readFile, rm, writeFile, copyFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  appBundleBuilt,
  appBundleInstalled,
  appName,
  backupDir,
  electronBuilderOutput,
  isMacOS,
  lockFile,
  previousAppBundleBackup,
  productName,
  repoRoot,
  unsupportedPlatformError,
} from './lib/paths.mjs';
import { confirm } from './lib/prompt.mjs';
import { quitApp, run, runStreaming } from './lib/proc.mjs';
import { checkNode, fileExists } from './lib/checks.mjs';

const FLAGS = {
  noPull: process.argv.includes('--no-pull'),
  noBuild: process.argv.includes('--no-build'),
  rollback: process.argv.includes('--rollback'),
  yes: process.argv.includes('--yes'),
  keepQuarantine: process.argv.includes('--keep-quarantine'),
};

if (process.env.CI && !FLAGS.yes) {
  console.error('[update] Refusing to run interactively in CI. Pass --yes to bypass.');
  process.exit(1);
}

if (!isMacOS) {
  console.error(unsupportedPlatformError().message);
  process.exit(1);
}

const acquireLock = async () => {
  await mkdir(backupDir(), { recursive: true });
  const lock = lockFile();
  if (existsSync(lock)) {
    const pid = Number((await readFile(lock, 'utf8')).trim());
    if (Number.isFinite(pid)) {
      try {
        process.kill(pid, 0);
        throw new Error(
          `[update] Another update is in progress (lock held by pid ${pid} at ${lock}). ` +
            `If you're sure no update is running, delete the lock file and retry.`,
        );
      } catch (error) {
        if (error?.code === 'ESRCH') {
          // stale lock — orphan process, safe to take over
          console.log(`[update] Stale lock found (pid ${pid} not alive). Taking over.`);
        } else {
          throw error;
        }
      }
    }
  }
  await writeFile(lock, String(process.pid), 'utf8');
};

const releaseLock = async () => {
  try {
    await rm(lockFile(), { force: true });
  } catch {
    // ignore
  }
};

const ditto = async (src, dst) => {
  await runStreaming('ditto', [src, dst]);
};

const stripQuarantine = async (target) => {
  try {
    await run('xattr', ['-dr', 'com.apple.quarantine', target]);
  } catch (error) {
    console.log(`[update] xattr strip warned: ${error?.message ?? error}`);
  }
};

const verifyMachO = async (appPath) => {
  const binary = join(appPath, 'Contents', 'MacOS', productName);
  if (!(await fileExists(binary))) {
    throw new Error(`[update] Expected binary not found at ${binary}`);
  }
  // Cheap sanity: file exists and is non-empty.
  const s = await stat(binary);
  if (s.size === 0) {
    throw new Error(`[update] Binary at ${binary} is empty.`);
  }
  // Mach-O magic numbers: 0xfeedface, 0xfeedfacf, 0xcafebabe (fat).
  const fh = await readFile(binary).then((buf) => buf.subarray(0, 4));
  const magic = fh.readUInt32BE(0);
  const ok =
    magic === 0xfeedface ||
    magic === 0xfeedfacf ||
    magic === 0xcafebabe ||
    magic === 0xcefaedfe || // little-endian variants
    magic === 0xcffaedfe ||
    magic === 0xbebafeca;
  if (!ok) {
    throw new Error(
      `[update] Binary at ${binary} does not look like Mach-O (magic 0x${magic.toString(16)}).`,
    );
  }
};

const rollback = async () => {
  const backup = previousAppBundleBackup();
  if (!(await fileExists(backup))) {
    throw new Error(`[update] No rollback backup at ${backup}.`);
  }
  await quitApp();
  const installed = appBundleInstalled();
  if (await fileExists(installed)) {
    await rm(installed, { recursive: true, force: true });
  }
  await ditto(backup, installed);
  if (!FLAGS.keepQuarantine) await stripQuarantine(installed);
  console.log(`[update] Rolled back to ${backup}.`);
};

const gitPull = async () => {
  if (FLAGS.noPull) {
    console.log('[update] --no-pull: skipping git fetch/pull.');
    return;
  }
  const status = (await run('git', ['-C', repoRoot, 'status', '--porcelain'])).stdout;
  if (status.length > 0) {
    console.log('[update] Working tree is dirty:');
    console.log(status);
    const cont = FLAGS.yes
      ? false
      : await confirm('Continue anyway? (`git pull` may fail or merge unexpectedly)', {
          defaultValue: false,
        });
    if (!cont) {
      throw new Error('[update] Aborted: working tree dirty.');
    }
  }

  await runStreaming('git', ['-C', repoRoot, 'fetch'], {});
  let pendingSummary = '';
  try {
    pendingSummary = (await run('git', ['-C', repoRoot, 'log', 'HEAD..@{u}', '--oneline'])).stdout;
  } catch {
    // no upstream, etc. — fine, fall through.
  }
  if (pendingSummary) {
    console.log('[update] Incoming commits:');
    console.log(pendingSummary);
  } else {
    console.log('[update] Already up to date with upstream (nothing to pull).');
  }
  if (!FLAGS.yes && pendingSummary) {
    const cont = await confirm('Apply these commits with `git pull --ff-only`?', {
      defaultValue: true,
    });
    if (!cont) throw new Error('[update] Aborted at git pull confirmation.');
  }
  if (pendingSummary) {
    await runStreaming('git', ['-C', repoRoot, 'pull', '--ff-only'], {});
  }
};

const electronVersion = async () => {
  const p = join(repoRoot, 'node_modules', 'electron', 'package.json');
  if (!existsSync(p)) return null;
  const pkg = JSON.parse(await readFile(p, 'utf8'));
  return pkg.version || null;
};

const installDepsIfNeeded = async (preElectronVersion) => {
  // Re-install if package-lock changed since the last commit OR if Electron
  // changed (better-sqlite3 needs a rebuild against the new ABI).
  let lockChanged = false;
  try {
    const { stdout } = await run('git', [
      '-C',
      repoRoot,
      'diff',
      '--name-only',
      'HEAD@{1}',
      'HEAD',
    ]);
    lockChanged = stdout.split('\n').some((f) => f === 'package-lock.json' || f === 'package.json');
  } catch {
    // no reflog yet (fresh clone) — assume changed.
    lockChanged = true;
  }
  const postElectronVersion = await electronVersion();
  const electronChanged = preElectronVersion !== postElectronVersion;

  if (!lockChanged && !electronChanged) {
    console.log('[update] Dependencies unchanged — skipping `npm install`.');
    return;
  }
  console.log(
    `[update] Running \`npm install\` (lockChanged=${lockChanged}, electronChanged=${electronChanged}).`,
  );
  await runStreaming('npm', ['install'], { cwd: repoRoot });
  if (electronChanged) {
    console.log('[update] Re-running `electron-builder install-app-deps` for new Electron ABI.');
    await runStreaming('npx', ['electron-builder', 'install-app-deps'], { cwd: repoRoot });
  }
};

const buildApp = async () => {
  if (FLAGS.noBuild) {
    console.log('[update] --no-build: skipping electron-builder.');
    return;
  }
  console.log('[update] Building app via `npm run desktop:build`...');
  await runStreaming('npm', ['run', 'desktop:build'], { cwd: repoRoot });
};

const swap = async () => {
  const built = await appBundleBuilt();
  if (!built) {
    throw new Error('[update] No built .app found in dist-electron/. Run `npm run desktop:build`.');
  }
  console.log(`[update] Built bundle: ${built}`);

  const installed = appBundleInstalled();
  const backup = previousAppBundleBackup();

  await mkdir(backupDir(), { recursive: true });

  if (await fileExists(installed)) {
    if (await fileExists(backup)) {
      console.log(`[update] Replacing prior backup at ${backup}.`);
      await rm(backup, { recursive: true, force: true });
    }
    console.log(`[update] Backing up current install: ${installed} → ${backup}`);
    await rename(installed, backup);
  } else {
    console.log(`[update] No prior install at ${installed} — fresh install.`);
  }

  console.log(`[update] Installing fresh bundle: ${built} → ${installed}`);
  await ditto(built, installed);

  if (!FLAGS.keepQuarantine) {
    console.log(`[update] Stripping com.apple.quarantine (build is unsigned).`);
    await stripQuarantine(installed);
  }

  console.log('[update] Verifying installed bundle (Mach-O magic + binary present)...');
  try {
    await verifyMachO(installed);
  } catch (error) {
    console.error(error.message);
    if (await fileExists(backup)) {
      console.log('[update] Restoring backup over failed install.');
      await rm(installed, { recursive: true, force: true });
      await rename(backup, installed);
    }
    throw new Error('[update] Smoke verification failed; rolled back.');
  }

  // Best-effort code-sign verify; don't fail on unsigned.
  try {
    const { stdout, stderr } = await run('codesign', ['--verify', '--verbose=2', installed]);
    if (stdout || stderr) {
      console.log(`[update] codesign --verify: ${stdout || stderr}`);
    }
  } catch (error) {
    console.log(`[update] codesign --verify warned (build is unsigned, expected): ${error?.message ?? error}`);
  }

  console.log(`[update] Done. ${installed} is the new install. Rollback available via \`npm run app:update -- --rollback\`.`);
};

const main = async () => {
  console.log(`Ramble On — update (${appName})\n`);

  const node = await checkNode();
  if (!node.ok) {
    console.error(`[update] Node ${node.label} — ${node.detail}`);
    process.exit(1);
  }

  await acquireLock();
  try {
    if (FLAGS.rollback) {
      await rollback();
      return;
    }

    await quitApp({ timeoutMs: 5000, force: true });

    const preElectron = await electronVersion();
    await gitPull();
    await installDepsIfNeeded(preElectron);
    await buildApp();
    await swap();
  } finally {
    await releaseLock();
  }
};

// Touch electronBuilderOutput so paths.mjs export stays referenced from this
// entry point (handy when running --no-build from a sibling shell).
void electronBuilderOutput;

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
