const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDiv = document.getElementById('status');
const analyzeBtn = document.getElementById('analyzeBtn');
const audioPlayer = document.getElementById('audioPlayer');
const micSelect = document.getElementById('mic-select');
const summaryBtn = document.getElementById("summaryBtn");

let activeRecording = null;

function updateStatus(message, type = 'idle') {
    statusDiv.textContent = message;
    statusDiv.className = `status-${type}`;
}

function loadAudioIntoPlayer(audioUrl, statusMessage = "Recording ready to play") {
    console.log("Loading audio URL:", audioUrl);

    audioPlayer.src = audioUrl;
    audioPlayer.preload = 'auto';
    audioPlayer.load();
    updateStatus(statusMessage, "idle");
}

async function loadMicrophoneDropdown() {
    if (!micSelect) {
        return;
    }

    try {
        // Ask once so device labels become available in Electron.
        const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        permissionStream.getTracks().forEach((track) => track.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        const microphones = devices.filter((device) => device.kind === 'audioinput');

        micSelect.innerHTML = '';

        if (microphones.length === 0) {
            micSelect.innerHTML = '<option>No microphones found</option>';
            micSelect.disabled = true;
            return;
        }

        micSelect.disabled = false;
        microphones.forEach((mic, index) => {
            const option = document.createElement('option');
            option.value = mic.deviceId;
            option.textContent = mic.label || `Microphone ${index + 1}`;
            micSelect.appendChild(option);
        });
    } catch (err) {
        console.error("Failed to load microphones:", err);
        micSelect.innerHTML = '<option>Failed to load microphones</option>';
        micSelect.disabled = true;
    }
}

async function hydrateSavedRecording() {
    try {
        const result = await window.recorder.getSaved();
        console.log("Saved recording lookup:", result);

        if (result.success && result.audioUrl) {
            loadAudioIntoPlayer(result.audioUrl, "Loaded existing recording");
        }
    } catch (err) {
        console.error("Failed to load saved recording:", err);
    }
}

function stopTracks(stream) {
    if (!stream) {
        return;
    }

    stream.getTracks().forEach((track) => track.stop());
}

async function createMixedRecorder(selectedMicDeviceId) {
    const micConstraints = selectedMicDeviceId
        ? { audio: { deviceId: { exact: selectedMicDeviceId } }, video: false }
        : { audio: true, video: false };

    const micStream = await navigator.mediaDevices.getUserMedia(micConstraints);
    const systemStream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: true
    });

    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();

    const micSource = audioContext.createMediaStreamSource(micStream);
    micSource.connect(destination);

    const systemAudioTracks = systemStream.getAudioTracks();
    if (systemAudioTracks.length > 0) {
        const systemSource = audioContext.createMediaStreamSource(
            new MediaStream(systemAudioTracks)
        );
        systemSource.connect(destination);
    } else {
        console.warn("System loopback stream did not include audio tracks.");
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

    const mediaRecorder = new MediaRecorder(destination.stream, { mimeType });
    const chunks = [];

    mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data && event.data.size > 0) {
            chunks.push(event.data);
        }
    });

    mediaRecorder.start(250);

    return {
        audioContext,
        mediaRecorder,
        micStream,
        systemStream,
        chunks
    };
}

audioPlayer.addEventListener('loadstart', () => {
    console.log('Audio: loadstart event');
});

audioPlayer.addEventListener('canplay', () => {
    console.log('Audio: canplay event - Ready to play!');
});

audioPlayer.addEventListener('error', (e) => {
    const err = e.target.error;
    console.error('Audio error:', err);
    console.error('Audio src:', audioPlayer.src);
    updateStatus('Audio playback failed: ' + (err?.message || 'unknown error'), 'error');
});

audioPlayer.addEventListener('loadedmetadata', () => {
    console.log('Audio metadata loaded');
    console.log('Audio duration:', audioPlayer.duration);
    console.log('Audio currentSrc:', audioPlayer.currentSrc);
});

audioPlayer.addEventListener('canplaythrough', () => {
    console.log('Audio canplaythrough event - enough data to play!');
});

audioPlayer.addEventListener('play', () => {
    console.log('Audio playback started');
});

async function onStart() {
    try {
        startBtn.disabled = true;
        updateStatus("Starting recording...", "recording");

        const selectedMic = micSelect && !micSelect.disabled ? micSelect.value : undefined;
        activeRecording = await createMixedRecorder(selectedMic);

        stopBtn.disabled = false;
        updateStatus("Recording in progress", "recording");
    } catch (err) {
        console.error("Failed to start recording:", err);
        activeRecording = null;
        startBtn.disabled = false;
        updateStatus("Error: " + err.message, "error");
    }
}

