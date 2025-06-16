import { SocialMediaService } from '../SocialMediaService';
import { SocialMediaProvider, SocialMediaCapability } from '../database/ISocialMediaDatabase';
import { PostCreationParams } from '../providers/base/ISocialMediaProvider';

// Following IMPLEMENTATION_GUIDELINES.md - agent tool integration
export interface SocialMediaToolParams {
  agentId: string;
  connectionId?: string;
  provider?: SocialMediaProvider;
}

export interface CreatePostToolParams extends SocialMediaToolParams {
  content: string;
  images?: string[]; // Base64 encoded images
  hashtags?: string[];
  mentions?: string[];
  privacy?: 'public' | 'private' | 'friends';
}

export interface TikTokVideoToolParams extends SocialMediaToolParams {
  videoFile: string; // Base64 encoded video
  title: string;
  description?: string;
  hashtags?: string[];
  privacy: 'public' | 'friends' | 'private';
  allowComments?: boolean;
  allowDuet?: boolean;
  allowStitch?: boolean;
}

export interface AnalyzeContentToolParams {
  content: string;
  provider: SocialMediaProvider;
}

export interface GetTrendsToolParams {
  provider: SocialMediaProvider;
  region?: string;
  category?: string;
}

// Agent Tools for Social Media Management
export class SocialMediaAgentTools {
  constructor(private socialMediaService: SocialMediaService) {}

  // Core posting tools
  async createPost(params: CreatePostToolParams): Promise<{
    success: boolean;
    postId?: string;
    url?: string;
    error?: string;
    platform?: SocialMediaProvider;
  }> {
    try {
      // Find appropriate connection if not specified
      let connectionId = params.connectionId;
      if (!connectionId) {
        const capabilities = await this.socialMediaService.getAvailableCapabilities(params.agentId);
        const suitableConnection = capabilities.find(cap => 
          cap.capabilities.includes(SocialMediaCapability.POST_CREATE) &&
          (!params.provider || cap.provider === params.provider)
        );
        
        if (!suitableConnection) {
          return {
            success: false,
            error: 'No suitable social media connection found with posting permissions'
          };
        }
        
        connectionId = suitableConnection.connectionId;
      }

      // Convert base64 images to MediaFile objects
      const media = params.images?.map((img, index) => ({
        id: `img_${index}`,
        type: 'image' as const,
        url: `data:image/jpeg;base64,${img}`,
        filename: `image_${index}.jpg`,
        size: Buffer.from(img, 'base64').length,
        mimeType: 'image/jpeg'
      }));

      const postParams: PostCreationParams = {
        content: params.content,
        media,
        hashtags: params.hashtags,
        mentions: params.mentions,
        visibility: params.privacy === 'friends' ? 'unlisted' : (params.privacy || 'public')
      };

      const post = await this.socialMediaService.createPost(
        params.agentId,
        connectionId,
        postParams
      );

      const connection = await this.socialMediaService.getConnection(connectionId);

      return {
        success: true,
        postId: post.id,
        url: post.url,
        platform: connection?.provider
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create post'
      };
    }
  }

  async createTikTokVideo(params: TikTokVideoToolParams): Promise<{
    success: boolean;
    postId?: string;
    url?: string;
    error?: string;
  }> {
    try {
      // Find TikTok connection if not specified
      let connectionId = params.connectionId;
      if (!connectionId) {
        const capabilities = await this.socialMediaService.getAvailableCapabilities(params.agentId);
        const tiktokConnection = capabilities.find(cap => 
          cap.provider === SocialMediaProvider.TIKTOK &&
          cap.capabilities.includes(SocialMediaCapability.TIKTOK_VIDEO_CREATE)
        );
        
        if (!tiktokConnection) {
          return {
            success: false,
            error: 'No TikTok connection found with video creation permissions'
          };
        }
        
        connectionId = tiktokConnection.connectionId;
      }

      // Convert base64 video to buffer
      const videoFile = Buffer.from(params.videoFile, 'base64');

      const post = await this.socialMediaService.uploadTikTokVideo(
        params.agentId,
        connectionId,
        {
          videoFile,
          title: params.title,
          description: params.description,
          hashtags: params.hashtags,
          privacy: params.privacy,
          allowComments: params.allowComments ?? true,
          allowDuet: params.allowDuet ?? true,
          allowStitch: params.allowStitch ?? true
        }
      );

      return {
        success: true,
        postId: post.id,
        url: post.url
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create TikTok video'
      };
    }
  }

