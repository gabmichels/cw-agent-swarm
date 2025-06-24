/**
 * Unified Configuration Management System
 * 
 * Centralizes configuration loading, validation, and management across all services.
 * Follows IMPLEMENTATION_GUIDELINES.md with strict typing, dependency injection, and proper error handling.
 */

import { z } from 'zod';
import { AppError } from '../errors/base';
import { logger } from '../logging';

/**
 * Configuration validation error
 */
export class ConfigurationError extends AppError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'CONFIGURATION_ERROR', context);
    this.name = 'ConfigurationError';
  }
}

/**
 * Core environment variables schema
 */
export const CoreEnvSchema = z.object({
  // LLM Configuration
  OPENAI_API_KEY: z.string().min(1, 'OpenAI API key is required'),
  OPENAI_MODEL_NAME: z.string().default('gpt-4.1-2025-04-14'),
  OPENAI_CHEAP_MODEL: z.string().default('gpt-4.1-nano-2025-04-14'),
  OPENAI_MAX_TOKENS: z.string().transform(val => parseInt(val, 10)).default('32000'),

  // Vector Database
  QDRANT_URL: z.string().url().default('http://localhost:6333'),
  QDRANT_API_KEY: z.string().optional(),

  // Security
  ENCRYPTION_MASTER_KEY: z.string().min(32, 'Encryption key must be at least 32 characters'),
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),

  // Database
  DATABASE_URL: z.string().url().optional(),

  // Paths
  DATA_PATH: z.string().default('./data'),
  LOGS_PATH: z.string().default('./logs'),

  // Application
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform(val => parseInt(val, 10)).default('3000'),

  // OAuth Providers
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  ZOHO_CLIENT_ID: z.string().optional(),
  ZOHO_CLIENT_SECRET: z.string().optional(),

  // Social Media
  TWITTER_API_KEY: z.string().optional(),
  TWITTER_API_SECRET: z.string().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  TIKTOK_CLIENT_KEY: z.string().optional(),
  TIKTOK_CLIENT_SECRET: z.string().optional(),
});

export type CoreEnvironment = z.infer<typeof CoreEnvSchema>;

/**
 * Service configuration schemas
 */
export const ServiceConfigSchemas = {
  llm: z.object({
    apiKey: z.string().min(1),
    defaultModel: z.string(),
    cheapModel: z.string(),
    defaultTemperature: z.number().min(0).max(2).default(0.7),
    defaultMaxTokens: z.number().positive().default(32000),
    timeout: z.number().positive().default(30000),
  }),

  vectorDatabase: z.object({
    url: z.string().url(),
    apiKey: z.string().optional(),
    defaultNamespace: z.string().default('default'),
    embeddingModel: z.string().default('openai/text-embedding-3-small'),
    timeout: z.number().positive().default(10000),
  }),

  oauth: z.object({
    providers: z.record(z.object({
      clientId: z.string().min(1),
      clientSecret: z.string().min(1),
      scopes: z.array(z.string()).default([]),
      redirectUri: z.string().url().optional(),
    })).default({}),
    tokenRefreshBuffer: z.number().positive().default(300), // 5 minutes
    maxRetries: z.number().positive().default(3),
  }),

  socialMedia: z.object({
    providers: z.record(z.object({
      apiKey: z.string().optional(),
      apiSecret: z.string().optional(),
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      enabled: z.boolean().default(true),
    })),
    rateLimits: z.object({
      requestsPerMinute: z.number().positive().default(60),
      requestsPerHour: z.number().positive().default(1000),
    }),
  }),

  database: z.object({
    url: z.string().optional(),
    pool: z.object({
      min: z.number().nonnegative().default(2),
      max: z.number().positive().default(10),
    }),
    timeout: z.number().positive().default(30000),
  }),

  security: z.object({
    encryptionKey: z.string().min(32),
    jwtSecret: z.string().min(32),
    tokenExpiry: z.number().positive().default(3600), // 1 hour
    refreshTokenExpiry: z.number().positive().default(2592000), // 30 days
  }),
} as const;

/**
 * Unified configuration interface
 */
