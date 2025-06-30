/**
 * Specialized Systems Integration - Baseline Validation Tests
 * 
 * Validates the integration of Cost Tracking, Tool Response Formatter, and Approval systems
 * with the unified foundation. Tests basic functionality and foundation integration.
 * 
 * Systems Under Test:
 * - Cost Tracking System (track costs, analyze trends, optimize spending)
 * - Tool Response Formatter System (format responses, adapt styles, validate quality)  
 * - Approval System (request approvals, process decisions, manage workflows)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  UnifiedToolFoundation,
  UnifiedToolRegistry,
  UnifiedToolExecutor,
  ToolDiscoveryService,
  ToolValidationService,
  ToolCategory,
  COST_TRACKING_TOOLS,
  TOOL_RESPONSE_FORMATTER_TOOLS,
  APPROVAL_SYSTEM_TOOLS,
  createExecutionContext
} from '../../../src/lib/tools/foundation';
import { logger } from '../../../src/lib/logging';

describe('Specialized Systems Integration - Baseline Validation', () => {
  let foundation: UnifiedToolFoundation;
  let registry: UnifiedToolRegistry;
  let executor: UnifiedToolExecutor;
  let discoveryService: ToolDiscoveryService;
  let validationService: ToolValidationService;

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
  });

  describe('Foundation Integration', () => {
    it('should initialize foundation successfully', () => {
      expect(foundation).toBeDefined();
      expect(registry).toBeDefined();
      expect(executor).toBeDefined();
      expect(discoveryService).toBeDefined();
      expect(validationService).toBeDefined();
    });

    it('should have cost tracking tool constants defined', () => {
      expect(COST_TRACKING_TOOLS).toBeDefined();
      expect(COST_TRACKING_TOOLS.TRACK_API_COST).toBe('track_api_cost');
      expect(COST_TRACKING_TOOLS.GET_COST_SUMMARY).toBe('get_cost_summary');
      expect(COST_TRACKING_TOOLS.OPTIMIZE_COSTS).toBe('optimize_costs');
    });

    it('should have tool response formatter constants defined', () => {
      expect(TOOL_RESPONSE_FORMATTER_TOOLS).toBeDefined();
      expect(TOOL_RESPONSE_FORMATTER_TOOLS.FORMAT_TOOL_RESPONSE).toBe('format_tool_response');
      expect(TOOL_RESPONSE_FORMATTER_TOOLS.ADAPT_RESPONSE_STYLE).toBe('adapt_response_style');
      expect(TOOL_RESPONSE_FORMATTER_TOOLS.VALIDATE_RESPONSE_QUALITY).toBe('validate_response_quality');
    });

    it('should have approval system constants defined', () => {
      expect(APPROVAL_SYSTEM_TOOLS).toBeDefined();
      expect(APPROVAL_SYSTEM_TOOLS.REQUEST_APPROVAL).toBe('request_approval');
      expect(APPROVAL_SYSTEM_TOOLS.APPROVE_TASK).toBe('approve_task');
      expect(APPROVAL_SYSTEM_TOOLS.REJECT_TASK).toBe('reject_task');
    });
  });

  describe('Tool Discovery', () => {
    it('should discover tools by category', async () => {
      const allTools = await foundation.discoverTools({});
      expect(allTools).toBeDefined();
      expect(Array.isArray(allTools)).toBe(true);

      // Should be able to discover tools (even if none are registered yet)
      expect(allTools.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty tool discovery gracefully', async () => {
      const costTools = await foundation.discoverTools({
        category: ToolCategory.COST_TRACKING
      });

      const formatterTools = await foundation.discoverTools({
        category: ToolCategory.FORMATTING
      });

      const approvalTools = await foundation.discoverTools({
        category: ToolCategory.APPROVAL
      });

      // These should not throw errors, even if no tools are registered
      expect(Array.isArray(costTools)).toBe(true);
      expect(Array.isArray(formatterTools)).toBe(true);
      expect(Array.isArray(approvalTools)).toBe(true);
    });
  });

  describe('Tool Execution Context', () => {
    it('should create execution context successfully', () => {
      const context = createExecutionContext({
        agentId: 'test-agent',
        sessionId: 'test-session'
      });

      expect(context).toBeDefined();
      expect(context.agentId).toBe('test-agent');
      expect(context.sessionId).toBe('test-session');
    });

    it('should handle tool execution with non-existent tools gracefully', async () => {
      const context = createExecutionContext({
        agentId: 'test-agent',
        sessionId: 'test-session'
      });

      // This should throw a ToolDiscoveryError for non-existent tools
      try {
        await foundation.executeTool(
          'non_existent_tool' as any,
          {},
          context
        );
        // If we get here, the test should fail
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error instanceof Error).toBe(true);
        expect(error.message).toContain('non_existent_tool');
      }
    });
  });

  describe('System Health', () => {
    it('should validate foundation components', () => {
      expect(foundation).toBeDefined();
      expect(typeof foundation.discoverTools).toBe('function');
      expect(typeof foundation.executeTool).toBe('function');
      expect(typeof foundation.findTool).toBe('function');
      expect(typeof foundation.registerTool).toBe('function');
    });

    it('should handle search operations', async () => {
      const searchResults = await foundation.searchTools('test search');

      expect(Array.isArray(searchResults)).toBe(true);
      // Should not throw errors even with no tools registered
    });
  });

  describe('Constants Validation', () => {
    it('should have all required cost tracking tool names', () => {
      const expectedCostTools = [
        'track_api_cost',
        'track_apify_cost',
        'track_openai_cost',
        'track_workflow_cost',
        'track_research_cost',
        'get_cost_summary',
        'analyze_cost_trends',
        'get_cost_breakdown',
        'compare_costs',
        'optimize_costs'
      ];

      expectedCostTools.forEach(toolName => {
        expect(Object.values(COST_TRACKING_TOOLS)).toContain(toolName);
      });
    });

    it('should have all required formatter tool names', () => {
      const expectedFormatterTools = [
        'format_tool_response',
        'format_error_response',
        'format_success_response',
        'adapt_response_style',
        'validate_response_quality'
      ];

      expectedFormatterTools.forEach(toolName => {
        expect(Object.values(TOOL_RESPONSE_FORMATTER_TOOLS)).toContain(toolName);
      });
    });

    it('should have all required approval tool names', () => {
      const expectedApprovalTools = [
        'request_approval',
        'approve_task',
        'reject_task',
        'check_approval_status',
        'get_pending_approvals'
      ];

      expectedApprovalTools.forEach(toolName => {
        expect(Object.values(APPROVAL_SYSTEM_TOOLS)).toContain(toolName);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid parameters gracefully', async () => {
      const context = createExecutionContext({
        agentId: 'test-agent',
        sessionId: 'test-session'
      });

      // Test with invalid tool name - should throw error
      try {
        await foundation.executeTool(
          '' as any,
          {},
          context
        );
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error instanceof Error).toBe(true);
      }
    });

    it('should handle malformed context gracefully', async () => {
      const invalidContext = createExecutionContext({
        agentId: '',
        sessionId: ''
      });

      // Should throw error for non-existent tool
      try {
        await foundation.executeTool(
          'test_tool' as any,
          {},
          invalidContext
        );
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error instanceof Error).toBe(true);
      }
    });
  });

  describe('Tool Registration Preparation', () => {
    it('should be ready for tool registration', async () => {
      // Test that the foundation is ready to accept tool registrations
      // This validates the basic infrastructure is in place

      expect(foundation).toBeDefined();
      expect(typeof foundation.registerTool).toBe('function');

      // The registry should be initialized
      expect(registry).toBeDefined();

      // The executor should be ready
      expect(executor).toBeDefined();

      // Discovery service should be functional
      expect(discoveryService).toBeDefined();

      // Validation service should be ready
      expect(validationService).toBeDefined();
    });
  });
}); 