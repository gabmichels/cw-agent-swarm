/**
 * ContentGenerationError.ts - Error classes for Agent Content Generation (ACG) system
 * 
 * Provides structured error handling for content generation operations.
 * Integrates with the existing error communication system.
 */

import { ULID } from 'ulid';
import { ulid } from 'ulid';
import { AppError } from '../../../lib/errors/base';
import { ContentType, GenerationMethod } from '../types/ContentGenerationTypes';

// ===== Core ACG Error Classes =====

export interface ContentGenerationErrorContext {
  readonly requestId?: ULID;
  readonly contentType?: ContentType;
  readonly method?: GenerationMethod;
  readonly retryable?: boolean;
  readonly retryAfter?: number;
  readonly cause?: Error;
  readonly details?: Record<string, unknown>;
}

export class ContentGenerationError extends AppError {
  readonly requestId: ULID;
  readonly contentType?: ContentType;
  readonly method?: GenerationMethod;
  readonly retryable: boolean;
  readonly retryAfter?: number;

  constructor(
    message: string,
    code: string,
    context: ContentGenerationErrorContext = {}
  ) {
    super(
      message,
      code,
      {
        requestId: context.requestId,
        contentType: context.contentType,
        method: context.method,
        retryable: context.retryable ?? true,
        retryAfter: context.retryAfter,
        timestamp: new Date(),
        ...context.details
      }
    );

    this.requestId = context.requestId || ulid();
    this.contentType = context.contentType;
    this.method = context.method;
    this.retryable = context.retryable ?? true;
    this.retryAfter = context.retryAfter;
  }
}

export class LLMGenerationError extends ContentGenerationError {
  readonly modelUsed?: string;
  readonly tokensRequested?: number;
  readonly rateLimited: boolean;

  constructor(
    message: string,
    context: {
      requestId: ULID;
      contentType?: ContentType;
      modelUsed?: string;
      tokensRequested?: number;
      rateLimited?: boolean;
      retryAfter?: number;
      cause?: Error;
      details?: Record<string, unknown>;
    }
  ) {
    super(message, 'LLM_GENERATION_ERROR', {
      ...context,
      method: GenerationMethod.LLM_POWERED,
      retryable: context.rateLimited || context.retryAfter !== undefined
    });

    this.modelUsed = context.modelUsed;
    this.tokensRequested = context.tokensRequested;
    this.rateLimited = context.rateLimited ?? false;


  }
}

export class TemplateGenerationError extends ContentGenerationError {
  readonly templateId?: ULID;
  readonly missingVariables: readonly string[];
  readonly invalidVariables: readonly string[];

  constructor(
    message: string,
    context: {
      requestId: ULID;
      contentType?: ContentType;
      templateId?: ULID;
      missingVariables?: readonly string[];
      invalidVariables?: readonly string[];
      cause?: Error;
      details?: Record<string, unknown>;
    }
  ) {
    super(message, 'TEMPLATE_GENERATION_ERROR', {
      ...context,
      method: GenerationMethod.TEMPLATE_BASED,
      retryable: false // Template errors are usually not retryable
    });

    this.templateId = context.templateId;
    this.missingVariables = context.missingVariables ?? [];
    this.invalidVariables = context.invalidVariables ?? [];


  }
}

export class ValidationError extends ContentGenerationError {
  readonly validationIssues: readonly ValidationIssue[];
  readonly score: number;

  constructor(
    message: string,
    context: {
      requestId: ULID;
      contentType?: ContentType;
      validationIssues: readonly ValidationIssue[];
      score: number;
      cause?: Error;
      details?: Record<string, unknown>;
    }
  ) {
    super(message, 'CONTENT_VALIDATION_ERROR', {
      ...context,
      retryable: true // Validation errors might be retryable with different approach
    });

    this.validationIssues = context.validationIssues;
    this.score = context.score;

  }
}

export class GeneratorNotFoundError extends ContentGenerationError {
  readonly requestedCapabilities: readonly string[];
  readonly availableGenerators: readonly string[];

