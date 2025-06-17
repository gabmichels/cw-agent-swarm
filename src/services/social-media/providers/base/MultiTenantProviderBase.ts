import { ulid } from 'ulid';
import * as crypto from 'crypto';
import { PrismaStateStorage } from './PrismaStateStorage';
import { 
  MultiTenantOAuthConfig,
  TenantSocialToken,
  PostCreationParams,
  PostScheduleParams,
  SocialMediaPost,
  ScheduledPost,
  AccountAnalytics,
  PostMetrics
} from './ISocialMediaProvider';
import { SocialMediaProvider } from '../../database/ISocialMediaDatabase';

/**
 * Multi-Tenant Provider Interface
 * Common interface for all multi-tenant social media providers
 */
export interface IMultiTenantSocialMediaProvider {
  // OAuth management
  initiateOAuth(tenantId: string, userId: string, accountType?: string): Promise<{
    authUrl: string;
    state: string;
  }>;
  
  handleOAuthCallback(params: {
    code: string;
    state: string;
    tenantId: string;
    userId: string;
  }): Promise<TenantSocialToken>;
  
  refreshToken(tokenId: string): Promise<TenantSocialToken>;
  revokeToken(tokenId: string): Promise<void>;
  
  // Content operations
  createPost(tenantId: string, accountId: string, params: PostCreationParams): Promise<SocialMediaPost>;
  schedulePost(tenantId: string, accountId: string, params: PostScheduleParams): Promise<ScheduledPost>;
  
  // Analytics
  getAccountAnalytics(tenantId: string, accountId: string, timeframe: string): Promise<AccountAnalytics>;
  getPostMetrics(tenantId: string, accountId: string, postId: string): Promise<PostMetrics>;
  
  // Account management
  getConnectedAccounts(tenantId: string): Promise<TenantSocialToken[]>;
  validateConnection(tenantId: string, accountId: string): Promise<boolean>;
  
  // Platform info
  getPlatform(): SocialMediaProvider;
  getSupportedAccountTypes(): string[];
}

/**
 * Abstract base class for multi-tenant social media providers
 * Provides common functionality that all platforms can use
 */
export abstract class MultiTenantProviderBase implements IMultiTenantSocialMediaProvider {
  protected config: MultiTenantOAuthConfig;
  protected tokenStorage: Map<string, TenantSocialToken> = new Map();
  protected stateStorage: PrismaStateStorage;

  constructor(config: MultiTenantOAuthConfig) {
    this.config = config;
    this.stateStorage = new PrismaStateStorage();
  }

  /**
   * Step 1: Initiate OAuth flow for a tenant
   */
  async initiateOAuth(tenantId: string, userId: string, accountType = 'personal'): Promise<{
    authUrl: string;
    state: string;
  }> {
    // Generate secure state parameter
    const state = ulid();
    
    console.log('Storing OAuth state:', { state, tenantId, userId, accountType });
    
    // Store state with tenant context in database
    await this.stateStorage.set(state, { 
      tenantId, 
      userId, 
      platform: this.config.platform,
      accountType
    });
    
    // Build OAuth URL with platform-specific parameters
    const authUrl = await this.buildAuthUrl(state);

    console.log('OAuth initiation complete:', { state, authUrl });
    return { authUrl, state };
  }

