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
 * Multi-Tenant Instagram Provider
 * 
 * Handles OAuth flows for multiple companies/users
 * Each tenant connects their own Instagram accounts
 * Supports Instagram Business and Creator accounts
 */
export class MultiTenantInstagramProvider extends MultiTenantProviderBase {
  constructor() {
    // Instagram Graph API uses Facebook credentials and requires Business/Creator account
    const config: MultiTenantOAuthConfig = {
      platform: SocialMediaProvider.INSTAGRAM,
      clientId: process.env.FACEBOOK_APP_ID!,
      clientSecret: process.env.FACEBOOK_APP_SECRET!,
      scopes: [
        'instagram_basic',
        'instagram_content_publish',
        'instagram_manage_insights',
        'pages_show_list',
        'pages_read_engagement'
      ],
      authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
      tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
      refreshUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
      revokeUrl: 'https://graph.facebook.com/v18.0/me/permissions',
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/social-media/callback/instagram`
    };
    
    super(config);
  }

  /**
   * Build Instagram OAuth URL (uses Facebook OAuth)
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
      throw new Error(`Instagram token exchange failed: ${error}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Instagram OAuth error: ${data.error.message}`);
    }

    return {
      access_token: data.access_token,
      refresh_token: undefined, // Instagram doesn't provide refresh tokens
      expires_in: data.expires_in || 3600,
      token_type: 'Bearer'
    };
  }

  /**
   * Get user profile from Instagram API
   */
  protected async getUserProfile(accessToken: string): Promise<{
    id: string;
    name: string;
    username: string;
  }> {
    // First get Facebook user info
    const fbResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${accessToken}`);

    if (!fbResponse.ok) {
      throw new Error('Failed to get Facebook user profile for Instagram');
    }

    const fbData = await fbResponse.json();
    
    // Get Instagram accounts connected to this Facebook user
    const igResponse = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`);
    
    if (!igResponse.ok) {
      throw new Error('Failed to get Instagram accounts');
    }

    const igData = await igResponse.json();
    
    // Find Instagram business account
    let instagramAccount = null;
    
    if (igData.data) {
      for (const page of igData.data) {
        // Check if this page has an Instagram business account
        const igBusinessResponse = await fetch(
          `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
        );
        
