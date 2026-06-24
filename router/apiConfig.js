const path = require('path');
const { buildSummaryPrompt } = require('./summaryPrompt');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function generateSummary(transcriptText) {
  const { default: OpenAI } = await import('openai');
  
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You follow formatting instructions exactly and return only the requested meeting summary.',
        },
        {
          role: 'user',
          content: buildSummaryPrompt(transcriptText), 
        },
      ],
    });

    console.log("SUCCESS: OpenAI generated the summary.");
    return completion.choices[0].message.content;
    
  } catch (error) {
    console.error("Error in generateSummary (OpenAI):", error);
    throw error;
  }
}

module.exports = {
  generateSummary,
};