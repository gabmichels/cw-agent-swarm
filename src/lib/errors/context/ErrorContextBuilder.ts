/**
 * Error Context Builder System
 * 
 * Following IMPLEMENTATION_GUIDELINES.md:
 * - Pure functions for context building
 * - Immutable data patterns
 * - Strict typing with validation
 * - Interface-first design
 */

import {
  BaseErrorContext
} from '../types/BaseError';
import {
  ToolExecutionContext,
  ToolExecutionMetadata
} from '../types/ToolExecutionError';
import {
  WorkspacePermissionContext,
  WorkspacePermissionMetadata
} from '../types/WorkspacePermissionError';

/**
 * Base context builder for all error contexts
 */
export abstract class BaseErrorContextBuilder<T extends BaseErrorContext> {
  protected context: Partial<Omit<T, 'timestamp'>> = {};

  /**
   * Set agent ID for the error context
   */
  withAgentId(agentId: string): this {
    (this.context as any).agentId = agentId;
    return this;
  }

  /**
   * Set user ID for the error context
   */
  withUserId(userId: string): this {
    (this.context as any).userId = userId;
    return this;
  }

  /**
   * Set session ID for the error context
   */
  withSessionId(sessionId: string): this {
    (this.context as any).sessionId = sessionId;
    return this;
  }

  /**
   * Set conversation ID for the error context
   */
  withConversationId(conversationId: string): this {
    (this.context as any).conversationId = conversationId;
    return this;
  }

  /**
   * Set request ID for the error context
   */
  withRequestId(requestId: string): this {
    (this.context as any).requestId = requestId;
    return this;
  }

  /**
   * Set environment for the error context
   */
  withEnvironment(environment: string): this {
    (this.context as any).environment = environment;
    return this;
  }

  /**
   * Set server instance for the error context
   */
  withServerInstance(serverInstance: string): this {
    (this.context as any).serverInstance = serverInstance;
    return this;
  }

  /**
   * Set version for the error context
   */
  withVersion(version: string): this {
    (this.context as any).version = version;
    return this;
  }

  /**
   * Build the context with validation
   */
  abstract build(): T;

  /**
   * Validate the context (implemented by subclasses)
   */
  protected abstract validate(): readonly string[];

  /**
   * Get validation errors if any
   */
  getValidationErrors(): readonly string[] {
    return this.validate();
  }

  /**
   * Check if context is valid
   */
  isValid(): boolean {
    return this.validate().length === 0;
  }
}

/**
 * Tool execution context builder
 */
export class ToolExecutionContextBuilder extends BaseErrorContextBuilder<ToolExecutionContext> {
  /**
   * Set tool ID (required)
   */
  withToolId(toolId: string): this {
    (this.context as any).toolId = toolId;
    return this;
  }

  /**
   * Set tool name
   */
  withToolName(toolName: string): this {
    (this.context as any).toolName = toolName;
    return this;
  }

  /**
   * Set operation (required)
   */
  withOperation(operation: string): this {
    (this.context as any).operation = operation;
    return this;
  }

  /**
   * Set tool parameters
   */
  withParameters(parameters: Record<string, unknown>): this {
    (this.context as any).parameters = { ...parameters };
    return this;
  }

  /**
   * Set execution start time
   */
  withExecutionStartTime(startTime: Date): this {
    (this.context as any).executionStartTime = new Date(startTime);
    return this;
  }

  /**
   * Set execution duration in milliseconds
   */
  withExecutionDuration(durationMs: number): this {
    (this.context as any).executionDuration = Math.max(0, durationMs);
    return this;
  }

  /**
   * Set tool version
   */
  withToolVersion(version: string): this {
    (this.context as any).toolVersion = version;
    return this;
  }

  /**
   * Set registry ID
   */
  withRegistryId(registryId: string): this {
    (this.context as any).registryId = registryId;
    return this;
  }

