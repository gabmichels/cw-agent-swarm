/**
 * NotionService.ts
 * Enhanced Notion Integration Service
 * Following IMPLEMENTATION_GUIDELINES.md principles
 */

import { ulid } from 'ulid';
import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios';
import { logger } from '../../../lib/logging';
import {
  NotionPage,
  NotionDatabase,
  NotionBlock,
  NotionQueryParams,
  NotionQueryResponse,
  DatabaseSchema,
  PageCreationParams,
  NotionServiceResponse,
  NotionHealthStatus,
  NotionServiceConfig,
  createNotionServiceResponse,
  createNotionServiceError,
  NotionFilter,
  NotionSort,
  NotionParent,
  NotionProperty
} from './interfaces/NotionInterfaces';
import {
  NotionError,
  NotionApiError,
  NotionAuthenticationError,
  NotionAuthorizationError,
  NotionValidationError,
  NotionConfigurationError,
  NotionNetworkError,
  NotionTimeoutError,
  NotionRateLimitError,
  NotionResourceNotFoundError,
  NotionResourceConflictError,
  NotionErrorCategory,
  createNotionApiError,
  createNotionValidationError,
  createNotionResourceNotFoundError,
  categorizeNotionError
} from './errors/NotionErrors';

// Rate limiting state
interface RateLimitState {
  readonly requests: number;
  readonly resetTime: Date;
  readonly remaining: number;
  readonly retryAfter?: number;
}

// Request retry configuration
interface RetryConfig {
  readonly maxAttempts: number;
  readonly baseDelay: number;
  readonly maxDelay: number;
  readonly backoffMultiplier: number;
}

// Extended health status for internal use
interface ExtendedNotionHealthStatus extends NotionHealthStatus {
  readonly rateLimitStatus: {
    readonly remaining: number;
    readonly resetTime: Date;
    readonly retryAfter?: number;
  };
}

/**
 * Enhanced Notion Service for comprehensive integration
 * Implements dependency injection, immutable data structures, and comprehensive error handling
 */
export class NotionService {
  private readonly config: NotionServiceConfig;
  private readonly retryConfig: RetryConfig;
  private readonly client: AxiosInstance;
  private rateLimitState: RateLimitState;
  private healthStatus: ExtendedNotionHealthStatus;

