const fs = require("fs");
const path = require("path");
const { buildSummaryPrompt } = require("./summaryPrompt");
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function askOllama(prompt){
    try{
        const baseUrl = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '');
        const response = await fetch(`${baseUrl}/api/generate`,{
            method: 'POST',
            headers:{
                "Content-Type": "application/json"
            },
            body:JSON.stringify({
                model: process.env.OLLAMA_MODEL || "gemma3:4b",
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
