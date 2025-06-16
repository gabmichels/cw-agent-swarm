import { 
  ISocialMediaDatabase,
  SocialMediaConnection,
  AgentSocialMediaPermission,
  SocialMediaProvider,
  SocialMediaCapability,
  AccessLevel,
  SocialMediaError
} from './database/ISocialMediaDatabase';
import { ISocialMediaProvider, PostCreationParams, SocialMediaPost } from './providers/base/ISocialMediaProvider';
import { ulid } from 'ulid';

// Following IMPLEMENTATION_GUIDELINES.md - service orchestration pattern
export class SocialMediaService {
  private providers = new Map<SocialMediaProvider, ISocialMediaProvider>();

  constructor(
    private database: ISocialMediaDatabase,
    providers: Map<SocialMediaProvider, ISocialMediaProvider>
  ) {
    this.providers = providers;
  }

  // Connection Management
  async initiateConnection(
    provider: SocialMediaProvider,
    userId: string,
    organizationId?: string
  ): Promise<string> {
    // For now, return a placeholder auth URL since providers don't have initiateConnection method
    // This would be implemented in the OAuth flow
    return `https://auth.${provider}.com/oauth/authorize?client_id=...&redirect_uri=...`;
  }

  async getConnections(userId: string, organizationId?: string): Promise<SocialMediaConnection[]> {
    if (organizationId) {
      return this.database.getConnectionsByOrganization(organizationId);
    }
    return this.database.getConnectionsByUser(userId);
  }

  async getConnection(connectionId: string): Promise<SocialMediaConnection | null> {
    return this.database.getConnection(connectionId);
  }

  async deleteConnection(connectionId: string): Promise<void> {
    const connection = await this.database.getConnection(connectionId);
    if (!connection) {
      throw new SocialMediaError('Connection not found', 'CONNECTION_NOT_FOUND', { connectionId });
    }

    // For now, skip provider revocation since the method doesn't exist in the interface
    // TODO: Implement provider-specific revocation when needed

    // Delete from database
    await this.database.deleteConnection(connectionId);
  }

  async validateConnection(connectionId: string): Promise<boolean> {
    return this.database.validateConnection(connectionId);
  }

  // Permission Management
  async grantAgentPermission(
    agentId: string,
    connectionId: string,
    capabilities: SocialMediaCapability[],
    accessLevel: AccessLevel,
    grantedBy: string,
    restrictions?: Record<string, unknown>
  ): Promise<AgentSocialMediaPermission> {
    // Validate connection exists
    const connection = await this.database.getConnection(connectionId);
    if (!connection) {
      throw new SocialMediaError('Connection not found', 'CONNECTION_NOT_FOUND', { connectionId });
    }

    // Check if permission already exists
    const existingPermissions = await this.database.getAgentPermissions(agentId);
    const existingPermission = existingPermissions.find(p => p.connectionId === connectionId);

    if (existingPermission) {
      // Update existing permission
      return this.database.updatePermission(existingPermission.id, {
        capabilities,
        accessLevel,
        restrictions,
        isActive: true
      });
    }

    // Create new permission
    return this.database.grantPermission({
      agentId,
      connectionId,
      capabilities,
      accessLevel,
      restrictions: restrictions || {},
      grantedBy,
      isActive: true
    });
  }

  async revokeAgentPermission(agentId: string, connectionId: string): Promise<void> {
    const permissions = await this.database.getAgentPermissions(agentId);
    const permission = permissions.find(p => p.connectionId === connectionId);
    
    if (permission) {
      await this.database.revokePermission(permission.id);
    }
  }

  async getAgentPermissions(agentId: string): Promise<AgentSocialMediaPermission[]> {
    return this.database.getAgentPermissions(agentId);
  }

  async validateAgentPermissions(
    agentId: string,
    connectionId: string,
    requiredCapabilities: SocialMediaCapability[]
  ): Promise<boolean> {
    return this.database.validatePermissions(agentId, connectionId, requiredCapabilities);
  }

  // Content Management
  async createPost(
    agentId: string,
    connectionId: string,
    params: PostCreationParams
  ): Promise<SocialMediaPost> {
    // Validate agent permissions
    const hasPermission = await this.validateAgentPermissions(
      agentId,
      connectionId,
      [SocialMediaCapability.POST_CREATE]
    );

    if (!hasPermission) {
      throw new SocialMediaError(
        'Agent does not have permission to create posts',
        'INSUFFICIENT_PERMISSIONS',
        { agentId, connectionId }
      );
    }

    // Get connection and provider
    const connection = await this.database.getConnection(connectionId);
    if (!connection) {
      throw new SocialMediaError('Connection not found', 'CONNECTION_NOT_FOUND', { connectionId });
    }

    const provider = this.getProvider(connection.provider);
    
    try {
      // Create post through provider
      const post = await provider.createPost(connectionId, params);

      // Log the action
      await this.database.logAction({
        timestamp: new Date(),
        agentId,
        connectionId,
        action: 'post',
        platform: connection.provider,
        content: {
          text: params.content,
          hashtags: params.hashtags,
          media: params.media ? params.media.map(m => m.type) : []
        },
        result: 'success',
        ipAddress: 'system',
        userAgent: 'AgentSwarm/1.0',
        metadata: {
          postId: post.id,
          platform: connection.provider
        }
      });

      return post;
    } catch (error) {
      // Log the failed action
      await this.database.logAction({
        timestamp: new Date(),
        agentId,
        connectionId,
        action: 'post',
        platform: connection.provider,
        result: 'failure',
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: 'system',
        userAgent: 'AgentSwarm/1.0',
        metadata: {
          params
        }
      });

      throw error;
    }
  }