  constructor(
    config: NotionServiceConfig,
    retryConfig: RetryConfig = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2
    }
  ) {
    this.validateConfig(config);
    this.config = Object.freeze({ ...config });
    this.retryConfig = Object.freeze({ ...retryConfig });
    
    this.client = this.createAxiosInstance();
    this.rateLimitState = this.initializeRateLimitState();
    this.healthStatus = this.initializeHealthStatus();

    logger.info('NotionService initialized', { 
      serviceId: ulid(),
      hasApiKey: !!config.apiKey,
      baseUrl: config.baseUrl || 'https://api.notion.com'
    });
  }

  /**
   * Create a new page in Notion
   */
  async createPage(params: PageCreationParams): Promise<NotionServiceResponse<NotionPage>> {
    const requestId = ulid();
    
    try {
      this.validatePageCreationParams(params);
      await this.checkRateLimit();

      const response = await this.executeWithRetry(
        () => this.client.post('/v1/pages', params)
      );

      const page = response.data as NotionPage;
      this.updateRateLimitState(response.headers as Record<string, string>);

      logger.info('Page created successfully', {
        requestId,
        pageId: page.id,
        parentType: params.parent.type
      });

      return createNotionServiceResponse(true, page);
    } catch (error) {
      return this.handleError(error, requestId, 'createPage', { params });
    }
  }

  /**
   * Query a database for pages
   */
  async queryDatabase(
    databaseId: string,
    params?: NotionQueryParams
  ): Promise<NotionServiceResponse<NotionQueryResponse<NotionPage>>> {
    const requestId = ulid();
    
    try {
      this.validateDatabaseId(databaseId);
      await this.checkRateLimit();

      const queryParams = {
        page_size: 100,
        ...params
      };

      const response = await this.executeWithRetry(
        () => this.client.post(`/v1/databases/${databaseId}/query`, queryParams)
      );

      const queryResponse = response.data as NotionQueryResponse<NotionPage>;
      this.updateRateLimitState(response.headers as Record<string, string>);

      logger.info('Database queried successfully', {
        requestId,
        databaseId,
        resultCount: queryResponse.results.length,
        hasMore: queryResponse.has_more
      });

      return createNotionServiceResponse(true, queryResponse);
    } catch (error) {
      return this.handleError(error, requestId, 'queryDatabase', { databaseId, params });
    }
  }

  /**
   * Create a new database
   */
  async createDatabase(schema: DatabaseSchema): Promise<NotionServiceResponse<NotionDatabase>> {
    const requestId = ulid();
    
    try {
      this.validateDatabaseSchema(schema);
      await this.checkRateLimit();

      const createRequest = {
        parent: schema.parent,
        title: [{ type: 'text', text: { content: schema.title } }],
        properties: schema.properties,
        ...(schema.description && {
          description: [{ type: 'text', text: { content: schema.description } }]
        }),
        ...(schema.icon && { icon: schema.icon }),
        ...(schema.cover && { cover: schema.cover })
      };

      const response = await this.executeWithRetry(
        () => this.client.post('/v1/databases', createRequest)
      );

      const database = response.data as NotionDatabase;
      this.updateRateLimitState(response.headers as Record<string, string>);

      logger.info('Database created successfully', {
        requestId,
        databaseId: database.id,
        title: schema.title,
        propertyCount: Object.keys(schema.properties).length
      });

      return createNotionServiceResponse(true, database);
    } catch (error) {
      return this.handleError(error, requestId, 'createDatabase', { schema });
    }
  }

  /**
   * Retrieve a page by ID
   */
  async getPage(pageId: string): Promise<NotionServiceResponse<NotionPage>> {
    const requestId = ulid();
    
    try {
      this.validatePageId(pageId);
      await this.checkRateLimit();

      const response = await this.executeWithRetry(
        () => this.client.get(`/v1/pages/${pageId}`)
      );

      const page = response.data as NotionPage;
      this.updateRateLimitState(response.headers as Record<string, string>);

      logger.info('Page retrieved successfully', { requestId, pageId });

      return createNotionServiceResponse(true, page);
    } catch (error) {
      return this.handleError(error, requestId, 'getPage', { pageId });
    }
  }

  /**
   * Retrieve a database by ID
   */
  async getDatabase(databaseId: string): Promise<NotionServiceResponse<NotionDatabase>> {
    const requestId = ulid();
    
    try {
      this.validateDatabaseId(databaseId);
      await this.checkRateLimit();

      const response = await this.executeWithRetry(
        () => this.client.get(`/v1/databases/${databaseId}`)
      );

      const database = response.data as NotionDatabase;
      this.updateRateLimitState(response.headers as Record<string, string>);

      logger.info('Database retrieved successfully', {
        requestId,
        databaseId,
        title: database.title
      });

      return createNotionServiceResponse(true, database);
    } catch (error) {
      return this.handleError(error, requestId, 'getDatabase', { databaseId });
    }
  }

  /**
   * Update a page's properties
   */
  async updatePage(
    pageId: string,
    properties: Record<string, NotionProperty>
  ): Promise<NotionServiceResponse<NotionPage>> {
    const requestId = ulid();
    
    try {
      this.validatePageId(pageId);
      this.validateProperties(properties);
      await this.checkRateLimit();

      const updateRequest = { properties };

      const response = await this.executeWithRetry(
        () => this.client.patch(`/v1/pages/${pageId}`, updateRequest)
      );

      const page = response.data as NotionPage;
      this.updateRateLimitState(response.headers as Record<string, string>);

      logger.info('Page updated successfully', {
        requestId,
        pageId,
        updatedProperties: Object.keys(properties)
      });

      return createNotionServiceResponse(true, page);
    } catch (error) {
      return this.handleError(error, requestId, 'updatePage', { pageId, properties });
    }
  }

  /**
   * Get children blocks of a page or block
   */
  async getBlockChildren(blockId: string): Promise<NotionServiceResponse<NotionQueryResponse<NotionBlock>>> {
    const requestId = ulid();
    
    try {
      this.validateBlockId(blockId);
      await this.checkRateLimit();

      const response = await this.executeWithRetry(
        () => this.client.get(`/v1/blocks/${blockId}/children`)
      );

      const blocksResponse = response.data as NotionQueryResponse<NotionBlock>;
      this.updateRateLimitState(response.headers as Record<string, string>);

      logger.info('Block children retrieved successfully', {
        requestId,
        blockId,
        childCount: blocksResponse.results.length
      });

      return createNotionServiceResponse(true, blocksResponse);
    } catch (error) {
      return this.handleError(error, requestId, 'getBlockChildren', { blockId });
    }
  }

  /**
   * Search for pages and databases
   */
  async search(
    query: string,
    filter?: { property: string; value: string }
  ): Promise<NotionServiceResponse<NotionQueryResponse<NotionPage | NotionDatabase>>> {
    const requestId = ulid();
    
    try {
      this.validateSearchQuery(query);
      await this.checkRateLimit();

      const searchRequest = {
        query,
        ...(filter && { filter }),
        page_size: 100
      };

      const response = await this.executeWithRetry(
        () => this.client.post('/v1/search', searchRequest)
      );

      const searchResponse = response.data as NotionQueryResponse<NotionPage | NotionDatabase>;
      this.updateRateLimitState(response.headers as Record<string, string>);

      logger.info('Search completed successfully', {
        requestId,
        query,
        resultCount: searchResponse.results.length
      });

      return createNotionServiceResponse(true, searchResponse);
    } catch (error) {
      return this.handleError(error, requestId, 'search', { query, filter });
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<NotionHealthStatus> {
    const startTime = Date.now();
    
    try {
      // Perform a lightweight health check
      await this.executeWithRetry(
        () => this.client.get('/v1/users/me')
      );

      const responseTime = Date.now() - startTime;

      this.healthStatus = {
        isHealthy: true,
        lastChecked: new Date(),
        responseTime,
        errorCount: 0,
        rateLimitStatus: {
          remaining: this.rateLimitState.remaining,
          resetTime: this.rateLimitState.resetTime,
          retryAfter: this.rateLimitState.retryAfter
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      this.healthStatus = {
        isHealthy: false,
        lastChecked: new Date(),
        responseTime,
        errorCount: this.healthStatus.errorCount + 1,
        rateLimitStatus: {
          remaining: this.rateLimitState.remaining,
          resetTime: this.rateLimitState.resetTime,
          retryAfter: this.rateLimitState.retryAfter
        }
      };

      logger.error('Health check failed', { error });
    }

    return Object.freeze({ 
      isHealthy: this.healthStatus.isHealthy,
      lastChecked: this.healthStatus.lastChecked,
      responseTime: this.healthStatus.responseTime,
      errorCount: this.healthStatus.errorCount,
      rateLimitStatus: {
        remaining: this.healthStatus.rateLimitStatus.remaining,
        resetTime: this.healthStatus.rateLimitStatus.resetTime
      }
    });
  }

  // Private helper methods

  private createAxiosInstance(): AxiosInstance {
    const instance = axios.create({
      baseURL: this.config.baseUrl || 'https://api.notion.com',
      timeout: this.config.timeout || 30000,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      }
    });

    // Add response interceptor for rate limit handling
    instance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || '60');
          this.rateLimitState = {
            ...this.rateLimitState,
            retryAfter: retryAfter * 1000 // Convert to milliseconds
          };
        }
        return Promise.reject(error);
      }
    );

    return instance;
  }

  private initializeRateLimitState(): RateLimitState {
    return {
      requests: 0,
      resetTime: new Date(Date.now() + 60000), // 1 minute from now
      remaining: 1000 // Notion's default rate limit
    };
  }

  private initializeHealthStatus(): ExtendedNotionHealthStatus {
    return {
      isHealthy: true,
      lastChecked: new Date(),
      responseTime: 0,
      errorCount: 0,
      rateLimitStatus: {
        remaining: 1000,
        resetTime: new Date(Date.now() + 60000)
      }
    };
  }

  private async checkRateLimit(): Promise<void> {
    const buffer = this.config.rateLimitBuffer || 10;
    
    if (this.rateLimitState.remaining <= buffer) {
      const waitTime = Math.max(0, this.rateLimitState.resetTime.getTime() - Date.now());
      if (waitTime > 0) {
        logger.warn('Rate limit approaching, waiting', { 
          waitTime, 
          remaining: this.rateLimitState.remaining 
        });
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    if (this.rateLimitState.retryAfter) {
      logger.warn('Rate limit exceeded, waiting for retry', { 
        retryAfter: this.rateLimitState.retryAfter 
      });
      await new Promise(resolve => setTimeout(resolve, this.rateLimitState.retryAfter));
      this.rateLimitState = { ...this.rateLimitState, retryAfter: undefined };
    }
  }

  private updateRateLimitState(headers: Record<string, string>): void {
    const remaining = parseInt(headers['x-ratelimit-remaining'] || '1000');
    const reset = parseInt(headers['x-ratelimit-reset'] || String(Math.floor(Date.now() / 1000) + 60));

    this.rateLimitState = {
      requests: this.rateLimitState.requests + 1,
      resetTime: new Date(reset * 1000),
      remaining: Math.max(0, remaining - 1)
    };
  }

  private async executeWithRetry<T>(operation: () => Promise<AxiosResponse<T>>): Promise<AxiosResponse<T>> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === this.retryConfig.maxAttempts) {
          break;
        }

        const notionError = this.convertToNotionError(error);
        if (this.shouldRetryError(notionError, attempt)) {
          const delay = this.getRetryDelay(notionError, attempt);
          
          logger.warn('Retrying Notion API request', { 
            attempt, 
            delay, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          break;
        }
      }
    }

    throw lastError!;
  }

  private shouldRetryError(error: NotionError, attempt: number): boolean {
    if (attempt >= this.retryConfig.maxAttempts) return false;
    
    const category = categorizeNotionError(error);
    
    switch (category) {
      case NotionErrorCategory.RATE_LIMIT:
      case NotionErrorCategory.NETWORK:
      case NotionErrorCategory.SERVICE:
        return true;
      default:
        return false;
    }
  }

  private getRetryDelay(error: NotionError, attempt: number): number {
    const baseDelay = this.retryConfig.baseDelay;
    const maxDelay = this.retryConfig.maxDelay;
    
    if (error instanceof NotionRateLimitError && error.retryAfter) {
      return Math.min(error.retryAfter * 1000, maxDelay);
    }
    
    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, maxDelay);
  }

  private convertToNotionError(error: unknown): NotionError {
    if (error instanceof NotionError) {
      return error;
    }

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const responseData = axiosError.response?.data as any;
      const message = responseData?.message || axiosError.message;

      switch (status) {
        case 401:
          return new NotionAuthenticationError(message);
        case 403:
          return new NotionAuthorizationError(message);
        case 404:
          return new NotionResourceNotFoundError(message);
        case 400:
          return new NotionValidationError(message);
        case 429:
          const retryAfter = parseInt(axiosError.response?.headers?.['retry-after'] || '60');
          return new NotionRateLimitError(message, retryAfter);
        case 409:
          return new NotionResourceConflictError(message);
        default:
          if (status && status >= 500) {
            return createNotionApiError(message, status);
          }
          return new NotionNetworkError(message);
      }
    }

    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        return new NotionTimeoutError(error.message);
      }
      return new NotionNetworkError(error.message);
    }

    return new NotionNetworkError('Unknown network error');
  }

  private handleError(
    error: unknown,
    requestId: string,
    operation: string,
    context?: Record<string, unknown>
  ): NotionServiceResponse<any> {
    const notionError = this.convertToNotionError(error);
    
    logger.error('Notion service operation failed', {
      requestId,
      operation,
      errorId: notionError.id,
      errorType: notionError.constructor.name,
      message: notionError.message,
      context
    });

    return createNotionServiceResponse(
      false,
      undefined,
      createNotionServiceError(
        notionError.constructor.name,
        notionError.message,
        { errorId: notionError.id, context }
      )
    );
  }

  // Validation methods
  private validateConfig(config: NotionServiceConfig): void {
    if (!config.apiKey?.trim()) {
      throw new NotionConfigurationError('API key is required');
    }
    
    if (config.timeout && config.timeout < 1000) {
      throw new NotionConfigurationError('Timeout must be at least 1000ms');
    }
    
    if (config.retryAttempts && (config.retryAttempts < 1 || config.retryAttempts > 10)) {
      throw new NotionConfigurationError('Retry attempts must be between 1 and 10');
    }
  }

  private validatePageCreationParams(params: PageCreationParams): void {
    if (!params.parent) {
      throw createNotionValidationError('Parent is required for page creation');
    }
    
    if (!params.properties || Object.keys(params.properties).length === 0) {
      throw createNotionValidationError('Properties are required for page creation');
    }
  }

  private validateDatabaseSchema(schema: DatabaseSchema): void {
    if (!schema.title?.trim()) {
      throw createNotionValidationError('Database title is required');
    }
    
    if (!schema.properties || Object.keys(schema.properties).length === 0) {
      throw createNotionValidationError('Database properties are required');
    }
    
    if (!schema.parent) {
      throw createNotionValidationError('Database parent is required');
    }
  }

  private validateDatabaseId(databaseId: string): void {
    if (!databaseId?.trim()) {
      throw createNotionValidationError('Database ID is required');
    }
  }

  private validatePageId(pageId: string): void {
    if (!pageId?.trim()) {
      throw createNotionValidationError('Page ID is required');
    }
  }

  private validateBlockId(blockId: string): void {
    if (!blockId?.trim()) {
      throw createNotionValidationError('Block ID is required');
    }
  }

  private validateProperties(properties: Record<string, NotionProperty>): void {
    if (!properties || Object.keys(properties).length === 0) {
      throw createNotionValidationError('Properties are required');
    }
  }

  private validateSearchQuery(query: string): void {
    if (!query?.trim()) {
      throw createNotionValidationError('Search query is required');
    }
  }
} 