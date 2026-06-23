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
async function summarizeTranscript(transcriptText) {
    try {
        // 1. The Manager handed us the text, so just use it directly!
        const finalPrompt = buildSummaryPrompt(transcriptText);

        // 2. Ask Ollama for the summary
        const response = await askOllama(finalPrompt);
        return response;

    } catch (error) {
        console.error("Error in summarizeTranscript:", error);
        throw error; // (It's good to throw the error so the UI knows it failed)
    }
}
module.exports = {
  askOllama,
  summarizeTranscript
};