async function onStop() {
    if (!activeRecording) {
        updateStatus("Not recording", "error");
        return;
    }

    try {
        stopBtn.disabled = true;
        updateStatus("Stopping recording...", "idle");

        const recording = activeRecording;
        activeRecording = null;

        const stoppedBlob = await new Promise((resolve, reject) => {
            recording.mediaRecorder.addEventListener('stop', () => {
                try {
                    const blob = new Blob(recording.chunks, { type: recording.mediaRecorder.mimeType });
                    resolve(blob);
                } catch (error) {
                    reject(error);
                }
            }, { once: true });

            recording.mediaRecorder.addEventListener('error', (event) => {
                reject(event.error || new Error("MediaRecorder error"));
            }, { once: true });

            recording.mediaRecorder.stop();
        });

        stopTracks(recording.micStream);
        stopTracks(recording.systemStream);
        await recording.audioContext.close();

        const bytes = Array.from(new Uint8Array(await stoppedBlob.arrayBuffer()));
        const result = await window.recorder.saveMixedAudio(bytes);
        console.log("Stop result:", result);

        startBtn.disabled = false;

        if (result.success && result.audioUrl) {
            console.log("Audio URL:", result.audioUrl);

            audioPlayer.onloadedmetadata = () => {
                console.log('Loaded metadata, duration =', audioPlayer.duration);
                audioPlayer.play().catch((e) => {
                    console.error('Audio play rejected:', e);
                    updateStatus('Audio playback blocked: ' + e.message, 'error');
                });
            };

            audioPlayer.onerror = (e) => {
                console.error('Audio element load failed:', e);
                console.error('Audio element error details:', audioPlayer.error);
                updateStatus('Audio load failed: ' + (audioPlayer.error?.message || 'unknown'), 'error');
            };

            loadAudioIntoPlayer(result.audioUrl, "Recording saved - Ready to play");
            console.log('audioPlayer.currentSrc after load:', audioPlayer.currentSrc);
        } else {
            console.error("Stop failed:", result.message);
            updateStatus(result.message || "Failed to stop", "error");
        }
    } catch (err) {
        console.error("Failed to stop recording:", err);
        updateStatus("Error: " + err.message, "error");
        startBtn.disabled = false;
    }
}

// async function onanalyzeBtn() {
//     try {
//         updateStatus("Sending Request to server", "analyzing");
//     } catch (err) {
//         console.error("Failed to send request to the server", err);
//         updateStatus("Error: " + err.message, "error");
//     }
// }

//for analze button;
async function onanalyzeBtn() {
    try {
        analyzeBtn.disabled = true;
        // analyzeBtn.textContent = 'Transcribing...';
        updateStatus("Running Whisper locally...", "recording");

      
        await window.recorder.transcribeLocal();
        const transcript = await window.recorder.getTranscriptFile();

        const outputDiv = document.getElementById('transcript-output');
        outputDiv.classList.remove('hidden');

        //making output look better by adding each line with a timestamp and on a new line
        const lines = transcript.split('\n').filter(line => line.trim() !== '');
        const formatted = lines.map(line => {
            const parts = line.split(' ');
            const time = parts.shift(); // first word = time
            const text = parts.join(' ');
            return `<div>
            <span class="text-blue-300 font-medium">${time} </span> ${text}
            </div>`;
        }).join('');
        outputDiv.innerHTML = formatted;

        updateStatus("Transcription complete", "idle");

    } catch (err) {
        console.error("Transcription failed:", err);
        updateStatus("Error: " + err.message, "error");
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = 'Analyze';
    }
}
async function onGenerateSummary() {
  try {
    const provider = document.getElementById("summary-provider")?.value || "api";
    const model = document.getElementById("ollama-model")?.value || "llama3.1:8b";

    const summary = await window.recorder.generateSummary({ provider, model });

    const outputBox = document.getElementById("summary-output");
    const summaryText = document.getElementById("summary-paragraph");
    outputBox.classList.remove("hidden");
    summaryText.textContent = summary;
  } catch (err) {
    console.error(err);
  }
}
// async function onGenerateSummary() {
//   try {
//     const summary = await window.recorder.generateSummary();

//     const outputBox = document.getElementById("summary-output");
//     const summaryText = document.getElementById("summary-paragraph");

//     outputBox.classList.remove("hidden");
//     summaryText.textContent = summary;
//   } catch (err) {
//     console.error(err);
//   }
// }


startBtn.addEventListener("click", onStart);
stopBtn.addEventListener("click", onStop);
analyzeBtn.addEventListener("click", onanalyzeBtn);
summaryBtn.addEventListener("click", onGenerateSummary);
loadMicrophoneDropdown();
hydrateSavedRecording();
console.log("Renderer loaded and ready");