  async getPost(connectionId: string, postId: string): Promise<SocialMediaPost> {
    const connection = await this.database.getConnection(connectionId);
    if (!connection) {
      throw new SocialMediaError('Connection not found', 'CONNECTION_NOT_FOUND', { connectionId });
    }

    const provider = this.getProvider(connection.provider);
    return provider.getPost(connectionId, postId);
  }

  async deletePost(
    agentId: string,
    connectionId: string,
    postId: string
  ): Promise<void> {
    // Validate agent permissions
    const hasPermission = await this.validateAgentPermissions(
      agentId,
      connectionId,
      [SocialMediaCapability.POST_DELETE]
    );

    if (!hasPermission) {
      throw new SocialMediaError(
        'Agent does not have permission to delete posts',
        'INSUFFICIENT_PERMISSIONS',
        { agentId, connectionId }
      );
    }

    const connection = await this.database.getConnection(connectionId);
    if (!connection) {
      throw new SocialMediaError('Connection not found', 'CONNECTION_NOT_FOUND', { connectionId });
    }

    const provider = this.getProvider(connection.provider);
    
    try {
      await provider.deletePost(connectionId, postId);

      // Log the action
      await this.database.logAction({
        timestamp: new Date(),
        agentId,
        connectionId,
        action: 'delete',
        platform: connection.provider,
        result: 'success',
        ipAddress: 'system',
        userAgent: 'AgentSwarm/1.0',
        metadata: {
          postId
        }
      });
    } catch (error) {
      // Log the failed action
      await this.database.logAction({
        timestamp: new Date(),
        agentId,
        connectionId,
        action: 'delete',
        platform: connection.provider,
        result: 'failure',
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: 'system',
        userAgent: 'AgentSwarm/1.0',
        metadata: {
          postId
        }
      });

      throw error;
    }
  }

  // Analytics and Insights
  async getConnectionHealth(): Promise<{
    totalConnections: number;
    activeConnections: number;
    expiredConnections: number;
    errorConnections: number;
    byProvider: Record<SocialMediaProvider, number>;
  }> {
    return this.database.getConnectionHealth();
  }

  async getAuditLogs(filters: {
    agentId?: string;
    connectionId?: string;
    platform?: SocialMediaProvider;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    return this.database.getAuditLogs(filters);
  }

  // Platform-specific features
  async getTikTokTrendingHashtags(region?: string): Promise<Array<{
    hashtag: string;
    postCount: number;
    trend: 'rising' | 'stable' | 'declining';
  }>> {
    const tiktokProvider = this.providers.get(SocialMediaProvider.TIKTOK);
    if (!tiktokProvider) {
      throw new SocialMediaError('TikTok provider not available', 'PROVIDER_NOT_AVAILABLE');
    }

    // Cast to TikTok provider to access specific methods
    const provider = tiktokProvider as any;
    if (provider.getTrendingHashtags) {
      return provider.getTrendingHashtags(region);
    }

    throw new SocialMediaError('TikTok trending hashtags not supported', 'FEATURE_NOT_SUPPORTED');
  }

  async uploadTikTokVideo(
    agentId: string,
    connectionId: string,
    params: {
      videoFile: Buffer;
      title: string;
      description?: string;
      hashtags?: string[];
      privacy: 'public' | 'friends' | 'private';
      allowComments: boolean;
      allowDuet: boolean;
      allowStitch: boolean;
    }
  ): Promise<SocialMediaPost> {
    // Validate agent permissions
    const hasPermission = await this.validateAgentPermissions(
      agentId,
      connectionId,
      [SocialMediaCapability.TIKTOK_VIDEO_CREATE]
    );

    if (!hasPermission) {
      throw new SocialMediaError(
        'Agent does not have permission to create TikTok videos',
        'INSUFFICIENT_PERMISSIONS',
        { agentId, connectionId }
      );
    }

    const connection = await this.database.getConnection(connectionId);
    if (!connection || connection.provider !== SocialMediaProvider.TIKTOK) {
      throw new SocialMediaError('TikTok connection not found', 'CONNECTION_NOT_FOUND', { connectionId });
    }

    const tiktokProvider = this.providers.get(SocialMediaProvider.TIKTOK);
    if (!tiktokProvider) {
      throw new SocialMediaError('TikTok provider not available', 'PROVIDER_NOT_AVAILABLE');
    }

    try {
      // Cast to TikTok provider to access specific methods
      const provider = tiktokProvider as any;
      const post = await provider.uploadVideo(connectionId, params);

      // Log the action
      await this.database.logAction({
        timestamp: new Date(),
        agentId,
        connectionId,
        action: 'post',
        platform: SocialMediaProvider.TIKTOK,
        content: {
          text: params.description,
          hashtags: params.hashtags,
          media: ['video']
        },
        result: 'success',
        ipAddress: 'system',
        userAgent: 'AgentSwarm/1.0',
        metadata: {
          postId: post.id,
          platform: 'tiktok',
          videoTitle: params.title
        }
      });

      return post;
    } catch (error) {
      // Log the failed action
      await this.database.logAction({
        timestamp: new Date(),
        agentId,
        connectionId,
        action: 'post',
        platform: SocialMediaProvider.TIKTOK,
        result: 'failure',
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: 'system',
        userAgent: 'AgentSwarm/1.0',
        metadata: {
          params
        }
      });

      throw error;
    }
  }

  // Utility methods
  private getProvider(provider: SocialMediaProvider): ISocialMediaProvider {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) {
      throw new SocialMediaError(
        `Provider ${provider} not available`,
        'PROVIDER_NOT_AVAILABLE',
        { provider }
      );
    }
    return providerInstance;
  }