  /**
   * Set timestamp
   */
  withTimestamp(timestamp: Date): this {
    (this.context as any).timestamp = new Date(timestamp);
    return this;
  }

  /**
   * Validate tool execution context
   */
  protected validate(): readonly string[] {
    const errors: string[] = [];
    const ctx = this.context as Partial<ToolExecutionContext>;

    if (!ctx.toolId?.trim()) {
      errors.push('Tool ID is required');
    }

    if (!ctx.operation?.trim()) {
      errors.push('Operation is required');
    }

    if (ctx.executionDuration !== undefined && ctx.executionDuration < 0) {
      errors.push('Execution duration cannot be negative');
    }

    return errors;
  }

  /**
   * Build the tool execution context
   */
  build(): ToolExecutionContext {
    const validationErrors = this.validate();
    if (validationErrors.length > 0) {
      throw new Error(`Invalid tool execution context: ${validationErrors.join(', ')}`);
    }

    const ctx = this.context as Partial<ToolExecutionContext>;
    return {
      ...ctx,
      toolId: ctx.toolId!,
      operation: ctx.operation!,
      timestamp: new Date()
    } as ToolExecutionContext;
  }
}

/**
 * Workspace permission context builder
 */
export class WorkspacePermissionContextBuilder extends BaseErrorContextBuilder<WorkspacePermissionContext> {
  /**
   * Set workspace provider (required)
   */
  withWorkspaceProvider(provider: string): this {
    (this.context as any).workspaceProvider = provider;
    return this;
  }

  /**
   * Set workspace connection ID
   */
  withWorkspaceConnectionId(connectionId: string): this {
    (this.context as any).workspaceConnectionId = connectionId;
    return this;
  }

  /**
   * Set operation (required)
   */
  withOperation(operation: string): this {
    (this.context as any).operation = operation;
    return this;
  }

  /**
   * Set required capability (required)
   */
  withRequiredCapability(capability: string): this {
    (this.context as any).requiredCapability = capability;
    return this;
  }

  /**
   * Set current access level
   */
  withCurrentAccessLevel(accessLevel: string): this {
    (this.context as any).currentAccessLevel = accessLevel;
    return this;
  }

  /**
   * Set required access level (required)
   */
  withRequiredAccessLevel(accessLevel: string): this {
    (this.context as any).requiredAccessLevel = accessLevel;
    return this;
  }

  /**
   * Set connection status
   */
  withConnectionStatus(status: string): this {
    (this.context as any).connectionStatus = status;
    return this;
  }

  /**
   * Set token expires at
   */
  withTokenExpiresAt(expiresAt: Date): this {
    (this.context as any).tokenExpiresAt = new Date(expiresAt);
    return this;
  }

  /**
   * Set last sync time
   */
  withLastSyncAt(lastSync: Date): this {
    (this.context as any).lastSyncAt = new Date(lastSync);
    return this;
  }

  /**
   * Validate workspace permission context
   */
  protected validate(): readonly string[] {
    const errors: string[] = [];
    const ctx = this.context as Partial<WorkspacePermissionContext>;

    if (!ctx.workspaceProvider?.trim()) {
      errors.push('Workspace provider is required');
    }

    if (!ctx.operation?.trim()) {
      errors.push('Operation is required');
    }

    if (!ctx.requiredCapability?.trim()) {
      errors.push('Required capability is required');
    }

    if (!ctx.requiredAccessLevel?.trim()) {
      errors.push('Required access level is required');
    }

    // Validate known providers
    const validProviders = ['GOOGLE_WORKSPACE', 'MICROSOFT_365', 'ZOHO'];
    if (ctx.workspaceProvider && !validProviders.includes(ctx.workspaceProvider.toUpperCase())) {
      errors.push(`Invalid workspace provider: ${ctx.workspaceProvider}`);
    }

    // Validate access levels
    const validAccessLevels = ['NONE', 'READ', 'WRITE', 'ADMIN'];
    if (ctx.requiredAccessLevel && !validAccessLevels.includes(ctx.requiredAccessLevel.toUpperCase())) {
      errors.push(`Invalid required access level: ${ctx.requiredAccessLevel}`);
    }

    if (ctx.currentAccessLevel && !validAccessLevels.includes(ctx.currentAccessLevel.toUpperCase())) {
      errors.push(`Invalid current access level: ${ctx.currentAccessLevel}`);
    }

    return errors;
  }

