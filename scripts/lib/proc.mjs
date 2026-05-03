/**
 * scripts/lib/proc.mjs
 *
 * Process helpers: detect/quit the running Ramble On app and run shell
 * commands with clean async semantics. macOS-specific (uses pgrep,
 * pkill, osascript). Bundle ID, not display name, is used for quit
 * because it survives renames and isn't fooled by stray window titles.
 */

import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

import { appId, productName, isMacOS, unsupportedPlatformError } from './paths.mjs';

const execFileAsync = promisify(execFile);

const requireMac = () => {
  if (!isMacOS) throw unsupportedPlatformError();
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Returns true if a process with the exact name `productName` is running.
 * Uses `pgrep -x` (exact process-name match). Avoid `-f` because it
 * matches the full command line and would catch `vim "Ramble On.md"`,
 * Activity Monitor's own grep, etc.
 */
export const isAppRunning = async () => {
  requireMac();
  try {
    const { stdout } = await execFileAsync('pgrep', ['-x', productName]);
    return stdout.trim().length > 0;
  } catch (error) {
    if (error?.code === 1) return false; // pgrep exits 1 when no match
    throw error;
  }
};

/**
 * Asks the running app to quit by bundle ID, polls for exit, and then
 * force-kills if it doesn't exit in time.
 */
export const quitApp = async ({ timeoutMs = 5000, force = true, log = console } = {}) => {
  requireMac();
  if (!(await isAppRunning())) return { quit: false, forced: false };

  log.log(`[proc] Asking "${productName}" to quit (bundle id ${appId})...`);
  try {
    await execFileAsync('osascript', [
      '-e',
      `tell application id "${appId}" to quit`,
    ]);
  } catch (error) {
    log.log(`[proc] osascript quit failed (${error?.message ?? 'unknown'}). Will fall back to pkill.`);
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isAppRunning())) return { quit: true, forced: false };
    await sleep(200);
  }

  if (!force) return { quit: false, forced: false };

  log.log(`[proc] Graceful quit timed out. Sending SIGTERM via pkill...`);
  try {
    await execFileAsync('pkill', ['-x', productName]);
  } catch (error) {
    if (error?.code !== 1) throw error; // 1 = no process matched
  }
  return { quit: !(await isAppRunning()), forced: true };
};

/**
 * Returns true if any process is listening on the MCP server's port.
 */
export const isPortInUse = async (port) => {
  try {
    const { stdout } = await execFileAsync('lsof', ['-i', `:${port}`, '-sTCP:LISTEN']);
    return stdout.trim().length > 0;
  } catch (error) {
    if (error?.code === 1) return false; // lsof exits 1 when no result
    throw error;
  }
};

/**
 * Promise-returning wrapper around `execFile`. For commands whose output
 * we want streamed live to the user, prefer `runStreaming`.
 */
export const run = async (cmd, args = [], { cwd, env } = {}) => {
  const { stdout, stderr } = await execFileAsync(cmd, args, { cwd, env });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
};

/**
 * Live-streaming command runner — pipes stdout/stderr to the parent so
 * the user sees output in real time. Resolves on exit code 0; rejects
 * with the exit code on non-zero.
 */
export const runStreaming = (cmd, args = [], { cwd, env } = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      env,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve({ code });
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