  constructor(
    message: string,
    context: {
      requestId: ULID;
      contentType: ContentType;
      requestedCapabilities: readonly string[];
      availableGenerators: readonly string[];
      details?: Record<string, unknown>;
    }
  ) {
    super(message, 'GENERATOR_NOT_FOUND', {
      ...context,
      retryable: false
    });

    this.requestedCapabilities = context.requestedCapabilities;
    this.availableGenerators = context.availableGenerators;

  }
}

export class ContentTooLongError extends ValidationError {
  readonly maxLength: number;
  readonly actualLength: number;

  constructor(
    context: {
      requestId: ULID;
      contentType: ContentType;
      maxLength: number;
      actualLength: number;
      details?: Record<string, unknown>;
    }
  ) {
    const message = `Generated content exceeds maximum length: ${context.actualLength} > ${context.maxLength}`;

    super(message, {
      requestId: context.requestId,
      contentType: context.contentType,
      validationIssues: [{
        type: 'LENGTH_EXCEEDED',
        severity: 'high',
        message,
        suggestion: `Please reduce content length by ${context.actualLength - context.maxLength} characters`
      }],
      score: 0,
      details: context.details
    });

    this.maxLength = context.maxLength;
    this.actualLength = context.actualLength;

  }
}

export class PlatformConstraintViolationError extends ValidationError {
  readonly platform: string;
  readonly violatedConstraints: readonly string[];

  constructor(
    context: {
      requestId: ULID;
      contentType: ContentType;
      platform: string;
      violatedConstraints: readonly string[];
      details?: Record<string, unknown>;
    }
  ) {
    const message = `Content violates platform constraints for ${context.platform}: ${context.violatedConstraints.join(', ')}`;

    super(message, {
      requestId: context.requestId,
      contentType: context.contentType,
      validationIssues: context.violatedConstraints.map(constraint => ({
        type: 'PLATFORM_VIOLATION',
        severity: 'high',
        message: `Violates ${constraint} constraint`,
        suggestion: `Adjust content to comply with ${context.platform} requirements`
      })),
      score: 0,
      details: context.details
    });

    this.platform = context.platform;
    this.violatedConstraints = context.violatedConstraints;

  }
}

export class GenerationTimeoutError extends ContentGenerationError {
  readonly timeoutMs: number;

  constructor(
    context: {
      requestId: ULID;
      contentType?: ContentType;
      method?: GenerationMethod;
      timeoutMs: number;
      details?: Record<string, unknown>;
    }
  ) {
    const message = `Content generation timed out after ${context.timeoutMs}ms`;

    super(message, 'GENERATION_TIMEOUT', {
      ...context,
      retryable: true,
      retryAfter: Math.min(context.timeoutMs * 2, 60000) // Exponential backoff, max 1 minute
    });

    this.timeoutMs = context.timeoutMs;

  }
}

export class InsufficientContextError extends ContentGenerationError {
  readonly requiredContext: readonly string[];
  readonly providedContext: readonly string[];

  constructor(
    context: {
      requestId: ULID;
      contentType: ContentType;
      requiredContext: readonly string[];
      providedContext: readonly string[];
      details?: Record<string, unknown>;
    }
  ) {
    const missingContext = context.requiredContext.filter(
      required => !context.providedContext.includes(required)
    );

    const message = `Insufficient context for content generation. Missing: ${missingContext.join(', ')}`;

    super(message, 'INVALID_REQUEST', {
      ...context,
      retryable: false // Cannot retry without additional context
    });

    this.requiredContext = context.requiredContext;
    this.providedContext = context.providedContext;

  }
}

export class GenerationFailedError extends ContentGenerationError {
  readonly originalError?: Error;
  readonly attemptCount: number;

  constructor(
    message: string,
    context: {
      requestId: ULID;
      contentType?: ContentType;
      method?: GenerationMethod;
      originalError?: Error;
      attemptCount?: number;
      details?: Record<string, unknown>;
    }
  ) {
    super(message, 'GENERATION_FAILED', {
      ...context,
      retryable: true,
      cause: context.originalError
    });

    this.originalError = context.originalError;
    this.attemptCount = context.attemptCount ?? 1;
  }
}

// ===== Supporting Types =====

interface ValidationIssue {
  readonly type: string;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly message: string;
  readonly suggestion?: string;
}

// ===== Error Factory Functions =====

