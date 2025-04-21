/**
 * LLM Configuration
 */

import { ChatOpenAI } from '@langchain/openai';
import { DEFAULT_LLM_TEMPERATURE } from '@crowd-wisdom/shared';

interface LLMOptions {
  modelName?: string;
  temperature?: number;
  apiKey?: string;
  maxTokens?: number;
}

export const getOpenRouterLLM = (options: LLMOptions = {}) => {
  const {
    modelName = 'openrouter/anthropic/claude-3-opus:2024-05-01',
    temperature = 0.7,
    apiKey = process.env.OPENROUTER_API_KEY,
    maxTokens = 4000,
  } = options;

  return new ChatOpenAI({
    modelName,
    temperature,
    openAIApiKey: apiKey,
    maxTokens,
    configuration: {
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://crowd-wisdom-employees',
        'X-Title': 'Crowd Wisdom Employees'
      }
    }
  });
};

export const getLLM = getOpenRouterLLM; // Default LLM provider

/**
 * Create a ChatOpenAI instance with the specified configuration
 */
export function createChatOpenAI(apiKey: string, temperature = DEFAULT_LLM_TEMPERATURE) {
  return new ChatOpenAI({
    openAIApiKey: apiKey,
    temperature,
    modelName: 'gpt-4o',
  });
} 