/**
 * Strategic Integration Tool - Phase 2 Orchestration Platform
 * 
 * Unified tool that provides access to all strategic integrations through a single interface.
 * Integrates Microsoft Outlook, Microsoft Teams, Discord, Canva, and YouTube services.
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
import { BaseTool } from '../../../lib/shared/types/agentTypes';
import { 
  ExternalWorkflowError,
  WorkflowExecutionError,
  WorkflowValidationError
} from '../errors/ExternalWorkflowErrors';

// Import all strategic integrations
import { 
  MicrosoftOutlookIntegration,
  OutlookConfig,
  OutlookEmailParams,
  OutlookAttachment,
  createMicrosoftOutlookIntegration
} from './MicrosoftOutlookIntegration';
import { 
  MicrosoftTeamsIntegration,
  TeamsConfig,
  TeamsMessageParams,
  TeamsMention,
  TeamsAttachment,
  createMicrosoftTeamsIntegration
} from './MicrosoftTeamsIntegration';
import { 
  DiscordIntegration,
  DiscordConfig,
  DiscordMessageParams,
  DiscordFile,
  DiscordEmbed,
  DiscordComponent,
  createDiscordIntegration
} from './DiscordIntegration';
import { 
  CanvaIntegration,
  CanvaConfig,
  CanvaDesignParams,
  CanvaExportParams,
  createCanvaIntegration
} from './CanvaIntegration';
import { 
  YouTubeIntegration,
  YouTubeConfig,
  YouTubeVideoUploadParams,
  createYouTubeIntegration
} from './YouTubeIntegration';

// Action type definitions
type OutlookAction = 'sendEmail' | 'getInboxMessages' | 'getMailFolders' | 'createCalendarEvent' | 'getCalendarEvents' | 'getContacts' | 'createContact';
type TeamsAction = 'sendMessage' | 'getTeamChannels' | 'getJoinedTeams' | 'createOnlineMeeting' | 'getUser';
type DiscordAction = 'sendMessage' | 'sendNotification' | 'getGuild' | 'getGuildChannels' | 'createWebhook' | 'executeWebhook' | 'getGuildMembers';
type CanvaAction = 'createDesign' | 'getDesign' | 'updateDesign' | 'exportDesign' | 'searchTemplates' | 'getUserDesigns' | 'createFolder' | 'uploadAsset' | 'getBrandKits';
type YouTubeAction = 'uploadVideo' | 'getVideo' | 'updateVideo' | 'deleteVideo' | 'getChannel' | 'getChannelVideos' | 'createPlaylist' | 'addVideoToPlaylist' | 'getAnalytics';

// ============================================================================
// Strategic Integration Tool Interfaces
// ============================================================================

export interface StrategicIntegrationConfig {
  readonly outlook?: OutlookConfig;
  readonly teams?: TeamsConfig;
  readonly discord?: DiscordConfig;
  readonly canva?: CanvaConfig;
  readonly youtube?: YouTubeConfig;
  readonly enabledPlatforms: readonly ('outlook' | 'teams' | 'discord' | 'canva' | 'youtube')[];
}

export interface StrategicIntegrationParams {
  readonly platform: 'outlook' | 'teams' | 'discord' | 'canva' | 'youtube';
  readonly action: string;
  readonly parameters: Record<string, unknown>;
  readonly agentId?: string;
  readonly workflowId?: string;
}

export interface StrategicIntegrationResult {
  readonly success: boolean;
  readonly platform: 'outlook' | 'teams' | 'discord' | 'canva' | 'youtube';
  readonly action: string;
  readonly result?: unknown;
  readonly error?: string;
  readonly executionId: string;
  readonly timestamp: Date;
  readonly agentId?: string;
  readonly workflowId?: string;
}

export interface PlatformCapabilities {
  readonly platform: 'outlook' | 'teams' | 'discord' | 'canva' | 'youtube';
  readonly actions: readonly string[];
  readonly description: string;
  readonly isAuthenticated: boolean;
  readonly lastConnectionTest?: Date;
  readonly connectionStatus: 'connected' | 'disconnected' | 'error' | 'unknown';
}

// ============================================================================
// Strategic Integration Tool
// ============================================================================

export class StrategicIntegrationTool extends BaseTool {
  readonly name = 'strategic_integration';
  readonly description = 'Execute actions across strategic platforms: Microsoft Outlook, Teams, Discord, Canva, and YouTube';

  private readonly integrations = new Map<string, any>();
  private readonly connectionStatus = new Map<string, {
    status: 'connected' | 'disconnected' | 'error' | 'unknown';
    lastTested?: Date;
    error?: string;
  }>();

  constructor(
    private readonly config: StrategicIntegrationConfig
  ) {
    super(
      'strategic_integration',
      'Execute actions across strategic platforms: Microsoft Outlook, Teams, Discord, Canva, and YouTube',
      {
        type: 'object',
        properties: {
          platform: {
            type: 'string',
            enum: ['outlook', 'teams', 'discord', 'canva', 'youtube'],
            description: 'Platform to execute action on'
          },
          action: {
            type: 'string',
            description: 'Action to perform on the platform'
          },
          parameters: {
            type: 'object',
            description: 'Parameters for the action'
          }
        },
        required: ['platform', 'action', 'parameters']
      }
    );
    this.initializeIntegrations();
  }

  /**
   * Get tool schema for agent integration
   */
  getSchema(): any {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: {
          type: 'object',
          properties: {
            platform: {
              type: 'string',
              enum: ['outlook', 'teams', 'discord', 'canva', 'youtube'],
              description: 'The platform to execute the action on'
            },
            action: {
              type: 'string',
              description: 'The action to perform on the platform'
            },
            parameters: {
              type: 'object',
              description: 'Parameters specific to the action and platform',
              additionalProperties: true
            },
            agentId: {
              type: 'string',
              description: 'Optional agent ID for tracking'
            },
            workflowId: {
              type: 'string',
              description: 'Optional workflow ID for tracking'
            }
          },
          required: ['platform', 'action', 'parameters']
        }
      }
    };
  }

  /**
   * Execute integration action
   */
  async execute(params: StrategicIntegrationParams): Promise<StrategicIntegrationResult> {
    const executionId = ulid();
    const timestamp = new Date();

    try {
      this.validateParams(params);

      const integration = this.integrations.get(params.platform);
      if (!integration) {
        throw new WorkflowValidationError('strategic-integration-execution', [`Platform ${params.platform} is not configured or enabled`]);
      }

      // Test connection before execution
      await this.ensureConnection(params.platform);

      // Execute platform-specific action
      const result = await this.executeAction(params.platform, params.action, params.parameters, integration);

      logger.info('Strategic integration action executed successfully', {
        executionId,
        platform: params.platform,
        action: params.action,
        agentId: params.agentId,
        workflowId: params.workflowId
      });

      return {
        success: true,
        platform: params.platform,
        action: params.action,
        result,
        executionId,
        timestamp,
        agentId: params.agentId,
        workflowId: params.workflowId
      };
    } catch (error) {
      logger.error('Strategic integration action failed', {
        executionId,
        platform: params.platform,
        action: params.action,
        error,
        agentId: params.agentId,
        workflowId: params.workflowId
      });

      return {
        success: false,
        platform: params.platform,
        action: params.action,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        executionId,
        timestamp,
        agentId: params.agentId,
        workflowId: params.workflowId
      };
    }
  }

  /**
   * Get capabilities for all enabled platforms
   */
  async getCapabilities(): Promise<readonly PlatformCapabilities[]> {
    const capabilities: PlatformCapabilities[] = [];

    for (const platform of this.config.enabledPlatforms) {
      const integration = this.integrations.get(platform);
      const status = this.connectionStatus.get(platform);

      let platformCapabilities: PlatformCapabilities;

      switch (platform) {
        case 'outlook':
          platformCapabilities = {
            platform: 'outlook',
            actions: ['sendEmail', 'getInboxMessages', 'getMailFolders', 'createCalendarEvent', 'getCalendarEvents', 'getContacts', 'createContact'],
            description: 'Microsoft Outlook email, calendar, and contact management',
            isAuthenticated: !!integration,
            lastConnectionTest: status?.lastTested,
            connectionStatus: status?.status || 'unknown'
          };
          break;

        case 'teams':
          platformCapabilities = {
            platform: 'teams',
            actions: ['sendMessage', 'getTeamChannels', 'getJoinedTeams', 'createOnlineMeeting', 'getUser'],
            description: 'Microsoft Teams messaging, meetings, and collaboration',
            isAuthenticated: !!integration,
            lastConnectionTest: status?.lastTested,
            connectionStatus: status?.status || 'unknown'
          };
          break;

        case 'discord':
          platformCapabilities = {
            platform: 'discord',
            actions: ['sendMessage', 'sendNotification', 'getGuild', 'getGuildChannels', 'createWebhook', 'executeWebhook', 'getGuildMembers'],
            description: 'Discord messaging, server management, and community features',
            isAuthenticated: !!integration,
            lastConnectionTest: status?.lastTested,
            connectionStatus: status?.status || 'unknown'
          };
          break;

        case 'canva':
          platformCapabilities = {
            platform: 'canva',
            actions: ['createDesign', 'getDesign', 'updateDesign', 'exportDesign', 'searchTemplates', 'getUserDesigns', 'createFolder', 'uploadAsset', 'getBrandKits'],
            description: 'Canva design creation, template management, and asset handling',
            isAuthenticated: !!integration,
            lastConnectionTest: status?.lastTested,
            connectionStatus: status?.status || 'unknown'
          };
          break;

        case 'youtube':
          platformCapabilities = {
            platform: 'youtube',
            actions: ['uploadVideo', 'getVideo', 'updateVideo', 'deleteVideo', 'getChannel', 'getChannelVideos', 'createPlaylist', 'addVideoToPlaylist', 'getAnalytics'],
            description: 'YouTube video management, channel operations, and analytics',
            isAuthenticated: !!integration,
            lastConnectionTest: status?.lastTested,
            connectionStatus: status?.status || 'unknown'
          };
          break;

        default:
          continue;
      }

      capabilities.push(platformCapabilities);
    }

    return capabilities;
  }

  /**
   * Test connections to all enabled platforms
   */
  async testAllConnections(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const platform of this.config.enabledPlatforms) {
      try {
        const integration = this.integrations.get(platform);
        if (integration && typeof integration.testConnection === 'function') {
          const isConnected = await integration.testConnection();
          results[platform] = isConnected;
          
          this.connectionStatus.set(platform, {
            status: isConnected ? 'connected' : 'disconnected',
            lastTested: new Date()
          });
        } else {
          results[platform] = false;
          this.connectionStatus.set(platform, {
            status: 'error',
            lastTested: new Date(),
            error: 'Integration not properly initialized'
          });
        }
      } catch (error) {
        results[platform] = false;
        this.connectionStatus.set(platform, {
          status: 'error',
          lastTested: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Get specific integration instance
   */
  getIntegration<T>(platform: 'outlook' | 'teams' | 'discord' | 'canva' | 'youtube'): T | null {
    return this.integrations.get(platform) as T || null;
  }

  /**
   * Initialize all configured integrations
   */
  private initializeIntegrations(): void {
    // Initialize Microsoft Outlook integration
    if (this.config.outlook && this.config.enabledPlatforms.includes('outlook')) {
      try {
        const outlookIntegration = createMicrosoftOutlookIntegration(this.config.outlook);
        this.integrations.set('outlook', outlookIntegration);
        logger.info('Microsoft Outlook integration initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize Microsoft Outlook integration', { error });
      }
    }

    // Initialize Microsoft Teams integration
    if (this.config.teams && this.config.enabledPlatforms.includes('teams')) {
      try {
        const teamsIntegration = createMicrosoftTeamsIntegration(this.config.teams);
        this.integrations.set('teams', teamsIntegration);
        logger.info('Microsoft Teams integration initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize Microsoft Teams integration', { error });
      }
    }

    // Initialize Discord integration
    if (this.config.discord && this.config.enabledPlatforms.includes('discord')) {
      try {
        const discordIntegration = createDiscordIntegration(this.config.discord);
        this.integrations.set('discord', discordIntegration);
        logger.info('Discord integration initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize Discord integration', { error });
      }
    }

    // Initialize Canva integration
    if (this.config.canva && this.config.enabledPlatforms.includes('canva')) {
      try {
        const canvaIntegration = createCanvaIntegration(this.config.canva);
        this.integrations.set('canva', canvaIntegration);
        logger.info('Canva integration initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize Canva integration', { error });
      }
    }

    // Initialize YouTube integration
    if (this.config.youtube && this.config.enabledPlatforms.includes('youtube')) {
      try {
        const youtubeIntegration = createYouTubeIntegration(this.config.youtube);
        this.integrations.set('youtube', youtubeIntegration);
        logger.info('YouTube integration initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize YouTube integration', { error });
      }
    }
  }

  /**
   * Validate execution parameters
   */
  private validateParams(params: StrategicIntegrationParams): void {
    if (!params.platform || !this.config.enabledPlatforms.includes(params.platform)) {
      throw new WorkflowValidationError('strategic-integration-params', [`Invalid or disabled platform: ${params.platform}`]);
    }

    if (!params.action || typeof params.action !== 'string') {
      throw new WorkflowValidationError('strategic-integration-params', ['Action is required and must be a string']);
    }

    if (!params.parameters || typeof params.parameters !== 'object') {
      throw new WorkflowValidationError('strategic-integration-params', ['Parameters is required and must be an object']);
    }
  }

  /**
   * Ensure platform connection is active
   */
  private async ensureConnection(platform: string): Promise<void> {
    const status = this.connectionStatus.get(platform);
    
    // Test connection if not tested recently or if last test failed
    if (!status || status.status !== 'connected' || 
        !status.lastTested || (Date.now() - status.lastTested.getTime()) > 300000) { // 5 minutes
      
      const integration = this.integrations.get(platform);
      if (integration && typeof integration.testConnection === 'function') {
        try {
          const isConnected = await integration.testConnection();
          
          this.connectionStatus.set(platform, {
            status: isConnected ? 'connected' : 'disconnected',
            lastTested: new Date()
          });

          if (!isConnected) {
            throw new WorkflowExecutionError('connection-test', `Connection to ${platform} failed`);
          }
        } catch (error) {
          this.connectionStatus.set(platform, {
            status: 'error',
            lastTested: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          throw error;
        }
      }
    }
  }

  /**
   * Execute action on specific platform
   */
  private async executeAction(platform: string, action: string, parameters: Record<string, unknown>, integration: any): Promise<unknown> {
    switch (platform) {
      case 'outlook':
        const outlookAction = action as OutlookAction;
        
        // Validate required parameters for Outlook email
        if (outlookAction === 'sendEmail') {
          const emailParams = this.validateOutlookEmailParams(parameters);
          return await integration.sendEmail(emailParams);
        }
        
        // Handle other Outlook actions
        return await this.executeOutlookAction(outlookAction, parameters, integration as MicrosoftOutlookIntegration);

      case 'teams':
        const teamsAction = action as TeamsAction;
        
        // Validate required parameters for Teams message
        if (teamsAction === 'sendMessage') {
          const messageParams = this.validateTeamsMessageParams(parameters);
          return await integration.sendMessage(messageParams);
        }
        
        // Handle other Teams actions
        return await this.executeTeamsAction(teamsAction, parameters, integration as MicrosoftTeamsIntegration);

      case 'discord':
        const discordAction = action as DiscordAction;
        
        // Validate required parameters for Discord message
        if (discordAction === 'sendMessage') {
          const messageParams = this.validateDiscordMessageParams(parameters);
          return await integration.sendMessage(messageParams);
        }
        
        // Handle other Discord actions
        return await this.executeDiscordAction(discordAction, parameters, integration as DiscordIntegration);

      case 'canva':
        const canvaAction = action as CanvaAction;
        
        // Validate required parameters for Canva actions
        if (canvaAction === 'createDesign') {
          const designParams = this.validateCanvaDesignParams(parameters);
          return await integration.createDesign(designParams);
        } else if (canvaAction === 'exportDesign') {
          const exportParams = this.validateCanvaExportParams(parameters);
          return await integration.exportDesign(exportParams);
        }
        
        // Handle other Canva actions
        return await this.executeCanvaAction(canvaAction, parameters, integration as CanvaIntegration);

      case 'youtube':
        const youtubeAction = action as YouTubeAction;
        
        // Validate required parameters for YouTube video upload
        if (youtubeAction === 'uploadVideo') {
          const uploadParams = this.validateYouTubeVideoUploadParams(parameters);
          return await integration.uploadVideo(uploadParams);
        }
        
        // Handle other YouTube actions
        return await this.executeYouTubeAction(youtubeAction, parameters, integration as YouTubeIntegration);

      default:
        throw new WorkflowValidationError('strategic-integration-action', [`Unsupported platform: ${platform}`]);
    }
  }

  /**
   * Execute Outlook-specific actions
   */
  private async executeOutlookAction(action: string, parameters: Record<string, unknown>, integration: MicrosoftOutlookIntegration): Promise<unknown> {
    switch (action) {
      case 'sendEmail':
        return integration.sendEmail(parameters as unknown as OutlookEmailParams);
      case 'getInboxMessages':
        return integration.getInboxMessages(parameters as any);
      case 'getMailFolders':
        return integration.getMailFolders();
      case 'createCalendarEvent':
        return integration.createCalendarEvent(parameters as any);
      case 'getCalendarEvents':
        return integration.getCalendarEvents(parameters as any);
      case 'getContacts':
        return integration.getContacts(parameters as any);
      case 'createContact':
        return integration.createContact(parameters as any);
      default:
        throw new WorkflowValidationError('outlook-action', [`Unsupported Outlook action: ${action}`]);
    }
  }

  /**
   * Execute Teams-specific actions
   */
  private async executeTeamsAction(action: string, parameters: Record<string, unknown>, integration: MicrosoftTeamsIntegration): Promise<unknown> {
    switch (action) {
      case 'sendMessage':
        return integration.sendMessage(parameters as unknown as TeamsMessageParams);
      case 'getTeamChannels':
        return integration.getTeamChannels(parameters as any);
      case 'getJoinedTeams':
        return integration.getJoinedTeams();
      case 'createOnlineMeeting':
        return integration.createOnlineMeeting(parameters as any);
      case 'getUser':
        return integration.getUser(parameters as any);
      default:
        throw new WorkflowValidationError('teams-action', [`Unsupported Teams action: ${action}`]);
    }
  }

  /**
   * Execute Discord-specific actions
   */
  private async executeDiscordAction(action: string, parameters: Record<string, unknown>, integration: DiscordIntegration): Promise<unknown> {
    switch (action) {
      case 'sendMessage':
        return integration.sendMessage(parameters as unknown as DiscordMessageParams);
      case 'sendNotification':
        // Use existing notification function for backward compatibility
        if (typeof parameters.message === 'string') {
          return integration.sendNotification(parameters.message);
        }
        throw new WorkflowValidationError('discord-notification', ['Message parameter is required for sendNotification']);
      case 'getGuild':
        if (typeof parameters.guildId === 'string') {
          return integration.getGuild(parameters.guildId);
        }
        throw new WorkflowValidationError('discord-guild', ['guildId parameter is required']);
      case 'getGuildChannels':
        if (typeof parameters.guildId === 'string') {
          return integration.getGuildChannels(parameters.guildId);
        }
        throw new WorkflowValidationError('discord-channels', ['guildId parameter is required']);
      case 'createWebhook':
        if (typeof parameters.channelId === 'string' && typeof parameters.name === 'string') {
          return integration.createWebhook(parameters.channelId, parameters.name, parameters.avatar as string | undefined);
        }
        throw new WorkflowValidationError('discord-webhook', ['channelId and name parameters are required']);
      case 'executeWebhook':
        if (typeof parameters.webhookId === 'string' && typeof parameters.webhookToken === 'string') {
          return integration.executeWebhook(parameters.webhookId, parameters.webhookToken, parameters.params as any);
        }
        throw new WorkflowValidationError('discord-webhook-execute', ['webhookId and webhookToken parameters are required']);
      case 'getGuildMembers':
        if (typeof parameters.guildId === 'string') {
          return integration.getGuildMembers(parameters.guildId, parameters.options as any || {});
        }
        throw new WorkflowValidationError('discord-members', ['guildId parameter is required']);
      default:
        throw new WorkflowValidationError('discord-action', [`Unsupported Discord action: ${action}`]);
    }
  }

  /**
   * Execute Canva-specific actions
   */
  private async executeCanvaAction(action: string, parameters: Record<string, unknown>, integration: CanvaIntegration): Promise<unknown> {
    switch (action) {
      case 'createDesign':
        return integration.createDesign(parameters as unknown as CanvaDesignParams);
      case 'getDesign':
        if (typeof parameters.designId === 'string') {
          return integration.getDesign(parameters.designId);
        }
        throw new WorkflowValidationError('canva-design-get', ['designId parameter is required']);
      case 'updateDesign':
        if (typeof parameters.designId === 'string') {
          return integration.updateDesign(parameters.designId, parameters.updates as any);
        }
        throw new WorkflowValidationError('canva-design-update', ['designId parameter is required']);
      case 'exportDesign':
        return integration.exportDesign(parameters as unknown as CanvaExportParams);
      case 'searchTemplates':
        return integration.searchTemplates(parameters as any);
      case 'getUserDesigns':
        return integration.getUserDesigns(parameters as any);
      case 'createFolder':
        return integration.createFolder(parameters as any);
      case 'uploadAsset':
        return integration.uploadAsset(parameters as any);
      case 'getBrandKits':
        return integration.getBrandKits();
      default:
        throw new WorkflowValidationError('canva-action', [`Unsupported Canva action: ${action}`]);
    }
  }

  /**
   * Execute YouTube-specific actions
   */
  private async executeYouTubeAction(action: string, parameters: Record<string, unknown>, integration: YouTubeIntegration): Promise<unknown> {
    switch (action) {
      case 'uploadVideo':
        return integration.uploadVideo(parameters as unknown as YouTubeVideoUploadParams);
      case 'getVideo':
        if (typeof parameters.videoId === 'string') {
          return integration.getVideo(parameters.videoId, parameters.parts as readonly string[] | undefined);
        }
        throw new WorkflowValidationError('youtube-video-get', ['videoId parameter is required']);
      case 'updateVideo':
        if (typeof parameters.videoId === 'string') {
          return integration.updateVideo(parameters.videoId, parameters.updates as any);
        }
        throw new WorkflowValidationError('youtube-video-update', ['videoId parameter is required']);
      case 'deleteVideo':
        if (typeof parameters.videoId === 'string') {
          return integration.deleteVideo(parameters.videoId);
        }
        throw new WorkflowValidationError('youtube-video-delete', ['videoId parameter is required']);
      case 'getChannel':
        return integration.getChannel(parameters.channelId as string | undefined);
      case 'getChannelVideos':
        return integration.getChannelVideos(parameters as any);
      case 'createPlaylist':
        return integration.createPlaylist(parameters as any);
      case 'addVideoToPlaylist':
        if (typeof parameters.videoId === 'string' && typeof parameters.playlistId === 'string') {
          return integration.addVideoToPlaylist(parameters.videoId, parameters.playlistId, parameters.position as number | undefined);
        }
        throw new WorkflowValidationError('youtube-playlist-add', ['videoId and playlistId parameters are required']);
      case 'getAnalytics':
        return integration.getAnalytics(parameters as any);
      default:
        throw new WorkflowValidationError('youtube-action', [`Unsupported YouTube action: ${action}`]);
    }
  }

  // Parameter validation methods
  private validateOutlookEmailParams(params: Record<string, unknown>): OutlookEmailParams {
    const { to, subject, body, bodyType = 'text', importance = 'normal' } = params;
    
    if (!to) {
      throw new WorkflowValidationError('outlook-email', ['Missing "to" parameter']);
    }
    if (!subject || typeof subject !== 'string') {
      throw new WorkflowValidationError('outlook-email', ['Missing or invalid "subject" parameter']);
    }
    if (!body || typeof body !== 'string') {
      throw new WorkflowValidationError('outlook-email', ['Missing or invalid "body" parameter']);
    }
    
    // Convert to array format expected by Outlook
    const toArray = Array.isArray(to) ? to as string[] : [to as string];
    const ccArray = params.cc ? (Array.isArray(params.cc) ? params.cc as string[] : [params.cc as string]) : undefined;
    const bccArray = params.bcc ? (Array.isArray(params.bcc) ? params.bcc as string[] : [params.bcc as string]) : undefined;
    
    return {
      to: toArray,
      subject,
      body,
      bodyType: bodyType as 'text' | 'html',
      importance: importance as 'low' | 'normal' | 'high',
      cc: ccArray,
      bcc: bccArray,
      attachments: params.attachments as readonly OutlookAttachment[] | undefined
    };
  }

  private validateTeamsMessageParams(params: Record<string, unknown>): TeamsMessageParams {
    const { channelId, teamId, content, contentType = 'text', importance = 'normal' } = params;
    
    if (!channelId || typeof channelId !== 'string') {
      throw new WorkflowValidationError('teams-message', ['Missing or invalid "channelId" parameter']);
    }
    if (!teamId || typeof teamId !== 'string') {
      throw new WorkflowValidationError('teams-message', ['Missing or invalid "teamId" parameter']);
    }
    if (!content || typeof content !== 'string') {
      throw new WorkflowValidationError('teams-message', ['Missing or invalid "content" parameter']);
    }
    
    return {
      channelId,
      teamId,
      content,
      contentType: contentType as 'text' | 'html',
      importance: importance as 'normal' | 'high' | 'urgent',
      mentions: params.mentions as readonly TeamsMention[] | undefined,
      attachments: params.attachments as readonly TeamsAttachment[] | undefined
    };
  }

  private validateDiscordMessageParams(params: Record<string, unknown>): DiscordMessageParams {
    const { channelId, content } = params;
    
    if (!channelId || typeof channelId !== 'string') {
      throw new WorkflowValidationError('discord-message', ['Missing or invalid "channelId" parameter']);
    }
    if (!content || typeof content !== 'string') {
      throw new WorkflowValidationError('discord-message', ['Missing or invalid "content" parameter']);
    }
    
    return {
      channelId,
      content,
      embeds: params.embeds as readonly DiscordEmbed[] | undefined,
      files: params.files as readonly DiscordFile[] | undefined,
      components: params.components as readonly DiscordComponent[] | undefined
    };
  }

  private validateCanvaDesignParams(params: Record<string, unknown>): CanvaDesignParams {
    const { designType, title } = params;
    
    if (!designType || typeof designType !== 'string') {
      throw new WorkflowValidationError('canva-design', ['Missing or invalid "designType" parameter']);
    }
    if (!title || typeof title !== 'string') {
      throw new WorkflowValidationError('canva-design', ['Missing or invalid "title" parameter']);
    }
    
    return {
      designType: designType as any, // Allow any design type string
      title,
      templateId: params.templateId as string | undefined,
      folderId: params.folderId as string | undefined,
      brandTemplateId: params.brandTemplateId as string | undefined
    };
  }

  private validateCanvaExportParams(params: Record<string, unknown>): CanvaExportParams {
    const { designId, format } = params;
    
    if (!designId || typeof designId !== 'string') {
      throw new WorkflowValidationError('canva-export', ['Missing or invalid "designId" parameter']);
    }
    if (!format || typeof format !== 'string') {
      throw new WorkflowValidationError('canva-export', ['Missing or invalid "format" parameter']);
    }
    
    return {
      designId,
      format: format as 'pdf' | 'png' | 'jpg' | 'gif' | 'mp4' | 'pptx',
      quality: params.quality as 'low' | 'medium' | 'high' | undefined,
      pages: params.pages as number[] | undefined
    };
  }

  private validateYouTubeVideoUploadParams(params: Record<string, unknown>): YouTubeVideoUploadParams {
    const { title, privacy, video, tags, description } = params;
    
    if (!title || typeof title !== 'string') {
      throw new WorkflowValidationError('youtube-upload', ['Missing or invalid "title" parameter']);
    }
    if (!privacy || typeof privacy !== 'string') {
      throw new WorkflowValidationError('youtube-upload', ['Missing or invalid "privacy" parameter']);
    }
    if (!video) {
      throw new WorkflowValidationError('youtube-upload', ['Missing "video" parameter']);
    }
    
    return {
      title,
      privacy: privacy as 'private' | 'unlisted' | 'public',
      video: video as any, // Allow flexible video input
      description: typeof description === 'string' ? description : undefined,
      tags: Array.isArray(tags) ? tags as string[] : undefined,
      categoryId: params.categoryId as string | undefined,
      thumbnail: params.thumbnail as any | undefined,
      playlistId: params.playlistId as string | undefined
    };
  }
}

/**
 * Factory function to create Strategic Integration Tool
 */
export function createStrategicIntegrationTool(config: StrategicIntegrationConfig): StrategicIntegrationTool {
  return new StrategicIntegrationTool(config);
} 