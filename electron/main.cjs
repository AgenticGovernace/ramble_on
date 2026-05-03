const { app, BrowserWindow, ipcMain, session, systemPreferences } = require('electron');
const path = require('path');
const fsp = require('fs/promises');
const crypto = require('crypto');
const chokidar = require('chokidar');
const Database = require('better-sqlite3');
const { startMcpServer, stopMcpServer } = require('./mcp-server.cjs');
const aiClient = require('./mcp/clients/ai-client.cjs');
const { normalizeProvider } = require('./mcp/env.cjs');
const { ok, err, assertResult } = require('./lib/result.cjs');

const SKILL_NAME = 'ramble-on';
const SKILL_FILES = ['SKILL.md', 'references/platform-guides.md', 'references/voice-calibration.md'];

/**
 * Resolves the absolute path to the bundled skill source directory. In
 * packaged builds this lives under `process.resourcesPath/ramble-on`; in
 * development it lives under the repo root.
 *
 * @returns {string} Absolute path to the bundled skill directory.
 */
const resolveSkillSourceDir = () => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, SKILL_NAME);
  }
  return path.join(__dirname, '..', SKILL_NAME);
};

/**
 * Resolves the absolute path to the Claude Desktop skills directory in the
 * user's per-OS application support location.
 *
 * @returns {string} Absolute path to `<appData>/Claude/skills/ramble-on`.
 */
const resolveSkillDestDir = () =>
  path.join(app.getPath('appData'), 'Claude', 'skills', SKILL_NAME);

/**
 * Copies the bundled skill tree (SKILL.md + references/*.md) to the Claude
 * Desktop skills directory. Walks only files in the SKILL_FILES allowlist —
 * never follows symlinks, never accepts a path from the renderer.
 *
 * @returns {Promise<{installedAt: string, files: Array<string>}>}
 */
const copySkillTree = async () => {
  const sourceDir = resolveSkillSourceDir();
  const destDir = resolveSkillDestDir();
  const writtenFiles = [];

  try {
    for (const relative of SKILL_FILES) {
      const sourcePath = path.join(sourceDir, relative);
      const destPath = path.join(destDir, relative);
      const content = await fsp.readFile(sourcePath, 'utf8');
      await fsp.mkdir(path.dirname(destPath), { recursive: true });
      await fsp.writeFile(destPath, content, 'utf8');
      writtenFiles.push(relative);
    }
    return { installedAt: destDir, files: writtenFiles };
  } catch (error) {
    for (const relative of writtenFiles) {
      await fsp.unlink(path.join(destDir, relative)).catch(() => {});
    }
    throw error;
  }
};

const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';

let db = null;
let statements = null;
let mainWindow = null;
let kbWatcher = null;

/**
 * Returns whether a permission request origin belongs to this application.
 *
 * @param {string} origin The requesting origin supplied by Electron.
 * @returns {boolean} True when the origin is the packaged app or local dev URL.
 */
const isAllowedAppOrigin = (origin) => {
  if (!origin) return true;
  if (origin.startsWith('file://')) return true;

  try {
    const url = new URL(origin);
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  } catch (_error) {
    return false;
  }
};

/**
 * Configures Chromium permission handling for microphone access in the app
 * session and requests macOS microphone access when needed.
 *
 * @returns {Promise<void>} Resolves when permission handlers are installed.
 */
const configureMediaPermissions = async () => {
  const defaultSession = session.defaultSession;

  defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin, details) => {
    if (permission === 'media') {
      return (
        isAllowedAppOrigin(requestingOrigin) &&
        (details.mediaType === 'audio' || details.mediaType === 'unknown')
      );
    }
    return false;
  });

  defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    if (permission === 'media') {
      const mediaTypes = Array.isArray(details.mediaTypes) ? details.mediaTypes : [];
      const audioAllowed = mediaTypes.length === 0 || mediaTypes.includes('audio');
      callback(isAllowedAppOrigin(details.requestingUrl) && audioAllowed);
      return;
    }

    callback(false);
  });

  if (process.platform !== 'darwin') {
    return;
  }

  const accessStatus = systemPreferences.getMediaAccessStatus('microphone');
  if (accessStatus === 'not-determined') {
    const granted = await systemPreferences.askForMediaAccess('microphone');
    if (!granted) {
      console.warn('Microphone access was denied by macOS.');
    }
    return;
  }

  if (accessStatus !== 'granted') {
    console.warn(`Microphone access status is "${accessStatus}".`);
  }
};

