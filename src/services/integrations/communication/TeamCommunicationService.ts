/**
 * Enhanced Team Communication Service - Phase 2 of Orchestration Platform
 * 
 * Provides unified team communication across multiple platforms (Slack, Teams, Discord)
 * while maintaining platform-specific features and optimizations.
 * 
 * Following IMPLEMENTATION_GUIDELINES.md:
 * - ULID-based IDs for all entities
 * - Strict TypeScript interfaces
 * - Dependency injection pattern
 * - Comprehensive error handling
 * - Immutable data structures
 */

import { ulid } from 'ulid';
import { logger } from '../../../lib/logging';

// ============================================================================
// Team Communication Interfaces
// ============================================================================

export interface MessageParams {
  readonly content: string;
  readonly channelId?: string;
  readonly channelName?: string;
  readonly threadId?: string;
  readonly mentions?: readonly string[];
  readonly attachments?: readonly MessageAttachment[];
  readonly formatting?: {
    readonly bold?: boolean;
    readonly italic?: boolean;
    readonly code?: boolean;
    readonly codeBlock?: string; // Language for code block
  };
  readonly priority?: 'low' | 'normal' | 'high' | 'urgent';
  readonly scheduled?: Date;
  readonly ephemeral?: boolean; // Only visible to sender
}

export interface MessageAttachment {
  readonly filename: string;
  readonly content: Buffer;
  readonly contentType: string;
  readonly size: number;
  readonly description?: string;
}

export interface MessageResult {
  readonly success: boolean;
  readonly messageId?: string;
  readonly channelId?: string;
  readonly threadId?: string;
  readonly timestamp?: Date;
  readonly platform: 'slack' | 'teams' | 'discord';
  readonly error?: string;
  readonly url?: string; // Direct link to message
}

export interface Channel {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
  readonly description?: string;
  readonly type: 'public' | 'private' | 'direct' | 'group';
  readonly memberCount?: number;
  readonly isArchived: boolean;
  readonly createdAt: Date;
  readonly platform: 'slack' | 'teams' | 'discord';
  readonly permissions?: {
    readonly canSend: boolean;
    readonly canRead: boolean;
    readonly canManage: boolean;
  };
}

export interface TeamCommunicationConfig {
  readonly platforms: {
    readonly slack: {
      readonly enabled: boolean;
      readonly botToken?: string;
      readonly signingSecret?: string;
      readonly appToken?: string;
    };
    readonly teams: {
      readonly enabled: boolean;
      readonly clientId?: string;
      readonly clientSecret?: string;
      readonly tenantId?: string;
    };
    readonly discord: {
      readonly enabled: boolean;
      readonly botToken?: string;
      readonly applicationId?: string;
    };
  };
  readonly features: {
    readonly autoFormatting: boolean;
    readonly mentionTranslation: boolean;
    readonly attachmentProcessing: boolean;
    readonly threadSupport: boolean;
  };
  readonly rateLimiting: {
    readonly maxMessagesPerMinute: number;
    readonly maxMessagesPerHour: number;
  };
}

// ============================================================================
// Custom Error Types
// ============================================================================

export class TeamCommunicationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly platform?: 'slack' | 'teams' | 'discord',
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TeamCommunicationError';
  }
}

export class PlatformConnectionError extends TeamCommunicationError {
  constructor(platform: 'slack' | 'teams' | 'discord', message: string, context?: Record<string, unknown>) {
    super(`${platform} connection error: ${message}`, 'CONNECTION_ERROR', platform, context);
  }
}

export class MessageValidationError extends TeamCommunicationError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(`Message validation error: ${message}`, 'VALIDATION_ERROR', undefined, context);
  }
}

export class ChannelNotFoundError extends TeamCommunicationError {
  constructor(platform: 'slack' | 'teams' | 'discord', channelId: string, context?: Record<string, unknown>) {
    super(`Channel not found on ${platform}: ${channelId}`, 'CHANNEL_NOT_FOUND', platform, context);
  }
}

export class InsufficientPermissionsError extends TeamCommunicationError {
  constructor(platform: 'slack' | 'teams' | 'discord', action: string, context?: Record<string, unknown>) {
    super(`Insufficient permissions for ${action} on ${platform}`, 'INSUFFICIENT_PERMISSIONS', platform, context);
  }
}

// ============================================================================
// Platform-Specific Providers
// ============================================================================

export interface ITeamCommunicationProvider {
  readonly platform: 'slack' | 'teams' | 'discord';
  
  /**
   * Test connection to the platform
   */
  testConnection(): Promise<boolean>;
  
  /**
   * Send a message to a channel
   */
  sendMessage(params: MessageParams): Promise<MessageResult>;
  
  /**
   * Get list of channels the bot has access to
   */
  getChannels(userId: string): Promise<readonly Channel[]>;
  
