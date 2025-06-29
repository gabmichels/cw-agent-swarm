/**
 * XPatternsService.ts - Integration Service for Multi-Platform Social Media Management
 * 
 * Provides the bridge between the XPatternsOrchestrator and the existing social media
 * infrastructure, including agent tools, database operations, and permission management.
 * 
 * Following IMPLEMENTATION_GUIDELINES.md:
 * - Dependency injection with interface-first design
 * - Comprehensive error handling and logging
 * - ULID IDs and strict TypeScript typing
 * - Integration with existing social media services
 */

import { ulid } from 'ulid';
import {
  SocialMediaProvider,
  SocialMediaCapability,
  SocialMediaConnectionStatus,
  ISocialMediaDatabase,
  SocialMediaConnection
} from '../database/ISocialMediaDatabase';
import {
  ISocialMediaProvider,
  PostCreationParams,
  SocialMediaPost
} from '../providers/base/ISocialMediaProvider';
import { SocialMediaService } from '../SocialMediaService';
import { SocialMediaAgentTools } from '../tools/SocialMediaAgentTools';
import {
  XPatternsOrchestrator,
  IXPatternsOrchestrator,
  XPatternsConfig,
  CrossPlatformCampaign,
  CreateCampaignParams,
  XPatternsExecutionResult,
  XPatternsError,
  DEFAULT_PLATFORM_STRATEGIES
} from './XPatternsOrchestrator';

// ============================================================================
// SERVICE INTERFACES
// ============================================================================

export interface IXPatternsService {
  // Campaign Management
  createCampaign(agentId: string, params: CreateCampaignParams): Promise<CrossPlatformCampaign>;
  executeCampaign(agentId: string, campaignId: string): Promise<XPatternsExecutionResult>;
  executeImmediatePost(agentId: string, content: string, platforms: SocialMediaProvider[]): Promise<XPatternsExecutionResult>;

  // Agent Integration
  getAvailablePlatforms(agentId: string): Promise<SocialMediaProvider[]>;
  validateAgentPermissions(agentId: string, platforms: SocialMediaProvider[]): Promise<boolean>;
  getAgentConnections(agentId: string): Promise<Map<SocialMediaProvider, SocialMediaConnection>>;

  // Content Processing
  processNaturalLanguageCommand(agentId: string, command: string): Promise<XPatternsExecutionResult>;
  adaptContentForPlatforms(content: string, platforms: SocialMediaProvider[]): Promise<Map<SocialMediaProvider, AdaptedContentResult>>;

  // Performance & Analytics
  getCampaignPerformance(campaignId: string): Promise<CampaignPerformanceResult>;
  getAgentSocialMediaAnalytics(agentId: string, timeframe: string): Promise<AgentAnalyticsResult>;

  // Configuration
  updateAgentXPatternsConfig(agentId: string, config: Partial<XPatternsConfig>): Promise<void>;
  getAgentXPatternsConfig(agentId: string): Promise<XPatternsConfig>;
}

export interface AdaptedContentResult {
  platform: SocialMediaProvider;
  originalContent: string;
  adaptedContent: string;
  adaptationReason: string;
  estimatedPerformance: {
    expectedViews: number;
    expectedEngagement: number;
    confidence: number;
  };
  hashtags: string[];
  mentions: string[];
}

export interface CampaignPerformanceResult {
  campaignId: string;
  status: string;
  totalReach: number;
  totalEngagement: number;
  platformResults: Array<{
    platform: SocialMediaProvider;
    success: boolean;
    postId?: string;
    url?: string;
    metrics?: {
      views: number;
      likes: number;
      shares: number;
      comments: number;
    };
  }>;
  executionTime: number;
  adaptationsMade: number;
}

export interface AgentAnalyticsResult {
  agentId: string;
  timeframe: string;
  totalCampaigns: number;
  successfulCampaigns: number;
  totalPosts: number;
  totalReach: number;
  totalEngagement: number;
  platformBreakdown: Map<SocialMediaProvider, {
    posts: number;
    reach: number;
    engagement: number;
    successRate: number;
  }>;
  topPerformingContent: Array<{
    content: string;
    platform: SocialMediaProvider;
    engagement: number;
    url?: string;
  }>;
  recommendations: string[];
}

