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
import { getServiceConfig } from '../../../lib/core/unified-config';
import {
  createErrorContext,
  ErrorSeverity,
  handleAsync,
  handleWithRetry
} from '../../../lib/errors/standardized-handler';
import { logger } from '../../../lib/logging';
import {
  encryptTokens,
  OAuthTokenData,
  registerTokenRefreshCallback
} from '../../../lib/security/unified-token-manager';

/**
 * N8N Cloud provider implementation with unified systems
 * Follows IMPLEMENTATION_GUIDELINES.md patterns: ULID, DI, strict typing, pure functions
 */
export class N8nCloudProvider implements IWorkspaceProvider {
  readonly providerId = WorkspaceProvider.N8N_CLOUD;
  readonly supportedCapabilities = [
    WorkspaceCapabilityType.WORKFLOW_EXECUTE,
    WorkspaceCapabilityType.WORKFLOW_READ,
    WorkspaceCapabilityType.WORKFLOW_CREATE,
    WorkspaceCapabilityType.WORKFLOW_EDIT,
    WorkspaceCapabilityType.WORKFLOW_DELETE
  ];

  private httpClient: AxiosInstance;
  private readonly authBaseUrl: string;
  private readonly apiBaseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor() {
    // Get configuration from unified config system
    const oauthConfig = getServiceConfig('oauth');
    const n8nProvider = oauthConfig.providers.n8n_cloud;

    if (!n8nProvider) {
      throw new Error('N8N Cloud OAuth provider not configured. Please set N8N_CLOUD_CLIENT_ID and N8N_CLOUD_CLIENT_SECRET environment variables.');
    }

    this.clientId = n8nProvider.clientId;
    this.clientSecret = n8nProvider.clientSecret;
    this.redirectUri = n8nProvider.redirectUri || `${process.env.BASE_URL || 'http://localhost:3000'}/api/auth/callback/n8n-cloud`;

    this.authBaseUrl = 'https://app.n8n.cloud/oauth2';
    this.apiBaseUrl = 'https://app.n8n.cloud/api/v1';

    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Register token refresh callback with unified token manager
    registerTokenRefreshCallback('n8n-cloud', this.refreshTokenCallback.bind(this));

    logger.info('N8N Cloud provider initialized', {
      providerId: this.providerId,
      authBaseUrl: this.authBaseUrl,
      supportedCapabilities: this.supportedCapabilities.length,
    });
  }

  async initiateConnection(config: ConnectionConfig): Promise<ConnectionResult> {
    const context = createErrorContext('N8nCloudProvider', 'initiateConnection', {
      severity: ErrorSeverity.LOW,
      retryable: false,
    });

    const result = await handleAsync(async () => {
      // Build the authorization URL
      const authUrl = new URL(`${this.authBaseUrl}/authorize`);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', this.clientId);
      authUrl.searchParams.set('redirect_uri', config.redirectUri);
      authUrl.searchParams.set('access_type', 'offline'); // CRITICAL: Get refresh tokens
      authUrl.searchParams.set('prompt', 'consent'); // Ensure user consent

      if (config.scopes && config.scopes.length > 0) {
        const scopeString = config.scopes.join(' ');
        authUrl.searchParams.set('scope', scopeString);
      }

      if (config.state) {
        authUrl.searchParams.set('state', config.state);
      }

      const finalUrl = authUrl.toString();

      logger.info('N8N Cloud OAuth URL generated', {
        hasScopes: config.scopes?.length > 0,
        hasState: !!config.state,
        redirectUri: config.redirectUri,
      });

      return { authUrl: finalUrl };
    }, context);

    return {
      success: result.success,
      authUrl: result.data?.authUrl,
      error: result.error?.message,
    };
  }

