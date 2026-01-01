const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');

const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';

let db = null;
let statements = null;

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
    insertKnowledgeBase: db.prepare(`
      INSERT INTO knowledge_base_snapshots (content, created_at, source)
      VALUES (@content, @created_at, @source)
    `),
  };
};

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  } else {
    win.loadURL(devServerUrl);
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

  ipcMain.handle('db:save-knowledge-base', (_event, payload) => {
    if (!db || !statements) return;
    statements.insertKnowledgeBase.run({
      content: payload.content || '',
      created_at: payload.createdAt || Date.now(),
      source: payload.source || 'app',
    });
  });
};

app.whenReady().then(() => {
  initDatabase();
  registerIpcHandlers();
  createWindow();

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
