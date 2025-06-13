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
      console.log('Attempting to exchange auth code for tokens...');
      
      // Decode state parameter to get user info
      let stateData: any = {};
      if (state) {
        try {
          stateData = JSON.parse(Buffer.from(state, 'base64').toString());
          console.log('Decoded state data:', stateData);
        } catch (error) {
          console.warn('Failed to decode state parameter:', error);
        }
      }
      
      // Exchange authorization code for tokens
      const { tokens } = await this.oauth2Client.getToken(authCode);
      
      console.log('Token exchange successful, tokens received:', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiryDate: tokens.expiry_date
      });
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
      
      // Check for existing connections for this user/provider combination
      const existingConnections = await db.findWorkspaceConnections({
        email,
        provider: WorkspaceProvider.GOOGLE_WORKSPACE
      });
      
      // If there are existing connections, update the most recent one instead of creating a new one
      if (existingConnections.length > 0) {
        console.log(`Found ${existingConnections.length} existing connections for ${email}, updating the most recent one`);
        
        // Sort by creation date and get the most recent
        existingConnections.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const mostRecentConnection = existingConnections[0];
        
        // Update the existing connection with new tokens
        const updatedConnection = await db.updateWorkspaceConnection(mostRecentConnection.id, {
          accessToken: tokens.access_token || '',
          refreshToken: tokens.refresh_token || mostRecentConnection.refreshToken,
          tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
          scopes: tokens.scope || mostRecentConnection.scopes,
          displayName: userInfo.data.name || email,
          status: ConnectionStatus.ACTIVE,
          updatedAt: new Date()
        });
        
        // Delete any duplicate connections (keep only the updated one)
        const duplicateConnections = existingConnections.slice(1);
        for (const duplicate of duplicateConnections) {
          console.log(`Deleting duplicate connection ${duplicate.id}`);
          await db.deleteWorkspaceConnection(duplicate.id);
        }
        
        return updatedConnection;
      }
      
      // Create new connection if none exists
      const connection = await db.createWorkspaceConnection({
        userId: stateData.userId,
        organizationId: stateData.organizationId,
        provider: WorkspaceProvider.GOOGLE_WORKSPACE,
        accountType,
        connectionType: ConnectionType.OAUTH_PERSONAL,
        accessToken: tokens.access_token || '',
        refreshToken: tokens.refresh_token || undefined,
        tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        scopes: tokens.scope || '',
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

      // Check if token is expired or will expire soon (within 5 minutes)
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
      const isExpiredOrExpiringSoon = connection.tokenExpiresAt && connection.tokenExpiresAt < fiveMinutesFromNow;

      if (isExpiredOrExpiringSoon && connection.refreshToken) {
        console.log(`Token for connection ${connectionId} is expired or expiring soon, attempting refresh...`);
        
        // Attempt to refresh the token automatically
        const refreshResult = await this.refreshConnection(connectionId);
        
        if (refreshResult.success) {
          console.log(`Successfully refreshed token for connection ${connectionId}`);
          // Get the updated connection after refresh
          const updatedConnection = await db.getWorkspaceConnection(connectionId);
          return {
            isValid: true,
            status: ConnectionStatus.ACTIVE,
            expiresAt: updatedConnection?.tokenExpiresAt || undefined
          };
        } else {
          console.error(`Failed to refresh token for connection ${connectionId}:`, refreshResult.error);
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
        await oauth2.userinfo.get();

        return {
          isValid: true,
          status: ConnectionStatus.ACTIVE,
          expiresAt: connection.tokenExpiresAt || undefined
        };
      } catch (apiError) {
        // If API call fails, try to refresh the token
        if (connection.refreshToken) {
          console.log(`API call failed for connection ${connectionId}, attempting token refresh...`);
          const refreshResult = await this.refreshConnection(connectionId);
          
          if (refreshResult.success) {
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