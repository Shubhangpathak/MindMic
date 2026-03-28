console.log("record.js started");

const { rejects } = require("assert");
const { spawn } = require("child_process");
const { promises } = require("dns");
const { resolve } = require("path");

const MICROPHONE_NAME = "Microphone Array (Realtek(R) Audio)";
const SYSTEM_AUDIO = "Stereo Mix (Realtek(R) Audio)";

let ffmpegProcess = null;

function startRecording() {
    return new Promise((resolve, reject) => {
        if (ffmpegProcess) {
            console.log("Already recording");
            reject(new Error("Already recording"));
            return;
        }

        console.log("Starting recording...");

        ffmpegProcess = spawn(
            "ffmpeg",
            [
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
                "output.wav"
            ],
            { stdio: ["pipe", "inherit", "inherit"] }
        );

        // Resolve once the process starts
        ffmpegProcess.on('spawn', () => {
            console.log("FFmpeg process spawned successfully");
            resolve({ success: true });
        });

        // Handle errors
        ffmpegProcess.on('error', (err) => {
            ffmpegProcess = null;
            reject(err);
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
        ffmpegProcess.stdin.write("q");

        // Waits for the process to exit completely
        ffmpegProcess.on('exit', (code) => {
            console.log("FFmpeg process exited with code:", code);
            ffmpegProcess = null;
            resolve({ success: true });
        });

        ffmpegProcess.on('error', (err) => {
            ffmpegProcess = null;
            reject(err);
        });

        // Timeout after 5 seconds just in case
        setTimeout(() => {
            if (ffmpegProcess) {
                ffmpegProcess.kill();
                ffmpegProcess = null;
                console.log("FFmpeg process killed due to timeout");
            }
            resolve({ success: true });
        }, 5000);
    });
}

// process.on("SIGINT", () => {
//     stopRecording();
//     process.exit();
// });
module.exports = { startRecording, stopRecording }
