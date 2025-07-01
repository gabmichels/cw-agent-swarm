import {
  ISocialMediaDatabase,
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
import * as crypto from 'crypto';
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
import { TokenEncryption } from '../../../services/security/TokenEncryption';

export class TwitterProvider implements ISocialMediaProvider {
  private connections = new Map<string, SocialMediaConnection>();
  private clientId: string;
  private clientSecret: string;
  private database: ISocialMediaDatabase | null = null;
  private legacyTokenEncryption = new TokenEncryption();

  constructor() {
    // Twitter Provider for OAuth-based connections
    // No API keys needed in constructor - uses OAuth tokens from connections
    this.clientId = process.env.TWITTER_CLIENT_ID || '';
    this.clientSecret = process.env.TWITTER_CLIENT_SECRET || '';

    logger.info('Twitter Provider initialized for OAuth connections', {
      provider: 'twitter',
      hasClientId: !!this.clientId,
      hasClientSecret: !!this.clientSecret,
      mode: 'oauth',
      note: 'Uses OAuth tokens from database connections, not API keys'
    });
  }

  // Set database reference for on-demand connection loading
  setDatabase(database: ISocialMediaDatabase): void {
    this.database = database;
  }

  addConnection(connection: SocialMediaConnection): void {
    this.connections.set(connection.id, connection);
    logger.info('Twitter connection added', {
      connectionId: connection.id,
      accountId: connection.providerAccountId,
      status: connection.connectionStatus
    });
  }

  // Get connection on-demand (load from database if not cached)
  private async getConnection(connectionId: string): Promise<SocialMediaConnection> {
    // Check cache first
    let connection = this.connections.get(connectionId);

    if (!connection && this.database) {
      // Load from database
      const dbConnection = await this.database.getConnection(connectionId);
      if (dbConnection && dbConnection.provider === SocialMediaProvider.TWITTER) {
        connection = dbConnection;
        // Cache it for future use
        this.connections.set(connectionId, connection);
        logger.debug('Twitter connection loaded from database', {
          connectionId,
          accountUsername: connection.accountUsername
        });
      }
    }

    if (!connection) {
      throw new SocialMediaError(
        'Twitter connection not found',
        'CONNECTION_NOT_FOUND',
        SocialMediaProvider.TWITTER
      );
    }

    return connection;
  }

  // Helper method to decrypt tokens with fallback to legacy format
  private async decryptConnectionTokens(encryptedCredentials: string): Promise<{
    accessToken?: string;
    refreshToken?: string;
    oauthToken?: string;
    oauthTokenSecret?: string;
    tokenType: 'oauth1' | 'oauth2';
  }> {
    // First try to parse the credentials to determine format
    let parsedCredentials: any;
    try {
      parsedCredentials = JSON.parse(encryptedCredentials);
    } catch {
      // If not JSON, assume it's legacy encrypted format
      const legacyTokens = await this.legacyTokenEncryption.decrypt(encryptedCredentials);
      const parsed = JSON.parse(legacyTokens);

      // Normalize field names and user-friendly logging for legacy format
      const normalized = this.normalizeCredentials(parsed);
      const tokenInfo = this.getTokenInfo(normalized);
      logger.info(`🔐 Using legacy token format (${tokenInfo.description})`, {
        provider: 'twitter',
        tokenType: tokenInfo.type,
        isValid: tokenInfo.isValid
      });

      return {
        ...normalized,
        tokenType: normalized.oauthToken ? 'oauth1' : 'oauth2'
      };
    }

    // If it's already JSON, check if it's new format (has 'encrypted' field)
    if (parsedCredentials.encrypted) {
      // This is new unified format - try to decrypt it
      try {
        const tokens = await decryptTokens(encryptedCredentials);

        logger.info('🔐 Using unified token manager (modern format)', {
          provider: 'twitter',
          tokenType: 'oauth2'
        });

        // Handle OAuth 2.0 tokens from unified manager
        return {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenType: 'oauth2' // Unified manager currently only supports OAuth 2.0
        };
      } catch (error) {
        logger.info('🔐 Unified format failed, trying legacy encryption fallback...', {
          provider: 'twitter',
          note: 'This is normal for older connections'
        });

        // Fall back to legacy format
        const legacyTokens = await this.legacyTokenEncryption.decrypt(encryptedCredentials);
        const parsed = JSON.parse(legacyTokens);

        const normalized = this.normalizeCredentials(parsed);
        const tokenInfo = this.getTokenInfo(normalized);
        logger.info(`🔐 Successfully using legacy encryption (${tokenInfo.description})`, {
          provider: 'twitter',
          tokenType: tokenInfo.type,
          isValid: tokenInfo.isValid
        });

        return {
          ...normalized,
          tokenType: normalized.oauthToken ? 'oauth1' : 'oauth2'
        };
      }
    } else {
      // This is old plain JSON format (unencrypted)
      const normalized = this.normalizeCredentials(parsedCredentials);
      const tokenInfo = this.getTokenInfo(normalized);
      logger.info(`🔐 Using plain JSON credentials (${tokenInfo.description})`, {
        provider: 'twitter',
        tokenType: tokenInfo.type,
        isValid: tokenInfo.isValid
      });

      return {
        ...normalized,
        tokenType: normalized.oauthToken ? 'oauth1' : 'oauth2'
      };
    }
  }

  private normalizeCredentials(credentials: any): any {
    // Normalize field names that might vary between storage formats
    return {
      accessToken: credentials.accessToken || credentials.access_token,
      refreshToken: credentials.refreshToken || credentials.refresh_token,
      oauthToken: credentials.oauthToken || credentials.oauth_token,
      oauthTokenSecret: credentials.oauthTokenSecret || credentials.oauth_token_secret,
      // Preserve other fields
      ...credentials
    };
  }

  private getTokenInfo(credentials: any): { type: string; description: string; isValid: boolean } {
    if (credentials.oauthToken && credentials.oauthTokenSecret) {
      return {
        type: 'oauth1',
        description: 'OAuth 1.0a tokens ready',
        isValid: true
      };
    } else if (credentials.accessToken || credentials.access_token) {
      return {
        type: 'oauth2',
        description: 'OAuth 2.0 tokens ready',
        isValid: true
      };
    } else {
      // Check what fields exist to provide helpful error message
      const fields = Object.keys(credentials);
      return {
        type: 'unknown',
        description: `Invalid token format - found fields: ${fields.join(', ')}`,
        isValid: false
      };
    }
  }

  // OAuth 1.0a signature generation for Twitter API v1.1
  private generateOAuth1Signature(
    method: string,
    url: string,
    params: Record<string, string>,
    oauthToken: string,
    oauthTokenSecret: string
  ): string {
    // Create OAuth parameters
    const oauthParams = {
      oauth_consumer_key: this.clientId,
      oauth_token: oauthToken,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_version: '1.0',
      ...params
    };

    // Create parameter string
    const sortedParams = Object.keys(oauthParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent((oauthParams as any)[key])}`)
      .join('&');

    // Create signature base string
    const baseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;

    // Create signing key
    const signingKey = `${encodeURIComponent(this.clientSecret)}&${encodeURIComponent(oauthTokenSecret)}`;

    // Generate signature
    const signature = crypto
      .createHmac('sha1', signingKey)
      .update(baseString)
      .digest('base64');

    // Return authorization header
    const authParams = {
      oauth_consumer_key: this.clientId,
      oauth_token: oauthToken,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: oauthParams.oauth_timestamp,
      oauth_nonce: oauthParams.oauth_nonce,
      oauth_version: '1.0',
      oauth_signature: signature
    };

    const authHeader = 'OAuth ' + Object.keys(authParams)
      .map(key => `${encodeURIComponent(key)}="${encodeURIComponent((authParams as any)[key])}"`)
      .join(', ');

    return authHeader;
  }

  // Create authentication headers based on token type
  private async createAuthHeaders(
    method: string,
    url: string,
    credentials: {
      accessToken?: string;
      oauthToken?: string;
      oauthTokenSecret?: string;
      tokenType: 'oauth1' | 'oauth2';
    },
    params: Record<string, string> = {}
  ): Promise<Record<string, string>> {
    if (credentials.tokenType === 'oauth2') {
      if (!credentials.accessToken) {
        throw new Error(`OAuth 2.0 access token is missing or empty. Available fields: ${Object.keys(credentials).join(', ')}`);
      }
      // OAuth 2.0 Bearer token
      return {
        'Authorization': `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json'
      };
    } else if (credentials.tokenType === 'oauth1') {
      if (!credentials.oauthToken || !credentials.oauthTokenSecret) {
        const missing = [];
        if (!credentials.oauthToken) missing.push('oauthToken');
        if (!credentials.oauthTokenSecret) missing.push('oauthTokenSecret');
        throw new Error(`OAuth 1.0a tokens missing: ${missing.join(', ')}. Available fields: ${Object.keys(credentials).join(', ')}`);
      }
      // OAuth 1.0a signature
      const authHeader = this.generateOAuth1Signature(
        method,
        url,
        params,
        credentials.oauthToken,
        credentials.oauthTokenSecret
      );
      return {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      };
    } else {
      throw new Error(`Unknown token type: ${credentials.tokenType}. Available fields: ${Object.keys(credentials).join(', ')}`);
    }
  }

  async validateConnection(connectionId: string): Promise<boolean> {
    const context = createErrorContext('TwitterProvider', 'validateConnection', {
      severity: ErrorSeverity.LOW,
      retryable: true,
      metadata: { connectionId }
    });

    const result = await handleAsync(async () => {
      const connection = await this.getConnection(connectionId);

      // Decrypt credentials using unified token manager
      const credentials = await this.decryptConnectionTokens(connection.encryptedCredentials);

      // Choose appropriate API endpoint based on token type
      let url: string;
      if (credentials.tokenType === 'oauth2') {
        url = 'https://api.twitter.com/2/users/me';
      } else {
        url = 'https://api.twitter.com/1.1/account/verify_credentials.json';
      }

      // Create authentication headers
      const headers = await this.createAuthHeaders('GET', url, credentials);

      // Test the connection with a simple API call
      const response = await fetch(url, { headers });

      const isValid = response.ok;

      logger.info('Twitter connection validation completed', {
        connectionId,
        isValid,
        status: response.status,
        tokenType: credentials.tokenType,
        endpoint: url
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
      const connection = await this.getConnection(connectionId);

      const credentials = await this.decryptConnectionTokens(connection.encryptedCredentials);
      const tweetText = this.formatTweetContent(params.content, params.hashtags);

      // Choose appropriate API endpoint and data format based on token type
      let url: string;
      let tweetData: any;

      if (credentials.tokenType === 'oauth2') {
        // Twitter API v2 format
        url = 'https://api.twitter.com/2/tweets';
        tweetData = { text: tweetText };
      } else {
        // Twitter API v1.1 format
        url = 'https://api.twitter.com/1.1/statuses/update.json';
        tweetData = { status: tweetText };
      }

      // Log media upload if present (not implemented in this simplified version)
      if (params.media && params.media.length > 0) {
        logger.info('Twitter post media upload requested', {
          connectionId,
          mediaCount: params.media.length,
          note: 'Media upload implementation needed'
        });
      }

      // Create authentication headers
      const headers = await this.createAuthHeaders('POST', url, credentials);

      // Make the API request
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(tweetData),
      });

      if (!response.ok) {
        const errorText = await response.text();

        // Handle specific Twitter API error cases
        if (response.status === 403 && errorText.includes('duplicate content')) {
          throw new SocialMediaError(
            'This content was already posted recently. Twitter blocks duplicate tweets to prevent spam. Try posting with different wording or wait a few hours.',
            'TWITTER_DUPLICATE_CONTENT',
            SocialMediaProvider.TWITTER,
            new Error(`Duplicate content: ${errorText}`)
          );
        }

        // Handle other Twitter API errors
        throw new Error(`Twitter API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      // Handle different response formats
      let postId: string;
      if (credentials.tokenType === 'oauth2') {
        // API v2 response format
        postId = result.data.id;
      } else {
        // API v1.1 response format  
        postId = result.id_str;
      }

      const post: SocialMediaPost = {
        id: postId,
        platform: SocialMediaProvider.TWITTER,
        platformPostId: postId,
        content: params.content,
        media: params.media,
        hashtags: params.hashtags,
        mentions: params.mentions,
        url: `https://twitter.com/i/status/${postId}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      logger.info('Twitter post created successfully', {
        connectionId,
        postId: post.id,
        platform: post.platform,
        contentLength: params.content.length,
        tokenType: credentials.tokenType,
        endpoint: url
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
      const connection = await this.getConnection(connectionId);

      const credentials = await this.decryptConnectionTokens(connection.encryptedCredentials);

      // Choose appropriate API endpoint based on token type
      let url: string;
      if (credentials.tokenType === 'oauth2') {
        url = `https://api.twitter.com/2/tweets/${postId}?tweet.fields=created_at,public_metrics`;
      } else {
        url = `https://api.twitter.com/1.1/statuses/show.json?id=${postId}`;
      }

      // Create authentication headers
      const headers = await this.createAuthHeaders('GET', url, credentials);

      const response = await fetch(url, { headers });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Twitter API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      // Handle different response formats
      let tweet: any;
      if (credentials.tokenType === 'oauth2') {
        tweet = result.data;
      } else {
        tweet = result;
      }

      const post: SocialMediaPost = {
        id: credentials.tokenType === 'oauth2' ? tweet.id : tweet.id_str,
        platform: SocialMediaProvider.TWITTER,
        platformPostId: credentials.tokenType === 'oauth2' ? tweet.id : tweet.id_str,
        content: tweet.text,
        url: `https://twitter.com/i/status/${credentials.tokenType === 'oauth2' ? tweet.id : tweet.id_str}`,
        createdAt: new Date(tweet.created_at!),
        updatedAt: new Date(tweet.created_at!),
        metrics: credentials.tokenType === 'oauth2' && tweet.public_metrics ? {
          views: tweet.public_metrics.impression_count || 0,
          likes: tweet.public_metrics.like_count || 0,
          shares: tweet.public_metrics.retweet_count || 0,
          comments: tweet.public_metrics.reply_count || 0,
          clicks: 0,
          engagementRate: 0,
          reach: 0,
          impressions: tweet.public_metrics.impression_count || 0,
        } : credentials.tokenType === 'oauth1' ? {
          views: 0,
          likes: tweet.favorite_count || 0,
          shares: tweet.retweet_count || 0,
          comments: 0,
          clicks: 0,
          engagementRate: 0,
          reach: 0,
          impressions: 0,
        } : undefined
      };

      logger.info('Twitter post retrieved successfully', {
        connectionId,
        postId,
        hasMetrics: !!post.metrics,
        tokenType: credentials.tokenType,
        endpoint: url
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
      const connection = await this.getConnection(connectionId);

      const credentials = await this.decryptConnectionTokens(connection.encryptedCredentials);
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
      const connection = await this.getConnection(connectionId);

      const credentials = await this.decryptConnectionTokens(connection.encryptedCredentials);

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
    const connection = await this.getConnection(connectionId);
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