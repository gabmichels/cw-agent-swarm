/**
 * Execution Context Utilities - Context Management and Validation
 * 
 * Utility functions for creating, validating, and managing execution contexts
 * for tool operations. Provides security and permission checking capabilities
 * following @IMPLEMENTATION_GUIDELINES.md principles.
 */

import { ulid } from 'ulid';
import { ExecutionContext } from '../types/FoundationTypes';
import { ToolCapability } from '../enums/ToolEnums';

/**
 * Create a new execution context with required fields
 * @param options Context creation options
 * @returns New execution context
 */
export function createExecutionContext(options: {
  readonly agentId?: string;
  readonly userId?: string;
  readonly workspaceId?: string;
  readonly sessionId?: string;
  readonly permissions?: readonly string[];
  readonly capabilities?: readonly ToolCapability[];
  readonly metadata?: Record<string, unknown>;
  readonly generateTraceId?: boolean;
}): ExecutionContext {
  const traceId = options.generateTraceId !== false ? ulid() : undefined;

  return {
    agentId: options.agentId,
    userId: options.userId,
    workspaceId: options.workspaceId,
    sessionId: options.sessionId || ulid(),
    permissions: options.permissions || [],
    capabilities: options.capabilities || [],
    metadata: options.metadata || {},
    traceId
  };
}

/**
 * Create a minimal execution context for testing
 * @param overrides Optional overrides for default values
 * @returns Minimal execution context
 */
export function createMinimalExecutionContext(
  overrides: Partial<ExecutionContext> = {}
): ExecutionContext {
  return {
    sessionId: ulid(),
    permissions: [],
    capabilities: [],
    metadata: {},
    traceId: ulid(),
    ...overrides
  };
}

/**
 * Create an execution context with full permissions
 * @param options Context creation options
 * @returns Execution context with admin permissions
 */
export function createAdminExecutionContext(options: {
  readonly agentId?: string;
  readonly userId?: string;
  readonly workspaceId?: string;
  readonly sessionId?: string;
  readonly metadata?: Record<string, unknown>;
} = {}): ExecutionContext {
  return createExecutionContext({
    ...options,
    permissions: [
      'admin',
      'tool:execute',
      'tool:register',
      'tool:unregister',
      'workspace:read',
      'workspace:write',
      'social_media:post',
      'social_media:read',
      'email:send',
      'email:read',
      'calendar:read',
      'calendar:write',
      'file:read',
      'file:write'
    ],
    capabilities: Object.values(ToolCapability),
    generateTraceId: true
  });
}

/**
 * Validate an execution context
 * @param context Execution context to validate
 * @returns Validation result with errors and warnings
 */
export function validateExecutionContext(context: unknown): {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly context?: ExecutionContext;
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if context is an object
  if (!context || typeof context !== 'object') {
    return {
      valid: false,
      errors: ['Execution context must be an object'],
      warnings: []
    };
  }

  const ctx = context as Record<string, unknown>;

  // Validate optional string fields
  const stringFields = ['agentId', 'userId', 'workspaceId', 'sessionId', 'traceId'];
  for (const field of stringFields) {
    if (ctx[field] !== undefined && typeof ctx[field] !== 'string') {
      errors.push(`${field} must be a string if provided`);
    }
  }

  // Validate permissions array
  if (ctx.permissions !== undefined) {
    if (!Array.isArray(ctx.permissions)) {
      errors.push('permissions must be an array if provided');
    } else {
      for (let i = 0; i < ctx.permissions.length; i++) {
        if (typeof ctx.permissions[i] !== 'string') {
          errors.push(`permissions[${i}] must be a string`);
        }
      }
    }
  }

  // Validate capabilities array
  if (ctx.capabilities !== undefined) {
    if (!Array.isArray(ctx.capabilities)) {
      errors.push('capabilities must be an array if provided');
    } else {
      const validCapabilities = Object.values(ToolCapability);
      for (let i = 0; i < ctx.capabilities.length; i++) {
        const capability = ctx.capabilities[i];
        if (typeof capability !== 'string' || !validCapabilities.includes(capability as ToolCapability)) {
          errors.push(`capabilities[${i}] must be a valid ToolCapability`);
        }
      }
    }
  }

  // Validate metadata object
  if (ctx.metadata !== undefined) {
    if (!ctx.metadata || typeof ctx.metadata !== 'object' || Array.isArray(ctx.metadata)) {
      errors.push('metadata must be an object if provided');
    }
  }

  // Warnings for missing recommended fields
  if (!ctx.sessionId) {
    warnings.push('sessionId is recommended for request tracking');
  }

  if (!ctx.traceId) {
    warnings.push('traceId is recommended for debugging and monitoring');
  }

  if (!ctx.permissions || (ctx.permissions as unknown[]).length === 0) {
    warnings.push('permissions array is empty - tool execution may be limited');
  }

  const valid = errors.length === 0;
  const validatedContext = valid ? (ctx as ExecutionContext) : undefined;

  return {
    valid,
    errors,
    warnings,
    context: validatedContext
  };
}

