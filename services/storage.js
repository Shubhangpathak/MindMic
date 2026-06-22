// our storage guy or dumb worker for future reference if i forget
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

function getMeetingsDir() {
    const baseDir = path.join(app.getPath('userData'), "meetings" );

    if(!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
    }
    return baseDir;
}

function readJSON(filePath) {
    try{
        if (!fs.existsSync(filePath)) return null;
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    }catch(err){
        console.error(`Whoops, couldn't read ${filePath}:`, err);
    return null;
    }
}
function writeJSON(filePath, data) {
  try {
    // Turn the JavaScript object into formatted text and save it
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Whoops, couldn't write to ${filePath}:`, error);
    return false;
  }
}


module.exports = { getMeetingsDir, readJSON, writeJSON };