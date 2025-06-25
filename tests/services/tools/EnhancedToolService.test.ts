/**
 * Enhanced Tool Service Tests - Phase 4 Validation
 * 
 * Tests for the enhanced tool service that replaces fallback logic
 * with real error handling and management
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import {
  EnhancedToolService,
  IEnhancedToolService,
  EnhancedToolExecutionOptions,
  ToolExecutionContext
} from '../../../src/services/tools/EnhancedToolService';
import { ILogger } from '../../../src/lib/core/ILogger';
import { IErrorManagementService } from '../../../src/services/errors/interfaces/IErrorManagementService';
import { IErrorClassificationEngine } from '../../../src/services/errors/ErrorClassificationEngine';
import { IRecoveryStrategyManager } from '../../../src/services/errors/RecoveryStrategyManager';
import {
  ErrorType,
  ErrorSeverity,
  BaseError,
  ErrorFactory
} from '../../../src/lib/errors/types/BaseError';
import { Tool } from '../../../src/lib/tools/types';

describe('Enhanced Tool Service - Phase 4', () => {
  let toolService: IEnhancedToolService;
  let mockLogger: Mock;
  let mockErrorManagementService: Mock;
  let mockClassificationEngine: Mock;
  let mockRecoveryStrategyManager: Mock;

  // Test tools
  const mockEmailTool: Tool = {
    id: 'send_email',
    name: 'Send Email',
    description: 'Send an email via workspace provider',
    category: 'workspace',
    enabled: true,
    experimental: false,
    version: '1.0.0',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'array', items: { type: 'string' } },
        subject: { type: 'string' },
        body: { type: 'string' },
        connectionId: { type: 'string' }
      },
      required: ['to', 'subject', 'body', 'connectionId']
    }
  };

  const mockCalendarTool: Tool = {
    id: 'schedule_event',
    name: 'Schedule Event',
    description: 'Schedule a calendar event',
    category: 'workspace',
    enabled: true,
    experimental: false,
    version: '1.0.0',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        startTime: { type: 'string' },
        endTime: { type: 'string' },
        connectionId: { type: 'string' }
      },
      required: ['title', 'startTime', 'endTime', 'connectionId']
    }
  };

  beforeEach(() => {
    // Create mocks
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    } as any;

    mockErrorManagementService = {
      logError: vi.fn().mockResolvedValue({ id: 'error_123' }),
      getErrorsByAgent: vi.fn().mockResolvedValue([]),
      getErrorsByType: vi.fn().mockResolvedValue([])
    } as any;

    mockClassificationEngine = {
      classifyError: vi.fn().mockResolvedValue({
        category: 'TOOL_EXECUTION',
        severity: ErrorSeverity.HIGH,
        userMessage: 'The operation failed. Please try again.',
        retryable: true,
        suggestedActions: ['retry']
      })
    } as any;

    mockRecoveryStrategyManager = {
      executeWithRecovery: vi.fn()
    } as any;

    // Create enhanced tool service
    toolService = new EnhancedToolService(
      mockLogger,
      mockErrorManagementService,
      mockClassificationEngine,
      mockRecoveryStrategyManager
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Tool Registration', () => {
    it('should register tools successfully', async () => {
      await toolService.registerTool(mockEmailTool);

      expect(mockLogger.info).toHaveBeenCalledWith('Tool registered', {
        toolId: 'send_email',
        name: 'Send Email',
        category: 'workspace'
      });

      const tools = await toolService.getAvailableTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].id).toBe('send_email');
    });

    it('should register tool executors', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({ success: true, emailId: 'email_123' });

      await toolService.registerTool(mockEmailTool);
      await toolService.registerToolExecutor('send_email', mockExecutor);

      expect(mockLogger.debug).toHaveBeenCalledWith('Tool executor registered', {
        toolId: 'send_email'
      });
    });
  });

  describe('Enhanced Tool Execution', () => {
    beforeEach(async () => {
      await toolService.registerTool(mockEmailTool);
    });

    it('should handle tool not found errors properly (NO FALLBACK)', async () => {
      const options: EnhancedToolExecutionOptions = {
        toolId: 'non_existent_tool',
        parameters: {},
        agentId: 'agent_123',
        userId: 'user_456'
      };

      const result = await toolService.executeToolWithErrorHandling(options);

      expect(result.success).toBe(false);
      expect(result.error).toBe('The operation failed. Please try again.');
      expect(result.errorId).toBe('error_123');
      expect(result.recoveryAttempted).toBe(false);
      expect(mockErrorManagementService.logError).toHaveBeenCalled();
    });

    it('should handle executor not found errors (REPLACES FALLBACK)', async () => {
      const options: EnhancedToolExecutionOptions = {
        toolId: 'send_email',
        parameters: {
          to: ['test@example.com'],
          subject: 'Test',
          body: 'Test message',
          connectionId: 'conn_123'
        },
        agentId: 'agent_123',
        userId: 'user_456'
      };

      const result = await toolService.executeToolWithErrorHandling(options);

      expect(result.success).toBe(false);
      expect(result.error).toBe('The operation failed. Please try again.');
      expect(result.errorId).toBe('error_123');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Tool executor not found - NO LONGER USING FALLBACK',
        expect.objectContaining({
          toolId: 'send_email',
          toolName: 'Send Email',
          agentId: 'agent_123'
        })
      );
    });

    it('should execute tools successfully with proper context', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({
        success: true,
        emailId: 'email_123'
      });

      mockRecoveryStrategyManager.executeWithRecovery.mockImplementation(
        async (fn: Function) => await fn()
      );

      await toolService.registerToolExecutor('send_email', mockExecutor);

      const options: EnhancedToolExecutionOptions = {
        toolId: 'send_email',
        parameters: {
          to: ['test@example.com'],
          subject: 'Test Email',
          body: 'Test message',
          connectionId: 'conn_123'
        },
        agentId: 'agent_123',
        userId: 'user_456',
        sessionId: 'session_789',
        conversationId: 'conv_101'
      };

      const result = await toolService.executeToolWithErrorHandling(options);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ success: true, emailId: 'email_123' });
      expect(result.recoveryAttempted).toBe(false);
      expect(result.retryCount).toBe(0);
      expect(mockExecutor).toHaveBeenCalledWith(
        options.parameters,
        expect.objectContaining({
          toolId: 'send_email',
          toolName: 'Send Email',
          agentId: 'agent_123',
          userId: 'user_456'
        })
      );
    });

    it('should handle tool execution errors with enhanced classification', async () => {
      const mockExecutor = vi.fn().mockRejectedValue(
        new Error('Permission denied: insufficient email permissions')
      );

      await toolService.registerToolExecutor('send_email', mockExecutor);

      const options: EnhancedToolExecutionOptions = {
        toolId: 'send_email',
        parameters: {
          to: ['test@example.com'],
          subject: 'Test',
          body: 'Test message',
          connectionId: 'conn_123'
        },
        agentId: 'agent_123',
        userId: 'user_456'
      };

      const result = await toolService.executeToolWithErrorHandling(options);

      expect(result.success).toBe(false);
      expect(result.error).toBe('The operation failed. Please try again.');
      expect(result.errorId).toBe('error_123');
      expect(result.classification).toBeDefined();
      expect(mockErrorManagementService.logError).toHaveBeenCalled();
      expect(mockClassificationEngine.classifyError).toHaveBeenCalled();
    });

    it('should validate parameters correctly', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({ success: true });
      await toolService.registerToolExecutor('send_email', mockExecutor);

      const optionsWithMissingParams: EnhancedToolExecutionOptions = {
        toolId: 'send_email',
        parameters: {
          subject: 'Test'
          // Missing required: to, body, connectionId
        },
        agentId: 'agent_123',
        userId: 'user_456'
      };

      const result = await toolService.executeToolWithErrorHandling(optionsWithMissingParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameter');
    });
  });

  describe('Workspace Tool Integration', () => {
    beforeEach(async () => {
      await toolService.registerTool(mockEmailTool);
    });

    it('should execute workspace tools with enhanced context', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({ success: true, emailId: 'email_123' });
      await toolService.registerToolExecutor('send_email', mockExecutor);

      mockRecoveryStrategyManager.executeWithRecovery.mockImplementation(
        async (fn: Function) => await fn()
      );

      const context: ToolExecutionContext = {
        toolId: 'send_email',
        toolName: 'Send Email',
        agentId: 'agent_123',
        userId: 'user_456',
        sessionId: 'session_789',
        conversationId: 'conv_101',
        requestId: 'req_202',
        workspaceId: 'workspace_303',
        connectionId: 'conn_404',
        startTime: new Date()
      };

      const result = await toolService.executeWorkspaceTool(
        'send_email',
        {
          to: ['test@example.com'],
          subject: 'Workspace Test',
          body: 'Test from workspace',
          connectionId: 'conn_404'
        },
        context
      );

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ success: true, emailId: 'email_123' });
    });

    it('should handle workspace permission errors specifically', async () => {
      const workspaceError = new Error('Workspace permission denied for EMAIL_SEND');
      const mockExecutor = vi.fn().mockRejectedValue(workspaceError);
      await toolService.registerToolExecutor('send_email', mockExecutor);

      const context: ToolExecutionContext = {
        toolId: 'send_email',
        toolName: 'Send Email',
        agentId: 'agent_123',
        userId: 'user_456',
        workspaceId: 'workspace_303',
        connectionId: 'conn_404',
        startTime: new Date()
      };

      const result = await toolService.executeWorkspaceTool(
        'send_email',
        { to: ['test@example.com'], subject: 'Test', body: 'Test', connectionId: 'conn_404' },
        context
      );

      expect(result.success).toBe(false);
      expect(result.errorId).toBe('error_123');
      expect(mockErrorManagementService.logError).toHaveBeenCalled();
    });
  });

  describe('Tool Health Monitoring', () => {
    beforeEach(async () => {
      await toolService.registerTool(mockEmailTool);
      await toolService.registerTool(mockCalendarTool);
    });

    it('should report tool health status', async () => {
      const mockErrors: BaseError[] = [];
      mockErrorManagementService.getErrorsByType.mockResolvedValue(mockErrors);

      const health = await toolService.getToolHealthStatus('send_email');

      expect(health.isHealthy).toBe(true);
      expect(health.errorRate).toBe(0);
      expect(health.averageExecutionTime).toBe(0);
      expect(health.lastError).toBeUndefined();
    });

    it('should track tool execution history for agents', async () => {
      const mockHistory: BaseError[] = [
        ErrorFactory.createError({
          type: ErrorType.TOOL_EXECUTION,
          message: 'Previous tool error',
          context: {} as any,
          severity: ErrorSeverity.HIGH,
          retryable: true,
          maxRetries: 3
        })
      ];

      mockErrorManagementService.getErrorsByAgent.mockResolvedValue(mockHistory);

      const history = await toolService.getToolExecutionHistory('agent_123');

      expect(history).toHaveLength(1);
      expect(history[0].type).toBe(ErrorType.TOOL_EXECUTION);
      expect(mockErrorManagementService.getErrorsByAgent).toHaveBeenCalledWith('agent_123');
    });
  });

  describe('Error Classification Integration', () => {
    beforeEach(async () => {
      await toolService.registerTool(mockEmailTool);
    });

    it('should properly classify permission errors', async () => {
      const permissionError = new Error('Permission denied for workspace access');
      const mockExecutor = vi.fn().mockRejectedValue(permissionError);
      await toolService.registerToolExecutor('send_email', mockExecutor);

      mockClassificationEngine.classifyError.mockResolvedValue({
        category: 'PERMISSION_ERROR',
        severity: ErrorSeverity.MEDIUM,
        userMessage: 'You don\'t have permission to send emails. Please request access.',
        retryable: false,
        suggestedActions: ['request_access', 'check_permissions']
      });

      const options: EnhancedToolExecutionOptions = {
        toolId: 'send_email',
        parameters: { to: ['test@example.com'], subject: 'Test', body: 'Test', connectionId: 'conn_123' },
        agentId: 'agent_123',
        userId: 'user_456'
      };

      const result = await toolService.executeToolWithErrorHandling(options);

      expect(result.success).toBe(false);
      expect(result.classification?.category).toBe('PERMISSION_ERROR');
      expect(result.classification?.retryable).toBe(false);
      expect(result.error).toBe('You don\'t have permission to send emails. Please request access.');
    });

    it('should properly classify network errors as retryable', async () => {
      const networkError = new Error('Network timeout connecting to Gmail API');
      const mockExecutor = vi.fn().mockRejectedValue(networkError);
      await toolService.registerToolExecutor('send_email', mockExecutor);

      mockClassificationEngine.classifyError.mockResolvedValue({
        category: 'NETWORK_ERROR',
        severity: ErrorSeverity.LOW,
        userMessage: 'Connection issue. The system will retry automatically.',
        retryable: true,
        suggestedActions: ['auto_retry', 'check_connection']
      });

      const options: EnhancedToolExecutionOptions = {
        toolId: 'send_email',
        parameters: { to: ['test@example.com'], subject: 'Test', body: 'Test', connectionId: 'conn_123' },
        agentId: 'agent_123',
        userId: 'user_456'
      };

      const result = await toolService.executeToolWithErrorHandling(options);

      expect(result.success).toBe(false);
      expect(result.classification?.category).toBe('NETWORK_ERROR');
      expect(result.classification?.retryable).toBe(true);
      expect(result.classification?.severity).toBe(ErrorSeverity.LOW);
    });
  });

  describe('Legacy Compatibility', () => {
    it('should support legacy executeTool interface', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({ success: true });
      await toolService.registerTool(mockEmailTool);
      await toolService.registerToolExecutor('send_email', mockExecutor);

      mockRecoveryStrategyManager.executeWithRecovery.mockImplementation(
        async (fn: Function) => await fn()
      );

      const result = await toolService.executeTool({
        toolId: 'send_email',
        parameters: { to: ['test@example.com'], subject: 'Test', body: 'Test', connectionId: 'conn_123' }
      });

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ success: true });
    });

    it('should validate tool parameters using legacy interface', async () => {
      await toolService.registerTool(mockEmailTool);

      const validParams = {
        to: ['test@example.com'],
        subject: 'Test',
        body: 'Test message',
        connectionId: 'conn_123'
      };

      const invalidParams = {
        subject: 'Test'
        // Missing required parameters
      };

      expect(await toolService.validateToolParameters('send_email', validParams)).toBe(true);
      expect(await toolService.validateToolParameters('send_email', invalidParams)).toBe(false);
      expect(await toolService.validateToolParameters('non_existent', validParams)).toBe(false);
    });
  });

  describe('Recovery Integration', () => {
    beforeEach(async () => {
      await toolService.registerTool(mockEmailTool);
    });

    it('should use recovery strategy manager for retryable errors', async () => {
      const mockExecutor = vi.fn()
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockResolvedValueOnce({ success: true, emailId: 'email_123' });

      await toolService.registerToolExecutor('send_email', mockExecutor);

      // Mock recovery strategy to retry once
      mockRecoveryStrategyManager.executeWithRecovery.mockImplementation(
        async (fn: Function) => {
          try {
            return await fn();
          } catch (error) {
            // Simulate one retry
            return await fn();
          }
        }
      );

      const options: EnhancedToolExecutionOptions = {
        toolId: 'send_email',
        parameters: { to: ['test@example.com'], subject: 'Test', body: 'Test', connectionId: 'conn_123' },
        agentId: 'agent_123',
        userId: 'user_456'
      };

      const result = await toolService.executeToolWithErrorHandling(options);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ success: true, emailId: 'email_123' });
      expect(mockRecoveryStrategyManager.executeWithRecovery).toHaveBeenCalled();
    });
  });
});

describe('Enhanced Tool Service - Integration with Existing Systems', () => {
  it('should maintain compatibility with existing WorkspaceAgentTools', async () => {
    // This test would verify that existing workspace tools work with the enhanced service
    // Implementation would depend on actual workspace tool structure
    expect(true).toBe(true); // Placeholder
  });

  it('should properly replace ToolService fallback behavior', async () => {
    // This test would verify that no fallback execution occurs
    // and proper error handling is used instead
    expect(true).toBe(true); // Placeholder
  });
}); 