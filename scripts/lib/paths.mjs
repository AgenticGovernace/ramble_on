/**
 * scripts/lib/paths.mjs
 *
 * Platform-aware path resolution for install/update/uninstall scripts.
 * Mirrors Electron's `app.getPath('userData')` behavior outside Electron
 * by reading package.json and applying the same naming rules.
 *
 * macOS-only end-to-end for v1. Windows/Linux callers will throw a clear
 * error pointing at the v2 todo.
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const repoRoot = resolve(__dirname, '..', '..');

const pkg = JSON.parse(
  readFileSync(join(repoRoot, 'package.json'), 'utf8'),
);

export const appName = pkg.name; // "ramble_on" — drives Application Support dir
export const productName = pkg.build?.productName ?? pkg.name; // "Ramble On"
export const appId = pkg.build?.appId ?? 'com.rambleon.app';
export const electronBuilderOutput = join(
  repoRoot,
  pkg.build?.directories?.output ?? 'dist-electron',
);

const isMac = process.platform === 'darwin';

export const unsupportedPlatformError = () =>
  new Error(
    `Ramble On install scripts are macOS-only for v1. Detected platform: ${process.platform}. ` +
      'Windows/Linux support is tracked for v2.',
  );

const requireMac = () => {
  if (!isMac) throw unsupportedPlatformError();
};

/**
 * Returns the directory Electron uses for `app.getPath('userData')` on macOS.
 * Electron resolves to `~/Library/Application Support/<package.json#name>`
 * unless the app calls `app.setName()` first, which Ramble On does not.
 */
export const userDataDir = () => {
  requireMac();
  return join(homedir(), 'Library', 'Application Support', appName);
};

export const appBundleInstalled = () => {
  requireMac();
  return join('/Applications', `${productName}.app`);
};

const builtAppCandidates = () => {
  requireMac();
  return [
    join(electronBuilderOutput, 'mac-arm64', `${productName}.app`),
    join(electronBuilderOutput, 'mac', `${productName}.app`),
    join(electronBuilderOutput, 'mac-universal', `${productName}.app`),
    join(electronBuilderOutput, `${productName}.app`),
  ];
};

/**
 * Returns the first existing built `.app` candidate, or null if none exist.
 * Probe order matches electron-builder's per-arch output layout.
 */
export const appBundleBuilt = async () => {
  const { access } = await import('node:fs/promises');
  for (const candidate of builtAppCandidates()) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next
    }
  }
  return null;
};

export const appBundleBuiltCandidates = () => builtAppCandidates();

export const prefsPlist = () => {
  requireMac();
  return join(homedir(), 'Library', 'Preferences', `${appId}.plist`);
};

export const savedAppStateDir = () => {
  requireMac();
  return join(
    homedir(),
    'Library',
    'Saved Application State',
    `${appId}.savedState`,
  );
};

export const cachesDirs = () => {
  requireMac();
  return [
    join(homedir(), 'Library', 'Caches', appId),
    join(homedir(), 'Library', 'Caches', productName),
  ];
};

export const logsDir = () => {
  requireMac();
  return join(homedir(), 'Library', 'Logs', productName);
};

export const backupDir = () => join(electronBuilderOutput, '.backup');

export const previousAppBundleBackup = () =>
  join(backupDir(), `${productName}.app.previous`);

export const lockFile = () => join(backupDir(), '.update.lock');

export const envLocalPath = () => join(repoRoot, '.env.local');

export const repoBuildArtifacts = () => [
  join(repoRoot, 'dist'),
  electronBuilderOutput,
];

export const repoOptionalCleanups = () => [
  join(repoRoot, 'node_modules'),
  join(repoRoot, 'kb'),
];

export const isMacOS = isMac;
