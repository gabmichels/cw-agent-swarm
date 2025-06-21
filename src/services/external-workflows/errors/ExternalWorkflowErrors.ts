/**
 * Base error class for external workflow operations
 */
export class ExternalWorkflowError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ExternalWorkflowError';
  }
}

/**
 * Error thrown when workflow platform connection fails
 */
export class WorkflowConnectionError extends ExternalWorkflowError {
  constructor(
    platform: string,
    message: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, 'WORKFLOW_CONNECTION_FAILED', { platform, ...context });
    this.name = 'WorkflowConnectionError';
  }
}

/**
 * Error thrown when workflow execution fails
 */
export class WorkflowExecutionError extends ExternalWorkflowError {
  constructor(
    workflowId: string,
    message: string,
    context: Record<string, unknown> = {}
  ) {
    super(message, 'WORKFLOW_EXECUTION_FAILED', { workflowId, ...context });
    this.name = 'WorkflowExecutionError';
  }
}

/**
 * Error thrown when workflow parameters are invalid
 */
export class WorkflowValidationError extends ExternalWorkflowError {
  constructor(
    workflowId: string,
    validationErrors: readonly string[],
    context: Record<string, unknown> = {}
  ) {
    super(
      `Workflow validation failed: ${validationErrors.join(', ')}`,
      'WORKFLOW_VALIDATION_FAILED',
      { workflowId, validationErrors, ...context }
    );
    this.name = 'WorkflowValidationError';
  }
}

/**
 * Error thrown when workflow times out
 */
export class WorkflowTimeoutError extends ExternalWorkflowError {
  constructor(
    workflowId: string,
    timeoutMs: number,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Workflow execution timed out after ${timeoutMs}ms`,
      'WORKFLOW_TIMEOUT',
      { workflowId, timeoutMs, ...context }
    );
    this.name = 'WorkflowTimeoutError';
  }
}

/**
 * Error thrown when workflow is not found
 */
export class WorkflowNotFoundError extends ExternalWorkflowError {
  constructor(
    workflowId: string,
    platform: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Workflow not found: ${workflowId} on platform ${platform}`,
      'WORKFLOW_NOT_FOUND',
      { workflowId, platform, ...context }
    );
    this.name = 'WorkflowNotFoundError';
  }
}

/**
 * Error thrown when rate limits are exceeded
 */
export class WorkflowRateLimitError extends ExternalWorkflowError {
  constructor(
    platform: string,
    resetAt: Date,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Rate limit exceeded for platform ${platform}. Resets at ${resetAt.toISOString()}`,
      'WORKFLOW_RATE_LIMIT_EXCEEDED',
      { platform, resetAt, ...context }
    );
    this.name = 'WorkflowRateLimitError';
  }
}

/**
 * Error thrown when workflow configuration is invalid
 */
export class WorkflowConfigurationError extends ExternalWorkflowError {
  constructor(
    workflowId: string,
    configurationIssue: string,
    context: Record<string, unknown> = {}
  ) {
    super(
      `Workflow configuration error: ${configurationIssue}`,
      'WORKFLOW_CONFIGURATION_ERROR',
      { workflowId, configurationIssue, ...context }
    );
    this.name = 'WorkflowConfigurationError';
  }
} 