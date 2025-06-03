/**
 * CodaToolsConfigSchema.ts - Configuration schema for Coda tools
 * 
 * This file defines validation schemas and configuration interfaces for Coda tools,
 * including API key validation, folder configuration, and operational settings.
 * Follows IMPLEMENTATION_GUIDELINES.md principles for type safety and validation.
 */

import { z } from 'zod';

/**
 * Environment variable names for Coda configuration
 */
export const CODA_ENV_VARS = {
  API_KEY: 'CODA_API_KEY',
  FOLDER_ID: 'CODA_FOLDER_ID',
  WORKSPACE_ID: 'CODA_WORKSPACE_ID',
  BASE_URL: 'CODA_BASE_URL'
} as const;

/**
 * Default configuration values
 */
export const CODA_DEFAULTS = {
  BASE_URL: 'https://coda.io/apis/v1',
  TIMEOUT_MS: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
  MAX_CONTENT_LENGTH: 10 * 1024 * 1024, // 10MB
  RATE_LIMIT_PER_MINUTE: 100,
  RATE_LIMIT_PER_HOUR: 1000
} as const;

/**
 * Coda API configuration schema
 */
export const CodaApiConfigSchema = z.object({
  /** Coda API key - required for all operations */
  apiKey: z.string()
    .min(1, 'Coda API key is required')
    .regex(/^[a-f0-9-]+$/i, 'Invalid Coda API key format'),
  
  /** Base URL for Coda API */
  baseUrl: z.string()
    .url('Base URL must be a valid URL')
    .default(CODA_DEFAULTS.BASE_URL),
  
  /** Default workspace ID */
  workspaceId: z.string()
    .optional()
    .describe('Optional workspace ID for organization'),
  
  /** Request timeout in milliseconds */
  timeoutMs: z.number()
    .int()
    .min(1000, 'Timeout must be at least 1 second')
    .max(300000, 'Timeout cannot exceed 5 minutes')
    .default(CODA_DEFAULTS.TIMEOUT_MS),
  
  /** User agent string for API requests */
  userAgent: z.string()
    .default('DefaultAgent-CodaTools/2.0.0')
});

/**
 * Document folder configuration schema
 */
export const CodaFolderConfigSchema = z.object({
  /** Default folder ID for document creation */
  defaultFolderId: z.string()
    .optional()
    .describe('Default folder for new documents (uses CODA_FOLDER_ID from .env)'),
  
  /** Task-based document folder ID */
  taskFolderId: z.string()
    .optional()
    .describe('Folder for documents created via task system'),
  
  /** Auto-organize documents by date */
  autoOrganizeByDate: z.boolean()
    .default(false)
    .describe('Automatically create date-based folders'),
  
  /** Date format for auto-organization */
  dateFormat: z.string()
    .default('YYYY-MM')
    .describe('Date format for folder organization (YYYY-MM, YYYY-MM-DD, etc.)'),
  
  /** Folder naming template */
  folderTemplate: z.string()
    .default('{date} - Documents')
    .describe('Template for auto-created folder names')
});

/**
 * Retry and error handling configuration schema
 */
export const CodaRetryConfigSchema = z.object({
  /** Maximum number of retry attempts */
  maxAttempts: z.number()
    .int()
    .min(0, 'Retry attempts cannot be negative')
    .max(10, 'Too many retry attempts')
    .default(CODA_DEFAULTS.RETRY_ATTEMPTS),
  
  /** Initial delay between retries in milliseconds */
  delayMs: z.number()
    .int()
    .min(100, 'Retry delay must be at least 100ms')
    .max(30000, 'Retry delay cannot exceed 30 seconds')
    .default(CODA_DEFAULTS.RETRY_DELAY_MS),
  
  /** Exponential backoff multiplier */
  backoffMultiplier: z.number()
    .min(1, 'Backoff multiplier must be at least 1')
    .max(5, 'Backoff multiplier too high')
    .default(2),
  
  /** HTTP status codes that should trigger retries */
  retryStatusCodes: z.array(z.number().int().min(400).max(599))
    .default([429, 500, 502, 503, 504]),
  
  /** Enable retry for network errors */
  retryOnNetworkError: z.boolean()
    .default(true)
});

/**
 * Rate limiting configuration schema
 */
export const CodaRateLimitConfigSchema = z.object({
  /** Requests per minute limit */
  requestsPerMinute: z.number()
    .int()
    .min(1, 'Rate limit must be at least 1 request per minute')
    .max(1000, 'Rate limit too high')
    .default(CODA_DEFAULTS.RATE_LIMIT_PER_MINUTE),
  
  /** Requests per hour limit */
  requestsPerHour: z.number()
    .int()
    .min(1, 'Rate limit must be at least 1 request per hour')
    .max(10000, 'Rate limit too high')
    .default(CODA_DEFAULTS.RATE_LIMIT_PER_HOUR),
  
  /** Enable rate limiting */
  enabled: z.boolean()
    .default(true),
  
  /** Behavior when rate limit is exceeded */
  onLimitExceeded: z.enum(['wait', 'error', 'skip'])
    .default('wait')
    .describe('Action to take when rate limit is exceeded')
});

