const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const audioPlayer = document.getElementById('audioPlayer');
const micSelect = document.getElementById('mic-select');
const summaryBtn = document.getElementById("summaryBtn");
const toastRegion = document.getElementById('toast-region');
const testBtn = document.getElementById('test-meeting-btn');
let activeMeetingId = null;

let activeRecording = null;
let isTranscribing = false;
let isSummarizing = false;
let recordingIndicator = null;
let toastId = 0;

const toastTypeStyles = {
    idle: 'bg-[#2F9E44] shadow-[0_0_18px_rgba(47,158,68,0.28)]',
    recording: 'bg-[#C92A2A] shadow-[0_0_18px_rgba(201,42,42,0.28)]',
    error: 'bg-[#C92A2A] shadow-[0_0_18px_rgba(201,42,42,0.28)]'
};

function getFriendlyMessage(message) {
    if (message.includes('Missing Python dependency: faster-whisper')) {
        return 'Install faster-whisper to transcribe locally: .\\.venv\\Scripts\\python.exe -m pip install faster-whisper';
    }

    return message.replace(/^Error invoking remote method '[^']+': Error:\s*/, '');
}

function showToast(message, type = 'idle', duration = 3600) {
    if (!toastRegion || !message) {
        return;
    }

    const toast = document.createElement('div');
    const id = ++toastId;
    let remaining = duration;
    let dismissTimer = null;
    let startedAt = Date.now();
    const accentClass = toastTypeStyles[type] || toastTypeStyles.idle;
    const friendlyMessage = getFriendlyMessage(message);

    toast.className = 'toast-enter pointer-events-auto grid min-h-[58px] grid-cols-[10px_1fr] items-center gap-3 overflow-hidden rounded-xl border border-[#BBBBBB] bg-[#F2F1F1]/85 px-4 py-3.5 text-black opacity-0 shadow-[0_12px_32px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-[16px] backdrop-saturate-150 translate-x-6 scale-[0.98]';
    toast.dataset.type = type;
    toast.dataset.toastId = String(id);
    toast.innerHTML = `
        <span class="h-[34px] w-2.5 rounded-full ${accentClass}" aria-hidden="true"></span>
        <p class="m-0 text-[0.95rem] font-semibold leading-snug"></p>
    `;
    toast.querySelector('p').textContent = friendlyMessage;

    const dismiss = () => {
        window.clearTimeout(dismissTimer);
        toast.classList.remove('toast-enter');
        toast.classList.add('toast-leave');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
    };

    const startTimer = () => {
        startedAt = Date.now();
        dismissTimer = window.setTimeout(dismiss, remaining);
    };

    const pauseTimer = () => {
        window.clearTimeout(dismissTimer);
        remaining -= Date.now() - startedAt;
    };

    toast.addEventListener('mouseenter', pauseTimer);
    toast.addEventListener('mouseleave', startTimer);

    toastRegion.prepend(toast);
    startTimer();
}

function showRecordingIndicator(message = "Recording in progress") {
    if (!toastRegion) {
        return;
    }

    if (recordingIndicator) {
        recordingIndicator.querySelector('p').textContent = message;
        return;
    }

    recordingIndicator = document.createElement('div');
    recordingIndicator.className = 'toast-enter pointer-events-auto flex min-h-[52px] items-center gap-3 rounded-xl border border-[#BBBBBB] bg-[#F2F1F1]/90 px-4 py-3 text-black opacity-0 shadow-[0_12px_32px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-[16px] backdrop-saturate-150 translate-x-6 scale-[0.98]';
    recordingIndicator.innerHTML = `
        <span class="recording-pulse h-3.5 w-3.5 shrink-0 rounded-full bg-[#C85C4A] shadow-[0_0_14px_rgba(200,92,74,0.55)]" aria-hidden="true"></span>
        <p class="m-0 text-[0.95rem] font-semibold leading-snug"></p>
    `;
    recordingIndicator.querySelector('p').textContent = message;
    toastRegion.prepend(recordingIndicator);
}

function hideRecordingIndicator() {
    if (!recordingIndicator) {
        return;
    }

    const indicator = recordingIndicator;
    recordingIndicator = null;
    indicator.classList.remove('toast-enter');
    indicator.classList.add('toast-leave');
    indicator.addEventListener('animationend', () => indicator.remove(), { once: true });
}

function shouldToastStatus(message) {
    return ![
        "Ready to record",
        "Starting recording...",
        "Recording in progress",
        "Stopping recording..."
    ].includes(message);
}

