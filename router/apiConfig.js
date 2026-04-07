import { OpenRouter } from '@openrouter/sdk';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
console.log(process.env.OPENROUTER_API_KEY);

const openRouter = new OpenRouter({
  apiKey: '<OPENROUTER_API_KEY>',
  defaultHeaders: {
    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
    'X-OpenRouter-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
  },
});

