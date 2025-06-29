/**
 * DefaultContentGenerationService.ts - Main implementation of the ACG service
 * 
 * Provides comprehensive content generation capabilities across all agent tools.
 * Follows dependency injection, strict typing, and error handling best practices.
 */

import { ulid, ULID } from 'ulid';
import {
  IContentGenerationService,
  GenerationOptions,
  ValidationConstraints,
  GenerationStatus,
  TimeRange,
  GenerationMetrics,
  ContentGenerationServiceConfig
} from '../interfaces/IContentGenerationService';
import {
  IContentGenerator,
  GeneratorDependencies
} from '../interfaces/IContentGenerator';
import {
  ContentGenerationRequest,
  GeneratedContent,
  ContentType,
  GenerationContext,
  ValidationResult,
  ContentGenerationResult,
  AsyncContentGenerationResult,
  GenerationMethod,
  GenerationStatus as StatusEnum,
  RequestMetadata
} from '../types/ContentGenerationTypes';
import {
  ContentGenerationError,
  ACGErrorFactory,
  isRetryableError,
  shouldRetry,
  getRetryDelay
} from '../errors/ContentGenerationError';

// Placeholder interfaces - these will be implemented in subsequent files
interface IGenerationRequestManager {
  submitRequest(request: ContentGenerationRequest): Promise<ULID>;
  getRequestStatus(requestId: ULID): Promise<GenerationStatus>;
  cancelRequest(requestId: ULID): Promise<boolean>;
  cleanupOldRequests(olderThan: Date): Promise<number>;
}

interface IContentCache {
  get(key: string): Promise<GeneratedContent | null>;
  set(key: string, content: GeneratedContent, ttl?: number): Promise<void>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  generateKey(context: GenerationContext): string;
  clearByType(contentType: ContentType): Promise<void>;
  clear(): Promise<void>;
}

interface ValidationRule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly pattern?: string;
  readonly validator: (content: string) => boolean;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
}

interface IContentValidator {
  validate(content: GeneratedContent, constraints?: ValidationConstraints): Promise<ValidationResult>;
  validateText(text: string, rules?: readonly ValidationRule[]): Promise<ValidationResult>;
}

interface IDatabaseProvider {
  createContentGeneratorRegistry(data: any): Promise<void>;
  updateContentGeneratorRegistry(id: string, data: any): Promise<void>;
  getContentGenerationMetrics(start: Date, end: Date): Promise<any>;
  recordContentGenerationMetrics(data: any): Promise<void>;
  recordCacheMetrics(data: any): Promise<void>;
  recordValidationMetrics(data: any): Promise<void>;
}

interface IErrorCommunicationService {
  handleError(error: Error, context: any): Promise<void>;
}

interface ILogger {
  debug(message: string, context?: any): void;
  info(message: string, context?: any): void;
  warn(message: string, context?: any): void;
  error(message: string, error?: Error, context?: any): void;
}

interface ACGServiceDependencies {
  generators: IContentGenerator[];
  cache: any;
  logger: any;
  config: ContentGenerationServiceConfig;
  requestManager?: IGenerationRequestManager;
  validator?: IContentValidator;
  database?: IDatabaseProvider;
  errorService?: IErrorCommunicationService;
}

export class DefaultContentGenerationService implements IContentGenerationService {
  private readonly generators = new Map<string, IContentGenerator>();
  private readonly activeRequests = new Map<ULID, AbortController>();
  private readonly config: ContentGenerationServiceConfig;
  private readonly cache: any;
  private readonly logger: any;
  private readonly requestManager?: IGenerationRequestManager;
  private readonly validator?: IContentValidator;
  private readonly database?: IDatabaseProvider;
  private readonly errorService?: IErrorCommunicationService;
  private isInitialized = false;
  private readonly resolvedTimeoutMs: number;