/**
 * Converts a platform-specific path to a POSIX-style path for storage and IPC.
 *
 * @param {string} filePath The file-system path to normalize.
 * @returns {string} The normalized path using forward slashes.
 */
const toPosixPath = (filePath) => filePath.split(path.sep).join('/');

/**
 * Resolves a Knowledge Base relative path against the configured KB root while
 * preventing directory traversal and absolute-path escapes.
 *
 * @param {string} [relativePath=''] The requested Knowledge Base relative path.
 * @returns {{kbRoot: string, relativePath: string, absolutePath: string}} The
 * resolved root path, sanitized relative path, and absolute file-system path.
 */
const resolveKbPath = (relativePath = '') => {
  const kbRoot = getKbRoot();
  const normalized = path.posix.normalize(String(relativePath).replace(/\\/g, '/'));

  if (normalized === '.' || normalized === '') {
    return { kbRoot, relativePath: '', absolutePath: kbRoot };
  }

  if (path.posix.isAbsolute(normalized) || normalized.startsWith('..')) {
    throw new Error('Invalid Knowledge Base path.');
  }

  const absolutePath = path.resolve(kbRoot, ...normalized.split('/'));
  const resolvedRoot = path.resolve(kbRoot);
  if (absolutePath !== resolvedRoot && !absolutePath.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('Invalid Knowledge Base path.');
  }

  return { kbRoot, relativePath: normalized, absolutePath };
};

/**
 * Validates and sanitizes a Knowledge Base entry name before file-system use.
 *
 * @param {string} name The requested folder or file name.
 * @returns {string} The trimmed and validated entry name.
 */
const sanitizeEntryName = (name) => {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) throw new Error('Name is required.');
  if (trimmed === '.' || trimmed === '..') throw new Error('Invalid name.');
  if (trimmed.includes('/') || trimmed.includes('\\')) throw new Error('Name must not contain slashes.');
  return trimmed;
};

/**
 * Opens the user database, creates the required tables, and prepares the
 * parameterized statements used by the IPC handlers.
 *
 * @returns {void} No return value.
 */
const initDatabase = () => {
  const dbPath = path.join(app.getPath('userData'), 'ramble-on.sqlite');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS recordings (
      id TEXT PRIMARY KEY,
      note_id TEXT,
      append_mode INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS raw_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recording_id TEXT NOT NULL UNIQUE,
      note_id TEXT,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS polished_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recording_id TEXT NOT NULL UNIQUE,
      note_id TEXT,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_base_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      source TEXT
    );

    CREATE TABLE IF NOT EXISTS knowledge_base_files (
      path TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      hash TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  statements = {
    upsertRecording: db.prepare(`
      INSERT INTO recordings (id, note_id, append_mode, created_at, updated_at)
      VALUES (@id, @note_id, @append_mode, @created_at, @updated_at)
      ON CONFLICT(id) DO UPDATE SET
        note_id = excluded.note_id,
        append_mode = excluded.append_mode,
        updated_at = excluded.updated_at
    `),
    upsertRaw: db.prepare(`
      INSERT INTO raw_entries (recording_id, note_id, content, created_at)
      VALUES (@recording_id, @note_id, @content, @created_at)
      ON CONFLICT(recording_id) DO UPDATE SET
        content = excluded.content,
        created_at = excluded.created_at,
        note_id = excluded.note_id
    `),
    upsertPolished: db.prepare(`
      INSERT INTO polished_entries (recording_id, note_id, content, created_at)
      VALUES (@recording_id, @note_id, @content, @created_at)
      ON CONFLICT(recording_id) DO UPDATE SET
        content = excluded.content,
        created_at = excluded.created_at,
        note_id = excluded.note_id
    `),
    upsertKnowledgeBaseFile: db.prepare(`
      INSERT INTO knowledge_base_files (path, content, hash, updated_at)
      VALUES (@path, @content, @hash, @updated_at)
      ON CONFLICT(path) DO UPDATE SET
        content = excluded.content,
        hash = excluded.hash,
        updated_at = excluded.updated_at
    `),
    deleteKnowledgeBaseFile: db.prepare(`
      DELETE FROM knowledge_base_files WHERE path = @path
    `),
  };
};

/**
 * Determines the Knowledge Base root directory for the current runtime mode.
 *
 * @returns {string} The absolute directory path used for Knowledge Base files.
 */
const getKbRoot = () =>
  app.isPackaged
    ? path.join(app.getPath('userData'), 'kb')
    : path.join(app.getAppPath(), 'kb');

/**
 * Ensures the Knowledge Base root exists on disk before access.
 *
 * @returns {Promise<string>} The absolute Knowledge Base root path.
 */
const ensureKbRoot = async () => {
  const kbRoot = getKbRoot();
  await fsp.mkdir(kbRoot, { recursive: true });
  return kbRoot;
};

/**
 * Recursively reads the on-disk Knowledge Base into the renderer tree shape.
 *
 * @param {string} dir The directory currently being traversed.
 * @param {string} rootDir The root directory used to compute relative paths.
 * @returns {Promise<Array<object>>} The serialized Knowledge Base subtree.
 */
const readKbTree = async (dir, rootDir) => {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const items = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    const relativePosix = toPosixPath(path.relative(rootDir, fullPath));
    if (entry.isDirectory()) {
      const children = await readKbTree(fullPath, rootDir);
      items.push({
        type: 'folder',
        name: entry.name,
        path: relativePosix,
        children,
      });
    } else if (entry.isFile()) {
      const content = await fsp.readFile(fullPath, 'utf8');
      items.push({
        type: 'file',
        name: entry.name,
        content,
        path: relativePosix,
      });
    }
  }

  return items;
};

