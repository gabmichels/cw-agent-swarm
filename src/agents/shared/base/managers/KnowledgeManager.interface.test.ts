/**
 * KnowledgeManager.interface.test.ts - Tests for the KnowledgeManager interface
 * 
 * This file contains tests to ensure the KnowledgeManager interface is properly defined
 * and extends the BaseManager interface correctly.
 */

import { describe, it, expect } from 'vitest';
import { 
  KnowledgeManager, 
  KnowledgeManagerConfig,
  KnowledgeEntry,
  KnowledgeSearchOptions,
  KnowledgeSearchResult,
  KnowledgeGap
} from './KnowledgeManager.interface';
import { BaseManager, AbstractBaseManager } from './BaseManager';
import { AgentBase } from '../AgentBase.interface';
import { ManagerType } from './ManagerType';
import { ManagerHealth } from './ManagerHealth';

describe('KnowledgeManager interface', () => {
  // Mock implementation to ensure interface can be implemented
  class MockKnowledgeManager extends AbstractBaseManager implements KnowledgeManager {
    constructor() {
      super('mock-knowledge-manager', ManagerType.KNOWLEDGE, {} as AgentBase, { enabled: true });
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
        details: {
          lastCheck: new Date(),
          issues: [],
          metrics: {}
        }
      };
    }

    async loadKnowledge(): Promise<void> {
      // Mock implementation
    }

    async searchKnowledge(query: string, options?: KnowledgeSearchOptions): Promise<KnowledgeSearchResult[]> {
      return [{
        entry: {
          id: '1',
          title: 'Mock Entry',
          content: 'Mock content',
          category: 'test',
          tags: ['test'],
          timestamp: new Date(),
          source: 'test',
          metadata: {}
        },
        relevance: 1.0
      }];
    }

    async addKnowledgeEntry(entry: Omit<KnowledgeEntry, 'id' | 'timestamp'>): Promise<KnowledgeEntry> {
      return {
        id: '1',
        timestamp: new Date(),
        title: entry.title,
        content: entry.content,
        category: entry.category,
        tags: entry.tags,
        source: entry.source,
        metadata: entry.metadata || {}
      };
    }

    async getKnowledgeEntry(id: string): Promise<KnowledgeEntry | null> {
      return null;
    }

    async updateKnowledgeEntry(id: string, updates: Partial<KnowledgeEntry>): Promise<KnowledgeEntry> {
      return {
        id,
        title: 'Updated Entry',
        content: 'Updated content',
        category: 'test',
        tags: ['test'],
        timestamp: new Date(),
        source: 'test',
        metadata: {}
      };
    }

    async deleteKnowledgeEntry(id: string): Promise<boolean> {
      return true;
    }

    async getKnowledgeEntries(options?: {
      category?: string;
      tags?: string[];
      source?: string;
      verified?: boolean;
      limit?: number;
      offset?: number;
    }): Promise<KnowledgeEntry[]> {
      return [];
    }

    async identifyKnowledgeGaps(): Promise<KnowledgeGap[]> {
      return [{
        id: '1',
        description: 'Test gap',
        domain: 'test',
        importance: 1,
        status: 'identified',
        identifiedAt: new Date(),
        priority: 1,
        source: 'test',
        metadata: {}
      }];
    }

    async getKnowledgeGap(id: string): Promise<KnowledgeGap | null> {
      return {
        id,
        description: 'Test gap',
        domain: 'test',
        importance: 1,
        status: 'identified',
        identifiedAt: new Date(),
        priority: 1,
        source: 'test',
        metadata: {}
      };
    }

    async reset(): Promise<boolean> {
      // Clear all knowledge and reset state
      this._initialized = false;
      return true;
    }
  }

  it('should extend BaseManager interface', () => {
    // Create a type that checks if KnowledgeManager extends BaseManager
    type CheckKnowledgeManagerExtendsBaseManager = KnowledgeManager extends BaseManager ? true : false;
    const extendsBaseManager: CheckKnowledgeManagerExtendsBaseManager = true;
    expect(extendsBaseManager).toBe(true);
  });

  it('should allow implementation of the interface', () => {
    const knowledgeManager = new MockKnowledgeManager();
    expect(knowledgeManager).toBeDefined();
    expect(knowledgeManager.managerType).toBe(ManagerType.KNOWLEDGE);
  });

  it('should handle initialization correctly', async () => {
    const knowledgeManager = new MockKnowledgeManager();
    const initialized = await knowledgeManager.initialize();
    expect(initialized).toBe(true);
  });

  it('should handle shutdown correctly', async () => {
    const knowledgeManager = new MockKnowledgeManager();
    await knowledgeManager.initialize();
    await knowledgeManager.shutdown();
    expect(knowledgeManager.isEnabled()).toBe(true); // Enabled state is separate from initialization
  });

  it('should have correct manager type', () => {
    const knowledgeManager = new MockKnowledgeManager();
    expect(knowledgeManager.managerType).toBe(ManagerType.KNOWLEDGE);
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

  it('should allow implementation of the interface', () => {
    // Create a mock agent
    const mockAgent = {} as AgentBase;
    
    // Create an instance to confirm the class satisfies the interface
    const knowledgeManager = new MockKnowledgeManager();
    expect(knowledgeManager).toBeDefined();
    expect(knowledgeManager.managerType).toBe(ManagerType.KNOWLEDGE);
  });
}); 