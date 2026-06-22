// tracking for each New Meeting basically a clickboard which keeps track lets call it smart manager
const fs = require('fs');
const path = require('path');

// lets bring in our dumb worker or storage guy
const { getMeetingsDir, readJSON, writeJSON } = require('./storage');

function createMeeting(){
    const clipboardPath = path.join(getMeetingsDir(),"meetings.json");
    let clipboard = readJSON(clipboardPath);
    if (!clipboard) {
        clipboard = { meetings: [], nextNumber: 1 };
    }
    const dateStr = new Date().toISOString().split('T')[0];
    const sequence = String(clipboard.nextNumber).padStart(3,'0');
    const meetingId = `mtg_${dateStr}_${sequence}`;

    const newFolderDir = path.join(getMeetingsDir(), meetingId);
    fs.mkdirSync(newFolderDir, { recursive: true });

    // Create the sticky note for inside the new folder
    const newMeetingDetails = {
        id: meetingId,
        title: `Meeting #${clipboard.nextNumber}`,
        createdAt: new Date().toISOString(),
        status: "initialized",
        hasAudio: false
    };

    const stickyNotePath = path.join(newFolderDir, 'metadata.json');
    writeJSON(stickyNotePath, newMeetingDetails);

    // Last one frfr Update our master clipboard and save it back to the drawer
    clipboard.meetings.unshift(newMeetingDetails); // Add newest to the top of the list
    clipboard.nextNumber += 1;                     // Increase the counter for next time
    writeJSON(clipboardPath, clipboard);

    console.log(`MANAGER: Successfully created new meeting folder -> ${meetingId}`);
    return newMeetingDetails;

}

module.exports = { createMeeting }
