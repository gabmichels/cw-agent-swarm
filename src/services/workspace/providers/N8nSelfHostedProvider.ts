import axios, { AxiosInstance } from 'axios';
import { DatabaseService } from '../../database/DatabaseService';
import {
  ConnectionStatus,
  ConnectionType,
  WorkspaceAccountType,
  WorkspaceCapabilityType,
  WorkspaceConnection,
  WorkspaceProvider
} from '../../database/types';
import { ConnectionConfig, ConnectionResult, IWorkspaceProvider, ValidationResult } from './IWorkspaceProvider';

// Unified systems imports
import {
  createErrorContext,
  ErrorSeverity,
  handleAsync
} from '../../../lib/errors/standardized-handler';
import { logger } from '../../../lib/logging';

/**
 * N8N Self-Hosted provider implementation with API key authentication
 * Follows IMPLEMENTATION_GUIDELINES.md patterns: ULID, DI, strict typing, pure functions
 */
export class N8nSelfHostedProvider implements IWorkspaceProvider {
  readonly providerId = WorkspaceProvider.N8N_SELF_HOSTED;
  readonly supportedCapabilities = [
    WorkspaceCapabilityType.WORKFLOW_EXECUTE,
    WorkspaceCapabilityType.WORKFLOW_READ,
    WorkspaceCapabilityType.WORKFLOW_CREATE,
    WorkspaceCapabilityType.WORKFLOW_EDIT,
    WorkspaceCapabilityType.WORKFLOW_DELETE
  ];

