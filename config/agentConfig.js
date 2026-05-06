const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const AgentTypes = {
    ollamaLocal: 'ollama-local',
    openAICloud: 'openai-cloud',
    openRouterCloud: 'openrouter-cloud',
};

const getAgentConfig = () => {
  const preferredAgent = process.env.PREFERRED_AGENT || AGENT_TYPES.OLLAMA_LOCAL;
  
  return {
    preferred: preferredAgent,
    agents: {
      [AGENT_TYPES.OLLAMA_LOCAL]: {
        enabled: true,
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL || 'mistral',
        timeout: 30000,
        type: 'local'
      },
      [AGENT_TYPES.OPENAI_CLOUD]: {
        enabled: !!process.env.OPENAI_API_KEY,
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4o-mini',
        type: 'cloud'
      },
      [AGENT_TYPES.OPENROUTER_CLOUD]: {
        enabled: !!process.env.OPENROUTER_API_KEY,
        apiKey: process.env.OPENROUTER_API_KEY,
        model: 'openai/gpt-4-turbo',
        type: 'cloud'
      }
    }
  };
};

const getActiveAgent = () => {
  const config = getAgentConfig();
  return config.preferred;
};

module.exports = {
  AGENT_TYPES,
  getAgentConfig,
  getActiveAgent
};