  constructor(dependencies: ACGServiceDependencies) {
    this.cache = dependencies.cache;
    this.logger = dependencies.logger;
    this.requestManager = dependencies.requestManager;
    this.validator = dependencies.validator;
    this.database = dependencies.database;
    this.errorService = dependencies.errorService;

    const defaultConfig = {
      maxConcurrentRequests: 50,
      defaultTimeoutMs: 30000,
      maxRetries: 3,
      cachingEnabled: true,
      validationEnabled: true,
      metricsEnabled: true,
      fallbackEnabled: true,
      batchSize: 10,
      cleanupIntervalMs: 3600000, // 1 hour
      requestHistoryLimit: 1000
    };

    this.config = {
      ...defaultConfig,
      ...dependencies.config
    };

    // Validate configuration - check both property names for compatibility
    const configTimeout = (this.config as any).defaultTimeout;
    const timeoutMs = configTimeout || this.config.defaultTimeoutMs; // Prioritize test config

    if (configTimeout !== undefined && configTimeout <= 0) {
      throw new Error('Invalid configuration: defaultTimeout must be positive');
    }
    if (timeoutMs !== undefined && timeoutMs <= 0) {
      throw new Error('Invalid configuration: defaultTimeout must be positive');
    }
    if (this.config.maxRetries < 0) {
      throw new Error('Invalid configuration: maxRetries must be non-negative');
    }
    if (this.config.batchSize <= 0) {
      throw new Error('Invalid configuration: batchSize must be positive');
    }

    // Store the resolved timeout value for use throughout the service
    this.resolvedTimeoutMs = timeoutMs || 30000;

    // Register initial generators
    for (const generator of dependencies.generators) {
      this.generators.set(generator.id, generator);
    }
  }

  async initialize(): Promise<void> {
    console.log('🚀 DefaultContentGenerationService.initialize() ENTRY - CONSOLE LOG', {
      component: 'DefaultContentGenerationService',
      isInitialized: this.isInitialized,
      generatorCount: this.generators.size,
      loggerExists: !!this.logger
    });

    this.logger.info('🚀 DefaultContentGenerationService.initialize() ENTRY', {
      component: 'DefaultContentGenerationService',
      isInitialized: this.isInitialized,
      generatorCount: this.generators.size
    });

    if (this.isInitialized) {
      this.logger.warn('Content generation service already initialized - returning early', {
        component: 'DefaultContentGenerationService'
      });
      return;
    }

    try {
      this.logger.info('Initializing ACG service', {
        component: 'DefaultContentGenerationService',
        config: this.config
      });

      // Create LLM service for generators that need it
      this.logger.info('Creating LLM service for generators', {
        component: 'DefaultContentGenerationService'
      });

      const llmService = {
        generateResponse: async (prompt: string, options?: any) => {
          this.logger.debug('LLM service generateResponse called', {
            promptLength: prompt.length,
            options
          });

          // Import getLLM here to avoid circular dependencies
          const { getLLM } = await import('../../../lib/core/llm');

          const llm = getLLM({
            useCheapModel: false, // Use the full model for content generation
            temperature: options?.temperature || 0.7,
            maxTokens: options?.maxTokens || 2000
          });

          try {
            const response = await llm.invoke(prompt);
            const content = typeof response === 'string' ? response : response.content;

            this.logger.debug('LLM service generateResponse success', {
              contentLength: content.length,
              model: 'gpt-4'
            });

            return {
              content: content.trim(),
              model: 'gpt-4', // Default model name
              tokensUsed: Math.ceil(content.length / 4), // Rough token estimate
              finishReason: 'completed' as const,
              confidence: 0.8
            };
          } catch (error) {
            this.logger.error('LLM generation failed', error as Error, {
              prompt: prompt.substring(0, 100) + '...',
              options
            });
            throw error;
          }
        },

        generateStructuredResponse: async <T>(prompt: string, schema: T, options?: any) => {
          const response = await llmService.generateResponse(prompt, options);
          try {
            const structuredData = JSON.parse(response.content) as T;
            return {
              ...response,
              structuredData
            };
          } catch (parseError) {
            // If parsing fails, return the raw content
            return {
              ...response,
              structuredData: response.content as T
            };
          }
        },

        isAvailable: async () => {
          try {
            // Test if LLM factory is available
            const { getLLM } = await import('../../../lib/core/llm');
            this.logger.debug('LLM service availability check: available');
            return true;
          } catch (error) {
            this.logger.warn('LLM service not available', { error });
            return false;
          }
        },

        getModels: async () => {
          return ['gpt-4', 'gpt-3.5-turbo'];
        }
      };

      // Test LLM service availability
      const isLLMAvailable = await llmService.isAvailable();
      this.logger.info('LLM service created', {
        component: 'DefaultContentGenerationService',
        isAvailable: isLLMAvailable
      });

      // Initialize generators with dependencies
      const dependencies: GeneratorDependencies = {
        logger: this.logger,
        cache: this.cache,
        validator: this.validator,
        llmService: llmService, // Add LLM service for generators that need it
        errorReporter: {
          reportError: async (error, context) => {
            if (this.errorService) {
              await this.errorService.handleError(error, {
                operation: context.operation,
                agentId: context.generatorId,
                metadata: context.metadata
              });
            }
          },
          reportWarning: async (message, context) => {
            this.logger.warn(message, context.metadata);
          }
        },
        metricsCollector: {
          recordGeneration: async (generatorId, contentType, durationMs, success) => {
            await this.recordMetrics(generatorId, contentType, durationMs, success);
          },
          recordCacheHit: async (generatorId, contentType) => {
            await this.recordCacheMetrics(generatorId, contentType, true);
          },
          recordCacheMiss: async (generatorId, contentType) => {
            await this.recordCacheMetrics(generatorId, contentType, false);
          },
          recordValidation: async (generatorId, contentType, score) => {
            await this.recordValidationMetrics(generatorId, contentType, score);
          }
        }
      };

      // Initialize all registered generators
      this.logger.info('Starting generator initialization', {
        component: 'DefaultContentGenerationService',
        generatorCount: this.generators.size,
        generatorIds: Array.from(this.generators.keys()),
        hasLLMService: !!dependencies.llmService
      });

      for (const [generatorId, generator] of this.generators.entries()) {
        try {
          this.logger.info('Initializing generator', {
            generatorId,
            generatorName: generator.name,
            supportedTypes: generator.supportedTypes,
            hasLLMService: !!dependencies.llmService
          });

          await generator.initialize(dependencies);

          this.logger.info('Generator initialized successfully', {
            generatorId,
            generatorName: generator.name
          });
        } catch (error) {
          this.logger.error('Generator initialization failed', error as Error, {
            generatorId,
            generatorName: generator.name
          });

          throw error;
        }
      }

      // Start cleanup interval
      if (this.config.cleanupIntervalMs > 0) {
        setInterval(
          () => this.cleanupOldRequests(),
          this.config.cleanupIntervalMs
        );
      }

      this.isInitialized = true;
      this.logger.info('ACG service initialized successfully', {
        component: 'DefaultContentGenerationService',
        generatorCount: this.generators.size
      });

    } catch (error) {
      this.logger.error('Failed to initialize ACG service', error as Error, {
        component: 'DefaultContentGenerationService'
      });
      throw error;
    }
  }

