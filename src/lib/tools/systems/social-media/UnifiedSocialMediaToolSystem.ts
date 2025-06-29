/**
 * Unified Social Media Tool System
 * 
 * Integrates existing social media tools with the Unified Tool Foundation
 * while preserving all social media-specific logic and platform capabilities.
 * 
 * Phase 2.2: Social Media Tool System Integration
 * - Registers social media tools with foundation using ULID IDs
 * - Preserves existing social media tool logic and approval workflows
 * - Provides unified access through foundation interface
 * - Maintains backward compatibility with existing social media services
 */

import { ulid } from 'ulid';
import { IUnifiedToolFoundation } from '../../foundation/interfaces/UnifiedToolFoundationInterface';
import {
  UnifiedToolDefinition,
  ToolResult,
  ExecutionContext,
  ToolParameters,
  ToolId
} from '../../foundation/types/FoundationTypes';
import { ToolCategory, ToolCapability, ToolStatus } from '../../foundation/enums/ToolEnums';
import { SOCIAL_MEDIA_TOOL_NAMES } from '../../../../constants/tool-names';
import { SocialMediaAgentTools } from '../../../../services/social-media/tools/SocialMediaAgentTools';
import { logger } from '../../../../lib/logging';
import { ToolFoundationError, ToolNotFoundError } from '../../foundation/errors/ToolFoundationErrors';

/**
 * Maps social media tool names to foundation constants
 */
const SOCIAL_MEDIA_TOOL_MAPPING: Record<string, string> = {
  // Content Creation Tools
  'create_text_post': SOCIAL_MEDIA_TOOL_NAMES.CREATE_TEXT_POST,
  'create_image_post': SOCIAL_MEDIA_TOOL_NAMES.CREATE_IMAGE_POST,
  'create_video_post': SOCIAL_MEDIA_TOOL_NAMES.CREATE_VIDEO_POST,
  'create_tiktok_video': SOCIAL_MEDIA_TOOL_NAMES.CREATE_TIKTOK_VIDEO,
  'schedule_post': SOCIAL_MEDIA_TOOL_NAMES.SCHEDULE_POST,
  'schedule_social_post': SOCIAL_MEDIA_TOOL_NAMES.SCHEDULE_SOCIAL_POST,

  // Analytics Tools
  'get_post_metrics': SOCIAL_MEDIA_TOOL_NAMES.GET_POST_METRICS,
  'get_account_analytics': SOCIAL_MEDIA_TOOL_NAMES.GET_ACCOUNT_ANALYTICS,
  'get_social_media_analytics': SOCIAL_MEDIA_TOOL_NAMES.GET_SOCIAL_MEDIA_ANALYTICS,
  'get_engagement_metrics': SOCIAL_MEDIA_TOOL_NAMES.GET_ENGAGEMENT_METRICS,
  'analyze_post_performance': SOCIAL_MEDIA_TOOL_NAMES.ANALYZE_POST_PERFORMANCE,
  'get_audience_insights': SOCIAL_MEDIA_TOOL_NAMES.GET_AUDIENCE_INSIGHTS,

  // Engagement Tools
  'get_comments': SOCIAL_MEDIA_TOOL_NAMES.MANAGE_COMMENTS,
  'reply_to_comment': SOCIAL_MEDIA_TOOL_NAMES.MANAGE_COMMENTS,
  'like_post': SOCIAL_MEDIA_TOOL_NAMES.LIKE_POST,
  'manage_comments': SOCIAL_MEDIA_TOOL_NAMES.MANAGE_COMMENTS,
  'moderate_content': SOCIAL_MEDIA_TOOL_NAMES.MODERATE_CONTENT,
  'handle_mentions': SOCIAL_MEDIA_TOOL_NAMES.HANDLE_MENTIONS,

  // TikTok Specific Tools
  'analyze_tiktok_trends': SOCIAL_MEDIA_TOOL_NAMES.TIKTOK_ANALYTICS_READ,
  'tiktok_video_create': SOCIAL_MEDIA_TOOL_NAMES.TIKTOK_VIDEO_CREATE,

  // Content Management Tools
  'optimize_content': SOCIAL_MEDIA_TOOL_NAMES.OPTIMIZE_CONTENT,
  'analyze_content': SOCIAL_MEDIA_TOOL_NAMES.ANALYZE_CONTENT,
  'get_trending_hashtags': SOCIAL_MEDIA_TOOL_NAMES.GET_TRENDING_HASHTAGS,
  'delete_post': SOCIAL_MEDIA_TOOL_NAMES.DELETE_POST,
  'get_connections': SOCIAL_MEDIA_TOOL_NAMES.GET_CONNECTIONS,

  // Cross-Platform Tools
  'cross_platform_post': SOCIAL_MEDIA_TOOL_NAMES.CROSS_PLATFORM_POST,
  'platform_specific_formatting': SOCIAL_MEDIA_TOOL_NAMES.PLATFORM_SPECIFIC_FORMATTING,

  // Approval Tools
  'request_approval': SOCIAL_MEDIA_TOOL_NAMES.REQUEST_APPROVAL,
  'approve_content': SOCIAL_MEDIA_TOOL_NAMES.APPROVE_CONTENT,
  'social_media_approval': SOCIAL_MEDIA_TOOL_NAMES.SOCIAL_MEDIA_APPROVAL
};

