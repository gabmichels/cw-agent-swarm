/**
 * GoogleWorkspaceErrors.ts
 * Comprehensive error classes for Google Workspace integration
 * Following IMPLEMENTATION_GUIDELINES.md error handling patterns
 */

import { ulid } from 'ulid';
import { GoogleWorkspaceService } from '../interfaces/GoogleWorkspaceInterfaces';

// Base error class for all Google Workspace-related errors
export abstract class GoogleWorkspaceError extends Error {
  public readonly id: string;
  public readonly timestamp: Date;
  public readonly service?: GoogleWorkspaceService;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    service?: GoogleWorkspaceService,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.id = ulid();
    this.timestamp = new Date();
    this.service = service;
    this.context = context;
    
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// Authentication and authorization errors
export class GoogleWorkspaceAuthenticationError extends GoogleWorkspaceError {
  constructor(
    message: string = 'Google Workspace authentication failed',
    service?: GoogleWorkspaceService,
    context?: Record<string, unknown>
  ) {
    super(message, service, context);
  }
}

export class GoogleWorkspaceAuthorizationError extends GoogleWorkspaceError {
  public readonly requiredScopes?: readonly string[];

  constructor(
    message: string = 'Insufficient permissions for Google Workspace operation',
    service?: GoogleWorkspaceService,
    requiredScopes?: readonly string[],
    context?: Record<string, unknown>
  ) {
    super(message, service, context);
    this.requiredScopes = requiredScopes;
  }
}

export class GoogleWorkspaceTokenExpiredError extends GoogleWorkspaceError {
  constructor(
    message: string = 'Google Workspace access token has expired',
    service?: GoogleWorkspaceService,
    context?: Record<string, unknown>
  ) {
    super(message, service, context);
  }
}

// API and network errors
export class GoogleWorkspaceApiError extends GoogleWorkspaceError {
  public readonly statusCode?: number;
  public readonly apiErrorCode?: string;
  public readonly apiErrorDetails?: Record<string, unknown>;

  constructor(
    message: string,
    service?: GoogleWorkspaceService,
    statusCode?: number,
    apiErrorCode?: string,
    apiErrorDetails?: Record<string, unknown>,
    context?: Record<string, unknown>
  ) {
    super(message, service, context);
    this.statusCode = statusCode;
    this.apiErrorCode = apiErrorCode;
    this.apiErrorDetails = apiErrorDetails;
  }
}

export class GoogleWorkspaceNetworkError extends GoogleWorkspaceError {
  constructor(
    message: string = 'Network error while communicating with Google Workspace API',
    service?: GoogleWorkspaceService,
    context?: Record<string, unknown>
  ) {
    super(message, service, context);
  }
}

export class GoogleWorkspaceTimeoutError extends GoogleWorkspaceError {
  constructor(
    message: string = 'Google Workspace API request timed out',
    service?: GoogleWorkspaceService,
    context?: Record<string, unknown>
  ) {
    super(message, service, context);
  }
}

// Quota and rate limiting errors
export class GoogleWorkspaceQuotaExceededError extends GoogleWorkspaceError {
  public readonly quotaType?: string;
  public readonly quotaLimit?: number;
  public readonly retryAfter?: number;

  constructor(
    message: string = 'Google Workspace API quota exceeded',
    service?: GoogleWorkspaceService,
    quotaType?: string,
    quotaLimit?: number,
    retryAfter?: number,
    context?: Record<string, unknown>
  ) {
    super(message, service, context);
    this.quotaType = quotaType;
    this.quotaLimit = quotaLimit;
    this.retryAfter = retryAfter;
  }
}

export class GoogleWorkspaceRateLimitError extends GoogleWorkspaceError {
  public readonly retryAfter?: number;

  constructor(
    message: string = 'Google Workspace API rate limit exceeded',
    service?: GoogleWorkspaceService,
    retryAfter?: number,
    context?: Record<string, unknown>
  ) {
    super(message, service, context);
    this.retryAfter = retryAfter;
  }
}

// Validation errors
export class GoogleWorkspaceValidationError extends GoogleWorkspaceError {
  public readonly field?: string;
  public readonly value?: unknown;
  public readonly expectedType?: string;

