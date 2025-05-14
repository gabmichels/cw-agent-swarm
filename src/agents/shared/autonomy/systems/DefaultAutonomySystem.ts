/**
 * DefaultAutonomySystem.ts
 * 
 * Default implementation of the AutonomySystem interface, providing
 * autonomous task scheduling and execution.
 */

import { CronJob } from 'cron';
import { v4 as uuidv4 } from 'uuid';
import { AgentBase } from '../../base/AgentBase.interface';
import { MemoryManager } from '../../base/managers/MemoryManager';
import { PlanningManager } from '../../base/managers/PlanningManager.interface';
import { SchedulerManager, ScheduledTask } from '../../../../lib/agents/base/managers/SchedulerManager';
import { 
  AutonomySystem, AutonomySystemConfig, AutonomyStatus, AutonomyCapabilities, 
  AutonomyDiagnostics, TaskStatistics, AutonomousExecutionOptions, AutonomousExecutionResult
} from '../interfaces/AutonomySystem.interface';
import { PlanAndExecuteOptions, PlanAndExecuteResult } from '../../../../lib/shared/types/agentTypes';

/**
 * Internal extension of ScheduledTask with additional properties for the autonomy system
 * This interface properly extends ScheduledTask, ensuring all required properties exist
 */
interface InternalScheduledTask extends ScheduledTask {
  // Additional properties for internal use
  enabled: boolean;
  lastRun?: Date;
}

/**
 * Default implementation of the AutonomySystem interface
 */
export class DefaultAutonomySystem implements AutonomySystem {
  private agent: AgentBase;
  private config: AutonomySystemConfig;
  private autonomyMode: boolean;
  private scheduledTasks: Map<string, InternalScheduledTask> = new Map();
  private activeJobs: Map<string, CronJob> = new Map();
  private status: AutonomyStatus = AutonomyStatus.INACTIVE;
  private lastDiagnostics: AutonomyDiagnostics | null = null;
  private taskHistory: Map<string, {
    runs: number;
    successes: number;
    failures: number;
    totalTimeMs: number;
    lastRunTime?: Date;
  }> = new Map();
  
  /**
   * Create a new DefaultAutonomySystem
   * 
   * @param agent The agent this system belongs to
   * @param config Configuration for the autonomy system
   */
  constructor(agent: AgentBase, config: AutonomySystemConfig) {
    this.agent = agent;
    this.config = config;
    this.autonomyMode = config.enableAutonomyOnStartup || false;
  }
  
  /**
   * Initialize the autonomy system
   */
  async initialize(): Promise<boolean> {
    try {
      // Check if managers we depend on are available
      const memoryManagerAvailable = !!this.agent.getManager('memory');
      const planningManagerAvailable = !!this.agent.getManager('planning');
      const schedulerManagerAvailable = !!this.agent.getManager('scheduler');
      
      // Set up default schedules
      await this.setupDefaultTasks();
      
      // Update status based on manager availability
      if (memoryManagerAvailable && planningManagerAvailable && schedulerManagerAvailable) {
        this.status = AutonomyStatus.STANDBY;
        
        // If autonomous mode should be enabled at startup
        if (this.config.enableAutonomyOnStartup) {
          await this.setAutonomyMode(true);
        }
        
        return true;
      } else {
        console.warn(`[AutonomySystem] Partial initialization: Memory: ${memoryManagerAvailable}, Planning: ${planningManagerAvailable}, Scheduler: ${schedulerManagerAvailable}`);
        this.status = AutonomyStatus.ERROR;
        return false;
      }
    } catch (error) {
      console.error('[AutonomySystem] Initialization error:', error);
      this.status = AutonomyStatus.ERROR;
      return false;
    }
  }
  
