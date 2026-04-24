const path = require('path');
const fs = require('fs');

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
        content: 'You are an assistant that analyzes conversations and extracts key information. Ignore greetings and small talk.',
      },
      {
        role: 'user',
        content: transcription,
      },
    ],
  });

  console.log(completion.choices[0].message.content);
  return completion.choices[0].message.content;
  
}

module.exports = {
  generateSummary,
};