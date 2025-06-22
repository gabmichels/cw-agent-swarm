import { AppError } from '../../../../lib/errors/base';

// Base business operations error
export class BusinessOperationsError extends AppError {
  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, `BUSINESS_${code}`, context);
    this.name = 'BusinessOperationsError';
  }
}

// Payment errors
export class PaymentError extends BusinessOperationsError {
  constructor(
    message: string,
    paymentId?: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      message,
      'PAYMENT_ERROR',
      { paymentId, ...context }
    );
    this.name = 'PaymentError';
  }
}

export class PaymentValidationError extends BusinessOperationsError {
  constructor(
    validationErrors: readonly string[],
    paymentId?: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Payment validation failed: ${validationErrors.join(', ')}`,
      'PAYMENT_VALIDATION_FAILED',
      { validationErrors, paymentId, ...context }
    );
    this.name = 'PaymentValidationError';
  }
}

export class PaymentProcessingError extends BusinessOperationsError {
  constructor(
    paymentId: string,
    reason: string,
    stripeErrorCode?: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Payment processing failed: ${reason}`,
      'PAYMENT_PROCESSING_FAILED',
      { paymentId, reason, stripeErrorCode, ...context }
    );
    this.name = 'PaymentProcessingError';
  }
}

export class PaymentNotFoundError extends BusinessOperationsError {
  constructor(
    paymentId: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Payment not found: ${paymentId}`,
      'PAYMENT_NOT_FOUND',
      { paymentId, ...context }
    );
    this.name = 'PaymentNotFoundError';
  }
}

export class RefundError extends BusinessOperationsError {
  constructor(
    paymentId: string,
    reason: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Refund failed for payment ${paymentId}: ${reason}`,
      'REFUND_FAILED',
      { paymentId, reason, ...context }
    );
    this.name = 'RefundError';
  }
}

// Booking errors
export class BookingError extends BusinessOperationsError {
  constructor(
    message: string,
    bookingId?: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      message,
      'BOOKING_ERROR',
      { bookingId, ...context }
    );
    this.name = 'BookingError';
  }
}

export class BookingValidationError extends BusinessOperationsError {
  constructor(
    validationErrors: readonly string[],
    bookingId?: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Booking validation failed: ${validationErrors.join(', ')}`,
      'BOOKING_VALIDATION_FAILED',
      { validationErrors, bookingId, ...context }
    );
    this.name = 'BookingValidationError';
  }
}

export class BookingConflictError extends BusinessOperationsError {
  constructor(
    bookingId: string,
    conflictingTime: Date,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Booking conflict detected for ${conflictingTime.toISOString()}`,
      'BOOKING_CONFLICT',
      { bookingId, conflictingTime: conflictingTime.toISOString(), ...context }
    );
    this.name = 'BookingConflictError';
  }
}

export class BookingNotFoundError extends BusinessOperationsError {
  constructor(
    bookingId: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Booking not found: ${bookingId}`,
      'BOOKING_NOT_FOUND',
      { bookingId, ...context }
    );
    this.name = 'BookingNotFoundError';
  }
}

export class BookingCancellationError extends BusinessOperationsError {
  constructor(
    bookingId: string,
    reason: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Failed to cancel booking ${bookingId}: ${reason}`,
      'BOOKING_CANCELLATION_FAILED',
      { bookingId, reason, ...context }
    );
    this.name = 'BookingCancellationError';
  }
}

// Form errors
export class FormError extends BusinessOperationsError {
  constructor(
    message: string,
    formId?: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      message,
      'FORM_ERROR',
      { formId, ...context }
    );
    this.name = 'FormError';
  }
}

export class FormValidationError extends BusinessOperationsError {
  constructor(
    validationErrors: readonly string[],
    formId?: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Form validation failed: ${validationErrors.join(', ')}`,
      'FORM_VALIDATION_FAILED',
      { validationErrors, formId, ...context }
    );
    this.name = 'FormValidationError';
  }
}

export class FormCreationError extends BusinessOperationsError {
  constructor(
    formId: string,
    reason: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Form creation failed: ${reason}`,
      'FORM_CREATION_FAILED',
      { formId, reason, ...context }
    );
    this.name = 'FormCreationError';
  }
}

export class FormNotFoundError extends BusinessOperationsError {
  constructor(
    formId: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Form not found: ${formId}`,
      'FORM_NOT_FOUND',
      { formId, ...context }
    );
    this.name = 'FormNotFoundError';
  }
}

// Provider-specific errors
export class StripeError extends BusinessOperationsError {
  constructor(
    message: string,
    stripeErrorCode?: string,
    statusCode?: number,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Stripe API error: ${message}`,
      'STRIPE_ERROR',
      { stripeErrorCode, statusCode, ...context }
    );
    this.name = 'StripeError';
  }
}

export class CalendlyError extends BusinessOperationsError {
  constructor(
    message: string,
    statusCode?: number,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Calendly API error: ${message}`,
      'CALENDLY_ERROR',
      { statusCode, ...context }
    );
    this.name = 'CalendlyError';
  }
}

export class TypeformError extends BusinessOperationsError {
  constructor(
    message: string,
    statusCode?: number,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Typeform API error: ${message}`,
      'TYPEFORM_ERROR',
      { statusCode, ...context }
    );
    this.name = 'TypeformError';
  }
}

// Connection and authentication errors
export class BusinessConnectionError extends BusinessOperationsError {
  constructor(
    provider: string,
    originalError?: Error,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Failed to connect to ${provider} service`,
      'CONNECTION_FAILED',
      { provider, originalError: originalError?.message, ...context }
    );
    this.name = 'BusinessConnectionError';
  }
}

export class BusinessAuthenticationError extends BusinessOperationsError {
  constructor(
    provider: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Authentication failed for ${provider} service`,
      'AUTHENTICATION_FAILED',
      { provider, ...context }
    );
    this.name = 'BusinessAuthenticationError';
  }
}

export class BusinessRateLimitError extends BusinessOperationsError {
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
    this.name = 'BusinessRateLimitError';
  }
}

// Utility functions for error handling
export function isBusinessOperationsError(error: unknown): error is BusinessOperationsError {
  return error instanceof BusinessOperationsError;
}

export function isPaymentError(error: unknown): error is PaymentError {
  return error instanceof PaymentError;
}

export function isBookingError(error: unknown): error is BookingError {
  return error instanceof BookingError;
}

export function isFormError(error: unknown): error is FormError {
  return error instanceof FormError;
}

export function isRateLimitError(error: unknown): error is BusinessRateLimitError {
  return error instanceof BusinessRateLimitError;
} 