export class ACGErrorFactory {
  static createLLMError(
    message: string,
    context: {
      requestId?: ULID;
      contentType?: ContentType;
      modelUsed?: string;
      tokensRequested?: number;
      rateLimited?: boolean;
      retryAfter?: number;
      cause?: Error;
    }
  ): LLMGenerationError {
    return new LLMGenerationError(message, {
      requestId: context.requestId ?? ulid(),
      ...context
    });
  }

  static createTemplateError(
    message: string,
    context: {
      requestId?: ULID;
      contentType?: ContentType;
      templateId?: ULID;
      missingVariables?: readonly string[];
      invalidVariables?: readonly string[];
      cause?: Error;
    }
  ): TemplateGenerationError {
    return new TemplateGenerationError(message, {
      requestId: context.requestId ?? ulid(),
      ...context
    });
  }

  static createValidationError(
    message: string,
    context: {
      requestId?: ULID;
      contentType?: ContentType;
      validationIssues: readonly ValidationIssue[];
      score: number;
      cause?: Error;
    }
  ): ValidationError {
    return new ValidationError(message, {
      requestId: context.requestId ?? ulid(),
      ...context
    });
  }

  static createTimeoutError(
    context: {
      requestId?: ULID;
      contentType?: ContentType;
      method?: GenerationMethod;
      timeoutMs: number;
    }
  ): GenerationTimeoutError {
    return new GenerationTimeoutError({
      requestId: context.requestId ?? ulid(),
      ...context
    });
  }

  static createInsufficientContextError(
    context: {
      requestId?: ULID;
      contentType: ContentType;
      requiredContext: readonly string[];
      providedContext: readonly string[];
    }
  ): InsufficientContextError {
    return new InsufficientContextError({
      requestId: context.requestId ?? ulid(),
      ...context
    });
  }

  static createGeneratorNotFoundError(
    context: {
      requestId?: ULID;
      contentType: ContentType;
      requestedCapabilities: readonly string[];
      availableGenerators: readonly string[];
    }
  ): GeneratorNotFoundError {
    const message = `No generator found for content type ${context.contentType} with capabilities: ${context.requestedCapabilities.join(', ')}`;

    return new GeneratorNotFoundError(message, {
      requestId: context.requestId ?? ulid(),
      ...context
    });
  }

  static createGenerationFailedError(
    message: string,
    context: {
      requestId?: ULID;
      contentType?: ContentType;
      method?: GenerationMethod;
      originalError?: Error;
      attemptCount?: number;
    }
  ): GenerationFailedError {
    return new GenerationFailedError(message, {
      requestId: context.requestId || ulid(),
      contentType: context.contentType,
      method: context.method,
      originalError: context.originalError,
      attemptCount: context.attemptCount || 1
    });
  }

  static createInvalidRequestError(
    message: string,
    context: {
      requestId?: ULID;
      contentType?: ContentType;
      providedFields?: Record<string, any>;
    }
  ): ContentGenerationError {
    return new ContentGenerationError(message, 'INVALID_REQUEST', {
      requestId: context.requestId || ulid(),
      contentType: context.contentType,
      retryable: false,
      details: {
        providedFields: context.providedFields
      }
    });
  }
}

// ===== Error Type Guards =====

export function isContentGenerationError(error: unknown): error is ContentGenerationError {
  return error instanceof ContentGenerationError;
}

export function isLLMGenerationError(error: unknown): error is LLMGenerationError {
  return error instanceof LLMGenerationError;
}

export function isTemplateGenerationError(error: unknown): error is TemplateGenerationError {
  return error instanceof TemplateGenerationError;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isRetryableError(error: unknown): boolean {
  return isContentGenerationError(error) && error.retryable;
}

// ===== Error Recovery Utilities =====

export function getRetryDelay(error: ContentGenerationError, attempt: number): number {
  if (error.retryAfter) {
    return error.retryAfter;
  }

  // Exponential backoff with jitter
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 1000; // Add up to 1 second of jitter

  return Math.min(exponentialDelay + jitter, maxDelay);
}

export function shouldRetry(error: ContentGenerationError, attempt: number, maxAttempts: number): boolean {
  return error.retryable && attempt < maxAttempts;
} 