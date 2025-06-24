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
// Unified systems imports
import { getServiceConfig } from '../../../lib/core/unified-config';
import {
  handleAsync,
  handleWithRetry,
  createErrorContext,
  ErrorSeverity
} from '../../../lib/errors/standardized-handler';
import {
  unifiedTokenManager,
  encryptTokens,
  decryptTokens,
  OAuthTokenData
} from '../../../lib/security/unified-token-manager';
import { logger } from '../../../lib/logging';

export class LinkedInProvider implements ISocialMediaProvider {
  public connections = new Map<string, SocialMediaConnection>();
  private clientId: string;
  private clientSecret: string;

  constructor() {
    // Initialize provider with unified systems

    // Get configuration from unified config system
    const socialConfig = getServiceConfig('socialMedia');
    const linkedinConfig = socialConfig.providers.linkedin;

    if (!linkedinConfig) {
      throw new Error('LinkedIn configuration not found. Please set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET environment variables.');
    }

    this.clientId = linkedinConfig.clientId!;
    this.clientSecret = linkedinConfig.clientSecret!;

    // Register token refresh callback with unified token manager
    unifiedTokenManager.registerRefreshCallback('linkedin', async (refreshToken: string, provider: string, connectionId: string) => {
      logger.info('LinkedIn token refresh triggered by unified manager', {
        provider,
        connectionId
      });

      if (!refreshToken) {
        throw new Error('No refresh token available for LinkedIn');
      }

      const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('LinkedIn unified token refresh failed', {
          status: response.status,
          error: errorText
        });
        throw new Error(`LinkedIn token refresh failed: ${response.status} - ${errorText}`);
      }

      const refreshData = await response.json();
      return {
        accessToken: refreshData.access_token,
        refreshToken: refreshData.refresh_token || refreshToken,
        expiresAt: refreshData.expires_in ? new Date(Date.now() + refreshData.expires_in * 1000) : undefined,
        scopes: [],
      };
    });

