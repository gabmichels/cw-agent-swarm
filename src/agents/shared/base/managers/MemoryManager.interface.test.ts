/**
 * MemoryManager.interface.test.ts - Tests for the MemoryManager interface
 * 
 * This file contains tests to ensure the MemoryManager interface is properly defined
 * and extends the BaseManager interface correctly.
 */

import { describe, it, expect } from 'vitest';
import { MemoryManager, MemoryManagerConfig } from './MemoryManager.interface';
import { BaseManager, AbstractBaseManager } from './BaseManager';
import { AgentBase } from '../AgentBase.interface';
import { ManagerType } from './ManagerType';

describe('MemoryManager interface', () => {
  // Type tests to ensure MemoryManager extends BaseManager
  it('should extend BaseManager interface', () => {
    // Create a type that checks if MemoryManager extends BaseManager
    type CheckMemoryManagerExtendsBaseManager = MemoryManager extends BaseManager ? true : false;
    
    // This assignment will fail compilation if MemoryManager doesn't extend BaseManager
    const extendsBaseManager: CheckMemoryManagerExtendsBaseManager = true;
    
    expect(extendsBaseManager).toBe(true);
  });

  // Testing config type correctly extends ManagerConfig
  it('should have config that extends ManagerConfig', () => {
    // Check that specific MemoryManagerConfig properties are present
    const config: MemoryManagerConfig = {
      enabled: true,
      enableAutoPruning: true,
      pruningIntervalMs: 300000,
      maxShortTermEntries: 100,
      enableAutoConsolidation: true
    };
    
    expect(config.enabled).toBe(true);
    expect(config.enableAutoPruning).toBe(true);
    expect(config.pruningIntervalMs).toBe(300000);
  });

  // Mock implementation to ensure interface can be implemented
  it('should allow implementation of the interface', () => {
    // Create a mock agent
    const mockAgent = {} as AgentBase;
    
    // Create a mock implementation that extends AbstractBaseManager and implements MemoryManager
    class MockMemoryManager extends AbstractBaseManager implements MemoryManager {
      constructor() {
        super('mock-memory-manager', ManagerType.MEMORY, mockAgent, { enabled: true });
      }
      
      async initialize(): Promise<boolean> {
        this.initialized = true;
        return true;
      }
      
      async shutdown(): Promise<void> {
        this.initialized = false;
      }
      
      async addMemory(content: string, metadata?: Record<string, unknown>): Promise<any> {
        return { id: '1', content };
      }
      
      async searchMemories(query: string, options?: any): Promise<any[]> {
        return [];
      }
      
      async getRecentMemories(limit?: number): Promise<any[]> {
        return [];
      }
      
      async consolidateMemories(): Promise<any> {
        return { success: true, consolidatedCount: 0, message: '' };
      }
      
      async pruneMemories(): Promise<any> {
        return { success: true, prunedCount: 0, message: '' };
      }
    }
    
    // Create an instance to confirm the class satisfies the interface
    const memoryManager = new MockMemoryManager();
    expect(memoryManager).toBeDefined();
    expect(memoryManager.getType()).toBe(ManagerType.MEMORY);
  });
}); 