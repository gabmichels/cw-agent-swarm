/**
 * ToolManager.interface.test.ts - Tests for the ToolManager interface
 * 
 * This file contains tests to ensure the ToolManager interface is properly defined
 * and extends the BaseManager interface correctly.
 */

import { describe, it, expect } from 'vitest';
import { ToolManager, ToolManagerConfig, Tool } from './ToolManager.interface';
import { BaseManager, AbstractBaseManager } from './BaseManager';
import { AgentBase } from '../AgentBase.interface';
import { ManagerType } from './ManagerType';
import { ManagerHealth } from './ManagerHealth';

describe('ToolManager interface', () => {
  // Type tests to ensure ToolManager extends BaseManager
  it('should extend BaseManager interface', () => {
    // Create a type that checks if ToolManager extends BaseManager
    type CheckToolManagerExtendsBaseManager = ToolManager extends BaseManager ? true : false;
    
    // This assignment will fail compilation if ToolManager doesn't extend BaseManager
    const extendsBaseManager: CheckToolManagerExtendsBaseManager = true;
    
    expect(extendsBaseManager).toBe(true);
  });

  // Testing config type correctly extends ManagerConfig
  it('should have config that extends ManagerConfig', () => {
    // Check that specific ToolManagerConfig properties are present
    const config: ToolManagerConfig = {
      enabled: true,
      defaultToolTimeoutMs: 5000,
      maxToolRetries: 3,
      trackToolPerformance: true,
      useAdaptiveToolSelection: true
    };
    
    expect(config.enabled).toBe(true);
    expect(config.defaultToolTimeoutMs).toBe(5000);
    expect(config.maxToolRetries).toBe(3);
  });

  // Mock implementation to ensure interface can be implemented
  it('should allow implementation of the interface', () => {
    // Create a mock agent
    const mockAgent = {} as AgentBase;
    
    // Create a simple mock tool
    const mockTool: Tool = {
      id: 'mock-tool',
      name: 'Mock Tool',
      description: 'A mock tool for testing',
      version: '1.0.0',
      enabled: true,
      execute: async (params: unknown) => ({ result: 'success' })
    };
    
    // Create a mock implementation that extends AbstractBaseManager and implements ToolManager
    class MockToolManager extends AbstractBaseManager implements ToolManager {
      constructor() {
        super('mock-tool-manager', ManagerType.TOOL, mockAgent, { enabled: true });
      }
      
      async initialize(): Promise<boolean> {
        this._initialized = true;
        return true;
      }
      
      async shutdown(): Promise<void> {
        this._initialized = false;
      }

      async getHealth(): Promise<ManagerHealth> {
        return {
          status: 'healthy',
          message: 'Tool manager is healthy',
          details: {
            lastCheck: new Date(),
            issues: []
          }
        };
      }

      getType(): ManagerType {
        return ManagerType.TOOL;
      }
      
      async registerTool(tool: Tool): Promise<Tool> {
        return tool;
      }
      
      async unregisterTool(toolId: string): Promise<boolean> {
        return true;
      }
      
      async getTool(toolId: string): Promise<Tool | null> {
        return toolId === mockTool.id ? mockTool : null;
      }
      
      async getTools(): Promise<Tool[]> {
        return [mockTool];
      }
      
      async setToolEnabled(toolId: string, enabled: boolean): Promise<Tool> {
        return { ...mockTool, enabled };
      }
      
      async executeTool(toolId: string, params: unknown): Promise<any> {
        return { 
          toolId, 
          success: true, 
          result: 'Tool executed successfully',
          durationMs: 100,
          startedAt: new Date()
        };
      }
      
      async getToolMetrics(): Promise<any[]> {
        return [];
      }
      
      async findBestToolForTask(): Promise<Tool | null> {
        return mockTool;
      }
    }
    
    // Create an instance to confirm the class satisfies the interface
    const toolManager = new MockToolManager();
    expect(toolManager).toBeDefined();
    expect(toolManager.getType()).toBe(ManagerType.TOOL);
  });
}); 