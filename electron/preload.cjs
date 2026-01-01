const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rambleOnDB', {
  saveRecording: (payload) => ipcRenderer.invoke('db:save-recording', payload),
  saveRawEntry: (payload) => ipcRenderer.invoke('db:save-raw', payload),
  savePolishedEntry: (payload) => ipcRenderer.invoke('db:save-polished', payload),
  saveKnowledgeBase: (payload) => ipcRenderer.invoke('db:save-knowledge-base', payload),
});
