/**
 * IContentGenerator.ts - Interface for individual content generators
 * 
 * Defines the contract that all content generators must implement.
 * Supports various generation strategies and capabilities.
 */

import { ULID } from 'ulid';
import {
  ContentType,
  GenerationContext,
  GeneratedContent,
  ValidationResult,
  AsyncContentGenerationResult
} from '../types/ContentGenerationTypes';
import { GenerationCapability } from '../types/GenerationCapabilities';

// ===== Core Generator Interface =====

export interface IContentGenerator {
  /**
   * Unique identifier for this generator
   */
  readonly id: string;

  /**
   * Human-readable name for this generator
   */
  readonly name: string;

  /**
   * Version of this generator
   */
  readonly version: string;

  /**
   * Content types this generator can handle
   */
  readonly supportedTypes: readonly ContentType[];

  /**
   * Capabilities this generator provides
   */
  readonly capabilities: readonly GenerationCapability[];

  /**
   * Priority level (higher number = higher priority)
   */
  readonly priority: number;

  /**
   * Whether this generator is currently enabled
   */
  readonly enabled: boolean;

  /**
   * Configuration for this generator
   */
  readonly configuration: GeneratorConfiguration;

  /**
   * Generate content based on the provided context
   */
  generate(context: GenerationContext): AsyncContentGenerationResult;

  /**
   * Validate if this generator can handle the given context
   */
  canGenerate(contentType: ContentType, context: GenerationContext): Promise<boolean>;

  /**
   * Validate generated content
   */
  validate(content: GeneratedContent): Promise<ValidationResult>;

  /**
   * Get estimated generation time for the given context
   */
  estimateGenerationTime(context: GenerationContext): Promise<number>;

  /**
   * Initialize the generator with dependencies
   */
  initialize(dependencies: GeneratorDependencies): Promise<void>;

  /**
   * Cleanup resources when shutting down
   */
  shutdown(): Promise<void>;

  /**
   * Get current health status
   */
  getHealthStatus(): Promise<HealthStatus>;

  /**
   * Get usage statistics
   */
  getUsageStats(): Promise<GeneratorUsageStats>;
}

// ===== Generator Configuration =====

export interface GeneratorConfiguration {
  readonly maxRetries: number;
  readonly timeoutMs: number;
  readonly fallbackEnabled: boolean;
  readonly cachingEnabled: boolean;
  readonly validationEnabled: boolean;
  readonly qualityThreshold: number;
  readonly customSettings: Record<string, unknown>;
}

// ===== Generator Dependencies =====

export interface GeneratorDependencies {
  readonly logger: ILogger;
  readonly cache?: IContentCache;
  readonly validator?: IContentValidator;
  readonly templateEngine?: ITemplateEngine;
  readonly llmService?: ILLMService;
  readonly errorReporter?: IErrorReporter;
  readonly metricsCollector?: IMetricsCollector;
}

// ===== Supporting Interfaces =====

export interface ILogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export interface IContentCache {
  get(key: string): Promise<GeneratedContent | null>;
  set(key: string, content: GeneratedContent, ttl?: number): Promise<void>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  generateKey(context: GenerationContext): string;
}

export interface IContentValidator {
  validate(
    content: GeneratedContent,
    constraints?: ValidationConstraints
  ): Promise<ValidationResult>;

  validateText(
    text: string,
    rules?: readonly ValidationRule[]
  ): Promise<ValidationResult>;
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

export interface ITemplateEngine {
  render(
    templateId: ULID,
    variables: Record<string, unknown>
  ): Promise<string>;

  renderTemplate(
    template: string,
    variables: Record<string, unknown>
  ): Promise<string>;

  validateTemplate(template: string): Promise<TemplateValidationResult>;

  getAvailableTemplates(contentType: ContentType): Promise<readonly TemplateInfo[]>;
}

export interface TemplateValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly requiredVariables: readonly string[];
}

export interface TemplateInfo {
  readonly id: ULID;
  readonly name: string;
  readonly contentType: ContentType;
  readonly description?: string;
  readonly variables: readonly string[];
}

export interface ILLMService {
  generateResponse(
    prompt: string,
    options?: LLMGenerationOptions
  ): Promise<LLMResponse>;

  generateStructuredResponse<T>(
    prompt: string,
    schema: T,
    options?: LLMGenerationOptions
  ): Promise<LLMStructuredResponse<T>>;

  isAvailable(): Promise<boolean>;

  getModels(): Promise<readonly string[]>;
}

export interface LLMGenerationOptions {
  readonly model?: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly topP?: number;
  readonly stopSequences?: readonly string[];
  readonly timeoutMs?: number;
}

export interface LLMResponse {
  readonly content: string;
  readonly model: string;
  readonly tokensUsed: number;
  readonly finishReason: 'completed' | 'length' | 'stop' | 'timeout';
  readonly confidence?: number;
}

export interface LLMStructuredResponse<T> extends LLMResponse {
  readonly structuredData: T;
}

export interface IErrorReporter {
  reportError(
    error: Error,
    context: ErrorContext
  ): Promise<void>;

