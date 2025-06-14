import axios, { AxiosInstance } from 'axios';
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
import { getRequiredScopes } from '../scopes/WorkspaceScopes';

/**
 * Zoho Workspace provider implementation
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

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly redirectUri: string,
    private readonly region: string = 'com' // com, eu, in, au, jp, ca
  ) {
    this.authBaseUrl = `https://accounts.zoho.${region}/oauth/v2`;
    this.apiBaseUrl = `https://www.zohoapis.${region}`;
    
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async initiateConnection(config: ConnectionConfig): Promise<ConnectionResult> {
    try {
      // Build the authorization URL
      const authUrl = new URL(`${this.authBaseUrl}/auth`);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', this.clientId);
      authUrl.searchParams.set('redirect_uri', config.redirectUri);
      
      // CRITICAL: Add access_type=offline to get refresh tokens
      authUrl.searchParams.set('access_type', 'offline');
      
      // Add prompt=consent to ensure user consent is always requested
      authUrl.searchParams.set('prompt', 'consent');
      
      // Only add scope parameter if scopes are provided
      if (config.scopes && config.scopes.length > 0) {
        const scopeString = config.scopes.join(' ');
        authUrl.searchParams.set('scope', scopeString);
        console.log('Zoho OAuth scopes being requested:', scopeString);
      }
      
      if (config.state) {
        authUrl.searchParams.set('state', config.state);
      }

      const finalUrl = authUrl.toString();
      console.log('Generated Zoho OAuth URL:', finalUrl);
      console.log('Auth base URL:', this.authBaseUrl);
      console.log('Client ID:', this.clientId);
      console.log('Redirect URI:', config.redirectUri);

      return {
        success: true,
        authUrl: finalUrl
      };
    } catch (error) {
      console.error('Error generating Zoho OAuth URL:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async completeConnection(authCode: string, state: string): Promise<WorkspaceConnection> {
    try {
      console.log('Attempting to exchange Zoho auth code for tokens...');
      
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
      console.log('Zoho token exchange successful:', {
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
      console.log('Zoho user info retrieved:', {
        hasEmail: !!userInfo.email,
        hasName: !!(userInfo.given_name || userInfo.family_name || userInfo.name),
        userId: userInfo.sub
      });
      
      if (!userInfo || !userInfo.email) {
        throw new Error('Unable to retrieve user email from Zoho');
      }

      // Determine account type based on domain
      const email = userInfo.email;
      const domain = email.split('@')[1];
      const isZohoDomain = domain.includes('zoho.') || domain.includes('zohocorp.');
      
      const accountType = isZohoDomain 
        ? WorkspaceAccountType.ORGANIZATIONAL 
        : WorkspaceAccountType.ORGANIZATIONAL; // Zoho is primarily for business

      // Create workspace connection record
      const db = DatabaseService.getInstance();
      
      // Check for existing connections for this user/provider combination
      const existingConnections = await db.findWorkspaceConnections({
        email,
        provider: WorkspaceProvider.ZOHO
      });
      
      // If there are existing connections, update the most recent one instead of creating a new one
      if (existingConnections.length > 0) {
        console.log(`Found ${existingConnections.length} existing Zoho connections for ${email}, updating the most recent one`);
        
        // Sort by creation date and get the most recent
        existingConnections.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const mostRecentConnection = existingConnections[0];
        
        // Update the existing connection with new tokens
        const updatedConnection = await db.updateWorkspaceConnection(mostRecentConnection.id, {
          accessToken: tokens.access_token || '',
          refreshToken: tokens.refresh_token || mostRecentConnection.refreshToken,
          tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
          scopes: tokens.scope || mostRecentConnection.scopes,
          displayName: userInfo.name || `${userInfo.given_name || ''} ${userInfo.family_name || ''}`.trim() || email,
          status: ConnectionStatus.ACTIVE
        });
        
        // Delete any duplicate connections (keep only the updated one)
        const duplicateConnections = existingConnections.slice(1);
        for (const duplicate of duplicateConnections) {
          console.log(`Deleting duplicate Zoho connection ${duplicate.id}`);
          await db.deleteWorkspaceConnection(duplicate.id);
        }
        
        return updatedConnection;
      }
      
      // Create new connection if none exists
      const connection = await db.createWorkspaceConnection({
        userId: stateData.userId || null,
        organizationId: stateData.organizationId || null,
        provider: WorkspaceProvider.ZOHO,
        accountType,
        connectionType: ConnectionType.OAUTH_PERSONAL,
        accessToken: tokens.access_token || '',
        refreshToken: tokens.refresh_token || undefined,
        tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
        scopes: tokens.scope || '',
        providerAccountId: userInfo.sub || userInfo.user_id || '',
        displayName: userInfo.name || `${userInfo.given_name || ''} ${userInfo.family_name || ''}`.trim() || email,
        email,
        domain: isZohoDomain ? domain : undefined,
        status: ConnectionStatus.ACTIVE
      });

      return connection;
    } catch (error) {
      console.error('Zoho connection completion error:', error);
      throw new Error(`Failed to complete Zoho Workspace connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async refreshConnection(connectionId: string): Promise<ConnectionResult> {
    try {
      const db = DatabaseService.getInstance();
      const connection = await db.getWorkspaceConnection(connectionId);
      
      if (!connection) {
        return {
          success: false,
          error: 'Connection not found'
        };
      }

      if (!connection.refreshToken) {
        console.error(`No refresh token available for connection ${connectionId}`);
        return {
          success: false,
          error: 'No refresh token available. Please re-authenticate to get a new refresh token.'
        };
      }

      console.log(`Refreshing Zoho access token for connection ${connectionId}...`);

      // Refresh the access token
      const tokenResponse = await this.httpClient.post(`${this.authBaseUrl}/token`, null, {
        params: {
          refresh_token: connection.refreshToken,
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret
        }
      });

      const tokens = tokenResponse.data;
      console.log('Zoho token refresh successful:', {
        hasAccessToken: !!tokens.access_token,
        expiresIn: tokens.expires_in,
        tokenType: tokens.token_type
      });
      
      // Update the connection with new tokens
      const updatedConnection = await db.updateWorkspaceConnection(connectionId, {
        accessToken: tokens.access_token,
        tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
        status: ConnectionStatus.ACTIVE
      });

      console.log(`Successfully refreshed Zoho token for connection ${connectionId}`);

      return {
        success: true,
        connectionId
      };
    } catch (error: any) {
      console.error('Zoho token refresh error:', error);
      
      // Check if it's a specific OAuth error
      if (error.response?.status === 400) {
        const errorData = error.response.data;
        if (errorData?.error === 'invalid_grant' || errorData?.error === 'invalid_request') {
          console.error('Refresh token is invalid or expired. User needs to re-authenticate.');
          
          // Mark connection as expired
          try {
            const db = DatabaseService.getInstance();
            await db.updateWorkspaceConnection(connectionId, {
              status: ConnectionStatus.EXPIRED
            });
          } catch (updateError) {
            console.error('Failed to update connection status:', updateError);
          }

          return {
            success: false,
            error: 'Refresh token is invalid or expired. Please re-authenticate.'
          };
        }
      }
      
      // Mark connection as error for other failures
      try {
        const db = DatabaseService.getInstance();
        await db.updateWorkspaceConnection(connectionId, {
          status: ConnectionStatus.ERROR
        });
      } catch (updateError: any) {
        console.error('Failed to update connection status:', updateError);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed'
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

      // Test the connection by making a simple API call to user info endpoint
      // This endpoint should work with basic email scope
      try {
        await this.httpClient.get(`${this.authBaseUrl}/userinfo`, {
          headers: {
            'Authorization': `Zoho-oauthtoken ${connection.accessToken}`
          }
        });

        return {
          isValid: true,
          status: ConnectionStatus.ACTIVE,
          expiresAt: connection.tokenExpiresAt || undefined
        };
      } catch (apiError: any) {
        console.error('Zoho API validation error:', apiError.response?.data || apiError.message);
        
        // If API call fails, the token might be invalid
        return {
          isValid: false,
          status: ConnectionStatus.ERROR,
          error: `API validation failed: ${apiError.response?.data?.error?.[0]?.message || apiError.message || 'Token may be invalid'}`
        };
      }
    } catch (error) {
      return {
        isValid: false,
        status: ConnectionStatus.ERROR,
        error: error instanceof Error ? error.message : 'Validation failed'
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

      // Revoke the refresh token with Zoho
      if (connection.refreshToken) {
        try {
          await this.httpClient.post(`${this.authBaseUrl}/token/revoke`, null, {
            params: {
              token: connection.refreshToken
            }
          });
        } catch (revokeError) {
          console.warn('Failed to revoke token with Zoho:', revokeError);
          // Continue with local cleanup even if remote revocation fails
        }
      }

      // Update connection status to revoked
      await db.updateWorkspaceConnection(connectionId, {
        status: ConnectionStatus.REVOKED
      });

      console.log(`Zoho connection ${connectionId} revoked successfully`);
    } catch (error) {
      console.error('Failed to revoke Zoho connection:', error);
      throw error;
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Test basic connectivity to Zoho auth server
      const response = await this.httpClient.get(`${this.authBaseUrl}/auth`, {
        timeout: 5000,
        validateStatus: (status) => status < 500 // Accept any status < 500 as healthy
      });
      return response.status < 500;
    } catch (error) {
      console.error('Zoho provider health check failed:', error);
      return false;
    }
  }

  /**
   * Get authenticated HTTP client for API calls
   */
  async getAuthenticatedClient(connectionId: string): Promise<AxiosInstance> {
    const db = DatabaseService.getInstance();
    const connection = await db.getWorkspaceConnection(connectionId);
    
    if (!connection) {
      throw new Error('Connection not found');
    }

    // Check if token needs refresh
    if (connection.tokenExpiresAt && connection.tokenExpiresAt <= new Date(Date.now() + 5 * 60 * 1000)) {
      // Token expires in 5 minutes or less, refresh it
      const refreshResult = await this.refreshConnection(connectionId);
      if (!refreshResult.success) {
        throw new Error(`Failed to refresh token: ${refreshResult.error}`);
      }
      
      // Get updated connection
      const updatedConnection = await db.getWorkspaceConnection(connectionId);
      if (!updatedConnection) {
        throw new Error('Failed to get updated connection');
      }
      
      return axios.create({
        baseURL: this.apiBaseUrl,
        timeout: 30000,
        headers: {
          'Authorization': `Zoho-oauthtoken ${updatedConnection.accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'CrowdWisdom-Agent-Swarm/1.0'
        }
      });
    }

    return axios.create({
      baseURL: this.apiBaseUrl,
      timeout: 30000,
      headers: {
        'Authorization': `Zoho-oauthtoken ${connection.accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'CrowdWisdom-Agent-Swarm/1.0'
      }
    });
  }

  /**
   * Get service-specific authenticated HTTP client for different Zoho APIs
   */
  async getServiceClient(connectionId: string, service: 'mail' | 'calendar' | 'sheets' | 'drive' | 'sheet'): Promise<AxiosInstance> {
    const db = DatabaseService.getInstance();
    const connection = await db.getWorkspaceConnection(connectionId);
    
    if (!connection) {
      throw new Error('Connection not found');
    }

    // Check if token needs refresh
    if (connection.tokenExpiresAt && connection.tokenExpiresAt <= new Date(Date.now() + 5 * 60 * 1000)) {
      // Token expires in 5 minutes or less, refresh it
      const refreshResult = await this.refreshConnection(connectionId);
      if (!refreshResult.success) {
        throw new Error(`Failed to refresh token: ${refreshResult.error}`);
      }
    }

    // Get service-specific base URL - FIXED: Use region-specific URLs
    let baseURL: string;
    switch (service) {
      case 'mail':
        // FIXED: Use correct Zoho Mail API base URL format
        baseURL = `https://mail.zoho.${this.region}`;
        break;
      case 'calendar':
        // FIXED: Use region-specific calendar API URL
        baseURL = `https://calendar.zoho.${this.region}/api/v1`;
        break;
      case 'sheets':
        baseURL = `https://sheet.zoho.${this.region}/api/v2`;
        break;
      case 'drive':
        baseURL = `https://workdrive.zoho.${this.region}/api/v1`;
        break;
      case 'sheet':
        baseURL = `https://sheet.zoho.${this.region}`;
        break;
      default:
        throw new Error(`Unsupported service: ${service}`);
    }

    console.log(`Creating ${service} client with base URL:`, baseURL);

    return axios.create({
      baseURL,
      headers: {
        'Authorization': `Zoho-oauthtoken ${connection.accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'CrowdWisdom-Agent-Swarm/1.0'
      },
      timeout: 30000
    });
  }

  /**
   * Get Zoho API scopes for different capabilities
   * Now using centralized scope configuration
   */
  static getRequiredScopes(): string[] {
    return getRequiredScopes(WorkspaceProvider.ZOHO);
  }

  /**
   * Get extended scopes for full workspace functionality
   * Use this once basic connection is working
   */
  static getExtendedScopes(): string[] {
    // For Zoho, extended scopes are the same as required since we use ALL scopes
    return getRequiredScopes(WorkspaceProvider.ZOHO);
  }
} 