/**
 * Content validation configuration schema
 */
export const CodaContentConfigSchema = z.object({
  /** Maximum content length in bytes */
  maxContentLength: z.number()
    .int()
    .min(1024, 'Content length must be at least 1KB')
    .max(50 * 1024 * 1024, 'Content length cannot exceed 50MB')
    .default(CODA_DEFAULTS.MAX_CONTENT_LENGTH),
  
  /** Allowed content types */
  allowedContentTypes: z.array(z.string())
    .default(['text/plain', 'text/markdown', 'text/html']),
  
  /** Auto-convert content format */
  autoConvertFormat: z.boolean()
    .default(true)
    .describe('Automatically convert content to supported format'),
  
  /** Sanitize HTML content */
  sanitizeHtml: z.boolean()
    .default(true)
    .describe('Remove potentially unsafe HTML content'),
  
  /** Preserve markdown formatting */
  preserveMarkdown: z.boolean()
    .default(true)
    .describe('Preserve markdown syntax in content')
});

/**
 * Tool-specific feature configuration schema
 */
export const CodaToolFeaturesConfigSchema = z.object({
  /** Enable legacy input format support (action|title|content) */
  enableLegacyFormat: z.boolean()
    .default(true)
    .describe('Support Chloe\'s action|title|content input format'),
  
  /** Enable auto-titling for documents */
  enableAutoTitling: z.boolean()
    .default(true)
    .describe('Automatically generate titles from content'),
  
  /** Enable enhanced metadata collection */
  enableMetadata: z.boolean()
    .default(true)
    .describe('Collect detailed metadata for operations'),
  
  /** Enable content analysis features */
  enableContentAnalysis: z.boolean()
    .default(true)
    .describe('Analyze content for headings, links, etc.'),
  
  /** Enable task system integration */
  enableTaskIntegration: z.boolean()
    .default(true)
    .describe('Support creation of documents via task system'),
  
  /** Enable caching for read operations */
  enableCaching: z.boolean()
    .default(false)
    .describe('Cache document content for performance'),
  
  /** Cache TTL in milliseconds */
  cacheTtlMs: z.number()
    .int()
    .min(60000, 'Cache TTL must be at least 1 minute')
    .max(3600000, 'Cache TTL cannot exceed 1 hour')
    .default(300000) // 5 minutes
});

/**
 * Complete Coda tools configuration schema
 */
export const CodaToolsConfigSchema = z.object({
  /** API configuration */
  api: CodaApiConfigSchema,
  
  /** Folder management configuration */
  folders: CodaFolderConfigSchema,
  
  /** Retry and error handling configuration */
  retry: CodaRetryConfigSchema,
  
  /** Rate limiting configuration */
  rateLimit: CodaRateLimitConfigSchema,
  
  /** Content validation configuration */
  content: CodaContentConfigSchema,
  
  /** Tool feature configuration */
  features: CodaToolFeaturesConfigSchema,
  
  /** Enable debug logging */
  debug: z.boolean()
    .default(false)
    .describe('Enable detailed debug logging'),
  
  /** Custom configuration extension */
  custom: z.record(z.unknown())
    .default({})
    .describe('Custom configuration options')
});

/**
 * TypeScript types derived from schemas
 */
export type CodaApiConfig = z.infer<typeof CodaApiConfigSchema>;
export type CodaFolderConfig = z.infer<typeof CodaFolderConfigSchema>;
export type CodaRetryConfig = z.infer<typeof CodaRetryConfigSchema>;
export type CodaRateLimitConfig = z.infer<typeof CodaRateLimitConfigSchema>;
export type CodaContentConfig = z.infer<typeof CodaContentConfigSchema>;
export type CodaToolFeaturesConfig = z.infer<typeof CodaToolFeaturesConfigSchema>;
export type CodaToolsConfig = z.infer<typeof CodaToolsConfigSchema>;

/**
 * Configuration validation error class
 */
export class CodaConfigValidationError extends Error {
  public readonly issues: z.ZodIssue[];
  
  constructor(issues: z.ZodIssue[]) {
    const message = `Coda configuration validation failed:\n${
      issues.map(issue => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n')
    }`;
    super(message);
    this.name = 'CodaConfigValidationError';
    this.issues = issues;
  }
}

/**
 * Load configuration from environment variables
 */
export function loadCodaConfigFromEnv(): Partial<CodaToolsConfig> {
  const envConfig: any = {};
  
  // API configuration from environment
  if (process.env[CODA_ENV_VARS.API_KEY]) {
    envConfig.api = {
      apiKey: process.env[CODA_ENV_VARS.API_KEY]
    };
  }
  
  if (process.env[CODA_ENV_VARS.BASE_URL]) {
    envConfig.api = {
      ...envConfig.api,
      baseUrl: process.env[CODA_ENV_VARS.BASE_URL]
    };
  }
  
  if (process.env[CODA_ENV_VARS.WORKSPACE_ID]) {
    envConfig.api = {
      ...envConfig.api,
      workspaceId: process.env[CODA_ENV_VARS.WORKSPACE_ID]
    };
  }
  
  // Folder configuration from environment
  if (process.env[CODA_ENV_VARS.FOLDER_ID]) {
    envConfig.folders = {
      defaultFolderId: process.env[CODA_ENV_VARS.FOLDER_ID],
      taskFolderId: process.env[CODA_ENV_VARS.FOLDER_ID] // Use same folder by default
    };
  }
  
  return envConfig;
}

