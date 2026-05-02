/**
 * scripts/lib/checks.mjs
 *
 * Pure read-only diagnostics shared by doctor.mjs, init.mjs, update.mjs,
 * and uninstall.mjs. Each check returns:
 *   { name, ok, label, detail }
 * where `ok: false` indicates an issue (but never throws — checks are
 * diagnostic, not gating). Callers decide whether a `false` is fatal.
 */

import { access, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';

import {
  appBundleBuilt,
  appBundleInstalled,
  cachesDirs,
  envLocalPath,
  isMacOS,
  logsDir,
  prefsPlist,
  productName,
  repoRoot,
  savedAppStateDir,
  userDataDir,
} from './paths.mjs';
import { isAppRunning, isPortInUse, run } from './proc.mjs';

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
const MCP_PORT = Number(process.env.RAMBLE_MCP_PORT) || 3748;

const result = (name, ok, label, detail = '') => ({ name, ok, label, detail });

const fileExists = async (p) => {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
};

const dirSize = async (p) => {
  if (!(await fileExists(p))) return null;
  try {
    const { stdout } = await run('du', ['-sk', p]);
    const kb = Number.parseInt(stdout.split(/\s+/, 1)[0], 10);
    return Number.isFinite(kb) ? kb * 1024 : null;
  } catch {
    return null;
  }
};

const formatBytes = (n) => {
  if (n == null) return 'unknown';
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
};

export const checkPlatform = async () =>
  isMacOS
    ? result('platform', true, 'macOS', process.platform)
    : result(
        'platform',
        false,
        'unsupported',
        `${process.platform} — v1 mac-only; Win/Linux deferred to v2`,
      );

export const checkNode = async () => {
  const major = Number.parseInt(process.versions.node.split('.', 1)[0], 10);
  if (major >= 18) {
    return result('node', true, `v${process.versions.node}`, '');
  }
  return result('node', false, `v${process.versions.node}`, 'need >= 18');
};

export const checkInstalledApp = async () => {
  const p = appBundleInstalled();
  if (!(await fileExists(p))) {
    return result('installed_app', false, 'not installed', p);
  }
  const s = await stat(p);
  return result(
    'installed_app',
    true,
    `installed (${formatBytes(s.size)})`,
    p,
  );
};

export const checkBuiltApp = async () => {
  const p = await appBundleBuilt();
  if (!p) {
    return result('built_app', false, 'no built bundle', 'run `npm run desktop:build`');
  }
  return result('built_app', true, 'built', p);
};

export const checkUserData = async () => {
  const dir = userDataDir();
  if (!(await fileExists(dir))) {
    return result('user_data', false, 'not present', dir);
  }
  const size = await dirSize(dir);
  return result('user_data', true, formatBytes(size), dir);
};

export const checkSqlite = async () => {
  const p = `${userDataDir()}/ramble-on.sqlite`;
  if (!(await fileExists(p))) {
    return result('sqlite', false, 'no db file', p);
  }
  const s = await stat(p);
  return result('sqlite', true, formatBytes(s.size), p);
};

export const checkKb = async () => {
  const p = `${userDataDir()}/kb`;
  if (!(await fileExists(p))) {
    return result('kb', false, 'no kb dir', p);
  }
  try {
    const { stdout } = await run('find', [p, '-type', 'f']);
    const count = stdout ? stdout.split('\n').filter(Boolean).length : 0;
    const size = await dirSize(p);
    return result('kb', true, `${count} file(s), ${formatBytes(size)}`, p);
  } catch {
    return result('kb', true, 'present', p);
  }
};

const parseEnvLocal = (text) => {
  const keys = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed
      .slice(eqIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (key) keys[key] = val;
  }
  return keys;
};

const maskKey = (val) => {
  if (!val) return '';
  if (val.length <= 8) return '*'.repeat(val.length);
  return `${val.slice(0, 4)}…${val.slice(-3)} (${val.length} chars)`;
};

export const readEnvLocal = async () => {
  if (!(await fileExists(envLocalPath()))) return null;
  const text = await readFile(envLocalPath(), 'utf8');
  return parseEnvLocal(text);
};

export const checkEnvLocal = async () => {
  const env = await readEnvLocal();
  if (!env) {
    return result('env_local', false, 'missing', envLocalPath());
  }
  const keys = Object.keys(env);
  const recommended = [
    'GEMINI_API_KEY',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'NOTION_API_KEY',
    'AI_PROVIDER',
    'RAMBLE_NOTION_ROOT',
  ];
  const present = recommended.filter((k) => env[k]);
  const masked = present.map((k) => `${k}=${maskKey(env[k])}`).join(', ');
  return result(
    'env_local',
    present.length > 0,
    `${present.length} key(s) set`,
    masked || 'no recommended keys present',
  );
};

const notionFetch = async (path, token) => {
  const res = await fetch(`${NOTION_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
    },
  });
  return res;
};

/**
 * Two-call Notion verify:
 *   1. GET /users/me   → 401 distinguishes "bad token"
 *   2. GET /pages/:id  → 404 distinguishes "integration not shared with page"
 */
export const checkNotion = async () => {
  const env = await readEnvLocal();
  const token = env?.NOTION_API_KEY ?? process.env.NOTION_API_KEY ?? '';
  const rootId =
    env?.RAMBLE_NOTION_ROOT ?? process.env.RAMBLE_NOTION_ROOT ?? '';

  if (!token) {
    return result('notion', false, 'no token', 'NOTION_API_KEY not set (standalone mode)');
  }

  let usersRes;
  try {
    usersRes = await notionFetch('/users/me', token);
  } catch (error) {
    return result('notion', false, 'network error', error?.message ?? 'unknown');
  }
  if (usersRes.status === 401) {
    return result('notion', false, 'bad token', 'NOTION_API_KEY rejected (401). Regenerate at https://www.notion.so/my-integrations');
  }
  if (!usersRes.ok) {
    return result('notion', false, `users/me ${usersRes.status}`, await usersRes.text());
  }

  if (!rootId) {
    return result('notion', false, 'no root page', 'RAMBLE_NOTION_ROOT not set');
  }

  let pagesRes;
  try {
    pagesRes = await notionFetch(`/pages/${rootId}`, token);
  } catch (error) {
    return result('notion', false, 'network error', error?.message ?? 'unknown');
  }
  if (pagesRes.status === 404) {
    return result(
      'notion',
      false,
      'root page unreachable',
      `Page ${rootId} not shared with the integration. Open the page in Notion → "..." → "Connect to" → pick your integration.`,
    );
  }
  if (!pagesRes.ok) {
    return result('notion', false, `pages/{root} ${pagesRes.status}`, await pagesRes.text());
  }

  return result('notion', true, 'connected', `root ${rootId}`);
};

export const checkRunning = async () => {
  const running = await isAppRunning();
  return result(
    'running',
    !running,
    running ? 'app is running' : 'app is not running',
    running ? `quit "${productName}" before update/uninstall` : '',
  );
};

export const checkMcpPort = async () => {
  const inUse = await isPortInUse(MCP_PORT);
  return result(
    'mcp_port',
    !inUse,
    inUse ? `port ${MCP_PORT} in use` : `port ${MCP_PORT} free`,
    inUse ? 'orphaned MCP server may block app start' : '',
  );
};

export const checkGit = async () => {
  if (!existsSync(`${repoRoot}/.git`)) {
    return result('git', false, 'not a git repo', repoRoot);
  }
  try {
    const branch = (await run('git', ['-C', repoRoot, 'rev-parse', '--abbrev-ref', 'HEAD'])).stdout;
    const status = (await run('git', ['-C', repoRoot, 'status', '--porcelain'])).stdout;
    const dirty = status.length > 0;
    let aheadBehind = '';
    try {
      const ab = (await run('git', ['-C', repoRoot, 'rev-list', '--left-right', '--count', 'HEAD...@{u}'])).stdout;
      const [ahead, behind] = ab.split('\t').map(Number);
      aheadBehind = ` (ahead ${ahead}, behind ${behind})`;
    } catch {
      aheadBehind = ' (no upstream)';
    }
    return result('git', !dirty, `${branch}${aheadBehind}${dirty ? ' [dirty]' : ''}`, '');
  } catch (error) {
    return result('git', false, 'git error', error?.message ?? 'unknown');
  }
};

export const checkSidecarFiles = async () => {
  const targets = [
    prefsPlist(),
    savedAppStateDir(),
    ...cachesDirs(),
    logsDir(),
  ];
  const present = [];
  for (const t of targets) {
    if (await fileExists(t)) present.push(t);
  }
  return result(
    'macos_sidecars',
    true,
    present.length === 0 ? 'none' : `${present.length} present`,
    present.join(', '),
  );
};

export const ALL_CHECKS = [
  checkPlatform,
  checkNode,
  checkInstalledApp,
  checkBuiltApp,
  checkUserData,
  checkSqlite,
  checkKb,
  checkEnvLocal,
  checkNotion,
  checkRunning,
  checkMcpPort,
  checkGit,
  checkSidecarFiles,
];

export const runAllChecks = async () => {
  const out = [];
  for (const check of ALL_CHECKS) {
    try {
      out.push(await check());
    } catch (error) {
      out.push({
        name: check.name,
        ok: false,
        label: 'check threw',
        detail: error?.message ?? String(error),
      });
    }
  }
  return out;
};

export { formatBytes, fileExists, dirSize };
