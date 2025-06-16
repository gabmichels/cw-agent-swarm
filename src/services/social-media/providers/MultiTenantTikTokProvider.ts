import { 
  MultiTenantOAuthConfig,
  PostCreationParams,
  PostScheduleParams,
  SocialMediaPost,
  ScheduledPost,
  AccountAnalytics,
  PostMetrics,
  TikTokVideoUpload
} from './base/ISocialMediaProvider';
import { SocialMediaProvider } from '../database/ISocialMediaDatabase';
import { MultiTenantProviderBase } from './base/MultiTenantProviderBase';

/**
 * Multi-Tenant TikTok Provider
 * 
 * Handles OAuth flows for multiple companies/users
 * Each tenant connects their own TikTok accounts
 * Supports TikTok-specific features like video uploads and live streaming
 */
export class MultiTenantTikTokProvider extends MultiTenantProviderBase {
  constructor() {
    const config: MultiTenantOAuthConfig = {
      platform: SocialMediaProvider.TIKTOK,
      clientId: process.env.TIKTOK_CLIENT_ID!,
      clientSecret: process.env.TIKTOK_CLIENT_SECRET!,
      scopes: [
        'user.info.basic',
        'video.list',
        'video.upload',
        'video.publish'
      ],
      authUrl: 'https://www.tiktok.com/auth/authorize/',
      tokenUrl: 'https://open-api.tiktok.com/oauth/access_token/',
      refreshUrl: 'https://open-api.tiktok.com/oauth/refresh_token/',
      revokeUrl: 'https://open-api.tiktok.com/oauth/revoke/',
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/social-media/callback/tiktok`
    };
    
    super(config);
  }

  /**
   * Build TikTok OAuth URL
   */
  protected async buildAuthUrl(state: string): Promise<string> {
    const params = new URLSearchParams({
      client_key: this.config.clientId,
      scope: this.config.scopes.join(','),
      response_type: 'code',
      redirect_uri: this.config.callbackUrl,
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
        client_key: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.config.callbackUrl
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TikTok token exchange failed: ${error}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`TikTok OAuth error: ${data.error_description}`);
    }

    return {
      access_token: data.data.access_token,
      refresh_token: data.data.refresh_token,
      expires_in: data.data.expires_in,
      token_type: 'Bearer'
    };
  }

  /**
   * Get user profile from TikTok API
   */
  protected async getUserProfile(accessToken: string): Promise<{
    id: string;
    name: string;
    username: string;
  }> {
    const response = await fetch('https://open-api.tiktok.com/user/info/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: ['open_id', 'union_id', 'avatar_url', 'display_name', 'username']
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get TikTok user profile');
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`TikTok profile error: ${data.error.message}`);
    }

    return {
      id: data.data.user.open_id,
      name: data.data.user.display_name,
      username: data.data.user.username
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
        client_key: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      throw new Error('Failed to refresh TikTok token');
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`TikTok refresh error: ${data.error.message}`);
    }

    return {
      access_token: data.data.access_token,
      refresh_token: data.data.refresh_token,
      expires_in: data.data.expires_in
    };
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
        client_key: this.config.clientId,
        client_secret: this.config.clientSecret,
        token: accessToken
      })
    });
  }

  /**
   * Test connection by making a simple API call
   */
  protected async testConnection(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch('https://open-api.tiktok.com/user/info/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: ['open_id']
        })
      });
      
      if (!response.ok) return false;
      
      const data = await response.json();
      return !data.error;
    } catch {
      return false;
    }
  }

  /**
   * Create a post on TikTok (video upload)
   */
  async createPost(tenantId: string, accountId: string, params: PostCreationParams): Promise<SocialMediaPost> {
    // TikTok requires video content, so this is a simplified implementation
    // In practice, you'd need to handle video uploads differently
    throw new Error('TikTok posts require video content. Use uploadVideo method instead.');
  }

  /**
   * Upload a video to TikTok
   */
  async uploadVideo(tenantId: string, accountId: string, params: TikTokVideoUpload): Promise<SocialMediaPost> {
    const token = await this.getValidToken(tenantId, accountId);
    const accessToken = this.decryptToken(token.accessToken);

    // Step 1: Initialize video upload
    const initResponse = await fetch('https://open-api.tiktok.com/share/video/upload/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: params.videoFile.length,
          chunk_size: params.videoFile.length,
          total_chunk_count: 1
        }
      })
    });

    if (!initResponse.ok) {
      const error = await initResponse.text();
      throw new Error(`Failed to initialize TikTok video upload: ${error}`);
    }

    const initData = await initResponse.json();
    
    if (initData.error) {
      throw new Error(`TikTok upload error: ${initData.error.message}`);
    }

    const uploadUrl = initData.data.upload_url;
    
    // Step 2: Upload video file
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4'
      },
      body: params.videoFile as unknown as BodyInit
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload video to TikTok');
    }

    // Step 3: Publish video
    const publishResponse = await fetch('https://open-api.tiktok.com/share/video/publish/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        post_info: {
          title: params.title,
          description: params.description || '',
          privacy_level: params.privacy.toUpperCase(),
          disable_duet: !params.allowDuet,
          disable_comment: !params.allowComments,
          disable_stitch: !params.allowStitch,
          video_cover_timestamp_ms: 1000
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_id: initData.data.video_id
        }
      })
    });

    if (!publishResponse.ok) {
      const error = await publishResponse.text();
      throw new Error(`Failed to publish TikTok video: ${error}`);
    }

    const publishData = await publishResponse.json();
    
    if (publishData.error) {
      throw new Error(`TikTok publish error: ${publishData.error.message}`);
    }

    const videoId = publishData.data.share_id;
    
    return {
      id: videoId,
      platform: SocialMediaProvider.TIKTOK,
      platformPostId: videoId,
      content: params.title,
      url: `https://www.tiktok.com/@${token.accountUsername}/video/${videoId}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Schedule a post (placeholder implementation)
   */
  async schedulePost(tenantId: string, accountId: string, params: PostScheduleParams): Promise<ScheduledPost> {
    // TikTok API supports scheduling through their Creator Tools
    throw new Error('TikTok scheduling not implemented yet');
  }

  /**
   * Get account analytics
   */
  async getAccountAnalytics(tenantId: string, accountId: string, timeframe: string): Promise<AccountAnalytics> {
    const token = await this.getValidToken(tenantId, accountId);
    const accessToken = this.decryptToken(token.accessToken);

    const response = await fetch('https://open-api.tiktok.com/research/user/info/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: [
          'follower_count',
          'following_count',
          'likes_count',
          'video_count'
        ]
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get TikTok analytics');
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`TikTok analytics error: ${data.error.message}`);
    }

    return {
      followerCount: data.data.follower_count || 0,
      followingCount: data.data.following_count || 0,
      postCount: data.data.video_count || 0,
      totalLikes: data.data.likes_count || 0,
      totalComments: 0, // Not available in basic API
      totalShares: 0, // Not available in basic API
      engagementRate: 0, // Would need to calculate
      reachGrowth: 0, // Would need historical data
      topPosts: [] // Would need separate API call
    };
  }

