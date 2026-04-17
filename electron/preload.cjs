const { contextBridge, ipcRenderer } = require('electron');

/**
 * Exposes the safe renderer-facing persistence and Knowledge Base API surface
 * through Electron's isolated preload bridge.
 */
contextBridge.exposeInMainWorld('rambleOnDB', {
  /**
   * Persists recording-session metadata for the active note workflow.
   *
   * @param {{recordingId: string, noteId: string | null, appendMode: boolean, createdAt?: number}} payload
   * The recording metadata to store.
   * @returns {Promise<void>} Resolves when the main process write completes.
   */
  saveRecording: (payload) => ipcRenderer.invoke('db:save-recording', payload),
  /**
   * Persists the raw transcription captured for a recording session.
   *
   * @param {{recordingId: string, noteId: string | null, content: string, createdAt?: number}} payload
   * The raw note payload to store.
   * @returns {Promise<void>} Resolves when the main process write completes.
   */
  saveRawEntry: (payload) => ipcRenderer.invoke('db:save-raw', payload),
  /**
   * Persists the polished note content generated for a recording session.
   *
   * @param {{recordingId: string, noteId: string | null, content: string, createdAt?: number}} payload
   * The polished note payload to store.
   * @returns {Promise<void>} Resolves when the main process write completes.
   */
  savePolishedEntry: (payload) => ipcRenderer.invoke('db:save-polished', payload),
  /**
   * Loads the current Knowledge Base tree and file contents from the main
   * process.
   *
   * @returns {Promise<{rootPath: string, tree: Array<object>}>} The Knowledge
   * Base root path and serialized tree payload.
   */
  getKnowledgeBase: () => ipcRenderer.invoke('kb:get-tree'),
  /**
   * Writes new content to an existing Knowledge Base file.
   *
   * @param {{relativePath: string, content: string}} payload The target file
   * path and replacement content.
   * @returns {Promise<{success: boolean}>} The success status from the main
   * process.
   */
  writeKnowledgeBaseFile: (payload) => ipcRenderer.invoke('kb:write-file', payload),
  /**
   * Creates a new Knowledge Base folder beneath the requested parent path.
   *
   * @param {{parentPath?: string, name: string}} payload The parent path and
   * folder name to create.
   * @returns {Promise<{success: boolean, path: string}>} The success status and
   * created relative path.
   */
  createKnowledgeBaseFolder: (payload) => ipcRenderer.invoke('kb:create-folder', payload),
  /**
   * Creates a new Knowledge Base file beneath the requested parent path.
   *
   * @param {{parentPath?: string, name: string, content?: string}} payload The
   * parent path, file name, and optional initial content.
   * @returns {Promise<{success: boolean, path: string}>} The success status and
   * created relative path.
   */
  createKnowledgeBaseFile: (payload) => ipcRenderer.invoke('kb:create-file', payload),
  /**
   * Deletes a Knowledge Base file or folder tree.
   *
   * @param {{relativePath: string}} payload The relative path to delete.
   * @returns {Promise<{success: boolean}>} The success status from the main
   * process.
   */
  deleteKnowledgeBasePath: (payload) => ipcRenderer.invoke('kb:delete-path', payload),
  /**
   * Renames a Knowledge Base file or folder.
   *
   * @param {{relativePath: string, newName: string}} payload The current path
   * and replacement name.
   * @returns {Promise<{success: boolean, path: string}>} The success status and
   * updated relative path.
   */
  renameKnowledgeBasePath: (payload) => ipcRenderer.invoke('kb:rename-path', payload),
  /**
   * Registers a renderer callback for Knowledge Base change notifications.
   *
   * @param {Function} callback The callback invoked when the Knowledge Base
   * changes.
   * @returns {void} No return value.
   */
  onKnowledgeBaseUpdated: (callback) => {
    ipcRenderer.on('kb:updated', callback);
  },
});