/**
 * Creates a deterministic content hash for Knowledge Base file snapshots.
 *
 * @param {string} content The file content to hash.
 * @returns {string} The SHA-256 hex digest of the content.
 */
const hashContent = (content) =>
  crypto.createHash('sha256').update(content).digest('hex');

/**
 * Mirrors a single Knowledge Base file from disk into SQLite.
 *
 * @param {string} filePath The absolute path to the file on disk.
 * @param {string} kbRoot The absolute Knowledge Base root path.
 * @returns {Promise<void>} No return value.
 */
const syncKbFileToDb = async (filePath, kbRoot) => {
  if (!db || !statements) return;
  const content = await fsp.readFile(filePath, 'utf8');
  const relativePath = path.relative(kbRoot, filePath);
  statements.upsertKnowledgeBaseFile.run({
    path: relativePath,
    content,
    hash: hashContent(content),
    updated_at: Date.now(),
  });
};

/**
 * Recursively syncs every Knowledge Base file beneath the supplied directory
 * into SQLite, keeping relative paths anchored to the original KB root so
 * file-system state remains queryable.
 *
 * @param {string} dir The directory currently being scanned.
 * @param {string} [kbRoot=dir] The original KB root used to compute relative
 * paths for SQLite records.
 * @returns {Promise<void>} No return value.
 */
const syncKbDirectoryToDb = async (dir, kbRoot = dir) => {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      if (entry.name.startsWith('.')) return;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await syncKbDirectoryToDb(fullPath, kbRoot);
      } else if (entry.isFile()) {
        await syncKbFileToDb(fullPath, kbRoot);
      }
    }),
  );
};

/**
 * Recursively lists all files beneath a directory for delete and rename flows.
 *
 * @param {string} dir The directory to walk.
 * @returns {Promise<string[]>} The absolute file paths discovered in the tree.
 */
const listKbFilesRecursive = async (dir) => {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const filePaths = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      filePaths.push(...(await listKbFilesRecursive(fullPath)));
    } else if (entry.isFile()) {
      filePaths.push(fullPath);
    }
  }
  return filePaths;
};

/**
 * Starts the file watcher that keeps SQLite and the renderer synchronized with
 * external Knowledge Base edits.
 *
 * @returns {Promise<void>} No return value.
 */
const startKbWatcher = async () => {
  const kbRoot = await ensureKbRoot();
  await syncKbDirectoryToDb(kbRoot);

  kbWatcher = chokidar.watch(kbRoot, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100,
    },
  });

  kbWatcher.on('add', async (filePath) => {
    try {
      const stat = await fsp.stat(filePath);
      if (stat.isFile()) {
        await syncKbFileToDb(filePath, kbRoot);
        mainWindow?.webContents.send('kb:updated');
      }
    } catch (error) {
      console.warn('KB add event failed:', error);
    }
  });

  kbWatcher.on('change', async (filePath) => {
    try {
      const stat = await fsp.stat(filePath);
      if (stat.isFile()) {
        await syncKbFileToDb(filePath, kbRoot);
        mainWindow?.webContents.send('kb:updated');
      }
    } catch (error) {
      console.warn('KB change event failed:', error);
    }
  });

  kbWatcher.on('unlink', async (filePath) => {
    const relativePath = path.relative(kbRoot, filePath);
    statements?.deleteKnowledgeBaseFile.run({ path: relativePath });
    mainWindow?.webContents.send('kb:updated');
  });
};

