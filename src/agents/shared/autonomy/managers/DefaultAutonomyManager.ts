/**
 * DefaultAutonomyManager.ts
 * 
 * Default implementation of the AutonomyManager interface that uses the DefaultAutonomySystem
 * to provide autonomous operation for agents.
 */

import { AgentBase } from '../../base/AgentBase.interface';
import { BaseManager, ManagerConfig } from '../../base/managers/BaseManager';
import { AutonomyManager, AutonomyManagerConfig } from '../interfaces/AutonomyManager.interface';
import {
  AutonomySystem, AutonomyStatus, AutonomyCapabilities, AutonomyDiagnostics,
  TaskStatistics, AutonomousExecutionOptions, AutonomousExecutionResult
} from '../interfaces/AutonomySystem.interface';
import { DefaultAutonomySystem } from '../systems/DefaultAutonomySystem';
import { ScheduledTask } from '../../../../lib/agents/base/managers/SchedulerManager';

/**
 * Default implementation of the AutonomyManager interface
 */
export class DefaultAutonomyManager implements AutonomyManager {
  private agent: AgentBase;
  private config: AutonomyManagerConfig;
  private autonomySystem: AutonomySystem | null = null;
  private initialized: boolean = false;
  private readonly managerId: string;
  private readonly managerType: string = 'autonomy';
  
  /**
   * Create a new DefaultAutonomyManager
   * 
   * @param agent The agent this manager belongs to
   * @param config Configuration for the autonomy manager
   */
  constructor(agent: AgentBase, config: AutonomyManagerConfig) {
    this.agent = agent;
    this.config = config;
    this.managerId = `${agent.getAgentId()}_autonomy_manager`;
  }
  
  /**
   * Get the manager ID
   */
  getId(): string {
    return this.managerId;
  }
  
  /**
   * Get the manager type
   */
  getType(): string {
    return this.managerType;
  }
  
  /**
   * Get the manager configuration
   */
  getConfig<T extends ManagerConfig>(): T {
    return this.config as unknown as T;
  }
  
  /**
   * Update the manager configuration
   */
  updateConfig<T extends ManagerConfig>(config: Partial<T>): T {
    this.config = {
      ...this.config,
      ...config,
    };
    return this.config as unknown as T;
  }
  
  /**
   * Get the agent this manager belongs to
   */
  getAgent(): AgentBase {
    return this.agent;
  }
  
  /**
   * Get the agent ID
   */
  getAgentId(): string {
    return this.agent.getAgentId();
  }
  
  /**
   * Check if the manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Initialize the autonomy manager
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }
    
    try {
      // Create the autonomy system
      this.autonomySystem = new DefaultAutonomySystem(this.agent, this.config.autonomyConfig);
      
      // Initialize the autonomy system
      const success = await this.autonomySystem.initialize();
      this.initialized = success;
      
      if (success) {
        this.logAction('Autonomy system initialized successfully');
      } else {
        this.logAction('Failed to initialize autonomy system', { error: 'INITIALIZATION_FAILED' });
      }
      
      return success;
    } catch (error) {
      this.logAction('Error initializing autonomy system', { error: String(error) });
      console.error('Error initializing autonomy manager:', error);
      return false;
    }
  }
  
  /**
   * Shutdown the autonomy manager
   */
  async shutdown(): Promise<void> {
    if (this.autonomySystem) {
      await this.autonomySystem.shutdown();
      this.autonomySystem = null;
    }
    this.initialized = false;
    this.logAction('Autonomy system shutdown');
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
   * Get all scheduled tasks
   */
  getScheduledTasks(): ScheduledTask[] {
    if (!this.autonomySystem) {
      return [];
    }
    return this.autonomySystem.getScheduledTasks();
  }
  
  /**
   * Schedule a new task
   */
  async scheduleTask(task: ScheduledTask): Promise<boolean> {
    if (!this.autonomySystem) {
      return false;
    }
    
    const result = await this.autonomySystem.scheduleTask(task);
    if (result) {
      this.logAction(`Scheduled task: ${task.name} (${task.id})`);
    }
    return result;
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
    
    const task = await this.autonomySystem.generateTask(goal, options);
    if (task) {
      this.logAction('Generated task', { 
        id: task.id, 
        name: task.name,
        goal: goal,
        category: options?.category
      });
    }
    
    return task;
  }
  
  /**
   * Log an action taken by this manager
   */
  logAction(action: string, metadata?: Record<string, unknown>): void {
    const logMessage = `[AutonomyManager] ${action}`;
    
    // Try to use the logger manager if available
    const loggerManager = this.agent?.getManager('logger');
    if (loggerManager && typeof (loggerManager as any).logAction === 'function') {
      (loggerManager as any).logAction(logMessage, metadata);
      return;
    }
    
    // Fallback to console
    console.log(logMessage, metadata || '');
  }
} 