  /**
   * Get channel by ID or name
   */
  getChannel(channelId: string): Promise<Channel | null>;
  
  /**
   * Format message content for the platform
   */
  formatMessage(content: string, formatting?: MessageParams['formatting']): string;
}

// ============================================================================
// Slack Provider Implementation
// ============================================================================

export class SlackProvider implements ITeamCommunicationProvider {
  readonly platform = 'slack' as const;
  
  constructor(
    private readonly botToken: string,
    private readonly signingSecret?: string
  ) {}

  async testConnection(): Promise<boolean> {
    try {
      // Test Slack API connection
      const response = await fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      return data.ok === true;
    } catch (error) {
      logger.error('Slack connection test failed', { error });
      return false;
    }
  }

  async sendMessage(params: MessageParams): Promise<MessageResult> {
    try {
      this.validateMessageParams(params);
      
      const payload = {
        channel: params.channelId || params.channelName,
        text: this.formatMessage(params.content, params.formatting),
        thread_ts: params.threadId,
        ...(params.attachments && { files: await this.processAttachments(params.attachments) })
      };

      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      
      if (!data.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      return {
        success: true,
        messageId: data.ts,
        channelId: data.channel,
        threadId: data.thread_ts,
        timestamp: new Date(parseFloat(data.ts) * 1000),
        platform: this.platform,
        url: `https://slack.com/archives/${data.channel}/p${data.ts.replace('.', '')}`
      };

    } catch (error) {
      logger.error('Failed to send Slack message', { error, params });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: this.platform
      };
    }
  }

  async getChannels(userId: string): Promise<readonly Channel[]> {
    try {
      const response = await fetch('https://slack.com/api/conversations.list', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.botToken}`
        }
      });

      const data = await response.json();
      
      if (!data.ok) {
        throw new Error(data.error || 'Failed to get channels');
      }

      return data.channels.map((channel: any): Channel => ({
        id: channel.id,
        name: channel.name,
        displayName: channel.name,
        description: channel.purpose?.value,
        type: channel.is_private ? 'private' : 'public',
        memberCount: channel.num_members,
        isArchived: channel.is_archived,
        createdAt: new Date(channel.created * 1000),
        platform: this.platform,
        permissions: {
          canSend: !channel.is_archived,
          canRead: true,
          canManage: false
        }
      }));

    } catch (error) {
      logger.error('Failed to get Slack channels', { error, userId });
      throw new PlatformConnectionError(this.platform, `Failed to get channels: ${error instanceof Error ? error.message : error}`);
    }
  }

  async getChannel(channelId: string): Promise<Channel | null> {
    try {
      const response = await fetch(`https://slack.com/api/conversations.info?channel=${channelId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.botToken}`
        }
      });

      const data = await response.json();
      
      if (!data.ok) {
        if (data.error === 'channel_not_found') {
          return null;
        }
        throw new Error(data.error || 'Failed to get channel');
      }

      const channel = data.channel;
      return {
        id: channel.id,
        name: channel.name,
        displayName: channel.name,
        description: channel.purpose?.value,
        type: channel.is_private ? 'private' : 'public',
        memberCount: channel.num_members,
        isArchived: channel.is_archived,
        createdAt: new Date(channel.created * 1000),
        platform: this.platform,
        permissions: {
          canSend: !channel.is_archived,
          canRead: true,
          canManage: false
        }
      };

    } catch (error) {
      logger.error('Failed to get Slack channel', { error, channelId });
      return null;
    }
  }

  formatMessage(content: string, formatting?: MessageParams['formatting']): string {
    let formatted = content;
    
    if (formatting?.bold) {
      formatted = `*${formatted}*`;
    }
    
    if (formatting?.italic) {
      formatted = `_${formatted}_`;
    }
    
    if (formatting?.code) {
      formatted = `\`${formatted}\``;
    }
    
    if (formatting?.codeBlock) {
      formatted = `\`\`\`${formatting.codeBlock}\n${formatted}\n\`\`\``;
    }
    
    return formatted;
  }

  private validateMessageParams(params: MessageParams): void {
    if (!params.content || params.content.trim().length === 0) {
      throw new MessageValidationError('Message content is required');
    }
    
    if (!params.channelId && !params.channelName) {
      throw new MessageValidationError('Either channelId or channelName is required');
    }
  }

  private async processAttachments(attachments: readonly MessageAttachment[]): Promise<any[]> {
    // Placeholder for attachment processing
    // In a real implementation, this would upload files to Slack
    return [];
  }
}

// ============================================================================
// Teams Provider Implementation (Placeholder)
// ============================================================================

