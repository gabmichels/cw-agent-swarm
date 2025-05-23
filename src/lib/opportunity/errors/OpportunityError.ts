/**
 * OpportunityError.ts
 * 
 * Defines the error hierarchy for the opportunity management system.
 */

/**
 * Base error class for all opportunity-related errors
 */
export class OpportunityError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'OpportunityError';
  }
}

/**
 * Error class for opportunity registry operations
 */
export class OpportunityRegistryError extends OpportunityError {
  constructor(
    message: string, 
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, `REGISTRY_${code}`, context);
    this.name = 'OpportunityRegistryError';
  }
}

/**
 * Error class for opportunity detection operations
 */
export class OpportunityDetectionError extends OpportunityError {
  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, `DETECTION_${code}`, context);
    this.name = 'OpportunityDetectionError';
  }
}

/**
 * Error class for opportunity evaluation operations
 */
export class OpportunityEvaluationError extends OpportunityError {
  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, `EVALUATION_${code}`, context);
    this.name = 'OpportunityEvaluationError';
  }
}

/**
 * Error class for opportunity processing operations
 */
export class OpportunityProcessingError extends OpportunityError {
  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, `PROCESSING_${code}`, context);
    this.name = 'OpportunityProcessingError';
  }
}

/**
 * Error class for opportunity manager operations
 */
export class OpportunityManagerError extends OpportunityError {
  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, `MANAGER_${code}`, context);
    this.name = 'OpportunityManagerError';
  }
}

/**
 * Error class for strategy-related operations
 */
export class OpportunityStrategyError extends OpportunityError {
  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, `STRATEGY_${code}`, context);
    this.name = 'OpportunityStrategyError';
  }
} 