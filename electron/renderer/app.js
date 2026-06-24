// 1. GLOBAL VARIABLES & UI ELEMENTS
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const audioPlayer = document.getElementById('audioPlayer');
const micSelect = document.getElementById('mic-select');
const summaryBtn = document.getElementById("summaryBtn");
const toastRegion = document.getElementById('toast-region');
const newMeetingBtn = document.getElementById('new-meeting-btn');
const sidebarList = document.getElementById('sidebar-list');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const settingsCancelBtn = document.getElementById('settings-cancel-btn');
const settingsSaveBtn = document.getElementById('settings-save-btn');
const settingsMicSelect = document.getElementById('settings-mic-select');
const settingsModeSelect = document.getElementById('settings-mode-select');
const settingsSummaryProvider = document.getElementById('settings-summary-provider');
const ollamaUrlInput = document.getElementById('ollama-url-input');
const appShell = document.querySelector('.app-shell');
const emptyStateOverlay = document.getElementById('empty-state-overlay');
const meetingTitle = document.getElementById('meeting-title');
// const outputBox = document.getElementById("summary-output");

let activeMeetingId = null;
let activeRecording = null;
let isTranscribing = false;
let isSummarizing = false;
let recordingIndicator = null;
let toastId = 0;
let cachedSettings = {
    ollamaBaseUrl: 'http://localhost:11434'
};

function setSettingsOpen(isOpen) {
    if (settingsModal) {
        settingsModal.classList.toggle('hidden', !isOpen);
        settingsModal.classList.toggle('flex', isOpen);
        settingsModal.setAttribute('aria-hidden', String(!isOpen));
    }

    if (appShell) {
        appShell.classList.toggle('blur-sm', isOpen);
        appShell.classList.toggle('pointer-events-none', isOpen);
    }
}

function syncSettingsModalValues() {
    if (settingsMicSelect && micSelect) {
        settingsMicSelect.value = micSelect.value;
    }

    if (settingsModeSelect) {
        settingsModeSelect.value = document.getElementById('mode-select')?.value || 'local';
    }

    if (settingsSummaryProvider) {
        settingsSummaryProvider.value = document.getElementById('summary-provider')?.value || 'ollama';
    }

    if (ollamaUrlInput) {
        ollamaUrlInput.value = cachedSettings.ollamaBaseUrl || 'http://localhost:11434';
    }
}

function syncMainControlsFromModal() {
    const modeSelect = document.getElementById('mode-select');
    const summaryProvider = document.getElementById('summary-provider');

    if (micSelect && settingsMicSelect) {
        micSelect.value = settingsMicSelect.value;
    }

    if (modeSelect && settingsModeSelect) {
        modeSelect.value = settingsModeSelect.value;
    }

    if (summaryProvider && settingsSummaryProvider) {
        summaryProvider.value = settingsSummaryProvider.value;
    }
}

