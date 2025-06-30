/**
 * Apify Integration Service
 * 
 * Updates existing Apify services to use the unified foundation while
 * maintaining backward compatibility and preserving all domain expertise.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - REPLACE, don't extend - migrate to unified foundation
 * - Preserve domain expertise
 * - Maintain backward compatibility during transition
 * - Use centralized constants
 */

import { UnifiedApifyToolSystem } from './UnifiedApifyToolSystem';
import { IUnifiedToolFoundation } from '../../foundation/interfaces/UnifiedToolFoundationInterface';
import { IApifyManager } from '../../../../agents/shared/tools/integrations/apify/ApifyManager.interface';
import { IStructuredLogger } from '../../../logging/interfaces/IStructuredLogger';
import { APIFY_TOOL_NAMES } from '../../../../constants/tool-names';
import { createExecutionContext } from '../../foundation/utils/ExecutionContextUtils';
import { ToolParameters, ExecutionContext, ToolResult } from '../../foundation/types/FoundationTypes';
import { ToolFoundationError } from '../../foundation/errors/ToolFoundationErrors';

/**
 * Service for integrating Apify tools with the unified foundation
 * 
 * This service acts as a bridge between the existing Apify system and
 * the new unified foundation, ensuring seamless migration.
 */
export class ApifyIntegrationService {
  private unifiedSystem: UnifiedApifyToolSystem | null = null;
  private initialized = false;

  constructor(
    private readonly foundation: IUnifiedToolFoundation,
    private readonly apifyManager: IApifyManager,
    private readonly logger: IStructuredLogger
  ) { }

