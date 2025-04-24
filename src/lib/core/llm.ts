/**
 * LLM Configuration
 */

import { ChatOpenAI } from '@langchain/openai';
import { config } from "./config";

// List of OpenRouter Gemini models that we support, based on search results
const OPENROUTER_GEMINI_MODELS = [
  'google/gemini-2.0-flash-001',
  'google/gemini-2.5-pro-preview-03-25',
  'google/gemini-2.5-flash-preview',
  'google/gemini-2.5-flash-preview:thinking',
  'google/gemini-1.5-flash',
  'google/gemini-flash-1.5'
];

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
 * Map a model name to the correct OpenRouter model ID
 * This handles cases where a user might specify "gemini-1.5-flash" instead of "google/gemini-1.5-flash"
 */
function mapToOpenRouterModel(modelName: string): string {
  // If it already starts with "google/", assume it's already correctly formatted
  if (modelName.startsWith('google/')) {
    return modelName;
  }
  
  // If it's a known Gemini model, use the full OpenRouter model ID
  for (const fullModelName of OPENROUTER_GEMINI_MODELS) {
    if (fullModelName.includes(modelName)) {
      console.log(`Mapped "${modelName}" to OpenRouter model "${fullModelName}"`);
      return fullModelName;
    }
  }
  
  // Default to prepending "google/" if no exact match found
  console.log(`No exact match found for "${modelName}", using "google/${modelName}"`);
  return `google/${modelName}`;
}

/**
 * Get a configured LLM instance
 * Uses OpenRouter for Gemini models, falls back to OpenAI for others
 */
export function getLLM(options?: LLMOptions) {
  const modelName = options?.modelName || config.llm.defaultModel;
  const temperature = options?.temperature || config.llm.defaultTemperature;
  const apiKey = options?.apiKey || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  
  // Check if this is a Gemini model
  if (modelName.includes('gemini')) {
    console.log(`Using OpenRouter for Gemini model: ${modelName}`);
    
    // Map to the correct OpenRouter model ID
    const openRouterModel = mapToOpenRouterModel(modelName);
    
    try {
      return new ChatOpenAI({
        modelName: openRouterModel,
        temperature: temperature,
        maxTokens: options?.maxTokens,
        apiKey: apiKey,
        configuration: {
          baseURL: "https://openrouter.ai/api/v1",
          defaultHeaders: {
            "HTTP-Referer": "https://crowd-wisdom.com",
            "X-Title": "Chloe AI Assistant"
          }
        }
      });
    } catch (error) {
      console.error("Error initializing OpenRouter:", error);
      throw error;
    }
  } else {
    // For non-Gemini models, use standard OpenAI
    console.log(`Using standard OpenAI for model: ${modelName}`);
    return new ChatOpenAI({
      modelName: modelName,
      temperature: temperature,
      maxTokens: options?.maxTokens,
      apiKey: apiKey,
    });
  }
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