  constructor(
    message: string,
    service?: GoogleWorkspaceService,
    field?: string,
    value?: unknown,
    expectedType?: string,
    context?: Record<string, unknown>
  ) {
    super(message, service, context);
    this.field = field;
    this.value = value;
    this.expectedType = expectedType;
  }
}

export class GoogleWorkspaceConfigurationError extends GoogleWorkspaceError {
  constructor(
    message: string = 'Invalid Google Workspace service configuration',
    service?: GoogleWorkspaceService,
    context?: Record<string, unknown>
  ) {
    super(message, service, context);
  }
}

// Resource errors
export class GoogleWorkspaceResourceNotFoundError extends GoogleWorkspaceError {
  public readonly resourceId?: string;
  public readonly resourceType?: string;

  constructor(
    message: string,
    service?: GoogleWorkspaceService,
    resourceId?: string,
    resourceType?: string,
    context?: Record<string, unknown>
  ) {
    super(message, service, context);
    this.resourceId = resourceId;
    this.resourceType = resourceType;
  }
}

export class GoogleWorkspaceResourceConflictError extends GoogleWorkspaceError {
  public readonly resourceId?: string;
  public readonly conflictReason?: string;

  constructor(
    message: string,
    service?: GoogleWorkspaceService,
    resourceId?: string,
    conflictReason?: string,
    context?: Record<string, unknown>
  ) {
    super(message, service, context);
    this.resourceId = resourceId;
    this.conflictReason = conflictReason;
  }
}

export class GoogleWorkspaceResourceLimitError extends GoogleWorkspaceError {
  public readonly limitType?: string;
  public readonly currentValue?: number;
  public readonly maxValue?: number;

  constructor(
    message: string,
    service?: GoogleWorkspaceService,
    limitType?: string,
    currentValue?: number,
    maxValue?: number,
    context?: Record<string, unknown>
  ) {
    super(message, service, context);
    this.limitType = limitType;
    this.currentValue = currentValue;
    this.maxValue = maxValue;
  }
}

// Service-specific errors
export class GoogleSheetsError extends GoogleWorkspaceError {
  public readonly spreadsheetId?: string;
  public readonly sheetId?: number;
  public readonly range?: string;

  constructor(
    message: string,
    spreadsheetId?: string,
    sheetId?: number,
    range?: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'sheets', context);
    this.spreadsheetId = spreadsheetId;
    this.sheetId = sheetId;
    this.range = range;
  }
}

export class GoogleDriveError extends GoogleWorkspaceError {
  public readonly fileId?: string;
  public readonly folderId?: string;
  public readonly operation?: string;

  constructor(
    message: string,
    fileId?: string,
    folderId?: string,
    operation?: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'drive', context);
    this.fileId = fileId;
    this.folderId = folderId;
    this.operation = operation;
  }
}

export class GoogleCalendarError extends GoogleWorkspaceError {
  public readonly calendarId?: string;
  public readonly eventId?: string;
  public readonly timeRange?: { start: Date; end: Date };

  constructor(
    message: string,
    calendarId?: string,
    eventId?: string,
    timeRange?: { start: Date; end: Date },
    context?: Record<string, unknown>
  ) {
    super(message, 'calendar', context);
    this.calendarId = calendarId;
    this.eventId = eventId;
    this.timeRange = timeRange;
  }
}

export class GoogleGmailError extends GoogleWorkspaceError {
  public readonly messageId?: string;
  public readonly threadId?: string;
  public readonly labelId?: string;

  constructor(
    message: string,
    messageId?: string,
    threadId?: string,
    labelId?: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'gmail', context);
    this.messageId = messageId;
    this.threadId = threadId;
    this.labelId = labelId;
  }
}

export class GoogleDocsError extends GoogleWorkspaceError {
  public readonly documentId?: string;
  public readonly operation?: string;

