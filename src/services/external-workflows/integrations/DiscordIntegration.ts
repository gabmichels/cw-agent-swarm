/**
 * Discord Integration - Phase 2 Strategic Integration
 * 
 * Comprehensive Discord integration combining existing notification functionality
 * with advanced features including server management, voice channels, webhooks,
 * and bot interactions.
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
import { 
  ExternalWorkflowError,
  WorkflowExecutionError,
  WorkflowValidationError,
  WorkflowConnectionError
} from '../errors/ExternalWorkflowErrors';

// Import existing Discord notification functionality
import { notifyDiscord } from '../../../agents/shared/notifications/utils/discordUtils';

// ============================================================================
// Discord Integration Interfaces
// ============================================================================

export interface DiscordConfig {
  readonly botToken: string;
  readonly applicationId: string;
  readonly publicKey?: string;
  readonly guildId?: string;
  readonly defaultChannelId?: string;
  readonly permissions?: readonly string[];
}

export interface DiscordMessageParams {
  readonly channelId: string;
  readonly content?: string;
  readonly embeds?: readonly DiscordEmbed[];
  readonly files?: readonly DiscordFile[];
  readonly components?: readonly DiscordComponent[];
  readonly allowedMentions?: {
    readonly parse?: readonly ('roles' | 'users' | 'everyone')[];
    readonly roles?: readonly string[];
    readonly users?: readonly string[];
    readonly repliedUser?: boolean;
  };
  readonly messageReference?: {
    readonly messageId: string;
    readonly channelId?: string;
    readonly guildId?: string;
    readonly failIfNotExists?: boolean;
  };
  readonly flags?: number;
  readonly stickers?: readonly string[];
  readonly tts?: boolean;
}

export interface DiscordEmbed {
  readonly title?: string;
  readonly type?: 'rich' | 'image' | 'video' | 'gifv' | 'article' | 'link';
  readonly description?: string;
  readonly url?: string;
  readonly timestamp?: Date;
  readonly color?: number;
  readonly footer?: {
    readonly text: string;
    readonly iconUrl?: string;
    readonly proxyIconUrl?: string;
  };
  readonly image?: {
    readonly url: string;
    readonly proxyUrl?: string;
    readonly height?: number;
    readonly width?: number;
  };
  readonly thumbnail?: {
    readonly url: string;
    readonly proxyUrl?: string;
    readonly height?: number;
    readonly width?: number;
  };
  readonly video?: {
    readonly url?: string;
    readonly proxyUrl?: string;
    readonly height?: number;
    readonly width?: number;
  };
  readonly provider?: {
    readonly name?: string;
    readonly url?: string;
  };
  readonly author?: {
    readonly name: string;
    readonly url?: string;
    readonly iconUrl?: string;
    readonly proxyIconUrl?: string;
  };
  readonly fields?: readonly {
    readonly name: string;
    readonly value: string;
    readonly inline?: boolean;
  }[];
}

export interface DiscordFile {
  readonly filename: string;
  readonly contentType?: string;
  readonly data: Buffer;
  readonly description?: string;
  readonly spoiler?: boolean;
}

export interface DiscordComponent {
  readonly type: 1 | 2 | 3 | 4 | 5; // ActionRow, Button, SelectMenu, TextInput, UserSelect
  readonly style?: 1 | 2 | 3 | 4 | 5; // Primary, Secondary, Success, Danger, Link
  readonly label?: string;
  readonly emoji?: {
    readonly id?: string;
    readonly name?: string;
    readonly animated?: boolean;
  };
  readonly customId?: string;
  readonly url?: string;
  readonly disabled?: boolean;
  readonly components?: readonly DiscordComponent[];
}

export interface DiscordMessageResult {
  readonly success: boolean;
  readonly messageId?: string;
  readonly channelId?: string;
  readonly guildId?: string;
  readonly timestamp?: Date;
  readonly editedTimestamp?: Date;
  readonly messageUrl?: string;
  readonly error?: string;
}

export interface DiscordChannel {
  readonly id: string;
  readonly type: 0 | 1 | 2 | 3 | 4 | 5 | 10 | 11 | 12 | 13 | 14 | 15 | 16; // Guild text, DM, Guild voice, etc.
  readonly guildId?: string;
  readonly position?: number;
  readonly permissionOverwrites?: readonly DiscordPermissionOverwrite[];
  readonly name?: string;
  readonly topic?: string;
  readonly nsfw?: boolean;
  readonly lastMessageId?: string;
  readonly bitrate?: number;
  readonly userLimit?: number;
  readonly rateLimitPerUser?: number;
  readonly recipients?: readonly DiscordUser[];
  readonly icon?: string;
  readonly ownerId?: string;
  readonly applicationId?: string;
  readonly parentId?: string;
  readonly lastPinTimestamp?: Date;
  readonly rtcRegion?: string;
  readonly videoQualityMode?: 1 | 2; // Auto, Full
  readonly messageCount?: number;
  readonly memberCount?: number;
  readonly threadMetadata?: {
    readonly archived: boolean;
    readonly autoArchiveDuration: 60 | 1440 | 4320 | 10080;
    readonly archiveTimestamp: Date;
    readonly locked: boolean;
    readonly invitable?: boolean;
    readonly createTimestamp?: Date;
  };
  readonly member?: {
    readonly id?: string;
    readonly userId?: string;
    readonly joinTimestamp: Date;
    readonly flags: number;
  };
  readonly defaultAutoArchiveDuration?: 60 | 1440 | 4320 | 10080;
  readonly permissions?: string;
  readonly flags?: number;
  readonly totalMessageSent?: number;
}

export interface DiscordPermissionOverwrite {
  readonly id: string;
  readonly type: 0 | 1; // Role, Member
  readonly allow: string;
  readonly deny: string;
}

export interface DiscordGuild {
  readonly id: string;
  readonly name: string;
  readonly icon?: string;
  readonly iconHash?: string;
  readonly splash?: string;
  readonly discoverySplash?: string;
  readonly owner?: boolean;
  readonly ownerId: string;
  readonly permissions?: string;
  readonly region?: string;
  readonly afkChannelId?: string;
  readonly afkTimeout: number;
  readonly widgetEnabled?: boolean;
  readonly widgetChannelId?: string;
  readonly verificationLevel: 0 | 1 | 2 | 3 | 4;
  readonly defaultMessageNotifications: 0 | 1;
  readonly explicitContentFilter: 0 | 1 | 2;
  readonly roles: readonly DiscordRole[];
  readonly emojis: readonly DiscordEmoji[];
  readonly features: readonly string[];
  readonly mfaLevel: 0 | 1;
  readonly applicationId?: string;
  readonly systemChannelId?: string;
  readonly systemChannelFlags: number;
  readonly rulesChannelId?: string;
  readonly maxPresences?: number;
  readonly maxMembers?: number;
  readonly vanityUrlCode?: string;
  readonly description?: string;
  readonly banner?: string;
  readonly premiumTier: 0 | 1 | 2 | 3;
  readonly premiumSubscriptionCount?: number;
  readonly preferredLocale: string;
  readonly publicUpdatesChannelId?: string;
  readonly maxVideoChannelUsers?: number;
  readonly approximateMemberCount?: number;
  readonly approximatePresenceCount?: number;
  readonly welcomeScreen?: {
    readonly description?: string;
    readonly welcomeChannels: readonly {
      readonly channelId: string;
      readonly description: string;
      readonly emojiId?: string;
      readonly emojiName?: string;
    }[];
  };
  readonly nsfwLevel: 0 | 1 | 2 | 3;
  readonly stickers?: readonly DiscordSticker[];
  readonly premiumProgressBarEnabled: boolean;
}

export interface DiscordRole {
  readonly id: string;
  readonly name: string;
  readonly color: number;
  readonly hoist: boolean;
  readonly icon?: string;
  readonly unicodeEmoji?: string;
  readonly position: number;
  readonly permissions: string;
  readonly managed: boolean;
  readonly mentionable: boolean;
  readonly tags?: {
    readonly botId?: string;
    readonly integrationId?: string;
    readonly premiumSubscriber?: null;
    readonly subscriptionListingId?: string;
    readonly availableForPurchase?: null;
    readonly guildConnections?: null;
  };
}

export interface DiscordUser {
  readonly id: string;
  readonly username: string;
  readonly discriminator: string;
  readonly avatar?: string;
  readonly bot?: boolean;
  readonly system?: boolean;
  readonly mfaEnabled?: boolean;
  readonly banner?: string;
  readonly accentColor?: number;
  readonly locale?: string;
  readonly verified?: boolean;
  readonly email?: string;
  readonly flags?: number;
  readonly premiumType?: 0 | 1 | 2;
  readonly publicFlags?: number;
}

export interface DiscordMember {
  readonly user?: DiscordUser;
  readonly nick?: string;
  readonly avatar?: string;
  readonly roles: readonly string[];
  readonly joinedAt: Date;
  readonly premiumSince?: Date;
  readonly deaf: boolean;
  readonly mute: boolean;
  readonly flags: number;
  readonly pending?: boolean;
  readonly permissions?: string;
  readonly communicationDisabledUntil?: Date;
}

export interface DiscordEmoji {
  readonly id?: string;
  readonly name?: string;
  readonly roles?: readonly string[];
  readonly user?: DiscordUser;
  readonly requireColons?: boolean;
  readonly managed?: boolean;
  readonly animated?: boolean;
  readonly available?: boolean;
}

export interface DiscordSticker {
  readonly id: string;
  readonly packId?: string;
  readonly name: string;
  readonly description?: string;
  readonly tags: string;
  readonly asset?: string;
  readonly type: 1 | 2; // Standard, Guild
  readonly formatType: 1 | 2 | 3 | 4; // PNG, APNG, LOTTIE, GIF
  readonly available?: boolean;
  readonly guildId?: string;
  readonly user?: DiscordUser;
  readonly sortValue?: number;
}

export interface DiscordWebhook {
  readonly id: string;
  readonly type: 1 | 2 | 3; // Incoming, Channel Follower, Application
  readonly guildId?: string;
  readonly channelId?: string;
  readonly user?: DiscordUser;
  readonly name?: string;
  readonly avatar?: string;
  readonly token?: string;
  readonly applicationId?: string;
  readonly sourceGuild?: Partial<DiscordGuild>;
  readonly sourceChannel?: Partial<DiscordChannel>;
  readonly url?: string;
}

// ============================================================================
// Custom Error Types
// ============================================================================

export class DiscordIntegrationError extends ExternalWorkflowError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'DISCORD_INTEGRATION_ERROR', context);
    this.name = 'DiscordIntegrationError';
  }
}

export class DiscordAuthenticationError extends DiscordIntegrationError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(`Authentication failed: ${message}`, context);
    this.name = 'DiscordAuthenticationError';
  }
}

export class DiscordChannelError extends DiscordIntegrationError {
  constructor(message: string, channelId?: string, context?: Record<string, unknown>) {
    super(`Channel error: ${message}`, { ...context, channelId });
    this.name = 'DiscordChannelError';
  }
}

export class DiscordPermissionError extends DiscordIntegrationError {
  constructor(message: string, permission?: string, context?: Record<string, unknown>) {
    super(`Permission error: ${message}`, { ...context, permission });
    this.name = 'DiscordPermissionError';
  }
}

export class DiscordRateLimitError extends DiscordIntegrationError {
  constructor(retryAfter: number, context?: Record<string, unknown>) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds`, { ...context, retryAfter });
    this.name = 'DiscordRateLimitError';
  }
}

// ============================================================================
// Discord Integration Service
// ============================================================================

export class DiscordIntegration {
  private readonly baseUrl = 'https://discord.com/api/v10';
  private client: any = null;
  private ready = false;

  constructor(
    private readonly config: DiscordConfig,
    private readonly httpClient: {
      get: (url: string, headers?: Record<string, string>) => Promise<any>;
      post: (url: string, data?: any, headers?: Record<string, string>) => Promise<any>;
      put: (url: string, data?: any, headers?: Record<string, string>) => Promise<any>;
      delete: (url: string, headers?: Record<string, string>) => Promise<any>;
      patch: (url: string, data?: any, headers?: Record<string, string>) => Promise<any>;
    } = {
      get: async (url, headers) => {
        const response = await fetch(url, { headers });
        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '1');
            throw new DiscordRateLimitError(retryAfter);
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      },
      post: async (url, data, headers) => {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: data ? JSON.stringify(data) : undefined
        });
        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '1');
            throw new DiscordRateLimitError(retryAfter);
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      },
      put: async (url, data, headers) => {
        const response = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: data ? JSON.stringify(data) : undefined
        });
        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '1');
            throw new DiscordRateLimitError(retryAfter);
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      },
      delete: async (url, headers) => {
        const response = await fetch(url, { method: 'DELETE', headers });
        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '1');
            throw new DiscordRateLimitError(retryAfter);
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.ok;
      },
      patch: async (url, data, headers) => {
        const response = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: data ? JSON.stringify(data) : undefined
        });
        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '1');
            throw new DiscordRateLimitError(retryAfter);
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      }
    }
  ) {
    this.validateConfig();
  }

  /**
   * Initialize Discord client connection
   */
  async initialize(): Promise<boolean> {
    try {
      this.validateConfig();

      logger.info('Initializing Discord integration...', {
        applicationId: this.config.applicationId,
        guildId: this.config.guildId
      });

      // Test bot token by getting bot user info
      const botUser = await this.httpClient.get(
        `${this.baseUrl}/users/@me`,
        this.getAuthHeaders()
      );

      logger.info('Discord bot authenticated successfully', {
        botId: botUser.id,
        botUsername: botUser.username
      });

      this.ready = true;
      return true;
    } catch (error) {
      logger.error('Discord initialization failed', { error });
      throw new DiscordAuthenticationError(
        `Discord initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error }
      );
    }
  }

  /**
   * Test connection to Discord API
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.httpClient.get(
        `${this.baseUrl}/users/@me`,
        this.getAuthHeaders()
      );

      return response && response.id !== undefined;
    } catch (error) {
      logger.error('Discord connection test failed', { error });
      return false;
    }
  }

  /**
   * Send a message to a Discord channel
   * Combines new functionality with existing notification system
   */
  async sendMessage(params: DiscordMessageParams): Promise<DiscordMessageResult> {
    try {
      // For simple text messages, use existing notification system
      if (params.content && !params.embeds && !params.files && !params.components) {
        const success = await notifyDiscord(params.content, 'info');
        return {
          success,
          channelId: params.channelId,
          timestamp: new Date(),
          error: success ? undefined : 'Failed to send via notification system'
        };
      }

      // For complex messages, use REST API
      this.validateMessageParams(params);

      const messageData = this.buildMessageData(params);
      
      const response = await this.httpClient.post(
        `${this.baseUrl}/channels/${params.channelId}/messages`,
        messageData,
        this.getAuthHeaders()
      );

      logger.info('Discord message sent successfully', {
        messageId: response.id,
        channelId: params.channelId,
        guildId: response.guild_id
      });

      return {
        success: true,
        messageId: response.id,
        channelId: response.channel_id,
        guildId: response.guild_id,
        timestamp: new Date(response.timestamp),
        editedTimestamp: response.edited_timestamp ? new Date(response.edited_timestamp) : undefined,
        messageUrl: `https://discord.com/channels/${response.guild_id || '@me'}/${response.channel_id}/${response.id}`
      };
    } catch (error) {
      logger.error('Failed to send Discord message', { error, params });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get guild information
   */
  async getGuild(guildId: string): Promise<DiscordGuild> {
    try {
      const response = await this.httpClient.get(
        `${this.baseUrl}/guilds/${guildId}?with_counts=true`,
        this.getAuthHeaders()
      );

      return this.mapToDiscordGuild(response);
    } catch (error) {
      logger.error('Failed to get guild information', { error, guildId });
      throw new DiscordIntegrationError('Failed to retrieve guild information', { guildId, originalError: error });
    }
  }

  /**
   * Get channels in a guild
   */
  async getGuildChannels(guildId: string): Promise<readonly DiscordChannel[]> {
    try {
      const response = await this.httpClient.get(
        `${this.baseUrl}/guilds/${guildId}/channels`,
        this.getAuthHeaders()
      );

      return response.map((channel: any) => this.mapToDiscordChannel(channel));
    } catch (error) {
      logger.error('Failed to get guild channels', { error, guildId });
      throw new DiscordChannelError('Failed to retrieve guild channels', undefined, { guildId, originalError: error });
    }
  }

  /**
   * Create a webhook
   */
  async createWebhook(channelId: string, name: string, avatar?: string): Promise<DiscordWebhook> {
    try {
      const webhookData: any = { name };
      if (avatar) webhookData.avatar = avatar;

      const response = await this.httpClient.post(
        `${this.baseUrl}/channels/${channelId}/webhooks`,
        webhookData,
        this.getAuthHeaders()
      );

      logger.info('Discord webhook created successfully', {
        webhookId: response.id,
        channelId,
        name
      });

      return this.mapToDiscordWebhook(response);
    } catch (error) {
      logger.error('Failed to create Discord webhook', { error, channelId, name });
      throw new DiscordIntegrationError('Failed to create webhook', { channelId, name, originalError: error });
    }
  }

  /**
   * Execute a webhook
   */
  async executeWebhook(webhookId: string, webhookToken: string, params: {
    readonly content?: string;
    readonly username?: string;
    readonly avatarUrl?: string;
    readonly tts?: boolean;
    readonly embeds?: readonly DiscordEmbed[];
    readonly allowedMentions?: DiscordMessageParams['allowedMentions'];
    readonly components?: readonly DiscordComponent[];
    readonly files?: readonly DiscordFile[];
    readonly threadId?: string;
  }): Promise<DiscordMessageResult> {
    try {
      const webhookData = this.buildWebhookData(params);
      
      let url = `${this.baseUrl}/webhooks/${webhookId}/${webhookToken}?wait=true`;
      if (params.threadId) {
        url += `&thread_id=${params.threadId}`;
      }

      const response = await this.httpClient.post(url, webhookData);

      logger.info('Discord webhook executed successfully', {
        webhookId,
        messageId: response.id
      });

      return {
        success: true,
        messageId: response.id,
        channelId: response.channel_id,
        guildId: response.guild_id,
        timestamp: new Date(response.timestamp)
      };
    } catch (error) {
      logger.error('Failed to execute Discord webhook', { error, webhookId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get guild members
   */
  async getGuildMembers(guildId: string, options: {
    readonly limit?: number;
    readonly after?: string;
  } = {}): Promise<readonly DiscordMember[]> {
    try {
      const queryParams = new URLSearchParams();
      if (options.limit) queryParams.set('limit', options.limit.toString());
      if (options.after) queryParams.set('after', options.after);

      const url = `${this.baseUrl}/guilds/${guildId}/members?${queryParams.toString()}`;
      const response = await this.httpClient.get(url, this.getAuthHeaders());

      return response.map((member: any) => this.mapToDiscordMember(member));
    } catch (error) {
      logger.error('Failed to get guild members', { error, guildId });
      throw new DiscordIntegrationError('Failed to retrieve guild members', { guildId, originalError: error });
    }
  }

  // ============================================================================
  // Legacy Notification System Integration
  // ============================================================================

  /**
   * Send a simple notification using the existing notification system
   * This maintains backward compatibility with existing Discord notifications
   */
  async sendNotification(message: string, type: string = 'info', mention?: string): Promise<boolean> {
    try {
      return await notifyDiscord(message, type, mention);
    } catch (error) {
      logger.error('Failed to send Discord notification', { error, message, type });
      return false;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private validateConfig(): void {
    const required = ['botToken', 'applicationId'];
    const missing = required.filter(key => !this.config[key as keyof DiscordConfig]);
    
    if (missing.length > 0) {
      throw new WorkflowValidationError(
        'discord-config-validation',
        [`Missing required Discord configuration: ${missing.join(', ')}`]
      );
    }
  }

  private getAuthHeaders(): Record<string, string> {
    return {
      'Authorization': `Bot ${this.config.botToken}`,
      'Content-Type': 'application/json'
    };
  }

  private validateMessageParams(params: DiscordMessageParams): void {
    if (!params.channelId?.trim()) {
      throw new WorkflowValidationError('discord-message-validation', ['Channel ID cannot be empty']);
    }

    if (!params.content?.trim() && !params.embeds?.length && !params.files?.length) {
      throw new WorkflowValidationError('discord-message-validation', ['Message must have content, embeds, or files']);
    }
  }

  private buildMessageData(params: DiscordMessageParams): any {
    const data: any = {};
    
    if (params.content) data.content = params.content;
    if (params.embeds) data.embeds = params.embeds;
    if (params.components) data.components = params.components;
    if (params.allowedMentions) data.allowed_mentions = params.allowedMentions;
    if (params.messageReference) data.message_reference = params.messageReference;
    if (params.flags) data.flags = params.flags;
    if (params.stickers) data.sticker_ids = params.stickers;
    if (params.tts) data.tts = params.tts;

    return data;
  }

  private buildWebhookData(params: {
    readonly content?: string;
    readonly username?: string;
    readonly avatarUrl?: string;
    readonly tts?: boolean;
    readonly embeds?: readonly DiscordEmbed[];
    readonly allowedMentions?: DiscordMessageParams['allowedMentions'];
    readonly components?: readonly DiscordComponent[];
    readonly files?: readonly DiscordFile[];
  }): any {
    const data: any = {};
    
    if (params.content) data.content = params.content;
    if (params.username) data.username = params.username;
    if (params.avatarUrl) data.avatar_url = params.avatarUrl;
    if (params.tts) data.tts = params.tts;
    if (params.embeds) data.embeds = params.embeds;
    if (params.allowedMentions) data.allowed_mentions = params.allowedMentions;
    if (params.components) data.components = params.components;

    return data;
  }

  private mapToDiscordGuild(data: any): DiscordGuild {
    return {
      id: data.id,
      name: data.name,
      icon: data.icon,
      iconHash: data.icon_hash,
      splash: data.splash,
      discoverySplash: data.discovery_splash,
      owner: data.owner,
      ownerId: data.owner_id,
      permissions: data.permissions,
      region: data.region,
      afkChannelId: data.afk_channel_id,
      afkTimeout: data.afk_timeout,
      widgetEnabled: data.widget_enabled,
      widgetChannelId: data.widget_channel_id,
      verificationLevel: data.verification_level,
      defaultMessageNotifications: data.default_message_notifications,
      explicitContentFilter: data.explicit_content_filter,
      roles: data.roles?.map((role: any) => this.mapToDiscordRole(role)) || [],
      emojis: data.emojis?.map((emoji: any) => this.mapToDiscordEmoji(emoji)) || [],
      features: data.features || [],
      mfaLevel: data.mfa_level,
      applicationId: data.application_id,
      systemChannelId: data.system_channel_id,
      systemChannelFlags: data.system_channel_flags,
      rulesChannelId: data.rules_channel_id,
      maxPresences: data.max_presences,
      maxMembers: data.max_members,
      vanityUrlCode: data.vanity_url_code,
      description: data.description,
      banner: data.banner,
      premiumTier: data.premium_tier,
      premiumSubscriptionCount: data.premium_subscription_count,
      preferredLocale: data.preferred_locale,
      publicUpdatesChannelId: data.public_updates_channel_id,
      maxVideoChannelUsers: data.max_video_channel_users,
      approximateMemberCount: data.approximate_member_count,
      approximatePresenceCount: data.approximate_presence_count,
      welcomeScreen: data.welcome_screen,
      nsfwLevel: data.nsfw_level,
      stickers: data.stickers?.map((sticker: any) => this.mapToDiscordSticker(sticker)),
      premiumProgressBarEnabled: data.premium_progress_bar_enabled || false
    };
  }

  private mapToDiscordChannel(data: any): DiscordChannel {
    return {
      id: data.id,
      type: data.type,
      guildId: data.guild_id,
      position: data.position,
      permissionOverwrites: data.permission_overwrites?.map((overwrite: any) => ({
        id: overwrite.id,
        type: overwrite.type,
        allow: overwrite.allow,
        deny: overwrite.deny
      })),
      name: data.name,
      topic: data.topic,
      nsfw: data.nsfw,
      lastMessageId: data.last_message_id,
      bitrate: data.bitrate,
      userLimit: data.user_limit,
      rateLimitPerUser: data.rate_limit_per_user,
      recipients: data.recipients?.map((user: any) => this.mapToDiscordUser(user)),
      icon: data.icon,
      ownerId: data.owner_id,
      applicationId: data.application_id,
      parentId: data.parent_id,
      lastPinTimestamp: data.last_pin_timestamp ? new Date(data.last_pin_timestamp) : undefined,
      rtcRegion: data.rtc_region,
      videoQualityMode: data.video_quality_mode,
      messageCount: data.message_count,
      memberCount: data.member_count,
      threadMetadata: data.thread_metadata ? {
        archived: data.thread_metadata.archived,
        autoArchiveDuration: data.thread_metadata.auto_archive_duration,
        archiveTimestamp: new Date(data.thread_metadata.archive_timestamp),
        locked: data.thread_metadata.locked,
        invitable: data.thread_metadata.invitable,
        createTimestamp: data.thread_metadata.create_timestamp ? new Date(data.thread_metadata.create_timestamp) : undefined
      } : undefined,
      member: data.member ? {
        id: data.member.id,
        userId: data.member.user_id,
        joinTimestamp: new Date(data.member.join_timestamp),
        flags: data.member.flags
      } : undefined,
      defaultAutoArchiveDuration: data.default_auto_archive_duration,
      permissions: data.permissions,
      flags: data.flags,
      totalMessageSent: data.total_message_sent
    };
  }

  private mapToDiscordRole(data: any): DiscordRole {
    return {
      id: data.id,
      name: data.name,
      color: data.color,
      hoist: data.hoist,
      icon: data.icon,
      unicodeEmoji: data.unicode_emoji,
      position: data.position,
      permissions: data.permissions,
      managed: data.managed,
      mentionable: data.mentionable,
      tags: data.tags
    };
  }

  private mapToDiscordUser(data: any): DiscordUser {
    return {
      id: data.id,
      username: data.username,
      discriminator: data.discriminator,
      avatar: data.avatar,
      bot: data.bot,
      system: data.system,
      mfaEnabled: data.mfa_enabled,
      banner: data.banner,
      accentColor: data.accent_color,
      locale: data.locale,
      verified: data.verified,
      email: data.email,
      flags: data.flags,
      premiumType: data.premium_type,
      publicFlags: data.public_flags
    };
  }

  private mapToDiscordMember(data: any): DiscordMember {
    return {
      user: data.user ? this.mapToDiscordUser(data.user) : undefined,
      nick: data.nick,
      avatar: data.avatar,
      roles: data.roles || [],
      joinedAt: new Date(data.joined_at),
      premiumSince: data.premium_since ? new Date(data.premium_since) : undefined,
      deaf: data.deaf || false,
      mute: data.mute || false,
      flags: data.flags || 0,
      pending: data.pending,
      permissions: data.permissions,
      communicationDisabledUntil: data.communication_disabled_until ? new Date(data.communication_disabled_until) : undefined
    };
  }

  private mapToDiscordEmoji(data: any): DiscordEmoji {
    return {
      id: data.id,
      name: data.name,
      roles: data.roles,
      user: data.user ? this.mapToDiscordUser(data.user) : undefined,
      requireColons: data.require_colons,
      managed: data.managed,
      animated: data.animated,
      available: data.available
    };
  }

  private mapToDiscordSticker(data: any): DiscordSticker {
    return {
      id: data.id,
      packId: data.pack_id,
      name: data.name,
      description: data.description,
      tags: data.tags,
      asset: data.asset,
      type: data.type,
      formatType: data.format_type,
      available: data.available,
      guildId: data.guild_id,
      user: data.user ? this.mapToDiscordUser(data.user) : undefined,
      sortValue: data.sort_value
    };
  }

  private mapToDiscordWebhook(data: any): DiscordWebhook {
    return {
      id: data.id,
      type: data.type,
      guildId: data.guild_id,
      channelId: data.channel_id,
      user: data.user ? this.mapToDiscordUser(data.user) : undefined,
      name: data.name,
      avatar: data.avatar,
      token: data.token,
      applicationId: data.application_id,
      sourceGuild: data.source_guild,
      sourceChannel: data.source_channel,
      url: data.url
    };
  }
}

export function createDiscordIntegration(config: DiscordConfig): DiscordIntegration {
  return new DiscordIntegration(config);
} 