const startBtn = document.getElementById('startBtn')
const stopBtn = document.getElementById('stopBtn')
const statusDiv = document.getElementById('status')
const analyzeBtn = document.getElementById('analyzeBtn')
const audioPlayer = document.getElementById('audioPlayer');

function updateStatus(message, type = 'idle') {
    statusDiv.textContent = message;
    statusDiv.className = `status-${type}`;
}

audioPlayer.addEventListener('loadstart', () => {
    console.log('Audio: loadstart event');
});
audioPlayer.addEventListener('canplay', () => {
    console.log('Audio: canplay event - Ready to play!');
});

audioPlayer.addEventListener('error', (e) => {
    console.error('Audio error:', e.target.error);
    console.error('Error code:', e.target.error.code);
    console.error('Error message:', e.target.error.message);
});

audioPlayer.addEventListener('loadedmetadata', () => {
    console.log('Audio metadata loaded');
});

async function onStart() {
    try {
        startBtn.disabled = true
        updateStatus("Starting recording...", "recording")

        const result = await window.recorder.start()
        console.log("start result", result)

        if (result.success) {
            stopBtn.disabled = false;
            updateStatus("Recording in progress", "recording")
        } else {
            startBtn.disabled = false;
            console.log(result.message || "Failed to start", "error")
        }


    } catch (err) {
        console.error("Failed to start recording:", err);
        startBtn.disabled = false;
        updateStatus("Error: " + err.message, "error");
    };
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

            audioPlayer.src = result.audioUrl;
            audioPlayer.load();
            audioPlayer.play().catch(e => console.log("Autoplay prevented:", e));

            updateStatus("Recording saved - Ready to play ▶️", "idle");
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
        updateStatus("Sending Request to server", "analyzing")
    } catch (err) {
        console.error("Failed to send request to the server", err)
        updateStatus("Error: " + err.message, "error")

    }
}

startBtn.addEventListener("click", onStart)
stopBtn.addEventListener("click", onStop)
analyzeBtn.addEventListener("click", onanalyzeBtn)
console.log("Renderer loaded and ready");
