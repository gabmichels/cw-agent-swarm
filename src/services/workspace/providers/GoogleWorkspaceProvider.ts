import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { IWorkspaceProvider, ConnectionConfig, ConnectionResult, ValidationResult } from './IWorkspaceProvider';
import { 
  WorkspaceProvider, 
  WorkspaceCapabilityType, 
  WorkspaceConnection,
  ConnectionStatus,
  WorkspaceAccountType,
  ConnectionType
} from '../../database/types';
import { DatabaseService } from '../../database/DatabaseService';

/**
 * Google Workspace provider implementation
 */
export class GoogleWorkspaceProvider implements IWorkspaceProvider {
  readonly providerId = WorkspaceProvider.GOOGLE_WORKSPACE;
  readonly supportedCapabilities = [
    WorkspaceCapabilityType.EMAIL_SEND,
    WorkspaceCapabilityType.EMAIL_READ,
    WorkspaceCapabilityType.CALENDAR_READ,
    WorkspaceCapabilityType.CALENDAR_CREATE,
    WorkspaceCapabilityType.CALENDAR_EDIT,
    WorkspaceCapabilityType.DRIVE_READ,
    WorkspaceCapabilityType.DRIVE_UPLOAD,
    WorkspaceCapabilityType.DRIVE_MANAGE,
    WorkspaceCapabilityType.CONTACTS_READ,
    WorkspaceCapabilityType.CONTACTS_MANAGE
  ];

  private oauth2Client: OAuth2Client;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly redirectUri: string
  ) {
    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );
  }

  async initiateConnection(config: ConnectionConfig): Promise<ConnectionResult> {
    try {
      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: config.scopes,
        state: config.state || '',
        prompt: 'consent' // Force consent to get refresh token
      });

      return {
        success: true,
        authUrl
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async completeConnection(authCode: string, state: string): Promise<WorkspaceConnection> {
    try {
      // Exchange authorization code for tokens
      const { tokens } = await this.oauth2Client.getToken(authCode);
      this.oauth2Client.setCredentials(tokens);

      // Get user info to populate connection details
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const userInfo = await oauth2.userinfo.get();

      if (!userInfo.data.email) {
        throw new Error('Unable to retrieve user email');
      }

      // Determine account type based on domain
      const email = userInfo.data.email;
      const domain = email.split('@')[1];
      const isGoogleDomain = domain === 'gmail.com' || domain === 'googlemail.com';
      
      const accountType = isGoogleDomain 
        ? WorkspaceAccountType.PERSONAL 
        : WorkspaceAccountType.ORGANIZATIONAL;

      // Create workspace connection record
      const db = DatabaseService.getInstance();
      const connection = await db.createWorkspaceConnection({
        provider: WorkspaceProvider.GOOGLE_WORKSPACE,
        accountType,
        connectionType: ConnectionType.OAUTH_PERSONAL,
        accessToken: tokens.access_token || '',
        refreshToken: tokens.refresh_token || undefined,
        tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        scopes: tokens.scope?.split(' ') || [],
        providerAccountId: userInfo.data.id || '',
        displayName: userInfo.data.name || email,
        email,
        domain: isGoogleDomain ? undefined : domain,
        status: ConnectionStatus.ACTIVE
      });

      return connection;
    } catch (error) {
      throw new Error(`Failed to complete Google Workspace connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async refreshConnection(connectionId: string): Promise<ConnectionResult> {
    try {
      const db = DatabaseService.getInstance();
      const connection = await db.getWorkspaceConnection(connectionId);
      
      if (!connection || !connection.refreshToken) {
        return {
          success: false,
          error: 'Connection not found or no refresh token available'
        };
      }

      // Set up OAuth client with existing tokens
      this.oauth2Client.setCredentials({
        access_token: connection.accessToken,
        refresh_token: connection.refreshToken
      });

      // Refresh the access token
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      // Update the connection with new tokens
      await db.updateWorkspaceConnection(connectionId, {
        accessToken: credentials.access_token || connection.accessToken,
        tokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
        status: ConnectionStatus.ACTIVE
      });

      return {
        success: true,
        connectionId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async validateConnection(connectionId: string): Promise<ValidationResult> {
    try {
      const db = DatabaseService.getInstance();
      const connection = await db.getWorkspaceConnection(connectionId);
      
      if (!connection) {
        return {
          isValid: false,
          status: ConnectionStatus.ERROR,
          error: 'Connection not found'
        };
      }

      // Check if token is expired
      if (connection.tokenExpiresAt && connection.tokenExpiresAt < new Date()) {
        return {
          isValid: false,
          status: ConnectionStatus.EXPIRED,
          expiresAt: connection.tokenExpiresAt
        };
      }

      // Test the connection by making a simple API call
      this.oauth2Client.setCredentials({
        access_token: connection.accessToken,
        refresh_token: connection.refreshToken
      });

      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      await oauth2.userinfo.get();

      return {
        isValid: true,
        status: ConnectionStatus.ACTIVE,
        expiresAt: connection.tokenExpiresAt || undefined
      };
    } catch (error) {
      return {
        isValid: false,
        status: ConnectionStatus.ERROR,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async revokeConnection(connectionId: string): Promise<void> {
    try {
      const db = DatabaseService.getInstance();
      const connection = await db.getWorkspaceConnection(connectionId);
      
      if (!connection) {
        throw new Error('Connection not found');
      }

      // Revoke the token with Google
      this.oauth2Client.setCredentials({
        access_token: connection.accessToken,
        refresh_token: connection.refreshToken
      });

      await this.oauth2Client.revokeCredentials();

      // Update connection status
      await db.updateWorkspaceConnection(connectionId, {
        status: ConnectionStatus.REVOKED
      });
    } catch (error) {
      throw new Error(`Failed to revoke Google Workspace connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Simple health check - verify we can create an OAuth client
      const testClient = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret,
        this.redirectUri
      );
      return !!testClient;
    } catch {
      return false;
    }
  }
} 