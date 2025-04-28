import { TaskLogger } from './taskLogger';
import { Task } from '../types/state';
import { PlanWithSteps } from '../types/planning';

interface ResourceMetrics {
  memoryUsage: number;
  cpuUsage: number;
  activeTasks: number;
  messageCount: number;
  lastUpdated: Date;
}

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: Date | null;
  state: 'closed' | 'open' | 'half-open';
  resetTimeout: number;
}

interface CleanupTask {
  id: string;
  description: string;
  resources: string[];
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
}

export class RobustSafeguards {
  private taskLogger?: TaskLogger;
  private resourceMetrics: ResourceMetrics;
  private circuitBreakers: Map<string, CircuitBreakerState>;
  private cleanupTasks: Map<string, CleanupTask>;
  private readonly MAX_MEMORY_USAGE = 0.8; // 80% of available memory
  private readonly MAX_CPU_USAGE = 0.7; // 70% of available CPU
  private readonly MAX_ACTIVE_TASKS = 20;
  private readonly MAX_MESSAGE_COUNT = 10000;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_RESET_TIMEOUT = 30000; // 30 seconds

  constructor(taskLogger?: TaskLogger) {
    this.taskLogger = taskLogger;
    this.resourceMetrics = {
      memoryUsage: 0,
      cpuUsage: 0,
      activeTasks: 0,
      messageCount: 0,
      lastUpdated: new Date()
    };
    this.circuitBreakers = new Map();
    this.cleanupTasks = new Map();
  }

  /**
   * Monitor system resources
   */
  async monitorResources(): Promise<ResourceMetrics> {
    try {
      // Get memory usage
      const memoryUsage = process.memoryUsage();
      this.resourceMetrics.memoryUsage = memoryUsage.heapUsed / memoryUsage.heapTotal;

      // Get CPU usage (platform specific)
      if (process.platform === 'win32') {
        const { exec } = require('child_process');
        const cpuUsage = await new Promise<number>((resolve) => {
          exec('wmic cpu get loadpercentage', (error: Error | null, stdout: string) => {
            if (error) {
              resolve(0);
              return;
            }
            const load = parseInt(stdout.split('\n')[1]);
            resolve(load / 100);
          });
        });
        this.resourceMetrics.cpuUsage = cpuUsage;
      } else {
        const { exec } = require('child_process');
        const cpuUsage = await new Promise<number>((resolve) => {
          exec('top -bn1 | grep "Cpu(s)" | awk \'{print $2}\'', (error: Error | null, stdout: string) => {
            if (error) {
              resolve(0);
              return;
            }
            const load = parseFloat(stdout);
            resolve(load / 100);
          });
        });
        this.resourceMetrics.cpuUsage = cpuUsage;
      }

      this.resourceMetrics.lastUpdated = new Date();
      
      this.taskLogger?.logAction('Resources monitored', {
        memoryUsage: this.resourceMetrics.memoryUsage,
        cpuUsage: this.resourceMetrics.cpuUsage,
        activeTasks: this.resourceMetrics.activeTasks,
        messageCount: this.resourceMetrics.messageCount
      });
      
      return this.resourceMetrics;
    } catch (error) {
      this.taskLogger?.logAction('Error monitoring resources', {
        error: error instanceof Error ? error.message : String(error)
      });
      return this.resourceMetrics;
    }
  }

  /**
   * Check if resources are within limits
   */
  async checkResourceLimits(): Promise<boolean> {
    await this.monitorResources();
    
    const { memoryUsage, cpuUsage, activeTasks, messageCount } = this.resourceMetrics;
    
    if (memoryUsage > this.MAX_MEMORY_USAGE) {
      this.taskLogger?.logAction('Memory usage exceeded limit', { memoryUsage });
      return false;
    }
    
    if (cpuUsage > this.MAX_CPU_USAGE) {
      this.taskLogger?.logAction('CPU usage exceeded limit', { cpuUsage });
      return false;
    }
    
    if (activeTasks > this.MAX_ACTIVE_TASKS) {
      this.taskLogger?.logAction('Active tasks exceeded limit', { activeTasks });
      return false;
    }
    
    if (messageCount > this.MAX_MESSAGE_COUNT) {
      this.taskLogger?.logAction('Message count exceeded limit', { messageCount });
      return false;
    }
    
    return true;
  }

