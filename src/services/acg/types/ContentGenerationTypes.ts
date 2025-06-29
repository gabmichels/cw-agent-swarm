/**
 * ContentGenerationTypes.ts - Core types for Agent Content Generation (ACG) system
 * 
 * Provides comprehensive TypeScript interfaces for content generation across all agent tools.
 * Follows strict typing principles with no 'any' types and immutable data patterns.
 */

import { ULID } from 'ulid';

// ===== Core Content Types =====

export enum ContentType {
  EMAIL_SUBJECT = 'email_subject',
  EMAIL_BODY = 'email_body',
  EMAIL_REPLY = 'email_reply',
  EMAIL_FORWARD = 'email_forward',

  DOCUMENT_TEXT = 'document_text',
  DOCUMENT_SPREADSHEET = 'document_spreadsheet',
  DOCUMENT_PRESENTATION = 'document_presentation',

  SOCIAL_POST = 'social_post',
  SOCIAL_COMMENT = 'social_comment',
  SOCIAL_MESSAGE = 'social_message',

  CALENDAR_EVENT = 'calendar_event',
  CALENDAR_AGENDA = 'calendar_agenda',
  CALENDAR_INVITE = 'calendar_invite',

  CUSTOM_TEMPLATE = 'custom_template'
}

export enum GenerationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum GenerationMethod {
  LLM_POWERED = 'llm_powered',
  TEMPLATE_BASED = 'template_based',
  HYBRID = 'hybrid',
  FALLBACK = 'fallback'
}

// ===== Request & Response Types =====

export interface ContentGenerationRequest {
  readonly id: ULID;
  readonly agentId: string;
  readonly toolId: string;
  readonly contentType: ContentType;
  readonly context: GenerationContext;
  readonly priority: number;
  readonly deadline?: Date;
  readonly metadata: RequestMetadata;
}

export type GenerationRequest = ContentGenerationRequest;

export interface GeneratedContent {
  readonly id: ULID;
  readonly type: ContentType;
  readonly content: ContentData;
  readonly metadata: ContentMetadata;
  validation?: ValidationResult;
}

export interface ContentData {
  readonly text?: string;
  readonly html?: string;
  readonly structured?: Record<string, unknown>;
  readonly attachments?: readonly ContentAttachment[];
}

export interface ContentAttachment {
  readonly id: ULID;
  readonly filename: string;
  readonly mimeType: string;
  readonly size: number;
  readonly url?: string;
  readonly data?: string; // Base64 encoded
}

// ===== Context Types =====

export interface GenerationContext {
  readonly originalMessage: string;
  readonly extractedEntities: Record<string, unknown>;
  readonly conversationHistory?: readonly ConversationEntry[];
  readonly userPreferences?: UserContentPreferences;
  readonly platformConstraints?: PlatformConstraints;
  readonly templateHints?: readonly string[];
}

export interface ConversationEntry {
  readonly id: string;
  readonly sender: 'user' | 'agent';
  readonly content: string;
  readonly timestamp: Date;
  readonly metadata: Record<string, unknown>;
}

export interface UserContentPreferences {
  readonly tone: 'professional' | 'casual' | 'friendly' | 'formal';
  readonly length: 'short' | 'medium' | 'long';
  readonly style: 'concise' | 'detailed' | 'conversational';
  readonly includeEmojis: boolean;
  readonly language: string;
  readonly customInstructions?: readonly string[];
}

export interface PlatformConstraints {
  readonly maxLength?: number;
  readonly minLength?: number;
  readonly allowedFormats?: readonly string[];
  readonly forbiddenWords?: readonly string[];
  readonly requiredElements?: readonly string[];
  readonly characterLimits?: Record<string, number>;
}

// ===== Metadata Types =====

export interface RequestMetadata {
  readonly createdAt: Date;
  readonly userId: string;
  readonly sessionId?: string;
  readonly source: 'direct' | 'nlp_detected' | 'scheduled';
  readonly retryCount: number;
  readonly parentRequestId?: ULID;
}

export interface ContentMetadata {
  readonly generatedAt: Date;
  readonly method: GenerationMethod;
  readonly confidence: number;
  readonly processingTimeMs: number;
  readonly tokensUsed?: number;
  readonly modelUsed?: string;
  readonly templateId?: ULID;
  readonly fallbackUsed: boolean;
}

// ===== Validation Types =====

export interface ValidationResult {
  readonly isValid: boolean;
  readonly score: number;
  readonly issues: readonly ValidationIssue[];
  readonly suggestions: readonly string[];
  readonly platformCompliance: Record<string, boolean>;
}

export interface ValidationIssue {
  readonly type: ValidationIssueType;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly message: string;
  readonly suggestion?: string;
  readonly position?: TextPosition;
}

