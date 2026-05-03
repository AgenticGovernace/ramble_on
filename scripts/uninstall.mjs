#!/usr/bin/env node
/**
 * scripts/uninstall.mjs
 *
 * Removes Ramble On from the system. Five concentric levels of cleanup,
 * each guarded by its own confirmation:
 *   1. /Applications/Ramble On.app
 *   2. macOS sidecar dirs (Preferences plist, Saved State, Caches, Logs)
 *   3. userData (Application Support) — notes/KB/SQLite live here
 *   4. Repo build artifacts (dist/, dist-electron/)
 *   5. Repo node_modules and ./kb (separate explicit confirms)
 *
 * Standalone mode (no Notion connection) demands a typed "DELETE" before
 * wiping the local KB.
 */

import { rm } from 'node:fs/promises';

import {
  appBundleInstalled,
  cachesDirs,
  electronBuilderOutput,
  envLocalPath,
  isMacOS,
  logsDir,
  prefsPlist,
  productName,
  repoBuildArtifacts,
  repoOptionalCleanups,
  savedAppStateDir,
  unsupportedPlatformError,
  userDataDir,
} from './lib/paths.mjs';
import { confirm, requireTyped } from './lib/prompt.mjs';
import {
  checkNotion,
  dirSize,
  fileExists,
  formatBytes,
  readEnvLocal,
} from './lib/checks.mjs';
import { isPortInUse, quitApp, run } from './lib/proc.mjs';

const FLAGS = {
  yes: process.argv.includes('--yes'),
  dryRun: process.argv.includes('--dry-run'),
  keepData: process.argv.includes('--keep-data'),
  keepRepoArtifacts: process.argv.includes('--keep-repo-artifacts'),
  keepApp: process.argv.includes('--keep-app'),
};

if (process.env.CI && !FLAGS.yes && !FLAGS.dryRun) {
  console.error('[uninstall] Refusing to run interactively in CI. Pass --yes or --dry-run.');
  process.exit(1);
}

if (!isMacOS) {
  console.error(unsupportedPlatformError().message);
  process.exit(1);
}

const removeTarget = async (target) => {
  if (FLAGS.dryRun) {
    console.log(`  [dry-run] would rm -rf ${target.path}`);
    return;
  }
  console.log(`  rm -rf ${target.path}`);
  await rm(target.path, { recursive: true, force: true });
};

const buildTargets = async () => {
  const t = [];
  if (!FLAGS.keepApp) {
    t.push({ key: 'app', path: appBundleInstalled(), category: 'Installed app' });
  }
  for (const cache of cachesDirs()) {
    t.push({ key: 'cache', path: cache, category: 'macOS sidecar' });
  }
  t.push({ key: 'prefs', path: prefsPlist(), category: 'macOS sidecar' });
  t.push({ key: 'saved_state', path: savedAppStateDir(), category: 'macOS sidecar' });
  t.push({ key: 'logs', path: logsDir(), category: 'macOS sidecar' });
  if (!FLAGS.keepData) {
    t.push({ key: 'user_data', path: userDataDir(), category: 'User data (notes, KB, SQLite)' });
  }
  if (!FLAGS.keepRepoArtifacts) {
    for (const p of repoBuildArtifacts()) {
      t.push({ key: 'repo_artifact', path: p, category: 'Repo build artifact' });
    }
  }
  for (const p of repoOptionalCleanups()) {
    t.push({ key: 'repo_optional', path: p, category: 'Repo (optional, separate confirm)' });
  }

  const enriched = [];
  for (const target of t) {
    const exists = await fileExists(target.path);
    const size = exists ? await dirSize(target.path) : null;
    enriched.push({ ...target, exists, size });
  }
  return enriched;
};

const printPlan = (targets) => {
  console.log('Uninstall plan:\n');
  let widthCat = 0;
  for (const t of targets) widthCat = Math.max(widthCat, t.category.length);
  for (const t of targets) {
    const presence = t.exists ? formatBytes(t.size) : 'not present';
    console.log(`  [${t.exists ? 'X' : ' '}] ${t.category.padEnd(widthCat)}  ${t.path}  (${presence})`);
  }
  console.log('');
};