  /**
   * Set up default scheduled tasks
   */
  private async setupDefaultTasks(): Promise<void> {
    // Daily reflection at 2:00 AM
    if (this.config.selfImprovement?.enablePeriodicReflection) {
      const dailySchedule = this.config.selfImprovement.dailyReflectionSchedule || '0 2 * * *';
      
      // Daily reflection task
      await this.scheduleTask({
        id: 'daily-reflection',
        name: 'Daily Reflection',
        description: 'Review recent activities and generate insights',
        schedule: dailySchedule,
        priority: 0.7,
        status: 'scheduled',
        type: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
        executionCount: 0,
        failureCount: 0,
        parameters: {
          prompt: 'Review my recent activities and generate insights. What patterns do you notice? What could be improved?',
          maxResults: 3
        },
        metadata: {
          category: 'reflection',
          tags: ['system', 'automated', 'reflection', 'daily']
        }
      });
      
      // Weekly reflection task at 3:00 AM on Sundays
      const weeklySchedule = this.config.selfImprovement.weeklyReflectionSchedule || '0 3 * * 0';
      
      await this.scheduleTask({
        id: 'weekly-reflection',
        name: 'Weekly Reflection',
        description: 'Perform a deep reflection on the week\'s activities',
        schedule: weeklySchedule,
        priority: 0.8,
        status: 'scheduled',
        type: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
        executionCount: 0,
        failureCount: 0,
        parameters: {
          prompt: 'Perform a deep reflection on this week\'s activities. What were the major accomplishments? What challenges were faced? What could be improved next week?',
          maxResults: 5,
          includeActionItems: true
        },
        metadata: {
          category: 'reflection',
          tags: ['system', 'automated', 'reflection', 'weekly']
        }
      });
      
      // Maintenance tasks
      await this.scheduleTask({
        id: 'memory-maintenance',
        name: 'Memory Maintenance',
        description: 'Consolidate and optimize memory storage',
        schedule: '0 4 * * 0', // 4:00 AM on Sundays
        priority: 0.6,
        status: 'scheduled',
        type: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
        executionCount: 0,
        failureCount: 0,
        parameters: {
          operations: ['consolidate', 'optimize', 'prune']
        },
        metadata: {
          category: 'maintenance',
          tags: ['system', 'automated', 'maintenance', 'memory']
        }
      });
    }
  }
  
  /**
   * Shutdown the autonomy system
   */
  async shutdown(): Promise<void> {
    // Stop all active jobs
    for (const [id, job] of Array.from(this.activeJobs.entries())) {
      job.stop();
      console.log(`[AutonomySystem] Stopped job: ${id}`);
    }
    
    this.activeJobs.clear();
    this.status = AutonomyStatus.INACTIVE;
  }
  
  /**
   * Get the current status of the autonomy system
   */
  getStatus(): AutonomyStatus {
    return this.status;
  }
  
  /**
   * Set the autonomy mode (enable/disable autonomous operation)
   */
  async setAutonomyMode(enabled: boolean): Promise<boolean> {
    try {
      this.autonomyMode = enabled;
      
      if (enabled) {
        // Start all enabled scheduled tasks
        for (const [id, task] of Array.from(this.scheduledTasks.entries())) {
          if (task.enabled) {
            this.startTask(id);
          }
        }
        
        this.status = AutonomyStatus.ACTIVE;
        
        // Log to memory if available
        const memoryManager = this.agent.getManager('memory') as MemoryManager;
        if (memoryManager) {
          await memoryManager.addMemory(
            'Autonomy mode enabled', 
            { 
              type: 'SYSTEM_EVENT',
              eventType: 'autonomy_enabled',
              timestamp: new Date().toISOString() 
            }
          );
        }
        
        console.log(`[AutonomySystem] Autonomy mode enabled for agent ${this.agent.getAgentId()}`);
      } else {
        // Stop all scheduled tasks
        for (const [id, job] of Array.from(this.activeJobs.entries())) {
          job.stop();
        }
        
        this.activeJobs.clear();
        this.status = AutonomyStatus.STANDBY;
        
        // Log to memory if available
        const memoryManager = this.agent.getManager('memory') as MemoryManager;
        if (memoryManager) {
          await memoryManager.addMemory(
            'Autonomy mode disabled', 
            { 
              type: 'SYSTEM_EVENT',
              eventType: 'autonomy_disabled',
              timestamp: new Date().toISOString() 
            }
          );
        }
        
        console.log(`[AutonomySystem] Autonomy mode disabled for agent ${this.agent.getAgentId()}`);
      }
      
      return true;
    } catch (error) {
      console.error('[AutonomySystem] Error setting autonomy mode:', error);
      return false;
    }
  }
  
