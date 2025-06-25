/**
 * Workspace Permission Error Implementation
 * 
 * Specialized error type for workspace permission and access issues
 * Following IMPLEMENTATION_GUIDELINES.md patterns
 */

import {
  BaseError,
  BaseErrorContext,
  ErrorMetadata,
  ErrorSeverity,
  ErrorType,
  RetryStrategy,
  UserImpactLevel
} from './BaseError';

/**
 * Workspace permission specific context
 */
export interface WorkspacePermissionContext extends BaseErrorContext {
  readonly workspaceConnectionId?: string;
  readonly workspaceProvider: string; // GOOGLE_WORKSPACE, MICROSOFT_365, ZOHO
  readonly operation: string;
  readonly requiredCapability: string;
  readonly currentAccessLevel?: string;
  readonly requiredAccessLevel: string;
  readonly connectionStatus?: string;
  readonly tokenExpiresAt?: Date;
  readonly lastSyncAt?: Date;
}

/**
 * Workspace permission error metadata
 */
export interface WorkspacePermissionMetadata extends ErrorMetadata {
  readonly connectionExists: boolean;
  readonly tokenValid: boolean;
  readonly scopesGranted: readonly string[];
  readonly requiredScopes: readonly string[];
  readonly permissionGrantedBy?: string;
  readonly permissionGrantedAt?: string; // ISO string
  readonly permissionLastUsed?: string; // ISO string
  readonly refreshTokenAvailable: boolean;
  readonly canAutoRefresh: boolean;
  readonly requiresUserReauth: boolean;
  readonly connectionCount: number;
}

/**
 * Workspace permission specific error codes
 */
export enum WorkspacePermissionErrorCode {
  PERMISSION_NOT_GRANTED = 'PERMISSION_NOT_GRANTED',
  ACCESS_LEVEL_INSUFFICIENT = 'ACCESS_LEVEL_INSUFFICIENT',
  CONNECTION_NOT_FOUND = 'CONNECTION_NOT_FOUND',
  CONNECTION_EXPIRED = 'CONNECTION_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  SCOPE_INSUFFICIENT = 'SCOPE_INSUFFICIENT',
  REFRESH_TOKEN_INVALID = 'REFRESH_TOKEN_INVALID',
  PROVIDER_ACCESS_DENIED = 'PROVIDER_ACCESS_DENIED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  CONNECTION_REVOKED = 'CONNECTION_REVOKED'
}

/**
 * Workspace permission error interface
 */
export interface WorkspacePermissionError extends BaseError {
  readonly type: ErrorType.PERMISSION_DENIED;
  readonly context: WorkspacePermissionContext;
  readonly metadata: WorkspacePermissionMetadata;
  readonly errorCode: WorkspacePermissionErrorCode;
}

/**
 * Workspace permission error input
 */
export interface WorkspacePermissionErrorInput {
  readonly workspaceConnectionId?: string;
  readonly workspaceProvider: string;
  readonly operation: string;
  readonly requiredCapability: string;
  readonly currentAccessLevel?: string;
  readonly requiredAccessLevel: string;
  readonly message: string;
  readonly userMessage?: string;
  readonly errorCode: WorkspacePermissionErrorCode;
  readonly stackTrace?: string;
  readonly context: Partial<BaseErrorContext>;
  readonly metadata?: Partial<WorkspacePermissionMetadata>;
  readonly severity?: ErrorSeverity;
  readonly userImpact?: UserImpactLevel;
  readonly connectionStatus?: string;
  readonly scopesGranted?: readonly string[];
  readonly requiredScopes?: readonly string[];
}

/**
 * Factory for creating workspace permission errors
 */
