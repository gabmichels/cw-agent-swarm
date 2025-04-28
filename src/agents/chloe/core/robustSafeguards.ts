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

interface TaskValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class RobustSafeguards {
  private taskLogger?: TaskLogger;
  private resourceMetrics: ResourceMetrics;
  private circuitBreakers: Map<string, CircuitBreakerState>;
  private cleanupTasks: Set<string>;
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
    this.cleanupTasks = new Set();
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
    fn: () => Promise<T>
  ): Promise<T> {
    const breaker = this.getOrCreateCircuitBreaker(operation);
    
    if (breaker.state === 'open') {
      if (this.shouldResetCircuitBreaker(breaker)) {
        breaker.state = 'half-open';
      } else {
        throw new Error(`Circuit breaker is open for operation: ${operation}`);
      }
    }
    
    try {
      const result = await fn();
      this.recordSuccess(operation);
      return result;
    } catch (error) {
      this.recordFailure(operation);
      throw error;
    }
  }

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
    if (!breaker.lastFailureTime) return true;
    const timeSinceLastFailure = Date.now() - breaker.lastFailureTime.getTime();
    return timeSinceLastFailure >= breaker.resetTimeout;
  }

  private recordSuccess(operation: string): void {
    const breaker = this.circuitBreakers.get(operation)!;
    breaker.failures = 0;
    breaker.state = 'closed';
  }

  private recordFailure(operation: string): void {
    const breaker = this.circuitBreakers.get(operation)!;
    breaker.failures++;
    breaker.lastFailureTime = new Date();
    
    if (breaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      breaker.state = 'open';
      this.taskLogger?.logAction('Circuit breaker opened', {
        operation,
        failures: breaker.failures
      });
    }
  }

  /**
   * Validate task before execution
   */
  validateTask(task: Task): TaskValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Required fields
    if (!task.id) errors.push('Task ID is required');
    if (!task.description) errors.push('Task description is required');
    if (!task.status) errors.push('Task status is required');
    if (!task.priority) errors.push('Task priority is required');
    if (!task.created_at) errors.push('Task creation date is required');
    
    // Priority validation
    if (task.priority < 1 || task.priority > 5) {
      warnings.push('Task priority should be between 1 and 5');
    }
    
    // Status validation
    if (!['pending', 'in_progress', 'completed', 'failed'].includes(task.status)) {
      errors.push('Invalid task status');
    }
    
    // Description length
    if (task.description.length > 1000) {
      warnings.push('Task description is very long');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate plan before execution
   */
  validatePlan(plan: PlanWithSteps): TaskValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Required fields
    if (!plan.description) errors.push('Plan description is required');
    if (!plan.steps || plan.steps.length === 0) errors.push('Plan must have at least one step');
    
    // Step validation
    plan.steps.forEach((step, index) => {
      if (!step.description) {
        errors.push(`Step ${index + 1} is missing description`);
      }
      if (!step.status) {
        errors.push(`Step ${index + 1} is missing status`);
      }
    });
    
    // Plan complexity
    if (plan.steps.length > 10) {
      warnings.push('Plan has many steps, consider breaking it down');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Register a cleanup task
   */
  registerCleanupTask(taskId: string): void {
    this.cleanupTasks.add(taskId);
  }

  /**
   * Execute cleanup tasks
   */
  async executeCleanup(): Promise<void> {
    for (const taskId of Array.from(this.cleanupTasks)) {
      try {
        // Implement cleanup logic here
        this.taskLogger?.logAction('Executing cleanup task', { taskId });
        
        // Remove from cleanup tasks after successful execution
        this.cleanupTasks.delete(taskId);
      } catch (error) {
        this.taskLogger?.logAction('Error executing cleanup task', {
          taskId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Update resource metrics
   */
  updateResourceMetrics(metrics: Partial<ResourceMetrics>): void {
    this.resourceMetrics = {
      ...this.resourceMetrics,
      ...metrics,
      lastUpdated: new Date()
    };
  }
} 