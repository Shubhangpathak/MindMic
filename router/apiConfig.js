const path = require('path');
const fs = require('fs');
const { buildSummaryPrompt } = require('./summaryPrompt');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function generateSummary() {
  const { default: OpenAI } = await import('openai');
  const transcriptionPath = path.join(__dirname, '../transcription.txt');
  const transcription = fs.readFileSync(transcriptionPath, 'utf8');
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You follow formatting instructions exactly and return only the requested meeting summary.',
      },
      {
        role: 'user',
        content: buildSummaryPrompt(transcription),
      },
    ],
  });

  console.log(completion.choices[0].message.content);
  return completion.choices[0].message.content;
  
}

module.exports = {
  generateSummary,
};
