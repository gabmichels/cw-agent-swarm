/**
 * Unified Tool Foundation - Error Hierarchy
 * 
 * Comprehensive error system for the unified tool foundation that provides
 * structured error handling with proper context and recovery suggestions.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - Extend BaseError for consistent error handling
 * - Structured error context for debugging
 * - No fallback executors - proper errors only
 * - Integration with IErrorManagementService
 */

import { BaseError } from '@/lib/errors/base';
import { ToolId, ToolIdentifier } from '../types/FoundationTypes';

/**
 * Base error class for all tool foundation errors
 */
export class ToolFoundationError extends BaseError {
  constructor(
    message: string,
    public readonly context: {
      readonly toolId?: ToolId;
      readonly toolName?: string;
      readonly operation?: string;
      readonly details?: Record<string, unknown>;
    } = {},
    cause?: Error
  ) {
    super(message, 'TOOL_FOUNDATION_ERROR', context, cause);
    this.name = 'ToolFoundationError';
  }
}

/**
 * Error thrown when a tool is not found in the registry
 * 
 * NO FALLBACK EXECUTORS - This error should be handled properly
 * with suggestions for similar tools, not hidden by fallbacks.
 */
export class ToolNotFoundError extends ToolFoundationError {
  constructor(
    message: string,
    public readonly context: {
      readonly identifier: ToolIdentifier;
      readonly availableTools?: readonly string[];
      readonly suggestedTools?: readonly string[];
      readonly searchCriteria?: Record<string, unknown>;
    },
    cause?: Error
  ) {
    super(message, {
      operation: 'tool_lookup',
      details: context
    }, cause);
    this.name = 'ToolNotFoundError';
    this.code = 'TOOL_NOT_FOUND';
  }
}

/**
 * Error thrown when tool execution fails
 */
export class ToolExecutionError extends ToolFoundationError {
  constructor(
    message: string,
    public readonly context: {
      readonly toolId: ToolId;
      readonly toolName: string;
      readonly parameters?: Record<string, unknown>;
      readonly executionTimeMs?: number;
      readonly retryAttempt?: number;
      readonly maxRetries?: number;
    },
    cause?: Error
  ) {
    super(message, {
      toolId: context.toolId,
      toolName: context.toolName,
      operation: 'tool_execution',
      details: context
    }, cause);
    this.name = 'ToolExecutionError';
    this.code = 'TOOL_EXECUTION_FAILED';
  }
}

/**
 * Error thrown when tool validation fails
 */
export class ToolValidationError extends ToolFoundationError {
  constructor(
    message: string,
    public readonly context: {
      readonly toolId?: ToolId;
      readonly toolName?: string;
      readonly validationErrors: readonly string[];
      readonly validationWarnings?: readonly string[];
      readonly invalidFields?: readonly string[];
    },
    cause?: Error
  ) {
    super(message, {
      toolId: context.toolId,
      toolName: context.toolName,
      operation: 'tool_validation',
      details: context
    }, cause);
    this.name = 'ToolValidationError';
    this.code = 'TOOL_VALIDATION_FAILED';
  }
}

/**
 * Error thrown when tool registration fails
 */
export class ToolRegistrationError extends ToolFoundationError {
  constructor(
    message: string,
    public readonly context: {
      readonly toolName: string;
      readonly reason: 'duplicate_name' | 'invalid_definition' | 'registration_failed' | 'dependency_missing';
      readonly existingToolId?: ToolId;
      readonly validationErrors?: readonly string[];
    },
    cause?: Error
  ) {
    super(message, {
      toolName: context.toolName,
      operation: 'tool_registration',
      details: context
    }, cause);
    this.name = 'ToolRegistrationError';
    this.code = 'TOOL_REGISTRATION_FAILED';
  }
}

/**
 * Error thrown when tool parameter validation fails
 */
export class ToolParameterError extends ToolFoundationError {
  constructor(
    message: string,
    public readonly context: {
      readonly toolId: ToolId;
      readonly toolName: string;
      readonly parameterName: string;
      readonly expectedType: string;
      readonly actualType: string;
      readonly validationRule?: string;
      readonly allowedValues?: readonly unknown[];
    },
    cause?: Error
  ) {
    super(message, {
      toolId: context.toolId,
      toolName: context.toolName,
      operation: 'parameter_validation',
      details: context
    }, cause);
    this.name = 'ToolParameterError';
    this.code = 'TOOL_PARAMETER_INVALID';
  }
}

/**
 * Error thrown when tool permissions are insufficient
 */