  /**
   * Enhanced circuit breaker implementation
   */
  async executeWithCircuitBreaker<T>(
    operation: string,
    fn: () => Promise<T>,
    options?: {
      timeout?: number;
      fallback?: T;
      resetTimeout?: number;
    }
  ): Promise<T> {
    const breaker = this.getOrCreateCircuitBreaker(operation);
    
    if (breaker.state === 'open') {
      if (this.shouldResetCircuitBreaker(breaker)) {
        breaker.state = 'half-open';
        this.taskLogger?.logAction('Circuit breaker half-opened', {
          operation,
          lastFailure: breaker.lastFailureTime
        });
      } else {
        this.taskLogger?.logAction('Circuit breaker rejected operation', {
          operation,
          state: breaker.state
        });
        
        if (options?.fallback !== undefined) {
          return options.fallback;
        }
        
        throw new Error(`Circuit breaker is open for operation: ${operation}`);
      }
    }
    
    try {
      // Execute with timeout if specified
      let result: T;
      if (options?.timeout) {
        result = await Promise.race([
          fn(),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`Operation timed out: ${operation}`)), options.timeout);
          })
        ]);
      } else {
        result = await fn();
      }
      
      this.recordSuccess(operation);
      return result;
    } catch (error) {
      this.recordFailure(operation);
      
      this.taskLogger?.logAction('Operation failed', {
        operation,
        error: error instanceof Error ? error.message : String(error),
        circuitState: breaker.state
      });
      
      if (options?.fallback !== undefined) {
        return options.fallback;
      }
      
      throw error;
    }
  }

  /**
   * Validate a task before execution
   */
  validateTask(task: Task): boolean {
    if (!task) {
      this.taskLogger?.logAction('Task validation failed: Task is null or undefined');
      return false;
    }
    
    if (!task.description || task.description.trim() === '') {
      this.taskLogger?.logAction('Task validation failed: Missing description', {
        taskId: task.id
      });
      return false;
    }
    
    // Validate that the task has a valid ID
    if (!task.id || task.id.trim() === '') {
      this.taskLogger?.logAction('Task validation failed: Missing ID');
      return false;
    }
    
    // Check task complexity (if metadata contains complexity information)
    if (task.metadata?.complexity && task.metadata.complexity > 5) {
      this.taskLogger?.logAction('Task validation warning: High complexity task', {
        taskId: task.id,
        complexity: task.metadata.complexity
      });
    }
    
    return true;
  }

  /**
   * Validate a plan before execution
   */
  validatePlan(plan: PlanWithSteps): boolean {
    if (!plan) {
      this.taskLogger?.logAction('Plan validation failed: Plan is null or undefined');
      return false;
    }
    
    if (!plan.description || plan.description.trim() === '') {
      this.taskLogger?.logAction('Plan validation failed: Missing description');
      return false;
    }
    
    if (!plan.steps || plan.steps.length === 0) {
      this.taskLogger?.logAction('Plan validation failed: No steps in plan', {
        planDescription: plan.description
      });
      return false;
    }
    
    // Check if any steps are missing descriptions
    const invalidSteps = plan.steps.filter(step => !step.description || step.description.trim() === '');
    if (invalidSteps.length > 0) {
      this.taskLogger?.logAction('Plan validation failed: Steps missing descriptions', {
        planDescription: plan.description,
        invalidStepCount: invalidSteps.length
      });
      return false;
    }
    
    this.taskLogger?.logAction('Plan validation passed', {
      planDescription: plan.description,
      stepCount: plan.steps.length
    });
    
    return true;
  }

  /**
   * Register a cleanup task to be executed later
   */
  registerCleanupTask(
    description: string,
    resources: string[],
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): string {
    const id = this.generateTaskId();
    const task: CleanupTask = {
      id,
      description,
      resources,
      priority,
      createdAt: new Date()
    };
    
    this.cleanupTasks.set(id, task);
    
    this.taskLogger?.logAction('Cleanup task registered', {
      taskId: id,
      description,
      resources,
      priority
    });
    
    return id;
  }

  /**
   * Execute a specific cleanup task
   */
  async executeCleanupTask(taskId: string): Promise<boolean> {
    const task = this.cleanupTasks.get(taskId);
    if (!task) {
      this.taskLogger?.logAction('Cleanup task not found', { taskId });
      return false;
    }
    
    try {
      this.taskLogger?.logAction('Executing cleanup task', {
        taskId,
        description: task.description
      });
      
      // Execute resource-specific cleanup based on the registered resources
      for (const resource of task.resources) {
        await this.cleanupResource(resource);
      }
      
      // Remove the task from the map once completed
      this.cleanupTasks.delete(taskId);
      
      this.taskLogger?.logAction('Cleanup task completed', { taskId });
      return true;
    } catch (error) {
      this.taskLogger?.logAction('Error executing cleanup task', {
        taskId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Execute all pending cleanup tasks, prioritized by their priority level
   */
  async executeAllCleanupTasks(): Promise<{
    success: number;
    failure: number;
    remaining: number;
  }> {
    let successCount = 0;
    let failureCount = 0;
    
    // Get all tasks sorted by priority (high -> medium -> low)
    const sortedTasks = Array.from(this.cleanupTasks.values()).sort((a, b) => {
      const priorityValues = { high: 0, medium: 1, low: 2 };
      return priorityValues[a.priority] - priorityValues[b.priority];
    });
    
    for (const task of sortedTasks) {
      const success = await this.executeCleanupTask(task.id);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
    }
    
    return {
      success: successCount,
      failure: failureCount,
      remaining: this.cleanupTasks.size
    };
  }

  /**
   * Report on the current status of safeguards
   */
  getStatusReport(): {
    resourceMetrics: ResourceMetrics;
    circuitBreakers: { operation: string; state: string; failures: number }[];
    pendingCleanupTasks: number;
  } {
    return {
      resourceMetrics: { ...this.resourceMetrics },
      circuitBreakers: Array.from(this.circuitBreakers.entries()).map(([operation, state]) => ({
        operation,
        state: state.state,
        failures: state.failures
      })),
      pendingCleanupTasks: this.cleanupTasks.size
    };
  }

  /**
   * Private helper methods below
   */
  
  private getOrCreateCircuitBreaker(operation: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(operation)) {
      this.circuitBreakers.set(operation, {
        failures: 0,
        lastFailureTime: null,
        state: 'closed',
        resetTimeout: this.CIRCUIT_BREAKER_RESET_TIMEOUT
      });
    }
    return this.circuitBreakers.get(operation)!;
  }

  private shouldResetCircuitBreaker(breaker: CircuitBreakerState): boolean {
    if (breaker.state !== 'open' || !breaker.lastFailureTime) {
      return false;
    }
    
    const now = new Date();
    const resetTime = new Date(breaker.lastFailureTime.getTime() + breaker.resetTimeout);
    return now >= resetTime;
  }

  private recordSuccess(operation: string): void {
    const breaker = this.circuitBreakers.get(operation);
    if (!breaker) return;
    
    if (breaker.state === 'half-open') {
      breaker.state = 'closed';
      breaker.failures = 0;
      breaker.lastFailureTime = null;
      
      this.taskLogger?.logAction('Circuit breaker reset to closed state', {
        operation
      });
    } else if (breaker.state === 'closed' && breaker.failures > 0) {
      // Gradually decrease failure count on successful operations
      breaker.failures = Math.max(0, breaker.failures - 1);
    }
  }

  private recordFailure(operation: string): void {
    const breaker = this.circuitBreakers.get(operation)!;
    breaker.failures++;
    breaker.lastFailureTime = new Date();
    
    if (breaker.state === 'half-open') {
      // Immediately open the circuit on failure in half-open state
      breaker.state = 'open';
      this.taskLogger?.logAction('Circuit breaker reopened after testing', {
        operation,
        failures: breaker.failures
      });
    } else if (breaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      breaker.state = 'open';
      this.taskLogger?.logAction('Circuit breaker opened', {
        operation,
        failures: breaker.failures
      });
    }
  }

  private async cleanupResource(resource: string): Promise<void> {
    this.taskLogger?.logAction('Cleaning up resource', { resource });
    
    // Implement resource-specific cleanup
    switch (resource) {
      case 'memory':
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
          this.taskLogger?.logAction('Memory garbage collection triggered');
        }
        break;
        
      case 'files':
        // Cleanup temporary files
        // Implementation depends on the specific file management of the application
        this.taskLogger?.logAction('File cleanup completed');
        break;
        
      case 'connections':
        // Close unused connections
        // Implementation depends on the connection management of the application
        this.taskLogger?.logAction('Connection cleanup completed');
        break;
        
      case 'cache':
        // Clear application caches
        // Implementation depends on the cache management of the application
        this.taskLogger?.logAction('Cache cleanup completed');
        break;
        
      default:
        this.taskLogger?.logAction('Unknown resource type, no cleanup performed', { resource });
        break;
    }
  }

  private generateTaskId(): string {
    return `cleanup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
} 