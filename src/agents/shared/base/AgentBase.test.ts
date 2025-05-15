import { describe, it, expect, beforeEach } from 'vitest';
import { AbstractAgentBase } from './AbstractAgentBase';
import { BaseManager, ManagerConfig } from './managers/BaseManager';
import type { AgentBaseConfig } from './types';
import { AgentStatus } from '../../../server/memory/schema/agent';
import { createAgentId, IdGenerator, IdPrefix } from '../../../utils/ulid';
import type { AgentBase } from './AgentBase.interface';
import { ManagerType } from './managers/ManagerType';
import { Tool } from './managers/ToolManager.interface';
import { TaskExecutionResult, TaskCreationResult } from './managers/SchedulerManager.interface';
import { AgentCapability } from './types';
import { DefaultSchedulerManager } from '../../../lib/agents/implementations/managers/DefaultSchedulerManager';
import { ScheduledTask } from './managers/SchedulerManager.interface';
import { ManagerHealth } from './managers/ManagerHealth';

// Create a minimal mock agent that implements AgentBase
const mockConfig = {
  enabled: true,
  id: 'mock-agent',
  type: 'mock',
  name: 'Mock Agent'
};

const mockAgent: AgentBase = {
  getId: () => 'mock-agent',
  getAgentId: () => 'mock-agent',
  getType: () => 'mock',
  getName: () => 'Mock Agent',
  getDescription: () => 'A mock agent for testing',
  getVersion: () => '1.0.0',
  getCapabilities: async () => [],
  getStatus: () => ({ status: 'ready', message: 'Ready' }),
  initialize: async () => true,
  shutdown: async () => {},
  reset: async () => {},
  registerTool: async () => ({ 
    id: 'mock-tool', 
    name: 'Mock Tool', 
    description: 'Mock tool', 
    enabled: true, 
    version: '1.0.0',
    execute: async () => ({}) 
  }),
  unregisterTool: async () => true,
  getTool: async () => null,
  getTools: async () => [],
  setToolEnabled: async () => ({ 
    id: 'mock-tool', 
    name: 'Mock Tool', 
    description: 'Mock tool', 
    enabled: true, 
    version: '1.0.0',
    execute: async () => ({}) 
  }),
  getManager: () => null,
  getManagers: () => [],
  setManager: () => {},
  removeManager: () => {},
  hasManager: () => false,
  createTask: async () => ({ 
    success: true, 
    taskId: 'mock-task',
    task: {
      id: 'mock-task',
      title: 'Mock Task',
      description: 'A mock task for testing',
      type: 'test',
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'pending',
      priority: 0,
      retryAttempts: 0,
      dependencies: [],
      metadata: {}
    }
  }),
  getTask: async () => null,
  getTasks: async () => [],
  executeTask: async () => ({ 
    success: true, 
    taskId: 'mock-task',
    durationMs: 0
  }),
  cancelTask: async () => true,
  retryTask: async () => ({ 
    success: true, 
    taskId: 'mock-task',
    durationMs: 0
  }),
  getConfig: () => mockConfig,
  updateConfig: () => {},
  isEnabled: () => true,
  setEnabled: () => true,
  executePlan: async () => ({ success: true, planId: 'mock-plan' }),
  hasCapability: () => false,
  enableCapability: () => {},
  disableCapability: () => {},
  getHealth: async () => ({ status: 'healthy' }),
  getSchedulerManager: () => undefined,
  initializeManagers: async () => {},
  shutdownManagers: async () => {},
  addMemory: async () => ({
    id: 'mock-memory',
    content: 'Mock memory content',
    createdAt: new Date(),
    lastAccessedAt: new Date(),
    accessCount: 0,
    metadata: {}
  }),
  searchMemories: async () => [],
  getRecentMemories: async () => [],
  consolidateMemories: async () => ({
    success: true,
    consolidatedCount: 0,
    message: 'Memory consolidation completed successfully'
  }),
  pruneMemories: async () => ({
    success: true,
    prunedCount: 0,
    message: 'Memory pruning completed successfully'
  }),
  createPlan: async () => ({ success: true }),
  getPlan: async () => null,
  getAllPlans: async () => [],
  updatePlan: async () => null,
  deletePlan: async () => true,
  adaptPlan: async () => null,
  validatePlan: async () => true,
  optimizePlan: async () => null,
  getToolMetrics: async () => [],
  findBestToolForTask: async () => null,
  loadKnowledge: async () => {},
  searchKnowledge: async () => [],
  addKnowledgeEntry: async () => ({ id: 'mock-entry', title: 'Mock Entry', content: 'Mock content', source: 'test', timestamp: new Date() }),
  getKnowledgeEntry: async () => null,
  updateKnowledgeEntry: async () => ({ id: 'mock-entry', title: 'Mock Entry', content: 'Mock content', source: 'test', timestamp: new Date() }),
  deleteKnowledgeEntry: async () => true,
  getKnowledgeEntries: async () => [],
  identifyKnowledgeGaps: async () => [],
  getKnowledgeGap: async () => null,
  getAllTasks: async () => [],
  updateTask: async () => null,
  deleteTask: async () => true,
  getDueTasks: async () => [],
  getRunningTasks: async () => [],
  getPendingTasks: async () => [],
  getFailedTasks: async () => []
};

