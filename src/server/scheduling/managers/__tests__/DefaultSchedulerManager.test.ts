import { describe, it, expect } from 'vitest';
import { DefaultSchedulerManager } from '../../../../lib/agents/implementations/managers/DefaultSchedulerManager';
import { SchedulerManagerConfig } from '../../../../agents/shared/base/managers/SchedulerManager.interface';
import { AgentBase } from '../../../../agents/shared/base/AgentBase.interface';
import { ManagerType } from '../../../../agents/shared/base/managers/ManagerType';
import { BaseManager } from '../../../../agents/shared/base/managers/BaseManager';
import { Tool } from '../../../../agents/shared/base/managers/ToolManager.interface';
import { MemoryEntry, MemoryConsolidationResult, MemoryPruningResult } from '../../../../agents/shared/base/managers/MemoryManager';
import { Plan, PlanCreationOptions, PlanCreationResult, PlanExecutionResult } from '../../../../agents/shared/base/managers/PlanningManager.interface';
import { KnowledgeEntry, KnowledgeSearchOptions, KnowledgeSearchResult, KnowledgeGap } from '../../../../agents/shared/base/managers/KnowledgeManager.interface';
import { ScheduledTask, TaskCreationOptions, TaskCreationResult, TaskExecutionResult } from '../../../../agents/shared/base/managers/SchedulerManager.interface';

// Mock agent for testing
const mockAgent: AgentBase = {
  getId: () => 'test-agent',
  getAgentId: () => 'test-agent',
  getType: () => 'test',
  getName: () => 'Test Agent',
  getDescription: () => 'Test agent for unit tests',
  getVersion: () => '1.0.0',
  getCapabilities: async () => [],
  getStatus: () => ({ status: 'AVAILABLE' }),
  initialize: async () => true,
  shutdown: async () => {},
  reset: async () => {},
  registerTool: async (tool: Tool) => tool,
  unregisterTool: async () => true,
  getTool: async () => null,
  getTools: async () => [],
  setToolEnabled: async (toolId: string, enabled: boolean) => ({ id: toolId, enabled } as Tool),
  getManager: <T extends BaseManager>(type: ManagerType): T | null => null,
  getManagers: () => [],
  setManager: () => {},
  removeManager: () => {},
  hasManager: () => false,
  createTask: async () => ({ success: true, task: {} as ScheduledTask }),
  getTask: async () => null,
  getTasks: async () => [],
  executeTask: async () => ({ success: true, taskId: '', durationMs: 0 }),
  cancelTask: async () => true,
  retryTask: async () => ({ success: true, taskId: '', durationMs: 0 }),
  getConfig: () => ({ id: 'test-agent', name: 'Test Agent', capabilities: [], status: 'AVAILABLE' }),
  updateConfig: () => {},
  isEnabled: () => true,
  setEnabled: () => true,
  hasCapability: () => false,
  enableCapability: () => {},
  disableCapability: () => {},
  getHealth: async () => ({ status: 'healthy' as const, details: { lastCheck: new Date(), issues: [] } }),
  getSchedulerManager: () => undefined,
  initializeManagers: async () => {},
  shutdownManagers: async () => {},
  addMemory: async () => ({} as MemoryEntry),
  searchMemories: async () => [],
  getRecentMemories: async () => [],
  consolidateMemories: async () => ({} as MemoryConsolidationResult),
  pruneMemories: async () => ({} as MemoryPruningResult),
  createPlan: async () => ({} as PlanCreationResult),
  getPlan: async () => null,
  getAllPlans: async () => [],
  updatePlan: async () => null,
  deletePlan: async () => true,
  executePlan: async () => ({} as PlanExecutionResult),
  adaptPlan: async () => null,
  validatePlan: async () => true,
  optimizePlan: async () => null,
  getToolMetrics: async () => [],
  findBestToolForTask: async () => null,
  loadKnowledge: async () => {},
  searchKnowledge: async () => [],
  addKnowledgeEntry: async () => ({} as KnowledgeEntry),
  getKnowledgeEntry: async () => null,
  updateKnowledgeEntry: async () => ({} as KnowledgeEntry),
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
  getFailedTasks: async () => [],
  processUserInput: async (message: string) => ({
    content: 'Test response to: ' + message,
    thoughts: ['Test thought'],
    metadata: {}
  }),
  think: async (message: string) => ({
    intent: { primary: 'test-intent', confidence: 1.0 },
    entities: [],
    reasoning: ['Test reasoning'],
    complexity: 1,
    priority: 1,
    context: {},
    shouldDelegate: false,
    requiredCapabilities: [],
    isUrgent: false,
    contextUsed: {
      memories: [],
      files: [],
      tools: []
    }
  }),
  getLLMResponse: async (message: string) => ({
    content: 'Test LLM response to: ' + message,
    thoughts: ['Test thought'],
    metadata: {}
  })
};

