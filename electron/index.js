const { app, BrowserWindow, desktopCapturer, ipcMain, session } = require('electron');
const path = require("path");
const fs = require("fs");
const { exec, spawn } = require("child_process");
const { pathToFileURL } = require('url');
const { OUTPUT_FILE } = require("../sound-recorder/record");
const { getMeetingsDir } = require('../services/storage');
const { createMeeting, listMeetings, renameMeeting } = require('../services/meetings.js');

const TEMP_RECORDING_FILE = path.resolve(__dirname, "output.webm");
const PROJECT_ROOT = path.resolve(__dirname, "..");
const ENV_FILE_PATH = path.join(PROJECT_ROOT, '.env');

require('dotenv').config({ path: ENV_FILE_PATH });

const { generateSummary } = require("../router/apiConfig");
const { summarizeTranscript } = require("../router/ollamaConfig");

function getPythonCommand() {
    const venvPython = path.join(PROJECT_ROOT, ".venv", "Scripts", "python.exe");
    if (fs.existsSync(venvPython)) {
        return {
            command: venvPython,
            args: []
        };
    }

    return {
        command: "py",
        args: ["-3"]
    };
}

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

function createProcessStartError(command, error) {
    if (error.code === "ENOENT") {
        return new Error(`Unable to find ${command}. Add FFmpeg to PATH and restart the app.`);
    }

    if (error.code === "EACCES" || error.code === "EPERM") {
        return new Error(
            `Windows blocked ${command}. Allow ffmpeg.exe in Windows Security or reinstall FFmpeg from a trusted source.`
        );
    }

    return new Error(`Unable to start ${command}: ${error.message}`);
}

function getRuntimeSettings() {
    return {
        ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        ollamaModel: process.env.OLLAMA_MODEL || 'mistral',
        preferredAgent: process.env.PREFERRED_AGENT || 'ollama-local'
    };
}

function upsertEnvValue(key, value) {
    const normalizedValue = String(value).replace(/\r?\n/g, '').trim();
    const linePattern = new RegExp(`^${key}=.*$`, 'm');
    let envContent = fs.existsSync(ENV_FILE_PATH) ? fs.readFileSync(ENV_FILE_PATH, 'utf-8') : '';

    if (linePattern.test(envContent)) {
        envContent = envContent.replace(linePattern, `${key}=${normalizedValue}`);
    } else {
        if (envContent && !envContent.endsWith('\n')) {
            envContent += '\n';
        }
        envContent += `${key}=${normalizedValue}\n`;
    }

    fs.writeFileSync(ENV_FILE_PATH, envContent);
    process.env[key] = normalizedValue;
}

function convertWebmToWav() {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn(
            "ffmpeg",
            ["-y", "-i", TEMP_RECORDING_FILE, OUTPUT_FILE],
            { windowsHide: true }
        );

        let stderr = "";
        let settled = false;

        ffmpeg.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });

        ffmpeg.on("error", (error) => {
            settled = true;
            reject(createProcessStartError("ffmpeg", error));
        });

        ffmpeg.on("close", (code) => {
            if (settled) {
                return;
            }

            if (code === 0) {
                resolve();
                return;
            }

            const ffmpegMessage = stderr.trim()
                || `FFmpeg exited with code ${code}. Windows may have blocked ffmpeg.exe; allow it in Windows Security or reinstall FFmpeg from a trusted source.`;
            reject(new Error(`Audio conversion failed: ${ffmpegMessage}`));
        });
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

ipcMain.handle('settings:get', async () => {
    return getRuntimeSettings();
});

ipcMain.handle('settings:set', async (event, settings) => {
    if (settings?.ollamaBaseUrl) {
        upsertEnvValue('OLLAMA_BASE_URL', settings.ollamaBaseUrl);
    }

    return getRuntimeSettings();
});

// ipcMain.handle("record:saveMixedAudio", async (event, byteArray) => {
//     try {
//         fs.writeFileSync(TEMP_RECORDING_FILE, Buffer.from(byteArray));
//         await convertWebmToWav();