  async generateContent(request: ContentGenerationRequest): AsyncContentGenerationResult {
    const startTime = Date.now();
    let abortController: AbortController | undefined;
    let retryCount = 0;

    try {
      // Validate request
      await this.validateRequest(request);

      // Check cache first if enabled
      if (this.config.cachingEnabled && this.cache) {
        try {
          const cached = await this.checkCache(request);
          if (cached) {
            return {
              success: true,
              data: cached,
              metrics: {
                requestId: request.id,
                startTime: new Date(startTime),
                endTime: new Date(),
                durationMs: Date.now() - startTime,
                memoryUsed: process.memoryUsage().heapUsed,
                cacheHit: true,
                retryCount: 0,
                success: true
              }
            };
          }
        } catch (cacheError) {
          // Log cache error but continue with generation
          this.logger.warn('Cache error during retrieval', {
            requestId: request.id,
            error: cacheError instanceof Error ? cacheError.message : 'Unknown cache error'
          });
        }
      }

      // Set up abort controller for cancellation
      abortController = new AbortController();
      this.activeRequests.set(request.id, abortController);

      // Submit request to manager (if available)
      if (this.requestManager) {
        await this.requestManager.submitRequest(request);
      }

      // Find best generator
      const generator = await this.findBestGenerator(request.contentType, request.context);
      if (!generator) {
        throw ACGErrorFactory.createGeneratorNotFoundError({
          requestId: request.id,
          contentType: request.contentType,
          requestedCapabilities: [],
          availableGenerators: Array.from(this.generators.keys())
        });
      }

      // Generate content with retry logic
      const { result, attempts } = await this.generateWithRetry(
        generator,
        request,
        abortController.signal
      );
      retryCount = attempts - 1; // attempts includes the first try

      // Validate result if enabled
      if (this.config.validationEnabled) {
        let validation: ValidationResult;

        // Try generator validation first
        if ('validateContent' in generator && typeof (generator as any).validateContent === 'function') {
          validation = await (generator as any).validateContent(result);
        } else if ('validate' in generator && typeof generator.validate === 'function') {
          validation = await generator.validate(result);
        } else if (this.validator) {
          validation = await this.validator.validate(result);
        } else {
          // Default validation if no validator available
          validation = {
            isValid: true,
            score: 0.8,
            issues: [],
            suggestions: [],
            platformCompliance: {}
          };
        }

        result.validation = validation;

        if (!validation.isValid) {
          this.logger.warn('Generated content failed validation', {
            requestId: request.id,
            contentType: request.contentType,
            score: validation.score,
            issues: validation.issues
          });
        }
      }

      // Cache result if enabled
      if (this.config.cachingEnabled && this.cache) {
        try {
          await this.cacheResult(request, result);
        } catch (cacheError) {
          // Log cache error but don't fail the request
          this.logger.warn('Cache error during storage', {
            requestId: request.id,
            error: cacheError instanceof Error ? cacheError.message : 'Unknown cache error'
          });
        }
      }

      // Record metrics
      if (this.database) {
        await this.recordMetrics(
          generator.id,
          request.contentType,
          Date.now() - startTime,
          true
        );
      }

      return {
        success: true,
        data: result,
        metrics: {
          requestId: request.id,
          startTime: new Date(startTime),
          endTime: new Date(),
          durationMs: Date.now() - startTime,
          memoryUsed: process.memoryUsage().heapUsed,
          cacheHit: false,
          retryCount,
          success: true
        }
      };

    } catch (error) {
      // Capture retry count from error if available
      if (error instanceof Error && (error as any).retryCount !== undefined) {
        retryCount = (error as any).retryCount;
      }

      const errorResult = await this.handleGenerationError(error, request, startTime);
      // Create new metrics object with retry count instead of modifying readonly property
      return {
        ...errorResult,
        metrics: {
          ...errorResult.metrics,
          retryCount: retryCount
        }
      };
    } finally {
      // Clean up
      if (abortController) {
        this.activeRequests.delete(request.id);
      }
    }
  }

