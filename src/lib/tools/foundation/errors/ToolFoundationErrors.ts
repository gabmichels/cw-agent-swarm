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

import { AppError } from '@/lib/errors/base';
import { ToolId, ToolIdentifier } from '../types/FoundationTypes';

/**
 * Base error class for all tool foundation errors
 */
export class ToolFoundationError extends AppError {
  constructor(
    message: string,
    public readonly context: {
      readonly toolId?: ToolId;
      readonly toolName?: string;
      readonly operation?: string;
      readonly details?: Record<string, unknown>;
    } = {}
  ) {
    super(message, 'TOOL_FOUNDATION_ERROR', context);
    this.name = 'ToolFoundationError';
  }
}

/**
 * Error thrown when a tool is not found in the registry
 * 
 * NO FALLBACK EXECUTORS - This error should be handled properly
 * with suggestions for similar tools, not hidden by fallbacks.
 */
export class ToolNotFoundError extends AppError {
  constructor(
    message: string,
    public readonly context: {
      readonly identifier: ToolIdentifier;
      readonly availableTools?: readonly string[];
      readonly suggestedTools?: readonly string[];
      readonly searchCriteria?: Record<string, unknown>;
    }
  ) {
    super(message, 'TOOL_NOT_FOUND', {
      identifier: context.identifier,
      availableTools: context.availableTools,
      suggestedTools: context.suggestedTools,
      searchCriteria: context.searchCriteria
    });
    this.name = 'ToolNotFoundError';
  }
}

/**
 * Error thrown when tool execution fails
 */
export class ToolExecutionError extends AppError {
  constructor(
    message: string,
    public readonly context: {
      readonly toolId: ToolId;
      readonly toolName: string;
      readonly parameters?: Record<string, unknown>;
      readonly executionTimeMs?: number;
      readonly retryAttempt?: number;
      readonly maxRetries?: number;
    }
  ) {
    super(message, 'TOOL_EXECUTION_FAILED', {
      toolId: context.toolId,
      toolName: context.toolName,
      parameters: context.parameters,
      executionTimeMs: context.executionTimeMs,
      retryAttempt: context.retryAttempt,
      maxRetries: context.maxRetries
    });
    this.name = 'ToolExecutionError';
  }
}

/**
 * Error thrown when tool validation fails
 */
export class ToolValidationError extends AppError {
  constructor(
    message: string,
    public readonly context: {
      readonly toolId?: ToolId;
      readonly toolName?: string;
      readonly validationErrors: readonly string[];
      readonly validationWarnings?: readonly string[];
      readonly invalidFields?: readonly string[];
    }
  ) {
    super(message, 'TOOL_VALIDATION_FAILED', {
      toolId: context.toolId,
      toolName: context.toolName,
      validationErrors: context.validationErrors,
      validationWarnings: context.validationWarnings,
      invalidFields: context.invalidFields
    });
    this.name = 'ToolValidationError';
  }
}

/**
 * Error thrown when tool registration fails
 */
export class ToolRegistrationError extends AppError {
  constructor(
    message: string,
    public readonly context: {
      readonly toolName: string;
      readonly reason: 'duplicate_name' | 'invalid_definition' | 'registration_failed' | 'dependency_missing';
      readonly existingToolId?: ToolId;
      readonly validationErrors?: readonly string[];
    }
  ) {
    super(message, 'TOOL_REGISTRATION_FAILED', {
      toolName: context.toolName,
      reason: context.reason,
      existingToolId: context.existingToolId,
      validationErrors: context.validationErrors
    });
    this.name = 'ToolRegistrationError';
  }
}

/**
 * Error thrown when tool parameter validation fails
 */
export class ToolParameterError extends AppError {
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
    }
  ) {
    super(message, 'TOOL_PARAMETER_INVALID', {
      toolId: context.toolId,
      toolName: context.toolName,
      parameterName: context.parameterName,
      expectedType: context.expectedType,
      actualType: context.actualType,
      validationRule: context.validationRule,
      allowedValues: context.allowedValues
    });
    this.name = 'ToolParameterError';
  }
}

/**
 * Error thrown when tool permissions are insufficient
 */
export class ToolPermissionError extends AppError {
  constructor(
    message: string,
    public readonly context: {
      readonly toolId: ToolId;
      readonly toolName: string;
      readonly requiredPermissions: readonly string[];
      readonly userPermissions: readonly string[];
      readonly missingPermissions: readonly string[];
    }
  ) {
    super(message, 'TOOL_PERMISSION_DENIED', {
      toolId: context.toolId,
      toolName: context.toolName,
      requiredPermissions: context.requiredPermissions,
      userPermissions: context.userPermissions,
      missingPermissions: context.missingPermissions
    });
    this.name = 'ToolPermissionError';
  }
}

/**
 * Error thrown when tool discovery fails
 */
export class ToolDiscoveryError extends AppError {
  constructor(
    message: string,
    public readonly context: {
      readonly searchQuery?: string;
      readonly searchCriteria?: Record<string, unknown>;
      readonly discoveryMethod: string;
      readonly resultCount: number;
    }
  ) {
    super(message, 'TOOL_DISCOVERY_FAILED', {
      searchQuery: context.searchQuery,
      searchCriteria: context.searchCriteria,
      discoveryMethod: context.discoveryMethod,
      resultCount: context.resultCount
    });
    this.name = 'ToolDiscoveryError';
  }
}

/**
 * Error thrown when tool system initialization fails
 */
export class ToolSystemError extends AppError {
  constructor(
    message: string,
    public readonly context: {
      readonly operation: 'initialization' | 'shutdown' | 'health_check' | 'system_error' | 'metrics_retrieval';
      readonly component?: string;
      readonly systemState?: string;
      readonly originalError?: string;
    }
  ) {
    super(message, 'TOOL_SYSTEM_ERROR', {
      operation: context.operation,
      component: context.component,
      systemState: context.systemState
    });
    this.name = 'ToolSystemError';
  }
}

/**
 * Error thrown when tool timeout occurs
 */
export class ToolTimeoutError extends AppError {
  constructor(
    message: string,
    public readonly context: {
      readonly toolId: ToolId;
      readonly toolName: string;
      readonly timeoutMs: number;
      readonly executionTimeMs: number;
    }
  ) {
    super(message, 'TOOL_EXECUTION_TIMEOUT', {
      toolId: context.toolId,
      toolName: context.toolName,
      timeoutMs: context.timeoutMs,
      executionTimeMs: context.executionTimeMs
    });
    this.name = 'ToolTimeoutError';
  }
}

/**
 * Error thrown when tool dependency is missing
 */
export class ToolDependencyError extends AppError {
  constructor(
    message: string,
    public readonly context: {
      readonly toolId: ToolId;
      readonly toolName: string;
      readonly missingDependency: string;
      readonly dependencyType: 'service' | 'tool' | 'capability' | 'permission';
      readonly availableDependencies?: readonly string[];
    }
  ) {
    super(message, 'TOOL_DEPENDENCY_MISSING', {
      toolId: context.toolId,
      toolName: context.toolName,
      missingDependency: context.missingDependency,
      dependencyType: context.dependencyType,
      availableDependencies: context.availableDependencies
    });
    this.name = 'ToolDependencyError';
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