async function loadSettings() {
    if (!window.recorder?.getSettings) return;

    try {
        cachedSettings = await window.recorder.getSettings();
        if (ollamaUrlInput) {
            ollamaUrlInput.value = cachedSettings.ollamaBaseUrl || 'http://localhost:11434';
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

async function saveSettings() {
    const ollamaBaseUrl = ollamaUrlInput?.value?.trim() || 'http://localhost:11434';
    syncMainControlsFromModal();

    if (window.recorder?.saveSettings) {
        cachedSettings = await window.recorder.saveSettings({ ollamaBaseUrl });
    } else {
        cachedSettings = { ...cachedSettings, ollamaBaseUrl };
    }
}

// 2. UI TOASTS & NOTIFICATIONS (The popup messages)
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
    if (!toastRegion || !message) return;

    const toast = document.createElement('div');
    const id = ++toastId;
    let remaining = duration;
    let dismissTimer = null;
    let startedAt = Date.now();
    const accentClass = toastTypeStyles[type] || toastTypeStyles.idle;
    const friendlyMessage = getFriendlyMessage(message);

    toast.className = 'toast-enter pointer-events-auto grid min-h-[58px] grid-cols-[10px_1fr] items-center gap-3 overflow-hidden rounded-xl border border-[#BBBBBB] bg-[#F2F1F1]/85 px-4 py-3.5 text-black opacity-0 shadow-[0_12px_32px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-[16px] backdrop-saturate-150 translate-x-6 scale-[0.98]';
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
    if (!toastRegion) return;
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
    if (!recordingIndicator) return;
    const indicator = recordingIndicator;
    recordingIndicator = null;
    indicator.classList.remove('toast-enter');
    indicator.classList.add('toast-leave');
    indicator.addEventListener('animationend', () => indicator.remove(), { once: true });
}

function updateStatus(message, type = 'idle') {
    const skipToasts = ["Ready to record", "Starting recording...", "Recording in progress", "Stopping recording..."];
    if (!skipToasts.includes(message)) {
        const duration = message.includes('faster-whisper') ? 8000 : 3600;
        showToast(message, type, duration);
    }
}

// 3. SIDEBAR & MEETING NAVIGATION
function getActiveMeetingTitle() {
    const activeButton = sidebarList?.querySelector(`[data-meeting-id="${activeMeetingId}"]`);
    return activeButton?.dataset.meetingTitle || activeMeetingId;
}

async function loadSidebar() {
    if (!sidebarList) return;

    try {
        const meetings = await window.recorder.getMeetings();
        sidebarList.innerHTML = '';

        if (!meetings.length) {
            sidebarList.innerHTML = '<p class="px-2 py-3 text-[12px] leading-5 text-[#777180]">No meetings yet.</p>';
            return;
        }

        meetings.forEach((meeting) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.dataset.meetingId = meeting.id;
            btn.dataset.meetingTitle = meeting.title;
            btn.className = 'group w-full rounded-lg border border-transparent px-3 py-3 text-left transition border-[#D7D4E3] hover:bg-white/66 hover:shadow-sm';

            // Highlight the active meeting
            if (meeting.id === activeMeetingId) {
                btn.classList.add('border-[#C9C5DD]', 'bg-white/78', 'shadow-sm', 'border-l-4', 'border-l-[#C85C4A]');
            }

            btn.innerHTML = `
                <span class="block truncate text-[13px] font-semibold text-[#24212D]">${meeting.title}</span>
            `;

            // WHEN A SIDEBAR MEETING IS CLICKED:
            btn.addEventListener('click', async () => {
                activeMeetingId = meeting.id;
                emptyStateOverlay?.classList.add('hidden');
                
                // Refresh sidebar visually
                loadSidebar();

                // Update Titles
                if (meetingTitle) meetingTitle.textContent = meeting.title;
                const summaryTitle = document.getElementById("summary-title");
                // if (summaryTitle) summaryTitle.textContent = `Summary for ${meeting.title}`;

                updateStatus("Loading meeting details...", "idle");

                // FETCH THE FOLDER CONTENTS!
                try {
                    const details = await window.recorder.getMeetingDetails(activeMeetingId);

                    // 1. Load Audio
                    if (details.audioUrl) {
                        loadAudioIntoPlayer(details.audioUrl, "Loaded past recording");
                    } else {
                        audioPlayer.src = '';
                    }

                    // 2. Load Transcript
                    const outputDiv = document.getElementById('transcript-output');
                    if (details.transcript) {
                        outputDiv.classList.remove('hidden');
                        const lines = details.transcript.split('\n').filter(line => line.trim() !== '');
                        outputDiv.innerHTML = lines.map(line => {
                            const parts = line.split(' ');
                            const time = parts.shift(); 
                            return `<div><span class="text-blue-300 font-medium">${time} </span> ${parts.join(' ')}</div>`;
                        }).join('');
                    } else {
                        outputDiv.classList.add('hidden');
                        outputDiv.innerHTML = '';
                    }

                    // 3. Load Summary
                    const outputBox = document.getElementById("summary-output");
                    const summaryText = document.getElementById("summary-paragraph");
                    const summaryPlaceholder = document.getElementById("summary-placeholder");
                    
                    if (details.summary) {
                        outputBox.classList.remove("hidden");
                        if(summaryPlaceholder) summaryPlaceholder.classList.add("hidden");
                        summaryText.innerHTML = formatSummary(details.summary);
                    } else {
                        outputBox.classList.add("hidden");
                        summaryText.innerHTML = '';
                    }

                    updateStatus(`Opened folder: ${meeting.title}`, "idle");
                } catch (err) {
                    console.error("Failed to load details:", err);
                    updateStatus("Failed to load meeting contents.", "error");
                }
            });

            sidebarList.appendChild(btn);
        });
    } catch (err) {
        console.error("Failed to load meetings:", err);
    }
}

async function handleNewMeetingClick() {
    console.log("Asking the Receptionist for a new meeting...");
    const meetingDetails = await window.recorder.createMeeting(); 
    
    activeMeetingId = meetingDetails.id; 
    
    // Hide the empty state cover sheet
    if(emptyStateOverlay) emptyStateOverlay.classList.add('hidden');

    // Update Titles
    if (meetingTitle) meetingTitle.textContent = meetingDetails.title;
    const summaryTitle = document.getElementById("summary-title");
    if (summaryTitle) summaryTitle.textContent = `Summary for ${meetingDetails.title}`;
    
    // Refresh Sidebar
    loadSidebar();

    // Clear out the workspace for the new meeting!
    audioPlayer.src = '';
    document.getElementById('transcript-output').innerHTML = '';
    document.getElementById('transcript-output').classList.add('hidden');
    document.getElementById("summary-output").classList.add("hidden");
    document.getElementById("summary-placeholder")?.classList.remove("hidden");
}

// 4. AUDIO & MICROPHONE SETUP
function loadAudioIntoPlayer(audioUrl, statusMessage = "Recording ready to play") {
    audioPlayer.src = audioUrl;
    audioPlayer.preload = 'auto';
    audioPlayer.load();
    updateStatus(statusMessage, "idle");
}

async function loadMicrophoneDropdown() {
    if (!micSelect) return;

    try {
        const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        permissionStream.getTracks().forEach((track) => track.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        const microphones = devices.filter((device) => device.kind === 'audioinput');

        const populateSelect = (selectEl) => {
            if (!selectEl) return;

            selectEl.innerHTML = '';
            if (microphones.length === 0) {
                selectEl.innerHTML = '<option>No microphones found</option>';
                selectEl.disabled = true;
                return;
            }

            selectEl.disabled = false;
            microphones.forEach((mic, index) => {
                const option = document.createElement('option');
                option.value = mic.deviceId;
                option.textContent = mic.label || `Microphone ${index + 1}`;
                selectEl.appendChild(option);
            });
        };

        populateSelect(micSelect);
        populateSelect(settingsMicSelect);
    } catch (err) {
        console.error("Failed to load microphones:", err);
        micSelect.disabled = true;
        if (settingsMicSelect) settingsMicSelect.disabled = true;
    }
}

function stopTracks(stream) {
    if (stream) stream.getTracks().forEach((track) => track.stop());
}

async function createMixedRecorder(selectedMicDeviceId) {
    const micConstraints = selectedMicDeviceId
        ? { audio: { deviceId: { exact: selectedMicDeviceId } }, video: false }
        : { audio: true, video: false };

    const micStream = await navigator.mediaDevices.getUserMedia(micConstraints);
    const systemStream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });

    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();

    const micSource = audioContext.createMediaStreamSource(micStream);
    micSource.connect(destination);

    const systemAudioTracks = systemStream.getAudioTracks();
    if (systemAudioTracks.length > 0) {
        const systemSource = audioContext.createMediaStreamSource(new MediaStream(systemAudioTracks));
        systemSource.connect(destination);
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
    const mediaRecorder = new MediaRecorder(destination.stream, { mimeType });
    const chunks = [];

    mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
    });

    mediaRecorder.start(250);

    return { audioContext, mediaRecorder, micStream, systemStream, chunks };
}