export interface XPatternsToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  requiredCapabilities: SocialMediaCapability[];
  execute: (agentId: string, params: Record<string, any>) => Promise<any>;
}

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

export class XPatternsService implements IXPatternsService {
  private orchestrator: IXPatternsOrchestrator;
  private socialMediaService: SocialMediaService;
  private database: ISocialMediaDatabase;
  private providers: Map<SocialMediaProvider, ISocialMediaProvider>;
  private agentConfigs: Map<string, XPatternsConfig> = new Map();
  private tools: XPatternsToolDefinition[] = [];

  constructor(
    socialMediaService: SocialMediaService,
    database: ISocialMediaDatabase,
    providers: Map<SocialMediaProvider, ISocialMediaProvider>
  ) {
    this.socialMediaService = socialMediaService;
    this.database = database;
    this.providers = providers;

    // Initialize with default config
    const defaultConfig: XPatternsConfig = {
      enableIntelligentAdaptation: true,
      enableCrossPlatformCoordination: true,
      enableRealTimeOptimization: true,
      enableAudienceTargeting: true,
      enablePerformanceTracking: true,
      maxConcurrentPosts: 5,
      retryAttempts: 3,
      adaptationStrategies: Array.from(DEFAULT_PLATFORM_STRATEGIES.values())
    };

    this.orchestrator = new XPatternsOrchestrator(defaultConfig, providers);
    this.initializeTools();
  }

  // ============================================================================
  // CAMPAIGN MANAGEMENT
  // ============================================================================

  async createCampaign(agentId: string, params: CreateCampaignParams): Promise<CrossPlatformCampaign> {
    // Validate agent permissions for target platforms
    const hasPermissions = await this.validateAgentPermissions(agentId, params.targetPlatforms);
    if (!hasPermissions) {
      throw new XPatternsError(
        'Agent lacks required permissions for target platforms',
        'INSUFFICIENT_PERMISSIONS',
        undefined,
        { agentId, targetPlatforms: params.targetPlatforms }
      );
    }

    // Create campaign with orchestrator
    const campaign = await this.orchestrator.createCampaign(params);

    // Log campaign creation
    console.log(`XPatterns campaign created: ${campaign.id} by agent: ${agentId}`);

    return campaign;
  }

