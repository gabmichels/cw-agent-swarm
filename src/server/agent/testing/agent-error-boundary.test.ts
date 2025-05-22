/**
 * Tests for the Agent Error Boundary
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { executeWithErrorBoundary, safelyInitializeAgent } from '../agent-error-boundary';
import { AgentBootstrapError } from '../agent-bootstrap-errors';
import { agentBootstrapRegistry } from '../agent-bootstrap-registry';
import { AgentBase } from '../../../agents/shared/base/AgentBase.interface';

// Mock logger
vi.mock('../../../lib/logging', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock agent bootstrap registry
vi.mock('../agent-bootstrap-registry', () => ({
  agentBootstrapRegistry: {
    isAgentRegistered: vi.fn(),
    updateAgentBootstrapState: vi.fn(),
    getAgentBootstrapInfo: vi.fn()
  },
  AgentBootstrapState: {
    FAILED: 'failed'
  }
}));

describe('Agent Error Boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set default mock implementations
    (agentBootstrapRegistry.isAgentRegistered as any).mockReturnValue(true);
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('executeWithErrorBoundary', () => {
    it('should return success result when function succeeds', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      
      const result = await executeWithErrorBoundary(fn, {
        operationName: 'test_operation',
        agentId: 'test-agent-1'
      });
      
      expect(result.success).toBe(true);
      expect(result.value).toBe('success');
      expect(result.operationId).toBeDefined();
      expect(result.timings).toBeDefined();
      expect(result.timings.startTime).toBeInstanceOf(Date);
      expect(result.timings.endTime).toBeInstanceOf(Date);
      expect(result.timings.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });
    
    it('should return error result when function throws', async () => {
      const testError = new Error('Test error');
      const fn = vi.fn().mockRejectedValue(testError);
      
      const result = await executeWithErrorBoundary(fn, {
        operationName: 'test_operation',
        agentId: 'test-agent-1'
      });
      
      expect(result.success).toBe(false);
      expect(result.value).toBeUndefined();
      expect(result.operationId).toBeDefined();
      expect(result.timings).toBeDefined();
      expect(result.error).toBeInstanceOf(AgentBootstrapError);
      expect(result.error?.message).toBe('Test error');
      expect(result.error?.agentId).toBe('test-agent-1');
    });
    
    it('should call onError handler when provided and function throws', async () => {
      const testError = new Error('Test error');
      const fn = vi.fn().mockRejectedValue(testError);
      const onError = vi.fn();
      
      const result = await executeWithErrorBoundary(fn, {
        operationName: 'test_operation',
        agentId: 'test-agent-1',
        onError
      });
      
      expect(result.success).toBe(false);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0]).toBeInstanceOf(AgentBootstrapError);
      expect(onError.mock.calls[0][0].message).toBe('Test error');
    });
    
    it('should handle timeout', async () => {
      // Create a function that doesn't resolve
      const fn = vi.fn().mockImplementation(() => new Promise(() => {}));
      
      const result = await executeWithErrorBoundary(fn, {
        operationName: 'test_operation',
        agentId: 'test-agent-1',
        timeoutMs: 100 // Very short timeout for testing
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(AgentBootstrapError);
      expect(result.error?.message).toContain('timed out');
    });
    
    it('should update agent bootstrap state when function throws', async () => {
      const testError = new Error('Test error');
      const fn = vi.fn().mockRejectedValue(testError);
      
      await executeWithErrorBoundary(fn, {
        operationName: 'test_operation',
        agentId: 'test-agent-1'
      });
      
      expect(agentBootstrapRegistry.updateAgentBootstrapState).toHaveBeenCalledTimes(1);
      expect(agentBootstrapRegistry.updateAgentBootstrapState).toHaveBeenCalledWith(
        'test-agent-1',
        'failed',
        expect.any(AgentBootstrapError)
      );
    });
  });
  
  describe('safelyInitializeAgent', () => {
    it('should successfully initialize agent', async () => {
      // Mock agent with proper typing
      const mockAgent = {
        getAgentId: vi.fn().mockReturnValue('test-agent-1'),
        initialize: vi.fn().mockResolvedValue(true),
        // Add required AgentBase properties
        getId: vi.fn().mockReturnValue('test-agent-1'),
        getType: vi.fn().mockReturnValue('test'),
        getName: vi.fn().mockReturnValue('Test Agent'),
        getDescription: vi.fn().mockReturnValue('Test Agent Description'),
        shutdown: vi.fn().mockResolvedValue(undefined),
        processUserInput: vi.fn().mockResolvedValue({}),
        think: vi.fn().mockResolvedValue({}),
        getLLMResponse: vi.fn().mockResolvedValue({})
      } as unknown as AgentBase;
      
      const result = await safelyInitializeAgent(mockAgent);
      
      expect(result.success).toBe(true);
      expect(result.value).toBe(true);
      expect(mockAgent.initialize).toHaveBeenCalledTimes(1);
    });
    
    it('should handle initialization failure', async () => {
      // Mock agent with failing initialize
      const mockAgent = {
        getAgentId: vi.fn().mockReturnValue('test-agent-1'),
        initialize: vi.fn().mockRejectedValue(new Error('Initialization failed')),
        // Add required AgentBase properties
        getId: vi.fn().mockReturnValue('test-agent-1'),
        getType: vi.fn().mockReturnValue('test'),
        getName: vi.fn().mockReturnValue('Test Agent'),
        getDescription: vi.fn().mockReturnValue('Test Agent Description'),
        shutdown: vi.fn().mockResolvedValue(undefined),
        processUserInput: vi.fn().mockResolvedValue({}),
        think: vi.fn().mockResolvedValue({}),
        getLLMResponse: vi.fn().mockResolvedValue({})
      } as unknown as AgentBase;
      
      const result = await safelyInitializeAgent(mockAgent);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(AgentBootstrapError);
      expect(result.error?.message).toBe('Initialization failed');
      expect(mockAgent.initialize).toHaveBeenCalledTimes(1);
    });
    
    it('should attempt fallback if requested and initialization fails', async () => {
      // Mock agent with failing initialize
      const mockAgent = {
        getAgentId: vi.fn().mockReturnValue('test-agent-1'),
        initialize: vi.fn().mockRejectedValue(new Error('Initialization failed')),
        // Add required AgentBase properties
        getId: vi.fn().mockReturnValue('test-agent-1'),
        getType: vi.fn().mockReturnValue('test'),
        getName: vi.fn().mockReturnValue('Test Agent'),
        getDescription: vi.fn().mockReturnValue('Test Agent Description'),
        shutdown: vi.fn().mockResolvedValue(undefined),
        processUserInput: vi.fn().mockResolvedValue({}),
        think: vi.fn().mockResolvedValue({}),
        getLLMResponse: vi.fn().mockResolvedValue({})
      } as unknown as AgentBase;
      
      const result = await safelyInitializeAgent(mockAgent, {
        operationName: 'test_initialization',
        fallbackOnError: true
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(AgentBootstrapError);
      // We don't have a real fallback implementation in the test, so it should still fail
    });
  });
}); 