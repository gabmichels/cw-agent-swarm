/**
 * Unit tests for ToolFallbackOrchestrator
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { ToolFallbackOrchestrator } from '../services/tool-fallback-orchestrator';
import { IToolRegistry, IFallbackStrategy, IToolExecutor } from '../interfaces';
import { 
  Tool, 
  ToolCategory,
  FallbackStrategy,
  ToolExecutionResult
} from '../types';
import { IdGenerator } from '../../../utils/ulid';

describe('ToolFallbackOrchestrator', () => {
  // Mock dependencies
  let mockToolRegistry: IToolRegistry;
  let mockFallbackStrategy: IFallbackStrategy;
  let mockToolExecutor: IToolExecutor;
  
  // Orchestrator instance
  let orchestrator: ToolFallbackOrchestrator;
  
  // Mock tools
  let mockTools: Tool[];
  
  // Test execution ID
  const createMockExecutionId = (toolId: string) => IdGenerator.generate(`EXEC_${toolId}`);
  
  beforeEach(() => {
    // Create mock tools
    const createMockTool = (id: string, name: string): Tool => ({
      id,
      name,
      description: `A tool for ${name}`,
      category: ToolCategory.UTILITY,
      enabled: true,
      execute: async () => ({
        id: createMockExecutionId(id),
        toolId: id,
        success: true,
        data: `Result from ${name}`,
        metrics: { startTime: Date.now(), endTime: Date.now(), durationMs: 10 }
      })
    });
    
    mockTools = [
      createMockTool('tool-1', 'Tool 1'),
      createMockTool('tool-2', 'Tool 2'),
      createMockTool('tool-3', 'Tool 3')
    ];
    
    // Create mock tool registry
    mockToolRegistry = {
      registerTool: vi.fn(),
      registerTools: vi.fn(),
      getTool: vi.fn((toolId: string) => {
        return mockTools.find(tool => tool.id === toolId) || null;
      }),
      getAllTools: vi.fn(() => mockTools),
      findTools: vi.fn(),
      hasTool: vi.fn((toolId: string) => mockTools.some(tool => tool.id === toolId)),
      removeTool: vi.fn()
    };
    
    // Create mock fallback strategy
    mockFallbackStrategy = {
      getActiveStrategy: vi.fn(() => FallbackStrategy.SEQUENTIAL),
      setStrategy: vi.fn(),
      determineFallbacks: vi.fn((failedTool: Tool, _result: ToolExecutionResult, availableTools: Tool[]) => {
        return availableTools.filter(tool => tool.id !== failedTool.id);
      }),
      recordExecutionOutcome: vi.fn(),
      getToolSuccessRate: vi.fn(),
      calculateToolSimilarity: vi.fn()
    };
    
    // Create mock tool executor
    mockToolExecutor = {
      executeTool: vi.fn(async (tool: Tool) => {
        const success = tool.id !== 'tool-3'; // Make tool-3 always fail for testing
        return {
          id: createMockExecutionId(tool.id),
          toolId: tool.id,
          success,
          ...(success 
            ? { data: `Result from ${tool.name}` }
            : { error: { code: 'ERROR', message: `Error from ${tool.name}` } }
          ),
          metrics: { startTime: Date.now(), endTime: Date.now(), durationMs: 10 }
        };
      }),
      validateArguments: vi.fn(() => ({ valid: true })),
      retryExecution: vi.fn(),
      cancelExecution: vi.fn(),
      isExecutionInProgress: vi.fn()
    };
    
    // Create orchestrator instance
    orchestrator = new ToolFallbackOrchestrator(
      mockToolRegistry,
      mockFallbackStrategy,
      mockToolExecutor
    );
  });
  
  test('should provide access to dependencies', () => {
    expect(orchestrator.getToolRegistry()).toBe(mockToolRegistry);
    expect(orchestrator.getFallbackStrategy()).toBe(mockFallbackStrategy);
    expect(orchestrator.getToolExecutor()).toBe(mockToolExecutor);
  });
  
  test('should execute tool successfully without fallback', async () => {
    const result = await orchestrator.executeWithFallback('tool-1', { param: 'value' });
    
    // Should have called registry to get the tool
    expect(mockToolRegistry.getTool).toHaveBeenCalledWith('tool-1');
    
    // Should have called executor to execute the tool
    expect(mockToolExecutor.executeTool).toHaveBeenCalledWith(
      mockTools[0],
      { param: 'value' },
      undefined
    );
    
    // Should have recorded the outcome
    expect(mockFallbackStrategy.recordExecutionOutcome).toHaveBeenCalledWith(
      mockTools[0],
      expect.objectContaining({ toolId: 'tool-1', success: true })
    );
    
    // Should return the result with fallback info
    expect(result).toEqual(expect.objectContaining({
      toolId: 'tool-1',
      success: true,
      data: 'Result from Tool 1',
      fromFallback: false,
      originalToolId: 'tool-1',
      fallbacksAttempted: 0
    }));
  });
  
  test('should handle tool not found', async () => {
    const result = await orchestrator.executeWithFallback('non-existent-tool', {});
    
    // Should have called registry to get the tool
    expect(mockToolRegistry.getTool).toHaveBeenCalledWith('non-existent-tool');
    
    // Should not have called executor
    expect(mockToolExecutor.executeTool).not.toHaveBeenCalled();
    
    // Should return an error result
    expect(result).toEqual(expect.objectContaining({
      toolId: 'non-existent-tool',
      success: false,
      error: expect.objectContaining({
        code: 'TOOL_NOT_FOUND',
        message: 'Tool with ID non-existent-tool not found'
      }),
      fromFallback: false,
      originalToolId: 'non-existent-tool',
      fallbacksAttempted: 0
    }));
  });
  
  test('should use fallback when primary tool fails', async () => {
    // Execute a tool that will fail (tool-3)
    const result = await orchestrator.executeWithFallback('tool-3', { param: 'value' });
    
    // Should have called registry to get the tool
    expect(mockToolRegistry.getTool).toHaveBeenCalledWith('tool-3');
    
    // Should have called executor to execute the tool
    expect(mockToolExecutor.executeTool).toHaveBeenCalledWith(
      mockTools[2],
      { param: 'value' },
      undefined
    );
    
    // Should have called for fallbacks
    expect(mockFallbackStrategy.determineFallbacks).toHaveBeenCalledWith(
      mockTools[2],
      expect.objectContaining({ toolId: 'tool-3', success: false }),
      mockTools
    );
    
    // Should have tried fallbacks - in this case, just 2 tools in total (original + fallback)
    expect(mockToolExecutor.executeTool).toHaveBeenCalledTimes(2); // Original + 1 fallback
    
    // Should return the result with fallback info
    expect(result).toEqual(expect.objectContaining({
      toolId: 'tool-1', // First fallback
      success: true,
      data: 'Result from Tool 1',
      fromFallback: true,
      originalToolId: 'tool-3',
      fallbacksAttempted: 1
    }));
  });
  
  test('should respect disableFallbacks option', async () => {
    // Execute a tool that will fail (tool-3) with fallbacks disabled
    const result = await orchestrator.executeWithFallback('tool-3', { param: 'value' }, { disableFallbacks: true });
    
    // Should have called executor to execute the tool
    expect(mockToolExecutor.executeTool).toHaveBeenCalledWith(
      mockTools[2],
      { param: 'value' },
      { disableFallbacks: true }
    );
    
    // Should not have called for fallbacks
    expect(mockFallbackStrategy.determineFallbacks).not.toHaveBeenCalled();
    
    // Should return the original failed result
    expect(result).toEqual(expect.objectContaining({
      toolId: 'tool-3',
      success: false,
      error: expect.objectContaining({
        message: 'Error from Tool 3'
      }),
      fromFallback: false,
      originalToolId: 'tool-3',
      fallbacksAttempted: 0
    }));
  });
  
  test('should respect maxFallbacks option', async () => {
    // Execute a tool that will fail (tool-3) with max 1 fallback
    const result = await orchestrator.executeWithFallback('tool-3', { param: 'value' }, { maxFallbacks: 1 });
    
    // Should have called for fallbacks
    expect(mockFallbackStrategy.determineFallbacks).toHaveBeenCalled();
    
    // Should have tried only 1 fallback
    expect(mockToolExecutor.executeTool).toHaveBeenCalledTimes(2); // Original + 1 fallback
    
    // Should return the result from the first fallback
    expect(result).toEqual(expect.objectContaining({
      success: true,
      fromFallback: true,
      originalToolId: 'tool-3',
      fallbacksAttempted: 1
    }));
  });
  
  test('should get tool execution history', async () => {
    // Execute a tool to populate history
    await orchestrator.executeWithFallback('tool-1', { param: 'value' });
    
    // Get history
    const history = await orchestrator.getToolExecutionHistory('tool-1');
    
    // Should return history for the tool
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(expect.objectContaining({
      toolId: 'tool-1',
      success: true,
      originalToolId: 'tool-1',
      fromFallback: false
    }));
  });
  
  test('should get empty history for tool without executions', async () => {
    const history = await orchestrator.getToolExecutionHistory('tool-2');
    expect(history).toHaveLength(0);
  });
  
  test('should get execution statistics', async () => {
    // Execute tools to populate statistics
    await orchestrator.executeWithFallback('tool-1', { param: 'value' });
    await orchestrator.executeWithFallback('tool-3', { param: 'value' });
    
    // Get statistics
    const stats = await orchestrator.getExecutionStatistics();
    
    // Should return statistics for executed tools
    expect(Object.keys(stats)).toContain('tool-1');
    expect(Object.keys(stats)).toContain('tool-3');
    // Since in our test we're only executing one fallback, not tool-2
    // tool-1 is used as the fallback for tool-3
    
    // Check tool-1 statistics
    expect(stats['tool-1']).toEqual(expect.objectContaining({
      totalExecutions: 2, // One direct execution + one as fallback
      successRate: 1, // All successful
      fallbackRate: 0.5 // Half as fallback
    }));
    
    // Check tool-3 statistics
    expect(stats['tool-3']).toEqual(expect.objectContaining({
      totalExecutions: 1,
      successRate: 0, // Always fails
      fallbackRate: 0 // Never used as fallback
    }));
  });
}); 