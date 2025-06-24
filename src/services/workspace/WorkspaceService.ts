import { DatabaseService } from '../database/DatabaseService';
import { IDatabaseProvider } from '../database/IDatabaseProvider';
import {
  WorkspaceConnection,
  WorkspaceProvider,
  ConnectionStatus,
  WorkspaceCapabilityType
} from '../database/types';
import { GoogleWorkspaceProvider } from './providers/GoogleWorkspaceProvider';
import { ZohoWorkspaceProvider } from './providers/ZohoWorkspaceProvider';
import { IWorkspaceProvider, ConnectionResult, ValidationResult } from './providers/IWorkspaceProvider';
import { logger } from '../../lib/logging';
import { getServiceConfig } from '../../lib/core/unified-config';

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
} 