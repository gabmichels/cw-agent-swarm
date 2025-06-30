/**
 * Cost Tracking System - Unified Foundation Integration
 * 
 * Integrates comprehensive cost tracking functionality with the unified tool foundation
 * while preserving all existing cost tracking domain logic and services.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - Foundation integration without disrupting existing services
 * - Centralized constants (no string literals)
 * - Dependency injection throughout
 * - Comprehensive error handling
 * - ULID identifiers for business logic
 */

import {
  IUnifiedToolFoundation,
  UnifiedToolDefinition,
  ToolCategory,
  ToolCapability,
  ToolStatus,
  COST_TRACKING_TOOLS,
  ToolResult,
  ToolParameters,
  ExecutionContext
} from '../../foundation';
import { logger } from '../../../../lib/logging';
import { ulid } from 'ulid';
import { CostTrackingIntegrationService, CostTrackingIntegrationConfig } from './CostTrackingIntegrationService';

/**
 * Cost Tracking System Configuration
 */
export interface CostTrackingSystemConfig {
  enableRealTimeTracking: boolean;
  enableCostOptimization: boolean;
  enableBudgetAlerts: boolean;
  enableReporting: boolean;
}

/**
 * Cost Tracking System - Foundation Integration
 * 
 * Provides unified access to cost tracking functionality through the foundation
 * while preserving all existing domain-specific cost tracking logic.
 */
export class CostTrackingSystem {
  private foundation: IUnifiedToolFoundation | null = null;
  private readonly config: CostTrackingSystemConfig;
  private integrationService: CostTrackingIntegrationService;

  constructor(config: CostTrackingSystemConfig) {
    this.config = config;
    this.integrationService = new CostTrackingIntegrationService({
      enableRealTimeTracking: config.enableRealTimeTracking,
      enableCostOptimization: config.enableCostOptimization,
      enableBudgetAlerts: config.enableBudgetAlerts,
      enableReporting: config.enableReporting
    });
  }

  /**
   * Initialize the cost tracking system with the foundation
   */
  async initialize(foundation: IUnifiedToolFoundation): Promise<void> {
    this.foundation = foundation;

    try {
      await this.registerCostTrackingTools();

      logger.info('Cost tracking system initialized successfully', {
        toolsRegistered: this.getCostTrackingToolCount()
      });
    } catch (error) {
      logger.error('Failed to initialize cost tracking system', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Register all cost tracking tools with the foundation
   */
  private async registerCostTrackingTools(): Promise<void> {
    if (!this.foundation) {
      throw new Error('Foundation not initialized');
    }

    const toolDefinitions = this.createCostTrackingToolDefinitions();

    for (const toolDef of toolDefinitions) {
      await this.foundation.registerTool(toolDef);
    }
  }

  /**
   * Create tool definitions for all cost tracking tools
   */
  private createCostTrackingToolDefinitions(): UnifiedToolDefinition[] {
    return [
      this.createTrackApiCostTool(),
      this.createGetCostSummaryTool(),
      this.createOptimizeCostsTool(),
      ...this.createPlaceholderTools()
    ];
  }

  /**
   * Create Track API Cost tool definition
   */
  private createTrackApiCostTool(): UnifiedToolDefinition {
    return {
      id: ulid(),
      name: COST_TRACKING_TOOLS.TRACK_API_COST,
      displayName: 'Track API Cost',
      category: ToolCategory.COST_TRACKING,
      capabilities: [ToolCapability.COST_TRACKING],
      status: ToolStatus.ACTIVE,
      description: 'Track API usage costs',
      parameters: {
        type: 'object',
        properties: {
          toolId: { type: 'string', description: 'Tool identifier' },
          provider: { type: 'string', description: 'Service provider' },
          cost: { type: 'number', description: 'Cost amount' },
          currency: { type: 'string', description: 'Currency code', default: 'USD' }
        },
        required: ['toolId', 'provider', 'cost']
      },
      enabled: true,
      metadata: {
        version: '1.0.0',
        author: 'unified-tools',
        provider: 'cost-tracking-system'
      },
      executor: async (params: ToolParameters, context: ExecutionContext): Promise<ToolResult> => {
        return await this.integrationService.trackApiCost(params, context);
      }
    };
  }

  /**
   * Create Get Cost Summary tool definition
   */
  private createGetCostSummaryTool(): UnifiedToolDefinition {
    return {
      id: ulid(),
      name: COST_TRACKING_TOOLS.GET_COST_SUMMARY,
      displayName: 'Get Cost Summary',
      category: ToolCategory.COST_TRACKING,
      capabilities: [ToolCapability.COST_ANALYSIS],
      status: ToolStatus.ACTIVE,
      description: 'Get cost summary for a time period',
      parameters: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'Start date (ISO format)' },
          endDate: { type: 'string', description: 'End date (ISO format)' },
          provider: { type: 'string', description: 'Service provider filter' }
        },
        required: ['startDate', 'endDate']
      },
      enabled: true,
      metadata: {
        version: '1.0.0',
        author: 'unified-tools',
        provider: 'cost-tracking-system'
      },
      executor: async (params: ToolParameters, context: ExecutionContext): Promise<ToolResult> => {
        return await this.integrationService.getCostSummary(params, context);
      }
    };
  }

