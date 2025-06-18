/**
 * Workspace Error Handler Utility
 * 
 * Provides consistent error handling and formatting for workspace operations
 */

import { 
  WorkspacePermissionError, 
  WorkspacePermissionErrorFactory, 
  formatWorkspaceErrorForAgent,
  isResolvablePermissionError
} from '../errors/WorkspacePermissionErrors';
import { PermissionValidationResult } from '../AgentWorkspacePermissionService';
import { WorkspaceCapabilityType, WorkspaceProvider } from '../../database/types';

/**
 * Handle permission validation results and throw appropriate errors
 */
export function handlePermissionError(validation: PermissionValidationResult): void {
  if (validation.isValid) {
    return; // No error to handle
  }

  const error = validation.workspaceError;
  if (error) {
    throw new Error(formatWorkspaceErrorForAgent(error));
  }
  
  // Fallback for legacy error messages
  throw new Error(validation.error || 'Permission denied');
}

/**
 * Wrap workspace operation with standardized error handling
 */
export async function withWorkspaceErrorHandling<T>(
  operation: () => Promise<T>,
  context: {
    capability: WorkspaceCapabilityType;
    agentId: string;
    connectionId?: string;
    connectionName?: string;
    provider?: WorkspaceProvider;
  }
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // If it's already a workspace permission error, re-throw
    if (error instanceof Error && error.message.includes('💡')) {
      throw error;
    }

    // Handle different types of errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check for common OAuth/API errors
    if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
      if (context.connectionId && context.connectionName && context.provider) {
        const workspaceError = WorkspacePermissionErrorFactory.createExpiredTokenError(
          context.connectionId,
          context.connectionName,
          context.provider
        );
        throw new Error(formatWorkspaceErrorForAgent(workspaceError));
      }
    }
    
    if (errorMessage.includes('403') || errorMessage.includes('insufficient') || errorMessage.includes('scope')) {
      if (context.connectionName) {
        const workspaceError = WorkspacePermissionErrorFactory.createInsufficientScopesError(
          context.capability,
          context.connectionName,
          [], // We don't know the exact scopes here
          []
        );
        throw new Error(formatWorkspaceErrorForAgent(workspaceError));
      }
    }

    if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
      if (context.connectionName) {
        const workspaceError = WorkspacePermissionErrorFactory.createRateLimitError(
          context.capability,
          context.connectionName
        );
        throw new Error(formatWorkspaceErrorForAgent(workspaceError));
      }
    }

    if (errorMessage.includes('network') || errorMessage.includes('timeout') || errorMessage.includes('ENOTFOUND')) {
      const workspaceError = WorkspacePermissionErrorFactory.createNetworkError(
        context.capability,
        context.connectionName
      );
      throw new Error(formatWorkspaceErrorForAgent(workspaceError));
    }

    // If it's a provider-specific error and we have provider context
    if (context.provider && context.connectionName) {
      const workspaceError = WorkspacePermissionErrorFactory.createProviderError(
        context.provider,
        context.capability,
        errorMessage,
        context.connectionName
      );
      throw new Error(formatWorkspaceErrorForAgent(workspaceError));
    }

    // Re-throw original error if we can't enhance it
    throw error;
  }
}

/**
 * Create a user-friendly error message for missing tools
 */
export function createToolNotAvailableError(
  toolName: string,
  capability: WorkspaceCapabilityType,
  agentId: string
): Error {
  const workspaceError = WorkspacePermissionErrorFactory.createToolNotAvailableError(
    toolName,
    capability,
    agentId
  );
  return new Error(formatWorkspaceErrorForAgent(workspaceError));
}

/**
 * Check if an error message is a resolvable workspace permission error
 */
export function isResolvableWorkspaceError(errorMessage: string): boolean {
  return errorMessage.includes('💡') || 
         errorMessage.includes('permission') ||
         errorMessage.includes('expired') ||
         errorMessage.includes('connect') ||
         errorMessage.includes('grant');
} 