  /**
   * Get the current autonomy mode
   */
  getAutonomyMode(): boolean {
    return this.autonomyMode;
  }
  
  /**
   * Get all scheduled tasks
   */
  getScheduledTasks(): ScheduledTask[] {
    // Return the ScheduledTask part of our internal task objects
    // This ensures we're returning the expected interface
    return Array.from(this.scheduledTasks.values()).map(internalTask => {
      // Extract only the ScheduledTask properties
      const { enabled, lastRun, ...scheduledTask } = internalTask;
      return scheduledTask;
    });
  }
  
  /**
   * Schedule a new task
   */
  async scheduleTask(task: ScheduledTask): Promise<boolean> {
    try {
      // Convert ScheduledTask to InternalScheduledTask
      const internalTask: InternalScheduledTask = {
        ...task,
        enabled: true
      };
      
      // Store the task
      this.scheduledTasks.set(task.id, internalTask);
      
      // Start the task if autonomy mode is enabled and task is enabled
      if (this.autonomyMode && internalTask.enabled) {
        this.startTask(task.id);
      }
      
      console.log(`[AutonomySystem] Scheduled task: ${task.name} (${task.id})`);
      return true;
    } catch (error) {
      console.error(`[AutonomySystem] Error scheduling task ${task.id}:`, error);
      return false;
    }
  }
  
  /**
   * Start a scheduled task
   */
  private startTask(taskId: string): boolean {
    try {
      const task = this.scheduledTasks.get(taskId);
      if (!task) {
        console.warn(`[AutonomySystem] No task found with ID ${taskId}`);
        return false;
      }
      
      // Don't start if already running or disabled
      if (this.activeJobs.has(taskId) || !task.enabled) {
        return true;
      }
      
      // Create a new CronJob
      const job = new CronJob(
        task.schedule || '0 0 * * *', // Default to midnight every day if schedule not specified
        async () => {
          console.log(`[AutonomySystem] Executing scheduled task: ${task.name} (${taskId})`);
          try {
            await this.executeTask(taskId);
          } catch (error) {
            console.error(`[AutonomySystem] Error executing task ${taskId}:`, error);
          }
        },
        null, // onComplete
        true, // start immediately
        'UTC' // timezone
      );
      
      // Store the job
      this.activeJobs.set(taskId, job);
      console.log(`[AutonomySystem] Started task: ${task.name} (${taskId})`);
      return true;
    } catch (error) {
      console.error(`[AutonomySystem] Error starting task ${taskId}:`, error);
      return false;
    }
  }
  
