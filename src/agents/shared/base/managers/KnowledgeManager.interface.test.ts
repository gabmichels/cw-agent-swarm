/**
 * KnowledgeManager.interface.test.ts - Tests for the KnowledgeManager interface
 * 
 * This file contains tests to ensure the KnowledgeManager interface is properly defined
 * and extends the BaseManager interface correctly.
 */

import { describe, it, expect } from 'vitest';
import { KnowledgeManager, KnowledgeManagerConfig } from './KnowledgeManager.interface';
import { BaseManager, AbstractBaseManager } from './BaseManager';
import { AgentBase } from '../AgentBase.interface';
import { ManagerType } from './ManagerType';

describe('KnowledgeManager interface', () => {
  // Type tests to ensure KnowledgeManager extends BaseManager
  it('should extend BaseManager interface', () => {
    // Create a type that checks if KnowledgeManager extends BaseManager
    type CheckKnowledgeManagerExtendsBaseManager = KnowledgeManager extends BaseManager ? true : false;
    
    // This assignment will fail compilation if KnowledgeManager doesn't extend BaseManager
    const extendsBaseManager: CheckKnowledgeManagerExtendsBaseManager = true;
    
    expect(extendsBaseManager).toBe(true);
  });

  // Testing config type correctly extends ManagerConfig
  it('should have config that extends ManagerConfig', () => {
    // Check that specific KnowledgeManagerConfig properties are present
    const config: KnowledgeManagerConfig = {
      enabled: true,
      enableAutoRefresh: true,
      refreshIntervalMs: 3600000,
      knowledgePaths: ['/knowledge', '/data'],
      maxKnowledgeEntries: 1000,
      allowRuntimeUpdates: true,
      enableGapIdentification: true
    };
    
    expect(config.enabled).toBe(true);
    expect(config.enableAutoRefresh).toBe(true);
    expect(config.knowledgePaths).toEqual(['/knowledge', '/data']);
  });

  // Mock implementation to ensure interface can be implemented
  it('should allow implementation of the interface', () => {
    // Create a mock agent
    const mockAgent = {} as AgentBase;
    
    // Create a mock implementation that extends AbstractBaseManager and implements KnowledgeManager
    class MockKnowledgeManager extends AbstractBaseManager implements KnowledgeManager {
      constructor() {
        super('mock-knowledge-manager', ManagerType.KNOWLEDGE, mockAgent, { enabled: true });
      }
      
      async initialize(): Promise<boolean> {
        this.initialized = true;
        return true;
      }
      
      async shutdown(): Promise<void> {
        this.initialized = false;
      }
      
      async loadKnowledge(): Promise<void> {
        // Implementation would load knowledge
      }
      
      async searchKnowledge(query: string, options?: any): Promise<any[]> {
        return [{ 
          entry: { id: '1', title: 'Test', content: 'Content', source: 'test' },
          relevance: 0.9
        }];
      }
      
      async addKnowledgeEntry(entry: any): Promise<any> {
        return {
          id: '1',
          ...entry,
          timestamp: new Date()
        };
      }
      
      async getKnowledgeEntry(id: string): Promise<any> {
        return { id, title: 'Test', content: 'Content', source: 'test' };
      }
      
      async updateKnowledgeEntry(id: string, updates: any): Promise<any> {
        return { 
          id, 
          ...updates,
          timestamp: new Date()
        };
      }
      
      async deleteKnowledgeEntry(id: string): Promise<boolean> {
        return true;
      }
      
      async getKnowledgeEntries(options?: any): Promise<any[]> {
        return [
          { id: '1', title: 'Test', content: 'Content', source: 'test' }
        ];
      }
      
      async identifyKnowledgeGaps(): Promise<any[]> {
        return [
          { 
            id: '1', 
            description: 'Missing knowledge',
            domain: 'test',
            importance: 0.8,
            status: 'identified',
            identifiedAt: new Date(),
            priority: 0.9,
            source: 'analysis'
          }
        ];
      }
      
      async getKnowledgeGap(id: string): Promise<any> {
        return { 
          id, 
          description: 'Missing knowledge',
          domain: 'test',
          importance: 0.8,
          status: 'identified',
          identifiedAt: new Date(),
          priority: 0.9,
          source: 'analysis'
        };
      }
    }
    
    // Create an instance to confirm the class satisfies the interface
    const knowledgeManager = new MockKnowledgeManager();
    expect(knowledgeManager).toBeDefined();
    expect(knowledgeManager.getType()).toBe(ManagerType.KNOWLEDGE);
  });
}); 