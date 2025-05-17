/**
 * LLM Configuration
 */

import { ChatOpenAI } from '@langchain/openai';
import { config } from "./config";
import { CHEAP_LLM_MODEL } from "../shared/constants";

/**
 * Options for configuring the LLM
 */
export interface LLMOptions {
  modelName?: string;
  temperature?: number;
  apiKey?: string;
  maxTokens?: number;
  useCheapModel?: boolean;
}

/**
 * Get a configured LLM instance
 * Uses the default model or a cheaper model for lightweight calls
 */
export function getLLM(options?: LLMOptions) {
  // Determine which model to use
  let modelName: string;
  
  if (options?.useCheapModel) {
    // Use cheaper model for lightweight API calls
    modelName = CHEAP_LLM_MODEL;
    console.log(`Using cheap OpenAI model for lightweight call: ${modelName}`);
  } else {
    // Use specified model or default
    modelName = options?.modelName || config.llm.defaultModel || 'gpt-4.1-2025-04-14';
    console.log(`Using standard OpenAI model: ${modelName}`);
  }
  
  const temperature = options?.temperature || config.llm.defaultTemperature;
  const apiKey = options?.apiKey || process.env.OPENAI_API_KEY;
  
  // Use provided maxTokens, or environment variable, or default
  const maxTokens = options?.maxTokens || 
                   (process.env.OPENAI_MAX_TOKENS ? parseInt(process.env.OPENAI_MAX_TOKENS, 10) : undefined);
  
  try {
    return new ChatOpenAI({
      modelName: modelName,
      temperature: temperature,
      maxTokens: maxTokens,
      apiKey: apiKey,
    });
  } catch (error) {
    console.error("Error initializing OpenAI:", error);
    throw error;
  }
}

/**
 * Create a ChatOpenAI instance with the specified configuration
 * Option to use a cheaper model for lightweight tasks
 */
export function createChatOpenAI(options: {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  useCheapModel?: boolean;
}) {
  // Determine which model to use
  let modelName: string;
  
  if (options.useCheapModel) {
    // Use cheaper model for lightweight API calls
    modelName = CHEAP_LLM_MODEL;
    console.log(`Using cheap OpenAI model for lightweight call: ${modelName}`);
  } else {
    // Use specified model or default
    modelName = options.model || config.llm.defaultModel || 'gpt-4.1-2025-04-14';
  }
  
  // Use provided maxTokens, or environment variable, or default
  const maxTokens = options.maxTokens || 
                   (process.env.OPENAI_MAX_TOKENS ? parseInt(process.env.OPENAI_MAX_TOKENS, 10) : undefined);
  
  return new ChatOpenAI({
    modelName: modelName,
    temperature: options.temperature || config.llm.defaultTemperature,
    maxTokens: maxTokens,
    apiKey: options.apiKey || process.env.OPENAI_API_KEY,
  });
} 