export class TeamsProvider implements ITeamCommunicationProvider {
  readonly platform = 'teams' as const;
  
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly tenantId: string
  ) {}

  async testConnection(): Promise<boolean> {
    // TODO: Implement Microsoft Teams connection test
    logger.info('Teams connection test - implementation pending');
    return false;
  }

  async sendMessage(params: MessageParams): Promise<MessageResult> {
    // TODO: Implement Microsoft Teams message sending
    logger.info('Teams message sending - implementation pending', { params });
    return {
      success: false,
      error: 'Microsoft Teams integration not yet implemented',
      platform: this.platform
    };
  }

  async getChannels(userId: string): Promise<readonly Channel[]> {
    // TODO: Implement Microsoft Teams channel listing
    logger.info('Teams channel listing - implementation pending', { userId });
    return [];
  }

  async getChannel(channelId: string): Promise<Channel | null> {
    // TODO: Implement Microsoft Teams channel retrieval
    logger.info('Teams channel retrieval - implementation pending', { channelId });
    return null;
  }

  formatMessage(content: string, formatting?: MessageParams['formatting']): string {
    // TODO: Implement Teams-specific message formatting
    return content;
  }
}

// ============================================================================
// Discord Provider Implementation (Placeholder)
// ============================================================================

export class DiscordProvider implements ITeamCommunicationProvider {
  readonly platform = 'discord' as const;
  
  constructor(
    private readonly botToken: string,
    private readonly applicationId: string
  ) {}

  async testConnection(): Promise<boolean> {
    // TODO: Implement Discord connection test
    logger.info('Discord connection test - implementation pending');
    return false;
  }

  async sendMessage(params: MessageParams): Promise<MessageResult> {
    // TODO: Implement Discord message sending
    logger.info('Discord message sending - implementation pending', { params });
    return {
      success: false,
      error: 'Discord integration not yet implemented',
      platform: this.platform
    };
  }

  async getChannels(userId: string): Promise<readonly Channel[]> {
    // TODO: Implement Discord channel listing
    logger.info('Discord channel listing - implementation pending', { userId });
    return [];
  }

  async getChannel(channelId: string): Promise<Channel | null> {
    // TODO: Implement Discord channel retrieval
    logger.info('Discord channel retrieval - implementation pending', { channelId });
    return null;
  }

  formatMessage(content: string, formatting?: MessageParams['formatting']): string {
    // TODO: Implement Discord-specific message formatting
    return content;
  }
}

// ============================================================================
// Enhanced Team Communication Service
// ============================================================================

export class TeamCommunicationService {
  private readonly config: TeamCommunicationConfig;
  private readonly providers = new Map<'slack' | 'teams' | 'discord', ITeamCommunicationProvider>();
  private readonly rateLimitTracking = new Map<string, { count: number; resetTime: Date }>();

  constructor(config: TeamCommunicationConfig) {
    this.config = config;
    this.initializeProviders();
  }

  // ============================================================================
  // Provider Management
  // ============================================================================

  private initializeProviders(): void {
    // Initialize Slack provider
    if (this.config.platforms.slack.enabled && this.config.platforms.slack.botToken) {
      const slackProvider = new SlackProvider(
        this.config.platforms.slack.botToken,
        this.config.platforms.slack.signingSecret
      );
      this.providers.set('slack', slackProvider);
      logger.info('Slack provider initialized');
    }

    // Initialize Teams provider
    if (this.config.platforms.teams.enabled && this.config.platforms.teams.clientId) {
      const teamsProvider = new TeamsProvider(
        this.config.platforms.teams.clientId,
        this.config.platforms.teams.clientSecret!,
        this.config.platforms.teams.tenantId!
      );
      this.providers.set('teams', teamsProvider);
      logger.info('Teams provider initialized (implementation pending)');
    }

    // Initialize Discord provider
    if (this.config.platforms.discord.enabled && this.config.platforms.discord.botToken) {
      const discordProvider = new DiscordProvider(
        this.config.platforms.discord.botToken,
        this.config.platforms.discord.applicationId!
      );
      this.providers.set('discord', discordProvider);
      logger.info('Discord provider initialized (implementation pending)');
    }
  }

  /**
   * Send message to specified platform
   */
  async sendMessage(platform: 'slack' | 'teams' | 'discord', params: MessageParams): Promise<MessageResult> {
    const provider = this.providers.get(platform);
    
    if (!provider) {
      throw new PlatformConnectionError(platform, 'Provider not available or not configured');
    }

    // Check rate limits
    await this.checkRateLimit(platform);

    try {
      const result = await provider.sendMessage(params);
      
      if (result.success) {
        this.updateRateLimit(platform);
      }

      return result;
    } catch (error) {
      logger.error(`Failed to send message via ${platform}`, { error, params });
      throw error;
    }
  }

  /**
   * Get channels for specified platform
   */
  async getChannels(platform: 'slack' | 'teams' | 'discord', userId: string): Promise<readonly Channel[]> {
    const provider = this.providers.get(platform);
    
    if (!provider) {
      throw new PlatformConnectionError(platform, 'Provider not available or not configured');
    }

    try {
      return await provider.getChannels(userId);
    } catch (error) {
      logger.error(`Failed to get channels from ${platform}`, { error, userId });
      throw error;
    }
  }

