/**
 * LLM Configuration
 */

import { ChatOpenAI } from '@langchain/openai';
import { config } from './config';

/**
 * Options for configuring the LLM
 */
export interface LLMOptions {
  modelName?: string;
  temperature?: number;
  apiKey?: string;
  maxTokens?: number;
}

/**
 * Get a configured OpenAI model
 */
export function getLLM(options: LLMOptions = {}): ChatOpenAI {
  return new ChatOpenAI({
    modelName: options.modelName || config.llm.defaultModel,
    temperature: options.temperature ?? config.llm.defaultTemperature,
    maxTokens: options.maxTokens ?? config.llm.defaultMaxTokens,
    openAIApiKey: options.apiKey || process.env.OPENROUTER_API_KEY,
    configuration: {
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://crowd-wisdom-agents.vercel.app',
        'X-Title': 'Crowd Wisdom Agents',
      },
    }
  });
}

/**
 * Create a ChatOpenAI instance with the specified configuration
 */
export function createChatOpenAI(apiKey: string, temperature = config.llm.defaultTemperature) {
  return new ChatOpenAI({
    openAIApiKey: apiKey,
    temperature,
    modelName: 'gpt-4o',
  });
} 