  /**
   * Execute a scheduled task
   */
  private async executeTask(taskId: string): Promise<boolean> {
    const task = this.scheduledTasks.get(taskId);
    if (!task) {
      console.warn(`[AutonomySystem] No task found with ID ${taskId}`);
      return false;
    }
    
    // Update task history
    let taskStats = this.taskHistory.get(taskId) || {
      runs: 0,
      successes: 0,
      failures: 0,
      totalTimeMs: 0
    };
    
    taskStats.runs++;
    taskStats.lastRunTime = new Date();
    this.taskHistory.set(taskId, taskStats);
    
    // Update task in map
    task.lastRun = new Date();
    task.status = 'running';
    this.scheduledTasks.set(taskId, task);
    
    const startTime = Date.now();
    try {
      console.log(`[AutonomySystem] Executing task ${task.name} (${taskId})`);
      
      // Initialize task execution options
      const executionOptions: AutonomousExecutionOptions = {
        goalPrompt: task.description,
        autonomyMode: true,
        category: task.metadata?.category as string || "scheduled",
        tags: (task.metadata?.tags as string[]) || [],
        requireApproval: false,
        recordReasoning: true
      };
      
      // Extract a standard ScheduledTask to pass to the planning system
      const { enabled, lastRun, ...standardTask } = task;
      
      // Execute the task
      const result = await this.planAndExecuteTask(standardTask, executionOptions);
      
      // Update task stats
      const endTime = Date.now();
      taskStats.totalTimeMs += (endTime - startTime);
      
      if (result.success) {
        taskStats.successes++;
        this.taskHistory.set(taskId, taskStats);
        
        // Update execution count and status
        task.executionCount = (task.executionCount || 0) + 1;
        task.status = 'completed';
        this.scheduledTasks.set(taskId, task);
        
        console.log(`[AutonomySystem] Task ${task.name} (${taskId}) completed successfully`);
        return true;
      } else {
        taskStats.failures++;
        this.taskHistory.set(taskId, taskStats);
        
        // Update failure count and status
        task.failureCount = (task.failureCount || 0) + 1;
        task.status = 'failed';
        this.scheduledTasks.set(taskId, task);
        
        console.error(`[AutonomySystem] Task ${task.name} (${taskId}) failed: ${result.message}`);
        return false;
      }
    } catch (error) {
      const endTime = Date.now();
      taskStats.totalTimeMs += (endTime - startTime);
      taskStats.failures++;
      this.taskHistory.set(taskId, taskStats);
      
      // Update failure count and status
      task.failureCount = (task.failureCount || 0) + 1;
      task.status = 'failed';
      this.scheduledTasks.set(taskId, task);
      
      console.error(`[AutonomySystem] Error executing task ${task.name} (${taskId}):`, error);
      return false;
    }
  }
  
  /**
   * Plan and execute a task
   */
  private async planAndExecuteTask(
    task: ScheduledTask, 
    options: AutonomousExecutionOptions
  ): Promise<AutonomousExecutionResult> {
    try {
      // Get the planning manager
      const planningManager = this.agent.getManager('planning') as PlanningManager;
      if (!planningManager) {
        return {
          success: false,
          message: 'Planning manager not available',
          error: 'PLANNING_MANAGER_NOT_AVAILABLE'
        };
      }
      
      // Combine task parameters with options
      const executionOptions: PlanAndExecuteOptions = {
        ...options,
        goalPrompt: task.description,
        requireApproval: options.requireApproval || false,
        // Add task-specific parameters
        ...task.parameters
      };
      
      // Execute the plan
      const result = await planningManager.planAndExecute(executionOptions.goalPrompt, executionOptions);
      
      // Add analytics data
      const analyticsResult: AutonomousExecutionResult = {
        ...result,
        analytics: {
          totalTimeMs: 0, // Will be calculated by caller
          stepsExecuted: result.plan?.steps.filter((s: any) => s.status === 'completed').length || 0,
          resourceUsage: {
            cpuTime: 0, // Not tracked
            memoryBytes: 0, // Not tracked
            apiCalls: 0, // Not tracked
            tokenCount: 0 // Not tracked
          }
        }
      };
      
      return analyticsResult;
    } catch (error) {
      return {
        success: false,
        message: `Error executing task: ${error}`,
        error: 'TASK_EXECUTION_ERROR'
      };
    }
  }
  
  /**
   * Run a task immediately
   */
  async runTask(taskId: string): Promise<boolean> {
    try {
      console.log(`[AutonomySystem] Running task ${taskId} immediately`);
      return await this.executeTask(taskId);
    } catch (error) {
      console.error(`[AutonomySystem] Error running task ${taskId}:`, error);
      return false;
    }
  }
  