  /**
   * Build the workspace permission context
   */
  build(): WorkspacePermissionContext {
    const validationErrors = this.validate();
    if (validationErrors.length > 0) {
      throw new Error(`Invalid workspace permission context: ${validationErrors.join(', ')}`);
    }

    const ctx = this.context as Partial<WorkspacePermissionContext>;
    return {
      ...ctx,
      workspaceProvider: ctx.workspaceProvider!,
      operation: ctx.operation!,
      requiredCapability: ctx.requiredCapability!,
      requiredAccessLevel: ctx.requiredAccessLevel!,
      timestamp: new Date()
    } as WorkspacePermissionContext;
  }
}

/**
 * Metadata builder for tool execution errors
 */
export class ToolExecutionMetadataBuilder {
  private metadata: Record<string, any> = {};

  /**
   * Set if tool is registered
   */
  withToolRegistered(registered: boolean): this {
    this.metadata.toolRegistered = registered;
    return this;
  }

  /**
   * Set if permissions are granted
   */
  withPermissionsGranted(granted: boolean): this {
    this.metadata.permissionsGranted = granted;
    return this;
  }

  /**
   * Set if input was validated
   */
  withInputValidated(validated: boolean): this {
    this.metadata.inputValidated = validated;
    return this;
  }

  /**
   * Set if timeout occurred
   */
  withTimeoutOccurred(timeout: boolean): this {
    this.metadata.timeoutOccurred = timeout;
    return this;
  }

  /**
   * Set if resources are available
   */
  withResourcesAvailable(available: boolean): this {
    this.metadata.resourcesAvailable = available;
    return this;
  }

  /**
   * Set if dependencies are met
   */
  withDependenciesMet(met: boolean): this {
    this.metadata.dependenciesMet = met;
    return this;
  }

  /**
   * Set if fallback is available
   */
  withFallbackAvailable(available: boolean): this {
    this.metadata.fallbackAvailable = available;
    return this;
  }

  /**
   * Set previous success count
   */
  withPreviousSuccessCount(count: number): this {
    this.metadata.previousSuccessCount = Math.max(0, count);
    return this;
  }

  /**
   * Set previous failure count
   */
  withPreviousFailureCount(count: number): this {
    this.metadata.previousFailureCount = Math.max(0, count);
    return this;
  }

  /**
   * Set last success time
   */
  withLastSuccessAt(successAt: Date): this {
    this.metadata.lastSuccessAt = successAt.toISOString();
    return this;
  }

  /**
   * Set execution time in milliseconds
   */
  withExecutionTime(timeMs: number): this {
    this.metadata.executionTime = Math.max(0, timeMs);
    return this;
  }

  /**
   * Build the metadata
   */
  build(): ToolExecutionMetadata {
    return {
      toolRegistered: true,
      permissionsGranted: true,
      inputValidated: true,
      timeoutOccurred: false,
      resourcesAvailable: true,
      dependenciesMet: true,
      fallbackAvailable: false,
      previousSuccessCount: 0,
      previousFailureCount: 0,
      ...this.metadata
    };
  }
}

/**
 * Metadata builder for workspace permission errors
 */
export class WorkspacePermissionMetadataBuilder {
  private metadata: Record<string, any> = {};

  /**
   * Set if connection exists
   */
  withConnectionExists(exists: boolean): this {
    this.metadata.connectionExists = exists;
    return this;
  }

  /**
   * Set if token is valid
   */
  withTokenValid(valid: boolean): this {
    this.metadata.tokenValid = valid;
    return this;
  }