  /**
   * Step 2: Handle OAuth callback and exchange code for tokens
   */
  async handleOAuthCallback(params: {
    code: string;
    state: string;
    tenantId: string;
    userId: string;
  }): Promise<TenantSocialToken> {
    // Validate state parameter
    const stateData = await this.stateStorage.get(params.state);
    if (!stateData || stateData.tenantId !== params.tenantId) {
      throw new Error('Invalid OAuth state parameter');
    }

    // Exchange authorization code for access token
    const tokenResponse = await this.exchangeCodeForToken(params.code);
    
    // Get user profile information
    const userProfile = await this.getUserProfile(tokenResponse.access_token);

    // Create tenant social token
    const tenantToken: TenantSocialToken = {
      tenantId: params.tenantId,
      userId: params.userId,
      platform: this.config.platform,
      accountId: ulid(),
      accountDisplayName: userProfile.name,
      accountUsername: userProfile.username,
      accountType: (stateData.accountType as 'personal' | 'company' | 'product') || 'personal',
      accessToken: this.encryptToken(tokenResponse.access_token),
      refreshToken: tokenResponse.refresh_token ? this.encryptToken(tokenResponse.refresh_token) : undefined,
      expiresAt: new Date(Date.now() + (tokenResponse.expires_in * 1000)),
      scopes: this.config.scopes,
      isActive: true,
      lastRefreshed: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Store token (in production, this would go to database)
    this.tokenStorage.set(tenantToken.accountId, tenantToken);
    
    // Clean up state
    await this.stateStorage.delete(params.state);

    return tenantToken;
  }

  /**
   * Refresh expired access token
   */
  async refreshToken(tokenId: string): Promise<TenantSocialToken> {
    const token = this.tokenStorage.get(tokenId);
    if (!token || !token.refreshToken) {
      throw new Error('Token not found or no refresh token available');
    }

    const refreshToken = this.decryptToken(token.refreshToken);
    const tokenData = await this.refreshAccessToken(refreshToken);

    // Update stored token
    token.accessToken = this.encryptToken(tokenData.access_token);
    if (tokenData.refresh_token) {
      token.refreshToken = this.encryptToken(tokenData.refresh_token);
    }
    token.expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
    token.lastRefreshed = new Date();
    token.updatedAt = new Date();

    this.tokenStorage.set(tokenId, token);
    return token;
  }

  /**
   * Revoke token
   */
  async revokeToken(tokenId: string): Promise<void> {
    const token = this.tokenStorage.get(tokenId);
    if (token) {
      // Call platform-specific revoke endpoint if available
      if (this.config.revokeUrl) {
        await this.revokeAccessToken(this.decryptToken(token.accessToken));
      }
      
      token.isActive = false;
      this.tokenStorage.set(tokenId, token);
    }
  }

  /**
   * Get all connected accounts for a tenant
   */
  async getConnectedAccounts(tenantId: string): Promise<TenantSocialToken[]> {
    return Array.from(this.tokenStorage.values())
      .filter(token => token.tenantId === tenantId && token.isActive);
  }

  /**
   * Validate a connection is still active
   */
  async validateConnection(tenantId: string, accountId: string): Promise<boolean> {
    try {
      const token = await this.getValidToken(tenantId, accountId);
      return await this.testConnection(this.decryptToken(token.accessToken));
    } catch (error) {
      return false;
    }
  }

  /**
   * Get platform
   */
  getPlatform(): SocialMediaProvider {
    return this.config.platform;
  }

  /**
   * Get supported account types (can be overridden by platforms)
   */
  getSupportedAccountTypes(): string[] {
    return ['personal', 'company', 'product'];
  }

  /**
   * Get a valid token, refreshing if necessary
   */
  protected async getValidToken(tenantId: string, accountId: string): Promise<TenantSocialToken> {
    const token = this.tokenStorage.get(accountId);
    
    if (!token || token.tenantId !== tenantId) {
      throw new Error('Token not found or access denied');
    }

    // Check if token is expired
    if (token.expiresAt <= new Date()) {
      if (token.refreshToken) {
        return await this.refreshToken(accountId);
      } else {
        throw new Error('Token expired and no refresh token available');
      }
    }

    return token;
  }

  /**
   * Encrypt token for storage
   */
  protected encryptToken(token: string): string {
    const key = process.env.SOCIAL_MEDIA_ENCRYPTION_KEY!;
    const cipher = crypto.createCipher('aes-256-cbc', key);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * Decrypt token from storage
   */
  protected decryptToken(encryptedToken: string): string {
    const key = process.env.SOCIAL_MEDIA_ENCRYPTION_KEY!;
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(encryptedToken, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // Abstract methods that each platform must implement
  protected abstract buildAuthUrl(state: string): Promise<string>;
  protected abstract exchangeCodeForToken(code: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
  }>;
  protected abstract getUserProfile(accessToken: string): Promise<{
    id: string;
    name: string;
    username: string;
  }>;
  protected abstract refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }>;
  protected abstract revokeAccessToken(accessToken: string): Promise<void>;
  protected abstract testConnection(accessToken: string): Promise<boolean>;

  // Abstract methods for content operations
  public abstract createPost(tenantId: string, accountId: string, params: PostCreationParams): Promise<SocialMediaPost>;
  public abstract schedulePost(tenantId: string, accountId: string, params: PostScheduleParams): Promise<ScheduledPost>;
  public abstract getAccountAnalytics(tenantId: string, accountId: string, timeframe: string): Promise<AccountAnalytics>;
  public abstract getPostMetrics(tenantId: string, accountId: string, postId: string): Promise<PostMetrics>;
} 