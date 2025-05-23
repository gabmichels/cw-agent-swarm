/**
 * CapacityBasedStrategy.ts - Capacity-Based Scheduling Strategy
 * 
 * This strategy executes lower priority tasks immediately when system capacity is available,
 * improving resource utilization while respecting priority ordering.
 */

import { ulid } from 'ulid';
import { Task, TaskScheduleType, TaskStatus } from '../../models/Task.model';
import { SchedulingStrategy } from '../../strategies/SchedulingStrategy.interface';
import { TaskAgentRegistry } from '../../interfaces/AgentTaskHandler.interface';
import { createLogger } from '@/lib/logging/winston-logger';

/**
 * Strategy for executing lower priority tasks based on available capacity
 */
export class CapacityBasedStrategy implements SchedulingStrategy {
  /**
   * Unique identifier for the strategy
   */
  public readonly strategyId: string;
  
  /**
   * Human-readable name of the strategy
   */
  public readonly name: string = 'Capacity-Based Strategy';

  /**
   * The capacity utilization threshold below which low-priority tasks execute
   */
  private capacityThreshold: number;

  /**
   * The priority threshold below which tasks are considered low-priority
   */
  private readonly lowPriorityThreshold: number;

  /**
   * The agent registry for capacity calculations
   */
  private readonly agentRegistry: TaskAgentRegistry;

  /**
   * Logger instance
   */
  private readonly logger: ReturnType<typeof createLogger>;

  /**
   * Cache for capacity calculations to avoid frequent recalculation
   */
  private capacityCache: {
    totalCapacity: number;
    currentLoad: number;
    lastUpdated: Date;
    ttlMs: number;
  } = {
    totalCapacity: 0,
    currentLoad: 0,
    lastUpdated: new Date(0),
    ttlMs: 30000 // 30 seconds TTL
  };

  /**
   * Create a new CapacityBasedStrategy
   * 
   * @param agentRegistry - Registry for accessing agent capacity information
   * @param capacityThreshold - Utilization threshold (0-1) below which to execute low-priority tasks
   * @param lowPriorityThreshold - Priority threshold below which tasks are considered low-priority
   */
  constructor(
    agentRegistry: TaskAgentRegistry,
    capacityThreshold: number = 0.7,
    lowPriorityThreshold: number = 7
  ) {
    this.strategyId = `capacity-strategy-${ulid()}`;
    this.agentRegistry = agentRegistry;
    this.capacityThreshold = Math.max(0, Math.min(1, capacityThreshold)); // Clamp to 0-1
    this.lowPriorityThreshold = lowPriorityThreshold;
    
    this.logger = createLogger({
      moduleId: this.strategyId,
      agentId: 'system'
    });

    this.logger.info("CapacityBasedStrategy initialized", {
      strategyId: this.strategyId,
      capacityThreshold: this.capacityThreshold,
      lowPriorityThreshold: this.lowPriorityThreshold
    });
  }

