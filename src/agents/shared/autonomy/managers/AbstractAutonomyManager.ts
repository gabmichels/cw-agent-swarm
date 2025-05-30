/**
 * AbstractAutonomyManager.ts
 * 
 * Abstract base class for the AutonomyManager interface.
 */

import { AbstractBaseManager, ManagerConfig } from '../../base/managers/BaseManager';
import { ManagerType } from '../../base/managers/ManagerType';
import { AutonomyManager, AutonomyManagerConfig } from '../interfaces/AutonomyManager.interface';
import { 
  AutonomySystem, AutonomyStatus, AutonomyCapabilities, AutonomyDiagnostics, 
  TaskStatistics, AutonomousExecutionOptions, AutonomousExecutionResult 
} from '../interfaces/AutonomySystem.interface';
import { ScheduledTask, TaskCreationOptions, TaskExecutionResult } from '../../base/managers/SchedulerManager.interface';
import { ManagerHealth } from '../../base/managers/ManagerHealth';
import { AgentBase } from '../../base/AgentBase.interface';
import { LoggerManager } from '../../base/managers/LoggerManager.interface';
import { ScheduledTask as AgentScheduledTask } from '../../../../lib/shared/types/agentTypes';

/**
 * Abstract implementation of the AutonomyManager interface
 */
export abstract class AbstractAutonomyManager extends AbstractBaseManager
  implements AutonomyManager {
  
  protected readonly agent: AgentBase;
  public readonly autonomySystem: AutonomySystem;
  public readonly managerType = ManagerType.AUTONOMY;
  public readonly managerId: string;
  protected config: AutonomyManagerConfig;
  protected initialized: boolean = false;
  protected enabled: boolean = true;
  
  /**
   * Create a new AbstractAutonomyManager
   * 
   * @param agent The agent this manager belongs to
   * @param autonomySystem The autonomy system this manager manages
   * @param config Configuration for this manager
   */
  constructor(agent: AgentBase, autonomySystem: AutonomySystem, config: AutonomyManagerConfig) {
    super(agent.getAgentId() + '-autonomy-manager', ManagerType.AUTONOMY, agent, { enabled: true });
    this.agent = agent;
    this.autonomySystem = autonomySystem;
    this.config = config;
    this.managerId = `${agent.getAgentId()}-autonomy-manager`;
  }
  
  /**
   * Get the current configuration
   */
  getConfig<T extends ManagerConfig>(): T {
    return this.config as unknown as T;
  }
  
  /**
   * Update the configuration
   */
  updateConfig<T extends ManagerConfig>(config: Partial<T>): T {
    this.config = {
      ...this.config,
      ...config,
    } as AutonomyManagerConfig;
    
    return this.config as unknown as T;
  }
  
  /**
   * Check if the manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Check if the manager is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
  
  /**
   * Enable or disable the manager
   */
  setEnabled(enabled: boolean): boolean {
    this.enabled = enabled;
    return enabled;
  }
  
  /**
   * Reset the manager state
   */
  reset(): Promise<boolean> {
    this.initialized = false;
    return Promise.resolve(true);
  }
  
  /**
   * Get the health status of the manager
   */
  async getHealth(): Promise<ManagerHealth> {
    try {
      const metrics = await this.getMetrics();
      return {
        status: 'healthy',
        message: 'Autonomy manager is healthy',
        metrics,
        details: {
          lastCheck: new Date(),
          issues: [],
          metrics
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Autonomy manager health check failed: ${error}`,
        details: {
          lastCheck: new Date(),
          issues: [{
            severity: 'critical',
            message: error instanceof Error ? error.message : String(error),
            detectedAt: new Date()
          }]
        }
      };
    }
  }
  
  /**
   * Initialize the autonomy manager
   * 
   * @returns Promise resolving to true if initialization was successful
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }
    
    try {
      // Create and initialize the autonomy system
      const success = await this.autonomySystem.initialize();
      this.initialized = success;
      
      if (success && this.config.autonomyConfig.enableAutonomyOnStartup) {
        await this.autonomySystem.setAutonomyMode(true);
      }
      
      return success;
    } catch (error) {
      console.error('Error initializing autonomy manager:', error);
      return false;
    }
  }

  /**
   * Create the autonomy system implementation
   */
  protected abstract createAutonomySystem(): Promise<AutonomySystem | null>;

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
    return this.autonomySystem.setAutonomyMode(enabled);
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
   * Get the scheduled tasks managed by the autonomy system
   */
  async getTasks(): Promise<AgentScheduledTask[]> {
    if (!this.autonomySystem) {
      return [];
    }
    const tasks = await this.autonomySystem.getScheduledTasks();
    return tasks.map(task => ({
      id: task.id,
      name: task.name,
      description: task.description,
      schedule: task.schedule,
      goalPrompt: task.goalPrompt,
      lastRun: task.lastRun,
      nextRun: task.nextRun,
      enabled: task.enabled,
      tags: task.tags,
      interval: task.interval,
      intervalId: task.intervalId
    }));
  }

  /**
   * Schedule a new task
   */
  async scheduleTask(task: AgentScheduledTask): Promise<boolean> {
    if (!this.autonomySystem) {
      throw new Error('Autonomy system not initialized');
    }
    return this.autonomySystem.scheduleTask(task);
  }

  /**
   * Run a task immediately
   */
  async runTask(taskId: string): Promise<boolean> {
    if (!this.autonomySystem) {
      return false;
    }
    return this.autonomySystem.runTask(taskId);
  }

  /**
   * Cancel a scheduled task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    if (!this.autonomySystem) {
      return false;
    }
    return this.autonomySystem.cancelTask(taskId);
  }

  /**
   * Enable or disable a task
   */
  async setTaskEnabled(taskId: string, enabled: boolean): Promise<boolean> {
    if (!this.autonomySystem) {
      return false;
    }
    return this.autonomySystem.setTaskEnabled(taskId, enabled);
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
    return this.autonomySystem.diagnose();
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
    return this.autonomySystem.planAndExecute(options);
  }

  /**
   * Run daily autonomous tasks
   */
  async runDailyTasks(): Promise<boolean> {
    if (!this.autonomySystem) {
      return false;
    }
    return this.autonomySystem.runDailyTasks();
  }

  /**
   * Run weekly reflection
   */
  async runWeeklyReflection(): Promise<boolean> {
    if (!this.autonomySystem) {
      return false;
    }
    return this.autonomySystem.runWeeklyReflection();
  }

  /**
   * Get statistics about task usage
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
    return this.autonomySystem.getTaskStatistics();
  }

  /**
   * Get the capabilities of the autonomy system
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
  }): Promise<AgentScheduledTask | null> {
    if (!this.autonomySystem) {
      return null;
    }
    return this.autonomySystem.generateTask(goal, options);
  }

  /**
   * Shutdown the autonomy manager
   */
  async shutdown(): Promise<void> {
    if (this.autonomySystem) {
      await this.autonomySystem.shutdown();
    }
    this.initialized = false;
  }
  
  /**
   * Log an action taken by this manager
   */
  protected logAction(action: string, metadata?: Record<string, unknown>): void {
    if (this.agent) {
      const loggerManager = this.agent.getManager<LoggerManager>(ManagerType.LOGGER);
      if (loggerManager) {
        loggerManager.log(action, metadata);
        return;
      }
    }
    
    console.log(`[${this.agent.getAgentId()}][AutonomyManager] ${action}`, metadata || '');
  }

  getAgent(): AgentBase {
    return this.agent;
  }

  abstract getMetrics(): Promise<Record<string, unknown>>;
} 