  /**
   * Initialize the Apify integration with the unified foundation
   */
  async initialize(): Promise<boolean> {
    try {
      this.logger.info('Initializing Apify Integration Service');

      // Create and initialize the unified Apify tool system
      this.unifiedSystem = new UnifiedApifyToolSystem(
        this.foundation,
        this.apifyManager,
        this.logger
      );

      const success = await this.unifiedSystem.initialize();

      if (success) {
        this.initialized = true;
        this.logger.info('Apify Integration Service initialized successfully');
      } else {
        this.logger.error('Failed to initialize Unified Apify Tool System');
      }

      return success;

    } catch (error) {
      this.logger.error('Apify Integration Service initialization failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Execute Apify tool through the unified foundation
   * 
   * This method provides backward compatibility for existing Apify tool calls
   * while routing them through the unified foundation.
   */
  async executeApifyTool(
    toolName: string,
    params: Record<string, any>,
    contextOptions: {
      agentId?: string;
      userId?: string;
      sessionId?: string;
      priority?: 'low' | 'normal' | 'high';
    } = {}
  ): Promise<ToolResult> {
    if (!this.initialized || !this.unifiedSystem) {
      throw new ToolFoundationError('Apify Integration Service not initialized');
    }

    // Validate tool name against constants
    if (!this.isValidApifyToolName(toolName)) {
      throw new ToolFoundationError(`Invalid Apify tool name: ${toolName}`);
    }

    // Create execution context
    const context = createExecutionContext({
      agentId: contextOptions.agentId || 'apify-integration-service',
      userId: contextOptions.userId,
      sessionId: contextOptions.sessionId,
      metadata: {
        priority: contextOptions.priority || 'normal',
        source: 'apify-integration'
      }
    });

    try {
      this.logger.info('Executing Apify tool through unified foundation', {
        toolName,
        contextId: context.traceId || context.sessionId,
        params: Object.keys(params)
      });

      // Execute through unified system
      const result = await this.unifiedSystem.executeTool(toolName, params, context);

      this.logger.info('Apify tool executed successfully through unified foundation', {
        toolName,
        contextId: context.traceId || context.sessionId,
        success: result.success
      });

      return result;

    } catch (error) {
      this.logger.error('Apify tool execution failed through unified foundation', {
        toolName,
        contextId: context.traceId || context.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * Discover Apify actors through the unified foundation
   */
  async discoverActors(
    query: string,
    options: {
      category?: string;
      limit?: number;
      usageTier?: 'free' | 'paid' | 'both';
      agentId?: string;
    } = {}
  ): Promise<ToolResult> {
    return this.executeApifyTool(
      APIFY_TOOL_NAMES.APIFY_ACTOR_DISCOVERY,
      {
        query,
        category: options.category,
        limit: options.limit,
        usageTier: options.usageTier
      },
      { agentId: options.agentId }
    );
  }

  /**
   * Suggest Apify actors for a task through the unified foundation
   */
  async suggestActorsForTask(
    taskDescription: string,
    options: {
      count?: number;
      agentId?: string;
    } = {}
  ): Promise<ToolResult> {
    return this.executeApifyTool(
      APIFY_TOOL_NAMES.APIFY_SUGGEST_ACTORS,
      {
        taskDescription,
        count: options.count
      },
      { agentId: options.agentId }
    );
  }

  /**
   * Run Apify actor dynamically through the unified foundation
   */
  async runActorDynamically(
    actorId: string,
    input: Record<string, any>,
    options: {
      dryRun?: boolean;
      agentId?: string;
      priority?: 'low' | 'normal' | 'high';
    } = {}
  ): Promise<ToolResult> {
    return this.executeApifyTool(
      APIFY_TOOL_NAMES.APIFY_DYNAMIC_RUN,
      {
        actorId,
        input,
        dryRun: options.dryRun
      },
      {
        agentId: options.agentId,
        priority: options.priority || 'high' // Dynamic runs are typically high priority
      }
    );
  }

  /**
   * Get actor information through the unified foundation
   */
  async getActorInfo(
    actorId: string,
    options: {
      agentId?: string;
    } = {}
  ): Promise<ToolResult> {
    return this.executeApifyTool(
      APIFY_TOOL_NAMES.APIFY_ACTOR_INFO,
      { actorId },
      { agentId: options.agentId }
    );
  }

  /**
   * Execute Instagram scraping through the unified foundation
   */
  async scrapeInstagram(
    target: string,
    type: 'posts' | 'hashtag' | 'profile',
    options: {
      limit?: number;
      agentId?: string;
    } = {}
  ): Promise<ToolResult> {
    const toolName = type === 'posts' ? APIFY_TOOL_NAMES.INSTAGRAM_POST_SCRAPER :
      type === 'hashtag' ? APIFY_TOOL_NAMES.INSTAGRAM_HASHTAG_SCRAPER :
        APIFY_TOOL_NAMES.INSTAGRAM_PROFILE_SCRAPER;

    return this.executeApifyTool(
      toolName,
      {
        target,
        limit: options.limit
      },
      { agentId: options.agentId }
    );
  }

  /**
   * Execute Twitter scraping through the unified foundation
   */
  async scrapeTwitter(
    query: string,
    options: {
      limit?: number;
      agentId?: string;
    } = {}
  ): Promise<ToolResult> {
    return this.executeApifyTool(
      APIFY_TOOL_NAMES.APIFY_TWITTER_SEARCH,
      {
        query,
        limit: options.limit
      },
      { agentId: options.agentId }
    );
  }

  /**
   * Execute Reddit scraping through the unified foundation
   */
  async scrapeReddit(
    query: string,
    options: {
      limit?: number;
      agentId?: string;
    } = {}
  ): Promise<ToolResult> {
    return this.executeApifyTool(
      APIFY_TOOL_NAMES.APIFY_REDDIT_SEARCH,
      {
        query,
        limit: options.limit
      },
      { agentId: options.agentId }
    );
  }

  /**
   * Execute LinkedIn scraping through the unified foundation
   */
  async scrapeLinkedIn(
    target: string,
    type: 'company' | 'profile' | 'jobs',
    options: {
      limit?: number;
      agentId?: string;
    } = {}
  ): Promise<ToolResult> {
    const toolName = type === 'company' ? APIFY_TOOL_NAMES.LINKEDIN_COMPANY_SCRAPER :
      type === 'profile' ? APIFY_TOOL_NAMES.LINKEDIN_PROFILE_SCRAPER :
        APIFY_TOOL_NAMES.LINKEDIN_JOBS_SCRAPER;

    return this.executeApifyTool(
      toolName,
      {
        target,
        limit: options.limit
      },
      { agentId: options.agentId }
    );
  }

  /**
   * Get all registered Apify tools from the unified system
   */
  async getRegisteredTools(): Promise<string[]> {
    if (!this.unifiedSystem) {
      throw new ToolFoundationError('Apify Integration Service not initialized');
    }

    return this.unifiedSystem.getRegisteredTools();
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<{
    healthy: boolean;
    initialized: boolean;
    registeredTools: number;
    issues: string[];
  }> {
    const issues: string[] = [];

    if (!this.initialized) {
      issues.push('Integration service not initialized');
    }

    if (!this.unifiedSystem) {
      issues.push('Unified system not created');
    }

    let systemHealth = null;
    if (this.unifiedSystem) {
      systemHealth = await this.unifiedSystem.getSystemHealth();
      issues.push(...systemHealth.issues);
    }

    return {
      healthy: issues.length === 0,
      initialized: this.initialized,
      registeredTools: systemHealth?.registeredTools || 0,
      issues
    };
  }

  /**
   * Validate if a tool name is a valid Apify tool
   */
  private isValidApifyToolName(toolName: string): boolean {
    return Object.values(APIFY_TOOL_NAMES).includes(toolName as any);
  }

  /**
   * Check if the integration service is initialized
   */
  get isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the underlying unified system (for advanced usage)
   */
  get unifiedApifySystem(): UnifiedApifyToolSystem | null {
    return this.unifiedSystem;
  }
} 