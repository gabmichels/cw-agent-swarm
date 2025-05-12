import { describe, it, expect, beforeEach } from 'vitest';
import { AbstractAgentBase } from './AgentBase';
import { AbstractBaseManager, ManagerConfig } from './managers/BaseManager';
import type { AgentBaseConfig } from './types';
import { AgentStatus } from '../../../server/memory/schema/agent';
import { createAgentId, IdGenerator, IdPrefix } from '../../../utils/ulid';
import { AgentBase } from './AgentBase';

// Create a minimal mock agent that implements AgentBase
const mockAgent: AgentBase = {
  getAgentId: () => 'mock-agent',
  getName: () => 'Mock Agent',
  getConfig: () => mockConfig,
  updateConfig: () => {},
  initialize: async () => true,
  shutdown: async () => {},
  registerManager: (manager) => manager,
  getManager: () => undefined,
  getManagers: () => [],
  isEnabled: () => true,
  setEnabled: () => true,
  hasCapability: () => false,
  enableCapability: () => {},
  disableCapability: () => {},
  getHealth: async () => ({ status: 'healthy' }),
  getSchedulerManager: () => undefined,
  initializeManagers: async () => {},
  shutdownManagers: async () => {}
};

class MockManager extends AbstractBaseManager {
  private shutdownCalled = false;

  constructor(type: string) {
    super(
      `${type}-id`,
      type,
      mockAgent,
      { enabled: true }
    );
  }

  async initialize(): Promise<boolean> {
    this.initialized = true;
    return true;
  }

  async shutdown(): Promise<void> {
    this.shutdownCalled = true;
  }

  wasShutdown(): boolean {
    return this.shutdownCalled;
  }
}

// Create a complete mock config with all required fields
const mockConfig: AgentBaseConfig = {
  id: IdGenerator.generate(IdPrefix.AGENT),
  name: 'Test',
  description: 'Test agent',
  content: '',
  type: 'agent',
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'system',
  schemaVersion: '1.0.0',
  capabilities: [],
  parameters: {
    model: 'test-model',
    temperature: 0.7,
    maxTokens: 1000,
    tools: []
  },
  status: AgentStatus.AVAILABLE,
  lastActive: new Date(),
  chatIds: [],
  teamIds: [],
  metadata: {
    tags: [],
    domain: [],
    specialization: [],
    performanceMetrics: {
      successRate: 0,
      averageResponseTime: 0,
      taskCompletionRate: 0
    },
    version: '1.0.0',
    isPublic: false
  }
};

class TestAgent extends AbstractAgentBase {
  async initialize(): Promise<boolean> { return true; }
  async shutdown(): Promise<void> {}
}

describe('AgentBase manager lifecycle', () => {
  let agent: TestAgent;
  let managerA: MockManager;
  let managerB: MockManager;

  beforeEach(() => {
    agent = new TestAgent(mockConfig);
    managerA = new MockManager('memory');
    managerB = new MockManager('planning');
  });

  it('registers and retrieves managers by type', () => {
    agent.registerManager(managerA);
    agent.registerManager(managerB);
    expect(agent.getManager('memory')).toBe(managerA);
    expect(agent.getManager('planning')).toBe(managerB);
    expect(agent.getManagers().length).toBe(2);
  });

  it('initializes all registered managers', async () => {
    agent.registerManager(managerA);
    agent.registerManager(managerB);
    await agent.initializeManagers();
    expect(managerA.isInitialized()).toBe(true);
    expect(managerB.isInitialized()).toBe(true);
  });

  it('shuts down all registered managers', async () => {
    agent.registerManager(managerA);
    agent.registerManager(managerB);
    await agent.initializeManagers();
    await agent.shutdownManagers();
    expect(managerA.wasShutdown()).toBe(true);
    expect(managerB.wasShutdown()).toBe(true);
  });

  it('replaces manager if type already exists', () => {
    const managerA2 = new MockManager('memory');
    agent.registerManager(managerA);
    agent.registerManager(managerA2);
    expect(agent.getManagers().length).toBe(1);
    expect(agent.getManager('memory')).toBe(managerA2);
  });
}); 