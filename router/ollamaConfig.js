const fs = require("fs");
const path = require("path");
const { buildSummaryPrompt } = require("./summaryPrompt");

async function askOllama(prompt){
    try{
        const response = await fetch('http://localhost:11434/api/generate',{
            method: 'POST',
            headers:{
                "Content-Type": "application/json"
            },
            body:JSON.stringify({
                model: "gemma3:4b",
                prompt,
                stream: false,
            })
        })
        const data = await response.json();
    
    return data.response;
    }catch(error){
        console.error("Error in askOllama:", error);
    }
}
//above was for testing now actual function
async function summarizeTranscript(){
try{
    const transcriptPath = path.join(__dirname, "../transcription.txt");
    const transcript = fs.readFileSync(transcriptPath, 'utf-8');
    const finalPrompt = buildSummaryPrompt(transcript);

    const response = await askOllama(finalPrompt);
    return response;

}catch(error){
    console.error("Error in summarizeTranscript:", error);

}
}
module.exports = {
  askOllama,
  summarizeTranscript
};
