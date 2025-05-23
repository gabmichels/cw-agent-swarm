/**
 * DefaultAutonomyManager.ts
 * 
 * Default implementation of the AutonomyManager interface that uses the DefaultAutonomySystem
 * to provide autonomous operation for agents.
 */

import { AgentBase } from '../../base/AgentBase.interface';
import { AbstractBaseManager } from '../../base/managers/BaseManager';
import { ManagerType } from '../../base/managers/ManagerType';
import { AutonomyManager, AutonomyManagerConfig } from '../interfaces/AutonomyManager.interface';
import {
  AutonomySystem, AutonomyStatus, AutonomyCapabilities, AutonomyDiagnostics,
  TaskStatistics, AutonomousExecutionOptions, AutonomousExecutionResult
} from '../interfaces/AutonomySystem.interface';
import { DefaultAutonomySystem } from '../systems/DefaultAutonomySystem';
import { ScheduledTask } from '../../../../lib/shared/types/agentTypes';
import { LoggerManager } from '../../base/managers/LoggerManager.interface';
import { ManagerHealth } from '../../base/managers/ManagerHealth';
import { createLogger } from '@/lib/logging/winston-logger';

export class DefaultAutonomyManager extends AbstractBaseManager implements AutonomyManager {
  private autonomySystem: AutonomySystem | null = null;
  private schedulingTimer: NodeJS.Timeout | undefined;
  private logger: ReturnType<typeof createLogger>;

  constructor(agent: AgentBase, config: AutonomyManagerConfig) {
    super(
      agent.getAgentId() + '-autonomy-manager',
      ManagerType.AUTONOMY,
      agent,
      config
    );
    
    // Initialize logger
    this.logger = createLogger({
      moduleId: this.managerId,
      agentId: agent.getAgentId()
    });
    
    this.logger.system("DefaultAutonomyManager initialized", {
      managerId: this.managerId,
      agentId: agent.getAgentId(),
      config: config
    });
  }

