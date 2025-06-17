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
 * Multi-Tenant Facebook Provider
 * 
 * Handles OAuth flows for multiple companies/users
 * Each tenant connects their own Facebook accounts
 * Supports both personal profiles and Facebook Pages
 */
export class MultiTenantFacebookProvider extends MultiTenantProviderBase {
  constructor() {
    const config: MultiTenantOAuthConfig = {
      platform: SocialMediaProvider.FACEBOOK,
      clientId: process.env.FACEBOOK_APP_ID!,
      clientSecret: process.env.FACEBOOK_APP_SECRET!,
      scopes: [
        'public_profile',
        'email',
        // TODO: Uncomment these scopes after Facebook App Review approval
        // 'pages_manage_posts',
        // 'pages_read_engagement',
        // 'pages_show_list', 
        // 'publish_to_groups'
      ],
      authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
      tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
      refreshUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
      revokeUrl: 'https://graph.facebook.com/v18.0/me/permissions',
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/social-media/callback/facebook`
    };
    
    super(config);
  }

  /**
   * Build Facebook OAuth URL
   */
  protected async buildAuthUrl(state: string): Promise<string> {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.callbackUrl,
      scope: this.config.scopes.join(','),
      response_type: 'code',
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
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.callbackUrl,
      code
    });

    const response = await fetch(`${this.config.tokenUrl}?${params.toString()}`);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Facebook token exchange failed: ${error}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Facebook OAuth error: ${data.error.message}`);
    }

