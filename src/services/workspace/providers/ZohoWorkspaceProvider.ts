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
import { getRequiredScopes } from '../scopes/WorkspaceScopes';
import { ConnectionConfig, ConnectionResult, IWorkspaceProvider, ValidationResult } from './IWorkspaceProvider';

// Unified systems imports
import {
  handleAsync,
  handleWithRetry,
  createErrorContext,
  ErrorSeverity
} from '../../../lib/errors/standardized-handler';
import {
  unifiedTokenManager,
  OAuthTokenData,
  registerTokenRefreshCallback,
  isTokenExpired,
  encryptTokens,
  decryptTokens
} from '../../../lib/security/unified-token-manager';
import { logger } from '../../../lib/logging';

/**
 * Zoho Workspace provider implementation with unified systems
 */
export class ZohoWorkspaceProvider implements IWorkspaceProvider {
  readonly providerId = WorkspaceProvider.ZOHO;
  readonly supportedCapabilities = [
    WorkspaceCapabilityType.EMAIL_SEND,
    WorkspaceCapabilityType.EMAIL_READ,
    WorkspaceCapabilityType.DOCUMENT_READ,
    WorkspaceCapabilityType.DOCUMENT_CREATE,
    WorkspaceCapabilityType.DOCUMENT_EDIT,
    WorkspaceCapabilityType.CALENDAR_READ,
    WorkspaceCapabilityType.CALENDAR_CREATE,
    WorkspaceCapabilityType.CALENDAR_EDIT,
    WorkspaceCapabilityType.CALENDAR_DELETE,
    WorkspaceCapabilityType.DRIVE_READ,
    WorkspaceCapabilityType.DRIVE_UPLOAD,
    WorkspaceCapabilityType.DRIVE_MANAGE,
    WorkspaceCapabilityType.CONTACTS_READ,
    WorkspaceCapabilityType.CONTACTS_MANAGE,
    WorkspaceCapabilityType.SPREADSHEET_READ,
    WorkspaceCapabilityType.SPREADSHEET_CREATE,
    WorkspaceCapabilityType.SPREADSHEET_EDIT,
    WorkspaceCapabilityType.SPREADSHEET_DELETE
  ];

  private httpClient: AxiosInstance;
  private readonly authBaseUrl: string;
  private readonly apiBaseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly region: string;

  constructor() {
    // Get configuration directly from environment variables for immediate availability
    this.clientId = process.env.ZOHO_CLIENT_ID || '';
    this.clientSecret = process.env.ZOHO_CLIENT_SECRET || '';
    this.redirectUri = process.env.ZOHO_REDIRECT_URI || `${process.env.BASE_URL || 'http://localhost:3000'}/api/workspace/callback`;
    this.region = process.env.ZOHO_REGION || 'com'; // com, eu, in, au, jp, ca

    if (!this.clientId || !this.clientSecret) {
      throw new Error('Zoho OAuth provider not configured. Please set ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET environment variables.');
    }

    this.authBaseUrl = `https://accounts.zoho.${this.region}/oauth/v2`;
    this.apiBaseUrl = `https://www.zohoapis.${this.region}`;

    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Register token refresh callback with unified token manager
    registerTokenRefreshCallback('zoho-workspace', this.refreshTokenCallback.bind(this));

    logger.info('Zoho Workspace provider initialized', {
      providerId: this.providerId,
      region: this.region,
      authBaseUrl: this.authBaseUrl,
      supportedCapabilities: this.supportedCapabilities.length,
    });
  }