/**
 * Creates the main Electron browser window and loads either the Vite dev
 * server or the packaged renderer bundle.
 *
 * @returns {void} No return value.
 */
const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  } else {
    mainWindow.loadURL(devServerUrl);
  }
};

/**
 * Registers all renderer-facing IPC handlers for note persistence and
 * Knowledge Base CRUD operations.
 *
 * @returns {void} No return value.
 */
const requireRecordingId = (payload) => {
  const id = payload?.recordingId;
  if (typeof id !== 'string' || !id.trim()) {
    throw new Error('recordingId is required and must be a non-empty string.');
  }
  return id;
};

const registerIpcHandlers = () => {
  ipcMain.handle('db:save-recording', (_event, payload) => {
    if (!db || !statements) return;
    const recordingId = requireRecordingId(payload);
    const now = Date.now();
    statements.upsertRecording.run({
      id: recordingId,
      note_id: payload.noteId || null,
      append_mode: payload.appendMode ? 1 : 0,
      created_at: payload.createdAt || now,
      updated_at: now,
    });
  });

  ipcMain.handle('db:save-raw', (_event, payload) => {
    if (!db || !statements) return;
    const recordingId = requireRecordingId(payload);
    statements.upsertRaw.run({
      recording_id: recordingId,
      note_id: payload.noteId || null,
      content: payload.content || '',
      created_at: payload.createdAt || Date.now(),
    });
  });

  ipcMain.handle('db:save-polished', (_event, payload) => {
    if (!db || !statements) return;
    const recordingId = requireRecordingId(payload);
    statements.upsertPolished.run({
      recording_id: recordingId,
      note_id: payload.noteId || null,
      content: payload.content || '',
      created_at: payload.createdAt || Date.now(),
    });
  });

  ipcMain.handle('kb:get-tree', async () => {
    const kbRoot = await ensureKbRoot();
    const tree = await readKbTree(kbRoot, kbRoot);
    return { rootPath: kbRoot, tree };
  });

  ipcMain.handle('kb:write-file', async (_event, payload) => {
    const kbRoot = await ensureKbRoot();
    const { absolutePath: filePath } = resolveKbPath(payload.relativePath);

    // Ensure parent directory exists
    await fsp.mkdir(path.dirname(filePath), { recursive: true });

    // Write file content
    await fsp.writeFile(filePath, payload.content, 'utf8');

    return { success: true };
  });

  ipcMain.handle('kb:create-folder', async (_event, payload) => {
    const kbRoot = await ensureKbRoot();
    const parentRelative = payload?.parentPath ? resolveKbPath(payload.parentPath).relativePath : '';
    const folderName = sanitizeEntryName(payload?.name);
    const newRelative = parentRelative ? `${parentRelative}/${folderName}` : folderName;
    const { absolutePath: folderPath } = resolveKbPath(newRelative);
    await fsp.mkdir(folderPath, { recursive: false });
    await syncKbDirectoryToDb(kbRoot);
    mainWindow?.webContents.send('kb:updated');
    return { success: true, path: newRelative };
  });

  ipcMain.handle('kb:create-file', async (_event, payload) => {
    const kbRoot = await ensureKbRoot();
    const parentRelative = payload?.parentPath ? resolveKbPath(payload.parentPath).relativePath : '';
    const fileName = sanitizeEntryName(payload?.name);
    const newRelative = parentRelative ? `${parentRelative}/${fileName}` : fileName;
    const { absolutePath: filePath } = resolveKbPath(newRelative);
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await fsp.writeFile(filePath, payload?.content ?? '', 'utf8');
    await syncKbFileToDb(filePath, kbRoot);
    mainWindow?.webContents.send('kb:updated');
    return { success: true, path: newRelative };
  });

  ipcMain.handle('kb:delete-path', async (_event, payload) => {
    const kbRoot = await ensureKbRoot();
    const { absolutePath: targetPath, relativePath } = resolveKbPath(payload?.relativePath);
    const stat = await fsp.stat(targetPath);

    if (stat.isDirectory()) {
      const files = await listKbFilesRecursive(targetPath);
      for (const filePath of files) {
        const rel = toPosixPath(path.relative(kbRoot, filePath));
        statements?.deleteKnowledgeBaseFile.run({ path: rel });
      }
      await fsp.rm(targetPath, { recursive: true, force: false });
    } else {
      statements?.deleteKnowledgeBaseFile.run({ path: relativePath });
      await fsp.unlink(targetPath);
    }

    mainWindow?.webContents.send('kb:updated');
    return { success: true };
  });

  ipcMain.handle('kb:rename-path', async (_event, payload) => {
    const kbRoot = await ensureKbRoot();
    const { absolutePath: targetPath, relativePath } = resolveKbPath(payload?.relativePath);
    const newName = sanitizeEntryName(payload?.newName);

    const parentRelative = path.posix.dirname(relativePath) === '.' ? '' : path.posix.dirname(relativePath);
    const newRelative = parentRelative ? `${parentRelative}/${newName}` : newName;
    const { absolutePath: newPath } = resolveKbPath(newRelative);

    const stat = await fsp.stat(targetPath);
    if (stat.isDirectory()) {
      const beforeFiles = await listKbFilesRecursive(targetPath);
      const beforeRelatives = beforeFiles.map((filePath) => toPosixPath(path.relative(kbRoot, filePath)));

      await fsp.rename(targetPath, newPath);

      const afterFiles = await listKbFilesRecursive(newPath);
      for (const filePath of afterFiles) {
        await syncKbFileToDb(filePath, kbRoot);
      }
      for (const oldRel of beforeRelatives) {
        statements?.deleteKnowledgeBaseFile.run({ path: oldRel });
      }
    } else {
      await fsp.rename(targetPath, newPath);
      await syncKbFileToDb(newPath, kbRoot);
      statements?.deleteKnowledgeBaseFile.run({ path: relativePath });
    }

    mainWindow?.webContents.send('kb:updated');
    return { success: true, path: newRelative };
  });

  const PREFERENCES_FILE = path.join(app.getPath('userData'), 'preferences.json');

  const readPreferences = async () => {
    try {
      const raw = await fsp.readFile(PREFERENCES_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
  };

  const writePreferences = async (next) => {
    await fsp.mkdir(path.dirname(PREFERENCES_FILE), { recursive: true });
    await fsp.writeFile(
      PREFERENCES_FILE,
      JSON.stringify(next, null, 2),
      'utf8',
    );
  };

  ipcMain.handle('app:get-provider-preference', async () => {
    const prefs = await readPreferences();
    if (prefs && typeof prefs.aiProvider === 'string' && prefs.aiProvider) {
      return normalizeProvider(prefs.aiProvider);
    }
    if (process.env.AI_PROVIDER) {
      return normalizeProvider(process.env.AI_PROVIDER);
    }
    return '';
  });

  ipcMain.handle('app:set-provider-preference', async (_event, provider) => {
    const normalized = normalizeProvider(provider);
    const existing = (await readPreferences()) || {};
    await writePreferences({ ...existing, aiProvider: normalized });
    return { success: true, provider: normalized };
  });

  ipcMain.handle('ai:generate-text', async (_event, payload) => {
    const { provider, prompt, geminiConfig } = payload || {};
    if (typeof prompt !== 'string' || !prompt) {
      throw new Error('ai:generate-text requires a non-empty prompt.');
    }
    return aiClient.generateText({ provider, prompt, geminiConfig });
  });

  ipcMain.handle('ai:transcribe-audio', async (_event, payload) => {
    const { provider, audioBase64, mimeType } = payload || {};
    if (typeof audioBase64 !== 'string' || !audioBase64) {
      throw new Error('ai:transcribe-audio requires audioBase64.');
    }
    if (typeof mimeType !== 'string' || !mimeType) {
      throw new Error('ai:transcribe-audio requires mimeType.');
    }
    return aiClient.transcribeAudio({ provider, audioBase64, mimeType });
  });

  ipcMain.handle('ai:generate-video', async (_event, payload) => {
    const { prompt } = payload || {};
    if (typeof prompt !== 'string' || !prompt) {
      throw new Error('ai:generate-video requires a non-empty prompt.');
    }
    return aiClient.generateVideo({ prompt });
  });

  ipcMain.handle('skill:install', async () => {
    try {
      const result = await copySkillTree();
      return assertResult(ok(result));
    } catch (e) {
      return assertResult(
        err({
          code: 'INSTALL_FAILED',
          message: String(e?.message ?? e),
        }),
      );
    }
  });
};

app.whenReady().then(async () => {
  await configureMediaPermissions();
  initDatabase();
  registerIpcHandlers();
  await startMcpServer();
  createWindow();
  startKbWatcher();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopMcpServer().catch((error) => {
    console.warn('Failed to stop MCP server:', error);
  });
  if (kbWatcher) {
    kbWatcher.close().catch((error) => {
      console.warn('Failed to close KB watcher:', error);
    });
  }
});