const confirmStandaloneWipe = async () => {
  if (FLAGS.keepData) return true;
  const env = await readEnvLocal();
  const hasNotionConfig = !!(env?.NOTION_API_KEY && env?.RAMBLE_NOTION_ROOT);
  if (!hasNotionConfig) {
    console.log(
      `\n[uninstall] WARNING: standalone mode (no Notion connection). ` +
        `User data at ${userDataDir()} contains your only copy of notes/KB.`,
    );
    if (FLAGS.yes) {
      console.log(
        '[uninstall] --yes set; proceeding without typed confirmation. ' +
          'This is your last chance to abort with Ctrl-C.',
      );
      return true;
    }
    return requireTyped(
      'Type DELETE to confirm wiping local KB',
      'DELETE',
    );
  }
  // Notion configured — verify it's actually reachable so the user isn't
  // bricked by a stale token they assume is good.
  if (FLAGS.yes) return true;
  process.env.NOTION_API_KEY = env.NOTION_API_KEY;
  process.env.RAMBLE_NOTION_ROOT = env.RAMBLE_NOTION_ROOT;
  const notion = await checkNotion();
  if (!notion.ok) {
    console.log(
      `\n[uninstall] Notion configured but unreachable: ${notion.label} — ${notion.detail}`,
    );
    return confirm(
      'Local KB may be your only copy. Continue with wipe?',
      { defaultValue: false },
    );
  }
  return true;
};

const main = async () => {
  console.log('Ramble On — uninstall\n');
  if (FLAGS.dryRun) console.log('[uninstall] DRY RUN — no filesystem changes will be made.\n');

  await quitApp({ timeoutMs: 5000, force: true });

  // lsof userData before delete to surface "still in use" issues.
  const ud = userDataDir();
  if (await fileExists(ud)) {
    try {
      const { stdout } = await run('lsof', ['+D', ud]);
      if (stdout.trim().length > 0) {
        console.log(`[uninstall] WARN: open file handles on ${ud}:\n${stdout}\n`);
      }
    } catch {
      // lsof exits non-zero when nothing matches — fine.
    }
  }
  if (await isPortInUse(3748)) {
    console.log('[uninstall] WARN: MCP port 3748 is in use. An orphan server may be running.');
  }

  const targets = await buildTargets();
  printPlan(targets);

  const presentTargets = targets.filter((t) => t.exists);
  if (presentTargets.length === 0) {
    console.log('Nothing to remove.');
    return;
  }

  if (!(await confirmStandaloneWipe())) {
    console.log('[uninstall] Aborted at KB confirmation step.');
    process.exit(1);
  }

  // Per-target confirmation unless --yes or --dry-run.
  for (const target of presentTargets) {
    if (!FLAGS.yes && !FLAGS.dryRun) {
      const ok = await confirm(
        `Remove ${target.category}: ${target.path}?`,
        { defaultValue: target.key !== 'repo_optional' },
      );
      if (!ok) {
        console.log('  skipped');
        continue;
      }
    }
    try {
      await removeTarget(target);
    } catch (error) {
      console.error(`  failed to remove ${target.path}: ${error?.message ?? error}`);
    }
  }

  // Offer to remove .env.local separately (it has secrets, deserves its own ask).
  if (!FLAGS.keepRepoArtifacts && (await fileExists(envLocalPath()))) {
    const ok = FLAGS.yes
      ? false
      : await confirm(
          `Remove .env.local (${envLocalPath()})? Contains your API keys.`,
          { defaultValue: false },
        );
    if (ok) {
      if (FLAGS.dryRun) {
        console.log(`  [dry-run] would rm ${envLocalPath()}`);
      } else {
        await rm(envLocalPath(), { force: true });
        console.log(`  rm ${envLocalPath()}`);
      }
    }
  }

  console.log('\n[uninstall] Done.');
  if (!FLAGS.dryRun) {
    console.log(`Reinstall: \`npm install && npm run app:init && npm run desktop:build && npm run app:update\``);
  }
};

// Reference electronBuilderOutput so an unused-import lint can't silently
// remove it later — we want this in the output path's surface.
void electronBuilderOutput;
void productName;

main().catch((error) => {
  console.error('[uninstall] fatal:', error);
  process.exit(2);
});