export class ToolPermissionError extends ToolFoundationError {
  constructor(
    message: string,
    public readonly context: {
      readonly toolId: ToolId;
      readonly toolName: string;
      readonly requiredPermissions: readonly string[];
      readonly userPermissions: readonly string[];
      readonly missingPermissions: readonly string[];
    },
    cause?: Error
  ) {
    super(message, {
      toolId: context.toolId,
      toolName: context.toolName,
      operation: 'permission_check',
      details: context
    }, cause);
    this.name = 'ToolPermissionError';
    this.code = 'TOOL_PERMISSION_DENIED';
  }
}

/**
 * Error thrown when tool discovery fails
 */
export class ToolDiscoveryError extends ToolFoundationError {
  constructor(
    message: string,
    public readonly context: {
      readonly searchQuery?: string;
      readonly searchCriteria?: Record<string, unknown>;
      readonly discoveryMethod: string;
      readonly resultCount: number;
    },
    cause?: Error
  ) {
    super(message, {
      operation: 'tool_discovery',
      details: context
    }, cause);
    this.name = 'ToolDiscoveryError';
    this.code = 'TOOL_DISCOVERY_FAILED';
  }
}

/**
 * Error thrown when tool system initialization fails
 */
export class ToolSystemError extends ToolFoundationError {
  constructor(
    message: string,
    public readonly context: {
      readonly operation: 'initialization' | 'shutdown' | 'health_check' | 'system_error';
      readonly component?: string;
      readonly systemState?: string;
    },
    cause?: Error
  ) {
    super(message, {
      operation: context.operation,
      details: context
    }, cause);
    this.name = 'ToolSystemError';
    this.code = 'TOOL_SYSTEM_ERROR';
  }
}

/**
 * Error thrown when tool timeout occurs
 */
export class ToolTimeoutError extends ToolFoundationError {
  constructor(
    message: string,
    public readonly context: {
      readonly toolId: ToolId;
      readonly toolName: string;
      readonly timeoutMs: number;
      readonly executionTimeMs: number;
    },
    cause?: Error
  ) {
    super(message, {
      toolId: context.toolId,
      toolName: context.toolName,
      operation: 'tool_execution',
      details: context
    }, cause);
    this.name = 'ToolTimeoutError';
    this.code = 'TOOL_EXECUTION_TIMEOUT';
  }
}

/**
 * Error thrown when tool dependency is missing
 */
export class ToolDependencyError extends ToolFoundationError {
  constructor(
    message: string,
    public readonly context: {
      readonly toolId: ToolId;
      readonly toolName: string;
      readonly missingDependency: string;
      readonly dependencyType: 'service' | 'tool' | 'capability' | 'permission';
      readonly availableDependencies?: readonly string[];
    },
    cause?: Error
  ) {
    super(message, {
      toolId: context.toolId,
      toolName: context.toolName,
      operation: 'dependency_check',
      details: context
    }, cause);
    this.name = 'ToolDependencyError';
    this.code = 'TOOL_DEPENDENCY_MISSING';
  }
}

/**
 * Utility functions for error handling
 */

/**
 * Check if an error is a tool foundation error
 */
export function isToolFoundationError(error: unknown): error is ToolFoundationError {
  return error instanceof ToolFoundationError;
}

/**
 * Extract tool context from any error
 */
export function extractToolContext(error: unknown): Record<string, unknown> {
  if (isToolFoundationError(error)) {
    return {
      toolId: error.context.toolId,
      toolName: error.context.toolName,
      operation: error.context.operation,
      ...error.context.details
    };
  }
  return {};
}

/**
 * Create user-friendly error message from tool foundation error
 */
export function createUserFriendlyMessage(error: ToolFoundationError): string {
  switch (error.constructor) {
    case ToolNotFoundError:
      const notFoundError = error as ToolNotFoundError;
      const suggestions = notFoundError.context.suggestedTools?.length
        ? ` Did you mean: ${notFoundError.context.suggestedTools.slice(0, 3).join(', ')}?`
        : '';
      return `Tool '${notFoundError.context.identifier}' not found.${suggestions}`;

    case ToolExecutionError:
      return `Tool execution failed: ${error.message}`;

    case ToolValidationError:
      const validationError = error as ToolValidationError;
      return `Tool validation failed: ${validationError.context.validationErrors.join(', ')}`;

    case ToolPermissionError:
      const permissionError = error as ToolPermissionError;
      return `Insufficient permissions for tool '${permissionError.context.toolName}'. Missing: ${permissionError.context.missingPermissions.join(', ')}`;

    case ToolTimeoutError:
      const timeoutError = error as ToolTimeoutError;
      return `Tool '${timeoutError.context.toolName}' timed out after ${timeoutError.context.timeoutMs}ms`;

    default:
      return error.message;
  }
} 