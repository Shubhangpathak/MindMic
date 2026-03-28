const startBtn = document.getElementById('startBtn')
const stopBtn = document.getElementById('stopBtn')
const statusDiv = document.getElementById('status')
const analyzeBtn = document.getElementById('analyzeBtn')
const audioPlayer = document.getElementById('audioPlayer');

function updateStatus(message, type = 'idle') {
    statusDiv.textContent = message;
    statusDiv.className = `status-${type}`;
}

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
        stopBtn.disabled = true
        updateStatus("Stoping recording..", "idle")

        const result = await window.recorder.stop()
        console.log("start result", result)

        startBtn.disabled = false;

        if (result.success && result.audioPath) {
            await new Promise(resolve => setTimeout(resolve, 500));


            // Convert Windows path to file URL
            let fileUrl = result.audioPath;

            // Replace backslashes with forward slashes
            fileUrl = fileUrl.replace(/\\/g, '/');

            // Add file:// protocol
            if (!fileUrl.startsWith('file://')) {
                fileUrl = 'file:///' + fileUrl;
            }

            console.log("Loading audio from:", fileUrl);

            audioPlayer.src = fileUrl;
            audioPlayer.load();
            updateStatus("Recording saved - Ready to play", "idle");
        } else {
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
