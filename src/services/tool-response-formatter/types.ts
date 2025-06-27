/**
 * Type definitions for LLM-based Tool Response Formatter
 * 
 * This module defines all interfaces and types for the unified, LLM-powered
 * response formatting system that provides persona-driven, conversational
 * responses for tool executions.
 * 
 * Follows implementation guidelines:
 * - ULID for all IDs  
 * - Strict typing (no 'any' types)
 * - Immutable data patterns
 * - Interface-first design
 */

import { PersonaInfo } from '../../agents/shared/messaging/PromptFormatter';
import { ToolExecutionResult } from '../../lib/tools/types';

/**
 * ULID type for type safety
 */
export type ULID = string;

/**
 * Primary service interface for LLM-based tool response formatting
 */
export interface IToolResponseFormatter {
  /**
   * Format tool execution result into conversational response
   * @param context - Complete context for response generation
   * @returns Promise resolving to formatted response with metadata
   * @throws {ToolResponseFormattingError} If formatting fails
   */
  formatResponse(context: ToolResponseContext): Promise<FormattedToolResponse>;

  /**
   * Get available response styles for a tool category
   * @param category - Tool category identifier
   * @returns Available response style configurations
   */
  getAvailableStyles(category: ToolCategory): Promise<readonly ResponseStyle[]>;
}

/**
 * Comprehensive context for tool response formatting
 */
export interface ToolResponseContext {
  readonly id: ULID;
  readonly timestamp: Date;

  // Tool execution context
  readonly toolResult: ToolExecutionResult;
  readonly toolCategory: ToolCategory;
  readonly executionIntent: string;
  readonly originalUserMessage: string;

  // Agent context
  readonly agentId: string;
  readonly agentPersona: PersonaInfo;
  readonly agentCapabilities: readonly string[];

  // User context
  readonly userId: string;
  readonly userPreferences: MessagePreferences;
  readonly conversationHistory: readonly RecentMessage[];

  // Configuration
  readonly responseConfig: ToolResponseConfig;
  readonly fallbackEnabled: boolean;
}

/**
 * Formatted response with quality metadata
 */
export interface FormattedToolResponse {
  readonly id: ULID;
  readonly content: string;
  readonly responseStyle: ResponseStyleType;
  readonly generationMetrics: ResponseGenerationMetrics;
  readonly qualityScore: number;
  readonly fallbackUsed: boolean;
  readonly timestamp: Date;
}

/**
 * Tool categories for response customization
 */
export enum ToolCategory {
  WORKSPACE = 'workspace',
  SOCIAL_MEDIA = 'social_media',
  EXTERNAL_API = 'external_api',
  WORKFLOW = 'workflow',
  RESEARCH = 'research',
  CUSTOM = 'custom'
}

/**
 * Response style types
 */
export type ResponseStyleType = 'technical' | 'conversational' | 'business' | 'casual';

/**
 * Response style configuration
 */
export interface ResponseStyle {
  readonly name: ResponseStyleType;
  readonly description: string;
  readonly templateId: string;
  readonly characteristics: readonly string[];
}

/**
 * Response generation configuration
 */
export interface ToolResponseConfig {
  readonly enableLLMFormatting: boolean;
  readonly maxResponseLength: number;
  readonly includeEmojis: boolean;
  readonly includeNextSteps: boolean;
  readonly includeMetrics: boolean;
  readonly responseStyle: ResponseStyleType;
  readonly enableCaching: boolean;
  readonly cacheTTLSeconds: number;
  readonly toolCategoryOverrides: Readonly<Record<string, Partial<ToolResponseConfig>>>;
}

/**
 * User message preferences
 */
export interface MessagePreferences {
  readonly preferredTone: 'professional' | 'friendly' | 'casual' | 'technical';
  readonly maxMessageLength: number;
  readonly enableEmojis: boolean;
  readonly includeMetrics: boolean;
  readonly communicationStyle: 'concise' | 'detailed' | 'conversational';
}

