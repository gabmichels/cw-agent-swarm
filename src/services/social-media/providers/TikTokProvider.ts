import { 
  ISocialMediaProvider, 
  SocialMediaPost, 
  PostCreationParams,
  PostScheduleParams,
  ScheduledPost,
  MediaFile,
  PostMetrics,
  ContentAnalysis,
  OptimizedContent,
  CommentResponse,
  ResponseStrategy,
  SocialMediaError
} from './base/ISocialMediaProvider';
import { 
  SocialMediaProvider, 
  SocialMediaCapability,
  SocialMediaConnection,
  SocialMediaConnectionStatus
} from '../database/ISocialMediaDatabase';

// TikTok specific interfaces
export interface TikTokVideoUpload {
  videoFile: MediaFile; // Changed from Buffer to MediaFile
  title: string;
  description?: string;
  hashtags?: string[];
  privacy: 'public' | 'friends' | 'private';
  allowComments: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  scheduleTime?: Date;
}

export interface TikTokVideoAnalytics {
  postId: string;
  impressions: number;
  reach: number;
  likes: number;
  shares: number;
  comments: number;
  clicks: number;
  engagementRate: number;
  playTime: number;
  completionRate: number;
  trafficSources: Record<string, number>;
}

export class TikTokProvider implements ISocialMediaProvider {
  private connections = new Map<string, SocialMediaConnection>();

  constructor() {
    // Initialize provider
  }

  addConnection(connection: SocialMediaConnection): void {
    this.connections.set(connection.id, connection);
  }