class MockManager implements BaseManager {
  public readonly managerId: string;
  public readonly managerType: ManagerType;
  protected _config: ManagerConfig;
  protected _initialized: boolean;
  protected agent: AgentBase;

  constructor(type: ManagerType, agent: AgentBase) {
    this.managerId = `mock-${type}-manager`;
    this.managerType = type;
    this.agent = agent;
    this._config = { enabled: true };
    this._initialized = false;
  }

  getConfig<T extends ManagerConfig>(): T {
    return this._config as T;
  }

  updateConfig<T extends ManagerConfig>(config: Partial<T>): T {
    this._config = {
      ...this._config,
      ...config
    };
    return this._config as T;
  }

  getAgent(): AgentBase {
    return this.agent;
  }

  async initialize(): Promise<boolean> {
    this._initialized = true;
    return true;
  }

  async shutdown(): Promise<void> {
    this._initialized = false;
  }

  isEnabled(): boolean {
    return this._config.enabled;
  }

  setEnabled(enabled: boolean): boolean {
    this._config.enabled = enabled;
    return enabled;
  }

  async reset(): Promise<boolean> {
    this._initialized = false;
    return true;
  }

  async getHealth(): Promise<ManagerHealth> {
    return {
      status: 'healthy',
      details: {
        lastCheck: new Date(),
        issues: []
      }
    };
  }
}

class TestAgent extends AbstractAgentBase {
  async initialize(): Promise<boolean> { return true; }
  async shutdown(): Promise<void> {}
}

describe('AgentBase', () => {
  let agent: AgentBase;
  let managerA: MockManager;
  let managerB: MockManager;

  beforeEach(() => {
    agent = { ...mockAgent };
    managerA = new MockManager(ManagerType.MEMORY, agent);
    managerB = new MockManager(ManagerType.PLANNING, agent);
  });

  describe('manager operations', () => {
    it('should set and get managers', () => {
      agent.setManager(managerA);
      agent.setManager(managerB);

      expect(agent.getManager(ManagerType.MEMORY)).toBe(managerA);
      expect(agent.getManager(ManagerType.PLANNING)).toBe(managerB);
    });

    it('should remove managers', () => {
      agent.setManager(managerA);
      agent.setManager(managerB);

      agent.removeManager(ManagerType.MEMORY);
      expect(agent.getManager(ManagerType.MEMORY)).toBeNull();
      expect(agent.getManager(ManagerType.PLANNING)).toBe(managerB);
    });

    it('should handle manager replacement', () => {
      agent.setManager(managerA);
      const managerA2 = new MockManager(ManagerType.MEMORY, agent);
      agent.setManager(managerA2);

      expect(agent.getManager(ManagerType.MEMORY)).toBe(managerA2);
    });
  });
});