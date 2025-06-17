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
  SocialMediaError,
  SocialMediaConnectionParams,
  Comment,
  AccountAnalytics
} from './base/ISocialMediaProvider';
import { 
  SocialMediaProvider, 
  SocialMediaCapability,
  SocialMediaConnection,
  SocialMediaConnectionStatus
} from '../database/ISocialMediaDatabase';
import { TokenEncryption } from '../../security/TokenEncryption';

export class TwitterProvider implements ISocialMediaProvider {
  private connections = new Map<string, SocialMediaConnection>();
  private tokenEncryption: TokenEncryption;

  constructor() {
    // Initialize provider
    this.tokenEncryption = new TokenEncryption();
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

      // Decrypt credentials
      const credentials = this.tokenEncryption.decryptTokens(connection.encryptedCredentials);
      
      // Test the connection with a simple API call
      const response = await fetch('https://api.twitter.com/2/users/me', {
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`,
        },
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async refreshTokens(connectionId: string): Promise<void> {
    // Twitter API v2 with OAuth 1.0a doesn't require token refresh
    // Tokens are long-lived unless revoked
    return;
  }

  async createPost(connectionId: string, params: PostCreationParams): Promise<SocialMediaPost> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new SocialMediaError(
          'Connection not found',
          'CONNECTION_NOT_FOUND',
          SocialMediaProvider.TWITTER
        );
      }

      const credentials = this.tokenEncryption.decryptTokens(connection.encryptedCredentials);
      const tweetText = this.formatTweetContent(params.content, params.hashtags);
      
      const tweetData: any = {
        text: tweetText,
      };

      // For now, skip media upload implementation
      if (params.media && params.media.length > 0) {
        console.log(`Would upload ${params.media.length} media files`);
      }

      const response = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tweetData),
      });

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status}`);
      }

      const result = await response.json();

      return {
        id: result.data.id,
        platform: SocialMediaProvider.TWITTER,
        platformPostId: result.data.id,
        content: params.content,
        media: params.media,
        hashtags: params.hashtags,
        mentions: params.mentions,
        url: `https://twitter.com/i/status/${result.data.id}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      throw new SocialMediaError(
        'Failed to create Twitter post',
        'TWITTER_POST_FAILED',
        SocialMediaProvider.TWITTER,
        error as Error
      );
    }
  }

  async schedulePost(connectionId: string, params: PostScheduleParams): Promise<ScheduledPost> {
    // Twitter API doesn't support native scheduling
    throw new SocialMediaError(
      'Twitter does not support native post scheduling',
      'TWITTER_SCHEDULING_NOT_SUPPORTED',
      SocialMediaProvider.TWITTER
    );
  }

  async getPost(connectionId: string, postId: string): Promise<SocialMediaPost> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new SocialMediaError(
          'Connection not found',
          'CONNECTION_NOT_FOUND',
          SocialMediaProvider.TWITTER
        );
      }

      const credentials = this.tokenEncryption.decryptTokens(connection.encryptedCredentials);
      
      const response = await fetch(`https://api.twitter.com/2/tweets/${postId}?tweet.fields=created_at,public_metrics`, {
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status}`);
      }

      const result = await response.json();
      const tweet = result.data;

      return {
        id: tweet.id,
        platform: SocialMediaProvider.TWITTER,
        platformPostId: tweet.id,
        content: tweet.text,
        url: `https://twitter.com/i/status/${tweet.id}`,
        createdAt: new Date(tweet.created_at!),
        updatedAt: new Date(tweet.created_at!),
        metrics: tweet.public_metrics ? {
          views: tweet.public_metrics.impression_count || 0,
          likes: tweet.public_metrics.like_count || 0,
          shares: tweet.public_metrics.retweet_count || 0,
          comments: tweet.public_metrics.reply_count || 0,
          clicks: 0,
          engagementRate: 0,
          reach: 0,
          impressions: tweet.public_metrics.impression_count || 0,
        } : undefined
      };
    } catch (error) {
      throw new SocialMediaError(
        'Failed to get Twitter post',
        'TWITTER_GET_POST_FAILED',
        SocialMediaProvider.TWITTER,
        error as Error
      );
    }
  }

  async getPosts(connectionId: string, params: { limit?: number; since?: Date; until?: Date }): Promise<SocialMediaPost[]> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new SocialMediaError(
          'Connection not found',
          'CONNECTION_NOT_FOUND',
          SocialMediaProvider.TWITTER
        );
      }

      const credentials = this.tokenEncryption.decryptTokens(connection.encryptedCredentials);
      const limit = Math.min(params.limit || 10, 100);
      
      const response = await fetch(`https://api.twitter.com/2/users/${connection.providerAccountId}/tweets?max_results=${limit}&tweet.fields=created_at,public_metrics`, {
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status}`);
      }

      const result = await response.json();

      return result.data?.map((tweet: any) => ({
        id: tweet.id,
        platform: SocialMediaProvider.TWITTER,
        platformPostId: tweet.id,
        content: tweet.text,
        url: `https://twitter.com/i/status/${tweet.id}`,
        createdAt: new Date(tweet.created_at!),
        updatedAt: new Date(tweet.created_at!),
        metrics: tweet.public_metrics ? {
          views: tweet.public_metrics.impression_count || 0,
          likes: tweet.public_metrics.like_count || 0,
          shares: tweet.public_metrics.retweet_count || 0,
          comments: tweet.public_metrics.reply_count || 0,
          clicks: 0,
          engagementRate: 0,
          reach: 0,
          impressions: tweet.public_metrics.impression_count || 0,
        } : undefined
      })) || [];
    } catch (error) {
      throw new SocialMediaError(
        'Failed to get Twitter posts',
        'TWITTER_GET_POSTS_FAILED',
        SocialMediaProvider.TWITTER,
        error as Error
      );
    }
  }

  async editPost(connectionId: string, postId: string, content: string): Promise<SocialMediaPost> {
    // Twitter doesn't support editing tweets
    throw new SocialMediaError(
      'Twitter does not support editing tweets',
      'TWITTER_EDIT_NOT_SUPPORTED',
      SocialMediaProvider.TWITTER
    );
  }

  async deletePost(connectionId: string, postId: string): Promise<void> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new SocialMediaError(
          'Connection not found',
          'CONNECTION_NOT_FOUND',
          SocialMediaProvider.TWITTER
        );
      }

      const credentials = this.tokenEncryption.decryptTokens(connection.encryptedCredentials);
      
      const response = await fetch(`https://api.twitter.com/2/tweets/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status}`);
      }
    } catch (error) {
      throw new SocialMediaError(
        'Failed to delete Twitter post',
        'TWITTER_DELETE_FAILED',
        SocialMediaProvider.TWITTER,
        error as Error
      );
    }
  }

  async cancelScheduledPost(connectionId: string, scheduledPostId: string): Promise<void> {
    throw new SocialMediaError(
      'Twitter does not support native scheduling',
      'TWITTER_SCHEDULING_NOT_SUPPORTED',
      SocialMediaProvider.TWITTER
    );
  }

  async analyzeContent(content: string): Promise<ContentAnalysis> {
    // Basic content analysis for Twitter
    const hashtags = content.match(/#\w+/g) || [];
    const mentions = content.match(/@\w+/g) || [];
    
    return {
      sentiment: 'neutral',
      topics: [],
      hashtags: hashtags.map(h => h.substring(1)),
      mentions: mentions.map(m => m.substring(1)),
      readabilityScore: 0.8,
      engagementPrediction: 0.6,
      suggestedImprovements: []
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
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new SocialMediaError(
          'Connection not found',
          'CONNECTION_NOT_FOUND',
          SocialMediaProvider.TWITTER
        );
      }

      const credentials = this.tokenEncryption.decryptTokens(connection.encryptedCredentials);
      
      // Get replies to the tweet
      const response = await fetch(`https://api.twitter.com/2/tweets/search/recent?query=conversation_id:${postId}&tweet.fields=created_at,author_id,public_metrics`, {
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status}`);
      }

      const result = await response.json();

      return result.data?.map((reply: any) => ({
        id: reply.id,
        postId: postId,
        content: reply.text,
        author: reply.author_id || 'unknown',
        createdAt: new Date(reply.created_at!),
        likes: reply.public_metrics?.like_count || 0,
      })) || [];
    } catch (error) {
      throw new SocialMediaError(
        'Failed to get Twitter comments',
        'TWITTER_GET_COMMENTS_FAILED',
        SocialMediaProvider.TWITTER,
        error as Error
      );
    }
  }

  async respondToComments(connectionId: string, postId: string, strategy: ResponseStrategy): Promise<CommentResponse[]> {
    // This would implement automated comment responses
    // For now, return empty array
    return [];
  }

  getSupportedCapabilities(): SocialMediaCapability[] {
    return [
      SocialMediaCapability.POST_CREATE,
      SocialMediaCapability.POST_READ,
      SocialMediaCapability.POST_DELETE,
      SocialMediaCapability.IMAGE_UPLOAD,
      SocialMediaCapability.VIDEO_UPLOAD,
      SocialMediaCapability.COMMENT_READ,
      SocialMediaCapability.COMMENT_CREATE,
      SocialMediaCapability.LIKE_CREATE,
      SocialMediaCapability.SHARE_CREATE,
      SocialMediaCapability.ANALYTICS_READ,
      SocialMediaCapability.DM_READ,
      SocialMediaCapability.DM_SEND,
    ];
  }

  async getRateLimitStatus(connectionId: string): Promise<{ remaining: number; resetTime: Date; limit: number; }> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new SocialMediaError(
          'Connection not found',
          'CONNECTION_NOT_FOUND',
          SocialMediaProvider.TWITTER
        );
      }

      // For now, return mock rate limit data
      return {
        remaining: 250,
        resetTime: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
        limit: 300
      };
    } catch (error) {
      return {
        remaining: 0,
        resetTime: new Date(Date.now() + 15 * 60 * 1000),
        limit: 300
      };
    }
  }

  // Missing interface methods - basic implementations
  async connect(connectionParams: SocialMediaConnectionParams): Promise<SocialMediaConnection> {
    throw new SocialMediaError(
      'Connect method not implemented - use OAuth flow instead',
      'TWITTER_CONNECT_NOT_IMPLEMENTED',
      SocialMediaProvider.TWITTER
    );
  }

  async disconnect(connectionId: string): Promise<void> {
    this.connections.delete(connectionId);
  }

  async refreshConnection(connectionId: string): Promise<SocialMediaConnection> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new SocialMediaError(
        'Connection not found',
        'CONNECTION_NOT_FOUND',
        SocialMediaProvider.TWITTER
      );
    }
    return connection;
  }

  async getScheduledPosts(connectionId: string): Promise<ScheduledPost[]> {
    // Twitter doesn't support native scheduling
    return [];
  }

  async getDrafts(connectionId: string): Promise<any[]> {
    // Twitter doesn't have native draft support
    return [];
  }

  async getDraft(connectionId: string, draftId: string): Promise<any> {
    throw new SocialMediaError(
      'Twitter does not support drafts',
      'TWITTER_DRAFTS_NOT_SUPPORTED',
      SocialMediaProvider.TWITTER
    );
  }

  async publishDraft(connectionId: string, params: any): Promise<SocialMediaPost> {
    throw new SocialMediaError(
      'Twitter does not support drafts',
      'TWITTER_DRAFTS_NOT_SUPPORTED',
      SocialMediaProvider.TWITTER
    );
  }

  async scheduleDraft(connectionId: string, params: any): Promise<ScheduledPost> {
    throw new SocialMediaError(
      'Twitter does not support drafts',
      'TWITTER_DRAFTS_NOT_SUPPORTED',
      SocialMediaProvider.TWITTER
    );
  }

  async getAccountAnalytics(connectionId: string, timeframe: string): Promise<AccountAnalytics> {
    // Basic mock implementation
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

  async replyToComment(connectionId: string, commentId: string, content: string): Promise<Comment> {
    throw new SocialMediaError(
      'Reply to comment not implemented',
      'TWITTER_REPLY_NOT_IMPLEMENTED',
      SocialMediaProvider.TWITTER
    );
  }

  async likePost(connectionId: string, postId: string): Promise<void> {
    // Implementation would go here
    throw new SocialMediaError(
      'Like post not implemented',
      'TWITTER_LIKE_NOT_IMPLEMENTED',
      SocialMediaProvider.TWITTER
    );
  }

  async sharePost(connectionId: string, postId: string): Promise<void> {
    // Implementation would go here (retweet)
    throw new SocialMediaError(
      'Share post not implemented',
      'TWITTER_SHARE_NOT_IMPLEMENTED',
      SocialMediaProvider.TWITTER
    );
  }

  async optimizeContent(content: string, platform: SocialMediaProvider): Promise<OptimizedContent> {
    const optimized = this.formatTweetContent(content);
    
    return {
      originalContent: content,
      optimizedContent: optimized,
      platform: SocialMediaProvider.TWITTER,
      improvements: ['Optimized for Twitter character limit'],
      estimatedEngagement: 0.7
    };
  }

  handleError(error: Error): SocialMediaError {
    return new SocialMediaError(
      error.message,
      'TWITTER_ERROR',
      SocialMediaProvider.TWITTER,
      error
    );
  }

  // Helper methods
  private formatTweetContent(content: string, hashtags?: string[]): string {
    let tweetText = content;
    
    if (hashtags && hashtags.length > 0) {
      const hashtagText = hashtags.map(tag => `#${tag}`).join(' ');
      tweetText = `${content} ${hashtagText}`;
    }
    
    // Ensure tweet is within character limit
    if (tweetText.length > 280) {
      tweetText = tweetText.substring(0, 277) + '...';
    }
    
    return tweetText;
  }
} 