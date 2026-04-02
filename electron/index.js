const { app, BrowserWindow, ipcMain } = require('electron')
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require('url');
const { startRecording, stopRecording, OUTPUT_FILE } = require("../sound-recorder/record")


function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    win.loadFile(path.join(__dirname, "index.html"));

    // Opens DevTools for debugging will diable in production
    // win.webContents.openDevTools(); for developer option in application
    win.webContents.openDevTools();

    return win;
}

function getSavedRecordingPayload() {
    console.log("Checking audio file at:", OUTPUT_FILE);
    console.log("File exists:", fs.existsSync(OUTPUT_FILE));

    if (!fs.existsSync(OUTPUT_FILE)) {
        return {
            success: false,
            message: "Audio file not found"
        };
    }

    const stats = fs.statSync(OUTPUT_FILE);
    console.log("Audio file size:", stats.size, "bytes");

    if (stats.size === 0) {
        return {
            success: false,
            message: "Audio file is empty"
        };
    }

    return {
        success: true,
        audioUrl: pathToFileURL(OUTPUT_FILE).href,
        audioPath: OUTPUT_FILE
    };
}

ipcMain.handle("record:start", async () => {
    console.log("Main: starting recording");

    try {
        await startRecording();
        return { success: true };
    } catch (err) {
        return {
            success: false,
            message: err.message
        };
    }
});

ipcMain.handle("record:stop", async () => {
    console.log("Main: stopped recording");

    try {
        await stopRecording();

        await new Promise(r => setTimeout(r, 500));
        return getSavedRecordingPayload();
    } catch (err) {
        return {
            success: false,
            message: err.message
        };
    }
});

ipcMain.handle("record:getSaved", async () => {
    return getSavedRecordingPayload();
});

app.whenReady().then(() => {
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
