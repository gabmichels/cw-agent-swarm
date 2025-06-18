/**
 * Workspace Permission Error Handling System
 * 
 * Provides comprehensive error handling for workspace permission issues,
 * including user-friendly messages and actionable guidance.
 */

import { WorkspaceCapabilityType, WorkspaceProvider } from '../../database/types';

/**
 * Types of workspace permission errors
 */
export enum WorkspaceErrorType {
  NO_PERMISSION = 'NO_PERMISSION',
  NO_CONNECTION = 'NO_CONNECTION',
  EXPIRED_TOKEN = 'EXPIRED_TOKEN', 
  INSUFFICIENT_SCOPES = 'INSUFFICIENT_SCOPES',
  CONNECTION_INACTIVE = 'CONNECTION_INACTIVE',
  TOOL_NOT_AVAILABLE = 'TOOL_NOT_AVAILABLE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR'
}

/**
 * Detailed workspace error information
 */
export interface WorkspacePermissionError {
  type: WorkspaceErrorType;
  message: string;
  userMessage: string;
  actionRequired: string;
  capability?: WorkspaceCapabilityType;
  provider?: WorkspaceProvider;
  connectionId?: string;
  connectionName?: string;
  requiredScopes?: string[];
  availableScopes?: string[];
  details?: any;
}

/**
 * Factory for creating workspace permission errors
 */
export class WorkspacePermissionErrorFactory {
  
  /**
   * Create error for missing agent permission
   */
  static createNoPermissionError(
    capability: WorkspaceCapabilityType,
    agentId: string,
    connectionName?: string
  ): WorkspacePermissionError {
    const capabilityName = capability.replace(/_/g, ' ').toLowerCase();
    
    return {
      type: WorkspaceErrorType.NO_PERMISSION,
      message: `Agent ${agentId} does not have permission for ${capability}`,
      userMessage: `I don't have permission to access ${capabilityName} capabilities${connectionName ? ` for ${connectionName}` : ''}.`,
      actionRequired: `Please grant me ${capabilityName} permissions in your agent settings to enable this functionality.`,
      capability,
      connectionName
    };
  }

  /**
   * Create error for no workspace connections
   */
  static createNoConnectionError(
    capability: WorkspaceCapabilityType,
    provider?: WorkspaceProvider
  ): WorkspacePermissionError {
    const capabilityName = capability.replace(/_/g, ' ').toLowerCase();
    const providerName = provider ? provider.replace(/_/g, ' ') : 'workspace';
    
    return {
      type: WorkspaceErrorType.NO_CONNECTION,
      message: `No workspace connections available for ${capability}`,
      userMessage: `I need access to a ${providerName} account to perform ${capabilityName} operations.`,
      actionRequired: `Please connect your ${providerName} account in workspace settings first.`,
      capability,
      provider
    };
  }

  /**
   * Create error for expired OAuth tokens
   */
  static createExpiredTokenError(
    connectionId: string,
    connectionName: string,
    provider: WorkspaceProvider
  ): WorkspacePermissionError {
    const providerName = provider.replace(/_/g, ' ');
    
    return {
      type: WorkspaceErrorType.EXPIRED_TOKEN,
      message: `OAuth token expired for connection ${connectionId}`,
      userMessage: `My access to your ${connectionName} account has expired.`,
      actionRequired: `Please refresh the connection for ${connectionName} in your workspace settings, or reconnect your ${providerName} account.`,
      connectionId,
      connectionName,
      provider
    };
  }

  /**
   * Create error for insufficient OAuth scopes
   */
  static createInsufficientScopesError(
    capability: WorkspaceCapabilityType,
    connectionName: string,
    requiredScopes: string[],
    availableScopes: string[]
  ): WorkspacePermissionError {
    const capabilityName = capability.replace(/_/g, ' ').toLowerCase();
    const missingScopes = requiredScopes.filter(scope => !availableScopes.includes(scope));
    
    return {
      type: WorkspaceErrorType.INSUFFICIENT_SCOPES,
      message: `Insufficient OAuth scopes for ${capability}. Missing: ${missingScopes.join(', ')}`,
      userMessage: `Your ${connectionName} connection doesn't have the required permissions for ${capabilityName}.`,
      actionRequired: `Please reconnect your ${connectionName} account and grant the additional permissions when prompted.`,
      capability,
      connectionName,
      requiredScopes,
      availableScopes
    };
  }

  /**
   * Create error for inactive workspace connection
   */
  static createConnectionInactiveError(
    connectionId: string,
    connectionName: string,
    status: string
  ): WorkspacePermissionError {
    return {
      type: WorkspaceErrorType.CONNECTION_INACTIVE,
      message: `Workspace connection ${connectionId} is ${status}`,
      userMessage: `Your ${connectionName} connection is currently ${status.toLowerCase()}.`,
      actionRequired: `Please check your workspace connections and reactivate ${connectionName} if needed.`,
      connectionId,
      connectionName
    };
  }

