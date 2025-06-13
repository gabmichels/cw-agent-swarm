import { IWorkspaceProvider, ConnectionConfig, ConnectionResult, ValidationResult } from './providers/IWorkspaceProvider';
import { GoogleWorkspaceProvider } from './providers/GoogleWorkspaceProvider';
import { 
  WorkspaceProvider, 
  WorkspaceConnection,
  WorkspaceCapabilityType 
} from '../database/types';
import { DatabaseService } from '../database/DatabaseService';

/**
 * Main workspace service that manages all workspace providers
 */
export class WorkspaceService {
  private providers: Map<WorkspaceProvider, IWorkspaceProvider> = new Map();

  constructor() {
    this.initializeProviders();
  }

  /**
   * Initialize all workspace providers
   */
  private initializeProviders(): void {
    // Initialize Google Workspace provider
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/workspace/callback';

    if (googleClientId && googleClientSecret) {
      const googleProvider = new GoogleWorkspaceProvider(
        googleClientId,
        googleClientSecret,
        googleRedirectUri
      );
      this.providers.set(WorkspaceProvider.GOOGLE_WORKSPACE, googleProvider);
    }

    // TODO: Initialize Microsoft 365 and Zoho providers
  }

  /**
   * Get a workspace provider by type
   */
  getProvider(provider: WorkspaceProvider): IWorkspaceProvider | undefined {
    return this.providers.get(provider);
  }

  /**
   * Get all available providers
   */
  getAvailableProviders(): WorkspaceProvider[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get supported capabilities for a provider
   */
  getSupportedCapabilities(provider: WorkspaceProvider): WorkspaceCapabilityType[] {
    const providerInstance = this.providers.get(provider);
    return providerInstance?.supportedCapabilities || [];
  }

  /**
   * Initiate a workspace connection
   */
  async initiateConnection(provider: WorkspaceProvider, config: ConnectionConfig): Promise<ConnectionResult> {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) {
      return {
        success: false,
        error: `Provider ${provider} is not available`
      };
    }

    return providerInstance.initiateConnection(config);
  }

  /**
   * Complete a workspace connection
   */
  async completeConnection(provider: WorkspaceProvider, authCode: string, state: string, userId?: string, organizationId?: string): Promise<WorkspaceConnection> {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) {
      throw new Error(`Provider ${provider} is not available`);
    }

    const connection = await providerInstance.completeConnection(authCode, state);
    
    // Update the connection with user/organization info if provided
    if (userId || organizationId) {
      const db = DatabaseService.getInstance();
      const updatedConnection = await db.updateWorkspaceConnection(connection.id, {
        ...(userId && { userId }),
        ...(organizationId && { organizationId })
      });
      return updatedConnection;
    }

    return connection;
  }

  /**
   * Refresh a workspace connection
   */
  async refreshConnection(connectionId: string): Promise<ConnectionResult> {
    const db = DatabaseService.getInstance();
    const connection = await db.getWorkspaceConnection(connectionId);
    
    if (!connection) {
      return {
        success: false,
        error: 'Connection not found'
      };
    }

    const providerInstance = this.providers.get(connection.provider as WorkspaceProvider);
    if (!providerInstance) {
      return {
        success: false,
        error: `Provider ${connection.provider} is not available`
      };
    }

    return providerInstance.refreshConnection(connectionId);
  }

  /**
   * Validate a workspace connection
   */
  async validateConnection(connectionId: string): Promise<ValidationResult> {
    const db = DatabaseService.getInstance();
    const connection = await db.getWorkspaceConnection(connectionId);
    
    if (!connection) {
      return {
        isValid: false,
        status: 'ERROR' as any,
        error: 'Connection not found'
      };
    }

    const providerInstance = this.providers.get(connection.provider as WorkspaceProvider);
    if (!providerInstance) {
      return {
        isValid: false,
        status: 'ERROR' as any,
        error: `Provider ${connection.provider} is not available`
      };
    }

    return providerInstance.validateConnection(connectionId);
  }

  /**
   * Revoke a workspace connection
   */
  async revokeConnection(connectionId: string): Promise<void> {
    const db = DatabaseService.getInstance();
    const connection = await db.getWorkspaceConnection(connectionId);
    
    if (!connection) {
      throw new Error('Connection not found');
    }

    const providerInstance = this.providers.get(connection.provider as WorkspaceProvider);
    if (!providerInstance) {
      throw new Error(`Provider ${connection.provider} is not available`);
    }

    await providerInstance.revokeConnection(connectionId);
  }

  /**
   * Get all workspace connections for a user
   */
  async getUserConnections(userId: string): Promise<WorkspaceConnection[]> {
    const db = DatabaseService.getInstance();
    return db.findWorkspaceConnections({ userId });
  }

  /**
   * Get all workspace connections for an organization
   */
  async getOrganizationConnections(organizationId: string): Promise<WorkspaceConnection[]> {
    const db = DatabaseService.getInstance();
    return db.findWorkspaceConnections({ organizationId });
  }

  /**
   * Check health of all providers
   */
  async checkProvidersHealth(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};
    
    for (const [providerType, provider] of this.providers) {
      try {
        health[providerType] = await provider.isHealthy();
      } catch {
        health[providerType] = false;
      }
    }
    
    return health;
  }
} 