    logger.info('LinkedIn Provider initialized with unified systems', {
      provider: 'linkedin',
      hasClientId: !!this.clientId,
      hasClientSecret: !!this.clientSecret,
      unifiedSystems: true,
      tokenManagerRegistered: true
    });
  }

  addConnection(connection: SocialMediaConnection): void {
    this.connections.set(connection.id, connection);

    logger.info('LinkedIn connection added', {
      connectionId: connection.id,
      accountId: connection.providerAccountId,
      status: connection.connectionStatus
    });
  }

  async validateConnection(connectionId: string): Promise<boolean> {
    const context = createErrorContext('LinkedInProvider', 'validateConnection', {
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
      const response = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn('LinkedIn API validation failed', {
          connectionId,
          status: response.status,
          error: errorText
        });

        // Check if it's an invalid token error and we have a refresh token
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.code === 'INVALID_ACCESS_TOKEN' && credentials.refreshToken) {
            logger.info('Token invalid, attempting to refresh', { connectionId });
            await this.refreshTokens(connectionId);

            // Retry validation with refreshed token
            const updatedConnection = this.connections.get(connectionId);
            if (updatedConnection) {
              const updatedCredentials = await decryptTokens(updatedConnection.encryptedCredentials);
              const retryResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
                headers: {
                  'Authorization': `Bearer ${updatedCredentials.accessToken}`,
                },
              });

              const isValid = retryResponse.ok;
              logger.info('LinkedIn token validation after refresh', {
                connectionId,
                isValid,
                status: retryResponse.status
              });
              return isValid;
            }
          }
        } catch (refreshError) {
          logger.error('Token refresh attempt failed', {
            connectionId,
            error: refreshError
          });
        }

        return false;
      }

      logger.info('LinkedIn token validation successful', { connectionId });
      return true;
    }, context);

    return result.success && result.data === true;
  }

  async refreshTokens(connectionId: string): Promise<void> {
    const context = createErrorContext('LinkedInProvider', 'refreshTokens', {
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      metadata: { connectionId }
    });

    await handleAsync(async () => {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new SocialMediaError(
          'Connection not found',
          'CONNECTION_NOT_FOUND',
          SocialMediaProvider.LINKEDIN
        );
      }

      // Decrypt current credentials to get refresh token
      const credentials = await decryptTokens(connection.encryptedCredentials);

      if (!credentials.refreshToken) {
        throw new Error('No refresh token available for LinkedIn connection');
      }

      logger.info('Refreshing LinkedIn access token', { connectionId });

      // Make refresh token request to LinkedIn
      const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: credentials.refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('LinkedIn token refresh failed', {
          connectionId,
          status: response.status,
          error: errorText
        });
        throw new Error(`LinkedIn token refresh failed: ${response.status} - ${errorText}`);
      }

      const tokenData = await response.json();
      logger.info('LinkedIn token refreshed successfully', { connectionId });

      // Update the encrypted credentials with new tokens
      const updatedCredentials: OAuthTokenData = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || credentials.refreshToken,
        expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : undefined,
        scopes: credentials.scopes || [],
      };

      // Re-encrypt and update the connection
      const encryptedCreds = await encryptTokens(updatedCredentials);
      connection.encryptedCredentials = encryptedCreds.encryptedData;
      connection.lastValidated = new Date();

      logger.info('LinkedIn connection updated with refreshed tokens', { connectionId });
    }, context);
  }

  async createPost(connectionId: string, params: PostCreationParams): Promise<SocialMediaPost> {
    const context = createErrorContext('LinkedInProvider', 'createPost', {
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
          SocialMediaProvider.LINKEDIN
        );
      }

      const credentials = await decryptTokens(connection.encryptedCredentials);
      const postContent = this.formatLinkedInContent(params.content, params.hashtags);

      // Get user's LinkedIn ID
      logger.info('Getting LinkedIn user info for post creation', { connectionId });
      const userResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
        },
      });

      if (!userResponse.ok) {
        const errorText = await userResponse.text();
        logger.error('LinkedIn userinfo API error', {
          connectionId,
          status: userResponse.status,
          error: errorText
        });
        throw new Error(`LinkedIn API error getting user info: ${userResponse.status} - ${errorText}`);
      }

      const userInfo = await userResponse.json();
      const userId = userInfo.sub;

      const postData = {
        author: `urn:li:person:${userId}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: postContent
            },
            shareMediaCategory: 'NONE'
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
        }
      };

      const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        },
        body: JSON.stringify(postData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LinkedIn API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const postId = result.id;

      const post: SocialMediaPost = {
        id: postId,
        platform: SocialMediaProvider.LINKEDIN,
        platformPostId: postId,
        content: params.content,
        media: params.media,
        hashtags: params.hashtags,
        mentions: params.mentions,
        url: `https://www.linkedin.com/feed/update/${postId}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      logger.info('LinkedIn post created successfully', {
        connectionId,
        postId,
        platform: post.platform,
        contentLength: params.content.length
      });

      return post;
    }, context);

    if (!result.success) {
      throw new SocialMediaError(
        'Failed to create LinkedIn post',
        'LINKEDIN_POST_FAILED',
        SocialMediaProvider.LINKEDIN,
        result.error
      );
    }

    return result.data!;
  }

  // Simplified implementations of remaining methods with structured error handling
  async schedulePost(connectionIdOrTenantId: string, paramsOrAccountId: PostScheduleParams | string, params?: PostScheduleParams): Promise<ScheduledPost> {
    logger.warn('LinkedIn post scheduling not implemented', {
      connectionId: connectionIdOrTenantId
    });
    throw new SocialMediaError(
      'LinkedIn post scheduling not implemented',
      'LINKEDIN_SCHEDULING_NOT_IMPLEMENTED',
      SocialMediaProvider.LINKEDIN
    );
  }

  async getPost(connectionId: string, postId: string): Promise<SocialMediaPost> {
    return await handleAsync(async () => {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new SocialMediaError(
          'Connection not found',
          'CONNECTION_NOT_FOUND',
          SocialMediaProvider.LINKEDIN
        );
      }

      const credentials = await decryptTokens(connection.encryptedCredentials);

      const response = await fetch(`https://api.linkedin.com/v2/ugcPosts/${encodeURIComponent(postId)}`, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0'
        },
      });

      if (!response.ok) {
        throw new Error(`LinkedIn API error: ${response.status}`);
      }

      const result = await response.json();
      const post = result;

      return {
        id: post.id,
        platform: SocialMediaProvider.LINKEDIN,
        platformPostId: post.id,
        content: post.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text || '',
        url: `https://www.linkedin.com/feed/update/${post.id}`,
        createdAt: new Date(post.created?.time || Date.now()),
        updatedAt: new Date(post.lastModified?.time || Date.now()),
        metrics: {
          views: 0,
          likes: 0,
          shares: 0,
          comments: 0,
          clicks: 0,
          engagementRate: 0,
          reach: 0,
          impressions: 0,
        }
      };
    }, createErrorContext('LinkedInProvider', 'getPost', { severity: ErrorSeverity.LOW }))
      .then(result => {
        if (!result.success) {
          throw new SocialMediaError(
            'Failed to get LinkedIn post',
            'LINKEDIN_GET_POST_FAILED',
            SocialMediaProvider.LINKEDIN,
            result.error
          );
        }
        return result.data!;
      });
  }

  async getPosts(connectionId: string, params: { limit?: number; since?: Date; until?: Date }): Promise<SocialMediaPost[]> {
    const context = createErrorContext('LinkedInProvider', 'getPosts', {
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
          SocialMediaProvider.LINKEDIN
        );
      }

      const credentials = await decryptTokens(connection.encryptedCredentials);

      // Get user's LinkedIn ID first
      const userResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
        },
      });

      if (!userResponse.ok) {
        const errorText = await userResponse.text();
        logger.error('LinkedIn userinfo API error in getPosts', {
          connectionId,
          status: userResponse.status,
          error: errorText
        });
        throw new Error(`LinkedIn API error getting user info: ${userResponse.status} - ${errorText}`);
      }

      const userInfo = await userResponse.json();
      const userId = userInfo.sub;

      // Build query parameters
      const queryParams = new URLSearchParams({
        author: `urn:li:person:${userId}`,
        q: 'author',
        count: (params.limit || 10).toString()
      });

      if (params.since) {
        queryParams.append('start', Math.floor(params.since.getTime() / 1000).toString());
      }

      const response = await fetch(`https://api.linkedin.com/v2/ugcPosts?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0'
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('LinkedIn getPosts API error', {
          connectionId,
          status: response.status,
          error: errorText
        });
        throw new Error(`LinkedIn API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const posts = result.elements || [];

      const socialPosts: SocialMediaPost[] = posts.map((post: any) => ({
        id: post.id,
        platform: SocialMediaProvider.LINKEDIN,
        platformPostId: post.id,
        content: post.specificContent?.['com.linkedin.ugc.ShareContent']?.shareCommentary?.text || '',
        url: `https://www.linkedin.com/feed/update/${post.id}`,
        createdAt: new Date(post.created?.time || Date.now()),
        updatedAt: new Date(post.lastModified?.time || Date.now()),
        metrics: {
          views: 0,
          likes: 0,
          shares: 0,
          comments: 0,
          clicks: 0,
          engagementRate: 0,
          reach: 0,
          impressions: 0,
        }
      }));

      logger.info('LinkedIn posts retrieved successfully', {
        connectionId,
        postCount: socialPosts.length,
        limit: params.limit,
        since: params.since
      });

      return socialPosts;
    }, context);

    if (!result.success) {
      throw new SocialMediaError(
        'Failed to get LinkedIn posts',
        'LINKEDIN_GET_POSTS_FAILED',
        SocialMediaProvider.LINKEDIN,
        result.error
      );
    }

    return result.data!;
  }

  async editPost(connectionId: string, postId: string, content: string): Promise<SocialMediaPost> {
    throw new SocialMediaError(
      'LinkedIn does not support post editing',
      'LINKEDIN_EDITING_NOT_SUPPORTED',
      SocialMediaProvider.LINKEDIN
    );
  }

  async deletePost(connectionId: string, postId: string): Promise<void> {
    await handleAsync(async () => {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new SocialMediaError(
          'Connection not found',
          'CONNECTION_NOT_FOUND',
          SocialMediaProvider.LINKEDIN
        );
      }

      const credentials = await decryptTokens(connection.encryptedCredentials);

      const response = await fetch(`https://api.linkedin.com/v2/ugcPosts/${encodeURIComponent(postId)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0'
        },
      });

      if (!response.ok) {
        throw new Error(`LinkedIn API error: ${response.status}`);
      }

      logger.info('LinkedIn post deleted successfully', {
        connectionId,
        postId
      });
    }, createErrorContext('LinkedInProvider', 'deletePost', { severity: ErrorSeverity.MEDIUM }));
  }

  // Default implementations for interface completeness
  async cancelScheduledPost(connectionId: string, scheduledPostId: string): Promise<void> {
    throw new SocialMediaError('Not implemented', 'NOT_IMPLEMENTED', SocialMediaProvider.LINKEDIN);
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

  async getPostMetrics(connectionId: string, postId: string): Promise<PostMetrics> {
    return {
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
    return [];
  }

  async respondToComments(connectionId: string, postId: string, strategy: ResponseStrategy): Promise<CommentResponse[]> {
    return [];
  }

  getSupportedCapabilities(): SocialMediaCapability[] {
    return [
      SocialMediaCapability.POST_CREATE,
      SocialMediaCapability.POST_READ,
      SocialMediaCapability.POST_DELETE,
      SocialMediaCapability.ANALYTICS_READ
    ];
  }

  async getRateLimitStatus(connectionId: string): Promise<{ remaining: number; resetTime: Date; limit: number; }> {
    return { remaining: 1000, resetTime: new Date(Date.now() + 15 * 60 * 1000), limit: 1000 };
  }

  async connect(connectionParams: SocialMediaConnectionParams): Promise<SocialMediaConnection> {
    throw new Error('Use OAuth flow for LinkedIn connections');
  }

  async disconnect(connectionId: string): Promise<void> {
    const context = createErrorContext('LinkedInProvider', 'disconnect', {
      severity: ErrorSeverity.LOW,
      retryable: false,
      metadata: { connectionId }
    });

    await handleAsync(async () => {
      this.connections.delete(connectionId);

      logger.info('LinkedIn connection disconnected', {
        connectionId
      });
    }, context);
  }

  async refreshConnection(connectionId: string): Promise<SocialMediaConnection> {
    const context = createErrorContext('LinkedInProvider', 'refreshConnection', {
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
          SocialMediaProvider.LINKEDIN
        );
      }

      // Trigger token refresh
      await this.refreshTokens(connectionId);

      // Update last validated timestamp
      connection.lastValidated = new Date();

      logger.info('LinkedIn connection refreshed successfully', {
        connectionId,
        lastValidated: connection.lastValidated
      });

      return connection;
    }, context);

    if (!result.success) {
      throw new SocialMediaError(
        'Failed to refresh LinkedIn connection',
        'LINKEDIN_REFRESH_FAILED',
        SocialMediaProvider.LINKEDIN,
        result.error
      );
    }

    return result.data!;
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
    logger.info('LinkedIn post like action', { connectionId, postId });
  }

  async sharePost(connectionId: string, postId: string): Promise<void> {
    logger.info('LinkedIn post share action', { connectionId, postId });
  }

  async optimizeContent(content: string, platform: SocialMediaProvider): Promise<OptimizedContent> {
    return {
      originalContent: content,
      optimizedContent: content.length > 3000 ? content.substring(0, 2997) + '...' : content,
      platform,
      improvements: ['Keep under 3000 characters', 'Use professional tone'],
      estimatedEngagement: 0.7
    };
  }

  handleError(error: Error): SocialMediaError {
    return new SocialMediaError(
      error.message,
      'LINKEDIN_ERROR',
      SocialMediaProvider.LINKEDIN,
      error
    );
  }

  private formatLinkedInContent(content: string, hashtags?: string[]): string {
    let postContent = content;

    if (hashtags && hashtags.length > 0) {
      const hashtagText = hashtags.map(tag => tag.startsWith('#') ? tag : `#${tag}`).join(' ');
      postContent = `${content}\n\n${hashtagText}`;
    }

    // LinkedIn has a 3000 character limit
    if (postContent.length > 3000) {
      postContent = postContent.substring(0, 2997) + '...';
    }

    return postContent;
  }
} 