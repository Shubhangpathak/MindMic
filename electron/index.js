const { app, BrowserWindow, desktopCapturer, ipcMain, session } = require('electron');
const path = require("path");
const fs = require("fs");
const { exec, execFile } = require("child_process");
const { pathToFileURL } = require('url');
const { OUTPUT_FILE } = require("../sound-recorder/record");

const TEMP_RECORDING_FILE = path.resolve(__dirname, "output.webm");

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

function configureDisplayMediaLoopback() {
    session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: 1, height: 1 }
            });

            if (!sources.length) {
                callback({});
                return;
            }

            callback({
                video: sources[0],
                audio: 'loopback'
            });
        } catch (error) {
            console.error("Failed to provide display media source:", error);
            callback({});
        }
    });
}

function convertWebmToWav() {
    return new Promise((resolve, reject) => {
        execFile(
            "ffmpeg",
            ["-y", "-i", TEMP_RECORDING_FILE, OUTPUT_FILE],
            (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(stderr || error.message));
                    return;
                }

                resolve();
            }
        );
    });
}

ipcMain.handle("record:getSaved", async () => {
    return getSavedRecordingPayload();
});

ipcMain.handle("getMicrophones", async () => {
    return new Promise((resolve) => {
        exec('ffmpeg -list_devices true -f dshow -i dummy', (error, stdout, stderr) => {
            resolve(`${stdout || ""}\n${stderr || ""}`);
        });
    });
});

ipcMain.handle("record:saveMixedAudio", async (event, byteArray) => {
    try {
        fs.writeFileSync(TEMP_RECORDING_FILE, Buffer.from(byteArray));
        await convertWebmToWav();

        if (fs.existsSync(TEMP_RECORDING_FILE)) {
            fs.unlinkSync(TEMP_RECORDING_FILE);
        }

        return getSavedRecordingPayload();
    } catch (err) {
        return {
            success: false,
            message: err.message
        };
    }
});

//for hadling the transcription 
ipcMain.handle("transcribe:local", async () => {
    return new Promise((resolve, reject) => {
        
        // OUTPUT_FILE is already imported at the top of your index.js
        // that's the output.wav path — pass it to Python as an argument
        const py = spawn('python', [
            path.resolve(__dirname, '../transcribe.py'),
            OUTPUT_FILE
        ]);

        let result = '';
        let errorOut = '';

        // Python's print() goes to stdout — collect it here
        py.stdout.on('data', (data) => {
            result += data.toString();
        });

        // Collect errors too so you can debug if it fails
        py.stderr.on('data', (data) => {
            errorOut += data.toString();
        });

        // When Python script finishes (exit code 0 = success)
        py.on('close', (code) => {
            if (code === 0 && result.trim()) {
                resolve(result.trim());
            } else {
                reject(new Error(errorOut || 'Transcription failed'));
            }
        });
    });
});


app.whenReady().then(() => {
    configureDisplayMediaLoopback();
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
