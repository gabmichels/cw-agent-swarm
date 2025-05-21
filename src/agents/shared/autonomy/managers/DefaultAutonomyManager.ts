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

export class DefaultAutonomyManager extends AbstractBaseManager implements AutonomyManager {
  private autonomySystem: AutonomySystem | null = null;
  private schedulingTimer: NodeJS.Timeout | undefined;

  constructor(agent: AgentBase, config: AutonomyManagerConfig) {
    super(
      agent.getAgentId() + '-autonomy-manager',
      ManagerType.AUTONOMY,
      agent,
      config
    );
  }

  async initialize(): Promise<boolean> {
    if (this._initialized) {
      return true;
    }

    try {
      this.autonomySystem = new DefaultAutonomySystem(this.getAgent(), this.getConfig<AutonomyManagerConfig>().autonomyConfig);
      await this.autonomySystem.initialize();
      this._initialized = true;
      this.logAction('Autonomy system initialized successfully');
      return true;
    } catch (error) {
      this.logAction('Failed to initialize autonomy system', { error });
      console.error('Error initializing autonomy manager:', error);
      return false;
    }
  }

  /**
   * Get the autonomy system
   */
  getAutonomySystem(): AutonomySystem {
    if (!this.autonomySystem) {
      throw new Error('Autonomy system not initialized');
    }
    return this.autonomySystem;
  }

  /**
   * Get the current status of the autonomy system
   */
  getStatus(): AutonomyStatus {
    if (!this.autonomySystem) {
      return AutonomyStatus.INACTIVE;
    }
    return this.autonomySystem.getStatus();
  }

  /**
   * Enable or disable autonomous mode
   */
  async setAutonomyMode(enabled: boolean): Promise<boolean> {
    if (!this.autonomySystem) {
      return false;
    }
    
    const result = await this.autonomySystem.setAutonomyMode(enabled);
    if (result) {
      this.logAction(`Autonomy mode ${enabled ? 'enabled' : 'disabled'}`);
    }
    return result;
  }

  /**
   * Get the current autonomy mode
   */
  getAutonomyMode(): boolean {
    if (!this.autonomySystem) {
      return false;
    }
    return this.autonomySystem.getAutonomyMode();
  }

  /**
   * Get the manager health status
   */
  async getHealth(): Promise<ManagerHealth> {
    const status = this.autonomySystem ? await this.autonomySystem.getStatus() : AutonomyStatus.INACTIVE;
    const capabilities = this.getCapabilities();
    
    return {
      status: this._initialized ? 'healthy' : 'unhealthy',
      message: `Autonomy system is ${status}`,
      details: {
        lastCheck: new Date(),
        issues: [],
        metrics: {
          status,
          capabilities,
          isEnabled: this.isEnabled(),
          isInitialized: this._initialized,
          autonomyMode: this.getAutonomyMode()
        }
      }
    };
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
    if (!this.autonomySystem) {
      return false;
    }
    
    try {
      const result = await this.autonomySystem.scheduleTask(task);
      if (result) {
        this.logAction(`Scheduled task: ${task.name} (${task.id})`);
      }
      return result;
    } catch (error) {
      this.logAction('Failed to schedule task', { error, taskId: task.id });
      return false;
    }
  }

  /**
   * Run a task immediately
   */
  async runTask(taskId: string): Promise<boolean> {
    if (!this.autonomySystem) {
      return false;
    }
    
    this.logAction(`Running task: ${taskId}`);
    return await this.autonomySystem.runTask(taskId);
  }

  /**
   * Cancel a scheduled task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    if (!this.autonomySystem) {
      return false;
    }
    
    const result = await this.autonomySystem.cancelTask(taskId);
    if (result) {
      this.logAction(`Cancelled task: ${taskId}`);
    }
    return result;
  }

  /**
   * Enable or disable a task
   */
  async setTaskEnabled(taskId: string, enabled: boolean): Promise<boolean> {
    if (!this.autonomySystem) {
      return false;
    }
    
    const result = await this.autonomySystem.setTaskEnabled(taskId, enabled);
    if (result) {
      this.logAction(`${enabled ? 'Enabled' : 'Disabled'} task: ${taskId}`);
    }
    return result;
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
   * Get task statistics
   */
  async getTaskStatistics(): Promise<TaskStatistics> {
    if (!this.autonomySystem) {
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
    
    return await this.autonomySystem.getTaskStatistics();
  }

  /**
   * Get autonomy capabilities
   */
  getCapabilities(): AutonomyCapabilities {
    if (!this.autonomySystem) {
      return {
        fullAutonomy: false,
        taskGeneration: false,
        domainDecisionMaking: false,
        selfImprovement: false,
        scheduleManagement: false,
        adaptability: false
      };
    }
    
    return this.autonomySystem.getCapabilities();
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
    if (!this.autonomySystem) {
      return null;
    }

    try {
      return await this.autonomySystem.generateTask(goal, options);
    } catch (error) {
      this.logAction('Failed to generate task', { error, goal });
      return null;
    }
  }

  protected logAction(action: string, metadata?: Record<string, unknown>): void {
    try {
      const loggerManager = this.getAgent().getManager<LoggerManager>(ManagerType.LOGGER);
      // If we have a logger manager, use it
      if (loggerManager && typeof loggerManager.log === 'function') {
        loggerManager.log(action, metadata);
        return;
      }
    } catch (error) {
      // Fallback to console if any errors occur accessing the logger
      console.error(`Error using logger manager: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Fallback to console.log if no logger manager is available
    console.log(`[${this.getAgent().getAgentId()}][AutonomyManager] ${action}`, metadata || '');
  }
} 