describe('DefaultSchedulerManager', () => {
  it('creates and retrieves a task', async () => {
    const config: Partial<SchedulerManagerConfig> = {
      enabled: true,
      maxConcurrentTasks: 5,
      enableTaskPrioritization: true
    };
    
    const manager = new DefaultSchedulerManager(mockAgent, config);
    await manager.initialize();
    
    const result = await manager.createTask({
      title: 'Test Task',
      description: 'Test task description',
      type: 'test',
      priority: 0.5,
      metadata: {
        testId: '123'
      }
    });
    
    expect(result.success).toBe(true);
    expect(result.task).toBeDefined();
    
    const task = await manager.getTask(result.task.id);
    expect(task).toBeDefined();
    expect(task?.title).toBe('Test Task');
    expect(task?.description).toBe('Test task description');
    expect(task?.status).toBe('pending');
    expect(task?.priority).toBe(0.5);
  });

  it('returns correct metrics', async () => {
    const config: Partial<SchedulerManagerConfig> = {
      enabled: true,
      maxConcurrentTasks: 5
    };
    
    const manager = new DefaultSchedulerManager(mockAgent, config);
    await manager.initialize();
    
    // Create first task
    await manager.createTask({
      title: 'Task A',
      description: 'Task A description',
      type: 'test',
      priority: 0.8
    });
    
    // Create second task
    await manager.createTask({
      title: 'Task B',
      description: 'Task B description',
      type: 'test',
      priority: 0.5
    });
    
    const allTasks = await manager.getTasks();
    expect(allTasks.length).toBe(2);
    
    // Execute first task
    await manager.executeTask(allTasks[0].id);
    
    // Check task counts
    const pendingTasks = await manager.getPendingTasks();
    const runningTasks = await manager.getRunningTasks();
    const completedTasks = allTasks.filter(t => t.status === 'completed');
    
    expect(pendingTasks.length).toBe(1);
    expect(runningTasks.length).toBe(0);
    expect(completedTasks.length).toBe(1);
  });

  it('handles task priorities correctly', async () => {
    const config: Partial<SchedulerManagerConfig> = {
      enabled: true,
      maxConcurrentTasks: 5,
      enableTaskPrioritization: true
    };
    
    const manager = new DefaultSchedulerManager(mockAgent, config);
    await manager.initialize();
    
    // Create tasks with different priorities
    await manager.createTask({
      title: 'High Priority Task',
      description: 'High priority task',
      type: 'test',
      priority: 0.9
    });
    
    await manager.createTask({
      title: 'Low Priority Task',
      description: 'Low priority task',
      type: 'test',
      priority: 0.1
    });
    
    const tasks = await manager.getTasks();
    expect(tasks[0].priority).toBe(0.9);
    expect(tasks[1].priority).toBe(0.1);
  });

  it('respects task dependencies', async () => {
    const config: Partial<SchedulerManagerConfig> = {
      enabled: true,
      maxConcurrentTasks: 5
    };
    
    const manager = new DefaultSchedulerManager(mockAgent, config);
    await manager.initialize();
    
    // Create first task
    const task1Result = await manager.createTask({
      title: 'Task 1',
      description: 'First task',
      type: 'test'
    });
    
    // Create second task depending on first
    const task2Result = await manager.createTask({
      title: 'Task 2',
      description: 'Second task',
      type: 'test',
      dependencies: [task1Result.task.id]
    });
    
    expect(task2Result.task.dependencies).toContain(task1Result.task.id);
  });
}); 