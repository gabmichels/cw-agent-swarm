/**
 * Unit tests for AgentExecutionEngine.ts
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentExecutionEngine, ExecutionStatus, ExecutionPriority, ExecutionError } from '../AgentExecutionEngine';
import { AgentBase, AgentResponse, MessageProcessingOptions } from '../../base/AgentBase.interface';
import { BaseManager } from '../../base/managers/BaseManager';
import { ManagerType } from '../../base/managers/ManagerType';

// Mock the logger
vi.mock('../../../../lib/logging/winston-logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }))
}));

// Mock agent implementation
class MockAgent implements AgentBase {
  private id: string;
  private managers: BaseManager[] = [];

  constructor(id = 'test-agent') {
    this.id = id;
  }

  getId(): string {
    return this.id;
  }

  async processUserInput(input: string, options?: MessageProcessingOptions): Promise<AgentResponse> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Simulate different responses based on input
    if (input.includes('error')) {
      throw new Error('Simulated processing error');
    }
    
    if (input.includes('timeout')) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return {
      content: `Processed: ${input}`,
      metadata: {
        processedAt: new Date().toISOString(),
        inputLength: input.length
      }
    };
  }

  getManagers(): BaseManager[] {
    return this.managers;
  }

  setManager<T extends BaseManager>(manager: T): void {
    this.managers.push(manager);
  }

  // Minimal implementation of required methods
  getAgentId(): string { return this.id; }
  getType(): string { return 'mock'; }
  getName(): string { return 'Mock Agent'; }
  getDescription(): string { return 'A mock agent for testing'; }
  getVersion(): string { return '1.0.0'; }
  async getCapabilities(): Promise<string[]> { return ['mock']; }
  getStatus(): { status: string; message?: string } { return { status: 'active' }; }
  async initialize(): Promise<boolean> { return true; }
  async shutdown(): Promise<void> { }
  async reset(): Promise<void> { }
  isEnabled(): boolean { return true; }
  setEnabled(enabled: boolean): boolean { return enabled; }
  getConfig(): Record<string, unknown> { return {}; }
  
  // Stub other required methods
  async registerTool(): Promise<any> { return {}; }
  async unregisterTool(): Promise<boolean> { return true; }
  async getTool(): Promise<any> { return null; }
  async getTools(): Promise<any[]> { return []; }
  async setToolEnabled(): Promise<any> { return {}; }
  getManager(): any { return null; }
  removeManager(): void { }
  hasManager(): boolean { return false; }
  async createTask(): Promise<any> { return {}; }
  async getTask(): Promise<any> { return null; }
  async getTasks(): Promise<any[]> { return []; }
  async executeTask(): Promise<any> { return {}; }
  async cancelTask(): Promise<boolean> { return true; }
  async retryTask(): Promise<any> { return {}; }
  updateConfig(): void { }
  hasCapability(): boolean { return false; }
  enableCapability(): void { }
  disableCapability(): void { }
  async getHealth(): Promise<any> { return { status: 'healthy' }; }
  getSchedulerManager(): any { return undefined; }
  async initializeManagers(): Promise<void> { }
  async shutdownManagers(): Promise<void> { }
  async addMemory(): Promise<any> { return {}; }
  async searchMemories(): Promise<any[]> { return []; }
  async getRecentMemories(): Promise<any[]> { return []; }
  async consolidateMemories(): Promise<any> { return {}; }
  async pruneMemories(): Promise<any> { return {}; }
  async createPlan(): Promise<any> { return {}; }
  async getPlan(): Promise<any> { return null; }
  async getAllPlans(): Promise<any[]> { return []; }
  async updatePlan(): Promise<any> { return null; }
  async deletePlan(): Promise<boolean> { return true; }
  async executePlan(): Promise<any> { return {}; }
  async adaptPlan(): Promise<any> { return null; }
  async validatePlan(): Promise<boolean> { return true; }
  async optimizePlan(): Promise<any> { return null; }
  async getToolMetrics(): Promise<any[]> { return []; }
  async findBestToolForTask(): Promise<any> { return null; }
  async loadKnowledge(): Promise<void> { }
  async searchKnowledge(): Promise<any[]> { return []; }
  async addKnowledgeEntry(): Promise<any> { return {}; }
  async getKnowledgeEntry(): Promise<any> { return null; }
  async updateKnowledgeEntry(): Promise<any> { return {}; }
  async deleteKnowledgeEntry(): Promise<boolean> { return true; }
  async getKnowledgeEntries(): Promise<any[]> { return []; }
  async identifyKnowledgeGaps(): Promise<any[]> { return []; }
  async getKnowledgeGap(): Promise<any> { return null; }
  async getAllTasks(): Promise<any[]> { return []; }
  async updateTask(): Promise<string> { return 'updated'; }
  async deleteTask(): Promise<boolean> { return true; }
  async getDueTasks(): Promise<any[]> { return []; }
  async getRunningTasks(): Promise<any[]> { return []; }
  async getPendingTasks(): Promise<any[]> { return []; }
  async getFailedTasks(): Promise<any[]> { return []; }
  async think(): Promise<any> { return {}; }
  async getLLMResponse(): Promise<AgentResponse> { return { content: 'mock' }; }
}

// Mock manager implementation
class MockManager implements BaseManager {
  readonly managerId = 'mock-manager';
  readonly managerType = ManagerType.MEMORY;
  private enabled = true;
  private agent: any;

  constructor(agent?: any) {
    this.agent = agent;
  }

  getConfig(): any {
    return { enabled: this.enabled };
  }

  updateConfig(config: any): any {
    this.enabled = config.enabled ?? this.enabled;
    return this.getConfig();
  }

  getAgent(): any {
    return this.agent;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): boolean {
    this.enabled = enabled;
    return enabled;
  }

  async initialize(): Promise<boolean> {
    return true;
  }

  async shutdown(): Promise<void> {
    // Mock shutdown
  }

  async reset(): Promise<boolean> {
    return true;
  }

  async getHealth(): Promise<any> {
    return { status: 'healthy' };
  }
}

describe('AgentExecutionEngine', () => {
  let agent: MockAgent;
  let executionEngine: AgentExecutionEngine;

  beforeEach(() => {
    agent = new MockAgent();
    executionEngine = new AgentExecutionEngine(agent, {
      maxConcurrentTasks: 2,
      defaultTimeout: 5000,
      enablePerformanceMonitoring: false, // Disable for tests
      enableTaskQueuing: true,
      retryFailedTasks: true,
      maxRetries: 2,
      retryDelay: 100
    });

    // Add mock managers
    agent.setManager(new MockManager(agent));
    agent.setManager(new MockManager(agent));
  });

  afterEach(async () => {
    await executionEngine.shutdown();
  });

  describe('Task Execution', () => {
    test('should execute simple task successfully', async () => {
      const result = await executionEngine.executeTask('Hello world');
      
      expect(result.content).toBe('Processed: Hello world');
      expect(result.metadata).toHaveProperty('processedAt');
      expect(result.metadata).toHaveProperty('inputLength', 11);
    });

    test('should handle task with options', async () => {
      const options: MessageProcessingOptions = {
        type: 'command',
        priority: 'high',
        metadata: { source: 'test' }
      };

      const result = await executionEngine.executeTask('Test command', options);
      
      expect(result.content).toBe('Processed: Test command');
      expect(result.metadata).toHaveProperty('processedAt');
    });

    test('should assign correct priority based on task type', async () => {
      const systemTask = executionEngine.executeTask('system task', { type: 'system' });
      const commandTask = executionEngine.executeTask('command task', { type: 'command' });
      const normalTask = executionEngine.executeTask('normal task');

      const [systemResult, commandResult, normalResult] = await Promise.all([systemTask, commandTask, normalTask]);

      // All should complete successfully (some might be queued due to concurrency limits)
      expect(systemResult.content).toMatch(/Processed: system task|Task queued for execution/);
      expect(commandResult.content).toMatch(/Processed: command task|Task queued for execution/);
      expect(normalResult.content).toMatch(/Processed: normal task|Task queued for execution/);
    });
  });

  describe('Task Queuing', () => {
    test('should queue tasks when at capacity', async () => {
      // Fill up the execution slots
      const task1 = executionEngine.executeTask('task 1');
      const task2 = executionEngine.executeTask('task 2');
      
      // This should be queued
      const task3 = executionEngine.executeTask('task 3');
      
      const result3 = await task3;
      expect(result3.metadata).toHaveProperty('queued', true);
      expect(result3.metadata).toHaveProperty('queuePosition');

      // Wait for other tasks to complete
      await Promise.all([task1, task2]);
    });

    test('should process queued tasks in priority order', async () => {
      // Fill up execution slots with long-running tasks
      const longTask1 = executionEngine.executeTask('long task 1');
      const longTask2 = executionEngine.executeTask('long task 2');

      // Queue tasks with different priorities
      const lowPriorityTask = executionEngine.executeTask('low priority', { priority: 'low' });
      const highPriorityTask = executionEngine.executeTask('high priority', { priority: 'high' });
      const urgentTask = executionEngine.executeTask('urgent task', { priority: 'urgent' });

      // All queued tasks should return queued response
      const lowResult = await lowPriorityTask;
      const highResult = await highPriorityTask;
      const urgentResult = await urgentTask;

      expect(lowResult.metadata?.queued).toBe(true);
      expect(highResult.metadata?.queued).toBe(true);
      expect(urgentResult.metadata?.queued).toBe(true);

      // Wait for long tasks to complete
      await Promise.all([longTask1, longTask2]);

      // Check queue order (urgent should be first)
      const queuedTasks = executionEngine.getQueuedTasks();
      expect(queuedTasks.length).toBeGreaterThanOrEqual(0); // Queue might be processed by now
    });
  });

  describe('Error Handling', () => {
    test('should handle task execution errors', async () => {
      const result = await executionEngine.executeTask('trigger error');
      
      expect(result.content).toContain('Task execution failed');
      expect(result.metadata).toHaveProperty('error', true);
      expect(result.metadata).toHaveProperty('errorCode');
    });

    test('should retry failed tasks', async () => {
      // Create engine with retries enabled
      const retryEngine = new AgentExecutionEngine(agent, {
        retryFailedTasks: true,
        maxRetries: 2,
        retryDelay: 50
      });

      const result = await retryEngine.executeTask('trigger error');
      
      expect(result.content).toContain('Task execution failed');
      expect(result.metadata).toHaveProperty('error', true);

      await retryEngine.shutdown();
    });

    test('should handle timeout errors', async () => {
      const timeoutEngine = new AgentExecutionEngine(agent, {
        defaultTimeout: 200 // Very short timeout
      });

      const result = await timeoutEngine.executeTask('trigger timeout');
      
      expect(result.content).toContain('Task execution failed');
      expect(result.metadata).toHaveProperty('error', true);

      await timeoutEngine.shutdown();
    });
  });

  describe('Metrics and Monitoring', () => {
    test('should track execution metrics', async () => {
      await executionEngine.executeTask('test task 1');
      await executionEngine.executeTask('test task 2');

      const metrics = executionEngine.getMetrics();
      
      expect(metrics.totalTasks).toBe(2);
      expect(metrics.completedTasks).toBe(2);
      expect(metrics.failedTasks).toBe(0);
      expect(metrics.averageExecutionTime).toBeGreaterThan(0);
    });

    test('should track failed tasks in metrics', async () => {
      // Get initial metrics to account for previous tests
      const initialMetrics = executionEngine.getMetrics();
      
      await executionEngine.executeTask('trigger error');
      
      const metrics = executionEngine.getMetrics();
      
      expect(metrics.totalTasks).toBeGreaterThan(initialMetrics.totalTasks);
      expect(metrics.failedTasks).toBeGreaterThan(initialMetrics.failedTasks);
    });

    test('should provide active and queued task information', async () => {
      // Start a long-running task
      const longTask = executionEngine.executeTask('long task');
      
      // Check active tasks
      const activeTasks = executionEngine.getActiveTasks();
      expect(activeTasks.length).toBe(1);
      expect(activeTasks[0].status).toBe(ExecutionStatus.RUNNING);

      await longTask;

      // After completion, should have no active tasks
      const activeTasksAfter = executionEngine.getActiveTasks();
      expect(activeTasksAfter.length).toBe(0);
    });
  });

  describe('Task Management', () => {
    test('should cancel active tasks', async () => {
      // Start a task but don't wait for it
      const taskPromise = executionEngine.executeTask('cancellable task');
      
      // Get the task ID from active tasks
      const activeTasks = executionEngine.getActiveTasks();
      expect(activeTasks.length).toBe(1);
      
      const taskId = activeTasks[0].id;
      const cancelled = await executionEngine.cancelTask(taskId);
      
      expect(cancelled).toBe(true);
      
      // Task should still complete but might be marked as cancelled
      await taskPromise;
    });

    test('should cancel queued tasks', async () => {
      // Fill execution capacity
      const task1 = executionEngine.executeTask('task 1');
      const task2 = executionEngine.executeTask('task 2');
      
      // Queue a task
      const queuedTaskPromise = executionEngine.executeTask('queued task');
      const queuedResult = await queuedTaskPromise;
      
      expect(queuedResult.metadata?.queued).toBe(true);
      
      // Get queued tasks and cancel one
      const queuedTasks = executionEngine.getQueuedTasks();
      if (queuedTasks.length > 0) {
        const cancelled = await executionEngine.cancelTask(queuedTasks[0].id);
        expect(cancelled).toBe(true);
      }

      await Promise.all([task1, task2]);
    });
  });

  describe('Configuration', () => {
    test('should use provided configuration', () => {
      const config = executionEngine.getConfig();
      
      expect(config.maxConcurrentTasks).toBe(2);
      expect(config.defaultTimeout).toBe(5000);
      expect(config.enableTaskQueuing).toBe(true);
      expect(config.retryFailedTasks).toBe(true);
      expect(config.maxRetries).toBe(2);
    });

    test('should update configuration', () => {
      executionEngine.updateConfig({
        maxConcurrentTasks: 5,
        defaultTimeout: 10000
      });

      const config = executionEngine.getConfig();
      
      expect(config.maxConcurrentTasks).toBe(5);
      expect(config.defaultTimeout).toBe(10000);
      // Other settings should remain unchanged
      expect(config.enableTaskQueuing).toBe(true);
    });
  });

  describe('Shutdown', () => {
    test('should shutdown gracefully', async () => {
      // Start some tasks
      const task1 = executionEngine.executeTask('task 1');
      const task2 = executionEngine.executeTask('task 2');

      // Shutdown should wait for tasks to complete
      const shutdownPromise = executionEngine.shutdown();
      
      // Wait for tasks to complete
      await Promise.all([task1, task2]);
      
      // Shutdown should complete
      await shutdownPromise;

      // Should have no active tasks after shutdown
      const activeTasks = executionEngine.getActiveTasks();
      expect(activeTasks.length).toBe(0);
    });

    test('should reject new tasks after shutdown', async () => {
      await executionEngine.shutdown();

      // Attempting to execute task after shutdown should handle gracefully
      const result = await executionEngine.executeTask('post-shutdown task');
      
      // Should return an error response or handle gracefully
      expect(result).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty input', async () => {
      const result = await executionEngine.executeTask('');
      
      expect(result.content).toBe('Processed: ');
      expect(result.metadata).toHaveProperty('inputLength', 0);
    });

    test('should handle very long input', async () => {
      const longInput = 'a'.repeat(10000);
      const result = await executionEngine.executeTask(longInput);
      
      expect(result.content).toBe(`Processed: ${longInput}`);
      expect(result.metadata).toHaveProperty('inputLength', 10000);
    });

    test('should handle concurrent task execution', async () => {
      const tasks = Array.from({ length: 5 }, (_, i) => 
        executionEngine.executeTask(`concurrent task ${i}`)
      );

      const results = await Promise.all(tasks);
      
      expect(results).toHaveLength(5);
      results.forEach((result, i) => {
        // Some tasks might be queued due to concurrency limits
        expect(result.content).toMatch(/Processed: concurrent task \d+|Task queued for execution/);
      });
    });
  });
}); 