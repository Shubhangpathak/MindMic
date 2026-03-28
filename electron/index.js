const { app, BrowserWindow, ipcMain, protocol } = require('electron')
const path = require("path");
const fs = require("fs");
const { startRecording, stopRecording } = require("../sound-recorder/record")

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
    win.webContents.openDevTools();
}

// Register custom protocol before app is ready
protocol.registerSchemesAsPrivileged([
    {
        scheme: 'audio',
        privileges: {
            secure: true,
            standard: true,
            supportFetchAPI: true,
            corsEnabled: true
        }
    }
]);

app.whenReady().then(() => {
    // Register the audio protocol handler
    protocol.handle('audio', (request) => {
        const url = new URL(request.url);
        const filePath = decodeURIComponent(url.pathname);

        return net.fetch(`file://${filePath}`);
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});


// ipcMain.handle("record:start", () => {
//     console.log("Main: starting recording")
//     return startRecording();
// })
// ipcMain.handle("record:stop", () => {
//     console.log("Main: stoped recording")
//     return stopRecording();
// })
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
        const audioPath = path.join(process.cwd(), "output.wav");
        if (fs.existsSync(audioPath)) {
            console.log("Audio file found at:", audioPath);
            return {
                success: true,
                audioPath: audioPath
            };
        } else {
            console.log("Audio file not found at:", audioPath);
            return {
                success: false,
                message: "Audio file not found"
            };
        }
    } catch (err) {
        return {
            success: false,
            message: err.message
        };
    }
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
