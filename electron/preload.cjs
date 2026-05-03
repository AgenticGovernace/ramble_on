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
   * Returns the persisted AI provider preference, falling back to the
   * `AI_PROVIDER` environment variable when no user-data preference exists.
   * The renderer never sees raw provider keys — only this normalized
   * provider identifier.
   *
   * @returns {Promise<'gemini'|'openai'|'anthropic'|''>} The active provider.
   */
  getProviderPreference: () => ipcRenderer.invoke('app:get-provider-preference'),
  /**
   * Persists a provider preference to the Electron user-data directory.
   *
   * @param {'gemini'|'openai'|'anthropic'} provider The provider to persist.
   * @returns {Promise<{success: boolean, provider: string}>}
   */
  setProviderPreference: (provider) =>
    ipcRenderer.invoke('app:set-provider-preference', provider),
  /**
   * Generates text via the privileged main process. Provider keys never
   * cross into the renderer.
   *
   * @param {{provider?: string, prompt: string, geminiConfig?: object}} payload
   * @returns {Promise<string>} The generated text response.
   */
  generateText: (payload) => ipcRenderer.invoke('ai:generate-text', payload),
  /**
   * Transcribes audio bytes via the privileged main process.
   *
   * @param {{provider?: string, audioBase64: string, mimeType: string}} payload
   * @returns {Promise<string>} The transcribed text.
   */
  transcribeAudio: (payload) =>
    ipcRenderer.invoke('ai:transcribe-audio', payload),
  /**
   * Generates a Gemini Veo video and returns the downloaded bytes. Polling
   * and download both happen in main so the API key never leaves the
   * privileged process.
   *
   * @param {{prompt: string}} payload
   * @returns {Promise<{buffer: ArrayBuffer, contentType: string}>}
   */
  generateVideo: (payload) =>
    ipcRenderer.invoke('ai:generate-video', payload),
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
  /**
   * Installs the bundled Ramble On skill into the Claude Desktop skills
   * directory. Returns a discriminated Result — the renderer must check
   * `r.ok` before reading `r.value` or `r.error`.
   *
   * @returns {Promise<{ok: true, value: {installedAt: string, files: string[]}} | {ok: false, error: {code: string, message: string}}>}
   */
  installSkill: () => ipcRenderer.invoke('skill:install'),
});
