/**
 * IContentGenerationService.ts - Main interface for Agent Content Generation service
 * 
 * Defines the contract for content generation operations across all agent tools.
 * Follows dependency injection principles with strict typing.
 */

import { ULID } from 'ulid';
import {
  ContentGenerationRequest,
  GeneratedContent,
  ContentType,
  GenerationContext,
  ValidationResult,
  ContentGenerationResult,
  AsyncContentGenerationResult
} from '../types/ContentGenerationTypes';
import { IContentGenerator } from './IContentGenerator';

// ===== Main Service Interface =====

export interface IContentGenerationService {
  /**
   * Generate content based on the provided request
   */
  generateContent(request: ContentGenerationRequest): AsyncContentGenerationResult;

  /**
   * Generate content with simplified parameters (convenience method)
   */
  generateContentSimple(
    agentId: string,
    toolId: string,
    contentType: ContentType,
    context: GenerationContext,
    options?: GenerationOptions
  ): AsyncContentGenerationResult;

  /**
   * Validate generated content against quality and platform constraints
   */
  validateContent(
    content: GeneratedContent,
    constraints?: ValidationConstraints
  ): Promise<ValidationResult>;

  /**
   * Register a content generator with the service
   */
  registerGenerator(generator: IContentGenerator): Promise<void>;

  /**
   * Unregister a content generator from the service
   */
  unregisterGenerator(generatorId: string): Promise<void>;

  /**
   * Get available generators for a specific content type
   */
  getAvailableGenerators(contentType: ContentType): Promise<readonly IContentGenerator[]>;

  /**
   * Check if content generation is supported for the given type and context
   */
  isSupported(contentType: ContentType, context: GenerationContext): Promise<boolean>;

  /**
   * Get generation capabilities for a specific content type
   */
  getCapabilities(contentType: ContentType): Promise<readonly string[]>;

  /**
   * Cancel an ongoing generation request
   */
  cancelGeneration(requestId: ULID): Promise<boolean>;

  /**
   * Get the status of a generation request
   */
  getGenerationStatus(requestId: ULID): Promise<GenerationStatus>;

  /**
   * Batch generate multiple content pieces
   */
  generateBatch(requests: readonly ContentGenerationRequest[]): AsyncContentGenerationResult<readonly GeneratedContent[]>;

  /**
   * Get generation metrics and performance data
   */
  getMetrics(timeRange?: TimeRange): Promise<GenerationMetrics>;

  /**
   * Clear cache for a specific content type or all content
   */
  clearCache(contentType?: ContentType): Promise<void>;
}

// ===== Supporting Interfaces =====

export interface GenerationOptions {
  readonly priority?: number;
  readonly deadline?: Date;
  readonly fallbackEnabled?: boolean;
  readonly validationEnabled?: boolean;
  readonly cachingEnabled?: boolean;
  readonly retryEnabled?: boolean;
  readonly maxRetries?: number;
  readonly timeoutMs?: number;
}

export interface ValidationConstraints {
  readonly platform?: string;
  readonly maxLength?: number;
  readonly minLength?: number;
  readonly requiredElements?: readonly string[];
  readonly forbiddenElements?: readonly string[];
  readonly qualityThreshold?: number;
  readonly customRules?: readonly ValidationRule[];
}

export interface ValidationRule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly pattern?: string;
  readonly validator: (content: string) => boolean;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface GenerationStatus {
  readonly requestId: ULID;
  readonly status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  readonly progress?: number; // 0-100
  readonly estimatedTimeRemaining?: number; // milliseconds
  readonly generatorUsed?: string;
  readonly error?: string;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
}

export interface TimeRange {
  readonly start: Date;
  readonly end: Date;
}

export interface GenerationMetrics {
  readonly totalRequests: number;
  readonly successfulRequests: number;
  readonly failedRequests: number;
  readonly averageLatencyMs: number;
  readonly averageConfidenceScore: number;
  readonly cacheHitRate: number;
  readonly generatorUsage: Record<string, number>;
  readonly contentTypeDistribution: Record<ContentType, number>;
  readonly errorDistribution: Record<string, number>;
  readonly timeRange: TimeRange;
}