  /**
   * Get post metrics for a specific video
   */
  async getPostMetrics(tenantId: string, accountId: string, postId: string): Promise<PostMetrics> {
    const token = await this.getValidToken(tenantId, accountId);
    const accessToken = this.decryptToken(token.accessToken);

    const response = await fetch('https://open-api.tiktok.com/research/video/query/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filters: {
          video_ids: [postId]
        },
        fields: [
          'id',
          'view_count',
          'like_count',
          'comment_count',
          'share_count'
        ]
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get TikTok video metrics');
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`TikTok metrics error: ${data.error.message}`);
    }

    const video = data.data.videos[0];
    
    return {
      views: video.view_count || 0,
      likes: video.like_count || 0,
      shares: video.share_count || 0,
      comments: video.comment_count || 0,
      clicks: 0, // Not available
      engagementRate: 0, // Would need to calculate
      reach: video.view_count || 0,
      impressions: video.view_count || 0
    };
  }

  /**
   * Get supported account types for TikTok
   */
  getSupportedAccountTypes(): string[] {
    return ['personal', 'creator', 'business'];
  }

  /**
   * Get trending hashtags for TikTok
   */
  async getTrendingHashtags(region = 'US'): Promise<Array<{
    hashtag: string;
    postCount: number;
    trend: 'rising' | 'stable' | 'declining';
  }>> {
    // This would require TikTok Research API access
    throw new Error('TikTok trending hashtags not implemented yet');
  }

  /**
   * Get trending sounds for TikTok
   */
  async getTrendingSounds(): Promise<Array<{
    soundId: string;
    title: string;
    artist: string;
    useCount: number;
  }>> {
    // This would require TikTok Research API access
    throw new Error('TikTok trending sounds not implemented yet');
  }
} 