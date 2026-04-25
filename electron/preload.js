const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('recorder', {
    getSaved: () => ipcRenderer.invoke('record:getSaved'),
    getMicrophones: () => ipcRenderer.invoke('getMicrophones'),
    saveMixedAudio: (byteArray) => ipcRenderer.invoke('record:saveMixedAudio', byteArray),
    transcribeLocal: () => ipcRenderer.invoke('transcribe:local'),
    getTranscriptFile: () => ipcRenderer.invoke('get-transcript-file'),
    generateSummary: (options) => ipcRenderer.invoke("summary:generate",options)
    // so that we can call the generateSummary function from the renderer process for example if we want to make any changes in fe we start with invoking the function from here
});

console.log("Preload script loaded");