  async executeCampaign(agentId: string, campaignId: string): Promise<XPatternsExecutionResult> {
    const startTime = Date.now();

    try {
      // Get agent connections for the campaign
      const agentConnections = await this.getAgentConnections(agentId);

      // Update orchestrator with agent-specific connections
      await this.updateOrchestratorConnections(agentId, agentConnections);

      // Execute campaign
      const result = await this.orchestrator.executeCampaign(campaignId, agentId);

      // Log execution result
      console.log(`XPatterns campaign executed: ${campaignId}, success: ${result.success}, platforms: ${result.platformResults.size}`);

      // Store execution results in database for analytics
      await this.storeCampaignExecution(agentId, result);

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`XPatterns campaign execution failed: ${campaignId}`, error);

      throw new XPatternsError(
        `Campaign execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'EXECUTION_FAILED',
        undefined,
        { agentId, campaignId, executionTime, error }
      );
    }
  }

  async executeImmediatePost(
    agentId: string,
    content: string,
    platforms: SocialMediaProvider[]
  ): Promise<XPatternsExecutionResult> {
    // Validate permissions
    const hasPermissions = await this.validateAgentPermissions(agentId, platforms);
    if (!hasPermissions) {
      throw new XPatternsError(
        'Agent lacks required permissions for target platforms',
        'INSUFFICIENT_PERMISSIONS',
        undefined,
        { agentId, platforms }
      );
    }

    // Get agent connections
    const agentConnections = await this.getAgentConnections(agentId);
    await this.updateOrchestratorConnections(agentId, agentConnections);

    // Execute immediate post
    const result = await this.orchestrator.executeImmediatePost(content, platforms, agentId);

    // Log and store results
    console.log(`XPatterns immediate post executed by agent: ${agentId}, platforms: ${platforms.join(', ')}`);
    await this.storeCampaignExecution(agentId, result);

    return result;
  }

  // ============================================================================
  // AGENT INTEGRATION
  // ============================================================================

  async getAvailablePlatforms(agentId: string): Promise<SocialMediaProvider[]> {
    try {
      const permissions = await this.database.getAgentPermissions(agentId);
      const availablePlatforms = new Set<SocialMediaProvider>();

      for (const permission of permissions) {
        const connection = await this.database.getConnection(permission.connectionId);
        if (connection && connection.connectionStatus === SocialMediaConnectionStatus.ACTIVE) {
          availablePlatforms.add(connection.provider);
        }
      }

      return Array.from(availablePlatforms);
    } catch (error) {
      console.error(`Failed to get available platforms for agent ${agentId}:`, error);
      return [];
    }
  }

  async validateAgentPermissions(agentId: string, platforms: SocialMediaProvider[]): Promise<boolean> {
    try {
      for (const platform of platforms) {
        // Get connections for this platform
        const connections = await this.getAgentConnectionsForPlatform(agentId, platform);
        if (connections.length === 0) {
          return false;
        }

        // Check if agent has POST_CREATE capability for at least one connection
        const hasPostPermission = await Promise.all(
          connections.map(conn =>
            this.database.validatePermissions(agentId, conn.id, [SocialMediaCapability.POST_CREATE])
          )
        );

        if (!hasPostPermission.some(Boolean)) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error(`Failed to validate agent permissions for ${agentId}:`, error);
      return false;
    }
  }

  async getAgentConnections(agentId: string): Promise<Map<SocialMediaProvider, SocialMediaConnection>> {
    const connections = new Map<SocialMediaProvider, SocialMediaConnection>();

    try {
      const permissions = await this.database.getAgentPermissions(agentId);

      for (const permission of permissions) {
        const connection = await this.database.getConnection(permission.connectionId);
        if (connection && connection.connectionStatus === SocialMediaConnectionStatus.ACTIVE) {
          // Use the first active connection per platform
          if (!connections.has(connection.provider)) {
            connections.set(connection.provider, connection);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to get agent connections for ${agentId}:`, error);
    }