/**
 * Recent conversation message
 */
export interface RecentMessage {
  readonly id: ULID;
  readonly sender: 'user' | 'agent' | 'system';
  readonly content: string;
  readonly timestamp: Date;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * Response generation metrics
 */
export interface ResponseGenerationMetrics {
  readonly generationTime: number;
  readonly promptTokens: number;
  readonly responseTokens: number;
  readonly cacheHit: boolean;
  readonly llmModel?: string;
  readonly temperature?: number;
}

/**
 * Tool response prompt template configuration
 */
export interface ToolResponsePromptTemplate {
  readonly id: string;
  readonly category: ToolCategory;
  readonly style: ResponseStyleType;
  readonly systemPrompt: string;
  readonly successTemplate: string;
  readonly errorTemplate: string;
  readonly partialSuccessTemplate: string;
  readonly enabled: boolean;
  readonly priority: number;
}

/**
 * Response quality assessment
 */
export interface ResponseQualityMetrics {
  readonly contextRelevance: number;
  readonly personaConsistency: number;
  readonly clarityScore: number;
  readonly actionabilityScore: number;
  readonly overallScore: number;
}

/**
 * Prompt template service interface
 */
export interface IPromptTemplateService {
  /**
   * Get prompt template for tool category and style
   */
  getTemplate(category: ToolCategory, style: ResponseStyleType): Promise<ToolResponsePromptTemplate>;

  /**
   * Get all available templates
   */
  getAllTemplates(): Promise<readonly ToolResponsePromptTemplate[]>;

  /**
   * Add or update a template
   */
  upsertTemplate(template: ToolResponsePromptTemplate): Promise<void>;
}

/**
 * Response cache interface
 */
export interface IResponseCache {
  /**
   * Get cached response if available
   */
  get(key: string): Promise<FormattedToolResponse | null>;

  /**
   * Cache a formatted response
   */
  set(key: string, response: FormattedToolResponse, ttlSeconds: number): Promise<void>;

  /**
   * Clear cache for specific tool or category
   */
  clear(pattern?: string): Promise<void>;
}

/**
 * Configuration service interface
 */
export interface IToolResponseConfigService {
  /**
   * Get tool response configuration for an agent
   */
  getConfig(agentId: string): Promise<ToolResponseConfig>;

  /**
   * Update configuration for an agent
   */
  updateConfig(agentId: string, config: Partial<ToolResponseConfig>): Promise<void>;

  /**
   * Get default configuration
   */
  getDefaultConfig(): ToolResponseConfig;
}

// ============================================================================
// Custom Error Types
// ============================================================================

/**
 * Base error class for tool response formatting errors
 */
export class ToolResponseFormattingError extends Error {
  public readonly code: string;
  public readonly context: Readonly<Record<string, unknown>>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ToolResponseFormattingError';
    this.code = `TOOL_RESPONSE_${code}`;
    this.context = Object.freeze({ ...context });
    this.timestamp = new Date();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ToolResponseFormattingError);
    }
  }
}

/**
 * Error during LLM response generation
 */
export class LLMGenerationError extends ToolResponseFormattingError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'LLM_GENERATION_FAILED', context);
    this.name = 'LLMGenerationError';
  }
}

/**
 * Error in prompt template processing
 */
export class PromptTemplateError extends ToolResponseFormattingError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'PROMPT_TEMPLATE_ERROR', context);
    this.name = 'PromptTemplateError';
  }
}

/**
 * Error in response caching operations
 */
export class ResponseCacheError extends ToolResponseFormattingError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'RESPONSE_CACHE_ERROR', context);
    this.name = 'ResponseCacheError';
  }
}

/**
 * Error in configuration management
 */
export class ConfigurationError extends ToolResponseFormattingError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'CONFIGURATION_ERROR', context);
    this.name = 'ConfigurationError';
  }
} 