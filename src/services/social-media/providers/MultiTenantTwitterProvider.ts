import { 
  MultiTenantOAuthConfig,
  PostCreationParams,
  PostScheduleParams,
  SocialMediaPost,
  ScheduledPost,
  AccountAnalytics,
  PostMetrics
} from './base/ISocialMediaProvider';
import { SocialMediaProvider } from '../database/ISocialMediaDatabase';
import { MultiTenantProviderBase } from './base/MultiTenantProviderBase';
import { fileStateStorage } from './base/FileStateStorage';
import crypto from 'crypto';

/**
 * Multi-Tenant Twitter Provider
 * 
 * Handles OAuth flows for multiple companies/users
 * Each tenant connects their own Twitter accounts
 * Supports multiple accounts per tenant (personal, company, product)
 */
export class MultiTenantTwitterProvider extends MultiTenantProviderBase {
  constructor() {
    const config: MultiTenantOAuthConfig = {
      platform: SocialMediaProvider.TWITTER,
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
      authUrl: 'https://twitter.com/i/oauth2/authorize',
      tokenUrl: 'https://api.twitter.com/2/oauth2/token',
      refreshUrl: 'https://api.twitter.com/2/oauth2/token',
      revokeUrl: 'https://api.twitter.com/2/oauth2/revoke',
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/social-media/callback/twitter`
    };
    
    super(config);
  }

  /**
   * Build Twitter OAuth URL with proper PKCE
   */
  protected async buildAuthUrl(state: string): Promise<string> {
    // Generate PKCE parameters
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    
    // Store the code verifier with the state so we can retrieve it during token exchange
    const stateData = fileStateStorage.get(state);
    if (stateData) {
      fileStateStorage.set(state, {
        ...stateData,
        codeVerifier // Add code verifier to state data
      } as any);
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.callbackUrl,
      scope: this.config.scopes.join(' '),
      state,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge
    });

    return `${this.config.authUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  protected async exchangeCodeForToken(code: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
  }> {
    // We need to get the code verifier from somewhere
    // Since this method doesn't have access to state, we'll need to modify the base class
    // For now, let's use a simple approach
    throw new Error('exchangeCodeForToken called without state context - this should not happen');
  }

  /**
   * Custom token exchange that includes state for PKCE
   */
  async exchangeCodeForTokenWithState(code: string, state: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
  }> {
    // Get the stored code verifier
    const stateData = fileStateStorage.get(state) as any;
    if (!stateData || !stateData.codeVerifier) {
      throw new Error('Code verifier not found for state');
    }

    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.callbackUrl,
        code_verifier: stateData.codeVerifier
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    return await response.json();
  }

  /**
   * Get user profile from Twitter API
   */
  async getUserProfile(accessToken: string): Promise<{
    id: string;
    name: string;
    username: string;
  }> {
    const response = await fetch('https://api.twitter.com/2/users/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get user profile');
    }

    const data = await response.json();
    return {
      id: data.data.id,
      name: data.data.name,
      username: data.data.username
    };
  }

  /**
   * Refresh access token using refresh token
   */
  protected async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }> {
    const response = await fetch(this.config.refreshUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    return await response.json();
  }

  /**
   * Revoke access token
   */
  protected async revokeAccessToken(accessToken: string): Promise<void> {
    await fetch(this.config.revokeUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        token: accessToken,
        token_type_hint: 'access_token'
      })
    });
  }

  /**
   * Test connection by making a simple API call
   */
  protected async testConnection(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.twitter.com/2/users/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Create a post on Twitter
   */
  async createPost(tenantId: string, accountId: string, params: PostCreationParams): Promise<SocialMediaPost> {
    const token = await this.getValidToken(tenantId, accountId);
    const accessToken = this.decryptToken(token.accessToken);

    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: params.content
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create tweet: ${error}`);
    }

    const data = await response.json();
    
    return {
      id: data.data.id,
      platform: SocialMediaProvider.TWITTER,
      platformPostId: data.data.id,
      content: params.content,
      url: `https://twitter.com/${token.accountUsername}/status/${data.data.id}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Schedule a post (placeholder implementation)
   */
  async schedulePost(tenantId: string, accountId: string, params: PostScheduleParams): Promise<ScheduledPost> {
    // Twitter API doesn't support native scheduling, would need third-party service
    throw new Error('Twitter native scheduling not supported. Use third-party scheduling service.');
  }

  /**
   * Get account analytics (placeholder implementation)
   */
  async getAccountAnalytics(tenantId: string, accountId: string, timeframe: string): Promise<AccountAnalytics> {
    // Would require Twitter Analytics API access
    throw new Error('Twitter analytics not implemented yet');
  }

  /**
   * Get post metrics (placeholder implementation)
   */
  async getPostMetrics(tenantId: string, accountId: string, postId: string): Promise<PostMetrics> {
    // Would require Twitter Analytics API access
    throw new Error('Twitter post metrics not implemented yet');
  }

  /**
   * Generate a cryptographically secure code verifier for PKCE
   */
  private generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Generate code challenge from verifier using SHA256
   */
  private generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }
} 