export class WorkspacePermissionErrorFactory {
  /**
   * Create a workspace permission error
   */
  static create(input: WorkspacePermissionErrorInput): WorkspacePermissionError {
    const now = new Date();

    const context: WorkspacePermissionContext = {
      ...input.context,
      workspaceConnectionId: input.workspaceConnectionId,
      workspaceProvider: input.workspaceProvider,
      operation: input.operation,
      requiredCapability: input.requiredCapability,
      currentAccessLevel: input.currentAccessLevel,
      requiredAccessLevel: input.requiredAccessLevel,
      connectionStatus: input.connectionStatus,
      timestamp: now
    };

    const metadata: WorkspacePermissionMetadata = {
      connectionExists: !!input.workspaceConnectionId,
      tokenValid: false,
      scopesGranted: input.scopesGranted ?? [],
      requiredScopes: input.requiredScopes ?? [],
      refreshTokenAvailable: false,
      canAutoRefresh: false,
      requiresUserReauth: false,
      connectionCount: 0,
      ...input.metadata
    };

    return {
      id: require('ulid').ulid(),
      type: ErrorType.PERMISSION_DENIED,
      category: this.getCategoryForCode(input.errorCode),
      severity: input.severity ?? this.getSeverityForCode(input.errorCode),
      status: require('./BaseError').ErrorStatus.NEW,
      message: input.message,
      userMessage: input.userMessage ?? this.generateUserMessage(input.errorCode, input.workspaceProvider, input.requiredCapability),
      errorCode: input.errorCode,
      stackTrace: input.stackTrace,
      context,
      metadata,
      timestamp: now,
      retryable: this.isRetryableCode(input.errorCode),
      retryAttempt: 0,
      maxRetries: this.getMaxRetriesForCode(input.errorCode),
      retryStrategy: this.getRetryStrategyForCode(input.errorCode),
      userImpact: input.userImpact ?? this.getUserImpactForCode(input.errorCode),
      parentErrorId: undefined,
      rootCauseErrorId: undefined,
      estimatedImpact: undefined
    };
  }

  /**
   * Get error category for error code
   */
  private static getCategoryForCode(code: WorkspacePermissionErrorCode): import('./BaseError').ErrorCategory {
    const { ErrorCategory } = require('./BaseError');

    switch (code) {
      case WorkspacePermissionErrorCode.PERMISSION_NOT_GRANTED:
      case WorkspacePermissionErrorCode.ACCESS_LEVEL_INSUFFICIENT:
      case WorkspacePermissionErrorCode.SCOPE_INSUFFICIENT:
        return ErrorCategory.USER_ACTION;

      case WorkspacePermissionErrorCode.CONNECTION_NOT_FOUND:
      case WorkspacePermissionErrorCode.CONNECTION_EXPIRED:
      case WorkspacePermissionErrorCode.CONNECTION_REVOKED:
        return ErrorCategory.SYSTEM;

      case WorkspacePermissionErrorCode.TOKEN_INVALID:
      case WorkspacePermissionErrorCode.TOKEN_EXPIRED:
      case WorkspacePermissionErrorCode.REFRESH_TOKEN_INVALID:
      case WorkspacePermissionErrorCode.PROVIDER_ACCESS_DENIED:
      case WorkspacePermissionErrorCode.RATE_LIMIT_EXCEEDED:
        return ErrorCategory.EXTERNAL;

      default:
        return ErrorCategory.USER_ACTION;
    }
  }