  async validateConnection(connectionId: string): Promise<boolean> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        return false;
      }

      // Test connection with TikTok API
      const credentials = JSON.parse(connection.encryptedCredentials);
      
      const response = await fetch('https://open-api.tiktok.com/user/info/', {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
        },
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async refreshTokens(connectionId: string): Promise<void> {
    // TikTok token refresh implementation would go here
    return;
  }

  async createPost(connectionId: string, params: PostCreationParams): Promise<SocialMediaPost> {
    if (!params.media || params.media.length === 0) {
      throw new SocialMediaError(
        'TikTok requires video content',
        'TIKTOK_NO_VIDEO',
        SocialMediaProvider.TIKTOK
      );
    }

    const videoFile = params.media[0]; // Use first media file as video
    const title = params.content.substring(0, 150); // TikTok title limit
    const description = params.content;

    return this.uploadVideo(connectionId, {
      videoFile,
      title,
      description,
      hashtags: params.hashtags,
      privacy: 'public',
      allowComments: true,
      allowDuet: true,
      allowStitch: true
    });
  }

  async schedulePost(connectionId: string, params: PostScheduleParams): Promise<ScheduledPost> {
    // TikTok scheduling implementation
    throw new SocialMediaError(
      'TikTok scheduling not yet implemented',
      'TIKTOK_SCHEDULING_NOT_IMPLEMENTED',
      SocialMediaProvider.TIKTOK
    );
  }

  async getPost(connectionId: string, postId: string): Promise<SocialMediaPost> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new SocialMediaError(
          'Connection not found',
          'CONNECTION_NOT_FOUND',
          SocialMediaProvider.TIKTOK
        );
      }

      // Mock implementation for now
      return {
        id: postId,
        platform: SocialMediaProvider.TIKTOK,
        platformPostId: postId,
        content: 'TikTok video content',
        url: `https://www.tiktok.com/@user/video/${postId}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        metrics: {
          likes: 0,
          shares: 0,
          comments: 0,
          views: 0,
          clicks: 0,
          reach: 0,
          impressions: 0,
          engagementRate: 0
        }
      };
    } catch (error) {
      throw new SocialMediaError(
        'Failed to get TikTok post',
        'TIKTOK_GET_POST_FAILED',
        SocialMediaProvider.TIKTOK,
        error as Error
      );
    }
  }

  async getPosts(connectionId: string, params: { limit?: number; since?: Date; until?: Date }): Promise<SocialMediaPost[]> {
    // Mock implementation
    return [];
  }

  async editPost(connectionId: string, postId: string, content: string): Promise<SocialMediaPost> {
    throw new SocialMediaError(
      'TikTok does not support editing videos',
      'TIKTOK_EDIT_NOT_SUPPORTED',
      SocialMediaProvider.TIKTOK
    );
  }

  async deletePost(connectionId: string, postId: string): Promise<void> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new SocialMediaError(
          'Connection not found',
          'CONNECTION_NOT_FOUND',
          SocialMediaProvider.TIKTOK
        );
      }

      // TikTok delete implementation would go here
      console.log(`Would delete TikTok video: ${postId}`);
    } catch (error) {
      throw new SocialMediaError(
        'Failed to delete TikTok post',
        'TIKTOK_DELETE_FAILED',
        SocialMediaProvider.TIKTOK,
        error as Error
      );
    }
  }

  async cancelScheduledPost(connectionId: string, scheduledPostId: string): Promise<void> {
    throw new SocialMediaError(
      'TikTok scheduling not implemented',
      'TIKTOK_SCHEDULING_NOT_IMPLEMENTED',
      SocialMediaProvider.TIKTOK
    );
  }

  async analyzeContent(content: string): Promise<ContentAnalysis> {
    const hashtags = content.match(/#\w+/g) || [];
    
    return {
      sentiment: 'neutral',
      topics: [],
      hashtags: hashtags.map(h => h.substring(1)),
      mentions: [],
      readabilityScore: 0.8,
      engagementPrediction: 0.7,
      suggestedImprovements: ['Consider adding trending hashtags', 'Optimize for TikTok audience']
    };
  }

  async optimizeContent(content: string): Promise<OptimizedContent> {
    return {
      originalContent: content,
      optimizedContent: content,
      platform: SocialMediaProvider.TIKTOK,
      improvements: ['Optimized for TikTok'],
      estimatedEngagement: 0.8
    };
  }

  async getPostMetrics(connectionId: string, postId: string): Promise<PostMetrics> {
    const post = await this.getPost(connectionId, postId);
    return post.metrics || {
      views: 0,
      likes: 0,
      shares: 0,
      comments: 0,
      clicks: 0,
      engagementRate: 0,
      reach: 0,
      impressions: 0,
    };
  }

  async getComments(connectionId: string, postId: string): Promise<CommentResponse[]> {
    try {
      // Mock implementation
      return [];
    } catch (error) {
      throw new SocialMediaError(
        'Failed to get TikTok comments',
        'TIKTOK_GET_COMMENTS_FAILED',
        SocialMediaProvider.TIKTOK,
        error as Error
      );
    }
  }

  async respondToComments(connectionId: string, postId: string, strategy: ResponseStrategy): Promise<CommentResponse[]> {
    // Mock implementation
    return [];
  }

  getSupportedCapabilities(): SocialMediaCapability[] {
    return [
      SocialMediaCapability.POST_CREATE,
      SocialMediaCapability.POST_READ,
      SocialMediaCapability.POST_DELETE,
      SocialMediaCapability.VIDEO_UPLOAD,
      SocialMediaCapability.COMMENT_READ,
      SocialMediaCapability.ANALYTICS_READ,
      SocialMediaCapability.TIKTOK_VIDEO_CREATE,
      SocialMediaCapability.TIKTOK_LIVE_CREATE,
      SocialMediaCapability.TIKTOK_ANALYTICS_READ,
    ];
  }

  async getRateLimitStatus(connectionId: string): Promise<{ remaining: number; resetTime: Date; limit: number; }> {
    return {
      remaining: 50,
      resetTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      limit: 100
    };
  }

  // TikTok specific methods
  async uploadVideo(connectionId: string, params: TikTokVideoUpload): Promise<SocialMediaPost> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new SocialMediaError(
          'Connection not found',
          'CONNECTION_NOT_FOUND',
          SocialMediaProvider.TIKTOK
        );
      }

      // Mock video upload for now
      const videoId = `tiktok_${Date.now()}`;
      
      return {
        id: videoId,
        platform: SocialMediaProvider.TIKTOK,
        platformPostId: videoId,
        content: params.description || params.title,
        url: `https://www.tiktok.com/@user/video/${videoId}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        metrics: {
          likes: 0,
          shares: 0,
          comments: 0,
          views: 0,
          clicks: 0,
          reach: 0,
          impressions: 0,
          engagementRate: 0
        }
      };
    } catch (error) {
      throw new SocialMediaError(
        'Failed to upload TikTok video',
        'TIKTOK_UPLOAD_FAILED',
        SocialMediaProvider.TIKTOK,
        error as Error
      );
    }
  }

  async getVideoAnalytics(connectionId: string, videoId: string): Promise<TikTokVideoAnalytics> {
    try {
      // Mock analytics for now
      return {
        postId: videoId,
        impressions: 1000,
        reach: 800,
        likes: 50,
        shares: 10,
        comments: 5,
        clicks: 0,
        engagementRate: 6.5,
        playTime: 15.5,
        completionRate: 0.75,
        trafficSources: {
          'For You': 70,
          'Following': 20,
          'Profile': 10
        }
      };
    } catch (error) {
      throw new SocialMediaError(
        'Failed to get TikTok video analytics',
        'TIKTOK_ANALYTICS_FAILED',
        SocialMediaProvider.TIKTOK,
        error as Error
      );
    }
  }

  // Required interface methods
  async connect(connectionParams: any): Promise<SocialMediaConnection> {
    throw new SocialMediaError(
      'TikTok OAuth connection not implemented - use external OAuth flow',
      'TIKTOK_OAUTH_NOT_IMPLEMENTED',
      SocialMediaProvider.TIKTOK
    );
  }

  async disconnect(connectionId: string): Promise<void> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new SocialMediaError(
          'Connection not found',
          'CONNECTION_NOT_FOUND',
          SocialMediaProvider.TIKTOK
        );
      }

      // Revoke TikTok access token
      const credentials = JSON.parse(connection.encryptedCredentials);
      await fetch('https://open-api.tiktok.com/oauth/revoke/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_key: process.env.TIKTOK_CLIENT_KEY || '',
          client_secret: process.env.TIKTOK_CLIENT_SECRET || '',
          token: credentials.accessToken
        })
      });

      this.connections.delete(connectionId);
    } catch (error) {
      throw new SocialMediaError(
        'Failed to disconnect TikTok account',
        'TIKTOK_DISCONNECT_FAILED',
        SocialMediaProvider.TIKTOK,
        error as Error
      );
    }
  }

  async refreshConnection(connectionId: string): Promise<SocialMediaConnection> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new SocialMediaError(
        'Connection not found',
        'CONNECTION_NOT_FOUND',
        SocialMediaProvider.TIKTOK
      );
    }

    try {
      const credentials = JSON.parse(connection.encryptedCredentials);
      
      // Refresh TikTok access token
      const response = await fetch('https://open-api.tiktok.com/oauth/refresh_token/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_key: process.env.TIKTOK_CLIENT_KEY || '',
          client_secret: process.env.TIKTOK_CLIENT_SECRET || '',
          grant_type: 'refresh_token',
          refresh_token: credentials.refreshToken
        })
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const tokenData = await response.json();
      
      // Update connection with new tokens
      const updatedCredentials = {
        ...credentials,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + (tokenData.expires_in * 1000)
      };

      const updatedConnection = {
        ...connection,
        encryptedCredentials: JSON.stringify(updatedCredentials),
        updatedAt: new Date()
      };

      this.connections.set(connectionId, updatedConnection);
      return updatedConnection;
    } catch (error) {
      throw new SocialMediaError(
        'Failed to refresh TikTok connection',
        'TIKTOK_REFRESH_FAILED',
        SocialMediaProvider.TIKTOK,
        error as Error
      );
    }
  }

  async getScheduledPosts(connectionId: string): Promise<ScheduledPost[]> {
    // TikTok doesn't have native scheduling API
    return [];
  }

  async getDrafts(connectionId: string): Promise<any[]> {
    // TikTok doesn't have native draft API
    return [];
  }

  async getDraft(connectionId: string, draftId: string): Promise<any> {
    throw new SocialMediaError(
      'TikTok does not support native drafts',
      'TIKTOK_DRAFTS_NOT_SUPPORTED',
      SocialMediaProvider.TIKTOK
    );
  }

  async publishDraft(connectionId: string, params: any): Promise<SocialMediaPost> {
    throw new SocialMediaError(
      'TikTok does not support native drafts',
      'TIKTOK_DRAFTS_NOT_SUPPORTED',
      SocialMediaProvider.TIKTOK
    );
  }

  async scheduleDraft(connectionId: string, params: any): Promise<ScheduledPost> {
    throw new SocialMediaError(
      'TikTok does not support native drafts or scheduling',
      'TIKTOK_DRAFTS_NOT_SUPPORTED',
      SocialMediaProvider.TIKTOK
    );
  }

  async getAccountAnalytics(connectionId: string, timeframe: string): Promise<any> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new SocialMediaError(
          'Connection not found',
          'CONNECTION_NOT_FOUND',
          SocialMediaProvider.TIKTOK
        );
      }

      const credentials = JSON.parse(connection.encryptedCredentials);
      
      // Get account analytics from TikTok Business API
      const response = await fetch(`https://business-api.tiktok.com/open_api/v1.3/business/get/`, {
        headers: {
          'Access-Token': credentials.accessToken,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();
      
      return {
        followerCount: data.data?.business_info?.follower_count || 0,
        followingCount: data.data?.business_info?.following_count || 0,
        likesCount: data.data?.business_info?.likes_count || 0,
        videoCount: data.data?.business_info?.video_count || 0,
        profileViews: 0, // Not available in basic API
        engagement: {
          totalLikes: data.data?.business_info?.likes_count || 0,
          totalComments: 0, // Requires aggregation
          totalShares: 0, // Requires aggregation
          engagementRate: 0.05 // Estimated
        },
        timeframe
      };
    } catch (error) {
      throw new SocialMediaError(
        'Failed to get TikTok account analytics',
        'TIKTOK_ANALYTICS_FAILED',
        SocialMediaProvider.TIKTOK,
        error as Error
      );
    }
  }

  async replyToComment(connectionId: string, commentId: string, content: string): Promise<any> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new SocialMediaError(
          'Connection not found',
          'CONNECTION_NOT_FOUND',
          SocialMediaProvider.TIKTOK
        );
      }

      const credentials = JSON.parse(connection.encryptedCredentials);
      
      // Reply to comment using TikTok API
      const response = await fetch('https://open-api.tiktok.com/comment/reply/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${credentials.accessToken}`,
        },
        body: JSON.stringify({
          comment_id: commentId,
          text: content
        })
      });

      if (!response.ok) {
        throw new Error('Failed to reply to comment');
      }

      const data = await response.json();
      
      return {
        id: data.data.comment_id,
        content: content,
        author: 'current_user',
        createdAt: new Date(),
        likes: 0,
        replies: 0
      };
    } catch (error) {
      throw new SocialMediaError(
        'Failed to reply to TikTok comment',
        'TIKTOK_COMMENT_REPLY_FAILED',
        SocialMediaProvider.TIKTOK,
        error as Error
      );
    }
  }

  async likePost(connectionId: string, postId: string): Promise<void> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new SocialMediaError(
          'Connection not found',
          'CONNECTION_NOT_FOUND',
          SocialMediaProvider.TIKTOK
        );
      }

      const credentials = JSON.parse(connection.encryptedCredentials);
      
      // Like post using TikTok API
      const response = await fetch('https://open-api.tiktok.com/video/like/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${credentials.accessToken}`,
        },
        body: JSON.stringify({
          video_id: postId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to like post');
      }
    } catch (error) {
      throw new SocialMediaError(
        'Failed to like TikTok post',
        'TIKTOK_LIKE_FAILED',
        SocialMediaProvider.TIKTOK,
        error as Error
      );
    }
  }

  async sharePost(connectionId: string, postId: string): Promise<void> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new SocialMediaError(
          'Connection not found',
          'CONNECTION_NOT_FOUND',
          SocialMediaProvider.TIKTOK
        );
      }

      const credentials = JSON.parse(connection.encryptedCredentials);
      
      // Share post using TikTok API
      const response = await fetch('https://open-api.tiktok.com/video/share/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${credentials.accessToken}`,
        },
        body: JSON.stringify({
          video_id: postId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to share post');
      }
    } catch (error) {
      throw new SocialMediaError(
        'Failed to share TikTok post',
        'TIKTOK_SHARE_FAILED',
        SocialMediaProvider.TIKTOK,
        error as Error
      );
    }
  }

  handleError(error: Error): SocialMediaError {
    return new SocialMediaError(
      error.message,
      'TIKTOK_ERROR',
      SocialMediaProvider.TIKTOK,
      error
    );
  }

  private calculateEngagementRate(stats: any): number {
    if (!stats || !stats.view_count) return 0;
    
    const totalEngagements = (stats.like_count || 0) + (stats.share_count || 0) + (stats.comment_count || 0);
    return (totalEngagements / stats.view_count) * 100;
  }
} 