// 5. RECORDING LOGIC (START / STOP)
async function onStart() {
    if (activeRecording) return;

    try {
        startBtn.disabled = true;
        updateStatus("Starting recording...", "recording");

        const selectedMic = micSelect && !micSelect.disabled ? micSelect.value : undefined;
        activeRecording = await createMixedRecorder(selectedMic);
        
        showRecordingIndicator("Recording in progress");
        stopBtn.disabled = false;
        updateStatus("Recording in progress", "recording");
    } catch (err) {
        activeRecording = null;
        hideRecordingIndicator();
        startBtn.disabled = false;
        updateStatus("Error: " + err.message, "error");
    }
}

async function onStop() {
    if (!activeRecording) return;

    try {
        stopBtn.disabled = true;
        hideRecordingIndicator();
        updateStatus("Stopping recording...", "idle");

        const recording = activeRecording;
        activeRecording = null;

        const stoppedBlob = await new Promise((resolve, reject) => {
            recording.mediaRecorder.addEventListener('stop', () => {
                resolve(new Blob(recording.chunks, { type: recording.mediaRecorder.mimeType }));
            }, { once: true });
            recording.mediaRecorder.stop();
        });

        stopTracks(recording.micStream);
        stopTracks(recording.systemStream);
        await recording.audioContext.close();

        if (!activeMeetingId) {
            updateStatus("Error: Create a New Meeting first!", "error");
            startBtn.disabled = false;
            return; 
        }

        const bytes = Array.from(new Uint8Array(await stoppedBlob.arrayBuffer()));
        const result = await window.recorder.saveMixedAudio({ bytes: bytes, meetingId: activeMeetingId });

        startBtn.disabled = false;

        if (result.success && result.audioUrl) {
            loadAudioIntoPlayer(result.audioUrl, "Recording saved - Ready to play");
        } else {
            updateStatus(result.message || "Failed to stop", "error");
        }
    } catch (err) {
        hideRecordingIndicator();
        updateStatus("Error: " + err.message, "error");
        startBtn.disabled = false;
    }
}

