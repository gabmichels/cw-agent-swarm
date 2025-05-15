/**
 * Unit tests for ToolRegistry
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { ToolRegistry } from '../services/tool-registry';
import { Tool, ToolCategory } from '../types';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  let mockTool: Tool;
  
  beforeEach(() => {
    registry = new ToolRegistry();
    
    // Create a mock tool for testing
    mockTool = {
      id: 'test-tool-1',
      name: 'Test Tool 1',
      description: 'A tool for testing',
      category: ToolCategory.UTILITY,
      enabled: true,
      execute: async () => ({
        id: {
          namespace: 'EXEC',
          type: 'EXEC',
          id: 'exec-1',
          prefix: 'EXEC',
          timestamp: new Date(),
          toString: () => 'EXEC_exec-1',
          toULID: () => 'exec-1',
          getTimestamp: () => new Date()
        },
        toolId: 'test-tool-1',
        success: true,
        data: 'test result',
        metrics: { startTime: Date.now(), endTime: Date.now(), durationMs: 10 }
      })
    };
  });
  
  test('should register a tool successfully', () => {
    registry.registerTool(mockTool);
    
    const retrieved = registry.getTool(mockTool.id);
    expect(retrieved).toEqual(mockTool);
  });
  
  test('should throw when registering a duplicate tool', () => {
    registry.registerTool(mockTool);
    
    expect(() => {
      registry.registerTool(mockTool);
    }).toThrow(`Tool with ID ${mockTool.id} is already registered`);
  });
  
  test('should throw when registering an invalid tool', () => {
    const invalidTool = { ...mockTool, id: '' };
    
    expect(() => {
      registry.registerTool(invalidTool);
    }).toThrow('Tool is missing required properties');
  });
  
  test('should register multiple tools', () => {
    const mockTool2 = { ...mockTool, id: 'test-tool-2', name: 'Test Tool 2' };
    
    registry.registerTools([mockTool, mockTool2]);
    
    expect(registry.getTool(mockTool.id)).toEqual(mockTool);
    expect(registry.getTool(mockTool2.id)).toEqual(mockTool2);
  });
  
  test('should get all registered tools', () => {
    const mockTool2 = { ...mockTool, id: 'test-tool-2', name: 'Test Tool 2' };
    
    registry.registerTools([mockTool, mockTool2]);
    
    const allTools = registry.getAllTools();
    expect(allTools).toHaveLength(2);
    expect(allTools).toEqual(expect.arrayContaining([mockTool, mockTool2]));
  });
  
  test('should find tools by criteria', () => {
    const mockTool2 = { ...mockTool, id: 'test-tool-2', name: 'Test Tool 2', enabled: false };
    const mockTool3 = { ...mockTool, id: 'test-tool-3', name: 'Test Tool 3', category: ToolCategory.SYSTEM };
    
    registry.registerTools([mockTool, mockTool2, mockTool3]);
    
    // Find by enabled status
    const enabledTools = registry.findTools({ enabled: true });
    expect(enabledTools).toHaveLength(2);
    expect(enabledTools).toEqual(expect.arrayContaining([mockTool, mockTool3]));
    
    // Find by category
    const utilityTools = registry.findTools({ category: ToolCategory.UTILITY });
    expect(utilityTools).toHaveLength(2);
    expect(utilityTools).toEqual(expect.arrayContaining([mockTool, mockTool2]));
    
    // Find by multiple criteria
    const enabledUtilityTools = registry.findTools({ enabled: true, category: ToolCategory.UTILITY });
    expect(enabledUtilityTools).toHaveLength(1);
    expect(enabledUtilityTools[0]).toEqual(mockTool);
  });
  
  test('should check if a tool exists', () => {
    registry.registerTool(mockTool);
    
    expect(registry.hasTool(mockTool.id)).toBe(true);
    expect(registry.hasTool('non-existent-tool')).toBe(false);
  });
  
  test('should remove a tool', () => {
    registry.registerTool(mockTool);
    
    expect(registry.removeTool(mockTool.id)).toBe(true);
    expect(registry.hasTool(mockTool.id)).toBe(false);
    expect(registry.getTool(mockTool.id)).toBeNull();
  });
  
  test('should handle removing a non-existent tool', () => {
    expect(registry.removeTool('non-existent-tool')).toBe(false);
  });
}); 