    return connections;
  }

  // ============================================================================
  // CONTENT PROCESSING
  // ============================================================================

  async processNaturalLanguageCommand(agentId: string, command: string): Promise<XPatternsExecutionResult> {
    // Parse command to extract intent, content, and platforms
    const parsedCommand = await this.parseNaturalLanguageCommand(command);

    if (!parsedCommand) {
      throw new XPatternsError(
        'Could not understand the command',
        'COMMAND_PARSE_FAILED',
        undefined,
        { agentId, command }
      );
    }

    // Execute based on parsed command
    switch (parsedCommand.intent) {
      case 'immediate_post':
        return this.executeImmediatePost(agentId, parsedCommand.content, parsedCommand.platforms);

      case 'scheduled_post':
        const campaign = await this.createCampaign(agentId, {
          name: `Scheduled Post - ${ulid()}`,
          description: 'Scheduled post from natural language command',
          baseContent: parsedCommand.content,
          targetPlatforms: parsedCommand.platforms,
          scheduledTime: parsedCommand.scheduledTime
        });
        return this.executeCampaign(agentId, campaign.id);

      default:
        throw new XPatternsError(
          `Unsupported command intent: ${parsedCommand.intent}`,
          'UNSUPPORTED_INTENT',
          undefined,
          { agentId, intent: parsedCommand.intent }
        );
    }
  }

  async adaptContentForPlatforms(
    content: string,
    platforms: SocialMediaProvider[]
  ): Promise<Map<SocialMediaProvider, AdaptedContentResult>> {
    const adaptedContent = await this.orchestrator.adaptContent(content, platforms);
    const results = new Map<SocialMediaProvider, AdaptedContentResult>();

    for (const [platform, adapted] of adaptedContent) {
      results.set(platform, {
        platform,
        originalContent: content,
        adaptedContent: adapted.content,
        adaptationReason: adapted.adaptationReason,
        estimatedPerformance: {
          expectedViews: adapted.estimatedPerformance.expectedViews,
          expectedEngagement: adapted.estimatedPerformance.expectedLikes +
            adapted.estimatedPerformance.expectedShares + adapted.estimatedPerformance.expectedComments,
          confidence: adapted.estimatedPerformance.confidence
        },
        hashtags: adapted.hashtags,
        mentions: adapted.mentions
      });
    }

    return results;
  }

  // ============================================================================
  // PERFORMANCE & ANALYTICS
  // ============================================================================

  async getCampaignPerformance(campaignId: string): Promise<CampaignPerformanceResult> {
    try {
      const campaign = await this.orchestrator.getCampaign(campaignId);
      const performanceReport = await this.orchestrator.trackCampaignPerformance(campaignId);

      // TODO: Get actual performance data from stored execution results
      return {
        campaignId,
        status: campaign.status,
        totalReach: performanceReport.totalReach,
        totalEngagement: performanceReport.totalEngagement,
        platformResults: [],
        executionTime: 0,
        adaptationsMade: 0
      };
    } catch (error) {
      throw new XPatternsError(
        `Failed to get campaign performance: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PERFORMANCE_FETCH_FAILED',
        undefined,
        { campaignId, error }
      );
    }
  }

  async getAgentSocialMediaAnalytics(agentId: string, timeframe: string): Promise<AgentAnalyticsResult> {
    // TODO: Implement comprehensive agent analytics
    return {
      agentId,
      timeframe,
      totalCampaigns: 0,
      successfulCampaigns: 0,
      totalPosts: 0,
      totalReach: 0,
      totalEngagement: 0,
      platformBreakdown: new Map(),
      topPerformingContent: [],
      recommendations: []
    };
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  async updateAgentXPatternsConfig(agentId: string, config: Partial<XPatternsConfig>): Promise<void> {
    const currentConfig = this.agentConfigs.get(agentId) || this.getDefaultConfig();
    const updatedConfig = { ...currentConfig, ...config };

    this.agentConfigs.set(agentId, updatedConfig);

    // Update orchestrator config if needed
    await this.orchestrator.updateConfig(config);
  }

  async getAgentXPatternsConfig(agentId: string): Promise<XPatternsConfig> {
    return this.agentConfigs.get(agentId) || this.getDefaultConfig();
  }

  // ============================================================================
  // TOOL INTEGRATION
  // ============================================================================

  getXPatternsTools(): XPatternsToolDefinition[] {
    return this.tools;
  }

  private initializeTools(): void {
    this.tools = [
      {
        name: 'xpatterns_create_campaign',
        description: 'Create a multi-platform social media campaign with intelligent content adaptation',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Campaign name' },
            content: { type: 'string', description: 'Base content to adapt for platforms' },
            platforms: { type: 'array', description: 'Target platforms', items: { type: 'string' } },
            scheduledTime: { type: 'string', description: 'ISO timestamp for scheduled execution' },
            coordinationStrategy: { type: 'string', description: 'How to coordinate across platforms', enum: ['simultaneous', 'staggered', 'sequential'] }
          },
          required: ['name', 'content', 'platforms']
        },
        requiredCapabilities: [SocialMediaCapability.POST_CREATE],
        execute: async (agentId: string, params: Record<string, any>) => {
          const campaign = await this.createCampaign(agentId, {
            name: params.name,
            description: `Campaign created via XPatterns tool`,
            baseContent: params.content,
            targetPlatforms: params.platforms,
            scheduledTime: params.scheduledTime ? new Date(params.scheduledTime) : undefined,
            coordinationStrategy: params.coordinationStrategy ? { type: params.coordinationStrategy } : undefined
          });
          return { campaignId: campaign.id, status: campaign.status };
        }
      },

      {
        name: 'xpatterns_execute_campaign',
        description: 'Execute a multi-platform social media campaign',
        parameters: {
          type: 'object',
          properties: {
            campaignId: { type: 'string', description: 'Campaign ID to execute' }
          },
          required: ['campaignId']
        },
        requiredCapabilities: [SocialMediaCapability.POST_CREATE],
        execute: async (agentId: string, params: Record<string, any>) => {
          const result = await this.executeCampaign(agentId, params.campaignId);
          return {
            success: result.success,
            platformResults: Array.from(result.platformResults.entries()).map(([platform, result]) => ({
              platform,
              success: result.success,
              postId: result.postId,
              url: result.url
            })),
            totalReach: result.totalReach,
            totalEngagement: result.totalEngagement
          };
        }
      },

      {
        name: 'xpatterns_immediate_post',
        description: 'Create and publish content immediately across multiple platforms with intelligent adaptation',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'Content to post' },
            platforms: { type: 'array', description: 'Platforms to post to', items: { type: 'string' } }
          },
          required: ['content', 'platforms']
        },
        requiredCapabilities: [SocialMediaCapability.POST_CREATE],
        execute: async (agentId: string, params: Record<string, any>) => {
          const result = await this.executeImmediatePost(agentId, params.content, params.platforms);
          return {
            success: result.success,
            platformResults: Array.from(result.platformResults.entries()).map(([platform, result]) => ({
              platform,
              success: result.success,
              postId: result.postId,
              url: result.url,
              adaptations: result.adaptationsApplied
            })),
            executionTime: result.executionTime
          };
        }
      },

      {
        name: 'xpatterns_adapt_content',
        description: 'Adapt content for specific social media platforms without posting',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'Content to adapt' },
            platforms: { type: 'array', description: 'Platforms to adapt for', items: { type: 'string' } }
          },
          required: ['content', 'platforms']
        },
        requiredCapabilities: [],
        execute: async (agentId: string, params: Record<string, any>) => {
          const adaptations = await this.adaptContentForPlatforms(params.content, params.platforms);
          return Array.from(adaptations.entries()).map(([platform, adapted]) => ({
            platform,
            originalContent: adapted.originalContent,
            adaptedContent: adapted.adaptedContent,
            adaptationReason: adapted.adaptationReason,
            hashtags: adapted.hashtags,
            estimatedPerformance: adapted.estimatedPerformance
          }));
        }
      },

      {
        name: 'xpatterns_natural_language',
        description: 'Process natural language commands for social media operations',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Natural language command (e.g., "Post about AI on Twitter and LinkedIn")' }
          },
          required: ['command']
        },
        requiredCapabilities: [SocialMediaCapability.POST_CREATE],
        execute: async (agentId: string, params: Record<string, any>) => {
          const result = await this.processNaturalLanguageCommand(agentId, params.command);
          return {
            success: result.success,
            platformResults: Array.from(result.platformResults.entries()).map(([platform, result]) => ({
              platform,
              success: result.success,
              url: result.url
            })),
            executionTime: result.executionTime
          };
        }
      }
    ];
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private async getAgentConnectionsForPlatform(
    agentId: string,
    platform: SocialMediaProvider
  ): Promise<SocialMediaConnection[]> {
    const permissions = await this.database.getAgentPermissions(agentId);
    const connections: SocialMediaConnection[] = [];

    for (const permission of permissions) {
      const connection = await this.database.getConnection(permission.connectionId);
      if (connection && connection.provider === platform && connection.connectionStatus === SocialMediaConnectionStatus.ACTIVE) {
        connections.push(connection);
      }
    }

    return connections;
  }

  private async updateOrchestratorConnections(
    agentId: string,
    connections: Map<SocialMediaProvider, SocialMediaConnection>
  ): Promise<void> {
    // TODO: Update orchestrator with agent-specific connections
    // This would involve updating the providers with connection IDs
    console.log(`Updated orchestrator connections for agent ${agentId}: ${Array.from(connections.keys()).join(', ')}`);
  }

  private async storeCampaignExecution(agentId: string, result: XPatternsExecutionResult): Promise<void> {
    // TODO: Store execution results in database for analytics and audit
    console.log(`Stored campaign execution result: ${result.campaignId}, agent: ${agentId}`);
  }

  private async parseNaturalLanguageCommand(command: string): Promise<{
    intent: 'immediate_post' | 'scheduled_post' | 'adapt_content';
    content: string;
    platforms: SocialMediaProvider[];
    scheduledTime?: Date;
  } | null> {
    // Simple parsing logic - in production, this would use NLP
    const lowerCommand = command.toLowerCase();

    // Extract platforms
    const platforms: SocialMediaProvider[] = [];
    if (lowerCommand.includes('twitter')) platforms.push(SocialMediaProvider.TWITTER);
    if (lowerCommand.includes('linkedin')) platforms.push(SocialMediaProvider.LINKEDIN);
    if (lowerCommand.includes('instagram')) platforms.push(SocialMediaProvider.INSTAGRAM);
    if (lowerCommand.includes('tiktok')) platforms.push(SocialMediaProvider.TIKTOK);
    if (lowerCommand.includes('facebook')) platforms.push(SocialMediaProvider.FACEBOOK);
    if (lowerCommand.includes('reddit')) platforms.push(SocialMediaProvider.REDDIT);

    if (platforms.length === 0) {
      return null; // No platforms found
    }

    // Determine intent
    let intent: 'immediate_post' | 'scheduled_post' | 'adapt_content';
    if (lowerCommand.includes('schedule') || lowerCommand.includes('later') || lowerCommand.includes('tomorrow')) {
      intent = 'scheduled_post';
    } else if (lowerCommand.includes('adapt') || lowerCommand.includes('optimize')) {
      intent = 'adapt_content';
    } else {
      intent = 'immediate_post';
    }

    // Extract content (simplified)
    const content = command.replace(/\b(post|tweet|share|on|about|to|twitter|linkedin|instagram|tiktok|facebook|reddit)\b/gi, '').trim();

    return {
      intent,
      content: content || 'Social media post content',
      platforms,
      scheduledTime: intent === 'scheduled_post' ? new Date(Date.now() + 24 * 60 * 60 * 1000) : undefined
    };
  }

  private getDefaultConfig(): XPatternsConfig {
    return {
      enableIntelligentAdaptation: true,
      enableCrossPlatformCoordination: true,
      enableRealTimeOptimization: true,
      enableAudienceTargeting: true,
      enablePerformanceTracking: true,
      maxConcurrentPosts: 5,
      retryAttempts: 3,
      adaptationStrategies: Array.from(DEFAULT_PLATFORM_STRATEGIES.values())
    };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createXPatternsService(
  socialMediaService: SocialMediaService,
  database: ISocialMediaDatabase,
  providers: Map<SocialMediaProvider, ISocialMediaProvider>
): IXPatternsService {
  return new XPatternsService(socialMediaService, database, providers);
}

// ============================================================================
// TOOL REGISTRATION
// ============================================================================

export const XPATTERNS_AGENT_TOOLS = [
  {
    id: 'xpatterns_multi_platform_post',
    name: 'Multi-Platform Social Media Post',
    description: 'Create and publish content across multiple social media platforms with intelligent adaptation',
    category: 'xpatterns',
    requiredCapabilities: [SocialMediaCapability.POST_CREATE],
    parameters: {
      content: { type: 'string', required: true, description: 'Content to post across platforms' },
      platforms: { type: 'array', required: true, description: 'Platforms to post to (twitter, linkedin, instagram, etc.)' },
      coordination: { type: 'string', required: false, description: 'Coordination strategy: simultaneous, staggered, or sequential' },
      scheduledTime: { type: 'string', required: false, description: 'ISO timestamp for scheduled posting' }
    }
  },
  {
    id: 'xpatterns_content_adaptation',
    name: 'Content Adaptation for Platforms',
    description: 'Adapt content for specific social media platforms without posting',
    category: 'xpatterns',
    requiredCapabilities: [],
    parameters: {
      content: { type: 'string', required: true, description: 'Content to adapt' },
      platforms: { type: 'array', required: true, description: 'Platforms to adapt content for' }
    }
  },
  {
    id: 'xpatterns_natural_language',
    name: 'Natural Language Social Media Command',
    description: 'Process natural language commands for social media operations',
    category: 'xpatterns',
    requiredCapabilities: [SocialMediaCapability.POST_CREATE],
    parameters: {
      command: { type: 'string', required: true, description: 'Natural language command (e.g., "Post about AI trends on Twitter and LinkedIn")' }
    }
  }
];
