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

export class LinkedInProvider implements ISocialMediaProvider {
  public connections = new Map<string, SocialMediaConnection>();
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
        console.log('❌ Connection not found for ID:', connectionId);
        return false;
      }

      // Decrypt credentials
      const credentials = this.tokenEncryption.decryptTokens(connection.encryptedCredentials);
      console.log('🔑 Testing LinkedIn token validation...');
      
      // Test the connection with a simple API call
      const response = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`,
        },
      });

      if (!response.ok) {
        console.log(`❌ LinkedIn API validation failed: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.log('Error details:', errorText);
        
        // Check if it's an invalid token error and we have a refresh token
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.code === 'INVALID_ACCESS_TOKEN' && credentials.refresh_token) {
            console.log('🔄 Token invalid, attempting to refresh...');
            await this.refreshTokens(connectionId);
            
            // Retry validation with refreshed token
            console.log('🔑 Retrying LinkedIn token validation after refresh...');
            const updatedConnection = this.connections.get(connectionId);
            if (updatedConnection) {
              const updatedCredentials = this.tokenEncryption.decryptTokens(updatedConnection.encryptedCredentials);
              const retryResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
                headers: {
                  'Authorization': `Bearer ${updatedCredentials.access_token}`,
                },
              });
              
              if (retryResponse.ok) {
                console.log('✅ LinkedIn token validation successful after refresh');
                return true;
              } else {
                console.log('❌ LinkedIn token still invalid after refresh');
                return false;
              }
            }
          }
        } catch (refreshError) {
          console.log('❌ Token refresh attempt failed:', refreshError);
        }
        
        return false;
      }

      console.log('✅ LinkedIn token validation successful');
      return true;
    } catch (error) {
      console.log('❌ LinkedIn validation error:', error);
      return false;
    }
  }

  async refreshTokens(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new SocialMediaError(
        'Connection not found',
        'CONNECTION_NOT_FOUND',
        SocialMediaProvider.LINKEDIN
      );
    }

    try {
      // Decrypt current credentials to get refresh token
      const credentials = this.tokenEncryption.decryptTokens(connection.encryptedCredentials);
      
      if (!credentials.refresh_token) {
        throw new Error('No refresh token available for LinkedIn connection');
      }

      console.log('🔄 Refreshing LinkedIn access token...');

      // Make refresh token request to LinkedIn
      const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: credentials.refresh_token,
          client_id: process.env.LINKEDIN_CLIENT_ID!,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET!
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`❌ LinkedIn token refresh failed: ${response.status} ${response.statusText}`);
        console.log('Error details:', errorText);
        throw new Error(`LinkedIn token refresh failed: ${response.status} - ${errorText}`);
      }

      const tokenData = await response.json();
      console.log('✅ LinkedIn token refreshed successfully');

      // Update the encrypted credentials with new tokens
      const updatedCredentials = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || credentials.refresh_token, // Keep old refresh token if new one not provided
        expires_in: tokenData.expires_in,
        token_type: tokenData.token_type || 'Bearer'
      };

      // Re-encrypt and update the connection
      connection.encryptedCredentials = this.tokenEncryption.encryptTokens(updatedCredentials);
      connection.lastValidated = new Date();

      // In a real implementation, you'd also update the database here
      console.log('🔄 LinkedIn connection updated with refreshed tokens');

    } catch (error) {
      console.log('❌ LinkedIn token refresh error:', error);
      throw new SocialMediaError(
        'Failed to refresh LinkedIn tokens',
        'LINKEDIN_REFRESH_FAILED',
        SocialMediaProvider.LINKEDIN,
        error as Error
      );
    }
  }

  async createPost(connectionId: string, params: PostCreationParams): Promise<SocialMediaPost> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new SocialMediaError(
          'Connection not found',
          'CONNECTION_NOT_FOUND',
          SocialMediaProvider.LINKEDIN
        );
      }

      const credentials = this.tokenEncryption.decryptTokens(connection.encryptedCredentials);
      const postContent = this.formatLinkedInContent(params.content, params.hashtags);
      
      // Get user's LinkedIn ID
      console.log('🔍 Getting LinkedIn user info...');
      const userResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`,
        },
      });

      if (!userResponse.ok) {
        const errorText = await userResponse.text();
        console.log(`❌ LinkedIn userinfo API error: ${userResponse.status} ${userResponse.statusText}`);
        console.log('Error details:', errorText);
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
          'Authorization': `Bearer ${credentials.access_token}`,
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

      return {
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
    } catch (error) {
      throw new SocialMediaError(
        'Failed to create LinkedIn post',
        'LINKEDIN_POST_FAILED',
        SocialMediaProvider.LINKEDIN,
        error as Error
      );
    }
  }

  // Overload signatures to satisfy both single-tenant and multi-tenant interfaces
  async schedulePost(connectionId: string, params: PostScheduleParams): Promise<ScheduledPost>;
  async schedulePost(tenantId: string, accountId: string, params: PostScheduleParams): Promise<ScheduledPost>;
  async schedulePost(connectionIdOrTenantId: string, paramsOrAccountId: PostScheduleParams | string, params?: PostScheduleParams): Promise<ScheduledPost> {
    // LinkedIn API doesn't support native scheduling
    throw new SocialMediaError(
      'LinkedIn does not support native post scheduling',
      'LINKEDIN_SCHEDULING_NOT_SUPPORTED',
      SocialMediaProvider.LINKEDIN
    );
  }

  async getPost(connectionId: string, postId: string): Promise<SocialMediaPost> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new SocialMediaError(
          'Connection not found',
          'CONNECTION_NOT_FOUND',
          SocialMediaProvider.LINKEDIN
        );
      }

      const credentials = this.tokenEncryption.decryptTokens(connection.encryptedCredentials);
      
      const response = await fetch(`https://api.linkedin.com/v2/ugcPosts/${encodeURIComponent(postId)}`, {
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`,
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
          views: 0, // LinkedIn doesn't provide view counts in basic API
          likes: 0,
          shares: 0,
          comments: 0,
          clicks: 0,
          engagementRate: 0,
          reach: 0,
          impressions: 0,
        }
      };
    } catch (error) {
      throw new SocialMediaError(
        'Failed to get LinkedIn post',
        'LINKEDIN_GET_POST_FAILED',
        SocialMediaProvider.LINKEDIN,
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
          SocialMediaProvider.LINKEDIN
        );
      }

      const credentials = this.tokenEncryption.decryptTokens(connection.encryptedCredentials);
      
      // Get user's LinkedIn ID
      console.log('🔍 Getting LinkedIn user info for posts...');
      const userResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`,
        },
      });

      if (!userResponse.ok) {
        const errorText = await userResponse.text();
        console.log(`❌ LinkedIn userinfo API error: ${userResponse.status} ${userResponse.statusText}`);
        console.log('Error details:', errorText);
        throw new Error(`LinkedIn API error getting user info: ${userResponse.status} - ${errorText}`);
      }

      const userInfo = await userResponse.json();
      const userId = userInfo.sub;

      const limit = params.limit || 10;
      const response = await fetch(`https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(urn:li:person:${userId})&count=${limit}`, {
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`,
          'X-Restli-Protocol-Version': '2.0.0'
        },
      });

      if (!response.ok) {
        throw new Error(`LinkedIn API error: ${response.status}`);
      }

      const result = await response.json();
      const posts = result.elements || [];

      return posts.map((post: any) => ({
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
    } catch (error) {
      throw new SocialMediaError(
        'Failed to get LinkedIn posts',
        'LINKEDIN_GET_POSTS_FAILED',
        SocialMediaProvider.LINKEDIN,
        error as Error
      );
    }
  }

  async editPost(connectionId: string, postId: string, content: string): Promise<SocialMediaPost> {
    // LinkedIn API doesn't support editing posts
    throw new SocialMediaError(
      'LinkedIn does not support editing posts',
      'LINKEDIN_EDIT_NOT_SUPPORTED',
      SocialMediaProvider.LINKEDIN
    );
  }

  async deletePost(connectionId: string, postId: string): Promise<void> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new SocialMediaError(
          'Connection not found',
          'CONNECTION_NOT_FOUND',
          SocialMediaProvider.LINKEDIN
        );
      }

      const credentials = this.tokenEncryption.decryptTokens(connection.encryptedCredentials);
      
      const response = await fetch(`https://api.linkedin.com/v2/ugcPosts/${encodeURIComponent(postId)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${credentials.access_token}`,
          'X-Restli-Protocol-Version': '2.0.0'
        },
      });

      if (!response.ok) {
        throw new Error(`LinkedIn API error: ${response.status}`);
      }
    } catch (error) {
      throw new SocialMediaError(
        'Failed to delete LinkedIn post',
        'LINKEDIN_DELETE_FAILED',
        SocialMediaProvider.LINKEDIN,
        error as Error
      );
    }
  }

  async cancelScheduledPost(connectionId: string, scheduledPostId: string): Promise<void> {
    // LinkedIn doesn't support native scheduling
    throw new SocialMediaError(
      'LinkedIn does not support native post scheduling',
      'LINKEDIN_SCHEDULING_NOT_SUPPORTED',
      SocialMediaProvider.LINKEDIN
    );
  }

  async analyzeContent(content: string): Promise<ContentAnalysis> {
    // Basic content analysis for LinkedIn
    return {
      sentiment: 'neutral',
      topics: [],
      hashtags: [],
      mentions: [],
      readabilityScore: 0.7,
      engagementPrediction: 0,
      suggestedImprovements: ['Add professional context', 'Include industry hashtags', 'Ask engaging questions'],
      suggestedHashtags: [],
      estimatedReach: 0,
      platformOptimization: {
        score: 0.5,
        suggestions: ['Add professional context', 'Include industry hashtags', 'Ask engaging questions']
      }
    };
  }

  async getPostMetrics(connectionId: string, postId: string): Promise<PostMetrics> {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        throw new SocialMediaError(
          'Connection not found',
          'CONNECTION_NOT_FOUND',
          SocialMediaProvider.LINKEDIN
        );
      }

      // For now, return basic metrics structure
      // LinkedIn's analytics API requires special permissions
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
    } catch (error) {
      throw new SocialMediaError(
        'Failed to get LinkedIn post metrics',
        'LINKEDIN_METRICS_FAILED',
        SocialMediaProvider.LINKEDIN,
        error as Error
      );
    }
  }

  async getComments(connectionId: string, postId: string): Promise<CommentResponse[]> {
    // LinkedIn comments API requires special permissions
    return [];
  }

  async respondToComments(connectionId: string, postId: string, strategy: ResponseStrategy): Promise<CommentResponse[]> {
    // LinkedIn comments API requires special permissions
    return [];
  }

  getSupportedCapabilities(): SocialMediaCapability[] {
    return [
      SocialMediaCapability.POST_CREATE,
      SocialMediaCapability.POST_READ,
      SocialMediaCapability.POST_DELETE,
      SocialMediaCapability.ANALYTICS_READ,
    ];
  }

  async getRateLimitStatus(connectionId: string): Promise<{ remaining: number; resetTime: Date; limit: number; }> {
    // LinkedIn rate limits are not exposed via API
    return {
      remaining: 100,
      resetTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      limit: 100
    };
  }

  async connect(connectionParams: SocialMediaConnectionParams): Promise<SocialMediaConnection> {
    throw new SocialMediaError(
      'Use MultiTenantLinkedInProvider for OAuth connections',
      'USE_MULTI_TENANT_PROVIDER',
      SocialMediaProvider.LINKEDIN
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
        SocialMediaProvider.LINKEDIN
      );
    }
    return connection;
  }

  async getScheduledPosts(connectionId: string): Promise<ScheduledPost[]> {
    // LinkedIn doesn't support native scheduling
    return [];
  }

  async getDrafts(connectionId: string): Promise<any[]> {
    // LinkedIn doesn't have native draft support
    return [];
  }

  async getDraft(connectionId: string, draftId: string): Promise<any> {
    throw new SocialMediaError(
      'LinkedIn does not support native drafts',
      'LINKEDIN_DRAFTS_NOT_SUPPORTED',
      SocialMediaProvider.LINKEDIN
    );
  }

  async publishDraft(connectionId: string, params: any): Promise<SocialMediaPost> {
    throw new SocialMediaError(
      'LinkedIn does not support native drafts',
      'LINKEDIN_DRAFTS_NOT_SUPPORTED',
      SocialMediaProvider.LINKEDIN
    );
  }

  async scheduleDraft(connectionId: string, params: any): Promise<ScheduledPost> {
    throw new SocialMediaError(
      'LinkedIn does not support native drafts or scheduling',
      'LINKEDIN_DRAFTS_NOT_SUPPORTED',
      SocialMediaProvider.LINKEDIN
    );
  }

  async getAccountAnalytics(connectionId: string, timeframe: string): Promise<AccountAnalytics> {
    throw new SocialMediaError(
      'LinkedIn account analytics not implemented',
      'LINKEDIN_ANALYTICS_NOT_IMPLEMENTED',
      SocialMediaProvider.LINKEDIN
    );
  }

  async replyToComment(connectionId: string, commentId: string, content: string): Promise<Comment> {
    throw new SocialMediaError(
      'LinkedIn comment replies not implemented',
      'LINKEDIN_COMMENTS_NOT_IMPLEMENTED',
      SocialMediaProvider.LINKEDIN
    );
  }

  async likePost(connectionId: string, postId: string): Promise<void> {
    // LinkedIn likes API requires special permissions
    throw new SocialMediaError(
      'LinkedIn post likes not implemented',
      'LINKEDIN_LIKES_NOT_IMPLEMENTED',
      SocialMediaProvider.LINKEDIN
    );
  }

  async sharePost(connectionId: string, postId: string): Promise<void> {
    // LinkedIn shares API requires special permissions
    throw new SocialMediaError(
      'LinkedIn post shares not implemented',
      'LINKEDIN_SHARES_NOT_IMPLEMENTED',
      SocialMediaProvider.LINKEDIN
    );
  }

  async optimizeContent(content: string, platform: SocialMediaProvider): Promise<OptimizedContent> {
    // Basic LinkedIn content optimization
    return {
      originalContent: content,
      optimizedContent: content,
      platform: platform,
      improvements: [
        'Add professional context',
        'Include industry-relevant hashtags',
        'Ask thought-provoking questions',
        'Share insights or experiences'
      ],
      estimatedEngagement: 0.05,
      suggestedHashtags: [],
      suggestedMentions: [],
      estimatedPerformance: {
        likesEstimate: 50,
        sharesEstimate: 10,
        engagementRate: 0.05,
      }
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
    let formattedContent = content;
    
    if (hashtags && hashtags.length > 0) {
      const hashtagString = hashtags.map(tag => tag.startsWith('#') ? tag : `#${tag}`).join(' ');
      formattedContent += `\n\n${hashtagString}`;
    }
    
    return formattedContent;
  }
} 