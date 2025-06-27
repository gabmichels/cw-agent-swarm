import {
  SocialMediaCapability,
  SocialMediaConnection,
  SocialMediaProvider
} from '../database/ISocialMediaDatabase';
import {
  AccountAnalytics,
  Comment,
  CommentResponse,
  ContentAnalysis,
  ISocialMediaProvider,
  OptimizedContent,
  PostCreationParams,
  PostMetrics,
  PostScheduleParams,
  ResponseStrategy,
  ScheduledPost,
  SocialMediaConnectionParams,
  SocialMediaError,
  SocialMediaPost
} from './base/ISocialMediaProvider';

// Unified systems imports
import { getServiceConfig } from '../../../lib/core/unified-config';
import {
  createErrorContext,
  ErrorSeverity,
  handleAsync,
  handleWithRetry
} from '../../../lib/errors/standardized-handler';
import { logger } from '../../../lib/logging';
import {
  decryptTokens
} from '../../../lib/security/unified-token-manager';

export class TwitterProvider implements ISocialMediaProvider {
  private connections = new Map<string, SocialMediaConnection>();
  private clientId: string;
  private clientSecret: string;

  constructor() {
    // Get configuration from unified config system
    const socialConfig = getServiceConfig('socialMedia');
    const twitterConfig = socialConfig.providers.twitter;

    if (!twitterConfig) {
      throw new Error('Twitter configuration not found. Please set TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET environment variables.');
    }

    this.clientId = twitterConfig.clientId || '';
    this.clientSecret = twitterConfig.clientSecret || '';

    logger.info('Twitter Provider initialized with unified systems', {
      provider: 'twitter',
      hasClientId: !!this.clientId,
      hasClientSecret: !!this.clientSecret,
      unifiedSystems: true
    });
  }

  addConnection(connection: SocialMediaConnection): void {
    this.connections.set(connection.id, connection);
    logger.info('Twitter connection added', {
      connectionId: connection.id,
      accountId: connection.providerAccountId,
      status: connection.connectionStatus
    });
  }

  async validateConnection(connectionId: string): Promise<boolean> {
    const context = createErrorContext('TwitterProvider', 'validateConnection', {
      severity: ErrorSeverity.LOW,
      retryable: true,
      metadata: { connectionId }
    });

    const result = await handleAsync(async () => {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      // Decrypt credentials using unified token manager
      const credentials = await decryptTokens(connection.encryptedCredentials);

      // Test the connection with a simple API call
      const response = await fetch('https://api.twitter.com/2/users/me', {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
        },
      });

      const isValid = response.ok;

      logger.info('Twitter connection validation completed', {
        connectionId,
        isValid,
        status: response.status
      });

      return isValid;
    }, context);

