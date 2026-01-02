const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const crypto = require('crypto');
const chokidar = require('chokidar');
const Database = require('better-sqlite3');

const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';

let db = null;
let statements = null;
let mainWindow = null;
let kbWatcher = null;

const toPosixPath = (filePath) => filePath.split(path.sep).join('/');

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

const sanitizeEntryName = (name) => {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) throw new Error('Name is required.');
  if (trimmed === '.' || trimmed === '..') throw new Error('Invalid name.');
  if (trimmed.includes('/') || trimmed.includes('\\')) throw new Error('Name must not contain slashes.');
  return trimmed;
};

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

const getKbRoot = () =>
  app.isPackaged
    ? path.join(app.getPath('userData'), 'kb')
    : path.join(app.getAppPath(), 'kb');

const ensureKbRoot = async () => {
  const kbRoot = getKbRoot();
  await fsp.mkdir(kbRoot, { recursive: true });
  return kbRoot;
};

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

const hashContent = (content) =>
  crypto.createHash('sha256').update(content).digest('hex');

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

const syncKbDirectoryToDb = async (kbRoot) => {
  const entries = await fsp.readdir(kbRoot, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      if (entry.name.startsWith('.')) return;
      const fullPath = path.join(kbRoot, entry.name);
      if (entry.isDirectory()) {
        await syncKbDirectoryToDb(fullPath);
      } else if (entry.isFile()) {
        await syncKbFileToDb(fullPath, kbRoot);
      }
    }),
  );
};

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
      if (fs.statSync(filePath).isFile()) {
        await syncKbFileToDb(filePath, kbRoot);
        mainWindow?.webContents.send('kb:updated');
      }
    } catch (error) {
      console.warn('KB add event failed:', error);
    }
  });

  kbWatcher.on('change', async (filePath) => {
    try {
      if (fs.statSync(filePath).isFile()) {
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

const registerIpcHandlers = () => {
  ipcMain.handle('db:save-recording', (_event, payload) => {
    if (!db || !statements) return;
    const now = Date.now();
    statements.upsertRecording.run({
      id: payload.recordingId,
      note_id: payload.noteId || null,
      append_mode: payload.appendMode ? 1 : 0,
      created_at: payload.createdAt || now,
      updated_at: now,
    });
  });

  ipcMain.handle('db:save-raw', (_event, payload) => {
    if (!db || !statements) return;
    statements.upsertRaw.run({
      recording_id: payload.recordingId,
      note_id: payload.noteId || null,
      content: payload.content || '',
      created_at: payload.createdAt || Date.now(),
    });
  });

  ipcMain.handle('db:save-polished', (_event, payload) => {
    if (!db || !statements) return;
    statements.upsertPolished.run({
      recording_id: payload.recordingId,
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
};

app.whenReady().then(() => {
  initDatabase();
  registerIpcHandlers();
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
  if (kbWatcher) {
    kbWatcher.close().catch((error) => {
      console.warn('Failed to close KB watcher:', error);
    });
  }
});