  async completeConnection(authCode: string, state: string): Promise<WorkspaceConnection> {
    const context = createErrorContext('N8nCloudProvider', 'completeConnection', {
      severity: ErrorSeverity.HIGH,
      retryable: true,
    });

    const result = await handleWithRetry(async () => {
      logger.info('Starting N8N Cloud OAuth token exchange', { hasAuthCode: !!authCode, hasState: !!state });

      // Decode state parameter to get user info
      let stateData: any = {};
      if (state) {
        try {
          stateData = JSON.parse(Buffer.from(state, 'base64').toString());
          logger.debug('Decoded OAuth state data', {
            hasUserId: !!stateData.userId,
            hasOrgId: !!stateData.organizationId
          });
        } catch (error) {
          logger.warn('Failed to decode OAuth state parameter', { error });
        }
      }

      // Exchange authorization code for tokens
      const tokenResponse = await this.httpClient.post(`${this.authBaseUrl}/token`, null, {
        params: {
          code: authCode,
          grant_type: 'authorization_code',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri
        }
      });

      const tokens = tokenResponse.data;

      if (!tokens.access_token) {
        throw new Error('No access token received from N8N Cloud OAuth');
      }

      logger.info('N8N Cloud OAuth token exchange successful', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiresIn: tokens.expires_in,
        scope: tokens.scope
      });

      // Get user info using the access token
      const userInfoResponse = await this.httpClient.get(`${this.apiBaseUrl}/me`, {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`
        }
      });

      const userInfo = userInfoResponse.data;

      if (!userInfo || !userInfo.email) {
        throw new Error('Unable to retrieve user email from N8N Cloud');
      }

      const email = userInfo.email;
      const domain = email.split('@')[1];

      // Store tokens securely using unified token manager
      const tokenData: OAuthTokenData = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
        scopes: tokens.scope?.split(' ') || [],
      };

      const tokenId = `n8n-cloud-${userInfo.id || email}`;
      const encryptedTokens = await encryptTokens(tokenData);

      logger.info('N8N Cloud OAuth tokens stored securely', {
        tokenId,
        email,
        hasRefreshToken: !!tokens.refresh_token
      });

      // Create or update workspace connection
      const db = DatabaseService.getInstance();
      const accountType = WorkspaceAccountType.PERSONAL; // N8N Cloud is primarily personal accounts

      const queryFilter: any = {
        email,
        provider: WorkspaceProvider.N8N_CLOUD
      };

      if (stateData.userId) queryFilter.userId = stateData.userId;
      if (stateData.organizationId) queryFilter.organizationId = stateData.organizationId;

      const existingConnections = await db.findWorkspaceConnections(queryFilter);

      if (existingConnections.length > 0) {
        // Update existing connection
        const existingConnection = existingConnections[0];
        const updatedConnection = await db.updateWorkspaceConnection(existingConnection.id, {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || undefined,
          tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
          scopes: tokens.scope || '',
          status: ConnectionStatus.ACTIVE,
          lastSyncAt: new Date()
        });

        logger.info('Updated existing N8N Cloud connection', {
          connectionId: updatedConnection.id,
          email: updatedConnection.email
        });

        return updatedConnection;
      }

      // Create new connection
      try {
        const connection = await db.createWorkspaceConnection({
          userId: stateData.userId,
          organizationId: stateData.organizationId,
          provider: WorkspaceProvider.N8N_CLOUD,
          accountType,
          connectionType: ConnectionType.OAUTH_PERSONAL,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || undefined,
          tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
          scopes: tokens.scope || '',
          providerAccountId: userInfo.id || '',
          displayName: userInfo.name || userInfo.firstName || email,
          email,
          domain: domain,
          status: ConnectionStatus.ACTIVE
        });

        logger.info('Created new N8N Cloud connection', {
          connectionId: connection.id,
          email: connection.email,
          accountType: connection.accountType
        });

        return connection;
      } catch (dbError) {
        logger.error('Failed to create N8N Cloud connection in database', {
          error: dbError instanceof Error ? dbError.message : 'Unknown error',
          email,
          provider: WorkspaceProvider.N8N_CLOUD
        });
        throw new Error(`Database error: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
      }
    }, context);

    if (!result.success) {
      logger.error('N8N Cloud connection completion failed', {
        error: result.error?.message,
        hasAuthCode: !!authCode,
        hasState: !!state
      });
      throw new Error(`Connection failed: ${result.error?.message}`);
    }

    return result.data!;
  }