/**
 * Check if execution context has specific permission
 * @param context Execution context to check
 * @param permission Permission to check for
 * @returns True if context has permission
 */
export function hasPermission(context: ExecutionContext, permission: string): boolean {
  if (!context.permissions) {
    return false;
  }

  // Check for exact permission or admin permission
  return context.permissions.includes(permission) || context.permissions.includes('admin');
}

/**
 * Check if execution context has any of the specified permissions
 * @param context Execution context to check
 * @param permissions Array of permissions to check for
 * @returns True if context has any of the permissions
 */
export function hasAnyPermission(context: ExecutionContext, permissions: readonly string[]): boolean {
  if (!context.permissions || permissions.length === 0) {
    return false;
  }

  // Check for admin permission first
  if (context.permissions.includes('admin')) {
    return true;
  }

  return permissions.some(permission => context.permissions!.includes(permission));
}

/**
 * Check if execution context has all specified permissions
 * @param context Execution context to check
 * @param permissions Array of permissions to check for
 * @returns True if context has all permissions
 */
export function hasAllPermissions(context: ExecutionContext, permissions: readonly string[]): boolean {
  if (!context.permissions) {
    return permissions.length === 0;
  }

  // Admin permission grants all permissions
  if (context.permissions.includes('admin')) {
    return true;
  }

  return permissions.every(permission => context.permissions!.includes(permission));
}

/**
 * Check if execution context has specific capability
 * @param context Execution context to check
 * @param capability Capability to check for
 * @returns True if context has capability
 */
export function hasCapability(context: ExecutionContext, capability: ToolCapability): boolean {
  if (!context.capabilities) {
    return false;
  }

  return context.capabilities.includes(capability);
}

/**
 * Check if execution context has any of the specified capabilities
 * @param context Execution context to check
 * @param capabilities Array of capabilities to check for
 * @returns True if context has any of the capabilities
 */
export function hasAnyCapability(context: ExecutionContext, capabilities: readonly ToolCapability[]): boolean {
  if (!context.capabilities || capabilities.length === 0) {
    return false;
  }

  return capabilities.some(capability => context.capabilities!.includes(capability));
}

/**
 * Check if execution context has all specified capabilities
 * @param context Execution context to check
 * @param capabilities Array of capabilities to check for
 * @returns True if context has all capabilities
 */
export function hasAllCapabilities(context: ExecutionContext, capabilities: readonly ToolCapability[]): boolean {
  if (!context.capabilities) {
    return capabilities.length === 0;
  }

  return capabilities.every(capability => context.capabilities!.includes(capability));
}

/**
 * Get missing permissions from execution context
 * @param context Execution context to check
 * @param requiredPermissions Required permissions
 * @returns Array of missing permissions
 */
export function getMissingPermissions(
  context: ExecutionContext,
  requiredPermissions: readonly string[]
): string[] {
  if (!context.permissions) {
    return [...requiredPermissions];
  }

  // Admin permission grants all permissions
  if (context.permissions.includes('admin')) {
    return [];
  }

  return requiredPermissions.filter(permission => !context.permissions!.includes(permission));
}

