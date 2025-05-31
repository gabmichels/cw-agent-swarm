import { z } from 'zod';

// Environment variables schema
export const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  QDRANT_URL: z.string().optional(),
  QDRANT_API_KEY: z.string().optional(),
});

// Load and validate environment variables
export const getEnv = () => {
  return envSchema.parse(process.env);
};

/**
 * Core configuration
 */

/**
 * Default configuration for the core module
 */
export const DEFAULT_CONFIG = {
  llm: {
    defaultModel: process.env.OPENAI_MODEL_NAME || 'gpt-4.1-2025-04-14',
    cheapModel: process.env.OPENAI_CHEAP_MODEL || 'gpt-4.1-nano-2025-04-14',
    defaultTemperature: 0.7,
  },
  memory: {
    vectorDbUrl: 'http://localhost:6333',
  },
};

/**
 * Load configuration from environment variables
 */
export function loadConfig() {
  return {
    ...DEFAULT_CONFIG,
    llm: {
      ...DEFAULT_CONFIG.llm,
      apiKey: process.env.OPENAI_API_KEY || '',
    },
  };
}

/**
 * Configuration
 */
export const config = loadConfig();

/**
 * System configuration
 */
export const systemConfig = {
  system: {
    name: 'Crowd Wisdom',
    version: '0.1.0',
    description: 'AI agent platform for marketers'
  },
  llm: {
    defaultModel: process.env.OPENAI_MODEL_NAME || 'gpt-4.1-2025-04-14',
    cheapModel: process.env.OPENAI_CHEAP_MODEL || 'gpt-4.1-nano-2025-04-14',
    defaultTemperature: 0.7,
    defaultMaxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '32000', 10)
  },
  memory: {
    vectorStoreUrl: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY,
    defaultNamespace: 'chloe',
    embeddingModel: 'openai/text-embedding-3-small',
  },
  agent: {
    defaultModel: process.env.OPENAI_MODEL_NAME || 'gpt-4.1-2025-04-14',
    fallbackModel: process.env.OPENAI_CHEAP_MODEL || 'gpt-4.1-nano-2025-04-14',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '32000', 10),
    temperature: 0.7,
  },
  paths: {
    data: process.env.DATA_PATH || './data',
    logs: process.env.LOGS_PATH || './logs',
  },
}; 