  /**
   * Create error for unavailable tools
   */
  static createToolNotAvailableError(
    toolName: string,
    capability: WorkspaceCapabilityType,
    agentId: string
  ): WorkspacePermissionError {
    const capabilityName = capability.replace(/_/g, ' ').toLowerCase();
    
    return {
      type: WorkspaceErrorType.TOOL_NOT_AVAILABLE,
      message: `Tool ${toolName} not available for agent ${agentId}`,
      userMessage: `I don't have access to the ${toolName} tool needed for ${capabilityName} operations.`,
      actionRequired: `Please ensure I have the required workspace permissions and that the tool is properly configured.`,
      capability
    };
  }

  /**
   * Create error for rate limiting
   */
  static createRateLimitError(
    capability: WorkspaceCapabilityType,
    connectionName: string,
    resetTime?: Date
  ): WorkspacePermissionError {
    const capabilityName = capability.replace(/_/g, ' ').toLowerCase();
    const resetMessage = resetTime 
      ? ` Rate limit resets at ${resetTime.toLocaleTimeString()}.`
      : '';
    
    return {
      type: WorkspaceErrorType.RATE_LIMIT_EXCEEDED,
      message: `Rate limit exceeded for ${capability}`,
      userMessage: `I've reached the rate limit for ${capabilityName} operations on ${connectionName}.${resetMessage}`,
      actionRequired: `Please wait a moment and try again later.`,
      capability,
      connectionName
    };
  }

  /**
   * Create error for provider-specific issues
   */
  static createProviderError(
    provider: WorkspaceProvider,
    capability: WorkspaceCapabilityType,
    originalError: string,
    connectionName?: string
  ): WorkspacePermissionError {
    const providerName = provider.replace(/_/g, ' ');
    const capabilityName = capability.replace(/_/g, ' ').toLowerCase();
    
    return {
      type: WorkspaceErrorType.PROVIDER_ERROR,
      message: `Provider error: ${originalError}`,
      userMessage: `There was an issue with ${providerName} while performing ${capabilityName} operations${connectionName ? ` on ${connectionName}` : ''}.`,
      actionRequired: `This might be a temporary issue with ${providerName}. Please try again in a few minutes.`,
      capability,
      provider,
      connectionName,
      details: { originalError }
    };
  }

  /**
   * Create error for network issues
   */
  static createNetworkError(
    capability: WorkspaceCapabilityType,
    connectionName?: string
  ): WorkspacePermissionError {
    const capabilityName = capability.replace(/_/g, ' ').toLowerCase();
    
    return {
      type: WorkspaceErrorType.NETWORK_ERROR,
      message: `Network error during ${capability} operation`,
      userMessage: `I'm having trouble connecting to the workspace service${connectionName ? ` for ${connectionName}` : ''}.`,
      actionRequired: `Please check your internet connection and try again.`,
      capability,
      connectionName
    };
  }
}

/**
 * Format workspace error for user display
 */
export function formatWorkspaceErrorForUser(error: WorkspacePermissionError): string {
  return `${error.userMessage} ${error.actionRequired}`;
}

/**
 * Format workspace error for agent response
 */
export function formatWorkspaceErrorForAgent(error: WorkspacePermissionError): string {
  let message = error.userMessage;
  
  // Add helpful context based on error type
  switch (error.type) {
    case WorkspaceErrorType.NO_PERMISSION:
      message += `\n\n💡 **How to fix this:**\n1. Go to your agent settings\n2. Click "Edit" next to Workspace Permissions\n3. Enable the "${error.capability?.replace(/_/g, ' ').toLowerCase()}" capability\n4. Save your changes`;
      break;
      
         case WorkspaceErrorType.NO_CONNECTION:
       const providerName = error.provider?.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'workspace';
       message += `\n\n💡 **How to fix this:**\n1. Go to Workspace Settings\n2. Connect your ${providerName} account\n3. Grant the necessary permissions\n4. Return here and try again`;
       break;
      
    case WorkspaceErrorType.EXPIRED_TOKEN:
      message += `\n\n💡 **How to fix this:**\n1. Go to Workspace Settings\n2. Find your ${error.connectionName} connection\n3. Click "Try Refresh" or "Reconnect"\n4. Grant permissions when prompted`;
      break;
      
    case WorkspaceErrorType.INSUFFICIENT_SCOPES:
      message += `\n\n💡 **How to fix this:**\n1. Go to Workspace Settings\n2. Reconnect your ${error.connectionName} account\n3. Make sure to grant all requested permissions\n4. Try the operation again`;
      break;
  }
  
  return message;
}

/**
 * Check if error is permission-related and can be resolved by user
 */
export function isResolvablePermissionError(error: WorkspacePermissionError): boolean {
  return [
    WorkspaceErrorType.NO_PERMISSION,
    WorkspaceErrorType.NO_CONNECTION,
    WorkspaceErrorType.EXPIRED_TOKEN,
    WorkspaceErrorType.INSUFFICIENT_SCOPES,
    WorkspaceErrorType.CONNECTION_INACTIVE
  ].includes(error.type);
} 