/**
 * Get missing capabilities from execution context
 * @param context Execution context to check
 * @param requiredCapabilities Required capabilities
 * @returns Array of missing capabilities
 */
export function getMissingCapabilities(
  context: ExecutionContext,
  requiredCapabilities: readonly ToolCapability[]
): ToolCapability[] {
  if (!context.capabilities) {
    return [...requiredCapabilities];
  }

  return requiredCapabilities.filter(capability => !context.capabilities!.includes(capability));
}

/**
 * Merge execution contexts (second context takes precedence)
 * @param baseContext Base execution context
 * @param overrideContext Override execution context
 * @returns Merged execution context
 */
export function mergeExecutionContexts(
  baseContext: ExecutionContext,
  overrideContext: Partial<ExecutionContext>
): ExecutionContext {
  return {
    agentId: overrideContext.agentId ?? baseContext.agentId,
    userId: overrideContext.userId ?? baseContext.userId,
    workspaceId: overrideContext.workspaceId ?? baseContext.workspaceId,
    sessionId: overrideContext.sessionId ?? baseContext.sessionId,
    permissions: overrideContext.permissions ?? baseContext.permissions,
    capabilities: overrideContext.capabilities ?? baseContext.capabilities,
    metadata: {
      ...baseContext.metadata,
      ...overrideContext.metadata
    },
    traceId: overrideContext.traceId ?? baseContext.traceId
  };
}

/**
 * Clone execution context with optional overrides
 * @param context Execution context to clone
 * @param overrides Optional overrides
 * @returns Cloned execution context
 */
export function cloneExecutionContext(
  context: ExecutionContext,
  overrides: Partial<ExecutionContext> = {}
): ExecutionContext {
  return {
    agentId: overrides.agentId ?? context.agentId,
    userId: overrides.userId ?? context.userId,
    workspaceId: overrides.workspaceId ?? context.workspaceId,
    sessionId: overrides.sessionId ?? context.sessionId,
    permissions: overrides.permissions ?? (context.permissions ? [...context.permissions] : undefined),
    capabilities: overrides.capabilities ?? (context.capabilities ? [...context.capabilities] : undefined),
    metadata: overrides.metadata ?? (context.metadata ? { ...context.metadata } : undefined),
    traceId: overrides.traceId ?? context.traceId
  };
}

/**
 * Create execution context for system operations
 * @param operation Operation being performed
 * @param metadata Optional metadata
 * @returns System execution context
 */
export function createSystemExecutionContext(
  operation: string,
  metadata: Record<string, unknown> = {}
): ExecutionContext {
  return createExecutionContext({
    agentId: 'system',
    sessionId: ulid(),
    permissions: ['system', 'admin'],
    capabilities: Object.values(ToolCapability),
    metadata: {
      operation,
      systemContext: true,
      ...metadata
    },
    generateTraceId: true
  });
}

/**
 * Check if execution context is from system
 * @param context Execution context to check
 * @returns True if context is from system
 */
export function isSystemContext(context: ExecutionContext): boolean {
  return context.agentId === 'system' ||
    context.metadata?.systemContext === true ||
    hasPermission(context, 'system');
}

/**
 * Sanitize execution context for logging (remove sensitive data)
 * @param context Execution context to sanitize
 * @returns Sanitized context safe for logging
 */
export function sanitizeExecutionContext(context: ExecutionContext): Record<string, unknown> {
  return {
    agentId: context.agentId,
    userId: context.userId ? `user_${context.userId.substring(0, 8)}...` : undefined,
    workspaceId: context.workspaceId,
    sessionId: context.sessionId,
    permissionCount: context.permissions?.length || 0,
    capabilityCount: context.capabilities?.length || 0,
    hasMetadata: !!context.metadata && Object.keys(context.metadata).length > 0,
    traceId: context.traceId
  };
} 