  /**
   * Determine if a task is due according to this strategy
   * 
   * @param task - The task to evaluate
   * @param referenceTime - Optional reference time (defaults to current time)
   * @returns true if the task is due for execution
   */
  async isTaskDue(task: Task, referenceTime?: Date): Promise<boolean> {
    if (!this.appliesTo(task)) {
      return false;
    }

    this.logger.info("Evaluating task for capacity-based execution", {
      taskId: task.id,
      taskPriority: task.priority,
      lowPriorityThreshold: this.lowPriorityThreshold
    });

    try {
      // Calculate current capacity utilization
      const { totalCapacity, currentLoad, utilizationRatio } = await this.calculateCapacityUtilization();

      this.logger.info("Capacity utilization calculated", {
        taskId: task.id,
        totalCapacity,
        currentLoad,
        utilizationRatio,
        capacityThreshold: this.capacityThreshold,
        hasSpareCapacity: utilizationRatio < this.capacityThreshold
      });

      // Execute low-priority tasks when utilization is below threshold
      const isDue = utilizationRatio < this.capacityThreshold;

      if (isDue) {
        this.logger.info("Task approved for capacity-based execution", {
          taskId: task.id,
          taskPriority: task.priority,
          utilizationRatio,
          capacityThreshold: this.capacityThreshold
        });
      } else {
        this.logger.info("Task not approved - capacity threshold exceeded", {
          taskId: task.id,
          utilizationRatio,
          capacityThreshold: this.capacityThreshold
        });
      }

      return isDue;
    } catch (error) {
      this.logger.error("Error calculating capacity utilization", {
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Default to not executing on error (conservative approach)
      return false;
    }
  }

  /**
   * Calculate the next execution time for a task
   * 
   * @param task - The task to calculate for
   * @param lastExecutionTime - Optional timestamp of the last execution
   * @returns The next execution time or null if not applicable
   */
  async calculateNextExecutionTime(task: Task, lastExecutionTime?: Date): Promise<Date | null> {
    if (!this.appliesTo(task)) {
      return null;
    }

    // For capacity-based tasks, next execution depends on capacity availability
    // Return current time if capacity is available, otherwise estimate next check
    try {
      const { utilizationRatio } = await this.calculateCapacityUtilization();
      
      if (utilizationRatio < this.capacityThreshold) {
        // Capacity available now
        return new Date();
      } else {
        // Estimate when capacity might be available (next check cycle)
        return new Date(Date.now() + 60000); // 1 minute from now
      }
    } catch (error) {
      this.logger.error("Error calculating next execution time", {
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Default to 1 minute from now on error
      return new Date(Date.now() + 60000);
    }
  }

  /**
   * Check if this strategy applies to a given task
   * 
   * @param task - The task to check
   * @returns true if this strategy applies to the task
   */
  appliesTo(task: Task): boolean {
    // Only applies to low-priority, pending tasks without explicit scheduling
    const applies = (
      task.status === TaskStatus.PENDING &&
      task.priority < this.lowPriorityThreshold &&
      task.scheduledTime === undefined &&
      task.scheduleType !== TaskScheduleType.INTERVAL
    );

    this.logger.debug("Checking if strategy applies to task", {
      taskId: task.id,
      taskPriority: task.priority,
      taskStatus: task.status,
      hasScheduledTime: !!task.scheduledTime,
      scheduleType: task.scheduleType,
      applies
    });

    return applies;
  }

  /**
   * Calculate current capacity utilization across all agents
   * 
   * @returns Capacity utilization information
   */
  private async calculateCapacityUtilization(): Promise<{
    totalCapacity: number;
    currentLoad: number;
    utilizationRatio: number;
  }> {
    const now = new Date();
    
    // Check if cache is still valid
    if ((now.getTime() - this.capacityCache.lastUpdated.getTime()) < this.capacityCache.ttlMs) {
      const utilizationRatio = this.capacityCache.totalCapacity > 0 
        ? this.capacityCache.currentLoad / this.capacityCache.totalCapacity 
        : 0;
        
      return {
        totalCapacity: this.capacityCache.totalCapacity,
        currentLoad: this.capacityCache.currentLoad,
        utilizationRatio
      };
    }

    // Calculate fresh capacity data
    let totalCapacity = 0;
    let currentLoad = 0;

    try {
      // Get all available agents from the runtime registry
      const { getAllAgents } = await import('../../../../server/agent/agent-service');
      const allAgents = getAllAgents();

      // Calculate total capacity and current load
      for (const agent of allAgents) {
        try {
          const agentId = agent.getId();
          const capacity = await this.agentRegistry.getAgentCapacity(agentId);
          
          totalCapacity += capacity.maxCapacity;
          currentLoad += capacity.currentLoad;
          
          this.logger.debug("Agent capacity calculated", {
            agentId,
            maxCapacity: capacity.maxCapacity,
            currentLoad: capacity.currentLoad,
            isAvailable: capacity.isAvailable
          });
        } catch (agentError) {
          this.logger.warn("Failed to get capacity for agent", {
            agentId: agent.getId(),
            error: agentError instanceof Error ? agentError.message : String(agentError)
          });
          // Continue with other agents
        }
      }

      // Update cache
      this.capacityCache = {
        totalCapacity,
        currentLoad,
        lastUpdated: now,
        ttlMs: this.capacityCache.ttlMs
      };

      const utilizationRatio = totalCapacity > 0 ? currentLoad / totalCapacity : 0;

      this.logger.info("Capacity utilization calculated", {
        totalAgents: allAgents.length,
        totalCapacity,
        currentLoad,
        utilizationRatio: utilizationRatio.toFixed(3),
        cacheUpdated: true
      });

      return {
        totalCapacity,
        currentLoad,
        utilizationRatio
      };
    } catch (error) {
      this.logger.error("Error calculating capacity utilization", {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return safe defaults on error
      return {
        totalCapacity: 1,
        currentLoad: 1, // Assume full capacity to be conservative
        utilizationRatio: 1
      };
    }
  }

  /**
   * Get current capacity utilization statistics
   * 
   * @returns Current capacity statistics
   */
  async getCapacityStats() {
    const { totalCapacity, currentLoad, utilizationRatio } = await this.calculateCapacityUtilization();
    
    return {
      strategyId: this.strategyId,
      capacityThreshold: this.capacityThreshold,
      lowPriorityThreshold: this.lowPriorityThreshold,
      totalCapacity,
      currentLoad,
      utilizationRatio,
      availableCapacity: totalCapacity - currentLoad,
      canExecuteLowPriority: utilizationRatio < this.capacityThreshold,
      cacheLastUpdated: this.capacityCache.lastUpdated,
      cacheTtlMs: this.capacityCache.ttlMs
    };
  }

  /**
   * Update the capacity threshold
   * 
   * @param threshold - New threshold value (0-1)
   */
  updateCapacityThreshold(threshold: number): void {
    const oldThreshold = this.capacityThreshold;
    this.capacityThreshold = Math.max(0, Math.min(1, threshold));
    
    this.logger.info("Capacity threshold updated", {
      oldThreshold,
      newThreshold: this.capacityThreshold
    });
  }

  /**
   * Clear the capacity cache to force recalculation
   */
  clearCapacityCache(): void {
    this.capacityCache.lastUpdated = new Date(0);
    this.logger.info("Capacity cache cleared");
  }
} 