  /**
   * Cancel a scheduled task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    try {
      // Stop the job if running
      const job = this.activeJobs.get(taskId);
      if (job) {
        job.stop();
        this.activeJobs.delete(taskId);
      }
      
      // Mark task as cancelled if it exists
      const task = this.scheduledTasks.get(taskId);
      if (task) {
        task.status = 'cancelled';
        this.scheduledTasks.set(taskId, task);
      }
      
      console.log(`[AutonomySystem] Cancelled task ${taskId}`);
      return true;
    } catch (error) {
      console.error(`[AutonomySystem] Error cancelling task ${taskId}:`, error);
      return false;
    }
  }
  
  /**
   * Enable or disable a task
   */
  async setTaskEnabled(taskId: string, enabled: boolean): Promise<boolean> {
    try {
      const task = this.scheduledTasks.get(taskId);
      if (!task) {
        console.warn(`[AutonomySystem] No task found with ID ${taskId}`);
        return false;
      }
      
      // Update task enabled state
      task.enabled = enabled;
      this.scheduledTasks.set(taskId, task);
      
      // Start or stop the task
      if (this.autonomyMode) {
        if (enabled) {
          this.startTask(taskId);
        } else {
          const job = this.activeJobs.get(taskId);
          if (job) {
            job.stop();
            this.activeJobs.delete(taskId);
          }
        }
      }
      
      console.log(`[AutonomySystem] Task ${taskId} ${enabled ? 'enabled' : 'disabled'}`);
      return true;
    } catch (error) {
      console.error(`[AutonomySystem] Error setting task ${taskId} enabled state:`, error);
      return false;
    }
  }
  
  /**
   * Run diagnostics on the autonomy system
   */
  async diagnose(): Promise<AutonomyDiagnostics> {
    try {
      // Get manager references
      const memoryManager = this.agent.getManager('memory') as MemoryManager;
      const planningManager = this.agent.getManager('planning') as PlanningManager;
      const schedulerManager = this.agent.getManager('scheduler') as SchedulerManager;
      
      // Memory diagnostics
      let memoryDiagnostics = {
        status: 'error' as 'error' | 'operational' | 'degraded',
        messageCount: 0,
        utilizationPercent: 0
      };
      
      if (memoryManager) {
        const memoryStats = await this.getMemoryStats();
        memoryDiagnostics = {
          status: 'operational' as 'operational' | 'degraded' | 'error',
          messageCount: memoryStats.totalMemories,
          utilizationPercent: 0 // Would need storage capacity to calculate
        };
      }
      
      // Scheduler diagnostics
      let schedulerDiagnostics = {
        status: 'error' as 'error' | 'operational' | 'degraded',
        activeTasks: 0,
        pendingTasks: 0,
        capacityUtilization: 0
      };
      
      if (schedulerManager) {
        const runningTasks = await schedulerManager.getRunningTasks();
        const pendingTasks = await schedulerManager.getPendingTasks();
        
        schedulerDiagnostics = {
          status: 'operational' as 'operational' | 'degraded' | 'error',
          activeTasks: runningTasks.length,
          pendingTasks: pendingTasks.length,
          capacityUtilization: runningTasks.length / 
            (this.config.maxConcurrentTasks || 10) // Default to 10 if not specified
        };
      }
      
      // Planning diagnostics
      let planningDiagnostics = {
        status: 'error' as 'error' | 'operational' | 'degraded',
        successRate: 0,
        avgPlanTime: 0
      };
      
      if (planningManager) {
        planningDiagnostics = {
          status: 'operational' as 'operational' | 'degraded' | 'error',
          successRate: 0.8, // Not actually tracked, placeholder value
          avgPlanTime: 5000 // Not actually tracked, placeholder value
        };
      }
      
      // Resource diagnostics
      let resourceUtilization = {
        cpuUtilization: 0,
        memoryUtilization: 0,
        apiCallsPerMinute: 0
      };
      
      if (schedulerManager) {
        const utilization = await schedulerManager.getResourceUtilization();
        resourceUtilization = {
          cpuUtilization: utilization.cpuUtilization,
          memoryUtilization: utilization.memoryBytes / (1024 * 1024 * 1024), // Convert to GB
          apiCallsPerMinute: utilization.apiCallsPerMinute
        };
      }
      
      // Generate overall diagnostics
      const diagnostics: AutonomyDiagnostics = {
        status: this.status,
        memory: memoryDiagnostics,
        scheduler: schedulerDiagnostics,
        planning: planningDiagnostics,
        resources: resourceUtilization,
        capabilities: this.getCapabilities()
      };
      
      // Cache diagnostics
      this.lastDiagnostics = diagnostics;
      
      return diagnostics;
    } catch (error) {
      console.error('[AutonomySystem] Error running diagnostics:', error);
      
      // Return last diagnostics if available, or error state
      return this.lastDiagnostics || {
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
        errors: [`Error running diagnostics: ${error}`]
      };
    }
  }
  