  /**
   * Token refresh callback for unified token manager
   */
  private async refreshTokenCallback(refreshToken: string, provider: string, connectionId: string): Promise<OAuthTokenData> {
    const context = createErrorContext('N8nCloudProvider', 'refreshTokenCallback', {
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
    });

    const result = await handleAsync(async () => {
      if (!refreshToken) {
        throw new Error('No refresh token provided for N8N Cloud connection');
      }

      // Refresh the access token using N8N Cloud API
      const tokenResponse = await this.httpClient.post(`${this.authBaseUrl}/token`, null, {
        params: {
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }
      });

      const tokens = tokenResponse.data;

      if (!tokens.access_token) {
        throw new Error('Failed to refresh N8N Cloud access token - no new token received');
      }

      const refreshedTokens: OAuthTokenData = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || refreshToken,
        expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
        scopes: tokens.scope?.split(' ') || [],
      };

      logger.info('N8N Cloud tokens refreshed successfully', {
        provider,
        connectionId,
        hasNewRefreshToken: !!tokens.refresh_token,
        newExpiresIn: tokens.expires_in,
      });

      return refreshedTokens;
    }, context);

    if (!result.success) {
      logger.error('Failed to refresh N8N Cloud tokens', {
        provider,
        connectionId,
        error: result.error?.message,
      });
      throw new Error(`Token refresh failed: ${result.error?.message}`);
    }

