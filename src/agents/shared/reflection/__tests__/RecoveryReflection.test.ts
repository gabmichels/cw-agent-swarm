import { AgentBase } from "../..";
import { ManagerType } from "../../base/managers/ManagerType";
import { DefaultReflectionManager } from "../managers";
import { BaseManager } from "../../base/managers/BaseManager";
import { TaskCreationResult, TaskExecutionResult, ScheduledTask } from "../../base/managers/SchedulerManager.interface";
import { MemoryEntry } from "../../base/managers/MemoryManager.interface";
import { AbstractAgentBase } from "../../base/AbstractAgentBase";
import { AgentMemoryEntity, AgentCapability, AgentParameters, AgentMetadata, AgentStatus } from "../../../../server/memory/schema/agent";
import { ReflectionInsight } from "../../base/managers/ReflectionManager.interface";

interface ReflectionInsightMetadata {
  source: string;
  applicationStatus: string;
  category: string;
  relatedInsights: string[];
}

// Mock agent implementation for testing
class MockAgent extends AbstractAgentBase {
  private reflectionManager: DefaultReflectionManager;
  private agentId: string = 'mock-agent';
  
  constructor() {
    // Create minimal config for AbstractAgentBase
    const config: AgentMemoryEntity = {
      id: 'mock-agent',
      name: 'MockAgent',
      type: 'mock',
      description: 'Mock agent for testing',
      createdBy: 'test',
      capabilities: [],
      parameters: {
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 2048,
        tools: [],
        customInstructions: '',
        contextWindow: 4096,
        systemMessages: []
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
      },
      content: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      schemaVersion: '1.0'
    };

    super(config);

    this.reflectionManager = new DefaultReflectionManager(this, {
      enabled: true,
      reflectionFrequency: {
        afterErrors: true,
        minIntervalMs: 0 // No delay for testing
      },
      adaptiveBehavior: true
    });
    
    this.managers.set(ManagerType.REFLECTION, this.reflectionManager);
  }
  
  // Required AgentBase methods
  getAgentId(): string { return this.agentId; }
  getId(): string { return this.agentId; }
  getType(): string { return 'mock'; }
  getName(): string { return 'MockAgent'; }
  getDescription(): string { return 'Mock agent for testing'; }
  getVersion(): string { return '1.0.0'; }
  getCapabilities(): Promise<string[]> { return Promise.resolve([]); }
  getConfig(): Record<string, unknown> { return {}; }
  getState(): Record<string, unknown> { return {}; }
  getStatus(): { status: string; message?: string } { return { status: 'available' }; }
  
  // Manager-related methods
  getManager<T extends BaseManager>(type: ManagerType): T | null {
    return (this.managers.get(type) as T) || null;
  }
  
  registerManager<T extends BaseManager>(manager: T): T {
    this.managers.set(manager.managerType, manager);
    return manager;
  }
  
  unregisterManager(type: ManagerType): boolean {
    return this.managers.delete(type);
  }
  
  getManagers(): BaseManager[] {
    return Array.from(this.managers.values());
  }
  
  // Initialization and shutdown
  async initialize(): Promise<boolean> {
    return this.reflectionManager.initialize();
  }
  
  async shutdown(): Promise<void> {}
  async reset(): Promise<void> {}
  
  // Task-related methods
  async createTask(options: Record<string, unknown>): Promise<TaskCreationResult> {
    const task: ScheduledTask = {
      id: 'mock-task',
      title: 'Mock Task',
      description: 'A mock task for testing',
      type: 'test',
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'pending',
      priority: 1,
      retryAttempts: 0,
      dependencies: [],
      metadata: {}
    };
    
    return {
      success: true,
      task
    };
  }
  
  async getTask(taskId: string): Promise<Record<string, unknown> | null> {
    return null;
  }
  
  async executeTask(taskId: string): Promise<TaskExecutionResult> {
    return {
      success: true,
      taskId,
      durationMs: 0
    };
  }
  
  async cancelTask(taskId: string): Promise<boolean> {
    return true;
  }
  
  async retryTask(taskId: string): Promise<TaskExecutionResult> {
    return {
      success: true,
      taskId,
      durationMs: 0
    };
  }
  
  async getTasks(): Promise<Record<string, unknown>[]> {
    return [];
  }
  
  // Memory-related methods
  async addMemory(content: string, metadata: Record<string, unknown>): Promise<MemoryEntry> {
    return {
      id: 'mock-memory',
      content,
      metadata,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      accessCount: 0
    };
  }
  
  async getMemories(options?: Record<string, unknown>): Promise<MemoryEntry[]> {
    return [];
  }
  
  async searchMemories(query: string, options?: Record<string, unknown>): Promise<MemoryEntry[]> {
    return [];
  }
  
