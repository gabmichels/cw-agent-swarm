/**
 * LLM Configuration
 */

import { ChatOpenAI } from '@langchain/openai';
import { config } from "./config";

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
export function getLLM(options?: LLMOptions) {
  return new ChatOpenAI({
    modelName: options?.modelName || config.llm.defaultModel,
    temperature: options?.temperature || config.llm.defaultTemperature,
    apiKey: options?.apiKey,
    maxTokens: options?.maxTokens,
  });
}

/**
 * Create a ChatOpenAI instance with the specified configuration
 */
export function createChatOpenAI(options: {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
}) {
  return new ChatOpenAI({
    modelName: options.model || 'gpt-4o',
    temperature: options.temperature || config.llm.defaultTemperature,
    maxTokens: options.maxTokens,
    apiKey: options.apiKey,
  });
} 