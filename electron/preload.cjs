const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rambleOnDB', {
  saveRecording: (payload) => ipcRenderer.invoke('db:save-recording', payload),
  saveRawEntry: (payload) => ipcRenderer.invoke('db:save-raw', payload),
  savePolishedEntry: (payload) => ipcRenderer.invoke('db:save-polished', payload),
  getKnowledgeBase: () => ipcRenderer.invoke('kb:get-tree'),
  writeKnowledgeBaseFile: (payload) => ipcRenderer.invoke('kb:write-file', payload),
  createKnowledgeBaseFolder: (payload) => ipcRenderer.invoke('kb:create-folder', payload),
  createKnowledgeBaseFile: (payload) => ipcRenderer.invoke('kb:create-file', payload),
  deleteKnowledgeBasePath: (payload) => ipcRenderer.invoke('kb:delete-path', payload),
  renameKnowledgeBasePath: (payload) => ipcRenderer.invoke('kb:rename-path', payload),
  onKnowledgeBaseUpdated: (callback) => {
    ipcRenderer.on('kb:updated', callback);
  },
});