/**
 * Validate and create Coda configuration
 */
export function createCodaConfig(
  config: Partial<CodaToolsConfig> = {}
): CodaToolsConfig {
  try {
    // Load environment configuration
    const envConfig = loadCodaConfigFromEnv();
    
    // Merge with provided config (provided config takes precedence)
    const mergedConfig = {
      api: { ...envConfig.api, ...config.api },
      folders: { ...envConfig.folders, ...config.folders },
      retry: { ...config.retry },
      rateLimit: { ...config.rateLimit },
      content: { ...config.content },
      features: { ...config.features },
      debug: config.debug,
      custom: config.custom
    };
    
    // Validate and return parsed configuration
    return CodaToolsConfigSchema.parse(mergedConfig);
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new CodaConfigValidationError(error.issues);
    }
    throw error;
  }
}

/**
 * Validate API key format and accessibility
 */
export function validateCodaApiKey(apiKey: string): {
  isValid: boolean;
  format: 'valid' | 'invalid' | 'missing';
  message: string;
} {
  if (!apiKey || apiKey.trim().length === 0) {
    return {
      isValid: false,
      format: 'missing',
      message: 'Coda API key is missing. Please set CODA_API_KEY in your .env file.'
    };
  }
  
  // Basic format validation (Coda keys are typically UUID-like)
  const apiKeyFormat = /^[a-f0-9-]+$/i;
  if (!apiKeyFormat.test(apiKey)) {
    return {
      isValid: false,
      format: 'invalid',
      message: 'Coda API key format is invalid. Expected hexadecimal characters and hyphens.'
    };
  }
  
  return {
    isValid: true,
    format: 'valid',
    message: 'Coda API key format is valid.'
  };
}

/**
 * Create default configuration with environment variables
 */
export function createDefaultCodaConfig(): CodaToolsConfig {
  return createCodaConfig({
    api: {
      apiKey: process.env[CODA_ENV_VARS.API_KEY] || '',
      baseUrl: process.env[CODA_ENV_VARS.BASE_URL] || CODA_DEFAULTS.BASE_URL,
      workspaceId: process.env[CODA_ENV_VARS.WORKSPACE_ID],
      timeoutMs: CODA_DEFAULTS.TIMEOUT_MS,
      userAgent: 'DefaultAgent-CodaTools/2.0.0'
    },
    folders: {
      defaultFolderId: process.env[CODA_ENV_VARS.FOLDER_ID],
      taskFolderId: process.env[CODA_ENV_VARS.FOLDER_ID],
      autoOrganizeByDate: false,
      dateFormat: 'YYYY-MM',
      folderTemplate: '{date} - Documents'
    },
    retry: {
      maxAttempts: CODA_DEFAULTS.RETRY_ATTEMPTS,
      delayMs: CODA_DEFAULTS.RETRY_DELAY_MS,
      backoffMultiplier: 2,
      retryStatusCodes: [429, 500, 502, 503, 504],
      retryOnNetworkError: true
    },
    rateLimit: {
      requestsPerMinute: CODA_DEFAULTS.RATE_LIMIT_PER_MINUTE,
      requestsPerHour: CODA_DEFAULTS.RATE_LIMIT_PER_HOUR,
      enabled: true,
      onLimitExceeded: 'wait'
    },
    content: {
      maxContentLength: CODA_DEFAULTS.MAX_CONTENT_LENGTH,
      allowedContentTypes: ['text/plain', 'text/markdown', 'text/html'],
      autoConvertFormat: true,
      sanitizeHtml: true,
      preserveMarkdown: true
    },
    features: {
      enableLegacyFormat: true,
      enableAutoTitling: true,
      enableMetadata: true,
      enableContentAnalysis: true,
      enableTaskIntegration: true,
      enableCaching: false,
      cacheTtlMs: 300000
    },
    debug: false,
    custom: {}
  });
}

/**
 * Get configuration summary for logging
 */
export function getCodaConfigSummary(config: CodaToolsConfig): Record<string, unknown> {
  return {
    hasApiKey: !!config.api.apiKey,
    apiKeyValid: validateCodaApiKey(config.api.apiKey).isValid,
    baseUrl: config.api.baseUrl,
    hasWorkspaceId: !!config.api.workspaceId,
    hasDefaultFolder: !!config.folders.defaultFolderId,
    hasTaskFolder: !!config.folders.taskFolderId,
    retryEnabled: config.retry.maxAttempts > 0,
    rateLimitEnabled: config.rateLimit.enabled,
    featuresEnabled: Object.entries(config.features)
      .filter(([_, enabled]) => enabled)
      .map(([feature]) => feature),
    debugMode: config.debug
  };
} 