  /**
   * Get memory statistics
   */
  private async getMemoryStats(): Promise<{
    totalMemories: number;
    typeDistribution: Record<string, number>;
  }> {
    try {
      const memoryManager = this.agent.getManager('memory') as MemoryManager;
      if (!memoryManager) {
        return {
          totalMemories: 0,
          typeDistribution: {}
        };
      }
      
      // This would need to be implemented in the memory manager
      // For now, return placeholder values
      return {
        totalMemories: 1000, // Placeholder value
        typeDistribution: {
          'MESSAGE': 500,
          'THOUGHT': 200,
          'REFLECTION': 100,
          'SYSTEM_EVENT': 50,
          'TASK': 150
        }
      };
    } catch (error) {
      console.error('[AutonomySystem] Error getting memory stats:', error);
      return {
        totalMemories: 0,
        typeDistribution: {}
      };
    }
  }
  
  /**
   * Plan and execute a goal autonomously
   */
  async planAndExecute(options: AutonomousExecutionOptions): Promise<AutonomousExecutionResult> {
    try {
      // Check if autonomy mode is enabled
      if (!this.autonomyMode && !options.autonomyMode) {
        return {
          success: false,
          message: 'Autonomy mode is disabled. Enable autonomy mode or set autonomyMode option to true.',
          error: 'AUTONOMY_DISABLED'
        };
      }
      
      // Get the planning manager
      const planningManager = this.agent.getManager('planning') as PlanningManager;
      if (!planningManager) {
        return {
          success: false,
          message: 'Planning manager not available',
          error: 'PLANNING_MANAGER_NOT_AVAILABLE'
        };
      }
      
      const startTime = Date.now();
      
      // Execute the plan
      const result = await planningManager.planAndExecute(options.goalPrompt, options);
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // Create result with additional metadata
      const enhancedResult: AutonomousExecutionResult = {
        ...result,
        analytics: {
          totalTimeMs: executionTime,
          stepsExecuted: result.plan?.steps.filter((s: any) => s.status === 'completed').length || 0,
          resourceUsage: {
            cpuTime: 0, // Not tracked
            memoryBytes: 0, // Not tracked
            apiCalls: 0, // Not tracked
            tokenCount: 0 // Not tracked
          }
        }
      };
      
      return enhancedResult;
    } catch (error) {
      console.error('[AutonomySystem] Error in plan and execute:', error);
      return {
        success: false,
        message: `Error in autonomous execution: ${error}`,
        error: 'EXECUTION_ERROR'
      };
    }
  }
  