//         if (fs.existsSync(TEMP_RECORDING_FILE)) {
//             fs.unlinkSync(TEMP_RECORDING_FILE);
//         }

//         return getSavedRecordingPayload();
//     } catch (err) {
//         return {
//             success: false,
//             message: err.message
//         };
//     }
// });
ipcMain.handle('record:saveMixedAudio', async (event, data) => {
    try {
        // Open the box we sent from the UI
        const { bytes, meetingId } = data; 
        
        // Find the specific folder for this meeting
        const folderPath = path.join(getMeetingsDir(), meetingId);
        
        // Build the exact file path: .../meetings/mtg_001/audio.webm
        const filePath = path.join(folderPath, 'audio.webm');
        
        // Save the audio file directly into that specific folder!
        fs.writeFileSync(filePath, Buffer.from(bytes));
        
        console.log(`SUCCESS! Saved audio directly inside ${meetingId}`);
        
        // Tell the UI where the file is so the audio player works
        return { 
            success: true, 
            audioUrl: `file://${filePath}` 
        };
    } catch (error) {
        console.error("Failed to save audio:", error);
        return { success: false, message: error.message };
    }
});

//for hadling the transcription 
// ipcMain.handle("transcribe:local", async () => {
//     return new Promise((resolve, reject) => {
        
//         // OUTPUT_FILE is already imported at the top of your index.js
//         // that's the output.wav path — pass it to Python as an argument
//         const { command, args } = getPythonCommand();
//         const py = spawn(command, [
//             ...args,
//             path.resolve(__dirname, '../transcribe.py'),
//             OUTPUT_FILE
//         ], {
//             cwd: PROJECT_ROOT
//         });

//         let result = '';
//         let errorOut = '';

//         // Python's print() goes to stdout — collect it here
//         py.stdout.on('data', (data) => {
//             result += data.toString();
//         });

//         // Collect errors too so you can debug if it fails
//         py.stderr.on('data', (data) => {
//             errorOut += data.toString();
//         });

//         py.on('error', (err) => {
//             reject(new Error(
//                 `Unable to start Python for transcription. ${err.message}. ` +
//                 `Create a virtual environment in ${PROJECT_ROOT} and install faster-whisper.`
//             ));
//         });

//         // When Python script finishes (exit code 0 = success)
//         py.on('close', (code) => {
//             if (code === 0 && result.trim()) {
//                 resolve(result.trim());
//             } else {
//                 reject(new Error(errorOut || result || 'Transcription failed'));
//             }
//         });
//     });
// });
ipcMain.handle('transcribe:local', async (event, meetingId) => {
    return new Promise((resolve, reject) => {
        const folderPath = path.join(getMeetingsDir(), meetingId);
        
        const audioPath = path.join(folderPath, 'audio.webm'); 
        const transcriptPath = path.join(folderPath, 'transcript.txt'); 

        const { spawn } = require('child_process');
        
        // FIX 1: Give the exact map to the python script
        const scriptPath = path.join(__dirname, '..', 'transcribe.py');
        
        // FIX 2: Give the exact map to your virtual environment's python.exe!
        const pythonExecutable = path.join(__dirname, '..', '.venv', 'Scripts', 'python.exe');

        // Spawn it with the absolute paths
        const pythonProcess = spawn(pythonExecutable, [scriptPath, audioPath, transcriptPath]);

        // FIX 3: The Walkie-Talkie! Print exactly what the Scribe is doing
        pythonProcess.stdout.on('data', (data) => {
            console.log(`SCRIBE SAYS: ${data.toString()}`);
        });

        // Print exactly what the Scribe is complaining about
        pythonProcess.stderr.on('data', (data) => {
            console.error(`SCRIBE ERROR: ${data.toString()}`);
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) resolve(true);
            else reject(new Error(`Python crashed with code ${code}. Check the terminal for SCRIBE ERROR!`));
        });
    });
});