// ===== Generator Registry Interface =====

export interface IGeneratorRegistry {
  /**
   * Register a new content generator
   */
  register(generator: IContentGenerator): Promise<void>;

  /**
   * Unregister a content generator
   */
  unregister(generatorId: string): Promise<void>;

  /**
   * Find the best generator for a given content type and context
   */
  findBestGenerator(
    contentType: ContentType,
    context: GenerationContext,
    requirements?: readonly string[]
  ): Promise<IContentGenerator | null>;

  /**
   * Get all generators supporting a specific content type
   */
  getGenerators(contentType: ContentType): Promise<readonly IContentGenerator[]>;

  /**
   * Get all registered generators
   */
  getAllGenerators(): Promise<readonly IContentGenerator[]>;

  /**
   * Check if a generator is registered
   */
  isRegistered(generatorId: string): Promise<boolean>;

  /**
   * Get generator by ID
   */
  getGenerator(generatorId: string): Promise<IContentGenerator | null>;

  /**
   * Update generator configuration
   */
  updateGenerator(generatorId: string, updates: Partial<IContentGenerator>): Promise<void>;
}

// ===== Request Manager Interface =====

export interface IGenerationRequestManager {
  /**
   * Submit a new generation request
   */
  submitRequest(request: ContentGenerationRequest): Promise<ULID>;

  /**
   * Get request status
   */
  getRequestStatus(requestId: ULID): Promise<GenerationStatus>;

  /**
   * Cancel a pending or in-progress request
   */
  cancelRequest(requestId: ULID): Promise<boolean>;

  /**
   * Get request result if completed
   */
  getRequestResult(requestId: ULID): Promise<GeneratedContent | null>;

  /**
   * Clean up completed requests older than specified time
   */
  cleanupOldRequests(olderThan: Date): Promise<number>;

  /**
   * Get all active requests
   */
  getActiveRequests(): Promise<readonly GenerationStatus[]>;

  /**
   * Get request history for an agent
   */
  getRequestHistory(agentId: string, limit?: number): Promise<readonly GenerationStatus[]>;
}

// ===== Cache Interface =====

export interface IContentCache {
  /**
   * Get cached content by key
   */
  get(key: string): Promise<GeneratedContent | null>;

  /**
   * Store content in cache
   */
  set(key: string, content: GeneratedContent, ttl?: number): Promise<void>;

  /**
   * Check if content exists in cache
   */
  has(key: string): Promise<boolean>;

  /**
   * Delete content from cache
   */
  delete(key: string): Promise<boolean>;

  /**
   * Clear all cached content
   */
  clear(): Promise<void>;

  /**
   * Clear cache for specific content type
   */
  clearByType(contentType: ContentType): Promise<void>;

  /**
   * Get cache statistics
   */
  getStats(): Promise<CacheStats>;

  /**
   * Generate cache key for request
   */
  generateKey(request: ContentGenerationRequest): string;
}

export interface CacheStats {
  readonly totalEntries: number;
  readonly hitRate: number;
  readonly missRate: number;
  readonly memoryUsage: number;
  readonly oldestEntry?: Date;
  readonly newestEntry?: Date;
}

// ===== Service Configuration =====

export interface ContentGenerationServiceConfig {
  readonly maxConcurrentRequests: number;
  readonly defaultTimeoutMs: number;
  readonly maxRetries: number;
  readonly cachingEnabled: boolean;
  readonly validationEnabled: boolean;
  readonly metricsEnabled: boolean;
  readonly fallbackEnabled: boolean;
  readonly batchSize: number;
  readonly cleanupIntervalMs: number;
  readonly requestHistoryLimit: number;
}

// ===== Service Factory =====

export interface IContentGenerationServiceFactory {
  /**
   * Create a new content generation service instance
   */
  createService(config: ContentGenerationServiceConfig): Promise<IContentGenerationService>;

  /**
   * Create service with default configuration
   */
  createDefaultService(): Promise<IContentGenerationService>;

  /**
   * Get singleton service instance
   */
  getInstance(): Promise<IContentGenerationService>;
} 