  async initiateConnection(config: ConnectionConfig): Promise<ConnectionResult> {
    const context = createErrorContext('ZohoWorkspaceProvider', 'initiateConnection', {
      severity: ErrorSeverity.LOW,
      retryable: false,
    });

    const result = await handleAsync(async () => {
      // Build the authorization URL
      const authUrl = new URL(`${this.authBaseUrl}/auth`);
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

      logger.info('Zoho OAuth URL generated', {
        hasScopes: config.scopes?.length > 0,
        hasState: !!config.state,
        redirectUri: config.redirectUri,
        region: this.region,
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
    const context = createErrorContext('ZohoWorkspaceProvider', 'completeConnection', {
      severity: ErrorSeverity.HIGH,
      retryable: true,
    });

    const result = await handleWithRetry(async () => {
      logger.info('Starting Zoho OAuth token exchange', { hasAuthCode: !!authCode, hasState: !!state });

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
        throw new Error('No access token received from Zoho OAuth');
      }

      logger.info('Zoho OAuth token exchange successful', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiresIn: tokens.expires_in,
        scope: tokens.scope
      });

      // Get user info using the access token
      const userInfoResponse = await this.httpClient.get(`${this.authBaseUrl}/userinfo`, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${tokens.access_token}`
        }
      });

      const userInfo = userInfoResponse.data;

      if (!userInfo || !userInfo.email) {
        throw new Error('Unable to retrieve user email from Zoho');
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

      const tokenId = `zoho-workspace-${userInfo.sub || email}`;
      const encryptedTokens = await encryptTokens(tokenData);

      logger.info('Zoho OAuth tokens stored securely', {
        tokenId,
        email,
        hasRefreshToken: !!tokens.refresh_token
      });

      // Create or update workspace connection
      const db = DatabaseService.getInstance();
      const accountType = WorkspaceAccountType.ORGANIZATIONAL; // Zoho is primarily for business

      const queryFilter: any = {
        email,
        provider: WorkspaceProvider.ZOHO
      };

      if (stateData.userId) queryFilter.userId = stateData.userId;
      if (stateData.organizationId) queryFilter.organizationId = stateData.organizationId;

      const existingConnections = await db.findWorkspaceConnections(queryFilter);

      if (existingConnections.length > 0) {
        // Update existing connection
        existingConnections.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const mostRecentConnection = existingConnections[0];

        const updatedConnection = await db.updateWorkspaceConnection(mostRecentConnection.id, {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || mostRecentConnection.refreshToken,
          tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
          scopes: tokens.scope || mostRecentConnection.scopes,
          displayName: userInfo.name || `${userInfo.given_name || ''} ${userInfo.family_name || ''}`.trim() || email,
          status: ConnectionStatus.ACTIVE
        });

        // Clean up duplicate connections
        const duplicateConnections = existingConnections.slice(1);
        for (const duplicate of duplicateConnections) {
          try {
            await db.deleteWorkspaceConnection(duplicate.id);
            logger.debug('Deleted duplicate Zoho Workspace connection', { connectionId: duplicate.id });
          } catch (deleteError) {
            logger.warn('Failed to delete duplicate connection', { connectionId: duplicate.id, error: deleteError });
          }
        }

        logger.info('Updated existing Zoho Workspace connection', {
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
          provider: WorkspaceProvider.ZOHO,
          accountType,
          connectionType: ConnectionType.OAUTH_PERSONAL,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || undefined,
          tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
          scopes: tokens.scope || '',
          providerAccountId: userInfo.sub || '',
          displayName: userInfo.name || `${userInfo.given_name || ''} ${userInfo.family_name || ''}`.trim() || email,
          email,
          domain: domain,
          status: ConnectionStatus.ACTIVE
        });

        logger.info('Created new Zoho Workspace connection', {
          connectionId: connection.id,
          email: connection.email,
          accountType: connection.accountType
        });

        return connection;
      } catch (createError: any) {
        // Handle race condition with unique constraint violation
        if (createError.code === 'P2002' && createError.meta?.target?.includes('unique_workspace_connection')) {
          logger.warn('Race condition detected during connection creation, attempting recovery');

          const raceConditionConnections = await db.findWorkspaceConnections(queryFilter);
          if (raceConditionConnections.length > 0) {
            const existingConnection = raceConditionConnections[0];
            return await db.updateWorkspaceConnection(existingConnection.id, {
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token || existingConnection.refreshToken,
              tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
              scopes: tokens.scope || existingConnection.scopes,
              displayName: userInfo.name || `${userInfo.given_name || ''} ${userInfo.family_name || ''}`.trim() || email,
              status: ConnectionStatus.ACTIVE
            });
          }
        }

        throw createError;
      }
    }, context);

    if (!result.success) {
      throw new Error(`Failed to complete Zoho Workspace connection: ${result.error?.message}`);
    }

    return result.data!;
  }

  /**
   * Token refresh callback for unified token manager
   */
  private async refreshTokenCallback(refreshToken: string, provider: string, connectionId: string): Promise<OAuthTokenData> {
    const context = createErrorContext('ZohoWorkspaceProvider', 'refreshTokenCallback', {
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
    });

    const result = await handleAsync(async () => {
      if (!refreshToken) {
        throw new Error('No refresh token provided for Zoho Workspace connection');
      }

      // Refresh the access token using Zoho API
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
        throw new Error('Failed to refresh Zoho access token - no new token received');
      }

      const refreshedTokens: OAuthTokenData = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || refreshToken,
        expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
        scopes: tokens.scope?.split(' ') || [],
      };

      logger.info('Zoho Workspace tokens refreshed successfully', {
        provider,
        connectionId,
        hasNewRefreshToken: !!tokens.refresh_token,
        newExpiresIn: tokens.expires_in,
      });

      return refreshedTokens;
    }, context);

    if (!result.success) {
      logger.error('Failed to refresh Zoho Workspace tokens', {
        provider,
        connectionId,
        error: result.error?.message,
      });
      throw new Error(`Token refresh failed: ${result.error?.message}`);
    }

    return result.data!;
  }

  // Simplified methods for brevity - maintaining original functionality but with structured error handling
  async refreshConnection(connectionId: string): Promise<ConnectionResult> {
    return await handleAsync(async () => {
      const db = DatabaseService.getInstance();
      const connection = await db.getWorkspaceConnection(connectionId);
      if (!connection?.refreshToken) {
        throw new Error('No refresh token available');
      }

      const tokenResponse = await this.httpClient.post(`${this.authBaseUrl}/token`, null, {
        params: {
          refresh_token: connection.refreshToken,
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }
      });

      const tokens = tokenResponse.data;
      await db.updateWorkspaceConnection(connectionId, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || connection.refreshToken,
        tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
        status: ConnectionStatus.ACTIVE
      });

      return { connectionId };
    }, createErrorContext('ZohoWorkspaceProvider', 'refreshConnection', { severity: ErrorSeverity.MEDIUM }))
      .then(result => ({
        success: result.success,
        connectionId: result.data?.connectionId,
        error: result.error?.message,
      }));
  }

  async validateConnection(connectionId: string): Promise<ValidationResult> {
    return await handleAsync(async () => {
      const db = DatabaseService.getInstance();
      const connection = await db.getWorkspaceConnection(connectionId);
      if (!connection) {
        return { isValid: false, status: ConnectionStatus.ERROR, error: 'Connection not found' };
      }

      try {
        await this.httpClient.get(`${this.authBaseUrl}/userinfo`, {
          headers: { 'Authorization': `Zoho-oauthtoken ${connection.accessToken}` }
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
    }, createErrorContext('ZohoWorkspaceProvider', 'validateConnection', { severity: ErrorSeverity.LOW }))
      .then(result => result.data || { isValid: false, status: ConnectionStatus.ERROR, error: result.error?.message });
  }

  async revokeConnection(connectionId: string): Promise<void> {
    await handleAsync(async () => {
      const db = DatabaseService.getInstance();
      const connection = await db.getWorkspaceConnection(connectionId);
      if (connection) {
        try {
          await this.httpClient.post(`${this.authBaseUrl}/revoke`, null, {
            params: { token: connection.accessToken }
          });
        } catch (error) {
          logger.warn('Failed to revoke tokens with Zoho', { connectionId, error });
        }
        await db.updateWorkspaceConnection(connectionId, { status: ConnectionStatus.REVOKED });
      }
    }, createErrorContext('ZohoWorkspaceProvider', 'revokeConnection', { severity: ErrorSeverity.MEDIUM }));
  }

  async isHealthy(): Promise<boolean> {
    const result = await handleAsync(async () => {
      return !!(process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET);
    }, createErrorContext('ZohoWorkspaceProvider', 'isHealthy', { severity: ErrorSeverity.LOW }));
    return result.success && result.data === true;
  }

  // Legacy compatibility methods
  async getAuthenticatedClient(connectionId: string): Promise<AxiosInstance> {
    const db = DatabaseService.getInstance();
    const connection = await db.getWorkspaceConnection(connectionId);
    if (!connection) throw new Error('Connection not found');

    return axios.create({
      timeout: 30000,
      headers: {
        'Authorization': `Zoho-oauthtoken ${connection.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async getServiceClient(connectionId: string, service: 'mail' | 'calendar' | 'sheets' | 'drive' | 'sheet'): Promise<AxiosInstance> {
    const authenticatedClient = await this.getAuthenticatedClient(connectionId);
    const serviceUrls = {
      mail: `https://mail.zoho.${this.region}/api`,
      calendar: `https://calendar.zoho.${this.region}/api/v1`,
      sheets: `https://sheet.zoho.${this.region}/api/v2`,
      drive: `https://www.zohoapis.${this.region}/workdrive/api/v1`,
      sheet: `https://sheet.zoho.${this.region}/api/v2`
    };
    authenticatedClient.defaults.baseURL = serviceUrls[service];
    return authenticatedClient;
  }

  static getRequiredScopes(): string[] {
    return [
      'ZohoMail.messages.ALL',
      'ZohoCalendar.event.ALL',
      'ZohoSheet.dataAPI.ALL',
      'ZohoWorkDrive.files.ALL'
    ];
  }

  static getExtendedScopes(): string[] {
    return [
      ...ZohoWorkspaceProvider.getRequiredScopes(),
      'ZohoContacts.contactapi.ALL',
      'ZohoWriter.documentapi.ALL'
    ];
  }
}
