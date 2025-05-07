/**
 * Unit tests for FallbackStrategy
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { FallbackStrategy } from '../services/fallback-strategy';
import { Tool, ToolCategory, FallbackStrategy as StrategyEnum } from '../types';
import { IdGenerator } from '../../../utils/ulid';

describe('FallbackStrategy', () => {
  let strategy: FallbackStrategy;
  let mockTool: Tool;
  let mockTools: Tool[];
  
  beforeEach(() => {
    strategy = new FallbackStrategy();
    
    // Create a mock tool for testing
    const createMockTool = (id: string, name: string, category: ToolCategory = ToolCategory.UTILITY): Tool => ({
      id,
      name,
      description: `A tool for ${name}`,
      category,
      enabled: true,
      execute: async () => ({
        id: IdGenerator.generate(`EXEC_${id}`),
        toolId: id,
        success: true,
        data: 'result',
        metrics: { startTime: Date.now(), endTime: Date.now(), durationMs: 10 }
      })
    });
    
    mockTool = createMockTool('test-tool-1', 'Test Tool 1');
    
    // Create an array of mock tools
    mockTools = [
      mockTool,
      createMockTool('test-tool-2', 'Test Tool 2'),
      createMockTool('test-tool-3', 'Test Tool 3', ToolCategory.SYSTEM),
      createMockTool('test-tool-4', 'Test Tool 4', ToolCategory.FILE),
      createMockTool('test-tool-5', 'Test Tool 5')
    ];
    
    // Disable one tool for testing
    mockTools[3].enabled = false;
  });
  
  test('should use the default strategy (SEQUENTIAL)', () => {
    expect(strategy.getActiveStrategy()).toBe(StrategyEnum.SEQUENTIAL);
  });
  
  test('should set and get strategy', () => {
    strategy.setStrategy(StrategyEnum.SIMILARITY);
    expect(strategy.getActiveStrategy()).toBe(StrategyEnum.SIMILARITY);
    
    strategy.setStrategy(StrategyEnum.PERFORMANCE);
    expect(strategy.getActiveStrategy()).toBe(StrategyEnum.PERFORMANCE);
  });
  
  test('should determine sequential fallbacks correctly', () => {
    const failedTool = mockTools[0];
    const failedResult = {
      id: IdGenerator.generate(`EXEC_${failedTool.id}`),
      toolId: failedTool.id,
      success: false,
      error: { message: 'Failed', code: 'ERROR' },
      metrics: { startTime: Date.now(), endTime: Date.now(), durationMs: 10 }
    };
    
    // Set SEQUENTIAL strategy
    strategy.setStrategy(StrategyEnum.SEQUENTIAL);
    
    // Get fallbacks
    const fallbacks = strategy.determineFallbacks(failedTool, failedResult, mockTools);
    
    // Should include all enabled tools except the failed one
    expect(fallbacks).toHaveLength(3); // 5 total, 1 failed, 1 disabled
    expect(fallbacks).not.toContain(failedTool);
    expect(fallbacks).not.toContain(mockTools[3]); // disabled tool
    expect(fallbacks[0]).toEqual(mockTools[1]);
    expect(fallbacks[1]).toEqual(mockTools[2]);
    expect(fallbacks[2]).toEqual(mockTools[4]);
  });
  
  test('should determine similarity fallbacks correctly', () => {
    const failedTool = mockTools[0];
    const failedResult = {
      id: IdGenerator.generate(`EXEC_${failedTool.id}`),
      toolId: failedTool.id,
      success: false,
      error: { message: 'Failed', code: 'ERROR' },
      metrics: { startTime: Date.now(), endTime: Date.now(), durationMs: 10 }
    };
    
    // Set SIMILARITY strategy
    strategy.setStrategy(StrategyEnum.SIMILARITY);
    
    // Get fallbacks
    const fallbacks = strategy.determineFallbacks(failedTool, failedResult, mockTools);
    
    // Should include all enabled tools except the failed one
    expect(fallbacks).toHaveLength(3); // 5 total, 1 failed, 1 disabled
    expect(fallbacks).not.toContain(failedTool);
    expect(fallbacks).not.toContain(mockTools[3]); // disabled tool
  });
  
  test('should determine performance fallbacks correctly', () => {
    const failedTool = mockTools[0];
    const failedResult = {
      id: IdGenerator.generate(`EXEC_${failedTool.id}`),
      toolId: failedTool.id,
      success: false,
      error: { message: 'Failed', code: 'ERROR' },
      metrics: { startTime: Date.now(), endTime: Date.now(), durationMs: 10 }
    };
    
    // Record some execution outcomes
    strategy.recordExecutionOutcome(mockTools[1], {
      id: IdGenerator.generate(`EXEC_${mockTools[1].id}`),
      toolId: mockTools[1].id,
      success: true,
      metrics: { startTime: Date.now(), endTime: Date.now(), durationMs: 10 }
    });
    
    strategy.recordExecutionOutcome(mockTools[2], {
      id: IdGenerator.generate(`EXEC_${mockTools[2].id}`),
      toolId: mockTools[2].id,
      success: false,
      error: { message: 'Failed', code: 'ERROR' },
      metrics: { startTime: Date.now(), endTime: Date.now(), durationMs: 10 }
    });
    
    strategy.recordExecutionOutcome(mockTools[4], {
      id: IdGenerator.generate(`EXEC_${mockTools[4].id}`),
      toolId: mockTools[4].id,
      success: true,
      metrics: { startTime: Date.now(), endTime: Date.now(), durationMs: 15 }
    });
    
    // Set PERFORMANCE strategy
    strategy.setStrategy(StrategyEnum.PERFORMANCE);
    
    // Get fallbacks
    const fallbacks = strategy.determineFallbacks(failedTool, failedResult, mockTools);
    
    // Should include all enabled tools except the failed one
    expect(fallbacks).toHaveLength(3); // 5 total, 1 failed, 1 disabled
    expect(fallbacks).not.toContain(failedTool);
    expect(fallbacks).not.toContain(mockTools[3]); // disabled tool
    
    // Tool 1 and 4 have 100% success rate, Tool 2 has 0%
    // Check first two are the successful ones
    expect(fallbacks[0].id).toEqual(expect.stringMatching(/test-tool-(1|4)/));
    expect(fallbacks[1].id).toEqual(expect.stringMatching(/test-tool-(1|4)/));
  });
  
  test('should return empty array with NONE strategy', () => {
    const failedTool = mockTools[0];
    const failedResult = {
      id: IdGenerator.generate(`EXEC_${failedTool.id}`),
      toolId: failedTool.id,
      success: false,
      error: { message: 'Failed', code: 'ERROR' },
      metrics: { startTime: Date.now(), endTime: Date.now(), durationMs: 10 }
    };
    
    // Set NONE strategy
    strategy.setStrategy(StrategyEnum.NONE);
    
    // Get fallbacks
    const fallbacks = strategy.determineFallbacks(failedTool, failedResult, mockTools);
    
    // Should be empty
    expect(fallbacks).toHaveLength(0);
  });
  
  test('should record execution outcomes correctly', () => {
    const tool = mockTools[0];
    
    // Record a successful execution
    strategy.recordExecutionOutcome(tool, {
      id: IdGenerator.generate(`EXEC_${tool.id}`),
      toolId: tool.id,
      success: true,
      metrics: { startTime: Date.now(), endTime: Date.now(), durationMs: 10 }
    });
    
    // Success rate should be 100%
    expect(strategy.getToolSuccessRate(tool.id)).toBe(1);
    
    // Record a failed execution
    strategy.recordExecutionOutcome(tool, {
      id: IdGenerator.generate(`EXEC_${tool.id}`),
      toolId: tool.id,
      success: false,
      error: { message: 'Failed', code: 'ERROR' },
      metrics: { startTime: Date.now(), endTime: Date.now(), durationMs: 10 }
    });
    
    // Success rate should be 50%
    expect(strategy.getToolSuccessRate(tool.id)).toBe(0.5);
  });
  
  test('should return null success rate for tool without execution history', () => {
    expect(strategy.getToolSuccessRate('non-existent-tool')).toBeNull();
  });
  
  test('should calculate tool similarity correctly', () => {
    const similarity = strategy.calculateToolSimilarity(mockTools[0].id, mockTools[1].id);
    
    // Should return a number between 0 and 1
    expect(typeof similarity).toBe('number');
    expect(similarity).toBeGreaterThanOrEqual(0);
    expect(similarity).toBeLessThanOrEqual(1);
    
    // Calling again should return the same value (cached)
    const similarityAgain = strategy.calculateToolSimilarity(mockTools[0].id, mockTools[1].id);
    expect(similarityAgain).toBe(similarity);
  });
}); 