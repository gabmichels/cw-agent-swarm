import { AppError } from '../../../../lib/errors/base';

// Base marketing error
export class MarketingError extends AppError {
  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, `MARKETING_${code}`, context);
    this.name = 'MarketingError';
  }
}

// Connection and authentication errors
export class MarketingConnectionError extends MarketingError {
  constructor(
    provider: string,
    originalError?: Error,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Failed to connect to ${provider} marketing service`,
      'CONNECTION_FAILED',
      { provider, originalError: originalError?.message, ...context }
    );
    this.name = 'MarketingConnectionError';
  }
}

export class MarketingAuthenticationError extends MarketingError {
  constructor(
    provider: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Authentication failed for ${provider} marketing service`,
      'AUTHENTICATION_FAILED',
      { provider, ...context }
    );
    this.name = 'MarketingAuthenticationError';
  }
}

// Campaign errors
export class CampaignError extends MarketingError {
  constructor(
    message: string,
    campaignId?: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      message,
      'CAMPAIGN_ERROR',
      { campaignId, ...context }
    );
    this.name = 'CampaignError';
  }
}

export class CampaignValidationError extends MarketingError {
  constructor(
    validationErrors: readonly string[],
    campaignId?: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Campaign validation failed: ${validationErrors.join(', ')}`,
      'CAMPAIGN_VALIDATION_FAILED',
      { validationErrors, campaignId, ...context }
    );
    this.name = 'CampaignValidationError';
  }
}

export class CampaignExecutionError extends MarketingError {
  constructor(
    campaignId: string,
    reason: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Campaign execution failed: ${reason}`,
      'CAMPAIGN_EXECUTION_FAILED',
      { campaignId, reason, ...context }
    );
    this.name = 'CampaignExecutionError';
  }
}

// Rate limiting errors
export class MarketingRateLimitError extends MarketingError {
  constructor(
    provider: string,
    resetAt: Date,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Rate limit exceeded for ${provider}. Resets at ${resetAt.toISOString()}`,
      'RATE_LIMIT_EXCEEDED',
      { provider, resetAt: resetAt.toISOString(), ...context }
    );
    this.name = 'MarketingRateLimitError';
  }
}

// Segmentation errors
export class SegmentationError extends MarketingError {
  constructor(
    message: string,
    segmentId?: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      message,
      'SEGMENTATION_ERROR',
      { segmentId, ...context }
    );
    this.name = 'SegmentationError';
  }
}

export class SegmentValidationError extends MarketingError {
  constructor(
    validationErrors: readonly string[],
    segmentId?: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Segment validation failed: ${validationErrors.join(', ')}`,
      'SEGMENT_VALIDATION_FAILED',
      { validationErrors, segmentId, ...context }
    );
    this.name = 'SegmentValidationError';
  }
}

// Provider-specific errors
export class SendGridError extends MarketingError {
  constructor(
    message: string,
    statusCode?: number,
    context: Record<string, unknown> = {}
  ) {
    super(
      `SendGrid API error: ${message}`,
      'SENDGRID_ERROR',
      { statusCode, ...context }
    );
    this.name = 'SendGridError';
  }
}

export class MailchimpError extends MarketingError {
  constructor(
    message: string,
    statusCode?: number,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Mailchimp API error: ${message}`,
      'MAILCHIMP_ERROR',
      { statusCode, ...context }
    );
    this.name = 'MailchimpError';
  }
}

// Utility functions for error handling
export function isMarketingError(error: unknown): error is MarketingError {
  return error instanceof MarketingError;
}

export function isRateLimitError(error: unknown): error is MarketingRateLimitError {
  return error instanceof MarketingRateLimitError;
}

export function isCampaignError(error: unknown): error is CampaignError {
  return error instanceof CampaignError;
}

export function isSegmentationError(error: unknown): error is SegmentationError {
  return error instanceof SegmentationError;
} 