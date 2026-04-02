const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('recorder', {
    start: () => ipcRenderer.invoke('record:start'),
    stop: () => ipcRenderer.invoke('record:stop'),
    getSaved: () => ipcRenderer.invoke('record:getSaved')
});

console.log("Preload script loaded");
