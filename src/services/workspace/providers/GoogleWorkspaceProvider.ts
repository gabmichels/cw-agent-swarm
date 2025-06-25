import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
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
  handleAsync,
  handleWithRetry
} from '../../../lib/errors/standardized-handler';
import { logger } from '../../../lib/logging';
import {
  encryptTokens,
  isTokenExpired,
  OAuthTokenData,
  registerTokenRefreshCallback,
  unifiedTokenManager
} from '../../../lib/security/unified-token-manager';

/**
 * Google Workspace provider implementation
 */
export class GoogleWorkspaceProvider implements IWorkspaceProvider {
  readonly providerId = WorkspaceProvider.GOOGLE_WORKSPACE;
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

  private oauth2Client: OAuth2Client;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor() {
    // Get configuration directly from environment variables for immediate availability
    this.clientId = process.env.GOOGLE_CLIENT_ID || '';
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    this.redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.BASE_URL || 'http://localhost:3000'}/api/workspace/callback`;

    if (!this.clientId || !this.clientSecret) {
      throw new Error('Google OAuth provider not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.');
    }

    this.oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );

    // Register token refresh callback with unified token manager
    registerTokenRefreshCallback('google-workspace', this.refreshTokenCallback.bind(this));

    logger.info('Google Workspace provider initialized', {
      providerId: this.providerId,
      redirectUri: this.redirectUri,
      supportedCapabilities: this.supportedCapabilities.length,
    });
  }

  async initiateConnection(config: ConnectionConfig): Promise<ConnectionResult> {
    const context = createErrorContext('GoogleWorkspaceProvider', 'initiateConnection', {
      severity: ErrorSeverity.LOW,
      retryable: false,
    });

    const result = await handleAsync(async () => {
      // Validate required configuration
      if (!config.scopes || config.scopes.length === 0) {
        throw new Error('OAuth scopes are required for Google Workspace connection');
      }

      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: config.scopes,
        state: config.state || '',
        prompt: 'consent', // Force consent to get refresh token
        include_granted_scopes: true,
      });

      logger.info('Google OAuth URL generated', {
        hasScopes: config.scopes.length > 0,
        hasState: !!config.state,
        redirectUri: this.redirectUri,
      });

      return { authUrl };
    }, context);

    return {
      success: result.success,
      authUrl: result.data?.authUrl,
      error: result.error?.message,
    };
  }

  async completeConnection(authCode: string, state: string): Promise<WorkspaceConnection> {
    const context = createErrorContext('GoogleWorkspaceProvider', 'completeConnection', {
      severity: ErrorSeverity.HIGH,
      retryable: true,
    });

    const result = await handleWithRetry(async () => {
      logger.info('Starting Google OAuth token exchange', { hasAuthCode: !!authCode, hasState: !!state });

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
      const { tokens } = await this.oauth2Client.getToken(authCode);

      if (!tokens.access_token) {
        throw new Error('No access token received from Google OAuth');
      }

      logger.info('Google OAuth token exchange successful', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiryDate: tokens.expiry_date,
        scopes: tokens.scope
      });

      this.oauth2Client.setCredentials(tokens);

      // Get user info to populate connection details
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const userInfo = await oauth2.userinfo.get();

      if (!userInfo.data.email) {
        throw new Error('Unable to retrieve user email from Google');
      }

      const email = userInfo.data.email;
      const domain = email.split('@')[1];
      const isGoogleDomain = domain === 'gmail.com' || domain === 'googlemail.com';

      // Store tokens securely using unified token manager
      const tokenData: OAuthTokenData = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        scopes: tokens.scope?.split(' ') || [],
      };

      const tokenId = `google-workspace-${userInfo.data.id || email}`;
      const encryptedTokens = await encryptTokens(tokenData);

      logger.info('Google OAuth tokens stored securely', {
        tokenId,
        email,
        hasRefreshToken: !!tokens.refresh_token
      });

      // Create or update workspace connection
      const db = DatabaseService.getInstance();
      const accountType = isGoogleDomain ? WorkspaceAccountType.PERSONAL : WorkspaceAccountType.ORGANIZATIONAL;

      const queryFilter: any = {
        email,
        provider: WorkspaceProvider.GOOGLE_WORKSPACE
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
          tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
          scopes: tokens.scope || mostRecentConnection.scopes,
          displayName: userInfo.data.name || email,
          status: ConnectionStatus.ACTIVE
        });

        // Clean up duplicate connections
        const duplicateConnections = existingConnections.slice(1);
        for (const duplicate of duplicateConnections) {
          try {
            await db.deleteWorkspaceConnection(duplicate.id);
            logger.debug('Deleted duplicate Google Workspace connection', { connectionId: duplicate.id });
          } catch (deleteError) {
            logger.warn('Failed to delete duplicate connection', { connectionId: duplicate.id, error: deleteError });
          }
        }

        // Schedule token refresh for the updated connection
        if (tokenData.expiresAt && tokenData.refreshToken) {
          try {
            unifiedTokenManager.scheduleTokenRefresh('google-workspace', updatedConnection.id, tokenData);
            logger.debug('Token refresh scheduled for updated connection', {
              connectionId: updatedConnection.id,
              expiresAt: tokenData.expiresAt
            });
          } catch (scheduleError) {
            logger.warn('Failed to schedule token refresh', {
              connectionId: updatedConnection.id,
              error: scheduleError
            });
          }
        }

        logger.info('Updated existing Google Workspace connection', {
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
          provider: WorkspaceProvider.GOOGLE_WORKSPACE,
          accountType,
          connectionType: ConnectionType.OAUTH_PERSONAL,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || undefined,
          tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
          scopes: tokens.scope || '',
          providerAccountId: userInfo.data.id || '',
          displayName: userInfo.data.name || email,
          email,
          domain: !isGoogleDomain ? domain : undefined,
          status: ConnectionStatus.ACTIVE
        });

        // Schedule token refresh for the new connection
        if (tokenData.expiresAt && tokenData.refreshToken) {
          try {
            unifiedTokenManager.scheduleTokenRefresh('google-workspace', connection.id, tokenData);
            logger.debug('Token refresh scheduled for new connection', {
              connectionId: connection.id,
              expiresAt: tokenData.expiresAt
            });
          } catch (scheduleError) {
            logger.warn('Failed to schedule token refresh', {
              connectionId: connection.id,
              error: scheduleError
            });
          }
        }

        logger.info('Created new Google Workspace connection', {
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
              tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
              scopes: tokens.scope || existingConnection.scopes,
              displayName: userInfo.data.name || email,
              status: ConnectionStatus.ACTIVE
            });
          }
        }

        throw createError;
      }
    }, context);

    if (!result.success) {
      throw new Error(`Failed to complete Google Workspace connection: ${result.error?.message}`);
    }

    return result.data!;
  }

  /**
   * Token refresh callback for unified token manager
   */
  private async refreshTokenCallback(refreshToken: string, provider: string, connectionId: string): Promise<OAuthTokenData> {
    const context = createErrorContext('GoogleWorkspaceProvider', 'refreshTokenCallback', {
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
    });

    const result = await handleAsync(async () => {
      if (!refreshToken) {
        throw new Error('No refresh token provided for Google Workspace connection');
      }

      // Set up OAuth client with refresh token
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      // Refresh the access token
      const { credentials } = await this.oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new Error('Failed to refresh Google access token - no new token received');
      }

      const refreshedTokens: OAuthTokenData = {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token || refreshToken,
        expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
        scopes: credentials.scope?.split(' ') || [],
      };

      logger.info('Google Workspace tokens refreshed successfully', {
        provider,
        connectionId,
        hasNewRefreshToken: !!credentials.refresh_token,
        newExpiryDate: credentials.expiry_date,
      });

      return refreshedTokens;
    }, context);

    if (!result.success) {
      logger.error('Failed to refresh Google Workspace tokens', {
        provider,
        connectionId,
        error: result.error?.message,
      });
      throw new Error(`Token refresh failed: ${result.error?.message}`);
    }

    return result.data!;
  }

  async refreshConnection(connectionId: string): Promise<ConnectionResult> {
    const context = createErrorContext('GoogleWorkspaceProvider', 'refreshConnection', {
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
        throw new Error('No refresh token available for this connection');
      }

      // Create token ID for unified token manager
      const tokenId = `google-workspace-${connection.providerAccountId || connection.email}`;

      // Try to refresh using unified token manager first
      const currentTokenData: OAuthTokenData = {
        accessToken: connection.accessToken,
        refreshToken: connection.refreshToken,
        expiresAt: connection.tokenExpiresAt || undefined,
        scopes: connection.scopes?.split(' ') || [],
      };

      const refreshedTokens = await unifiedTokenManager.refreshTokens('google-workspace', connectionId, currentTokenData);

      if (refreshedTokens) {
        // Update the database connection with refreshed tokens
        await db.updateWorkspaceConnection(connectionId, {
          accessToken: refreshedTokens.accessToken,
          refreshToken: refreshedTokens.refreshToken || connection.refreshToken,
          tokenExpiresAt: refreshedTokens.expiresAt,
          status: ConnectionStatus.ACTIVE
        });

        logger.info('Google Workspace connection refreshed via unified token manager', {
          connectionId,
          tokenId,
          hasNewRefreshToken: !!refreshedTokens.refreshToken,
        });

        return { connectionId };
      }

      // Fallback to direct OAuth refresh if unified token manager doesn't have the tokens
      logger.warn('Falling back to direct OAuth refresh for Google Workspace connection', {
        connectionId,
        tokenId,
      });

      this.oauth2Client.setCredentials({
        access_token: connection.accessToken,
        refresh_token: connection.refreshToken
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new Error('Failed to refresh access token - no new token received');
      }

      // Update database with new tokens
      await db.updateWorkspaceConnection(connectionId, {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token || connection.refreshToken,
        tokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
        status: ConnectionStatus.ACTIVE
      });

      logger.info('Google Workspace connection refreshed via direct OAuth', {
        connectionId,
        tokenId,
        hasNewRefreshToken: !!credentials.refresh_token,
      });

      return { connectionId };
    }, context);

    return {
      success: result.success,
      connectionId: result.data?.connectionId,
      error: result.error?.message,
    };
  }

  async validateConnection(connectionId: string): Promise<ValidationResult> {
    const context = createErrorContext('GoogleWorkspaceProvider', 'validateConnection', {
      severity: ErrorSeverity.LOW,
      retryable: true,
    });

    const result = await handleAsync(async () => {
      const db = DatabaseService.getInstance();
      const connection = await db.getWorkspaceConnection(connectionId);

      if (!connection) {
        return {
          isValid: false,
          status: ConnectionStatus.ERROR,
          error: 'Connection not found'
        };
      }

      logger.debug('Validating Google Workspace connection', {
        connectionId,
        email: connection.email,
        hasRefreshToken: !!connection.refreshToken,
        tokenExpiresAt: connection.tokenExpiresAt,
      });

      // Check if token is expired using unified token manager
      const tokenId = `google-workspace-${connection.providerAccountId || connection.email}`;

      let tokenExpired = false;
      if (connection.tokenExpiresAt) {
        const currentTokenData: OAuthTokenData = {
          accessToken: connection.accessToken,
          refreshToken: connection.refreshToken,
          expiresAt: connection.tokenExpiresAt,
          scopes: connection.scopes?.split(' ') || [],
        };
        tokenExpired = isTokenExpired(currentTokenData, 5 * 60); // 5 minutes buffer
      }

      if (tokenExpired && connection.refreshToken) {
        logger.info('Token expired or expiring soon, attempting refresh', {
          connectionId,
          tokenId,
          expiresAt: connection.tokenExpiresAt,
        });

        const refreshResult = await this.refreshConnection(connectionId);

        if (refreshResult.success) {
          const updatedConnection = await db.getWorkspaceConnection(connectionId);
          logger.info('Token refresh successful during validation', {
            connectionId,
            newExpiresAt: updatedConnection?.tokenExpiresAt,
          });

          return {
            isValid: true,
            status: ConnectionStatus.ACTIVE,
            expiresAt: updatedConnection?.tokenExpiresAt || undefined
          };
        } else {
          logger.error('Token refresh failed during validation', {
            connectionId,
            error: refreshResult.error,
          });

          return {
            isValid: false,
            status: ConnectionStatus.EXPIRED,
            error: `Token expired and refresh failed: ${refreshResult.error}`,
            expiresAt: connection.tokenExpiresAt
          };
        }
      }

      // Test the connection by making a simple API call
      this.oauth2Client.setCredentials({
        access_token: connection.accessToken,
        refresh_token: connection.refreshToken
      });

      try {
        const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
        const userInfo = await oauth2.userinfo.get();

        logger.debug('Google Workspace connection validation successful', {
          connectionId,
          userEmail: userInfo.data.email,
        });

        return {
          isValid: true,
          status: ConnectionStatus.ACTIVE,
          expiresAt: connection.tokenExpiresAt || undefined
        };
      } catch (apiError) {
        logger.warn('Google API call failed during validation', {
          connectionId,
          apiError: apiError instanceof Error ? apiError.message : 'Unknown API error',
        });

        // If API call fails, try to refresh the token
        if (connection.refreshToken) {
          logger.info('Attempting token refresh after API failure', { connectionId });
          const refreshResult = await this.refreshConnection(connectionId);

          if (refreshResult.success) {
            logger.info('Token refresh successful after API failure', { connectionId });
            return {
              isValid: true,
              status: ConnectionStatus.ACTIVE,
              expiresAt: connection.tokenExpiresAt || undefined
            };
          }
        }

        return {
          isValid: false,
          status: ConnectionStatus.ERROR,
          error: apiError instanceof Error ? apiError.message : 'API call failed'
        };
      }
    }, context);

    if (!result.success) {
      logger.error('Google Workspace connection validation failed', {
        connectionId,
        error: result.error?.message,
      });

      return {
        isValid: false,
        status: ConnectionStatus.ERROR,
        error: result.error?.message || 'Unknown error'
      };
    }

    return result.data!;
  }

  async revokeConnection(connectionId: string): Promise<void> {
    const context = createErrorContext('GoogleWorkspaceProvider', 'revokeConnection', {
      severity: ErrorSeverity.MEDIUM,
      retryable: false,
    });

    await handleAsync(async () => {
      const db = DatabaseService.getInstance();
      const connection = await db.getWorkspaceConnection(connectionId);

      if (!connection) {
        throw new Error('Connection not found');
      }

      logger.info('Revoking Google Workspace connection', {
        connectionId,
        email: connection.email,
      });

      // Revoke the token with Google
      this.oauth2Client.setCredentials({
        access_token: connection.accessToken,
        refresh_token: connection.refreshToken
      });

      try {
        await this.oauth2Client.revokeCredentials();
        logger.info('Successfully revoked tokens with Google', { connectionId });
      } catch (revokeError) {
        logger.warn('Failed to revoke tokens with Google (proceeding with local cleanup)', {
          connectionId,
          error: revokeError instanceof Error ? revokeError.message : 'Unknown error',
        });
      }

      // Note: Token cleanup in unified token manager happens automatically when connection is revoked

      // Update connection status in database
      await db.updateWorkspaceConnection(connectionId, {
        status: ConnectionStatus.REVOKED
      });

      logger.info('Google Workspace connection revoked successfully', { connectionId });
    }, context);
  }

  async isHealthy(): Promise<boolean> {
    const context = createErrorContext('GoogleWorkspaceProvider', 'isHealthy', {
      severity: ErrorSeverity.LOW,
      retryable: false,
    });

    const result = await handleAsync(async () => {
      // Verify configuration is available from environment
      const hasConfig = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

      if (!hasConfig) {
        throw new Error('Google OAuth environment variables not configured');
      }

      // Verify we can create an OAuth client
      const testClient = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret,
        this.redirectUri
      );

      if (!testClient) {
        throw new Error('Failed to create Google OAuth2 client');
      }

      logger.debug('Google Workspace provider health check passed', {
        providerId: this.providerId,
        hasClientId: !!this.clientId,
        hasClientSecret: !!this.clientSecret,
        redirectUri: this.redirectUri,
      });

      return true;
    }, context);

    const isHealthy = result.success && result.data === true;

    if (!isHealthy) {
      logger.warn('Google Workspace provider health check failed', {
        error: result.error?.message,
      });
    }

    return isHealthy;
  }
} 