function updateStatus(message, type = 'idle') {
    if (shouldToastStatus(message)) {
        const duration = message.includes('faster-whisper') ? 8000 : 3600;
        showToast(message, type, duration);
    }
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
    if (activeRecording) {
        showRecordingIndicator("Recording in progress");
        return;
    }

    try {
        startBtn.disabled = true;
        updateStatus("Starting recording...", "recording");

        const selectedMic = micSelect && !micSelect.disabled ? micSelect.value : undefined;
        activeRecording = await createMixedRecorder(selectedMic);
        showRecordingIndicator("Recording in progress");

        stopBtn.disabled = false;
        updateStatus("Recording in progress", "recording");
    } catch (err) {
        console.error("Failed to start recording:", err);
        activeRecording = null;
        hideRecordingIndicator();
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
        hideRecordingIndicator();
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
        if (!activeMeetingId) {
            updateStatus("Error: Create a New Meeting first!", "error");
            startBtn.disabled = false;
            return; // Stop the function here so we don't save a broken file
            }
        const recordingData = { bytes: bytes, meetingId: activeMeetingId };
        const result = await window.recorder.saveMixedAudio(recordingData);
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
        if (activeRecording) {
            showRecordingIndicator("Recording in progress");
        }
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
    if (isTranscribing) {
        updateStatus("Transcription already processing...", "recording");
        return;
    }

    try {
        isTranscribing = true;
        analyzeBtn.classList.add('opacity-70');
        updateStatus("Running Whisper locally...", "recording");

        // 1. Check for the post-it note!
        if (!activeMeetingId) {
            updateStatus("Error: No active meeting selected! Start with creating new meeting" , "error");
            isTranscribing = false;
            return;
        }

        // 2. Hand the post-it note to the Receptionist!
        await window.recorder.transcribeLocal(activeMeetingId);
        const transcript = await window.recorder.getTranscriptFile(activeMeetingId);

        const outputDiv = document.getElementById('transcript-output');
        outputDiv.classList.remove('hidden');

        // Making output look better by adding each line with a timestamp and on a new line
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
        isTranscribing = false;
        analyzeBtn.classList.remove('opacity-70');
        analyzeBtn.textContent = 'Analyze';
    }
}

function formatSummary(rawText) {
    let html = rawText
        .replace(/Overview:/g, '<h4 class="text-lg font-bold mt-6 mb-2 text-blue-600">Overview</h4>')
        .replace(/Key Notes:/g, '<h4 class="text-lg font-bold mt-6 mb-2 text-blue-600">Key Notes</h4>')
        .replace(/Action Items:/g, '<h4 class="text-lg font-bold mt-6 mb-2 text-blue-600">Action Items</h4>');

    // Turn dashes into HTML bullet points
    html = html.replace(/-\s(.*)/g, '<li class="ml-5 list-disc mb-1">$1</li>');

    return html;
}

// 2. The Updated Summary Function
async function onGenerateSummary() {
  if (isSummarizing) {
    updateStatus("Summary already processing...", "recording");
    return;
  }

  try {
    isSummarizing = true;
    summaryBtn.classList.add("opacity-70");
    const provider = document.getElementById("summary-provider")?.value || "api";
    const model = document.getElementById("ollama-model")?.value || "llama3.1:8b";
    const providerName = provider === "ollama" ? "Ollama" : "API";

    if (!activeMeetingId) {
        updateStatus("Error: No active meeting selected! Start with creating new meeting", "error");
        isSummarizing = false;
        return;
    }

    updateStatus(`${providerName} working...`, "recording");

    const requestBox = { 
        provider: provider, 
        model: model, 
        meetingId: activeMeetingId 
    };

    // Ask the Receptionist for the summary
    const summary = await window.recorder.generateSummary(requestBox);

    // --- THIS IS THE PART YOU WERE MISSING --- //
    // Grab the UI boxes from your screen
    const outputBox = document.getElementById("summary-output");
    const summaryText = document.getElementById("summary-paragraph"); 
    const summaryPlaceholder = document.getElementById("summary-placeholder");
    const summaryTitle = document.getElementById("summary-title");

    // Make the box visible and hide the placeholder
    outputBox.classList.remove("hidden");
    if(summaryPlaceholder) summaryPlaceholder.classList.add("hidden");

    // Add the dynamic title
    if(summaryTitle) {
        summaryTitle.textContent = `Summary for ${activeMeetingId}`;
    }

    // Pass the raw text through our beautifier and put it on the screen!
    summaryText.innerHTML = formatSummary(summary);
    
    updateStatus(`${providerName} summary ready`, "idle");

  } catch (err) {
    console.error(err);
    updateStatus("Summary failed: " + err.message, "error");
  } finally {
    isSummarizing = false;
    summaryBtn.classList.remove("opacity-70");
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
// Inside renderer/app.js
testBtn.addEventListener('click', async () => {
    console.log("Asking the Receptionist for a new meeting...");
    const meetingDetails = await window.recorder.createMeeting(); 
    
    // THE NEW MAGIC LINE: Write the ID onto our post-it note!
    activeMeetingId = meetingDetails.id; 
    
    console.log("The currently open folder on the desk is now:", activeMeetingId);
});


startBtn.addEventListener("click", onStart);
stopBtn.addEventListener("click", onStop);
analyzeBtn.addEventListener("click", onanalyzeBtn);
summaryBtn.addEventListener("click", onGenerateSummary);
loadMicrophoneDropdown();
hydrateSavedRecording();
console.log("Renderer loaded and ready");