  /**
   * Set granted scopes
   */
  withScopesGranted(scopes: readonly string[]): this {
    this.metadata.scopesGranted = [...scopes];
    return this;
  }

  /**
   * Set required scopes
   */
  withRequiredScopes(scopes: readonly string[]): this {
    this.metadata.requiredScopes = [...scopes];
    return this;
  }

  /**
   * Set permission granted by user
   */
  withPermissionGrantedBy(grantedBy: string): this {
    this.metadata.permissionGrantedBy = grantedBy;
    return this;
  }

  /**
   * Set permission granted time
   */
  withPermissionGrantedAt(grantedAt: Date): this {
    this.metadata.permissionGrantedAt = grantedAt.toISOString();
    return this;
  }

  /**
   * Set permission last used time
   */
  withPermissionLastUsed(lastUsed: Date): this {
    this.metadata.permissionLastUsed = lastUsed.toISOString();
    return this;
  }

  /**
   * Set if refresh token is available
   */
  withRefreshTokenAvailable(available: boolean): this {
    this.metadata.refreshTokenAvailable = available;
    return this;
  }

  /**
   * Set if auto refresh is possible
   */
  withCanAutoRefresh(canRefresh: boolean): this {
    this.metadata.canAutoRefresh = canRefresh;
    return this;
  }

  /**
   * Set if user re-authentication is required
   */
  withRequiresUserReauth(requiresReauth: boolean): this {
    this.metadata.requiresUserReauth = requiresReauth;
    return this;
  }

  /**
   * Set connection count
   */
  withConnectionCount(count: number): this {
    this.metadata.connectionCount = Math.max(0, count);
    return this;
  }

  /**
   * Build the metadata
   */
  build(): WorkspacePermissionMetadata {
    return {
      connectionExists: false,
      tokenValid: false,
      scopesGranted: [],
      requiredScopes: [],
      refreshTokenAvailable: false,
      canAutoRefresh: false,
      requiresUserReauth: false,
      connectionCount: 0,
      ...this.metadata
    };
  }
}

/**
 * Utility functions for context creation
 */
export class ErrorContextUtils {
  /**
   * Create a tool execution context builder
   */
  static createToolExecutionContext(): ToolExecutionContextBuilder {
    return new ToolExecutionContextBuilder();
  }

  /**
   * Create a workspace permission context builder
   */
  static createWorkspacePermissionContext(): WorkspacePermissionContextBuilder {
    return new WorkspacePermissionContextBuilder();
  }

  /**
   * Create a tool execution metadata builder
   */
  static createToolExecutionMetadata(): ToolExecutionMetadataBuilder {
    return new ToolExecutionMetadataBuilder();
  }

  /**
   * Create a workspace permission metadata builder
   */
  static createWorkspacePermissionMetadata(): WorkspacePermissionMetadataBuilder {
    return new WorkspacePermissionMetadataBuilder();
  }

  /**
   * Extract environment info from process
   */
  static extractEnvironmentContext(): Partial<BaseErrorContext> {
    return {
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version,
      serverInstance: process.env.HOSTNAME || 'unknown'
    };
  }

  /**
   * Create context from HTTP request (if available)
   */
  static createContextFromRequest(request?: {
    headers?: Record<string, string | string[] | undefined>;
    url?: string;
    method?: string;
  }): Partial<BaseErrorContext> {
    if (!request) {
      return {};
    }

    const headers = request.headers || {};
    return {
      requestId: Array.isArray(headers['x-request-id'])
        ? headers['x-request-id'][0]
        : headers['x-request-id'] as string,
      userId: Array.isArray(headers['x-user-id'])
        ? headers['x-user-id'][0]
        : headers['x-user-id'] as string,
      sessionId: Array.isArray(headers['x-session-id'])
        ? headers['x-session-id'][0]
        : headers['x-session-id'] as string
    };
  }
} 