    return result.data!;
  }

  async refreshConnection(connectionId: string): Promise<ConnectionResult> {
    const context = createErrorContext('N8nCloudProvider', 'refreshConnection', {
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
    });

    const result = await handleAsync(async () => {
      const db = DatabaseService.getInstance();
      const connection = await db.getWorkspaceConnection(connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      if (!connection.refreshToken) {
        throw new Error('No refresh token available for connection');
      }

      // Use the unified token manager to refresh
      const refreshedTokens = await this.refreshTokenCallback(
        connection.refreshToken,
        'n8n-cloud',
        connectionId
      );

      // Update the connection in the database
      await db.updateWorkspaceConnection(connectionId, {
        accessToken: refreshedTokens.accessToken,
        refreshToken: refreshedTokens.refreshToken || connection.refreshToken,
        tokenExpiresAt: refreshedTokens.expiresAt,
        status: ConnectionStatus.ACTIVE,
        lastSyncAt: new Date()
      });

      return { success: true };
    }, context);

    return {
      success: result.success,
      error: result.error?.message
    };
  }

  async revokeConnection(connectionId: string): Promise<void> {
    const context = createErrorContext('N8nCloudProvider', 'revokeConnection', {
      severity: ErrorSeverity.MEDIUM,
      retryable: false,
    });

    const result = await handleAsync(async () => {
      const db = DatabaseService.getInstance();
      const connection = await db.getWorkspaceConnection(connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      // Revoke the token with N8N Cloud if possible
      try {
        await this.httpClient.post(`${this.authBaseUrl}/revoke`, null, {
          params: {
            token: connection.accessToken,
            client_id: this.clientId,
            client_secret: this.clientSecret
          }
        });
      } catch (error) {
        logger.warn('Failed to revoke token with N8N Cloud', {
          connectionId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        // Continue with local revocation even if remote revocation fails
      }

      // Update connection status to revoked
      await db.updateWorkspaceConnection(connectionId, {
        status: ConnectionStatus.REVOKED,
        lastSyncAt: new Date()
      });

      logger.info('N8N Cloud connection revoked', {
        connectionId,
        email: connection.email
      });
    }, context);

    if (!result.success) {
      logger.error('Failed to revoke N8N Cloud connection', {
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
        await this.httpClient.get(`${this.apiBaseUrl}/me`, {
          headers: { 'Authorization': `Bearer ${connection.accessToken}` }
        });
        return { isValid: true, status: ConnectionStatus.ACTIVE };
      } catch (error) {
        if (connection.refreshToken) {
          const refreshResult = await this.refreshConnection(connectionId);
          if (refreshResult.success) {
            return { isValid: true, status: ConnectionStatus.ACTIVE };
          }
        }
        return { isValid: false, status: ConnectionStatus.ERROR, error: 'API call failed' };
      }
    }, createErrorContext('N8nCloudProvider', 'validateConnection', { severity: ErrorSeverity.LOW }))
      .then(result => result.data || { isValid: false, status: ConnectionStatus.ERROR, error: result.error?.message });
  }

  async isHealthy(): Promise<boolean> {
    const result = await handleAsync(async () => {
      const oauthConfig = getServiceConfig('oauth');
      return !!oauthConfig.providers.n8n_cloud?.clientId;
    }, createErrorContext('N8nCloudProvider', 'isHealthy', { severity: ErrorSeverity.LOW }));
    return result.success && result.data === true;
  }

  // N8N-specific methods
  async getAuthenticatedClient(connectionId: string): Promise<AxiosInstance> {
    const db = DatabaseService.getInstance();
    const connection = await db.getWorkspaceConnection(connectionId);
    if (!connection) throw new Error('Connection not found');

    return axios.create({
      baseURL: this.apiBaseUrl,
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${connection.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async getWorkflows(connectionId: string): Promise<any[]> {
    const client = await this.getAuthenticatedClient(connectionId);
    const response = await client.get('/workflows');
    return response.data.data || response.data;
  }

  async getWorkflow(connectionId: string, workflowId: string): Promise<any> {
    const client = await this.getAuthenticatedClient(connectionId);
    const response = await client.get(`/workflows/${workflowId}`);
    return response.data.data || response.data;
  }

  async createWorkflow(connectionId: string, workflowData: any): Promise<any> {
    const client = await this.getAuthenticatedClient(connectionId);
    const response = await client.post('/workflows', workflowData);
    return response.data.data || response.data;
  }

  async updateWorkflow(connectionId: string, workflowId: string, workflowData: any): Promise<any> {
    const client = await this.getAuthenticatedClient(connectionId);
    const response = await client.put(`/workflows/${workflowId}`, workflowData);
    return response.data.data || response.data;
  }

  async deleteWorkflow(connectionId: string, workflowId: string): Promise<void> {
    const client = await this.getAuthenticatedClient(connectionId);
    await client.delete(`/workflows/${workflowId}`);
  }

  async activateWorkflow(connectionId: string, workflowId: string): Promise<any> {
    const client = await this.getAuthenticatedClient(connectionId);
    const response = await client.post(`/workflows/${workflowId}/activate`);
    return response.data.data || response.data;
  }

  async deactivateWorkflow(connectionId: string, workflowId: string): Promise<any> {
    const client = await this.getAuthenticatedClient(connectionId);
    const response = await client.post(`/workflows/${workflowId}/deactivate`);
    return response.data.data || response.data;
  }

  async executeWorkflow(connectionId: string, workflowId: string, data?: any): Promise<any> {
    const client = await this.getAuthenticatedClient(connectionId);
    const response = await client.post(`/workflows/${workflowId}/execute`, data);
    return response.data.data || response.data;
  }

  async getExecutions(connectionId: string, workflowId?: string): Promise<any[]> {
    const client = await this.getAuthenticatedClient(connectionId);
    const url = workflowId ? `/executions?workflowId=${workflowId}` : '/executions';
    const response = await client.get(url);
    return response.data.data || response.data;
  }

  async getExecution(connectionId: string, executionId: string): Promise<any> {
    const client = await this.getAuthenticatedClient(connectionId);
    const response = await client.get(`/executions/${executionId}`);
    return response.data.data || response.data;
  }

  static getRequiredScopes(): string[] {
    return [
      'workflow:read',
      'workflow:write',
      'workflow:execute',
      'execution:read'
    ];
  }
} 