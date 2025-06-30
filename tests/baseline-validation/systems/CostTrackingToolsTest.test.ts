/**
 * Cost Tracking Tools - Baseline Validation Tests
 * 
 * Validates the integration of cost tracking tools with the unified foundation.
 * Ensures all cost tracking functionality is properly registered and accessible.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  UnifiedToolFoundation,
  UnifiedToolRegistry,
  UnifiedToolExecutor,
  ToolDiscoveryService,
  ToolValidationService,
  ToolCategory,
  ToolCapability,
  COST_TRACKING_TOOLS,
  createExecutionContext
} from '../../../src/lib/tools/foundation';
import {
  CostTrackingSystem,
  CostTrackingIntegrationService,
  CostTrackingSystemConfig
} from '../../../src/lib/tools/systems/cost-tracking';
import { logger } from '../../../src/lib/logging';
import { PrismaClient } from '@prisma/client';

describe('Cost Tracking Tools - Baseline Validation', () => {
  let foundation: UnifiedToolFoundation;
  let registry: UnifiedToolRegistry;
  let executor: UnifiedToolExecutor;
  let discoveryService: ToolDiscoveryService;
  let validationService: ToolValidationService;
  let costTrackingSystem: CostTrackingSystem;
  let integrationService: CostTrackingIntegrationService;
  let mockPrisma: PrismaClient;

  beforeEach(async () => {
    // Initialize foundation components
    registry = new UnifiedToolRegistry(logger);
    validationService = new ToolValidationService(logger);
    executor = new UnifiedToolExecutor(registry, validationService, logger);
    discoveryService = new ToolDiscoveryService(registry, logger);

    // Create foundation instance
    foundation = new UnifiedToolFoundation(
      registry,
      executor,
      discoveryService,
      validationService,
      logger
    );

    // Create mock Prisma client
    mockPrisma = {} as PrismaClient;

    // Configure cost tracking system
    const config: CostTrackingSystemConfig = {
      prisma: mockPrisma,
      enableRealTimeCostTracking: true,
      enableCostOptimization: true,
      enableBudgetAlerts: true,
      costTrackingOptions: {
        trackApifyCosts: true,
        trackOpenAICosts: true,
        trackWorkflowCosts: true,
        trackResearchCosts: true,
        enableCostEstimation: true
      }
    };

    // Initialize cost tracking system
    costTrackingSystem = new CostTrackingSystem(config);
    await costTrackingSystem.initialize(foundation);

    // Create integration service
    integrationService = new CostTrackingIntegrationService(foundation, mockPrisma);
  });

  afterEach(async () => {
    await costTrackingSystem.cleanup();
  });

  describe('System Integration', () => {
    it('should initialize cost tracking system successfully', () => {
      expect(costTrackingSystem).toBeDefined();
      expect(integrationService).toBeDefined();
    });

    it('should register all cost tracking tools with foundation', async () => {
      const registeredTools = await foundation.discoverTools({});
      const costTrackingToolNames = registeredTools
        .map(tool => tool.name)
        .filter(name => Object.values(COST_TRACKING_TOOLS).includes(name as any));

      expect(costTrackingToolNames.length).toBeGreaterThan(0);
      expect(costTrackingToolNames).toContain(COST_TRACKING_TOOLS.TRACK_API_COST);
      expect(costTrackingToolNames).toContain(COST_TRACKING_TOOLS.TRACK_APIFY_COST);
      expect(costTrackingToolNames).toContain(COST_TRACKING_TOOLS.GET_COST_SUMMARY);
      expect(costTrackingToolNames).toContain(COST_TRACKING_TOOLS.OPTIMIZE_COSTS);
    });

    it('should validate all registered cost tracking tools', async () => {
      const allTools = await foundation.discoverTools({});
      const costTrackingTools = allTools.filter(tool =>
        Object.values(COST_TRACKING_TOOLS).includes(tool.name as any)
      );

      for (const tool of costTrackingTools) {
        const validation = await validationService.validateTool(tool);
        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      }
    });
  });

  describe('Tool Discovery', () => {
    it('should discover cost tracking tools by category', async () => {
      const costTools = await foundation.discoverTools({
        category: ToolCategory.COST_TRACKING
      });

      expect(costTools.length).toBeGreaterThan(0);

      const toolNames = costTools.map(tool => tool.name);
      expect(toolNames).toContain(COST_TRACKING_TOOLS.TRACK_API_COST);
      expect(toolNames).toContain(COST_TRACKING_TOOLS.GET_COST_SUMMARY);
    });

    it('should discover cost tracking tools by capability', async () => {
      const costTrackingTools = await foundation.discoverTools({
        capabilities: [ToolCapability.COST_TRACKING]
      });

      expect(costTrackingTools.length).toBeGreaterThan(0);

      const toolNames = costTrackingTools.map(tool => tool.name);
      expect(toolNames).toContain(COST_TRACKING_TOOLS.TRACK_API_COST);
      expect(toolNames).toContain(COST_TRACKING_TOOLS.TRACK_APIFY_COST);
    });

    it('should find specific cost tracking tools', async () => {
      const trackApiCostTool = await foundation.findTool(COST_TRACKING_TOOLS.TRACK_API_COST);
      expect(trackApiCostTool).not.toBeNull();
      expect(trackApiCostTool?.name).toBe(COST_TRACKING_TOOLS.TRACK_API_COST);
      expect(trackApiCostTool?.category).toBe(ToolCategory.COST_TRACKING);

      const getCostSummaryTool = await foundation.findTool(COST_TRACKING_TOOLS.GET_COST_SUMMARY);
      expect(getCostSummaryTool).not.toBeNull();
      expect(getCostSummaryTool?.name).toBe(COST_TRACKING_TOOLS.GET_COST_SUMMARY);
    });

    it('should perform semantic search for cost-related tools', async () => {
      const costRelatedTools = await foundation.searchTools('cost tracking analysis');

      expect(costRelatedTools.length).toBeGreaterThan(0);

      const toolNames = costRelatedTools.map(result => result.tool.name).filter(name => name);
      expect(toolNames.some(name => name.includes('cost') || name.includes('track'))).toBe(true);
    });
  });

  describe('Tool Execution', () => {
    it('should execute track API cost tool', async () => {
      const context = createExecutionContext({
        agentId: 'test-agent',
        sessionId: 'test-session'
      });

      const params = {
        service: 'openai',
        operation: 'chat_completion',
        costUsd: 0.05,
        unitsConsumed: 1000,
        unitType: 'tokens',
        initiatedBy: { type: 'agent', id: 'test-agent' }
      };

      const result = await foundation.executeTool(
        COST_TRACKING_TOOLS.TRACK_API_COST,
        params,
        context
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.metadata?.toolId).toBe(COST_TRACKING_TOOLS.TRACK_API_COST);
    });

    it('should execute track Apify cost tool', async () => {
      const context = createExecutionContext({
        agentId: 'test-agent',
        sessionId: 'test-session'
      });

      const params = {
        toolName: 'web-search',
        operation: 'search',
        resultsCount: 50,
        executionTimeMs: 5000,
        success: true,
        initiatedBy: { type: 'agent', id: 'test-agent' }
      };

      const result = await foundation.executeTool(
        COST_TRACKING_TOOLS.TRACK_APIFY_COST,
        params,
        context
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.metadata?.toolId).toBe(COST_TRACKING_TOOLS.TRACK_APIFY_COST);
    });

    it('should execute get cost summary tool', async () => {
      const context = createExecutionContext({
        agentId: 'test-agent',
        sessionId: 'test-session'
      });

      const params = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        groupBy: 'service'
      };

      const result = await foundation.executeTool(
        COST_TRACKING_TOOLS.GET_COST_SUMMARY,
        params,
        context
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.metadata?.toolId).toBe(COST_TRACKING_TOOLS.GET_COST_SUMMARY);
    });

    it('should execute optimize costs tool', async () => {
      const context = createExecutionContext({
        agentId: 'test-agent',
        sessionId: 'test-session'
      });

      const params = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        minSavings: 10
      };

      const result = await foundation.executeTool(
        COST_TRACKING_TOOLS.OPTIMIZE_COSTS,
        params,
        context
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.metadata?.toolId).toBe(COST_TRACKING_TOOLS.OPTIMIZE_COSTS);
    });
  });

  describe('Integration Service', () => {
    it('should track API cost through integration service', async () => {
      const context = createExecutionContext({
        agentId: 'test-agent',
        sessionId: 'test-session'
      });

      const params = {
        service: 'openai',
        operation: 'embedding',
        costUsd: 0.01,
        initiatedBy: { type: 'user', id: 'test-user' }
      };

      const result = await integrationService.trackApiCost(params, context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should get cost summary through integration service', async () => {
      const context = createExecutionContext({
        agentId: 'test-agent',
        sessionId: 'test-session'
      });

      const params = {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };

      const result = await integrationService.getCostSummary(params, context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should estimate costs for different operation types', async () => {
      const apifyEstimate = await integrationService.estimateCost({
        operationType: 'apify',
        operationParams: {
          toolName: 'web-search',
          expectedResults: 100,
          estimatedTimeMs: 10000
        }
      });

      expect(apifyEstimate.estimatedCost).toBeGreaterThan(0);
      expect(apifyEstimate.confidence).toBeDefined();

      const openaiEstimate = await integrationService.estimateCost({
        operationType: 'openai',
        operationParams: {
          model: 'gpt-4',
          inputTokens: 1000,
          outputTokens: 500
        }
      });

      expect(openaiEstimate.estimatedCost).toBeGreaterThan(0);
      expect(openaiEstimate.confidence).toBeDefined();
    });

    it('should get cost tracking status', async () => {
      const status = await integrationService.getCostTrackingStatus();

      expect(status.enabled).toBe(true);
      expect(status.services).toBeDefined();
      expect(status.services.apify).toBe(true);
      expect(status.services.openai).toBe(true);
      expect(status.totalCostsToday).toBeGreaterThanOrEqual(0);
      expect(status.budgetStatus).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid parameters gracefully', async () => {
      const context = createExecutionContext({
        agentId: 'test-agent',
        sessionId: 'test-session'
      });

      const invalidParams = {
        // Missing required fields
      };

      try {
        await foundation.executeTool(
          COST_TRACKING_TOOLS.TRACK_API_COST,
          invalidParams,
          context
        );
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle tool execution failures', async () => {
      const context = createExecutionContext({
        agentId: 'test-agent',
        sessionId: 'test-session'
      });

      // This should not throw but return a failed result
      const result = await foundation.executeTool(
        'non_existent_cost_tool' as any,
        {},
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Cross-System Integration', () => {
    it('should work with other tool systems', async () => {
      // Test that cost tracking tools can be discovered alongside other tools
      const allTools = await foundation.discoverTools({});
      const costTools = allTools.filter(tool =>
        Object.values(COST_TRACKING_TOOLS).includes(tool.name as any)
      );

      expect(costTools.length).toBeGreaterThan(0);
      expect(allTools.length).toBeGreaterThan(costTools.length); // Should have other tools too
    });

    it('should maintain tool isolation', async () => {
      // Cost tracking tools should not interfere with other tool categories
      const costTools = await foundation.discoverTools({
        category: ToolCategory.COST_TRACKING
      });

      for (const tool of costTools) {
        expect(tool.category).toBe(ToolCategory.COST_TRACKING);
      }
    });
  });

  describe('Health and Monitoring', () => {
    it('should report system health', async () => {
      const status = await integrationService.getCostTrackingStatus();

      expect(status.enabled).toBe(true);
      expect(status.services).toBeDefined();
      expect(Object.keys(status.services).length).toBeGreaterThan(0);
    });

    it('should track tool usage metrics', async () => {
      const context = createExecutionContext({
        agentId: 'test-agent',
        sessionId: 'test-session'
      });

      const result = await foundation.executeTool(
        COST_TRACKING_TOOLS.TRACK_API_COST,
        {
          service: 'test',
          operation: 'test',
          costUsd: 0.01,
          initiatedBy: { type: 'system', id: 'test' }
        },
        context
      );

      expect(result.metadata?.executionTime).toBeDefined();
      expect(result.metadata?.toolId).toBe(COST_TRACKING_TOOLS.TRACK_API_COST);
    });
  });
}); 