    return {
      access_token: data.access_token,
      refresh_token: undefined, // Facebook doesn't provide refresh tokens for user tokens
      expires_in: data.expires_in || 3600,
      token_type: 'Bearer'
    };
  }

  /**
   * Get user profile from Facebook API
   */
  protected async getUserProfile(accessToken: string): Promise<{
    id: string;
    name: string;
    username: string;
  }> {
    const response = await fetch(`https://graph.facebook.com/v18.0/me?fields=id,name,email&access_token=${accessToken}`);

    if (!response.ok) {
      throw new Error('Failed to get Facebook user profile');
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Facebook profile error: ${data.error.message}`);
    }

    return {
      id: data.id,
      name: data.name,
      username: data.id // Facebook doesn't have usernames like Twitter
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
    // Facebook user access tokens don't have refresh tokens
    // They need to be exchanged for long-lived tokens
    throw new Error('Facebook user tokens cannot be refreshed. User must re-authenticate.');
  }

  /**
   * Revoke access token
   */
  protected async revokeAccessToken(accessToken: string): Promise<void> {
    await fetch(`${this.config.revokeUrl}?access_token=${accessToken}`, {
      method: 'DELETE'
    });
  }

  /**
   * Test connection by making a simple API call
   */
  protected async testConnection(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${accessToken}`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Create a post on Facebook
   */
  async createPost(tenantId: string, accountId: string, params: PostCreationParams): Promise<SocialMediaPost> {
    const token = await this.getValidToken(tenantId, accountId);
    const accessToken = this.decryptToken(token.accessToken);

    // Get user's pages to determine where to post
    const pagesResponse = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`);
    
    if (!pagesResponse.ok) {
      throw new Error('Failed to get Facebook pages');
    }

    const pagesData = await pagesResponse.json();
    
    // For simplicity, post to the first page or user's feed
    let postEndpoint = 'me/feed';
    let postAccessToken = accessToken;
    
    if (pagesData.data && pagesData.data.length > 0) {
      // Post to the first page
      const page = pagesData.data[0];
      postEndpoint = `${page.id}/feed`;
      postAccessToken = page.access_token;
    }

    const postData: Record<string, unknown> = {
      message: params.content,
      access_token: postAccessToken
    };

    // Add media if provided
    if (params.media && params.media.length > 0) {
      // For images, use the photos endpoint
      postEndpoint = postEndpoint.replace('/feed', '/photos');
      postData.url = params.media[0].url;
      postData.caption = params.content;
      delete postData.message;
    }

    const response = await fetch(`https://graph.facebook.com/v18.0/${postEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postData)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create Facebook post: ${error}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Facebook post error: ${data.error.message}`);
    }

    const postId = data.id;
    
    return {
      id: postId,
      platform: SocialMediaProvider.FACEBOOK,
      platformPostId: postId,
      content: params.content,
      url: `https://www.facebook.com/${postId}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Schedule a post (Facebook supports native scheduling for Pages)
   */
  async schedulePost(tenantId: string, accountId: string, params: PostScheduleParams): Promise<ScheduledPost> {
    const token = await this.getValidToken(tenantId, accountId);
    const accessToken = this.decryptToken(token.accessToken);

    // Get user's pages
    const pagesResponse = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`);
    
    if (!pagesResponse.ok) {
      throw new Error('Failed to get Facebook pages for scheduling');
    }

    const pagesData = await pagesResponse.json();
    
    if (!pagesData.data || pagesData.data.length === 0) {
      throw new Error('Scheduling is only available for Facebook Pages, not personal profiles');
    }

    const page = pagesData.data[0];
    const scheduledTime = Math.floor(params.scheduledTime.getTime() / 1000);

    const postData = {
      message: params.content,
      published: false,
      scheduled_publish_time: scheduledTime,
      access_token: page.access_token
    };

    const response = await fetch(`https://graph.facebook.com/v18.0/${page.id}/feed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(postData)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to schedule Facebook post: ${error}`);
    }

    const data = await response.json();
    
    return {
      id: data.id,
      platform: SocialMediaProvider.FACEBOOK,
      content: params.content,
      scheduledTime: params.scheduledTime,
      status: 'scheduled',
      createdAt: new Date()
    };
  }

  /**
   * Get account analytics
   */
  async getAccountAnalytics(tenantId: string, accountId: string, timeframe: string): Promise<AccountAnalytics> {
    const token = await this.getValidToken(tenantId, accountId);
    const accessToken = this.decryptToken(token.accessToken);

    // Get pages for analytics
    const pagesResponse = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`);
    
    if (!pagesResponse.ok) {
      throw new Error('Failed to get Facebook pages');
    }

    const pagesData = await pagesResponse.json();
    
    if (!pagesData.data || pagesData.data.length === 0) {
      // Return basic analytics for personal profile
      return {
        followerCount: 0,
        followingCount: 0,
        postCount: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        engagementRate: 0,
        reachGrowth: 0,
        topPosts: []
      };
    }

    const page = pagesData.data[0];
    
    // Get page insights
    const insightsResponse = await fetch(
      `https://graph.facebook.com/v18.0/${page.id}/insights?metric=page_fans,page_post_engagements&access_token=${page.access_token}`
    );

    if (!insightsResponse.ok) {
      throw new Error('Failed to get Facebook page insights');
    }

    const insightsData = await insightsResponse.json();
    
    let followerCount = 0;
    let engagements = 0;
    
    if (insightsData.data) {
      for (const insight of insightsData.data) {
        if (insight.name === 'page_fans') {
          followerCount = insight.values[0]?.value || 0;
        } else if (insight.name === 'page_post_engagements') {
          engagements = insight.values[0]?.value || 0;
        }
      }
    }

    return {
      followerCount,
      followingCount: 0, // Not applicable for pages
      postCount: 0, // Would need separate API call
      totalLikes: engagements,
      totalComments: 0, // Would need separate API call
      totalShares: 0, // Would need separate API call
      engagementRate: 0, // Would need to calculate
      reachGrowth: 0, // Would need historical data
      topPosts: [] // Would need separate API call
    };
  }

  /**
   * Get post metrics
   */
  async getPostMetrics(tenantId: string, accountId: string, postId: string): Promise<PostMetrics> {
    const token = await this.getValidToken(tenantId, accountId);
    const accessToken = this.decryptToken(token.accessToken);

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${postId}?fields=likes.summary(true),comments.summary(true),shares&access_token=${accessToken}`
    );

    if (!response.ok) {
      throw new Error('Failed to get Facebook post metrics');
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Facebook metrics error: ${data.error.message}`);
    }

    return {
      views: 0, // Not available in basic API
      likes: data.likes?.summary?.total_count || 0,
      shares: data.shares?.count || 0,
      comments: data.comments?.summary?.total_count || 0,
      clicks: 0, // Not available in basic API
      engagementRate: 0, // Would need to calculate
      reach: 0, // Would need insights API
      impressions: 0 // Would need insights API
    };
  }

  /**
   * Get supported account types for Facebook
   */
  getSupportedAccountTypes(): string[] {
    return ['personal', 'business'];
  }

  /**
   * Get user's Facebook Pages
   */
  async getPages(tenantId: string, accountId: string): Promise<Array<{
    id: string;
    name: string;
    accessToken: string;
  }>> {
    const token = await this.getValidToken(tenantId, accountId);
    const accessToken = this.decryptToken(token.accessToken);

    const response = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`);
    
    if (!response.ok) {
      throw new Error('Failed to get Facebook pages');
    }

    const data = await response.json();
    
    return data.data?.map((page: any) => ({
      id: page.id,
      name: page.name,
      accessToken: page.access_token
    })) || [];
  }
} 