  constructor(
    message: string,
    documentId?: string,
    operation?: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'docs', context);
    this.documentId = documentId;
    this.operation = operation;
  }
}

// Service health errors
export class GoogleWorkspaceServiceUnavailableError extends GoogleWorkspaceError {
  constructor(
    message: string = 'Google Workspace service is currently unavailable',
    service?: GoogleWorkspaceService,
    context?: Record<string, unknown>
  ) {
    super(message, service, context);
  }
}

export class GoogleWorkspaceHealthCheckError extends GoogleWorkspaceError {
  constructor(
    message: string = 'Google Workspace service health check failed',
    service?: GoogleWorkspaceService,
    context?: Record<string, unknown>
  ) {
    super(message, service, context);
  }
}

// Factory functions for creating errors with context
export const createGoogleWorkspaceApiError = (
  message: string,
  service?: GoogleWorkspaceService,
  statusCode?: number,
  apiErrorCode?: string,
  apiErrorDetails?: Record<string, unknown>,
  context?: Record<string, unknown>
): GoogleWorkspaceApiError => new GoogleWorkspaceApiError(
  message,
  service,
  statusCode,
  apiErrorCode,
  apiErrorDetails,
  context
);

export const createGoogleWorkspaceValidationError = (
  message: string,
  service?: GoogleWorkspaceService,
  field?: string,
  value?: unknown,
  expectedType?: string,
  context?: Record<string, unknown>
): GoogleWorkspaceValidationError => new GoogleWorkspaceValidationError(
  message,
  service,
  field,
  value,
  expectedType,
  context
);

export const createGoogleWorkspaceResourceNotFoundError = (
  resourceType: string,
  resourceId: string,
  service?: GoogleWorkspaceService,
  context?: Record<string, unknown>
): GoogleWorkspaceResourceNotFoundError => new GoogleWorkspaceResourceNotFoundError(
  `${resourceType} with ID ${resourceId} not found`,
  service,
  resourceId,
  resourceType,
  context
);

export const createGoogleWorkspaceQuotaExceededError = (
  quotaType: string,
  service?: GoogleWorkspaceService,
  quotaLimit?: number,
  retryAfter?: number,
  context?: Record<string, unknown>
): GoogleWorkspaceQuotaExceededError => new GoogleWorkspaceQuotaExceededError(
  `Google Workspace ${quotaType} quota exceeded${quotaLimit ? ` (limit: ${quotaLimit})` : ''}`,
  service,
  quotaType,
  quotaLimit,
  retryAfter,
  context
);

export const createGoogleSheetsError = (
  message: string,
  spreadsheetId?: string,
  sheetId?: number,
  range?: string,
  context?: Record<string, unknown>
): GoogleSheetsError => new GoogleSheetsError(message, spreadsheetId, sheetId, range, context);

export const createGoogleDriveError = (
  message: string,
  fileId?: string,
  folderId?: string,
  operation?: string,
  context?: Record<string, unknown>
): GoogleDriveError => new GoogleDriveError(message, fileId, folderId, operation, context);

export const createGoogleCalendarError = (
  message: string,
  calendarId?: string,
  eventId?: string,
  timeRange?: { start: Date; end: Date },
  context?: Record<string, unknown>
): GoogleCalendarError => new GoogleCalendarError(message, calendarId, eventId, timeRange, context);

// Error type guards
export const isGoogleWorkspaceError = (error: unknown): error is GoogleWorkspaceError => {
  return error instanceof GoogleWorkspaceError;
};

export const isGoogleWorkspaceApiError = (error: unknown): error is GoogleWorkspaceApiError => {
  return error instanceof GoogleWorkspaceApiError;
};

export const isGoogleWorkspaceAuthenticationError = (error: unknown): error is GoogleWorkspaceAuthenticationError => {
  return error instanceof GoogleWorkspaceAuthenticationError;
};

export const isGoogleWorkspaceQuotaExceededError = (error: unknown): error is GoogleWorkspaceQuotaExceededError => {
  return error instanceof GoogleWorkspaceQuotaExceededError;
};

