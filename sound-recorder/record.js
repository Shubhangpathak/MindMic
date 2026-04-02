console.log("record.js started");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const MICROPHONE_NAME = "Microphone Array (Realtek(R) Audio)";
const SYSTEM_AUDIO = "Stereo Mix (Realtek(R) Audio)";
const OUTPUT_FILE = path.resolve(__dirname, "..", "electron", "output.wav");

let ffmpegProcess = null;

function listAudioDevices() {
    const result = spawnSync(
        "ffmpeg",
        ["-list_devices", "true", "-f", "dshow", "-i", "dummy"],
        { encoding: "utf8" }
    );

    const output = `${result.stdout || ""}\n${result.stderr || ""}`;
    const deviceMatches = [...output.matchAll(/"([^"]+)"\s+\(audio\)/g)];
    return deviceMatches.map((match) => match[1]);
}

function buildRecordingArgs() {
    const devices = listAudioDevices();
    const hasMicrophone = devices.includes(MICROPHONE_NAME);
    const hasSystemAudio = devices.includes(SYSTEM_AUDIO);

    if (!hasMicrophone) {
        throw new Error(
            `Microphone device "${MICROPHONE_NAME}" was not found. Available audio devices: ${devices.join(", ") || "none"}`
        );
    }

    if (!hasSystemAudio) {
        console.log(`System audio device "${SYSTEM_AUDIO}" not found. Falling back to microphone-only recording.`);
        return [
            "-f", "dshow",
            "-i", `audio=${MICROPHONE_NAME}`,
            "-filter:a", "volume=4.0,acompressor=threshold=-20dB:ratio=2.5:attack=10:release=100",
            "-ar", "44100",
            "-ac", "1",
            "-acodec", "pcm_s16le",
            "-y",
            OUTPUT_FILE
        ];
    }

    return [
        "-f", "dshow",
        "-i", `audio=${MICROPHONE_NAME}`,
        "-f", "dshow",
        "-i", `audio=${SYSTEM_AUDIO}`,
        "-filter_complex",
        "[0:a]volume=4.0[mic];[mic][1:a]amix=inputs=2:weights=3 1,acompressor=threshold=-20dB:ratio=2.5:attack=10:release=100",
        "-ar", "44100",
        "-ac", "1",
        "-acodec", "pcm_s16le",
        "-y",
        OUTPUT_FILE
    ];
}

function startRecording() {
    return new Promise((resolve, reject) => {
        if (ffmpegProcess) {
            console.log("Already recording");
            reject(new Error("Already recording"));
            return;
        }

        console.log("Starting recording...");
        const args = buildRecordingArgs();
        let settled = false;
        let startupTimer = null;

        ffmpegProcess = spawn(
            "ffmpeg",
            args,
            { stdio: ["pipe", "inherit", "pipe"] }
        );

        ffmpegProcess.stderr.on("data", (chunk) => {
            console.error(chunk.toString());
        });

        ffmpegProcess.on('spawn', () => {
            console.log("FFmpeg process spawned successfully");
            startupTimer = setTimeout(() => {
                if (!settled && ffmpegProcess) {
                    settled = true;
                    resolve({ success: true });
                }
            }, 750);
        });

        ffmpegProcess.on('error', (err) => {
            if (startupTimer) {
                clearTimeout(startupTimer);
            }
            ffmpegProcess = null;
            if (!settled) {
                settled = true;
                reject(err);
            }
        });

        ffmpegProcess.once('exit', (code) => {
            if (startupTimer) {
                clearTimeout(startupTimer);
            }
            const exitedBeforeReady = !settled;
            ffmpegProcess = null;

            if (exitedBeforeReady) {
                settled = true;
                reject(new Error(`FFmpeg exited before recording started (code ${code ?? "unknown"})`));
            }
        });
    });
}

function stopRecording() {
    return new Promise((resolve, reject) => {
        if (!ffmpegProcess) {
            reject(new Error("Not recording"));
            return;
        }

        console.log("Stopping recording...");

        ffmpegProcess.once('exit', (code) => {
            console.log("FFmpeg process exited with code:", code);
            ffmpegProcess = null;
            resolve({ success: true });
        });

        ffmpegProcess.on('error', (err) => {
            ffmpegProcess = null;
            reject(err);
        });

        if (ffmpegProcess.stdin.writable) {
            ffmpegProcess.stdin.write("q\n");
            ffmpegProcess.stdin.end();
        }

        // time out after 5s just in case 
        setTimeout(() => {
            if (ffmpegProcess) {
                console.log("Force killing ffmpeg due to timeout");
                ffmpegProcess.kill();
                ffmpegProcess = null;
                resolve({ success: true });
            }
        }, 5000);
    });
}

module.exports = { startRecording, stopRecording, OUTPUT_FILE }
