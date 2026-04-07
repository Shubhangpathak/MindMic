const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('recorder', {
    getSaved: () => ipcRenderer.invoke('record:getSaved'),
    getMicrophones: () => ipcRenderer.invoke('getMicrophones'),
    saveMixedAudio: (byteArray) => ipcRenderer.invoke('record:saveMixedAudio', byteArray),
    transcribeLocal: () => ipcRenderer.invoke('transcribe:local'),


});

console.log("Preload script loaded");