// 6. TRANSCRIPTION LOGIC
async function onanalyzeBtn() {
    if (isTranscribing) return;

    try {
        isTranscribing = true;
        analyzeBtn.classList.add('opacity-70');
        
        if (!activeMeetingId) {
            updateStatus("Error: No active meeting selected!", "error");
            return;
        }

        updateStatus("Running Whisper locally...", "recording");
        await window.recorder.transcribeLocal(activeMeetingId);
        const transcript = await window.recorder.getTranscriptFile(activeMeetingId);

        const outputDiv = document.getElementById('transcript-output');
        outputDiv.classList.remove('hidden');

        const lines = transcript.split('\n').filter(line => line.trim() !== '');
        outputDiv.innerHTML = lines.map(line => {
            const parts = line.split(' ');
            const time = parts.shift();
            return `<div><span class="text-blue-300 font-medium">${time} </span> ${parts.join(' ')}</div>`;
        }).join('');
        
        updateStatus("Transcription complete", "idle");
    } catch (err) {
        updateStatus("Error: " + err.message, "error");
    } finally {
        isTranscribing = false;
        analyzeBtn.classList.remove('opacity-70');
    }
}

// 7. SUMMARY LOGIC
function formatSummary(rawText) {
    let html = rawText
        // Add text-left to the H1
        .replace(/Title:\s*(.*)/g, '<h1 class="text-3xl font-extrabold text-[#37352f] leading-tight tracking-tight text-left">$1</h1>')
        
        // Add text-left to the section headers
        .replace(/Overview:/g, '<h3 class="text-xl font-bold text-[#37352f] mt-2 mb-1 text-left">Overview</h3>')
        .replace(/Key Notes:/g, '<h3 class="text-xl font-bold text-[#37352f] mt-2 mb-1 text-left">Key Notes</h3>')
        .replace(/Action Items:/g, '<h3 class="text-xl font-bold text-[#37352f] mt-2 mb-1 text-left">Action Items</h3>');

    // Add text-left to the bullet points
    html = html.replace(/-\s(.*)/g, '<li class="ml-6 list-disc text-[#37352f] mb-2 leading-relaxed text-left">$1</li>');

    return html;
}