  reportWarning(
    message: string,
    context: ErrorContext
  ): Promise<void>;
}

export interface ErrorContext {
  readonly generatorId: string;
  readonly requestId: ULID;
  readonly contentType: ContentType;
  readonly operation: string;
  readonly metadata: Record<string, unknown>;
}

export interface IMetricsCollector {
  recordGeneration(
    generatorId: string,
    contentType: ContentType,
    durationMs: number,
    success: boolean
  ): Promise<void>;

  recordCacheHit(generatorId: string, contentType: ContentType): Promise<void>;

  recordCacheMiss(generatorId: string, contentType: ContentType): Promise<void>;

  recordValidation(
    generatorId: string,
    contentType: ContentType,
    score: number
  ): Promise<void>;
}

// ===== Health and Status =====

export interface HealthStatus {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly message?: string;
  readonly lastChecked: Date;
  readonly dependencies: Record<string, DependencyStatus>;
  readonly performance: PerformanceMetrics;
}

export interface DependencyStatus {
  readonly status: 'available' | 'unavailable' | 'degraded';
  readonly latencyMs?: number;
  readonly lastChecked: Date;
  readonly error?: string;
}

export interface PerformanceMetrics {
  readonly averageLatencyMs: number;
  readonly successRate: number;
  readonly requestsPerMinute: number;
  readonly memoryUsageMB: number;
}

export interface GeneratorUsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatencyMs: number;
  averageConfidenceScore: number;
  cacheHitRate: number;
  lastUsed?: Date;
  contentTypeDistribution: Record<ContentType, number>;
}

// ===== Specialized Generator Interfaces =====

export interface ILLMContentGenerator extends IContentGenerator {
  /**
   * LLM service used by this generator
   */
  readonly llmService: ILLMService;

  /**
   * Build prompt for the given context
   */
  buildPrompt(context: GenerationContext): Promise<string>;

  /**
   * Parse LLM response into structured content
   */
  parseResponse(response: LLMResponse, context: GenerationContext): Promise<GeneratedContent>;
}

export interface ITemplateContentGenerator extends IContentGenerator {
  /**
   * Template engine used by this generator
   */
  readonly templateEngine: ITemplateEngine;

  /**
   * Extract variables from context
   */
  extractVariables(context: GenerationContext): Promise<Record<string, unknown>>;

  /**
   * Select best template for the given context
   */
  selectTemplate(context: GenerationContext): Promise<ULID>;
}

export interface IHybridContentGenerator extends IContentGenerator {
  /**
   * LLM generator for intelligent content
   */
  readonly llmGenerator: ILLMContentGenerator;

  /**
   * Template generator for structured content
   */
  readonly templateGenerator: ITemplateContentGenerator;

  /**
   * Decide which generation method to use
   */
  selectGenerationMethod(context: GenerationContext): Promise<'llm' | 'template' | 'hybrid'>;

  /**
   * Combine LLM and template results
   */
  combineResults(
    llmResult: GeneratedContent,
    templateResult: GeneratedContent,
    context: GenerationContext
  ): Promise<GeneratedContent>;
}

// ===== Base Generator Class Interface =====

export interface IBaseContentGenerator extends IContentGenerator {
  /**
   * Set generator configuration
   */
  setConfiguration(config: Partial<GeneratorConfiguration>): Promise<void>;

  /**
   * Enable or disable the generator
   */
  setEnabled(enabled: boolean): Promise<void>;

  /**
   * Update generator priority
   */
  setPriority(priority: number): Promise<void>;

  /**
   * Add supported content type
   */
  addSupportedType(contentType: ContentType): Promise<void>;

  /**
   * Remove supported content type
   */
  removeSupportedType(contentType: ContentType): Promise<void>;

  /**
   * Add capability
   */
  addCapability(capability: GenerationCapability): Promise<void>;

  /**
   * Remove capability
   */
  removeCapability(capability: GenerationCapability): Promise<void>;
}

// ===== Generator Factory =====

export interface IContentGeneratorFactory {
  /**
   * Create an LLM-based generator
   */
  createLLMGenerator(
    id: string,
    name: string,
    supportedTypes: readonly ContentType[],
    llmService: ILLMService,
    config?: Partial<GeneratorConfiguration>
  ): Promise<ILLMContentGenerator>;

  /**
   * Create a template-based generator
   */
  createTemplateGenerator(
    id: string,
    name: string,
    supportedTypes: readonly ContentType[],
    templateEngine: ITemplateEngine,
    config?: Partial<GeneratorConfiguration>
  ): Promise<ITemplateContentGenerator>;

  /**
   * Create a hybrid generator
   */
  createHybridGenerator(
    id: string,
    name: string,
    supportedTypes: readonly ContentType[],
    llmGenerator: ILLMContentGenerator,
    templateGenerator: ITemplateContentGenerator,
    config?: Partial<GeneratorConfiguration>
  ): Promise<IHybridContentGenerator>;

  /**
   * Create a custom generator
   */
  createCustomGenerator(
    generatorClass: new () => IContentGenerator,
    config: GeneratorConfiguration
  ): Promise<IContentGenerator>;
} 