const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDiv = document.getElementById('status');
const analyzeBtn = document.getElementById('analyzeBtn');
const audioPlayer = document.getElementById('audioPlayer');

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

        const result = await window.recorder.start();
        console.log("start result", result);

        if (result.success) {
            stopBtn.disabled = false;
            updateStatus("Recording in progress", "recording");
        } else {
            startBtn.disabled = false;
            updateStatus(result.message || "Failed to start", "error");
        }
    } catch (err) {
        console.error("Failed to start recording:", err);
        startBtn.disabled = false;
        updateStatus("Error: " + err.message, "error");
    }
}

async function onStop() {
    try {
        stopBtn.disabled = true;
        updateStatus("Stopping recording...", "idle");

        const result = await window.recorder.stop();
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

async function onanalyzeBtn() {
    try {
        updateStatus("Sending Request to server", "analyzing");
    } catch (err) {
        console.error("Failed to send request to the server", err);
        updateStatus("Error: " + err.message, "error");
    }
}

startBtn.addEventListener("click", onStart);
stopBtn.addEventListener("click", onStop);
analyzeBtn.addEventListener("click", onanalyzeBtn);
hydrateSavedRecording();
console.log("Renderer loaded and ready");