export const isGoogleWorkspaceValidationError = (error: unknown): error is GoogleWorkspaceValidationError => {
  return error instanceof GoogleWorkspaceValidationError;
};

export const isGoogleWorkspaceResourceNotFoundError = (error: unknown): error is GoogleWorkspaceResourceNotFoundError => {
  return error instanceof GoogleWorkspaceResourceNotFoundError;
};

export const isGoogleSheetsError = (error: unknown): error is GoogleSheetsError => {
  return error instanceof GoogleSheetsError;
};

export const isGoogleDriveError = (error: unknown): error is GoogleDriveError => {
  return error instanceof GoogleDriveError;
};

export const isGoogleCalendarError = (error: unknown): error is GoogleCalendarError => {
  return error instanceof GoogleCalendarError;
};

// Error categorization for handling strategies
export enum GoogleWorkspaceErrorCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  QUOTA = 'quota',
  RATE_LIMIT = 'rate_limit',
  NETWORK = 'network',
  RESOURCE = 'resource',
  SERVICE = 'service',
  CONFIGURATION = 'configuration'
}

export const categorizeGoogleWorkspaceError = (error: GoogleWorkspaceError): GoogleWorkspaceErrorCategory => {
  if (error instanceof GoogleWorkspaceAuthenticationError || error instanceof GoogleWorkspaceTokenExpiredError) {
    return GoogleWorkspaceErrorCategory.AUTHENTICATION;
  }
  if (error instanceof GoogleWorkspaceAuthorizationError) {
    return GoogleWorkspaceErrorCategory.AUTHORIZATION;
  }
  if (error instanceof GoogleWorkspaceValidationError || error instanceof GoogleWorkspaceConfigurationError) {
    return GoogleWorkspaceErrorCategory.VALIDATION;
  }
  if (error instanceof GoogleWorkspaceQuotaExceededError) {
    return GoogleWorkspaceErrorCategory.QUOTA;
  }
  if (error instanceof GoogleWorkspaceRateLimitError) {
    return GoogleWorkspaceErrorCategory.RATE_LIMIT;
  }
  if (error instanceof GoogleWorkspaceNetworkError || error instanceof GoogleWorkspaceTimeoutError) {
    return GoogleWorkspaceErrorCategory.NETWORK;
  }
  if (error instanceof GoogleWorkspaceResourceNotFoundError || error instanceof GoogleWorkspaceResourceConflictError) {
    return GoogleWorkspaceErrorCategory.RESOURCE;
  }
  if (error instanceof GoogleWorkspaceServiceUnavailableError || error instanceof GoogleWorkspaceHealthCheckError) {
    return GoogleWorkspaceErrorCategory.SERVICE;
  }
  return GoogleWorkspaceErrorCategory.CONFIGURATION;
};

// Retry strategy helpers
export const shouldRetryGoogleWorkspaceError = (error: GoogleWorkspaceError, attempt: number, maxAttempts: number): boolean => {
  if (attempt >= maxAttempts) return false;
  
  const category = categorizeGoogleWorkspaceError(error);
  
  switch (category) {
    case GoogleWorkspaceErrorCategory.RATE_LIMIT:
    case GoogleWorkspaceErrorCategory.QUOTA:
    case GoogleWorkspaceErrorCategory.NETWORK:
      return true;
    case GoogleWorkspaceErrorCategory.SERVICE:
      return attempt < Math.min(maxAttempts, 2); // Limit service error retries
    default:
      return false;
  }
};

export const getRetryDelayForGoogleWorkspaceError = (error: GoogleWorkspaceError, attempt: number): number => {
  const baseDelay = 1000; // 1 second
  const maxDelay = 60000; // 1 minute
  
  if (error instanceof GoogleWorkspaceRateLimitError && error.retryAfter) {
    return Math.min(error.retryAfter * 1000, maxDelay);
  }
  
  if (error instanceof GoogleWorkspaceQuotaExceededError && error.retryAfter) {
    return Math.min(error.retryAfter * 1000, maxDelay);
  }
  
  // Exponential backoff with jitter
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 0.1 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, maxDelay);
}; 