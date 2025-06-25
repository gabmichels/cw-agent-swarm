import { getServiceConfig } from '../../lib/core/unified-config';
import { logger } from '../../lib/logging';
import { DatabaseService } from '../database/DatabaseService';
import { IDatabaseProvider } from '../database/IDatabaseProvider';
import {
  ConnectionStatus,
  WorkspaceCapabilityType,
  WorkspaceConnection,
  WorkspaceProvider
} from '../database/types';
import { GoogleWorkspaceProvider } from './providers/GoogleWorkspaceProvider';
import { ConnectionResult, IWorkspaceProvider, ValidationResult } from './providers/IWorkspaceProvider';
import { ZohoWorkspaceProvider } from './providers/ZohoWorkspaceProvider';

/**
 * Main workspace service that orchestrates multiple workspace providers
 * Handles connection management, token refresh, and validation across all providers
 */
export class WorkspaceService {
  private providers: Map<WorkspaceProvider, IWorkspaceProvider> = new Map();
  private db: IDatabaseProvider;

  constructor() {
    this.db = DatabaseService.getInstance();
    this.initializeProviders();
  }

  /**
   * Initialize all available workspace providers
   */
  private initializeProviders(): void {
    const initializedProviders: string[] = [];

    try {
      // Get OAuth configuration to check which providers are available
      const oauthConfig = getServiceConfig('oauth');

      // Initialize Google Workspace Provider only if credentials are configured
      if (oauthConfig.providers.google) {
        try {
          const googleProvider = new GoogleWorkspaceProvider();
          this.providers.set(WorkspaceProvider.GOOGLE_WORKSPACE, googleProvider);
          initializedProviders.push('Google Workspace');
        } catch (error) {
          logger.warn('Failed to initialize Google Workspace provider', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      } else {
        logger.debug('Google Workspace provider not initialized - credentials not configured');
      }

      // Initialize Zoho Workspace Provider only if credentials are configured
      if (oauthConfig.providers.zoho) {
        try {
          const zohoProvider = new ZohoWorkspaceProvider();
          this.providers.set(WorkspaceProvider.ZOHO, zohoProvider);
          initializedProviders.push('Zoho Workspace');
        } catch (error) {
          logger.warn('Failed to initialize Zoho Workspace provider', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      } else {
        logger.debug('Zoho Workspace provider not initialized - credentials not configured');
      }

      // TODO: Add Microsoft 365 provider when implemented
      // if (oauthConfig.providers.microsoft) {
      //   try {
      //     const microsoftProvider = new MicrosoftWorkspaceProvider();
      //     this.providers.set(WorkspaceProvider.MICROSOFT_365, microsoftProvider);
      //     initializedProviders.push('Microsoft 365');
      //   } catch (error) {
      //     logger.warn('Failed to initialize Microsoft 365 provider', { 
      //       error: error instanceof Error ? error.message : 'Unknown error' 
      //     });
      //   }
      // }

      if (initializedProviders.length > 0) {
        logger.info('Workspace providers initialized', {
          availableProviders: Array.from(this.providers.keys()),
          initializedProviders
        });
      } else {
        logger.info('No workspace providers initialized - no OAuth credentials configured');
      }
    } catch (error) {
      logger.error('Failed to initialize workspace providers', { error });
      // Don't throw error - service should work even without providers
    }
  }

  /**
   * Get provider instance for a specific workspace provider
   */
  private getProvider(provider: WorkspaceProvider): IWorkspaceProvider {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) {
      throw new Error(`Provider ${provider} not found or not initialized`);
    }
    return providerInstance;
  }

  /**
   * Refresh connection tokens using the appropriate provider
   */
  async refreshConnection(connectionId: string): Promise<ConnectionResult> {
    try {
      logger.debug('Refreshing workspace connection', { connectionId });

      // Get the connection to determine which provider to use
      const connection = await this.db.getWorkspaceConnection(connectionId);

      if (!connection) {
        logger.warn('Connection not found for refresh', { connectionId });
        return {
          success: false,
          error: 'Connection not found',
          connectionId
        };
      }

      if (!connection.refreshToken) {
        logger.warn('No refresh token available for connection', {
          connectionId,
          provider: connection.provider
        });
        return {
          success: false,
          error: 'No refresh token available',
          connectionId
        };
      }

      // Get the appropriate provider
      const provider = this.getProvider(connection.provider);

      // Refresh using the provider
      const result = await provider.refreshConnection(connectionId);

      if (result.success) {
        logger.info('Connection refreshed successfully', {
          connectionId,
          provider: connection.provider,
          email: connection.email
        });
      } else {
        logger.error('Connection refresh failed', {
          connectionId,
          provider: connection.provider,
          error: result.error
        });
      }

      return result;
    } catch (error) {
      logger.error('Error refreshing workspace connection', {
        connectionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        connectionId
      };
    }
  }

  /**
   * Validate connection using the appropriate provider
   */
  async validateConnection(connectionId: string): Promise<ValidationResult> {
    try {
      logger.debug('Validating workspace connection', { connectionId });

      const connection = await this.db.getWorkspaceConnection(connectionId);

      if (!connection) {
        return {
          isValid: false,
          status: ConnectionStatus.ERROR,
          error: 'Connection not found'
        };
      }

      const provider = this.getProvider(connection.provider);
      const result = await provider.validateConnection(connectionId);

      logger.debug('Connection validation result', {
        connectionId,
        provider: connection.provider,
        isValid: result.isValid,
        status: result.status
      });

      return result;
    } catch (error) {
      logger.error('Error validating workspace connection', {
        connectionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        isValid: false,
        status: ConnectionStatus.ERROR,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get all workspace connections with optional filtering
   */
  async getConnections(filters?: {
    provider?: WorkspaceProvider;
    status?: ConnectionStatus;
    userId?: string;
    organizationId?: string;
  }): Promise<WorkspaceConnection[]> {
    try {
      return await this.db.findWorkspaceConnections(filters || {});
    } catch (error) {
      logger.error('Error getting workspace connections', { error, filters });
      return [];
    }
  }

  /**
   * Get connections for a specific user
   */
  async getUserConnections(userId: string): Promise<WorkspaceConnection[]> {
    return this.getConnections({ userId });
  }

  /**
   * Get connections for a specific organization
   */
  async getOrganizationConnections(organizationId: string): Promise<WorkspaceConnection[]> {
    return this.getConnections({ organizationId });
  }

  /**
   * Get all workspace connections
   */
  async getAllConnections(): Promise<WorkspaceConnection[]> {
    return this.getConnections();
  }

  /**
   * Get connection by ID
   */
  async getConnection(connectionId: string): Promise<WorkspaceConnection | null> {
    try {
      return await this.db.getWorkspaceConnection(connectionId);
    } catch (error) {
      logger.error('Error getting workspace connection', { connectionId, error });
      return null;
    }
  }

  /**
   * Check health of all providers
   */
  async checkProviderHealth(): Promise<Record<WorkspaceProvider, boolean>> {
    const healthStatus: Record<WorkspaceProvider, boolean> = {} as any;

    for (const [providerType, provider] of Array.from(this.providers.entries())) {
      try {
        healthStatus[providerType] = await provider.isHealthy();
      } catch (error) {
        logger.warn(`Provider ${providerType} health check failed`, { error });
        healthStatus[providerType] = false;
      }
    }

    return healthStatus;
  }

  /**
   * Get supported capabilities for a provider
   */
  getSupportedCapabilities(provider: WorkspaceProvider): WorkspaceCapabilityType[] {
    try {
      const providerInstance = this.getProvider(provider);
      return providerInstance.supportedCapabilities;
    } catch (error) {
      logger.error(`Error getting capabilities for provider ${provider}`, { error });
      return [];
    }
  }

  /**
   * Get all available providers
   */
  getAvailableProviders(): WorkspaceProvider[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Revoke/disconnect a workspace connection
   */
  async revokeConnection(connectionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      logger.debug('Starting connection revocation', { connectionId });

      // Get the connection to determine provider
      const connection = await this.db.getWorkspaceConnection(connectionId);
      if (!connection) {
        logger.warn('Connection not found during revocation', { connectionId });
        return { success: false, error: 'Connection not found' };
      }

      logger.debug('Connection found', {
        connectionId,
        provider: connection.provider,
        email: connection.email
      });

      // Try to get the provider instance - but don't fail if it's not available
      const provider = this.providers.get(connection.provider);

      if (provider) {
        logger.debug('Provider found, attempting provider-level revocation', {
          provider: connection.provider
        });

        // Revoke the connection through the provider if it supports it
        try {
          if ('revokeConnection' in provider && typeof provider.revokeConnection === 'function') {
            await (provider as any).revokeConnection(connectionId);
            logger.debug('Provider-level revocation completed', { connectionId });
          } else {
            logger.debug('Provider does not support revocation method', {
              provider: connection.provider
            });
          }
        } catch (providerError) {
          // Log provider error but continue with database deletion
          logger.warn('Provider revocation failed, continuing with database deletion', {
            connectionId,
            provider: connection.provider,
            error: providerError instanceof Error ? providerError.message : 'Unknown provider error'
          });
        }
      } else {
        logger.warn('Provider not available for revocation, proceeding with database deletion only', {
          provider: connection.provider,
          availableProviders: Array.from(this.providers.keys())
        });
      }

      // Delete the connection from database - this is the most important part
      // First, we need to clean up related records to avoid foreign key constraint violations
      logger.debug('Cleaning up related records before deletion', { connectionId });

      try {
        // Delete related agent permissions
        await this.db.deleteAgentWorkspacePermissionsByConnection(connectionId);
        logger.debug('Deleted agent workspace permissions', { connectionId });
      } catch (error) {
        logger.warn('Failed to delete agent workspace permissions', {
          connectionId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      try {
        // Delete related audit logs  
        await this.db.deleteWorkspaceAuditLogsByConnection(connectionId);
        logger.debug('Deleted workspace audit logs', { connectionId });
      } catch (error) {
        logger.warn('Failed to delete workspace audit logs', {
          connectionId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      try {
        // Delete related notifications
        await this.db.deleteAgentNotificationsByConnection(connectionId);
        logger.debug('Deleted agent notifications', { connectionId });
      } catch (error) {
        logger.warn('Failed to delete agent notifications', {
          connectionId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      try {
        // Delete related workspace capabilities
        await this.db.deleteWorkspaceCapabilitiesByConnection(connectionId);
        logger.debug('Deleted workspace capabilities', { connectionId });
      } catch (error) {
        logger.warn('Failed to delete workspace capabilities', {
          connectionId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Now delete the connection itself
      logger.debug('Deleting connection from database', { connectionId });
      await this.db.deleteWorkspaceConnection(connectionId);

      logger.info('Workspace connection revoked successfully', {
        connectionId,
        provider: connection.provider,
        email: connection.email
      });

      return { success: true };

    } catch (error) {
      logger.error('Error revoking workspace connection', {
        connectionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to revoke connection'
      };
    }
  }
} 