  async schedulePost(params: CreatePostToolParams & { scheduleTime: Date }): Promise<{
    success: boolean;
    scheduleId?: string;
    error?: string;
  }> {
    try {
      // For now, return not supported since most platforms don't support native scheduling
      return {
        success: false,
        error: 'Post scheduling not yet implemented - use third-party scheduling service'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to schedule post'
      };
    }
  }

  async deletePost(params: SocialMediaToolParams & { postId: string }): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      if (!params.connectionId) {
        return {
          success: false,
          error: 'Connection ID required for deleting posts'
        };
      }

      await this.socialMediaService.deletePost(
        params.agentId,
        params.connectionId,
        params.postId
      );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete post'
      };
    }
  }

  // Content analysis and optimization tools
  async analyzeContent(params: AnalyzeContentToolParams): Promise<{
    success: boolean;
    analysis?: {
      characterCount: number;
      wordCount: number;
      hashtagCount: number;
      mentionCount: number;
      sentiment: 'positive' | 'negative' | 'neutral';
      suggestions: string[];
      platformOptimized: boolean;
    };
    error?: string;
  }> {
    try {
      const optimization = await this.socialMediaService.optimizeContentForPlatform(
        params.content,
        params.provider
      );

      // Simple sentiment analysis
      const sentiment = this.analyzeSentiment(params.content);

      return {
        success: true,
        analysis: {
          characterCount: params.content.length,
          wordCount: params.content.split(/\s+/).length,
          hashtagCount: (params.content.match(/#\w+/g) || []).length,
          mentionCount: (params.content.match(/@\w+/g) || []).length,
          sentiment,
          suggestions: optimization.suggestions,
          platformOptimized: optimization.optimizedContent === optimization.originalContent
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze content'
      };
    }
  }

  async optimizeContent(params: AnalyzeContentToolParams): Promise<{
    success: boolean;
    optimizedContent?: string;
    suggestions?: string[];
    platformLimits?: {
      characterLimit: number;
      hashtagLimit: number;
      mediaLimit: number;
    };
    error?: string;
  }> {
    try {
      const optimization = await this.socialMediaService.optimizeContentForPlatform(
        params.content,
        params.provider
      );

      return {
        success: true,
        optimizedContent: optimization.optimizedContent,
        suggestions: optimization.suggestions,
        platformLimits: optimization.platformLimits
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to optimize content'
      };
    }
  }

  // Analytics and insights tools
  async getPostMetrics(params: SocialMediaToolParams & { postId: string }): Promise<{
    success: boolean;
    metrics?: {
      likes: number;
      shares: number;
      comments: number;
      views?: number;
      engagementRate?: number;
    };
    error?: string;
  }> {
    try {
      if (!params.connectionId) {
        return {
          success: false,
          error: 'Connection ID required for getting post metrics'
        };
      }

      const post = await this.socialMediaService.getPost(params.connectionId, params.postId);

      return {
        success: true,
        metrics: post.metrics
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get post metrics'
      };
    }
  }

  async getAccountAnalytics(params: SocialMediaToolParams & { timeframe?: 'day' | 'week' | 'month' }): Promise<{
    success: boolean;
    analytics?: {
      totalPosts: number;
      totalEngagement: number;
      followerGrowth: number;
      topPerformingPosts: Array<{
        postId: string;
        engagement: number;
        url?: string;
      }>;
    };
    error?: string;
  }> {
    try {
      // This would integrate with provider analytics APIs
      // For now, return placeholder data
      return {
        success: true,
        analytics: {
          totalPosts: 0,
          totalEngagement: 0,
          followerGrowth: 0,
          topPerformingPosts: []
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get account analytics'
      };
    }
  }

  // Trend analysis tools
  async getTrendingHashtags(params: GetTrendsToolParams): Promise<{
    success: boolean;
    hashtags?: Array<{
      hashtag: string;
      postCount: number;
      trend: 'rising' | 'stable' | 'declining';
    }>;
    error?: string;
  }> {
    try {
      if (params.provider === SocialMediaProvider.TIKTOK) {
        const hashtags = await this.socialMediaService.getTikTokTrendingHashtags(params.region);
        return {
          success: true,
          hashtags
        };
      }

      // For other platforms, return placeholder data
      return {
        success: true,
        hashtags: []
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get trending hashtags'
      };
    }
  }

  async analyzeTrends(params: GetTrendsToolParams): Promise<{
    success: boolean;
    trends?: {
      hashtags: string[];
      topics: string[];
      sentiment: 'positive' | 'negative' | 'neutral';
      recommendations: string[];
    };
    error?: string;
  }> {
    try {
      // This would integrate with trend analysis APIs
      // For now, return basic analysis
      return {
        success: true,
        trends: {
          hashtags: [],
          topics: [],
          sentiment: 'neutral',
          recommendations: [
            'Monitor trending hashtags for your industry',
            'Engage with trending topics relevant to your audience',
            'Post during peak engagement hours'
          ]
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze trends'
      };
    }
  }

  // Connection and permission management tools
  async getAvailableConnections(params: { agentId: string }): Promise<{
    success: boolean;
    connections?: Array<{
      connectionId: string;
      provider: SocialMediaProvider;
      accountName: string;
      capabilities: SocialMediaCapability[];
      accessLevel: string;
    }>;
    error?: string;
  }> {
    try {
      const capabilities = await this.socialMediaService.getAvailableCapabilities(params.agentId);

      return {
        success: true,
        connections: capabilities
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get available connections'
      };
    }
  }

  async checkPermissions(params: SocialMediaToolParams & { requiredCapabilities: SocialMediaCapability[] }): Promise<{
    success: boolean;
    hasPermission?: boolean;
    missingCapabilities?: SocialMediaCapability[];
    error?: string;
  }> {
    try {
      if (!params.connectionId) {
        return {
          success: false,
          error: 'Connection ID required for checking permissions'
        };
      }

      const hasPermission = await this.socialMediaService.validateAgentPermissions(
        params.agentId,
        params.connectionId,
        params.requiredCapabilities
      );

      if (!hasPermission) {
        // Get current permissions to determine what's missing
        const permissions = await this.socialMediaService.getAgentPermissions(params.agentId);
        const currentPermission = permissions.find(p => p.connectionId === params.connectionId);
        const currentCapabilities = currentPermission?.capabilities || [];
        const missingCapabilities = params.requiredCapabilities.filter(
          cap => !currentCapabilities.includes(cap)
        );

        return {
          success: true,
          hasPermission: false,
          missingCapabilities
        };
      }

      return {
        success: true,
        hasPermission: true,
        missingCapabilities: []
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check permissions'
      };
    }
  }

  // Utility methods
  private analyzeSentiment(content: string): 'positive' | 'negative' | 'neutral' {
    // Simple sentiment analysis - in production, use a proper sentiment analysis service
    const positiveWords = ['good', 'great', 'awesome', 'excellent', 'amazing', 'love', 'best', 'fantastic', 'wonderful'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'disappointing', 'sad', 'angry'];
    
    const words = content.toLowerCase().split(/\s+/);
    const positiveCount = words.filter(word => positiveWords.includes(word)).length;
    const negativeCount = words.filter(word => negativeWords.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }
}

// Tool definitions for agent registration
export const SOCIAL_MEDIA_AGENT_TOOLS = [
  {
    id: 'social_media_create_post',
    name: 'Create Social Media Post',
    description: 'Create and publish a post on social media platforms',
    category: 'social_media',
    requiredCapabilities: [SocialMediaCapability.POST_CREATE],
    parameters: {
      content: { type: 'string', required: true, description: 'Post content/text' },
      images: { type: 'array', required: false, description: 'Base64 encoded images' },
      hashtags: { type: 'array', required: false, description: 'Hashtags to include' },
      mentions: { type: 'array', required: false, description: 'Users to mention' },
      provider: { type: 'string', required: false, description: 'Specific platform to post to' },
      privacy: { type: 'string', required: false, description: 'Post privacy level' }
    }
  },
  {
    id: 'social_media_create_tiktok_video',
    name: 'Create TikTok Video',
    description: 'Upload and publish a video to TikTok',
    category: 'social_media',
    requiredCapabilities: [SocialMediaCapability.TIKTOK_VIDEO_CREATE],
    parameters: {
      videoFile: { type: 'string', required: true, description: 'Base64 encoded video file' },
      title: { type: 'string', required: true, description: 'Video title' },
      description: { type: 'string', required: false, description: 'Video description' },
      hashtags: { type: 'array', required: false, description: 'Hashtags to include' },
      privacy: { type: 'string', required: false, description: 'Video privacy level' },
      allowComments: { type: 'boolean', required: false, description: 'Allow comments on video' },
      allowDuet: { type: 'boolean', required: false, description: 'Allow duets' },
      allowStitch: { type: 'boolean', required: false, description: 'Allow stitches' }
    }
  },
  {
    id: 'social_media_analyze_content',
    name: 'Analyze Content',
    description: 'Analyze content for platform optimization and sentiment',
    category: 'social_media',
    requiredCapabilities: [],
    parameters: {
      content: { type: 'string', required: true, description: 'Content to analyze' },
      provider: { type: 'string', required: true, description: 'Target platform for analysis' }
    }
  },
  {
    id: 'social_media_optimize_content',
    name: 'Optimize Content',
    description: 'Optimize content for specific social media platforms',
    category: 'social_media',
    requiredCapabilities: [],
    parameters: {
      content: { type: 'string', required: true, description: 'Content to optimize' },
      provider: { type: 'string', required: true, description: 'Target platform for optimization' }
    }
  },
  {
    id: 'social_media_get_trending_hashtags',
    name: 'Get Trending Hashtags',
    description: 'Get trending hashtags for a platform',
    category: 'social_media',
    requiredCapabilities: [SocialMediaCapability.ANALYTICS_READ],
    parameters: {
      provider: { type: 'string', required: true, description: 'Platform to get trends from' },
      region: { type: 'string', required: false, description: 'Region for trends (e.g., US, UK)' }
    }
  },
  {
    id: 'social_media_get_post_metrics',
    name: 'Get Post Metrics',
    description: 'Get performance metrics for a specific post',
    category: 'social_media',
    requiredCapabilities: [SocialMediaCapability.ANALYTICS_READ],
    parameters: {
      connectionId: { type: 'string', required: true, description: 'Social media connection ID' },
      postId: { type: 'string', required: true, description: 'Post ID to get metrics for' }
    }
  },
  {
    id: 'social_media_delete_post',
    name: 'Delete Post',
    description: 'Delete a social media post',
    category: 'social_media',
    requiredCapabilities: [SocialMediaCapability.POST_DELETE],
    parameters: {
      connectionId: { type: 'string', required: true, description: 'Social media connection ID' },
      postId: { type: 'string', required: true, description: 'Post ID to delete' }
    }
  },
  {
    id: 'social_media_get_connections',
    name: 'Get Available Connections',
    description: 'Get all available social media connections for the agent',
    category: 'social_media',
    requiredCapabilities: [],
    parameters: {}
  }
]; 