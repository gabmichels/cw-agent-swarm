import { SocialMediaService } from '../SocialMediaService';
import { SocialMediaNLP, SocialMediaCommand, ConversationContext } from '../integration/SocialMediaNLP';
import { PrismaSocialMediaDatabase } from '../database/PrismaSocialMediaDatabase';
import { SocialMediaProvider, SocialMediaCapability, MediaFile } from '../database/ISocialMediaDatabase';
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

export interface SocialMediaToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      required?: boolean;
      enum?: string[];
    }>;
    required: string[];
  };
  capabilities: SocialMediaCapability[];
  execute: (params: Record<string, unknown>, agentId: string, connectionIds: string[]) => Promise<unknown>;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTime?: number;
  auditLog?: {
    agentId: string;
    toolName: string;
    parameters: Record<string, unknown>;
    result: 'success' | 'failure';
    timestamp: Date;
  };
}

// Agent Tools for Social Media Management
export class SocialMediaAgentTools {
  private socialMediaService: SocialMediaService;
  private database: PrismaSocialMediaDatabase;
  private nlpProcessor: SocialMediaNLP;
  private tools: SocialMediaToolDefinition[];

  constructor(socialMediaService: SocialMediaService, database: PrismaSocialMediaDatabase) {
    this.socialMediaService = socialMediaService;
    this.database = database;
    this.nlpProcessor = new SocialMediaNLP();
    this.tools = this.initializeTools();
  }

  /**
   * Get available tools for an agent based on their permissions
   */
  async getAvailableTools(agentId: string): Promise<SocialMediaToolDefinition[]> {
    const permissions = await this.database.getAgentPermissions(agentId);
    const agentCapabilities = permissions.flatMap(p => p.capabilities);

    return this.tools.filter(tool => 
      tool.capabilities.every(cap => agentCapabilities.includes(cap))
    );
  }