  // Processing methods
  async processInput(input: string, context?: Record<string, unknown>): Promise<string | null> {
    return null;
  }
}

describe('RecoveryReflection', () => {
  let mockAgent: MockAgent;
  let reflectionManager: DefaultReflectionManager;

  beforeEach(async () => {
    mockAgent = new MockAgent();
    await mockAgent.initialize();
    reflectionManager = mockAgent.getManager<DefaultReflectionManager>(ManagerType.REFLECTION)!;
  });

  afterEach(async () => {
    await mockAgent.shutdown();
  });

  describe('Error Recovery Reflection', () => {
    it('should track error recovery reflection and generate insights', async () => {
      // Simulate an error and recovery context
      const error = new Error('Task execution failed');
      const recoveryContext = {
        taskId: 'test-task-1',
        errorCategory: 'execution_error',
        attemptCount: 1,
        previousActions: []
      };
      const recoveryResult = {
        success: true,
        action: {
          type: 'retry',
          description: 'Retried task execution'
        }
      };

      // Trigger reflection through private method
      const reflection = await (reflectionManager as any).generateErrorReflectionInsights({
        id: 'test-reflection-1',
        timestamp: new Date(),
        trigger: 'error',
        context: {
          error,
          recoveryContext,
          recoveryResult
        },
        depth: 'standard'
      });

      // Verify insights were generated
      expect(reflection).toBeDefined();
      expect(reflection.length).toBeGreaterThan(0);
      
      // Verify insight types and content
      const insights = reflection.map((i: ReflectionInsight) => i.type);
      expect(insights).toContain('learning');
      expect(insights).toContain('improvement');
    });

    it('should analyze patterns across multiple error recoveries', async () => {
      // Simulate multiple error recoveries for the same task
      const taskId = 'test-task-2';
      const errorCategory = 'api_error';

      // First error recovery
      const reflection1 = await (reflectionManager as any).trackErrorRecoveryReflection(
        'reflection-1',
        {
          recoveryContext: { taskId, errorCategory },
          recoveryResult: { success: true }
        },
        [{ id: 'insight-1', type: 'learning' }]
      );

      // Second error recovery
      const reflection2 = await (reflectionManager as any).trackErrorRecoveryReflection(
        'reflection-2',
        {
          recoveryContext: { taskId, errorCategory },
          recoveryResult: { success: true }
        },
        [{ id: 'insight-2', type: 'learning' }]
      );

      // Verify pattern analysis was triggered
      const errorRecoveries = (reflectionManager as any).errorRecoveryReflections.get(taskId);
      expect(errorRecoveries).toBeDefined();
      expect(errorRecoveries.length).toBe(2);
    });

    it('should adapt behavior based on successful recoveries', async () => {
      // Add multiple successful recoveries
      const taskId = 'test-task-3';
      for (let i = 0; i < 3; i++) {
        await (reflectionManager as any).trackErrorRecoveryReflection(
          `reflection-${i}`,
          {
            recoveryContext: { 
              taskId,
              errorCategory: 'network_error'
            },
            recoveryResult: { success: true }
          },
          [{ 
            id: `insight-${i}`,
            type: 'learning',
            content: `Recovery insight ${i}`
          }]
        );
      }

      // Trigger behavior adaptation
      const adapted = await reflectionManager.adaptBehavior();
      expect(adapted).toBe(true);
    });

    it('should generate comprehensive insights for error reflections', async () => {
      const error = new Error('API request failed');
      const recoveryContext = {
        taskId: 'test-task-4',
        errorCategory: 'api_error',
        attemptCount: 2,
        previousActions: [
          { type: 'retry', result: 'failed' }
        ]
      };
      const recoveryResult = {
        success: true,
        action: {
          type: 'fallback',
          description: 'Used fallback API endpoint'
        }
      };

      const insights = await (reflectionManager as any).generateErrorReflectionInsights({
        id: 'test-reflection-4',
        timestamp: new Date(),
        trigger: 'error',
        context: {
          error,
          recoveryContext,
          recoveryResult
        },
        depth: 'deep'
      });

      // Verify comprehensive insights
      expect(insights.length).toBeGreaterThanOrEqual(3); // Should have error, recovery, and recommendation insights
      
      // Verify insight relationships
      const insightIds = new Set(insights.map((i: ReflectionInsight) => i.id));
      const hasRelatedInsights = insights.some((i: ReflectionInsight) => {
        const metadata = i.metadata as unknown as { relatedInsights?: string[] };
        return metadata.relatedInsights?.some(relatedId => insightIds.has(relatedId));
      });
      expect(hasRelatedInsights).toBe(true);
    });
  });
});