        if (igBusinessResponse.ok) {
          const igBusinessData = await igBusinessResponse.json();
          if (igBusinessData.instagram_business_account) {
            instagramAccount = {
              id: igBusinessData.instagram_business_account.id,
              name: page.name,
              username: page.name.toLowerCase().replace(/\s+/g, '')
            };
            break;
          }
        }
      }
    }

    if (!instagramAccount) {
      // Fallback to basic Instagram account info
      return {
        id: fbData.id,
        name: fbData.name,
        username: fbData.name.toLowerCase().replace(/\s+/g, '')
      };
    }

    return instagramAccount;
  }

  /**
   * Refresh access token using refresh token
   */
  protected async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  }> {
    // Instagram tokens don't have refresh tokens
    throw new Error('Instagram tokens cannot be refreshed. User must re-authenticate.');
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
   * Create a post on Instagram
   */
  async createPost(tenantId: string, accountId: string, params: PostCreationParams): Promise<SocialMediaPost> {
    const token = await this.getValidToken(tenantId, accountId);
    const accessToken = this.decryptToken(token.accessToken);

    // Get Instagram business account
    const igAccount = await this.getInstagramBusinessAccount(accessToken);
    
    if (!igAccount) {
      throw new Error('No Instagram Business account found. Instagram posting requires a Business or Creator account.');
    }

    // Instagram requires media for posts
    if (!params.media || params.media.length === 0) {
      throw new Error('Instagram posts require at least one image or video');
    }

    const media = params.media[0];
    
    // Step 1: Create media container
    const containerData: Record<string, unknown> = {
      image_url: media.url,
      caption: params.content,
      access_token: igAccount.accessToken
    };

    // Handle video vs image
    if (media.type === 'video') {
      containerData.media_type = 'VIDEO';
      containerData.video_url = media.url;
      delete containerData.image_url;
    }

    const containerResponse = await fetch(`https://graph.facebook.com/v18.0/${igAccount.id}/media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(containerData)
    });

    if (!containerResponse.ok) {
      const error = await containerResponse.text();
      throw new Error(`Failed to create Instagram media container: ${error}`);
    }

    const containerResult = await containerResponse.json();
    
    if (containerResult.error) {
      throw new Error(`Instagram container error: ${containerResult.error.message}`);
    }

    const containerId = containerResult.id;

    // Step 2: Publish the media container
    const publishResponse = await fetch(`https://graph.facebook.com/v18.0/${igAccount.id}/media_publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: igAccount.accessToken
      })
    });

    if (!publishResponse.ok) {
      const error = await publishResponse.text();
      throw new Error(`Failed to publish Instagram post: ${error}`);
    }

    const publishResult = await publishResponse.json();
    
    if (publishResult.error) {
      throw new Error(`Instagram publish error: ${publishResult.error.message}`);
    }

    const postId = publishResult.id;
    
    return {
      id: postId,
      platform: SocialMediaProvider.INSTAGRAM,
      platformPostId: postId,
      content: params.content,
      url: `https://www.instagram.com/p/${postId}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Schedule a post (Instagram supports scheduling for Business accounts)
   */
  async schedulePost(tenantId: string, accountId: string, params: PostScheduleParams): Promise<ScheduledPost> {
    // Instagram Content Publishing API supports scheduling
    // This is a simplified implementation
    throw new Error('Instagram scheduling not fully implemented yet. Use Facebook Creator Studio for scheduling.');
  }

  /**
   * Get account analytics
   */
  async getAccountAnalytics(tenantId: string, accountId: string, timeframe: string): Promise<AccountAnalytics> {
    const token = await this.getValidToken(tenantId, accountId);
    const accessToken = this.decryptToken(token.accessToken);

    const igAccount = await this.getInstagramBusinessAccount(accessToken);
    
    if (!igAccount) {
      throw new Error('Instagram analytics require a Business or Creator account');
    }

    // Get Instagram insights
    const insightsResponse = await fetch(
      `https://graph.facebook.com/v18.0/${igAccount.id}/insights?metric=follower_count,impressions,reach,profile_views&period=day&access_token=${igAccount.accessToken}`
    );

    if (!insightsResponse.ok) {
      throw new Error('Failed to get Instagram insights');
    }

    const insightsData = await insightsResponse.json();
    
    let followerCount = 0;
    let impressions = 0;
    let reach = 0;
    
    if (insightsData.data) {
      for (const insight of insightsData.data) {
        const latestValue = insight.values[insight.values.length - 1]?.value || 0;
        
        switch (insight.name) {
          case 'follower_count':
            followerCount = latestValue;
            break;
          case 'impressions':
            impressions = latestValue;
            break;
          case 'reach':
            reach = latestValue;
            break;
        }
      }
    }

    return {
      followerCount,
      followingCount: 0, // Not available in Instagram API
      postCount: 0, // Would need separate API call
      totalLikes: 0, // Would need to aggregate from posts
      totalComments: 0, // Would need to aggregate from posts
      totalShares: 0, // Instagram doesn't have shares
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
      `https://graph.facebook.com/v18.0/${postId}/insights?metric=impressions,reach,likes,comments,saves&access_token=${accessToken}`
    );

    if (!response.ok) {
      throw new Error('Failed to get Instagram post metrics');
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Instagram metrics error: ${data.error.message}`);
    }

    let impressions = 0;
    let reach = 0;
    let likes = 0;
    let comments = 0;
    let saves = 0;

    if (data.data) {
      for (const metric of data.data) {
        const value = metric.values[0]?.value || 0;
        
        switch (metric.name) {
          case 'impressions':
            impressions = value;
            break;
          case 'reach':
            reach = value;
            break;
          case 'likes':
            likes = value;
            break;
          case 'comments':
            comments = value;
            break;
          case 'saves':
            saves = value;
            break;
        }
      }
    }

    return {
      views: impressions,
      likes,
      shares: 0, // Instagram doesn't have shares
      comments,
      clicks: 0, // Not available in basic API
      engagementRate: reach > 0 ? ((likes + comments + saves) / reach) * 100 : 0,
      reach,
      impressions
    };
  }

  /**
   * Get supported account types for Instagram
   */
  getSupportedAccountTypes(): string[] {
    return ['business', 'creator'];
  }

  /**
   * Get Instagram Business Account
   */
  private async getInstagramBusinessAccount(accessToken: string): Promise<{
    id: string;
    accessToken: string;
  } | null> {
    // Get Facebook pages
    const pagesResponse = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`);
    
    if (!pagesResponse.ok) {
      return null;
    }

    const pagesData = await pagesResponse.json();
    
    if (!pagesData.data) {
      return null;
    }

    // Find page with Instagram business account
    for (const page of pagesData.data) {
      const igResponse = await fetch(
        `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
      );
      
      if (igResponse.ok) {
        const igData = await igResponse.json();
        if (igData.instagram_business_account) {
          return {
            id: igData.instagram_business_account.id,
            accessToken: page.access_token
          };
        }
      }
    }

    return null;
  }

  /**
   * Create Instagram Story
   */
  async createStory(tenantId: string, accountId: string, params: {
    mediaUrl: string;
    mediaType: 'image' | 'video';
  }): Promise<SocialMediaPost> {
    const token = await this.getValidToken(tenantId, accountId);
    const accessToken = this.decryptToken(token.accessToken);

    const igAccount = await this.getInstagramBusinessAccount(accessToken);
    
    if (!igAccount) {
      throw new Error('Instagram Stories require a Business or Creator account');
    }

    const storyData: Record<string, unknown> = {
      media_type: params.mediaType.toUpperCase(),
      access_token: igAccount.accessToken
    };

    if (params.mediaType === 'image') {
      storyData.image_url = params.mediaUrl;
    } else {
      storyData.video_url = params.mediaUrl;
    }

    const response = await fetch(`https://graph.facebook.com/v18.0/${igAccount.id}/media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(storyData)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create Instagram story: ${error}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Instagram story error: ${data.error.message}`);
    }

    return {
      id: data.id,
      platform: SocialMediaProvider.INSTAGRAM,
      platformPostId: data.id,
      content: 'Instagram Story',
      url: `https://www.instagram.com/stories/${igAccount.id}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
} 