export enum ValidationIssueType {
  LENGTH_EXCEEDED = 'length_exceeded',
  LENGTH_TOO_SHORT = 'length_too_short',
  INAPPROPRIATE_CONTENT = 'inappropriate_content',
  MISSING_REQUIRED_ELEMENT = 'missing_required_element',
  PLATFORM_VIOLATION = 'platform_violation',
  QUALITY_CONCERN = 'quality_concern',
  FACTUAL_INACCURACY = 'factual_inaccuracy'
}

export interface TextPosition {
  readonly start: number;
  readonly end: number;
  readonly line?: number;
  readonly column?: number;
}

// ===== Template Types =====

export interface ContentTemplate {
  readonly id: ULID;
  readonly name: string;
  readonly contentType: ContentType;
  readonly platform?: string;
  readonly template: TemplateDefinition;
  readonly metadata: TemplateMetadata;
  readonly version: string;
}

export interface TemplateDefinition {
  readonly structure: TemplateStructure;
  readonly variables: readonly TemplateVariable[];
  readonly conditions: readonly TemplateCondition[];
  readonly fallbacks: readonly string[];
}

export interface TemplateStructure {
  readonly sections: readonly TemplateSection[];
  readonly order: readonly string[];
  readonly optional: readonly string[];
}

export interface TemplateSection {
  readonly id: string;
  readonly name: string;
  readonly content: string;
  readonly variables: readonly string[];
  readonly required: boolean;
}

export interface TemplateVariable {
  readonly name: string;
  readonly type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  readonly required: boolean;
  readonly defaultValue?: unknown;
  readonly validation?: VariableValidation;
}

export interface VariableValidation {
  readonly pattern?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly allowedValues?: readonly unknown[];
}

export interface TemplateCondition {
  readonly variable: string;
  readonly operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'exists' | 'not_exists';
  readonly value: unknown;
  readonly action: 'include' | 'exclude' | 'replace';
  readonly target: string;
}

export interface TemplateMetadata {
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string;
  readonly tags: readonly string[];
  readonly usage: TemplateUsageStats;
  readonly quality: TemplateQualityMetrics;
}

export interface TemplateUsageStats {
  readonly totalUses: number;
  readonly successRate: number;
  readonly averageRating: number;
  readonly lastUsed?: Date;
}

export interface TemplateQualityMetrics {
  readonly readabilityScore: number;
  readonly completenessScore: number;
  readonly flexibilityScore: number;
  readonly performanceScore: number;
}

// ===== Error Types =====

export interface ContentGenerationError {
  readonly code: string;
  readonly message: string;
  readonly details: Record<string, unknown>;
  readonly requestId: ULID;
  readonly timestamp: Date;
  readonly recoverable: boolean;
  readonly retryAfter?: number;
}

// ===== Plugin Types =====

export interface PluginRegistration {
  readonly id: ULID;
  readonly name: string;
  readonly version: string;
  readonly supportedTypes: readonly ContentType[];
  readonly capabilities: readonly string[];
  readonly priority: number;
  readonly enabled: boolean;
}

// ===== Performance Types =====

export interface GenerationMetrics {
  readonly requestId: ULID;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly durationMs: number;
  readonly memoryUsed: number;
  readonly cacheHit: boolean;
  readonly retryCount: number;
  readonly success: boolean;
}

// ===== Utility Types =====

export type ContentGenerationResult<T = GeneratedContent> = {
  readonly success: true;
  readonly data: T;
  readonly metrics: GenerationMetrics;
} | {
  readonly success: false;
  readonly error: ContentGenerationError;
  readonly metrics: GenerationMetrics;
};

export type AsyncContentGenerationResult<T = GeneratedContent> = Promise<ContentGenerationResult<T>>;

// ===== Type Guards =====

export function isValidContentType(value: string): value is ContentType {
  return Object.values(ContentType).includes(value as ContentType);
}

export function isValidGenerationStatus(value: string): value is GenerationStatus {
  return Object.values(GenerationStatus).includes(value as GenerationStatus);
}

export function isValidGenerationMethod(value: string): value is GenerationMethod {
  return Object.values(GenerationMethod).includes(value as GenerationMethod);
}

// ===== Constants =====

export const DEFAULT_GENERATION_TIMEOUT_MS = 30000;
export const MAX_RETRY_ATTEMPTS = 3;
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;
export const MAX_CONTENT_LENGTH = 50000;
export const MIN_CONTENT_LENGTH = 1;

// ===== Export Collections =====

export const ACG_ENUMS = {
  ContentType,
  GenerationStatus,
  GenerationMethod,
  ValidationIssueType
} as const;

export const ACG_CONSTANTS = {
  DEFAULT_GENERATION_TIMEOUT_MS,
  MAX_RETRY_ATTEMPTS,
  DEFAULT_CONFIDENCE_THRESHOLD,
  MAX_CONTENT_LENGTH,
  MIN_CONTENT_LENGTH
} as const; 