  // Maintenance and cleanup
  async cleanupExpiredConnections(): Promise<number> {
    return this.database.cleanupExpiredConnections();
  }

  async refreshExpiredTokens(): Promise<void> {
    const connections = await this.database.getConnectionHealth();
    
    // This would iterate through connections and refresh tokens as needed
    // Implementation would depend on specific provider requirements
    console.log('Token refresh not yet implemented');
  }

  // Agent tool integration
  async getAvailableCapabilities(agentId: string): Promise<{
    connectionId: string;
    provider: SocialMediaProvider;
    accountName: string;
    capabilities: SocialMediaCapability[];
    accessLevel: AccessLevel;
  }[]> {
    const permissions = await this.database.getAgentPermissions(agentId);
    const result = [];

    for (const permission of permissions) {
      if (!permission.isActive) continue;

      const connection = await this.database.getConnection(permission.connectionId);
      if (!connection) continue;

      result.push({
        connectionId: connection.id,
        provider: connection.provider,
        accountName: connection.accountDisplayName,
        capabilities: permission.capabilities,
        accessLevel: permission.accessLevel
      });
    }

    return result;
  }

  // Content optimization and analysis
  async optimizeContentForPlatform(
    content: string,
    provider: SocialMediaProvider
  ): Promise<{
    originalContent: string;
    optimizedContent: string;
    suggestions: string[];
    platformLimits: {
      characterLimit: number;
      hashtagLimit: number;
      mediaLimit: number;
    };
  }> {
    const platformLimits = this.getPlatformLimits(provider);
    let optimizedContent = content;
    const suggestions: string[] = [];

    // Platform-specific optimizations
    switch (provider) {
      case SocialMediaProvider.TWITTER:
        if (content.length > 280) {
          optimizedContent = content.substring(0, 277) + '...';
          suggestions.push('Content truncated to fit Twitter character limit');
        }
        break;

      case SocialMediaProvider.LINKEDIN:
        if (content.length > 3000) {
          optimizedContent = content.substring(0, 2997) + '...';
          suggestions.push('Content truncated to fit LinkedIn character limit');
        }
        break;

      case SocialMediaProvider.TIKTOK:
        if (content.length > 2200) {
          optimizedContent = content.substring(0, 2197) + '...';
          suggestions.push('Content truncated to fit TikTok character limit');
        }
        // Add trending hashtags suggestion
        suggestions.push('Consider adding trending hashtags for better discoverability');
        break;

      default:
        break;
    }

    return {
      originalContent: content,
      optimizedContent,
      suggestions,
      platformLimits
    };
  }

  private getPlatformLimits(provider: SocialMediaProvider) {
    switch (provider) {
      case SocialMediaProvider.TWITTER:
        return { characterLimit: 280, hashtagLimit: 10, mediaLimit: 4 };
      case SocialMediaProvider.LINKEDIN:
        return { characterLimit: 3000, hashtagLimit: 30, mediaLimit: 20 };
      case SocialMediaProvider.FACEBOOK:
        return { characterLimit: 63206, hashtagLimit: 30, mediaLimit: 10 };
      case SocialMediaProvider.INSTAGRAM:
        return { characterLimit: 2200, hashtagLimit: 30, mediaLimit: 10 };
      case SocialMediaProvider.REDDIT:
        return { characterLimit: 40000, hashtagLimit: 0, mediaLimit: 20 };
      case SocialMediaProvider.TIKTOK:
        return { characterLimit: 2200, hashtagLimit: 100, mediaLimit: 1 };
      default:
        return { characterLimit: 1000, hashtagLimit: 10, mediaLimit: 4 };
    }
  }
} 