  async initialize(): Promise<boolean> {
    this.logger.info("Initializing autonomy manager");
    
    try {
      if (!this.autonomySystem) {
        this.logger.debug("Creating new DefaultAutonomySystem");
        const config = this.getConfig<AutonomyManagerConfig>();
        this.autonomySystem = new DefaultAutonomySystem(this.agent, config.autonomyConfig);
        await this.autonomySystem.initialize();
        
        this.logger.success("Autonomy system created and initialized", {
          systemType: 'DefaultAutonomySystem'
        });
      }

      // Start autonomy if configured to do so
      const config = this.getConfig<AutonomyManagerConfig>();
      if (config.autonomyConfig.enableAutonomyOnStartup) {
        this.logger.info("Auto-starting autonomy mode (enableAutonomyOnStartup = true)");
        await this.setAutonomyMode(true);
      }

      this.logger.success("Autonomy manager initialized successfully", {
        managerId: this.managerId,
        autonomyEnabled: config.autonomyConfig.enableAutonomyOnStartup
      });

      return true;
    } catch (error) {
      this.logger.error("Failed to initialize autonomy manager", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return false;
    }
  }

  /**
   * Get the autonomy system
   */
  getAutonomySystem(): AutonomySystem {
    if (!this.autonomySystem) {
      this.logger.error("Autonomy system requested but not initialized");
      throw new Error('Autonomy system not initialized');
    }
    return this.autonomySystem;
  }

  /**
   * Get the current status of the autonomy system
   */
  getStatus(): AutonomyStatus {
    if (!this.autonomySystem) {
      this.logger.debug("Status requested - autonomy system not initialized");
      return AutonomyStatus.INACTIVE;
    }
    
    const status = this.autonomySystem.getStatus();
    this.logger.debug("Autonomy status retrieved", { status });
    return status;
  }

  /**
   * Enable or disable autonomous mode
   */
  async setAutonomyMode(enabled: boolean): Promise<boolean> {
    this.logger.info("Setting autonomy mode", { 
      enabled,
      currentMode: this.getAutonomyMode()
    });
    
    if (!this.autonomySystem) {
      this.logger.error("Cannot set autonomy mode - system not initialized");
      return false;
    }
    
    try {
      const result = await this.autonomySystem.setAutonomyMode(enabled);
      
      if (result) {
        this.logger.success("Autonomy mode changed successfully", {
          enabled,
          newStatus: this.autonomySystem.getStatus()
        });
      } else {
        this.logger.warn("Failed to change autonomy mode", { enabled });
      }
      
      return result;
    } catch (error) {
      this.logger.error("Error setting autonomy mode", {
        enabled,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Get the current autonomy mode
   */
  getAutonomyMode(): boolean {
    if (!this.autonomySystem) {
      this.logger.debug("Autonomy mode requested - system not initialized, returning false");
      return false;
    }
    
    const mode = this.autonomySystem.getAutonomyMode();
    this.logger.debug("Autonomy mode retrieved", { mode });
    return mode;
  }

  /**
   * Get the manager health status
   */
  async getHealth(): Promise<ManagerHealth> {
    this.logger.debug("Collecting autonomy manager health");
    
    try {
      const diagnostics = await this.getDiagnostics();
      const capabilities = this.getCapabilities();
      const stats = await this.getTaskStatistics();
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      let message: string;
      
      if (diagnostics.status === AutonomyStatus.ACTIVE) {
        status = 'healthy';
        message = 'Autonomy manager is operating normally';
      } else if (diagnostics.status === AutonomyStatus.STANDBY) {
        status = 'degraded';
        message = 'Autonomy manager is in standby mode';
      } else {
        status = 'unhealthy';
        message = 'Autonomy manager is not functioning properly';
      }
      
      const health: ManagerHealth = {
        status,
        message,
        metrics: {
          autonomyStatus: diagnostics.status,
          tasksExecuted: stats.totalTasks,
          successRate: stats.successRate,
          fullAutonomy: capabilities.fullAutonomy
        },
        details: {
          lastCheck: new Date(),
          issues: (diagnostics.errors || []).map(error => ({
            severity: 'high' as const,
            message: error,
            detectedAt: new Date()
          })),
          metrics: {
            scheduler: diagnostics.scheduler,
            memory: diagnostics.memory,
            planning: diagnostics.planning,
            resources: diagnostics.resources,
            capabilities
          }
        }
      };
      
      this.logger.debug("Autonomy manager health collected", {
        status,
        issueCount: health.details.issues.length,
        tasksExecuted: stats.totalTasks
      });
      
      return health;
    } catch (error) {
      this.logger.error("Error collecting autonomy manager health", {
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        status: 'unhealthy',
        message: 'Failed to collect health information',
        metrics: {},
        details: {
          lastCheck: new Date(),
          issues: [{
            severity: 'high',
            message: `Health check failed: ${error}`,
            detectedAt: new Date()
          }],
          metrics: {}
        }
      };
    }
  }

  /**
   * Get all scheduled tasks
   */
  async getTasks(): Promise<ScheduledTask[]> {
    if (!this.autonomySystem) {
      return [];
    }
    return await this.autonomySystem.getScheduledTasks();
  }

  /**
   * Schedule a new task
   */
  async scheduleTask(task: ScheduledTask): Promise<boolean> {
    this.logger.info("Scheduling new task", {
      taskId: task.id,
      taskName: task.name,
      schedule: task.schedule,
      enabled: task.enabled
    });
    
    if (!this.autonomySystem) {
      this.logger.error("Cannot schedule task - autonomy system not initialized", {
        taskId: task.id
      });
      return false;
    }
    
    try {
      const result = await this.autonomySystem.scheduleTask(task);
      
      if (result) {
        this.logger.success("Task scheduled successfully", {
          taskId: task.id,
          taskName: task.name
        });
      } else {
        this.logger.warn("Failed to schedule task", {
          taskId: task.id,
          taskName: task.name
        });
      }
      
      return result;
    } catch (error) {
      this.logger.error("Error scheduling task", {
        taskId: task.id,
        taskName: task.name,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Run a task immediately
   */
  async runTask(taskId: string): Promise<boolean> {
    this.logger.info("Running task immediately", { taskId });
    
    if (!this.autonomySystem) {
      this.logger.error("Cannot run task - autonomy system not initialized", { taskId });
      return false;
    }
    
    try {
      const result = await this.autonomySystem.runTask(taskId);
      
      if (result) {
        this.logger.success("Task executed successfully", { taskId });
      } else {
        this.logger.warn("Task execution failed", { taskId });
      }
      
      return result;
    } catch (error) {
      this.logger.error("Error running task", {
        taskId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Cancel a scheduled task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    this.logger.info("Cancelling task", { taskId });
    
    if (!this.autonomySystem) {
      this.logger.error("Cannot cancel task - autonomy system not initialized", { taskId });
      return false;
    }
    
    try {
      const result = await this.autonomySystem.cancelTask(taskId);
      
      if (result) {
        this.logger.success("Task cancelled successfully", { taskId });
      } else {
        this.logger.warn("Failed to cancel task", { taskId });
      }
      
      return result;
    } catch (error) {
      this.logger.error("Error cancelling task", {
        taskId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Enable or disable a task
   */
  async setTaskEnabled(taskId: string, enabled: boolean): Promise<boolean> {
    this.logger.info("Setting task enabled status", { taskId, enabled });
    
    if (!this.autonomySystem) {
      this.logger.error("Cannot set task enabled - autonomy system not initialized", {
        taskId,
        enabled
      });
      return false;
    }
    
    try {
      const result = await this.autonomySystem.setTaskEnabled(taskId, enabled);
      
      if (result) {
        this.logger.success("Task enabled status updated", { taskId, enabled });
      } else {
        this.logger.warn("Failed to update task enabled status", { taskId, enabled });
      }
      
      return result;
    } catch (error) {
      this.logger.error("Error setting task enabled status", {
        taskId,
        enabled,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Run diagnostics on the autonomy system
   */
  async diagnose(): Promise<AutonomyDiagnostics> {
    if (!this.autonomySystem) {
      return {
        status: AutonomyStatus.INACTIVE,
        memory: {
          status: 'error',
          messageCount: 0,
          utilizationPercent: 0
        },
        scheduler: {
          status: 'error',
          activeTasks: 0,
          pendingTasks: 0,
          capacityUtilization: 0
        },
        planning: {
          status: 'error',
          successRate: 0,
          avgPlanTime: 0
        },
        resources: {
          cpuUtilization: 0,
          memoryUtilization: 0,
          apiCallsPerMinute: 0
        },
        capabilities: {
          fullAutonomy: false,
          taskGeneration: false,
          domainDecisionMaking: false,
          selfImprovement: false,
          scheduleManagement: false,
          adaptability: false
        },
        errors: ['Autonomy system not initialized']
      };
    }
    
    this.logAction('Running diagnostics');
    return await this.autonomySystem.diagnose();
  }

  /**
   * Plan and execute a goal autonomously
   */
  async planAndExecute(options: AutonomousExecutionOptions): Promise<AutonomousExecutionResult> {
    if (!this.autonomySystem) {
      return {
        success: false,
        message: 'Autonomy system not initialized',
        error: 'AUTONOMY_NOT_INITIALIZED'
      };
    }
    
    this.logAction('Executing autonomous plan', { goal: options.goalPrompt });
    return await this.autonomySystem.planAndExecute(options);
  }

  /**
   * Run daily autonomous tasks
   */
  async runDailyTasks(): Promise<boolean> {
    if (!this.autonomySystem) {
      return false;
    }
    
    this.logAction('Running daily tasks');
    return await this.autonomySystem.runDailyTasks();
  }

  /**
   * Run weekly reflection
   */
  async runWeeklyReflection(): Promise<boolean> {
    if (!this.autonomySystem) {
      return false;
    }
    
    this.logAction('Running weekly reflection');
    return await this.autonomySystem.runWeeklyReflection();
  }

  /**
   * Get task execution statistics
   */
  async getTaskStatistics(): Promise<TaskStatistics> {
    this.logger.debug("Collecting task statistics");
    
    if (!this.autonomySystem) {
      this.logger.warn("Task statistics requested - autonomy system not initialized");
      return {
        totalTasks: 0,
        successfulTasks: 0,
        failedTasks: 0,
        runningTasks: 0,
        pendingTasks: 0,
        averageCompletionTimeMs: 0,
        successRate: 0,
        tasksByCategory: {},
        totalExecutions: 0
      };
    }
    
    try {
      const stats = await this.autonomySystem.getTaskStatistics();
      this.logger.debug("Task statistics collected", {
        totalTasks: stats.totalTasks,
        successfulTasks: stats.successfulTasks,
        failedTasks: stats.failedTasks,
        successRate: stats.successRate
      });
      return stats;
    } catch (error) {
      this.logger.error("Error collecting task statistics", {
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        totalTasks: 0,
        successfulTasks: 0,
        failedTasks: 0,
        runningTasks: 0,
        pendingTasks: 0,
        averageCompletionTimeMs: 0,
        successRate: 0,
        tasksByCategory: {},
        totalExecutions: 0
      };
    }
  }

  /**
   * Get autonomy capabilities
   */
  getCapabilities(): AutonomyCapabilities {
    if (!this.autonomySystem) {
      this.logger.debug("Capabilities requested - autonomy system not initialized");
      return {
        fullAutonomy: false,
        taskGeneration: false,
        domainDecisionMaking: false,
        selfImprovement: false,
        scheduleManagement: false,
        adaptability: false
      };
    }
    
    const capabilities = this.autonomySystem.getCapabilities();
    this.logger.debug("Autonomy capabilities retrieved", { capabilities });
    return capabilities;
  }

  /**
   * Generate a task based on a goal
   */
  async generateTask(goal: string, options?: {
    schedule?: string;
    priority?: number;
    category?: string;
    tags?: string[];
  }): Promise<ScheduledTask | null> {
    this.logger.info("Generating task from goal", {
      goal: goal.substring(0, 100) + (goal.length > 100 ? '...' : ''),
      schedule: options?.schedule,
      priority: options?.priority,
      category: options?.category,
      tags: options?.tags
    });
    
    if (!this.autonomySystem) {
      this.logger.error("Cannot generate task - autonomy system not initialized");
      return null;
    }

    try {
      const task = await this.autonomySystem.generateTask(goal, options);
      
      if (task) {
        this.logger.success("Task generated successfully", {
          taskId: task.id,
          taskName: task.name,
          schedule: task.schedule,
          enabled: task.enabled
        });
      } else {
        this.logger.warn("Task generation returned null", { goal: goal.substring(0, 100) });
      }
      
      return task;
    } catch (error) {
      this.logger.error("Error generating task", {
        goal: goal.substring(0, 100),
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Get diagnostic information about the autonomy system
   */
  async getDiagnostics(): Promise<AutonomyDiagnostics> {
    this.logger.debug("Collecting autonomy diagnostics");
    
    if (!this.autonomySystem) {
      this.logger.warn("Diagnostics requested - autonomy system not initialized");
      return {
        status: AutonomyStatus.INACTIVE,
        memory: {
          status: 'error',
          messageCount: 0,
          utilizationPercent: 0
        },
        scheduler: {
          status: 'error',
          activeTasks: 0,
          pendingTasks: 0,
          capacityUtilization: 0
        },
        planning: {
          status: 'error',
          successRate: 0,
          avgPlanTime: 0
        },
        resources: {
          cpuUtilization: 0,
          memoryUtilization: 0,
          apiCallsPerMinute: 0
        },
        capabilities: this.getCapabilities(),
        errors: ['Autonomy system not initialized']
      };
    }
    
    try {
      const diagnostics = await this.autonomySystem.diagnose();
      this.logger.debug("Autonomy diagnostics collected", {
        status: diagnostics.status,
        memoryStatus: diagnostics.memory.status,
        schedulerStatus: diagnostics.scheduler.status,
        planningStatus: diagnostics.planning.status,
        errorCount: diagnostics.errors?.length || 0
      });
      return diagnostics;
    } catch (error) {
      this.logger.error("Error collecting autonomy diagnostics", {
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        status: AutonomyStatus.ERROR,
        memory: {
          status: 'error',
          messageCount: 0,
          utilizationPercent: 0
        },
        scheduler: {
          status: 'error',
          activeTasks: 0,
          pendingTasks: 0,
          capacityUtilization: 0
        },
        planning: {
          status: 'error',
          successRate: 0,
          avgPlanTime: 0
        },
        resources: {
          cpuUtilization: 0,
          memoryUtilization: 0,
          apiCallsPerMinute: 0
        },
        capabilities: this.getCapabilities(),
        errors: [`Error collecting diagnostics: ${error}`]
      };
    }
  }

  /**
   * Helper method to log actions with consistent formatting
   */
  private logAction(message: string, metadata?: Record<string, any>): void {
    this.logger.info(`[AutonomyManager] ${message}`, {
      managerId: this.managerId,
      agentId: this.agent.getAgentId(),
      ...metadata
    });
  }

  async shutdown(): Promise<void> {
    this.logger.info("Shutting down autonomy manager");
    
    try {
      if (this.autonomySystem) {
        // Disable autonomy mode
        await this.setAutonomyMode(false);
        
        // Shutdown the autonomy system if it has a shutdown method
        if ('shutdown' in this.autonomySystem && typeof this.autonomySystem.shutdown === 'function') {
          await (this.autonomySystem as any).shutdown();
        }
        
        this.logger.debug("Autonomy system shutdown completed");
      }
      
      this.logger.success("Autonomy manager shutdown completed");
    } catch (error) {
      this.logger.error("Error during autonomy manager shutdown", {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
} 