    return result.success && result.data === true;
  }

  async refreshTokens(connectionId: string): Promise<void> {
    logger.info('Twitter token refresh requested', {
      connectionId,
      note: 'Twitter API v2 with OAuth 1.0a uses long-lived tokens'
    });
    // Twitter API v2 with OAuth 1.0a doesn't require token refresh
    // Tokens are long-lived unless revoked
    return;
  }

  async createPost(connectionId: string, params: PostCreationParams): Promise<SocialMediaPost> {
    const context = createErrorContext('TwitterProvider', 'createPost', {
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      metadata: { connectionId }
    });

    const result = await handleWithRetry(async () => {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new SocialMediaError(
          'Connection not found',
          'CONNECTION_NOT_FOUND',
          SocialMediaProvider.TWITTER
        );
      }

      const credentials = await decryptTokens(connection.encryptedCredentials);
      const tweetText = this.formatTweetContent(params.content, params.hashtags);

      const tweetData: any = {
        text: tweetText,
      };

      // Log media upload if present (not implemented in this simplified version)
      if (params.media && params.media.length > 0) {
        logger.info('Twitter post media upload requested', {
          connectionId,
          mediaCount: params.media.length,
          note: 'Media upload implementation needed'
        });
      }

      const response = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tweetData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Twitter API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      const post: SocialMediaPost = {
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

      logger.info('Twitter post created successfully', {
        connectionId,
        postId: post.id,
        platform: post.platform,
        contentLength: params.content.length
      });

      return post;
    }, context);

    if (!result.success) {
      throw new SocialMediaError(
        'Failed to create Twitter post',
        'TWITTER_POST_FAILED',
        SocialMediaProvider.TWITTER,
        result.error
      );
    }

    return result.data!;
  }

  async schedulePost(connectionId: string, params: PostScheduleParams): Promise<ScheduledPost> {
    // Twitter API doesn't support native scheduling
    logger.warn('Twitter post scheduling not supported natively', {
      connectionId,
      scheduledTime: params.scheduledTime
    });

    throw new SocialMediaError(
      'Twitter does not support native post scheduling',
      'TWITTER_SCHEDULING_NOT_SUPPORTED',
      SocialMediaProvider.TWITTER
    );
  }

  async getPost(connectionId: string, postId: string): Promise<SocialMediaPost> {
    const context = createErrorContext('TwitterProvider', 'getPost', {
      severity: ErrorSeverity.LOW,
      retryable: true,
      metadata: { connectionId, postId }
    });

    const result = await handleAsync(async () => {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new SocialMediaError(
          'Connection not found',
          'CONNECTION_NOT_FOUND',
          SocialMediaProvider.TWITTER
        );
      }

      const credentials = await decryptTokens(connection.encryptedCredentials);

      const response = await fetch(`https://api.twitter.com/2/tweets/${postId}?tweet.fields=created_at,public_metrics`, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Twitter API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const tweet = result.data;

      const post: SocialMediaPost = {
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

      logger.info('Twitter post retrieved successfully', {
        connectionId,
        postId,
        hasMetrics: !!post.metrics
      });

      return post;
    }, context);

    if (!result.success) {
      throw new SocialMediaError(
        'Failed to get Twitter post',
        'TWITTER_GET_POST_FAILED',
        SocialMediaProvider.TWITTER,
        result.error
      );
    }

    return result.data!;
  }

  async getPosts(connectionId: string, params: { limit?: number; since?: Date; until?: Date }): Promise<SocialMediaPost[]> {
    const context = createErrorContext('TwitterProvider', 'getPosts', {
      severity: ErrorSeverity.LOW,
      retryable: true,
      metadata: { connectionId, params }
    });

    const result = await handleAsync(async () => {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new SocialMediaError(
          'Connection not found',
          'CONNECTION_NOT_FOUND',
          SocialMediaProvider.TWITTER
        );
      }

      const credentials = await decryptTokens(connection.encryptedCredentials);
      const limit = Math.min(params.limit || 10, 100);

      const response = await fetch(`https://api.twitter.com/2/users/${connection.providerAccountId}/tweets?max_results=${limit}&tweet.fields=created_at,public_metrics`, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Twitter API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      const posts = result.data?.map((tweet: any): SocialMediaPost => ({
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

      logger.info('Twitter posts retrieved successfully', {
        connectionId,
        count: posts.length,
        limit,
      });

      return posts;
    }, context);

    if (!result.success) {
      throw new SocialMediaError(
        'Failed to get Twitter posts',
        'TWITTER_GET_POSTS_FAILED',
        SocialMediaProvider.TWITTER,
        result.error
      );
    }

    return result.data!;
  }

  async editPost(connectionId: string, postId: string, content: string): Promise<SocialMediaPost> {
    logger.warn('Twitter post editing not supported', {
      connectionId,
      postId,
      note: 'Twitter API does not support tweet editing for all account types'
    });

    throw new SocialMediaError(
      'Twitter does not support post editing',
      'TWITTER_EDITING_NOT_SUPPORTED',
      SocialMediaProvider.TWITTER
    );
  }

  async deletePost(connectionId: string, postId: string): Promise<void> {
    const context = createErrorContext('TwitterProvider', 'deletePost', {
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      metadata: { connectionId, postId }
    });

    await handleAsync(async () => {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new SocialMediaError(
          'Connection not found',
          'CONNECTION_NOT_FOUND',
          SocialMediaProvider.TWITTER
        );
      }

      const credentials = await decryptTokens(connection.encryptedCredentials);

      const response = await fetch(`https://api.twitter.com/2/tweets/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Twitter API error: ${response.status} - ${errorText}`);
      }

      logger.info('Twitter post deleted successfully', {
        connectionId,
        postId
      });
    }, context);
  }

  // Simplified implementation of remaining methods with structured error handling
  async cancelScheduledPost(connectionId: string, scheduledPostId: string): Promise<void> {
    throw new SocialMediaError(
      'Twitter does not support native post scheduling',
      'TWITTER_SCHEDULING_NOT_SUPPORTED',
      SocialMediaProvider.TWITTER
    );
  }

  async analyzeContent(content: string): Promise<ContentAnalysis> {
    return {
      sentiment: 'neutral',
      topics: [],
      hashtags: content.match(/#\w+/g) || [],
      mentions: content.match(/@\w+/g) || [],
      readabilityScore: 0.5,
      engagementPrediction: 0.5,
      suggestedImprovements: [],
      suggestedHashtags: []
    };
  }

  getSupportedCapabilities(): SocialMediaCapability[] {
    return [
      SocialMediaCapability.POST_CREATE,
      SocialMediaCapability.POST_READ,
      SocialMediaCapability.POST_DELETE,
      SocialMediaCapability.ANALYTICS_READ,
      SocialMediaCapability.METRICS_READ
    ];
  }

  // Default implementations for interface completeness
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
    return []; // Twitter comments (replies) handling would require additional API calls
  }

  async respondToComments(connectionId: string, postId: string, strategy: ResponseStrategy): Promise<CommentResponse[]> {
    return [];
  }

  async getRateLimitStatus(connectionId: string): Promise<{ remaining: number; resetTime: Date; limit: number; }> {
    return { remaining: 1000, resetTime: new Date(Date.now() + 15 * 60 * 1000), limit: 1000 };
  }

  async connect(connectionParams: SocialMediaConnectionParams): Promise<SocialMediaConnection> {
    throw new Error('Use OAuth flow for Twitter connections');
  }

  async disconnect(connectionId: string): Promise<void> {
    this.connections.delete(connectionId);
    logger.info('Twitter connection disconnected', { connectionId });
  }

  async refreshConnection(connectionId: string): Promise<SocialMediaConnection> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error('Connection not found');
    }
    return connection;
  }

  async getScheduledPosts(connectionId: string): Promise<ScheduledPost[]> {
    return [];
  }

  async getDrafts(connectionId: string): Promise<any[]> {
    return [];
  }

  async getDraft(connectionId: string, draftId: string): Promise<any> {
    throw new Error('Draft not found');
  }

  async publishDraft(connectionId: string, params: any): Promise<SocialMediaPost> {
    return this.createPost(connectionId, params);
  }

  async scheduleDraft(connectionId: string, params: any): Promise<ScheduledPost> {
    return this.schedulePost(connectionId, params);
  }

  async getAccountAnalytics(connectionId: string, timeframe: string): Promise<AccountAnalytics> {
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
    throw new Error('Reply functionality requires implementation');
  }

  async likePost(connectionId: string, postId: string): Promise<void> {
    logger.info('Twitter post like action', { connectionId, postId });
  }

  async sharePost(connectionId: string, postId: string): Promise<void> {
    logger.info('Twitter post share action', { connectionId, postId });
  }

  async optimizeContent(content: string, platform: SocialMediaProvider): Promise<OptimizedContent> {
    return {
      originalContent: content,
      optimizedContent: content.substring(0, 280), // Twitter character limit
      platform,
      improvements: ['Keep under 280 characters'],
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

  private formatTweetContent(content: string, hashtags?: string[]): string {
    let tweetText = content;

    if (hashtags && hashtags.length > 0) {
      const hashtagText = hashtags.map(tag => tag.startsWith('#') ? tag : `#${tag}`).join(' ');
      tweetText = `${content} ${hashtagText}`;
    }

    // Ensure tweet is within character limit
    if (tweetText.length > 280) {
      tweetText = tweetText.substring(0, 277) + '...';
    }

    return tweetText;
  }
} 