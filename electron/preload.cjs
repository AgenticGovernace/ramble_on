const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rambleOnDB', {
  saveRecording: (payload) => ipcRenderer.invoke('db:save-recording', payload),
  saveRawEntry: (payload) => ipcRenderer.invoke('db:save-raw', payload),
  savePolishedEntry: (payload) => ipcRenderer.invoke('db:save-polished', payload),
  getKnowledgeBase: () => ipcRenderer.invoke('kb:get-tree'),
  writeKnowledgeBaseFile: (payload) => ipcRenderer.invoke('kb:write-file', payload),
  onKnowledgeBaseUpdated: (callback) => {
    ipcRenderer.on('kb:updated', callback);
  },
});