export interface UnifiedConfig {
  environment: CoreEnvironment;
  llm: z.infer<typeof ServiceConfigSchemas.llm>;
  vectorDatabase: z.infer<typeof ServiceConfigSchemas.vectorDatabase>;
  oauth: z.infer<typeof ServiceConfigSchemas.oauth>;
  socialMedia: z.infer<typeof ServiceConfigSchemas.socialMedia>;
  database: z.infer<typeof ServiceConfigSchemas.database>;
  security: z.infer<typeof ServiceConfigSchemas.security>;
  paths: {
    data: string;
    logs: string;
  };
  app: {
    name: string;
    version: string;
    port: number;
    nodeEnv: string;
  };
}

/**
 * Configuration manager singleton
 */
export class UnifiedConfigManager {
  private static instance: UnifiedConfigManager | null = null;
  private config: UnifiedConfig | null = null;
  private validated = false;

  private constructor() { }

  /**
   * Get singleton instance
   */
  static getInstance(): UnifiedConfigManager {
    if (!UnifiedConfigManager.instance) {
      UnifiedConfigManager.instance = new UnifiedConfigManager();
    }
    return UnifiedConfigManager.instance;
  }

  /**
   * Load and validate configuration
   */
  async loadConfig(): Promise<UnifiedConfig> {
    if (this.config && this.validated) {
      return this.config;
    }

    try {
      // Validate environment variables
      const environment = CoreEnvSchema.parse(process.env);

      // Build service configurations
      const llmConfig = ServiceConfigSchemas.llm.parse({
        apiKey: environment.OPENAI_API_KEY,
        defaultModel: environment.OPENAI_MODEL_NAME,
        cheapModel: environment.OPENAI_CHEAP_MODEL,
        defaultMaxTokens: environment.OPENAI_MAX_TOKENS,
      });

      const vectorDbConfig = ServiceConfigSchemas.vectorDatabase.parse({
        url: environment.QDRANT_URL,
        apiKey: environment.QDRANT_API_KEY,
      });

      const oauthConfig = ServiceConfigSchemas.oauth.parse({
        providers: {
          ...(environment.GOOGLE_CLIENT_ID && environment.GOOGLE_CLIENT_SECRET && {
            google: {
              clientId: environment.GOOGLE_CLIENT_ID,
              clientSecret: environment.GOOGLE_CLIENT_SECRET,
              scopes: [
                'https://www.googleapis.com/auth/userinfo.profile',
                'https://www.googleapis.com/auth/userinfo.email'
              ],
            }
          }),
          ...(environment.MICROSOFT_CLIENT_ID && environment.MICROSOFT_CLIENT_SECRET && {
            microsoft: {
              clientId: environment.MICROSOFT_CLIENT_ID,
              clientSecret: environment.MICROSOFT_CLIENT_SECRET,
              scopes: ['https://graph.microsoft.com/user.read'],
            }
          }),
          ...(environment.ZOHO_CLIENT_ID && environment.ZOHO_CLIENT_SECRET && {
            zoho: {
              clientId: environment.ZOHO_CLIENT_ID,
              clientSecret: environment.ZOHO_CLIENT_SECRET,
              scopes: ['ZohoMail.messages.READ', 'ZohoMail.messages.CREATE'],
            }
          }),
        },
      });

      const socialMediaConfig = ServiceConfigSchemas.socialMedia.parse({
        providers: {
          ...(environment.TWITTER_API_KEY && environment.TWITTER_API_SECRET && {
            twitter: {
              apiKey: environment.TWITTER_API_KEY,
              apiSecret: environment.TWITTER_API_SECRET,
            }
          }),
          ...(environment.LINKEDIN_CLIENT_ID && environment.LINKEDIN_CLIENT_SECRET && {
            linkedin: {
              clientId: environment.LINKEDIN_CLIENT_ID,
              clientSecret: environment.LINKEDIN_CLIENT_SECRET,
            }
          }),
          ...(environment.TIKTOK_CLIENT_KEY && environment.TIKTOK_CLIENT_SECRET && {
            tiktok: {
              clientId: environment.TIKTOK_CLIENT_KEY,
              clientSecret: environment.TIKTOK_CLIENT_SECRET,
            }
          }),
        },
        rateLimits: {
          requestsPerMinute: 60,
          requestsPerHour: 1000,
        },
      });

      const databaseConfig = ServiceConfigSchemas.database.parse({
        url: environment.DATABASE_URL,
        pool: {
          min: 2,
          max: 10,
        },
        timeout: 30000,
      });

      const securityConfig = ServiceConfigSchemas.security.parse({
        encryptionKey: environment.ENCRYPTION_MASTER_KEY,
        jwtSecret: environment.JWT_SECRET,
      });

      this.config = {
        environment,
        llm: llmConfig,
        vectorDatabase: vectorDbConfig,
        oauth: oauthConfig,
        socialMedia: socialMediaConfig,
        database: databaseConfig,
        security: securityConfig,
        paths: {
          data: environment.DATA_PATH,
          logs: environment.LOGS_PATH,
        },
        app: {
          name: 'Crowd Wisdom Agent Swarm',
          version: '1.0.0',
          port: environment.PORT,
          nodeEnv: environment.NODE_ENV,
        },
      };

      this.validated = true;
      logger.info('Unified configuration loaded successfully', {
        nodeEnv: this.config.app.nodeEnv,
        enabledOAuthProviders: Object.keys(this.config.oauth.providers),
        enabledSocialProviders: Object.keys(this.config.socialMedia.providers),
      });

      return this.config;
    } catch (error) {
      const configError = new ConfigurationError(
        'Failed to load configuration',
        {
          originalError: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      );

      logger.error('Configuration loading failed', configError.toJSON());
      throw configError;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): UnifiedConfig {
    if (!this.config || !this.validated) {
      throw new ConfigurationError('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config;
  }

  /**
   * Get service-specific configuration
   */
  getServiceConfig<T extends keyof UnifiedConfig>(service: T): UnifiedConfig[T] {
    return this.getConfig()[service];
  }

  /**
   * Check if a service is configured
   */
  isServiceConfigured(service: keyof UnifiedConfig): boolean {
    try {
      const config = this.getConfig();
      const serviceConfig = config[service];

      // For OAuth and social media, check if any providers are configured
      if (service === 'oauth' || service === 'socialMedia') {
        return Object.keys((serviceConfig as any).providers).length > 0;
      }

      return serviceConfig !== null && serviceConfig !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Validate environment for required services
   */
  validateRequiredServices(requiredServices: Array<keyof UnifiedConfig>): void {
    const missingServices = requiredServices.filter(service => !this.isServiceConfigured(service));

    if (missingServices.length > 0) {
      throw new ConfigurationError(
        'Required services are not properly configured',
        { missingServices }
      );
    }
  }

  /**
 * Get OAuth provider configuration
 */
  getOAuthProvider(provider: string): { clientId: string; clientSecret: string; scopes: string[]; redirectUri?: string } {
    const config = this.getConfig();
    const providerConfig = config.oauth.providers[provider];

    if (!providerConfig) {
      throw new ConfigurationError(`OAuth provider '${provider}' is not configured`);
    }

    // TypeScript knows providerConfig is defined here, but we need to ensure the required fields
    return {
      clientId: providerConfig.clientId,
      clientSecret: providerConfig.clientSecret,
      scopes: providerConfig.scopes,
      redirectUri: providerConfig.redirectUri,
    };
  }

  /**
   * Get social media provider configuration
   */
  getSocialMediaProvider(provider: string): { apiKey?: string; apiSecret?: string; clientId?: string; clientSecret?: string; enabled: boolean } {
    const config = this.getConfig();
    const providerConfig = config.socialMedia.providers[provider];

    if (!providerConfig) {
      throw new ConfigurationError(`Social media provider '${provider}' is not configured`);
    }

    return {
      apiKey: providerConfig.apiKey,
      apiSecret: providerConfig.apiSecret,
      clientId: providerConfig.clientId,
      clientSecret: providerConfig.clientSecret,
      enabled: providerConfig.enabled,
    };
  }
}

/**
 * Singleton instance
 */
export const unifiedConfig = UnifiedConfigManager.getInstance();

/**
 * Convenience function to get configuration
 */
export async function getUnifiedConfig(): Promise<UnifiedConfig> {
  return unifiedConfig.loadConfig();
}

/**
 * Type-safe configuration getter
 */
export function getServiceConfig<T extends keyof UnifiedConfig>(service: T): UnifiedConfig[T] {
  return unifiedConfig.getServiceConfig(service);
} 