  /**
   * Run daily autonomous tasks
   */
  async runDailyTasks(): Promise<boolean> {
    try {
      // Find daily tasks
      const dailyTasks = Array.from(this.scheduledTasks.values())
        .filter(task => task.metadata?.tags && 
                (task.metadata.tags as string[]).includes('daily'));
      
      // Execute each task
      const results = await Promise.all(
        dailyTasks.map(task => this.runTask(task.id))
      );
      
      // Check if all tasks succeeded
      return results.every(Boolean);
    } catch (error) {
      console.error('[AutonomySystem] Error running daily tasks:', error);
      return false;
    }
  }
  
  /**
   * Run weekly reflection
   */
  async runWeeklyReflection(): Promise<boolean> {
    try {
      // Find weekly reflection task
      const weeklyReflectionTask = Array.from(this.scheduledTasks.values())
        .find(task => task.id === 'weekly-reflection');
      
      if (weeklyReflectionTask) {
        return await this.runTask(weeklyReflectionTask.id);
      } else {
        console.warn('[AutonomySystem] Weekly reflection task not found');
        return false;
      }
    } catch (error) {
      console.error('[AutonomySystem] Error running weekly reflection:', error);
      return false;
    }
  }
  
  /**
   * Get task statistics
   */
  async getTaskStatistics(): Promise<TaskStatistics> {
    try {
      // Get all tasks
      const tasks = Array.from(this.scheduledTasks.values());
      
      // Calculate statistics
      const totalTasks = tasks.length;
      const runningTasks = this.activeJobs.size;
      const pendingTasks = tasks.filter(t => t.enabled && !this.activeJobs.has(t.id)).length;
      
      let totalSuccesses = 0;
      let totalFailures = 0;
      let totalExecutions = 0;
      let totalExecutionTime = 0;
      
      // Get execution statistics from history
      for (const stats of Array.from(this.taskHistory.values())) {
        totalSuccesses += stats.successes;
        totalFailures += stats.failures;
        totalExecutions += stats.runs;
        totalExecutionTime += stats.totalTimeMs;
      }
      
      // Calculate task categories
      const tasksByCategory: Record<string, number> = {};
      for (const task of tasks) {
        const category = task.metadata?.category as string || 'uncategorized';
        tasksByCategory[category] = (tasksByCategory[category] || 0) + 1;
      }
      
      // Calculate statistics
      const successRate = totalExecutions > 0 ? totalSuccesses / totalExecutions : 0;
      const averageCompletionTimeMs = totalExecutions > 0 ? totalExecutionTime / totalExecutions : 0;
      
      return {
        totalTasks,
        successfulTasks: totalSuccesses,
        failedTasks: totalFailures,
        runningTasks,
        pendingTasks,
        averageCompletionTimeMs,
        successRate,
        tasksByCategory,
        totalExecutions
      };
    } catch (error) {
      console.error('[AutonomySystem] Error getting task statistics:', error);
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
    return {
      fullAutonomy: true,
      taskGeneration: true,
      domainDecisionMaking: true,
      selfImprovement: this.config.selfImprovement?.enablePeriodicReflection || false,
      scheduleManagement: true,
      adaptability: true
    };
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
    try {
      // Generate a unique ID
      const taskId = uuidv4();
      
      // Create a standard ScheduledTask with required fields
      const task: ScheduledTask = {
        id: taskId,
        name: `Task: ${goal.length > 30 ? goal.substring(0, 30) + '...' : goal}`,
        description: goal,
        schedule: options?.schedule || '0 0 * * *', // Default to midnight every day
        priority: options?.priority || 0.5, // Default priority
        status: 'scheduled', // Always provide a status
        type: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
        executionCount: 0,
        failureCount: 0,
        parameters: {},
        metadata: {
          category: options?.category || this.config.defaultCategory || 'generated',
          tags: options?.tags || ['generated', 'autonomous']
        }
      };
      
      // Schedule the task
      const success = await this.scheduleTask(task);
      
      if (success) {
        return task;
      } else {
        return null;
      }
    } catch (error) {
      console.error('[AutonomySystem] Error generating task:', error);
      return null;
    }
  }
} 