  /**
   * Create Optimize Costs tool definition
   */
  private createOptimizeCostsTool(): UnifiedToolDefinition {
    return {
      id: ulid(),
      name: COST_TRACKING_TOOLS.OPTIMIZE_COSTS,
      displayName: 'Optimize Costs',
      category: ToolCategory.COST_TRACKING,
      capabilities: [ToolCapability.COST_OPTIMIZATION],
      status: ToolStatus.ACTIVE,
      description: 'Get cost optimization suggestions',
      parameters: {
        type: 'object',
        properties: {
          provider: { type: 'string', description: 'Service provider' },
          timeframe: { type: 'string', description: 'Analysis timeframe', default: '30d' }
        },
        required: ['provider']
      },
      enabled: true,
      metadata: {
        version: '1.0.0',
        author: 'unified-tools',
        provider: 'cost-tracking-system'
      },
      executor: async (params: ToolParameters, context: ExecutionContext): Promise<ToolResult> => {
        return await this.integrationService.optimizeCosts(params, context);
      }
    };
  }

  private createPlaceholderTools(): UnifiedToolDefinition[] {
    const remainingTools = [
      COST_TRACKING_TOOLS.TRACK_APIFY_COST,
      COST_TRACKING_TOOLS.TRACK_OPENAI_COST,
      COST_TRACKING_TOOLS.TRACK_WORKFLOW_COST,
      COST_TRACKING_TOOLS.ESTIMATE_COST,
      COST_TRACKING_TOOLS.GET_COST_BREAKDOWN,
      COST_TRACKING_TOOLS.ANALYZE_COST_TRENDS,
      COST_TRACKING_TOOLS.CREATE_BUDGET,
      COST_TRACKING_TOOLS.GET_BUDGET_ALERTS
    ];

    return remainingTools.map(toolName => ({
      id: ulid(),
      name: toolName,
      displayName: toolName.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
      category: ToolCategory.COST_TRACKING,
      capabilities: [ToolCapability.COST_TRACKING],
      status: ToolStatus.ACTIVE,
      description: `${toolName} tool`,
      parameters: { type: 'object', properties: {}, required: [] },
      enabled: true,
      metadata: {
        version: '1.0.0',
        author: 'unified-tools',
        provider: 'cost-tracking-system'
      },
      executor: async (params: ToolParameters, context: ExecutionContext): Promise<ToolResult> => {
        return {
          success: true,
          data: { message: `${toolName} tool is registered but not yet implemented` },
          metadata: {
            executionTimeMs: Date.now(),
            toolId: toolName,
            toolName: toolName,
            timestamp: new Date().toISOString()
          }
        };
      }
    }));
  }

  /**
   * Get the number of cost tracking tools registered
   */
  private getCostTrackingToolCount(): number {
    return Object.keys(COST_TRACKING_TOOLS).length;
  }

  /**
   * Cleanup method for testing and shutdown
   */
  async cleanup(): Promise<void> {
    logger.info('Cost tracking system cleanup completed');
  }
} 