  /**
   * Get all available channels across all platforms
   */
  async getAllChannels(userId: string): Promise<readonly Channel[]> {
    const allChannels: Channel[] = [];

    for (const [platform, provider] of this.providers) {
      try {
        const channels = await provider.getChannels(userId);
        allChannels.push(...channels);
      } catch (error) {
        logger.warn(`Failed to get channels from ${platform}`, { error, userId });
      }
    }

    return allChannels;
  }

  /**
   * Broadcast message to multiple platforms
   */
  async broadcastMessage(platforms: readonly ('slack' | 'teams' | 'discord')[], params: MessageParams): Promise<readonly MessageResult[]> {
    const results = await Promise.allSettled(
      platforms.map(platform => this.sendMessage(platform, params))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          success: false,
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
          platform: platforms[index]
        };
      }
    });
  }

  // ============================================================================
  // Rate Limiting
  // ============================================================================

  private async checkRateLimit(platform: 'slack' | 'teams' | 'discord'): Promise<void> {
    const now = new Date();
    const tracking = this.rateLimitTracking.get(platform);

    if (!tracking) {
      return; // No previous usage
    }

    if (now < tracking.resetTime && tracking.count >= this.config.rateLimiting.maxMessagesPerMinute) {
      throw new TeamCommunicationError(
        `Rate limit exceeded for ${platform}. Resets at ${tracking.resetTime.toISOString()}`,
        'RATE_LIMIT_ERROR',
        platform,
        { count: tracking.count, resetTime: tracking.resetTime }
      );
    }
  }

  private updateRateLimit(platform: 'slack' | 'teams' | 'discord'): void {
    const now = new Date();
    const resetTime = new Date(now.getTime() + 60 * 1000); // 1 minute from now
    const tracking = this.rateLimitTracking.get(platform);

    if (!tracking || now >= tracking.resetTime) {
      // Reset or initialize tracking
      this.rateLimitTracking.set(platform, { count: 1, resetTime });
    } else {
      // Increment existing tracking
      tracking.count++;
    }
  }

  // ============================================================================
  // Health Monitoring
  // ============================================================================

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    readonly status: 'healthy' | 'degraded' | 'unhealthy';
    readonly platforms: readonly {
      readonly name: string;
      readonly platform: 'slack' | 'teams' | 'discord';
      readonly status: 'healthy' | 'unhealthy';
      readonly lastChecked: Date;
    }[];
  }> {
    const platformStatuses = [];
    let healthyCount = 0;

    for (const [platform, provider] of this.providers) {
      const lastChecked = new Date();
      try {
        const isHealthy = await provider.testConnection();
        platformStatuses.push({
          name: platform.charAt(0).toUpperCase() + platform.slice(1),
          platform,
          status: isHealthy ? 'healthy' as const : 'unhealthy' as const,
          lastChecked
        });
        if (isHealthy) healthyCount++;
      } catch (error) {
        platformStatuses.push({
          name: platform.charAt(0).toUpperCase() + platform.slice(1),
          platform,
          status: 'unhealthy' as const,
          lastChecked
        });
      }
    }

    const totalProviders = this.providers.size;
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    
    if (healthyCount === totalProviders) {
      overallStatus = 'healthy';
    } else if (healthyCount > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'unhealthy';
    }

    return {
      status: overallStatus,
      platforms: platformStatuses
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createTeamCommunicationService(config?: Partial<TeamCommunicationConfig>): TeamCommunicationService {
  const defaultConfig: TeamCommunicationConfig = {
    platforms: {
      slack: {
        enabled: true,
        botToken: process.env.SLACK_BOT_TOKEN,
        signingSecret: process.env.SLACK_SIGNING_SECRET,
        appToken: process.env.SLACK_APP_TOKEN
      },
      teams: {
        enabled: false, // Disabled until implementation is complete
        clientId: process.env.TEAMS_CLIENT_ID,
        clientSecret: process.env.TEAMS_CLIENT_SECRET,
        tenantId: process.env.TEAMS_TENANT_ID
      },
      discord: {
        enabled: false, // Disabled until implementation is complete
        botToken: process.env.DISCORD_BOT_TOKEN,
        applicationId: process.env.DISCORD_APPLICATION_ID
      }
    },
    features: {
      autoFormatting: true,
      mentionTranslation: true,
      attachmentProcessing: true,
      threadSupport: true
    },
    rateLimiting: {
      maxMessagesPerMinute: 10,
      maxMessagesPerHour: 100
    }
  };

  const finalConfig = { ...defaultConfig, ...config };
  return new TeamCommunicationService(finalConfig);
} 