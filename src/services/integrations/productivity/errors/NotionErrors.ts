/**
 * NotionErrors.ts
 * Comprehensive error classes for Notion integration
 * Following IMPLEMENTATION_GUIDELINES.md error handling patterns
 */

import { ulid } from 'ulid';

// Base error class for all Notion-related errors
export abstract class NotionError extends Error {
  public readonly id: string;
  public readonly timestamp: Date;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.id = ulid();
    this.timestamp = new Date();
    this.context = context;
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// Authentication and authorization errors
export class NotionAuthenticationError extends NotionError {
  constructor(message: string = 'Notion authentication failed', context?: Record<string, unknown>) {
    super(message, context);
  }
}

export class NotionAuthorizationError extends NotionError {
  constructor(message: string = 'Insufficient permissions for Notion operation', context?: Record<string, unknown>) {
    super(message, context);
  }
}

// API and network errors
export class NotionApiError extends NotionError {
  public readonly statusCode?: number;
  public readonly apiErrorCode?: string;

  constructor(
    message: string,
    statusCode?: number,
    apiErrorCode?: string,
    context?: Record<string, unknown>
  ) {
    super(message, context);
    this.statusCode = statusCode;
    this.apiErrorCode = apiErrorCode;
  }
}

export class NotionNetworkError extends NotionError {
  constructor(message: string = 'Network error while communicating with Notion API', context?: Record<string, unknown>) {
    super(message, context);
  }
}

export class NotionTimeoutError extends NotionError {
  constructor(message: string = 'Notion API request timed out', context?: Record<string, unknown>) {
    super(message, context);
  }
}

// Rate limiting errors
export class NotionRateLimitError extends NotionError {
  public readonly retryAfter?: number;

  constructor(
    message: string = 'Notion API rate limit exceeded',
    retryAfter?: number,
    context?: Record<string, unknown>
  ) {
    super(message, context);
    this.retryAfter = retryAfter;
  }
}

// Validation errors
export class NotionValidationError extends NotionError {
  public readonly field?: string;
  public readonly value?: unknown;

  constructor(
    message: string,
    field?: string,
    value?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message, context);
    this.field = field;
    this.value = value;
  }
}

export class NotionConfigurationError extends NotionError {
  constructor(message: string = 'Invalid Notion service configuration', context?: Record<string, unknown>) {
    super(message, context);
  }
}

// Resource errors
export class NotionResourceNotFoundError extends NotionError {
  public readonly resourceId?: string;
  public readonly resourceType?: string;

  constructor(
    message: string,
    resourceId?: string,
    resourceType?: string,
    context?: Record<string, unknown>
  ) {
    super(message, context);
    this.resourceId = resourceId;
    this.resourceType = resourceType;
  }
}

export class NotionResourceConflictError extends NotionError {
  public readonly resourceId?: string;

  constructor(
    message: string,
    resourceId?: string,
    context?: Record<string, unknown>
  ) {
    super(message, context);
    this.resourceId = resourceId;
  }
}

// Database and page specific errors
export class NotionDatabaseError extends NotionError {
  public readonly databaseId?: string;

  constructor(
    message: string,
    databaseId?: string,
    context?: Record<string, unknown>
  ) {
    super(message, context);
    this.databaseId = databaseId;
  }
}

export class NotionPageError extends NotionError {
  public readonly pageId?: string;

  constructor(
    message: string,
    pageId?: string,
    context?: Record<string, unknown>
  ) {
    super(message, context);
    this.pageId = pageId;
  }
}

export class NotionBlockError extends NotionError {
  public readonly blockId?: string;

  constructor(
    message: string,
    blockId?: string,
    context?: Record<string, unknown>
  ) {
    super(message, context);
    this.blockId = blockId;
  }
}

// Property and schema errors
export class NotionPropertyError extends NotionError {
  public readonly propertyName?: string;
  public readonly propertyType?: string;

  constructor(
    message: string,
    propertyName?: string,
    propertyType?: string,
    context?: Record<string, unknown>
  ) {
    super(message, context);
    this.propertyName = propertyName;
    this.propertyType = propertyType;
  }
}

export class NotionSchemaError extends NotionError {
  constructor(message: string = 'Invalid database schema', context?: Record<string, unknown>) {
    super(message, context);
  }
}

// Service health errors
export class NotionServiceUnavailableError extends NotionError {
  constructor(message: string = 'Notion service is currently unavailable', context?: Record<string, unknown>) {
    super(message, context);
  }
}

export class NotionHealthCheckError extends NotionError {
  constructor(message: string = 'Notion service health check failed', context?: Record<string, unknown>) {
    super(message, context);
  }
}

// Factory functions for creating errors with context
export const createNotionApiError = (
  message: string,
  statusCode?: number,
  apiErrorCode?: string,
  context?: Record<string, unknown>
): NotionApiError => new NotionApiError(message, statusCode, apiErrorCode, context);

export const createNotionValidationError = (
  message: string,
  field?: string,
  value?: unknown,
  context?: Record<string, unknown>
): NotionValidationError => new NotionValidationError(message, field, value, context);

export const createNotionResourceNotFoundError = (
  resourceType: string,
  resourceId: string,
  context?: Record<string, unknown>
): NotionResourceNotFoundError => new NotionResourceNotFoundError(
  `${resourceType} with ID ${resourceId} not found`,
  resourceId,
  resourceType,
  context
);

export const createNotionRateLimitError = (
  retryAfter?: number,
  context?: Record<string, unknown>
): NotionRateLimitError => new NotionRateLimitError(
  `Rate limit exceeded${retryAfter ? `, retry after ${retryAfter} seconds` : ''}`,
  retryAfter,
  context
);

// Error type guards
export const isNotionError = (error: unknown): error is NotionError => {
  return error instanceof NotionError;
};

export const isNotionApiError = (error: unknown): error is NotionApiError => {
  return error instanceof NotionApiError;
};

export const isNotionRateLimitError = (error: unknown): error is NotionRateLimitError => {
  return error instanceof NotionRateLimitError;
};

export const isNotionValidationError = (error: unknown): error is NotionValidationError => {
  return error instanceof NotionValidationError;
};

export const isNotionResourceNotFoundError = (error: unknown): error is NotionResourceNotFoundError => {
  return error instanceof NotionResourceNotFoundError;
};

// Error categorization for handling strategies
export enum NotionErrorCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  RATE_LIMIT = 'rate_limit',
  NETWORK = 'network',
  RESOURCE = 'resource',
  SERVICE = 'service',
  CONFIGURATION = 'configuration'
}

export const categorizeNotionError = (error: NotionError): NotionErrorCategory => {
  if (error instanceof NotionAuthenticationError) return NotionErrorCategory.AUTHENTICATION;
  if (error instanceof NotionAuthorizationError) return NotionErrorCategory.AUTHORIZATION;
  if (error instanceof NotionValidationError || error instanceof NotionConfigurationError) return NotionErrorCategory.VALIDATION;
  if (error instanceof NotionRateLimitError) return NotionErrorCategory.RATE_LIMIT;
  if (error instanceof NotionNetworkError || error instanceof NotionTimeoutError) return NotionErrorCategory.NETWORK;
  if (error instanceof NotionResourceNotFoundError || error instanceof NotionResourceConflictError) return NotionErrorCategory.RESOURCE;
  if (error instanceof NotionServiceUnavailableError || error instanceof NotionHealthCheckError) return NotionErrorCategory.SERVICE;
  return NotionErrorCategory.CONFIGURATION;
}; 