  async generateContentSimple(
    agentId: string,
    toolId: string,
    contentType: ContentType,
    context: GenerationContext,
    options?: GenerationOptions
  ): AsyncContentGenerationResult {
    const requestId = ulid();

    const request: ContentGenerationRequest = {
      id: requestId,
      agentId,
      toolId,
      contentType,
      context,
      priority: options?.priority ?? 5,
      deadline: options?.deadline,
      metadata: {
        createdAt: new Date(),
        userId: agentId, // Using agentId as userId for now
        source: 'direct',
        retryCount: 0
      }
    };

    return this.generateContent(request);
  }

  async validateContent(
    content: GeneratedContent,
    constraints?: ValidationConstraints
  ): Promise<ValidationResult> {
    // Try to find the appropriate generator for validation
    // Since GeneratedContent doesn't contain the original context, we use an empty context
    const generator = await this.findBestGenerator(content.type, {
      originalMessage: '',
      extractedEntities: {}
    });

    if (generator) {
      // Try generator validation first
      if ('validateContent' in generator && typeof (generator as any).validateContent === 'function') {
        return await (generator as any).validateContent(content);
      } else if ('validate' in generator && typeof generator.validate === 'function') {
        return await generator.validate(content);
      }
    }

    // Fall back to validator service if available
    if (this.validator) {
      return this.validator.validate(content, constraints);
    }

    // Default validation if no validator available
    return {
      isValid: true,
      score: 0.8,
      issues: [],
      suggestions: [],
      platformCompliance: {}
    };
  }