  private httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    logger.info('N8N Self-Hosted provider initialized', {
      providerId: this.providerId,
      supportedCapabilities: this.supportedCapabilities.length,
    });
  }

  async initiateConnection(config: ConnectionConfig): Promise<ConnectionResult> {
    // For API key connections, we don't need OAuth flow
    // Return a special result indicating manual API key setup is required
    return {
      success: true,
      authUrl: undefined, // No OAuth URL needed
      error: undefined
    };
  }

  async completeConnection(apiKeyData: string, state: string): Promise<WorkspaceConnection> {
    const context = createErrorContext('N8nSelfHostedProvider', 'completeConnection', {
      severity: ErrorSeverity.HIGH,
      retryable: false,
    });

    const result = await handleAsync(async () => {
      logger.info('Creating N8N Self-Hosted connection with API key');

      // Parse API key data: format should be "apiKey:instanceUrl"
      const [apiKey, instanceUrl] = apiKeyData.split(':');

      if (!apiKey || !instanceUrl) {
        throw new Error('Invalid API key format. Expected: apiKey:instanceUrl');
      }

      // Validate the instance URL format
      try {
        new URL(instanceUrl);
      } catch {
        throw new Error('Invalid instance URL format');
      }

      // Decode state parameter to get user info
      let stateData: any = {};
      if (state) {
        try {
          stateData = JSON.parse(Buffer.from(state, 'base64').toString());
          logger.debug('Decoded state data', {
            hasUserId: !!stateData.userId,
            hasOrgId: !!stateData.organizationId
          });
        } catch (error) {
          logger.warn('Failed to decode state parameter', { error });
        }
      }

      // Test the API key by making a request to the instance
      const testClient = axios.create({
        baseURL: instanceUrl,
        timeout: 10000,
        headers: {
          'X-N8N-API-KEY': apiKey,
          'Content-Type': 'application/json'
        }
      });

      let userInfo: any;
      try {
        const response = await testClient.get('/api/v1/me');
        userInfo = response.data;
      } catch (error) {
        logger.error('Failed to validate N8N API key', {
          instanceUrl,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw new Error('Invalid API key or instance URL. Please check your credentials.');
      }

      if (!userInfo || !userInfo.email) {
        throw new Error('Unable to retrieve user information from N8N instance');
      }

      const email = userInfo.email;
      const domain = instanceUrl; // Store instance URL in domain field for now

      // Create or update workspace connection
      const db = DatabaseService.getInstance();
      const accountType = WorkspaceAccountType.PERSONAL; // Self-hosted is typically personal

      const queryFilter: any = {
        email,
        provider: WorkspaceProvider.N8N_SELF_HOSTED
      };

      if (stateData.userId) queryFilter.userId = stateData.userId;
      if (stateData.organizationId) queryFilter.organizationId = stateData.organizationId;

      const existingConnections = await db.findWorkspaceConnections(queryFilter);

      if (existingConnections.length > 0) {
        // Update existing connection
        const existingConnection = existingConnections[0];
        const updatedConnection = await db.updateWorkspaceConnection(existingConnection.id, {
          accessToken: apiKey, // Store API key as access token
          refreshToken: undefined, // API keys don't have refresh tokens
          tokenExpiresAt: undefined, // API keys typically don't expire
          scopes: 'workflow:all', // Self-hosted typically has full access
          status: ConnectionStatus.ACTIVE,
          lastSyncAt: new Date()
        });

        logger.info('Updated existing N8N Self-Hosted connection', {
          connectionId: updatedConnection.id,
          email: updatedConnection.email,
          instanceUrl
        });

        return updatedConnection;
      }

      // Create new connection
      try {
        const connection = await db.createWorkspaceConnection({
          userId: stateData.userId,
          organizationId: stateData.organizationId,
          provider: WorkspaceProvider.N8N_SELF_HOSTED,
          accountType,
          connectionType: ConnectionType.SERVICE_ACCOUNT, // API key is service account type
          accessToken: apiKey, // Store API key as access token
          refreshToken: undefined, // API keys don't have refresh tokens
          tokenExpiresAt: undefined, // API keys typically don't expire
          scopes: 'workflow:all', // Self-hosted typically has full access
          providerAccountId: userInfo.id || email,
          displayName: userInfo.firstName ? `${userInfo.firstName} ${userInfo.lastName || ''}`.trim() : email,
          email,
          domain: domain, // Store instance URL here
          status: ConnectionStatus.ACTIVE
        });

        logger.info('Created new N8N Self-Hosted connection', {
          connectionId: connection.id,
          email: connection.email,
          instanceUrl,
          accountType: connection.accountType
        });

        return connection;
      } catch (dbError) {
        logger.error('Failed to create N8N Self-Hosted connection in database', {
          error: dbError instanceof Error ? dbError.message : 'Unknown error',
          email,
          instanceUrl,
          provider: WorkspaceProvider.N8N_SELF_HOSTED
        });
        throw new Error(`Database error: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
      }
    }, context);

    if (!result.success) {
      logger.error('N8N Self-Hosted connection completion failed', {
        error: result.error?.message
      });
      throw new Error(`Connection failed: ${result.error?.message}`);
    }

    return result.data!;
  }

  async refreshConnection(connectionId: string): Promise<ConnectionResult> {
    // API keys don't need refreshing, just validate they still work
    const validationResult = await this.validateConnection(connectionId);

    return {
      success: validationResult.isValid,
      error: validationResult.error
    };
  }

  async revokeConnection(connectionId: string): Promise<void> {
    const context = createErrorContext('N8nSelfHostedProvider', 'revokeConnection', {
      severity: ErrorSeverity.MEDIUM,
      retryable: false,
    });

    const result = await handleAsync(async () => {
      const db = DatabaseService.getInstance();
      const connection = await db.getWorkspaceConnection(connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      // For self-hosted, we can't revoke the API key remotely
      // Just update the connection status to revoked
      await db.updateWorkspaceConnection(connectionId, {
        status: ConnectionStatus.REVOKED,
        lastSyncAt: new Date()
      });

      logger.info('N8N Self-Hosted connection revoked', {
        connectionId,
        email: connection.email
      });
    }, context);

    if (!result.success) {
      logger.error('Failed to revoke N8N Self-Hosted connection', {
        connectionId,
        error: result.error?.message
      });
      throw new Error(`Revocation failed: ${result.error?.message}`);
    }
  }

  async validateConnection(connectionId: string): Promise<ValidationResult> {
    return await handleAsync(async () => {
      const db = DatabaseService.getInstance();
      const connection = await db.getWorkspaceConnection(connectionId);
      if (!connection) {
        return { isValid: false, status: ConnectionStatus.ERROR, error: 'Connection not found' };
      }

      try {
        const instanceUrl = connection.domain; // Instance URL stored in domain field
        if (!instanceUrl) {
          return { isValid: false, status: ConnectionStatus.ERROR, error: 'Instance URL not found' };
        }

        const testClient = axios.create({
          baseURL: instanceUrl,
          timeout: 10000,
          headers: {
            'X-N8N-API-KEY': connection.accessToken,
            'Content-Type': 'application/json'
          }
        });

        await testClient.get('/api/v1/me');
        return { isValid: true, status: ConnectionStatus.ACTIVE };
      } catch (error) {
        return {
          isValid: false,
          status: ConnectionStatus.ERROR,
          error: 'API key validation failed'
        };
      }
    }, createErrorContext('N8nSelfHostedProvider', 'validateConnection', { severity: ErrorSeverity.LOW }))
      .then(result => result.data || { isValid: false, status: ConnectionStatus.ERROR, error: result.error?.message });
  }

  async isHealthy(): Promise<boolean> {
    // Self-hosted provider is always "healthy" since it doesn't depend on external config
    return true;
  }

  // N8N-specific methods
  async getAuthenticatedClient(connectionId: string): Promise<AxiosInstance> {
    const db = DatabaseService.getInstance();
    const connection = await db.getWorkspaceConnection(connectionId);
    if (!connection) throw new Error('Connection not found');

    const instanceUrl = connection.domain; // Instance URL stored in domain field
    if (!instanceUrl) {
      throw new Error('Instance URL not found in connection');
    }

    return axios.create({
      baseURL: instanceUrl,
      timeout: 30000,
      headers: {
        'X-N8N-API-KEY': connection.accessToken,
        'Content-Type': 'application/json'
      }
    });
  }

  async getWorkflows(connectionId: string): Promise<any[]> {
    const client = await this.getAuthenticatedClient(connectionId);
    const response = await client.get('/api/v1/workflows');
    return response.data.data || response.data;
  }

  async getWorkflow(connectionId: string, workflowId: string): Promise<any> {
    const client = await this.getAuthenticatedClient(connectionId);
    const response = await client.get(`/api/v1/workflows/${workflowId}`);
    return response.data.data || response.data;
  }

  async createWorkflow(connectionId: string, workflowData: any): Promise<any> {
    const client = await this.getAuthenticatedClient(connectionId);
    const response = await client.post('/api/v1/workflows', workflowData);
    return response.data.data || response.data;
  }

  async updateWorkflow(connectionId: string, workflowId: string, workflowData: any): Promise<any> {
    const client = await this.getAuthenticatedClient(connectionId);
    const response = await client.put(`/api/v1/workflows/${workflowId}`, workflowData);
    return response.data.data || response.data;
  }

  async deleteWorkflow(connectionId: string, workflowId: string): Promise<void> {
    const client = await this.getAuthenticatedClient(connectionId);
    await client.delete(`/api/v1/workflows/${workflowId}`);
  }

  async activateWorkflow(connectionId: string, workflowId: string): Promise<any> {
    const client = await this.getAuthenticatedClient(connectionId);
    const response = await client.post(`/api/v1/workflows/${workflowId}/activate`);
    return response.data.data || response.data;
  }

  async deactivateWorkflow(connectionId: string, workflowId: string): Promise<any> {
    const client = await this.getAuthenticatedClient(connectionId);
    const response = await client.post(`/api/v1/workflows/${workflowId}/deactivate`);
    return response.data.data || response.data;
  }

  async executeWorkflow(connectionId: string, workflowId: string, data?: any): Promise<any> {
    const client = await this.getAuthenticatedClient(connectionId);
    const response = await client.post(`/api/v1/workflows/${workflowId}/execute`, data);
    return response.data.data || response.data;
  }

  async getExecutions(connectionId: string, workflowId?: string): Promise<any[]> {
    const client = await this.getAuthenticatedClient(connectionId);
    const url = workflowId ? `/api/v1/executions?workflowId=${workflowId}` : '/api/v1/executions';
    const response = await client.get(url);
    return response.data.data || response.data;
  }

  async getExecution(connectionId: string, executionId: string): Promise<any> {
    const client = await this.getAuthenticatedClient(connectionId);
    const response = await client.get(`/api/v1/executions/${executionId}`);
    return response.data.data || response.data;
  }

  static getRequiredApiKeyFormat(): string {
    return 'n8n_[a-zA-Z0-9]{32,}';
  }

  static getApiKeyInstructions(): string {
    return 'Enter your n8n API key and instance URL in the format: apiKey:instanceUrl (e.g., n8n_abc123:https://your-n8n.example.com)';
  }
} 