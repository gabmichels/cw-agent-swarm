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

/**
 * Multi-Tenant LinkedIn Provider
 * 
 * Handles OAuth flows for multiple companies/users
 * Each tenant connects their own LinkedIn accounts
 * Supports multiple accounts per tenant (personal, company, product)
 */
export class MultiTenantLinkedInProvider extends MultiTenantProviderBase {
  constructor() {
    const config: MultiTenantOAuthConfig = {
      platform: SocialMediaProvider.LINKEDIN,
      clientId: process.env.LINKEDIN_CLIENT_ID!,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
      scopes: ['r_liteprofile', 'r_emailaddress', 'w_member_social'],
      authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
      tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
      refreshUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
      revokeUrl: 'https://www.linkedin.com/oauth/v2/revoke',
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/social-media/callback/linkedin`
    };
    
    super(config);
  }

  /**
   * Build LinkedIn OAuth URL
   */
  protected async buildAuthUrl(state: string): Promise<string> {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.callbackUrl,
      scope: this.config.scopes.join(' '),
      state
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
    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.callbackUrl,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LinkedIn token exchange failed: ${error}`);
    }

    return await response.json();
  }

  /**
   * Get user profile from LinkedIn API
   */
  protected async getUserProfile(accessToken: string): Promise<{
    id: string;
    name: string;
    username: string;
  }> {
    const response = await fetch('https://api.linkedin.com/v2/people/~:(id,firstName,lastName)', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get LinkedIn user profile');
    }

    const data = await response.json();
    return {
      id: data.id,
      name: `${data.firstName.localized.en_US} ${data.lastName.localized.en_US}`,
      username: data.id // LinkedIn doesn't have usernames like Twitter
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
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      })
    });

    if (!response.ok) {
      throw new Error('Failed to refresh LinkedIn token');
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
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        token: accessToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      })
    });
  }

  /**
   * Test connection by making a simple API call
   */
  protected async testConnection(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.linkedin.com/v2/people/~:(id)', {
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
   * Create a post on LinkedIn
   */
  async createPost(tenantId: string, accountId: string, params: PostCreationParams): Promise<SocialMediaPost> {
    const token = await this.getValidToken(tenantId, accountId);
    const accessToken = this.decryptToken(token.accessToken);

    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify({
        author: `urn:li:person:${token.accountUsername}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: params.content
            },
            shareMediaCategory: 'NONE'
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create LinkedIn post: ${error}`);
    }

    const data = await response.json();
    const postId = data.id;
    
    return {
      id: postId,
      platform: SocialMediaProvider.LINKEDIN,
      platformPostId: postId,
      content: params.content,
      url: `https://www.linkedin.com/feed/update/${postId}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Schedule a post (placeholder implementation)
   */
  async schedulePost(tenantId: string, accountId: string, params: PostScheduleParams): Promise<ScheduledPost> {
    // LinkedIn API doesn't support native scheduling, would need third-party service
    throw new Error('LinkedIn native scheduling not supported. Use third-party scheduling service.');
  }

  /**
   * Get account analytics (placeholder implementation)
   */
  async getAccountAnalytics(tenantId: string, accountId: string, timeframe: string): Promise<AccountAnalytics> {
    // Would require LinkedIn Analytics API access
    throw new Error('LinkedIn analytics not implemented yet');
  }

  /**
   * Get post metrics (placeholder implementation)
   */
  async getPostMetrics(tenantId: string, accountId: string, postId: string): Promise<PostMetrics> {
    // Would require LinkedIn Analytics API access
    throw new Error('LinkedIn post metrics not implemented yet');
  }

  /**
   * Get supported account types for LinkedIn
   */
  getSupportedAccountTypes(): string[] {
    return ['personal', 'company'];
  }
} 