  async batchGenerateContent(
    requests: readonly ContentGenerationRequest[]
  ): Promise<ContentGenerationResult[]> {
    const results: ContentGenerationResult[] = [];
    const batchSize = this.config.batchSize || 10;

    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchPromises = batch.map(request => this.generateContent(request));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  async getGeneratorHealth(): Promise<Array<{
    generatorId: string;
    status: 'healthy' | 'unhealthy';
    responseTimeMs: number;
    lastCheck: Date;
    details: Record<string, any>;
  }>> {
    const healthChecks = [];

    for (const [id, generator] of this.generators) {
      try {
        const startTime = Date.now();
        let health: any;

        // Handle both getHealth (test mocks) and getHealthStatus (interface)
        if ('getHealth' in generator && typeof (generator as any).getHealth === 'function') {
          health = await (generator as any).getHealth();
        } else if ('getHealthStatus' in generator && typeof generator.getHealthStatus === 'function') {
          health = await generator.getHealthStatus();
        } else {
          // Default health status if no method available
          health = {
            status: 'healthy',
            dependencies: {},
            performance: {}
          };
        }

        const responseTime = Date.now() - startTime;

        healthChecks.push({
          generatorId: id,
          status: health.status || 'healthy',
          responseTimeMs: responseTime,
          lastCheck: new Date(),
          details: health.dependencies || health.details || {}
        });
      } catch (error) {
        healthChecks.push({
          generatorId: id,
          status: 'unhealthy' as const,
          responseTimeMs: -1,
          lastCheck: new Date(),
          details: {
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    }

    return healthChecks;
  }

  async registerGenerator(generator: IContentGenerator): Promise<void> {
    try {
      this.logger.info('Registering content generator', {
        generatorId: generator.id,
        name: generator.name,
        supportedTypes: generator.supportedTypes,
        capabilities: generator.capabilities
      });

      // Validate generator
      if (!generator.id || !generator.name || !generator.supportedTypes.length) {
        throw new Error('Invalid generator: missing required properties');
      }

      // Check for conflicts
      if (this.generators.has(generator.id)) {
        throw new Error(`Generator with ID ${generator.id} already registered`);
      }

      // Initialize if service is already initialized
      if (this.isInitialized) {
        const dependencies: GeneratorDependencies = {
          logger: this.logger,
          cache: this.cache,
          validator: this.validator
        };
        await generator.initialize(dependencies);
      }

      // Register generator
      this.generators.set(generator.id, generator);

      // Store in database
      if (this.database) {
        await this.database.createContentGeneratorRegistry({
          generatorId: generator.id,
          name: generator.name,
          version: generator.version,
          supportedTypes: JSON.stringify(generator.supportedTypes),
          capabilities: JSON.stringify(generator.capabilities),
          priority: generator.priority,
          enabled: generator.enabled,
          configuration: JSON.stringify(generator.configuration),
          healthStatus: 'healthy',
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          averageLatencyMs: 0.0,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      this.logger.info('Generator registered successfully', {
        generatorId: generator.id,
        totalGenerators: this.generators.size
      });

    } catch (error) {
      this.logger.error('Failed to register generator', error as Error, {
        generatorId: generator.id
      });
      throw error;
    }
  }

  async unregisterGenerator(generatorId: string): Promise<void> {
    try {
      const generator = this.generators.get(generatorId);
      if (!generator) {
        throw new Error(`Generator ${generatorId} not found`);
      }

      // Shutdown generator
      await generator.shutdown();

      // Remove from memory
      this.generators.delete(generatorId);

      // Update database
      if (this.database) {
        await this.database.updateContentGeneratorRegistry(generatorId, {
          enabled: false,
          updatedAt: new Date()
        });
      }

      this.logger.info('Generator unregistered successfully', {
        generatorId,
        remainingGenerators: this.generators.size
      });

    } catch (error) {
      this.logger.error('Failed to unregister generator', error as Error, {
        generatorId
      });
      throw error;
    }
  }

  async getAvailableGenerators(contentType: ContentType): Promise<readonly IContentGenerator[]> {
    this.logger.debug('Finding available generators', {
      contentType,
      totalGenerators: this.generators.size,
      allGeneratorIds: Array.from(this.generators.keys())
    });

    const allGenerators = Array.from(this.generators.values());
    this.logger.debug('All generators details', {
      generators: allGenerators.map(gen => ({
        id: gen.id,
        name: gen.name,
        enabled: gen.enabled,
        supportedTypes: gen.supportedTypes,
        supportsRequestedType: gen.supportedTypes.includes(contentType)
      }))
    });

    const generators = allGenerators
      .filter(g => {
        // Check if generator is enabled (default to true if not specified)
        const isEnabled = g.enabled !== undefined ? g.enabled : true;
        // Check if generator supports the content type
        const supportsType = g.supportedTypes.includes(contentType);

        this.logger.debug('Generator filter check', {
          generatorId: g.id,
          isEnabled,
          supportsType,
          willInclude: isEnabled && supportsType
        });

        return isEnabled && supportsType;
      })
      .sort((a, b) => {
        // Sort by priority (default to 1 if not specified)
        const priorityA = a.priority !== undefined ? a.priority : 1;
        const priorityB = b.priority !== undefined ? b.priority : 1;
        return priorityB - priorityA;
      });

    this.logger.info('Available generators found', {
      contentType,
      availableCount: generators.length,
      availableGenerators: generators.map(gen => ({
        id: gen.id,
        name: gen.name,
        priority: gen.priority
      }))
    });

    return generators;
  }

  async isSupported(contentType: ContentType, context: GenerationContext): Promise<boolean> {
    const generators = await this.getAvailableGenerators(contentType);

    for (const generator of generators) {
      if (await generator.canGenerate(contentType, context)) {
        return true;
      }
    }

    return false;
  }

  async getCapabilities(contentType: ContentType): Promise<readonly string[]> {
    const generators = await this.getAvailableGenerators(contentType);
    const capabilities = new Set<string>();

    for (const generator of generators) {
      for (const capability of generator.capabilities) {
        capabilities.add(capability);
      }
    }

    return Array.from(capabilities);
  }

  async cancelGeneration(requestId: ULID): Promise<boolean> {
    const abortController = this.activeRequests.get(requestId);
    if (abortController) {
      abortController.abort();
      this.activeRequests.delete(requestId);
      if (this.requestManager) {
        await this.requestManager.cancelRequest(requestId);
      }
      return true;
    }

    if (this.requestManager) {
      return this.requestManager.cancelRequest(requestId);
    }
    return false;
  }

  async getGenerationStatus(requestId: ULID): Promise<GenerationStatus> {
    if (this.requestManager) {
      return this.requestManager.getRequestStatus(requestId);
    }
    // Return default status if no request manager
    return {
      requestId,
      status: 'pending',
      progress: 0
    };
  }

  async generateBatch(
    requests: readonly ContentGenerationRequest[]
  ): AsyncContentGenerationResult<readonly GeneratedContent[]> {
    const startTime = Date.now();
    const results: GeneratedContent[] = [];
    const errors: Error[] = [];

    try {
      // Process in batches to avoid overwhelming the system
      const batchSize = this.config.batchSize;

      for (let i = 0; i < requests.length; i += batchSize) {
        const batch = requests.slice(i, i + batchSize);
        const batchPromises = batch.map(request =>
          this.generateContent(request).then(result => {
            if (result.success) {
              results.push(result.data);
            } else {
              errors.push(new Error(result.error.message));
            }
          })
        );

        await Promise.allSettled(batchPromises);
      }

      if (errors.length > 0 && results.length === 0) {
        // All failed
        throw new Error(`Batch generation failed: ${errors.map(e => e.message).join(', ')}`);
      }

      return {
        success: true,
        data: results,
        metrics: {
          requestId: ulid(),
          startTime: new Date(startTime),
          endTime: new Date(),
          durationMs: Date.now() - startTime,
          memoryUsed: process.memoryUsage().heapUsed,
          cacheHit: false,
          retryCount: 0,
          success: true
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: error instanceof ContentGenerationError ? error.code : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error instanceof ContentGenerationError ? error.context : {},
          requestId: requests.length > 0 ? requests[0].id : ulid(),
          timestamp: new Date(),
          recoverable: error instanceof ContentGenerationError ? error.retryable : false,
          retryAfter: error instanceof ContentGenerationError ? error.retryAfter : undefined
        },
        metrics: {
          requestId: ulid(),
          startTime: new Date(startTime),
          endTime: new Date(),
          durationMs: Date.now() - startTime,
          memoryUsed: process.memoryUsage().heapUsed,
          cacheHit: false,
          retryCount: 0,
          success: false
        }
      };
    }
  }

  async getMetrics(timeRange?: TimeRange): Promise<GenerationMetrics> {
    const end = timeRange?.end ?? new Date();
    const start = timeRange?.start ?? new Date(end.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

    if (!this.database) {
      // Return default metrics if no database
      const defaultContentTypeDistribution: Record<ContentType, number> = {
        [ContentType.EMAIL_SUBJECT]: 0,
        [ContentType.EMAIL_BODY]: 0,
        [ContentType.EMAIL_REPLY]: 0,
        [ContentType.EMAIL_FORWARD]: 0,
        [ContentType.DOCUMENT_TEXT]: 0,
        [ContentType.DOCUMENT_SPREADSHEET]: 0,
        [ContentType.DOCUMENT_PRESENTATION]: 0,
        [ContentType.SOCIAL_POST]: 0,
        [ContentType.SOCIAL_COMMENT]: 0,
        [ContentType.SOCIAL_MESSAGE]: 0,
        [ContentType.CALENDAR_EVENT]: 0,
        [ContentType.CALENDAR_AGENDA]: 0,
        [ContentType.CALENDAR_INVITE]: 0,
        [ContentType.CUSTOM_TEMPLATE]: 0
      };

      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageLatencyMs: 0,
        averageConfidenceScore: 0,
        cacheHitRate: 0,
        generatorUsage: {},
        contentTypeDistribution: defaultContentTypeDistribution,
        errorDistribution: {},
        timeRange: { start, end }
      };
    }

    const metrics = await this.database.getContentGenerationMetrics(start, end);

    return {
      totalRequests: metrics.totalRequests,
      successfulRequests: metrics.successfulRequests,
      failedRequests: metrics.failedRequests,
      averageLatencyMs: metrics.averageLatencyMs,
      averageConfidenceScore: metrics.averageConfidenceScore,
      cacheHitRate: metrics.cacheHitRate,
      generatorUsage: metrics.generatorUsage,
      contentTypeDistribution: metrics.contentTypeDistribution,
      errorDistribution: metrics.errorDistribution,
      timeRange: { start, end }
    };
  }

  async clearCache(contentType?: ContentType): Promise<void> {
    if (contentType) {
      await this.cache.clearByType(contentType);
    } else {
      await this.cache.clear();
    }
  }

  // ===== Private Helper Methods =====

  private async validateRequest(request: ContentGenerationRequest): Promise<void> {
    if (!request.id || !request.agentId || !request.toolId) {
      throw ACGErrorFactory.createInvalidRequestError(
        'Missing required fields: id, agentId, or toolId',
        {
          requestId: request.id || 'unknown',
          contentType: request.contentType || 'unknown',
          providedFields: {
            id: !!request.id,
            agentId: !!request.agentId,
            toolId: !!request.toolId
          }
        }
      );
    }

    if (!request.context.originalMessage?.trim()) {
      throw ACGErrorFactory.createInsufficientContextError({
        requestId: request.id,
        contentType: request.contentType,
        requiredContext: ['originalMessage'],
        providedContext: Object.keys(request.context)
      });
    }
  }

  private async checkCache(request: ContentGenerationRequest): Promise<GeneratedContent | null> {
    if (!this.cache) {
      return null;
    }
    const cacheKey = this.cache.generateKey(request.context);
    return this.cache.get(cacheKey);
  }

  private async cacheResult(request: ContentGenerationRequest, result: GeneratedContent): Promise<void> {
    if (!this.cache) {
      return;
    }
    const cacheKey = this.cache.generateKey(request.context);
    const ttl = 3600; // 1 hour
    await this.cache.set(cacheKey, result, ttl);
  }

  private async findBestGenerator(
    contentType: ContentType,
    context: GenerationContext
  ): Promise<IContentGenerator | null> {
    const generators = await this.getAvailableGenerators(contentType);

    for (const generator of generators) {
      if (await generator.canGenerate(contentType, context)) {
        return generator;
      }
    }

    return null;
  }

  private async generateWithRetry(
    generator: IContentGenerator,
    request: ContentGenerationRequest,
    signal: AbortSignal
  ): Promise<{ result: GeneratedContent; attempts: number }> {
    let lastError: Error | null = null;
    let attempt = 0;
    const maxAttempts = this.config.maxRetries + 1; // Initial attempt + retries

    while (attempt < maxAttempts) {
      attempt++;

      try {
        // Check for cancellation
        if (signal.aborted) {
          throw new Error('Generation cancelled');
        }

        // Generate content with timeout
        const result = await this.generateWithTimeout(generator, request, signal);

        if (result.success) {
          return { result: result.data, attempts: attempt };
        } else {
          throw result.error;
        }

      } catch (error) {
        lastError = error as Error;

        // Don't retry on the last attempt
        if (attempt >= maxAttempts) {
          break;
        }

        if (!isRetryableError(error) || !shouldRetry(error as ContentGenerationError, attempt, maxAttempts)) {
          break;
        }

        // Wait before retry
        const delay = getRetryDelay(error as ContentGenerationError, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Attach retry count to the error
    const finalError = lastError || new Error('Generation failed after all retries');
    (finalError as any).retryCount = attempt - 1; // attempt - 1 = number of retries
    throw finalError;
  }

  private async generateWithTimeout(
    generator: IContentGenerator,
    request: ContentGenerationRequest,
    signal: AbortSignal
  ): Promise<any> {
    return Promise.race([
      // Generation promise
      (async () => {
        // Handle both interface methods: generateContent (test mocks) and generate (interface)
        if ('generateContent' in generator && typeof (generator as any).generateContent === 'function') {
          // Use generateContent method (test mocks)
          return await (generator as any).generateContent(request);
        } else {
          // Use generate method (interface)
          return await generator.generate(request.context);
        }
      })(),

      // Timeout promise
      new Promise((_, reject) => {
        const timeoutId = setTimeout(() => {
          reject(ACGErrorFactory.createTimeoutError({
            requestId: request.id,
            contentType: request.contentType,
            timeoutMs: this.resolvedTimeoutMs
          }));
        }, this.resolvedTimeoutMs);

        // Clean up timeout if signal is aborted
        signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          reject(new Error('Generation cancelled'));
        });

        // Handle already aborted signal
        if (signal.aborted) {
          clearTimeout(timeoutId);
          reject(new Error('Generation cancelled'));
        }
      })
    ]);
  }

  private async handleGenerationError(
    error: unknown,
    request: ContentGenerationRequest,
    startTime: number
  ): Promise<ContentGenerationResult> {
    let generationError: ContentGenerationError;

    // Categorize the error properly
    if (error instanceof ContentGenerationError) {
      generationError = error;
    } else if (error instanceof Error) {
      // Check error message/type to determine appropriate error code
      if (error.message.includes('timeout') || error.message.includes('cancelled')) {
        generationError = ACGErrorFactory.createTimeoutError({
          requestId: request.id,
          contentType: request.contentType,
          timeoutMs: this.resolvedTimeoutMs
        });
      } else if (error.message.includes('Generation failed')) {
        generationError = ACGErrorFactory.createGenerationFailedError(
          error.message,
          {
            requestId: request.id,
            contentType: request.contentType,
            originalError: error
          }
        );
      } else {
        // Default to LLM error for unknown errors
        generationError = ACGErrorFactory.createLLMError(
          error.message,
          {
            requestId: request.id,
            contentType: request.contentType,
            cause: error
          }
        );
      }
    } else {
      // Unknown error type
      generationError = ACGErrorFactory.createLLMError(
        'Unknown error occurred during content generation',
        {
          requestId: request.id,
          contentType: request.contentType,
          cause: error as Error
        }
      );
    }

    // Log the error
    this.logger.error('Content generation failed', {
      requestId: request.id,
      contentType: request.contentType,
      agentId: request.agentId,
      toolId: request.toolId,
      durationMs: Date.now() - startTime,
      error: generationError.message,
      errorCode: generationError.code
    });

    // Report error if service is available
    if (this.errorService) {
      try {
        await this.errorService.handleError(generationError, {
          operation: 'content_generation',
          agentId: request.agentId,
          metadata: {
            requestId: request.id,
            contentType: request.contentType,
            toolId: request.toolId
          }
        });
      } catch (errorServiceError) {
        this.logger.warn('Failed to report error to error service', {
          originalError: generationError.message,
          errorServiceError: errorServiceError instanceof Error ? errorServiceError.message : 'Unknown'
        });
      }
    }

    return {
      success: false,
      error: {
        code: generationError.code,
        message: generationError.message,
        details: generationError.context,
        requestId: generationError.requestId,
        timestamp: generationError.timestamp,
        recoverable: generationError.retryable,
        retryAfter: generationError.retryAfter
      },
      metrics: {
        requestId: request.id,
        startTime: new Date(startTime),
        endTime: new Date(),
        durationMs: Date.now() - startTime,
        memoryUsed: process.memoryUsage().heapUsed,
        cacheHit: false,
        retryCount: 0,
        success: false
      }
    };
  }

  private async recordMetrics(
    generatorId: string,
    contentType: ContentType,
    durationMs: number,
    success: boolean
  ): Promise<void> {
    if (!this.config.metricsEnabled || !this.database) {
      return;
    }

    try {
      await this.database.recordContentGenerationMetrics({
        generatorId,
        contentType,
        durationMs,
        success,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('Failed to record metrics', error as Error, {
        generatorId,
        contentType,
        durationMs,
        success
      });
    }
  }

  private async recordCacheMetrics(
    generatorId: string,
    contentType: ContentType,
    hit: boolean
  ): Promise<void> {
    if (!this.config.metricsEnabled || !this.database) {
      return;
    }

    try {
      await this.database.recordCacheMetrics({
        generatorId,
        contentType,
        hit,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('Failed to record cache metrics', error as Error, {
        generatorId,
        contentType,
        hit
      });
    }
  }

  private async recordValidationMetrics(
    generatorId: string,
    contentType: ContentType,
    score: number
  ): Promise<void> {
    if (!this.config.metricsEnabled || !this.database) {
      return;
    }

    try {
      await this.database.recordValidationMetrics({
        generatorId,
        contentType,
        score,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('Failed to record validation metrics', error as Error, {
        generatorId,
        contentType,
        score
      });
    }
  }

  private async cleanupOldRequests(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - this.config.cleanupIntervalMs);

      if (this.requestManager) {
        const cleaned = await this.requestManager.cleanupOldRequests(cutoff);
        this.logger.info('Cleaned up old requests', {
          count: cleaned,
          cutoff: cutoff.toISOString()
        });
      }

      // Clean up active requests that are too old
      const activeRequestsToClean = [];
      for (const [requestId, controller] of this.activeRequests) {
        // Check if request is older than cleanup interval
        // Note: This is a simplified check - in production you'd want to track request start times
        activeRequestsToClean.push(requestId);
      }

      for (const requestId of activeRequestsToClean) {
        const controller = this.activeRequests.get(requestId);
        if (controller) {
          controller.abort();
          this.activeRequests.delete(requestId);
        }
      }

    } catch (error) {
      this.logger.error('Failed to cleanup old requests', error as Error);
    }
  }
} 