  /**
   * Get severity for error code
   */
  private static getSeverityForCode(code: WorkspacePermissionErrorCode): ErrorSeverity {
    switch (code) {
      case WorkspacePermissionErrorCode.CONNECTION_REVOKED:
      case WorkspacePermissionErrorCode.PROVIDER_ACCESS_DENIED:
        return ErrorSeverity.CRITICAL;

      case WorkspacePermissionErrorCode.CONNECTION_NOT_FOUND:
      case WorkspacePermissionErrorCode.CONNECTION_EXPIRED:
      case WorkspacePermissionErrorCode.TOKEN_INVALID:
      case WorkspacePermissionErrorCode.REFRESH_TOKEN_INVALID:
        return ErrorSeverity.HIGH;

      case WorkspacePermissionErrorCode.PERMISSION_NOT_GRANTED:
      case WorkspacePermissionErrorCode.ACCESS_LEVEL_INSUFFICIENT:
      case WorkspacePermissionErrorCode.SCOPE_INSUFFICIENT:
      case WorkspacePermissionErrorCode.TOKEN_EXPIRED:
        return ErrorSeverity.MEDIUM;

      case WorkspacePermissionErrorCode.RATE_LIMIT_EXCEEDED:
        return ErrorSeverity.LOW;

      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  /**
   * Check if error code is retryable
   */
  private static isRetryableCode(code: WorkspacePermissionErrorCode): boolean {
    switch (code) {
      case WorkspacePermissionErrorCode.TOKEN_EXPIRED:
      case WorkspacePermissionErrorCode.RATE_LIMIT_EXCEEDED:
        return true; // Can retry after token refresh or delay

      case WorkspacePermissionErrorCode.CONNECTION_EXPIRED:
        return true; // May be auto-refreshed

      case WorkspacePermissionErrorCode.PERMISSION_NOT_GRANTED:
      case WorkspacePermissionErrorCode.ACCESS_LEVEL_INSUFFICIENT:
      case WorkspacePermissionErrorCode.SCOPE_INSUFFICIENT:
      case WorkspacePermissionErrorCode.CONNECTION_NOT_FOUND:
      case WorkspacePermissionErrorCode.TOKEN_INVALID:
      case WorkspacePermissionErrorCode.REFRESH_TOKEN_INVALID:
      case WorkspacePermissionErrorCode.PROVIDER_ACCESS_DENIED:
      case WorkspacePermissionErrorCode.CONNECTION_REVOKED:
        return false; // Requires user intervention

      default:
        return false;
    }
  }

  /**
   * Get max retries for error code
   */
  private static getMaxRetriesForCode(code: WorkspacePermissionErrorCode): number {
    switch (code) {
      case WorkspacePermissionErrorCode.TOKEN_EXPIRED:
      case WorkspacePermissionErrorCode.CONNECTION_EXPIRED:
        return 2; // Try token refresh once

      case WorkspacePermissionErrorCode.RATE_LIMIT_EXCEEDED:
        return 3; // Retry with backoff

      default:
        return 0; // Non-retryable
    }
  }

  /**
   * Get retry strategy for error code
   */
  private static getRetryStrategyForCode(code: WorkspacePermissionErrorCode): RetryStrategy {
    switch (code) {
      case WorkspacePermissionErrorCode.TOKEN_EXPIRED:
      case WorkspacePermissionErrorCode.CONNECTION_EXPIRED:
        return RetryStrategy.IMMEDIATE; // Try refresh immediately

      case WorkspacePermissionErrorCode.RATE_LIMIT_EXCEEDED:
        return RetryStrategy.EXPONENTIAL_BACKOFF; // Respect rate limits

      default:
        return RetryStrategy.NO_RETRY;
    }
  }

  /**
   * Get user impact for error code
   */
  private static getUserImpactForCode(code: WorkspacePermissionErrorCode): UserImpactLevel {
    switch (code) {
      case WorkspacePermissionErrorCode.CONNECTION_REVOKED:
      case WorkspacePermissionErrorCode.PROVIDER_ACCESS_DENIED:
        return UserImpactLevel.CRITICAL;

      case WorkspacePermissionErrorCode.PERMISSION_NOT_GRANTED:
      case WorkspacePermissionErrorCode.ACCESS_LEVEL_INSUFFICIENT:
      case WorkspacePermissionErrorCode.SCOPE_INSUFFICIENT:
      case WorkspacePermissionErrorCode.CONNECTION_NOT_FOUND:
        return UserImpactLevel.HIGH;

      case WorkspacePermissionErrorCode.CONNECTION_EXPIRED:
      case WorkspacePermissionErrorCode.TOKEN_INVALID:
      case WorkspacePermissionErrorCode.TOKEN_EXPIRED:
      case WorkspacePermissionErrorCode.REFRESH_TOKEN_INVALID:
        return UserImpactLevel.MEDIUM;

      case WorkspacePermissionErrorCode.RATE_LIMIT_EXCEEDED:
        return UserImpactLevel.LOW;

      default:
        return UserImpactLevel.MEDIUM;
    }
  }

  /**
   * Generate user-friendly message for error code
   */
  private static generateUserMessage(code: WorkspacePermissionErrorCode, provider: string, capability: string): string {
    const providerName = this.getProviderDisplayName(provider);
    const capabilityName = this.getCapabilityDisplayName(capability);

    switch (code) {
      case WorkspacePermissionErrorCode.PERMISSION_NOT_GRANTED:
        return `I don't have permission to ${capabilityName} in your ${providerName} account. Please grant this permission in your agent settings.`;

      case WorkspacePermissionErrorCode.ACCESS_LEVEL_INSUFFICIENT:
        return `I need higher access permissions to ${capabilityName} in ${providerName}. Please update my permissions.`;

      case WorkspacePermissionErrorCode.CONNECTION_NOT_FOUND:
        return `Your ${providerName} account isn't connected. Please connect your workspace in the settings.`;

      case WorkspacePermissionErrorCode.CONNECTION_EXPIRED:
        return `Your ${providerName} connection has expired. I'll try to refresh it automatically.`;

      case WorkspacePermissionErrorCode.TOKEN_INVALID:
        return `There's an issue with your ${providerName} authentication. You may need to reconnect your account.`;

      case WorkspacePermissionErrorCode.TOKEN_EXPIRED:
        return `Your ${providerName} access token has expired. I'm refreshing it now.`;

      case WorkspacePermissionErrorCode.SCOPE_INSUFFICIENT:
        return `I need additional permissions to ${capabilityName} in ${providerName}. Please re-authorize with the required permissions.`;

      case WorkspacePermissionErrorCode.REFRESH_TOKEN_INVALID:
        return `I can't refresh your ${providerName} connection. Please reconnect your account.`;

      case WorkspacePermissionErrorCode.PROVIDER_ACCESS_DENIED:
        return `${providerName} denied access to your account. Please check your account settings and reconnect.`;

      case WorkspacePermissionErrorCode.RATE_LIMIT_EXCEEDED:
        return `${providerName} rate limit exceeded. I'll retry in a moment.`;

      case WorkspacePermissionErrorCode.CONNECTION_REVOKED:
        return `Your ${providerName} connection has been revoked. Please reconnect your account.`;

      default:
        return `I'm having trouble accessing your ${providerName} account for ${capabilityName}. Please check your connection.`;
    }
  }

  /**
   * Get display name for provider
   */
  private static getProviderDisplayName(provider: string): string {
    switch (provider.toUpperCase()) {
      case 'GOOGLE_WORKSPACE':
        return 'Google Workspace';
      case 'MICROSOFT_365':
        return 'Microsoft 365';
      case 'ZOHO':
        return 'Zoho';
      default:
        return provider;
    }
  }

  /**
   * Get display name for capability
   */
  private static getCapabilityDisplayName(capability: string): string {
    switch (capability.toUpperCase()) {
      case 'EMAIL_SEND':
        return 'send emails';
      case 'EMAIL_READ':
        return 'read emails';
      case 'CALENDAR_CREATE':
        return 'create calendar events';
      case 'CALENDAR_READ':
        return 'read calendar events';
      case 'CONTACTS_READ':
        return 'read contacts';
      case 'DRIVE_READ':
        return 'read files';
      case 'DRIVE_WRITE':
        return 'manage files';
      case 'SPREADSHEETS_READ':
        return 'read spreadsheets';
      case 'SPREADSHEETS_WRITE':
        return 'edit spreadsheets';
      default:
        return capability.toLowerCase().replace('_', ' ');
    }
  }
}

/**
 * Type guards for workspace permission errors
 */
export class WorkspacePermissionErrorGuards {
  static isWorkspacePermissionError(error: BaseError): error is WorkspacePermissionError {
    return error.type === ErrorType.PERMISSION_DENIED;
  }

  static requiresUserReconnection(error: WorkspacePermissionError): boolean {
    return error.errorCode === WorkspacePermissionErrorCode.CONNECTION_NOT_FOUND ||
      error.errorCode === WorkspacePermissionErrorCode.CONNECTION_REVOKED ||
      error.errorCode === WorkspacePermissionErrorCode.REFRESH_TOKEN_INVALID ||
      error.errorCode === WorkspacePermissionErrorCode.PROVIDER_ACCESS_DENIED;
  }

  static canAutoRefresh(error: WorkspacePermissionError): boolean {
    return error.errorCode === WorkspacePermissionErrorCode.TOKEN_EXPIRED ||
      error.errorCode === WorkspacePermissionErrorCode.CONNECTION_EXPIRED;
  }

  static requiresPermissionGrant(error: WorkspacePermissionError): boolean {
    return error.errorCode === WorkspacePermissionErrorCode.PERMISSION_NOT_GRANTED ||
      error.errorCode === WorkspacePermissionErrorCode.ACCESS_LEVEL_INSUFFICIENT ||
      error.errorCode === WorkspacePermissionErrorCode.SCOPE_INSUFFICIENT;
  }

  static isRateLimited(error: WorkspacePermissionError): boolean {
    return error.errorCode === WorkspacePermissionErrorCode.RATE_LIMIT_EXCEEDED;
  }
} 