/**
 * Unified Social Media Tool System
 * 
 * Integrates social media tools with the unified foundation while preserving
 * all existing social media-specific functionality and approval workflows.
 */
export class UnifiedSocialMediaToolSystem {
  private readonly registeredTools = new Map<ToolId, string>(); // toolId -> social media tool name
  private readonly toolNameMap = new Map<string, ToolId>(); // constant name -> toolId
  private initialized = false;

  constructor(
    private readonly foundation: IUnifiedToolFoundation,
    private readonly socialMediaTools: SocialMediaAgentTools
  ) { }

  /**
   * Initialize the unified social media tool system
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('UnifiedSocialMediaToolSystem already initialized');
      return;
    }

    try {
      logger.info('Initializing Unified Social Media Tool System');

      // Foundation should already be initialized
      const foundationHealthy = await this.foundation.isHealthy();
      if (!foundationHealthy) {
        throw new ToolFoundationError('Foundation system is not healthy');
      }

      // Register social media tool definitions
      await this.registerSocialMediaToolDefinitions();

      this.initialized = true;
      logger.info('✅ Unified Social Media Tool System initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize UnifiedSocialMediaToolSystem', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Register social media tools for a specific agent
   */
  async registerAgentSocialMediaTools(agentId: string, connectionIds: string[]): Promise<void> {
    if (!this.initialized) {
      throw new ToolFoundationError('UnifiedSocialMediaToolSystem not initialized');
    }

    try {
      logger.info('Registering social media tools for agent', {
        agentId,
        connectionCount: connectionIds.length
      });

      // Get available social media tools for this agent
      const availableTools = await this.socialMediaTools.getAvailableTools('system');

      if (availableTools.length === 0) {
        logger.warn('No social media tools available for agent', { agentId });
        return;
      }

      let registeredCount = 0;

      for (const socialMediaTool of availableTools) {
        try {
          // Map social media tool name to constant name
          const constantName = this.mapSocialMediaToolToConstant(socialMediaTool.name);

          if (!constantName) {
            logger.warn('No constant mapping found for social media tool', {
              agentId,
              toolName: socialMediaTool.name
            });
            continue;
          }

          // Check if we already have this tool registered
          if (this.toolNameMap.has(constantName)) {
            logger.debug('Social media tool already registered', {
              agentId,
              toolName: socialMediaTool.name,
              constantName
            });
            continue;
          }

          // Create unified tool definition
          const toolDefinition = this.createUnifiedToolDefinition(
            socialMediaTool,
            constantName,
            agentId,
            connectionIds
          );

          // Register with foundation
          const registrationResult = await this.foundation.registerTool(toolDefinition);

          if (registrationResult.success && registrationResult.toolId) {
            this.registeredTools.set(registrationResult.toolId, socialMediaTool.name);
            this.toolNameMap.set(constantName, registrationResult.toolId);
            registeredCount++;

            logger.debug('Registered social media tool with foundation', {
              agentId,
              toolName: socialMediaTool.name,
              constantName,
              toolId: registrationResult.toolId
            });
          } else {
            logger.warn('Failed to register social media tool with foundation', {
              agentId,
              toolName: socialMediaTool.name,
              constantName,
              errors: registrationResult.errors || []
            });
          }

        } catch (error) {
          logger.warn('Error registering social media tool', {
            agentId,
            toolName: socialMediaTool.name,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      logger.info('✅ Social media tools registered for agent', {
        agentId,
        availableCount: availableTools.length,
        registeredCount
      });

    } catch (error) {
      logger.error('Failed to register social media tools for agent', {
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Execute a social media tool through the foundation
   */
  async executeSocialMediaTool(
    toolName: string,
    params: ToolParameters,
    context: ExecutionContext
  ): Promise<ToolResult> {
    if (!this.initialized) {
      throw new ToolFoundationError('UnifiedSocialMediaToolSystem not initialized');
    }

    try {
      // Execute through foundation (which will call our executor)
      return await this.foundation.executeTool(toolName, params, context);

    } catch (error) {
      if (error instanceof ToolNotFoundError) {
        // Provide helpful suggestions for social media tools
        const suggestions = await this.getSuggestedSocialMediaTools(toolName);
        throw new ToolNotFoundError(
          `Social media tool '${toolName}' not found. ${suggestions.length > 0 ?
            `Did you mean: ${suggestions.join(', ')}?` :
            'Check available social media tools.'}`,
          {
            identifier: toolName,
            availableTools: suggestions,
            suggestedTools: suggestions
          }
        );
      }
      throw error;
    }
  }

  /**
   * Get all registered social media tool names
   */
  async getRegisteredSocialMediaTools(): Promise<readonly string[]> {
    return Array.from(this.toolNameMap.keys());
  }

  /**
   * Check if a social media tool is registered
   */
  isSocialMediaToolRegistered(toolName: string): boolean {
    return this.toolNameMap.has(toolName);
  }

  /**
   * Register social media tool definitions with foundation
   */
  private async registerSocialMediaToolDefinitions(): Promise<void> {
    // This method registers the tool schemas but not agent-specific executors
    // Agent-specific registration happens in registerAgentSocialMediaTools
    logger.debug('Social media tool definitions registration completed');
  }

  /**
   * Create unified tool definition from social media tool
   */
  private createUnifiedToolDefinition(
    socialMediaTool: any,
    constantName: string,
    agentId: string,
    connectionIds: string[]
  ): UnifiedToolDefinition {
    return {
      id: ulid(), // ULID for business logic
      name: constantName, // Use constant name, not string literal
      displayName: socialMediaTool.name,
      description: socialMediaTool.description || `Social media tool: ${socialMediaTool.name}`,
      category: this.categorizeSocialMediaTool(constantName),
      capabilities: this.getSocialMediaToolCapabilities(constantName),
      parameters: this.convertSocialMediaParameters(socialMediaTool.parameters || {}),
      executor: this.createSocialMediaToolExecutor(socialMediaTool, agentId, connectionIds),
      metadata: {
        version: '1.0.0',
        author: 'social-media-system',
        provider: 'social-media',
        tags: ['social-media', 'integration', 'content'],
        documentation: `Social media tool: ${socialMediaTool.name}`,
        examples: []
      },
      enabled: true,
      status: ToolStatus.ACTIVE
    };
  }

  /**
   * Create social media tool executor that preserves all existing logic
   */
  private createSocialMediaToolExecutor(
    socialMediaTool: any,
    agentId: string,
    connectionIds: string[]
  ) {
    return async (params: ToolParameters, context: ExecutionContext): Promise<ToolResult> => {
      const startTime = Date.now();

      try {
        logger.debug('Executing social media tool', {
          toolName: socialMediaTool.name,
          agentId: context.agentId || agentId,
          params: Object.keys(params),
          connectionCount: connectionIds.length
        });

        // Execute the original social media tool (preserves all logic including approval workflows)
        const result = await socialMediaTool.execute(params, context.agentId || agentId, connectionIds);

        const executionTime = Date.now() - startTime;

        // Convert result to unified format
        return {
          success: true,
          data: result,
          metadata: {
            executionTimeMs: executionTime,
            toolId: ulid(), // Generate ULID for this execution
            toolName: socialMediaTool.name,
            timestamp: new Date().toISOString(),
            context: {
              agentId: context.agentId || agentId,
              socialMediaProvider: 'social-media',
              connectionIds,
              platforms: params.platforms || []
            }
          }
        };

      } catch (error) {
        const executionTime = Date.now() - startTime;

        logger.error('Social media tool execution failed', {
          toolName: socialMediaTool.name,
          agentId: context.agentId || agentId,
          error: error instanceof Error ? error.message : String(error)
        });

        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          metadata: {
            executionTimeMs: executionTime,
            toolId: ulid(),
            toolName: socialMediaTool.name,
            timestamp: new Date().toISOString(),
            context: {
              agentId: context.agentId || agentId,
              socialMediaProvider: 'social-media',
              connectionIds,
              error: true
            }
          }
        };
      }
    };
  }

  /**
   * Map social media tool name to foundation constant
   */
  private mapSocialMediaToolToConstant(socialMediaToolName: string): string | null {
    return SOCIAL_MEDIA_TOOL_MAPPING[socialMediaToolName] || null;
  }

  /**
   * Categorize social media tool based on constant name
   */
  private categorizeSocialMediaTool(constantName: string): ToolCategory {
    if (constantName.includes('create_') || constantName.includes('post') || constantName.includes('schedule')) {
      return ToolCategory.CONTENT_CREATION;
    }
    if (constantName.includes('analytics') || constantName.includes('metrics') || constantName.includes('insights')) {
      return ToolCategory.ANALYTICS;
    }
    if (constantName.includes('comment') || constantName.includes('like') || constantName.includes('mention')) {
      return ToolCategory.COMMUNICATION;
    }
    if (constantName.includes('approval') || constantName.includes('moderate')) {
      return ToolCategory.WORKFLOW;
    }
    if (constantName.includes('tiktok')) {
      return ToolCategory.CONTENT_CREATION;
    }
    return ToolCategory.SOCIAL_MEDIA;
  }

  /**
   * Get tool capabilities based on constant name
   */
  private getSocialMediaToolCapabilities(constantName: string): readonly ToolCapability[] {
    const capabilities: ToolCapability[] = [];

    if (constantName.includes('create_') || constantName.includes('post')) {
      capabilities.push(ToolCapability.CONTENT_CREATION);
    }
    if (constantName.includes('schedule')) {
      capabilities.push(ToolCapability.SCHEDULING);
    }
    if (constantName.includes('analytics') || constantName.includes('metrics')) {
      capabilities.push(ToolCapability.ANALYTICS);
    }
    if (constantName.includes('image') || constantName.includes('video')) {
      capabilities.push(ToolCapability.MEDIA_PROCESSING);
    }
    if (constantName.includes('approval')) {
      capabilities.push(ToolCapability.WORKFLOW_MANAGEMENT);
    }
    if (constantName.includes('cross_platform')) {
      capabilities.push(ToolCapability.MULTI_PLATFORM);
    }

    return capabilities.length > 0 ? capabilities : [ToolCapability.SOCIAL_MEDIA_INTEGRATION];
  }

  /**
   * Convert social media parameters to foundation parameter schema
   */
  private convertSocialMediaParameters(socialMediaParams: any): any {
    // Convert social media parameter format to foundation schema format
    const schema: any = {};

    if (typeof socialMediaParams === 'object' && socialMediaParams !== null) {
      if (socialMediaParams.type === 'object' && socialMediaParams.properties) {
        // Handle existing schema format
        for (const [key, prop] of Object.entries(socialMediaParams.properties)) {
          const propDef = prop as any;
          schema[key] = {
            type: propDef.type || 'string',
            required: socialMediaParams.required?.includes(key) || false,
            description: propDef.description || `Parameter: ${key}`,
            ...(propDef.enum && { validation: { enum: propDef.enum } })
          };
        }
      } else {
        // Handle simple object format
        for (const [key, value] of Object.entries(socialMediaParams)) {
          schema[key] = {
            type: typeof value === 'object' ? 'object' : typeof value,
            required: true, // Default to required for social media tools
            description: `Parameter: ${key}`
          };
        }
      }
    }

    return schema;
  }

  /**
   * Get suggested social media tools for a given tool name
   */
  private async getSuggestedSocialMediaTools(toolName: string): Promise<string[]> {
    try {
      const registeredTools = await this.getRegisteredSocialMediaTools();

      // Simple similarity matching
      const suggestions = registeredTools.filter(registered =>
        registered.toLowerCase().includes(toolName.toLowerCase()) ||
        toolName.toLowerCase().includes(registered.toLowerCase())
      );

      return suggestions.slice(0, 3); // Return top 3 suggestions
    } catch (error) {
      logger.warn('Failed to get social media tool suggestions', {
        toolName,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }
} 