// ipcMain.handle("get-transcript-file", async () => {
//     const transcriptPath = path.resolve(PROJECT_ROOT, "transcription.txt");

//     if (!fs.existsSync(transcriptPath)) {
//         throw new Error(`Transcript file not found at ${transcriptPath}`);
//     }

//     return fs.readFileSync(transcriptPath, "utf8");
// });

ipcMain.handle('get-transcript-file', async (event, meetingId) => {
    const folderPath = path.join(getMeetingsDir(), meetingId);
    const transcriptPath = path.join(folderPath, 'transcript.txt');
    
    if (!fs.existsSync(transcriptPath)) {
        throw new Error("Transcript file not found in folder!");
    }
    
    // Read the file directly from the meeting folder
    return fs.readFileSync(transcriptPath, 'utf-8');
});

//to handle the summary generation
// ipcMain.handle("summary:generate", async (event, options) => {
//   if (options?.provider === "ollama") {
//     return await summarizeTranscript();
//   }

//   return await generateSummary(options);
// });

// PASTE THIS IN electron/index.js:

ipcMain.handle("summary:generate", async (event, options) => {
    try {
        const { provider, meetingId } = options;
        let summaryText = "";

        // 1. OPEN THE FOLDER AND READ THE TRANSCRIPT FIRST
        const folderPath = path.join(getMeetingsDir(), meetingId);
        const transcriptFilePath = path.join(folderPath, 'transcript.txt');
        
        if (!fs.existsSync(transcriptFilePath)) {
            throw new Error("No transcript found! Please click Analyze before summarizing.");
        }
        
        // Grab the actual text off the page
        const transcriptText = fs.readFileSync(transcriptFilePath, 'utf-8');

        // 2. HAND THE TEXT DIRECTLY TO THE AI WORKERS
        if (provider === "ollama") {
            summaryText = await summarizeTranscript(transcriptText); 
        } else {
            summaryText = await generateSummary(transcriptText);
        }

        // 3. Save the result to the filing cabinet!
        const summaryFilePath = path.join(folderPath, 'summary.json');
        const summaryData = {
            generatedAt: new Date().toISOString(),
            provider: provider,
            text: summaryText
        };
        
        fs.writeFileSync(summaryFilePath, JSON.stringify(summaryData, null, 2));
        console.log(`SUCCESS! Saved summary inside ${meetingId}`);

        return summaryText;

    } catch (error) {
        console.error("Failed to generate or save summary:", error);
        throw error;
    }
});

ipcMain.handle('meeting:getDetails', async (event, meetingId) => {
    const folderPath = path.join(getMeetingsDir(), meetingId);
    const details = {
        audioUrl: null,
        transcript: null,
        summary: null
    };
    const audioPath = path.join(folderPath, 'audio.webm');
    if (fs.existsSync(audioPath)) {
        details.audioUrl = `file://${audioPath}`;
    }

    const transcriptPath = path.join(folderPath, 'transcript.txt');
    if (fs.existsSync(transcriptPath)) {
        details.transcript = fs.readFileSync(transcriptPath, 'utf-8');
    }

    const summaryPath = path.join(folderPath, 'summary.json');
    if (fs.existsSync(summaryPath)) {
        const rawSummary = fs.readFileSync(summaryPath, 'utf-8');
        try {
            const parsedSummary = JSON.parse(rawSummary);
            details.summary = parsedSummary.text;
        } catch(e) {
            console.error("Failed to parse summary.json");
        }
    }

    return details;
});

ipcMain.handle('meeting:create', () => {
    return createMeeting();
});

ipcMain.handle('meeting:list', () => {
    return listMeetings();
});

ipcMain.handle('meeting:rename', (event, data) => {
    renameMeeting(data.meetingId, data.newTitle);
    return true;
});

app.whenReady().then(() => {
const myDrawer = getMeetingsDir();
    console.log("SUCCESS! My filing cabinet is located at:", myDrawer);

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