async function onGenerateSummary() {
  if (isSummarizing) return;

  try {
    isSummarizing = true;
    summaryBtn.classList.add("opacity-70");
    const provider = document.getElementById("summary-provider")?.value || "api";
    const model = document.getElementById("ollama-model")?.value || "llama3.1:8b";
    
    if (!activeMeetingId) {
        updateStatus("Error: No active meeting selected!", "error");
        return;
    }

    updateStatus(`${provider === "ollama" ? "Ollama" : "API"} working...`, "recording");

    // Ask the Receptionist for the summary
    const summary = await window.recorder.generateSummary({ 
        provider, model, meetingId: activeMeetingId 
    });

    const titleMatch = summary.match(/Title:\s*(.*)/);
    
    if (titleMatch && titleMatch[1]) {
        const newTitle = titleMatch[1].trim(); 
        
        await window.recorder.renameMeeting({ meetingId: activeMeetingId, newTitle: newTitle });
        
        loadSidebar(); 

        if (typeof meetingTitle !== 'undefined' && meetingTitle) {
             meetingTitle.textContent = newTitle;
        }
    }

    // Grab the UI boxes
    const outputBox = document.getElementById("summary-output");
    const summaryText = document.getElementById("summary-paragraph"); 
    const summaryPlaceholder = document.getElementById("summary-placeholder");

    // Show the box, hide the placeholder
    outputBox.classList.remove("hidden");
    if(summaryPlaceholder) summaryPlaceholder.classList.add("hidden");

    // Format the text (this will turn the "Title:" into an H1!)
    summaryText.innerHTML = formatSummary(summary);
    
    updateStatus(`Summary ready`, "idle");

  } catch (err) {
    updateStatus("Summary failed: " + err.message, "error");
  } finally {
    isSummarizing = false;
    summaryBtn.classList.remove("opacity-70");
  }
}



// 8. APP INITIALIZATION (EVENT LISTENERS)
if (newMeetingBtn) newMeetingBtn.addEventListener('click', handleNewMeetingClick);
if (startBtn) startBtn.addEventListener("click", onStart);
if (stopBtn) stopBtn.addEventListener("click", onStop);
if (analyzeBtn) analyzeBtn.addEventListener("click", onanalyzeBtn);
if (summaryBtn) summaryBtn.addEventListener("click", onGenerateSummary);
if (settingsBtn) settingsBtn.addEventListener('click', () => {
    syncSettingsModalValues();
    setSettingsOpen(true);
});
if (settingsCloseBtn) settingsCloseBtn.addEventListener('click', () => setSettingsOpen(false));
if (settingsCancelBtn) settingsCancelBtn.addEventListener('click', () => setSettingsOpen(false));
if (settingsModal) {
    settingsModal.addEventListener('click', (event) => {
        if (event.target === settingsModal) setSettingsOpen(false);
    });
}
if (settingsSaveBtn) {
    settingsSaveBtn.addEventListener('click', async () => {
        try {
            await saveSettings();
            setSettingsOpen(false);
            updateStatus('Settings saved', 'idle');
        } catch (error) {
            updateStatus(`Settings failed: ${error.message}`, 'error');
        }
    });
}

// Audio error handling listeners
audioPlayer.addEventListener('error', (e) => updateStatus('Audio playback failed', 'error'));

// Boot up the UI!
loadSidebar();
loadMicrophoneDropdown();
loadSettings();
console.log("MindMic UI loaded and ready!");