  /**
   * Process user input and execute appropriate social media actions
   */
  async processUserInput(
    agentId: string,
    userMessage: string,
    connectionIds: string[]
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      // Get agent context
      const context = await this.buildConversationContext(agentId, connectionIds);
      
      // Parse command
      const command = this.nlpProcessor.parseCommand(userMessage, context);
      
      if (!command || command.type === 'unknown') {
        return {
          success: false,
          error: 'No social media command detected in the message',
          executionTime: Date.now() - startTime
        };
      }

      // Validate permissions
      const hasPermission = await this.validatePermissions(agentId, command.requiredCapabilities, connectionIds);
      if (!hasPermission) {
        return {
          success: false,
          error: `Agent lacks required permissions: ${command.requiredCapabilities.join(', ')}`,
          executionTime: Date.now() - startTime
        };
      }

      // Execute the appropriate tool
      const result = await this.executeCommandBasedAction(agentId, command, connectionIds);
      
      // Log execution
      await this.logToolExecution(agentId, command.type, command.entities, result);

      return {
        ...result,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      return {
        success: false,
        error: errorMessage,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Execute a specific tool by name
   */
  async executeTool(
    toolName: string,
    parameters: Record<string, unknown>,
    agentId: string,
    connectionIds: string[]
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      const tool = this.tools.find(t => t.name === toolName);
      if (!tool) {
        return {
          success: false,
          error: `Tool '${toolName}' not found`,
          executionTime: Date.now() - startTime
        };
      }

      // Validate permissions
      const hasPermission = await this.validatePermissions(agentId, tool.capabilities, connectionIds);
      if (!hasPermission) {
        return {
          success: false,
          error: `Agent lacks required permissions for tool '${toolName}'`,
          executionTime: Date.now() - startTime
        };
      }

      // Execute tool
      const result = await tool.execute(parameters, agentId, connectionIds);
      
      // Log execution
      await this.logToolExecution(agentId, toolName, parameters, { success: true, data: result });

      return {
        success: true,
        data: result,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      await this.logToolExecution(agentId, toolName, parameters, { success: false, error: errorMessage });

      return {
        success: false,
        error: errorMessage,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Initialize all available social media tools
   */
  private initializeTools(): SocialMediaToolDefinition[] {
    return [
      // Content Creation Tools
      {
        name: 'create_text_post',
        description: 'Create a text-based post on social media platforms',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'The text content of the post' },
            platforms: { type: 'array', description: 'Target platforms', enum: Object.values(SocialMediaProvider) },
            hashtags: { type: 'array', description: 'Hashtags to include' },
            visibility: { type: 'string', description: 'Post visibility', enum: ['public', 'private', 'unlisted'] }
          },
          required: ['content', 'platforms']
        },
        capabilities: [SocialMediaCapability.POST_CREATE],
        execute: this.createTextPost.bind(this)
      },

      {
        name: 'create_image_post',
        description: 'Create a post with images on social media platforms',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'The text content of the post' },
            platforms: { type: 'array', description: 'Target platforms', enum: Object.values(SocialMediaProvider) },
            images: { type: 'array', description: 'Image URLs or file paths' },
            hashtags: { type: 'array', description: 'Hashtags to include' },
            visibility: { type: 'string', description: 'Post visibility', enum: ['public', 'private', 'unlisted'] }
          },
          required: ['content', 'platforms', 'images']
        },
        capabilities: [SocialMediaCapability.POST_CREATE, SocialMediaCapability.IMAGE_UPLOAD],
        execute: this.createImagePost.bind(this)
      },

      {
        name: 'create_video_post',
        description: 'Create a post with video on social media platforms',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'The text content of the post' },
            platforms: { type: 'array', description: 'Target platforms', enum: Object.values(SocialMediaProvider) },
            video: { type: 'string', description: 'Video URL or file path' },
            hashtags: { type: 'array', description: 'Hashtags to include' },
            visibility: { type: 'string', description: 'Post visibility', enum: ['public', 'private', 'unlisted'] }
          },
          required: ['content', 'platforms', 'video']
        },
        capabilities: [SocialMediaCapability.POST_CREATE, SocialMediaCapability.VIDEO_UPLOAD],
        execute: this.createVideoPost.bind(this)
      },

      {
        name: 'schedule_post',
        description: 'Schedule a post for later publication',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'The text content of the post' },
            platforms: { type: 'array', description: 'Target platforms', enum: Object.values(SocialMediaProvider) },
            scheduleTime: { type: 'string', description: 'ISO timestamp for when to post' },
            hashtags: { type: 'array', description: 'Hashtags to include' },
            media: { type: 'array', description: 'Media files to include' }
          },
          required: ['content', 'platforms', 'scheduleTime']
        },
        capabilities: [SocialMediaCapability.POST_CREATE, SocialMediaCapability.POST_SCHEDULE],
        execute: this.schedulePost.bind(this)
      },

      // TikTok Specific Tools
      {
        name: 'create_tiktok_video',
        description: 'Create a TikTok video with trending optimization',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Video title' },
            description: { type: 'string', description: 'Video description' },
            video: { type: 'string', description: 'Video file path or URL' },
            hashtags: { type: 'array', description: 'Hashtags including trending ones' },
            music: { type: 'string', description: 'Background music or sound' },
            privacy: { type: 'string', description: 'Privacy setting', enum: ['public', 'friends', 'private'] }
          },
          required: ['title', 'description', 'video']
        },
        capabilities: [SocialMediaCapability.TIKTOK_VIDEO_CREATE],
        execute: this.createTikTokVideo.bind(this)
      },

      {
        name: 'analyze_tiktok_trends',
        description: 'Analyze current TikTok trends and suggest content',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Trend category to analyze' },
            region: { type: 'string', description: 'Geographic region for trends' },
            timeframe: { type: 'string', description: 'Time period', enum: ['day', 'week', 'month'] }
          },
          required: []
        },
        capabilities: [SocialMediaCapability.TIKTOK_ANALYTICS_READ],
        execute: this.analyzeTikTokTrends.bind(this)
      },

      // Analytics Tools
      {
        name: 'get_post_metrics',
        description: 'Get performance metrics for specific posts',
        parameters: {
          type: 'object',
          properties: {
            postIds: { type: 'array', description: 'Post IDs to analyze' },
            platforms: { type: 'array', description: 'Platforms to check', enum: Object.values(SocialMediaProvider) },
            metrics: { type: 'array', description: 'Metrics to retrieve', enum: ['likes', 'shares', 'comments', 'views', 'engagement'] }
          },
          required: ['postIds']
        },
        capabilities: [SocialMediaCapability.ANALYTICS_READ],
        execute: this.getPostMetrics.bind(this)
      },

      {
        name: 'get_account_analytics',
        description: 'Get account-level analytics and insights',
        parameters: {
          type: 'object',
          properties: {
            platforms: { type: 'array', description: 'Platforms to analyze', enum: Object.values(SocialMediaProvider) },
            timeframe: { type: 'string', description: 'Analysis timeframe', enum: ['day', 'week', 'month', 'quarter'] },
            metrics: { type: 'array', description: 'Metrics to include' }
          },
          required: ['platforms', 'timeframe']
        },
        capabilities: [SocialMediaCapability.ANALYTICS_READ],
        execute: this.getAccountAnalytics.bind(this)
      },

      // Engagement Tools
      {
        name: 'get_comments',
        description: 'Retrieve comments from posts',
        parameters: {
          type: 'object',
          properties: {
            postIds: { type: 'array', description: 'Post IDs to get comments from' },
            platforms: { type: 'array', description: 'Platforms to check', enum: Object.values(SocialMediaProvider) },
            limit: { type: 'number', description: 'Maximum number of comments to retrieve' }
          },
          required: ['postIds']
        },
        capabilities: [SocialMediaCapability.COMMENT_READ],
        execute: this.getComments.bind(this)
      },

      {
        name: 'reply_to_comment',
        description: 'Reply to a specific comment',
        parameters: {
          type: 'object',
          properties: {
            commentId: { type: 'string', description: 'Comment ID to reply to' },
            platform: { type: 'string', description: 'Platform where the comment exists', enum: Object.values(SocialMediaProvider) },
            reply: { type: 'string', description: 'Reply text' }
          },
          required: ['commentId', 'platform', 'reply']
        },
        capabilities: [SocialMediaCapability.COMMENT_CREATE],
        execute: this.replyToComment.bind(this)
      },

      {
        name: 'like_post',
        description: 'Like or react to a post',
        parameters: {
          type: 'object',
          properties: {
            postId: { type: 'string', description: 'Post ID to like' },
            platform: { type: 'string', description: 'Platform where the post exists', enum: Object.values(SocialMediaProvider) },
            reactionType: { type: 'string', description: 'Type of reaction', enum: ['like', 'love', 'laugh', 'wow', 'sad', 'angry'] }
          },
          required: ['postId', 'platform']
        },
        capabilities: [SocialMediaCapability.LIKE_CREATE],
        execute: this.likePost.bind(this)
      }
    ];
  }

  // Tool Implementation Methods

  private async createTextPost(params: Record<string, unknown>, agentId: string, connectionIds: string[]): Promise<unknown> {
    const postParams: PostCreationParams = {
      content: params.content as string,
      hashtags: params.hashtags as string[] || [],
      visibility: params.visibility as 'public' | 'private' | 'unlisted' || 'public',
      media: []
    };

    // Create post on first available connection (tools typically work with single connection)
    const connectionId = connectionIds[0];
    if (!connectionId) {
      throw new Error('No connection available for posting');
    }

    return await this.socialMediaService.createPost(agentId, connectionId, postParams);
  }

  private async createImagePost(params: Record<string, unknown>, agentId: string, connectionIds: string[]): Promise<unknown> {
    const images = params.images as string[];
    const media: MediaFile[] = images.map((url, index) => ({
      id: `img_${index}`,
      type: 'image',
      url,
      filename: `image_${index}.jpg`,
      size: 0,
      mimeType: 'image/jpeg'
    }));

    const postParams: PostCreationParams = {
      content: params.content as string,
      hashtags: params.hashtags as string[] || [],
      visibility: params.visibility as 'public' | 'private' | 'unlisted' || 'public',
      media
    };

    const connectionId = connectionIds[0];
    if (!connectionId) {
      throw new Error('No connection available for posting');
    }

    return await this.socialMediaService.createPost(agentId, connectionId, postParams);
  }

  private async createVideoPost(params: Record<string, unknown>, agentId: string, connectionIds: string[]): Promise<unknown> {
    const media: MediaFile[] = [{
      id: 'video_1',
      type: 'video',
      url: params.video as string,
      filename: 'video.mp4',
      size: 0,
      mimeType: 'video/mp4'
    }];

    const postParams: PostCreationParams = {
      content: params.content as string,
      hashtags: params.hashtags as string[] || [],
      visibility: params.visibility as 'public' | 'private' | 'unlisted' || 'public',
      media
    };

    const connectionId = connectionIds[0];
    if (!connectionId) {
      throw new Error('No connection available for posting');
    }

    return await this.socialMediaService.createPost(agentId, connectionId, postParams);
  }

  private async schedulePost(params: Record<string, unknown>, agentId: string, connectionIds: string[]): Promise<unknown> {
    // TODO: Implement scheduling when SocialMediaService.schedulePost exists
    throw new Error('Post scheduling not yet implemented in SocialMediaService');
  }

  private async createTikTokVideo(params: Record<string, unknown>, agentId: string, connectionIds: string[]): Promise<unknown> {
    // TODO: Implement TikTok video creation when SocialMediaService.createTikTokVideo exists
    throw new Error('TikTok video creation not yet implemented in SocialMediaService');
  }

  private async analyzeTikTokTrends(params: Record<string, unknown>, agentId: string, connectionIds: string[]): Promise<unknown> {
    // TODO: Implement trend analysis when SocialMediaService.analyzeTikTokTrends exists  
    throw new Error('TikTok trend analysis not yet implemented in SocialMediaService');
  }

  private async getPostMetrics(params: Record<string, unknown>, agentId: string, connectionIds: string[]): Promise<unknown> {
    // TODO: Implement metrics retrieval when SocialMediaService.getPostMetrics exists
    throw new Error('Post metrics retrieval not yet implemented in SocialMediaService');
  }

  private async getAccountAnalytics(params: Record<string, unknown>, agentId: string, connectionIds: string[]): Promise<unknown> {
    // TODO: Implement analytics when SocialMediaService.getAccountAnalytics exists
    throw new Error('Account analytics not yet implemented in SocialMediaService');
  }

  private async getComments(params: Record<string, unknown>, agentId: string, connectionIds: string[]): Promise<unknown> {
    const connectionId = connectionIds[0];
    if (!connectionId) {
      throw new Error('No connection available for getting comments');
    }
    
    return await this.socialMediaService.getComments(
      agentId,
      connectionId,
      params.postId as string,
      { limit: params.limit as number || 50 }
    );
  }

  private async replyToComment(params: Record<string, unknown>, agentId: string, connectionIds: string[]): Promise<unknown> {
    const connectionId = connectionIds[0];
    if (!connectionId) {
      throw new Error('No connection available for replying to comment');
    }
    
    return await this.socialMediaService.replyToComment(
      agentId,
      connectionId,
      params.commentId as string,
      params.reply as string
    );
  }

  private async likePost(params: Record<string, unknown>, agentId: string, connectionIds: string[]): Promise<unknown> {
    const connectionId = connectionIds[0];
    if (!connectionId) {
      throw new Error('No connection available for liking post');
    }
    
    return await this.socialMediaService.likePost(
      agentId,
      connectionId,
      params.postId as string
    );
  }

  // Helper Methods

  private async buildConversationContext(agentId: string, connectionIds: string[]): Promise<ConversationContext> {
    const permissions = await this.database.getAgentPermissions(agentId);
    const connections = await Promise.all(
      connectionIds.map(id => this.database.getConnection(id))
    );

    return {
      previousMessages: [], // Would be populated from conversation history
      currentTopic: '', // Would be determined from context
      userGoals: [], // Would be extracted from user preferences
      availableConnections: connections.filter(conn => conn !== null).map(conn => ({
        id: conn!.id,
        provider: conn!.provider,
        accountDisplayName: conn!.accountDisplayName
      })),
      agentCapabilities: permissions.flatMap(p => p.capabilities)
    };
  }

  private async validatePermissions(
    agentId: string, 
    requiredCapabilities: SocialMediaCapability[], 
    connectionIds: string[]
  ): Promise<boolean> {
    const permissions = await this.database.getAgentPermissions(agentId);
    const agentCapabilities = permissions.flatMap(p => p.capabilities);

    return requiredCapabilities.every(cap => agentCapabilities.includes(cap));
  }

  private async executeCommandBasedAction(
    agentId: string, 
    command: SocialMediaCommand, 
    connectionIds: string[]
  ): Promise<ToolExecutionResult> {
    const params = command.entities || {};

    switch (command.type) {
      case 'post_create':
        return {
          success: true,
          data: await this.createTextPost(params, agentId, connectionIds)
        };

      case 'post_schedule':
        return {
          success: true,
          data: await this.schedulePost(params, agentId, connectionIds)
        };

      case 'analytics_get':
        return {
          success: true,
          data: await this.getAccountAnalytics(params, agentId, connectionIds)
        };

      case 'tiktok_video_create':
        return {
          success: true,
          data: await this.createTikTokVideo(params, agentId, connectionIds)
        };

      default:
        return {
          success: false,
          error: `Unsupported command type: ${command.type}`
        };
    }
  }

  private async logToolExecution(
    agentId: string,
    toolName: string,
    parameters: Record<string, unknown>,
    result: { success: boolean; data?: unknown; error?: string }
  ): Promise<void> {
    try {
      await this.database.logAction({
        agentId,
        connectionId: 'default', // Would be actual connection ID in production
        action: 'post', // Map all tool actions to 'post' for audit logging
        platform: SocialMediaProvider.TWITTER, // Default platform for logging
        content: {
          text: JSON.stringify(parameters),
          parameters
        },
        result: result.success ? 'success' : 'failure',
        timestamp: new Date(),
        ipAddress: '127.0.0.1', // Would be actual IP in production
        userAgent: 'SocialMediaAgentTools'
      });
    } catch (error) {
      console.error('Failed to log tool execution:', error);
    }
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