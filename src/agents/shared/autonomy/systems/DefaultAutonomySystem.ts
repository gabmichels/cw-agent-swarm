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
import { PlanningManager, PlanStep as SharedPlanStep } from '../../base/managers/PlanningManager.interface';
import { ManagerType } from '../../base/managers/ManagerType';
import { SchedulerManager } from '../../../../lib/agents/base/managers/SchedulerManager';
import { 
  AutonomySystem, AutonomySystemConfig, AutonomyStatus, AutonomyCapabilities, 
  AutonomyDiagnostics, TaskStatistics, AutonomousExecutionOptions, AutonomousExecutionResult
} from '../interfaces/AutonomySystem.interface';
import { PlanAndExecuteOptions, PlanAndExecuteResult, ScheduledTask } from '../../../../lib/shared/types/agentTypes';
import { DefaultOpportunityIdentifier } from './DefaultOpportunityIdentifier';
import { OpportunityIdentifier, OpportunityType, OpportunityPriority } from '../interfaces/OpportunityIdentification.interface';
import { IdentifiedOpportunity } from '../interfaces/OpportunityIdentification.interface';

// Import the new opportunity management system
import { 
  createOpportunitySystem, 
  OpportunityManager,
  OpportunitySystemConfig,
  OpportunityStorageType,
  Opportunity,
  OpportunityStatus,
  OpportunitySource
} from '../../../../lib/opportunity';

// Import the TaskScheduleType enum
import { TaskScheduleType } from '../../../../lib/scheduler/models/Task.model';

import { createLogger } from '@/lib/logging/winston-logger';

/**
 * Internal extension of ScheduledTask with additional properties for the autonomy system
 * This interface properly extends ScheduledTask, ensuring all required properties exist
 */
interface InternalScheduledTask extends ScheduledTask {
  // Additional properties for internal use
  enabled: boolean;
  lastRun?: Date;
  metadata?: Record<string, unknown>;
  tags?: string[];
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
  private opportunityIdentifier: OpportunityIdentifier;
  // Add the opportunity manager from our new system
  private opportunityManager: OpportunityManager | null = null;
  private logger: ReturnType<typeof createLogger>;
  
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
    // Still create a DefaultOpportunityIdentifier for backward compatibility
    this.opportunityIdentifier = new DefaultOpportunityIdentifier(agent);
    
    // Initialize logger
    this.logger = createLogger({
      moduleId: `autonomy-system-${agent.getAgentId()}`,
      agentId: agent.getAgentId()
    });
    
    this.logger.system("DefaultAutonomySystem initialized", {
      agentId: agent.getAgentId(),
      config: config,
      enableAutonomyOnStartup: config.enableAutonomyOnStartup
    });
  }
  
  /**
   * Initialize the autonomy system
   */
  async initialize(): Promise<boolean> {
    this.logger.info("Initializing autonomy system");
    
    try {
      // Initialize opportunity identifier
      const opportunityInitialized = await this.opportunityIdentifier.initialize();
      if (!opportunityInitialized) {
        this.logger.error('[AutonomySystem] Failed to initialize opportunity identifier');
        return false;
      }

      // Initialize our new opportunity management system
      try {
        const config: OpportunitySystemConfig = {
          storage: {
            type: OpportunityStorageType.MEMORY // Use in-memory storage for simplicity in autonomy system
          },
          autoEvaluate: true
        };
        
        this.opportunityManager = createOpportunitySystem(config);
        await this.opportunityManager.initialize();
        console.log('[AutonomySystem] Successfully initialized opportunity management system');
      } catch (error) {
        console.error('[AutonomySystem] Failed to initialize opportunity management system:', error);
        // We'll continue even if the new system fails, as we still have the legacy identifier
      }

      // Check if managers we depend on are available
      const memoryManagerAvailable = !!this.agent.getManager(ManagerType.MEMORY);
      const planningManagerAvailable = !!this.agent.getManager(ManagerType.PLANNING);
      const schedulerManagerAvailable = !!this.agent.getManager(ManagerType.SCHEDULER);
      
      // Set up default schedules
      await this.setupDefaultTasks();
      
      // Set up periodic opportunity detection if enabled
      if (this.config.enableOpportunityDetection) {
        this.setupOpportunityDetection();
      }
      
      // Update status based on manager availability
      if (memoryManagerAvailable && planningManagerAvailable && schedulerManagerAvailable) {
        this.status = AutonomyStatus.STANDBY;
        
        // If autonomous mode should be enabled at startup
        if (this.config.enableAutonomyOnStartup) {
          await this.setAutonomyMode(true);
        }
        
        this.logger.success("Autonomy system initialized successfully", {
          status: this.status,
          opportunityDetectionEnabled: !!this.config.enableOpportunityDetection
        });
        
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
        enabled: true,
        goalPrompt: 'Review my recent activities and generate insights. What patterns do you notice? What could be improved?',
        tags: ['system', 'automated', 'reflection', 'daily']
      });
      
      // Weekly reflection task at 3:00 AM on Sundays
      const weeklySchedule = this.config.selfImprovement.weeklyReflectionSchedule || '0 3 * * 0';
      
      await this.scheduleTask({
        id: 'weekly-reflection',
        name: 'Weekly Reflection',
        description: 'Perform a deep reflection on the week\'s activities',
        schedule: weeklySchedule,
        enabled: true,
        goalPrompt: 'Perform a deep reflection on this week\'s activities. What were the major accomplishments? What challenges were faced? What could be improved next week?',
        tags: ['system', 'automated', 'reflection', 'weekly']
      });
      
      // Maintenance tasks
      await this.scheduleTask({
        id: 'memory-maintenance',
        name: 'Memory Maintenance',
        description: 'Consolidate and optimize memory storage',
        schedule: '0 4 * * 0', // 4:00 AM on Sundays
        enabled: true,
        goalPrompt: 'Consolidate and optimize memory storage',
        tags: ['system', 'automated', 'maintenance', 'memory']
      });
    }
  }
  
  /**
   * Set up periodic opportunity detection
   */
  private setupOpportunityDetection(): void {
    // Run opportunity detection every 5 minutes
    const job = new CronJob(
      '*/5 * * * *',
      async () => {
        if (!this.autonomyMode) {
          return;
        }

        try {
          // Get recent memories to analyze
          const memoryManager = this.agent.getManager<MemoryManager>(ManagerType.MEMORY);
          if (!memoryManager) {
            return;
          }

          const recentMemories = await memoryManager.getRecentMemories(10);
          
          // Flag to track if we've used the new system successfully
          let usedNewSystem = false;
          
          // Try to use the new opportunity system if available
          if (this.opportunityManager) {
            try {
              for (const memory of recentMemories) {
                // Detect opportunities using the new system
                const result = await this.opportunityManager.detectOpportunities(
                  memory.content,
                  {
                    source: OpportunitySource.MEMORY_PATTERN,
                    agentId: this.agent.getAgentId(),
                    context: { memoryId: memory.id }
                  }
                );
                
                // Process high priority opportunities immediately
                if (result.opportunities && result.opportunities.length > 0) {
                  // Process high priority opportunities
                  const highPriorityOpps = result.opportunities.filter(
                    opp => opp.priority === 'high'
                  );
                  
                  for (const opportunity of highPriorityOpps) {
                    await this.processNewOpportunity(opportunity);
                  }
                }
              }
              
              // Mark that we successfully used the new system
              usedNewSystem = true;
            } catch (error) {
              console.error('[AutonomySystem] Error using new opportunity system:', error);
              // If the new system fails, we'll fall back to the legacy system below
            }
          }
          
          // Fall back to the legacy system if the new one failed or isn't available
          if (!usedNewSystem) {
            for (const memory of recentMemories) {
              // Detect triggers in memory content using legacy system
              const triggers = await this.opportunityIdentifier.detectTriggers(
                memory.content,
                {
                  source: 'memory',
                  context: { memoryId: memory.id }
                }
              );

              if (triggers.length > 0) {
                // Identify opportunities from triggers using legacy system
                const result = await this.opportunityIdentifier.identifyOpportunities(triggers);
                
                // Process high priority opportunities immediately
                for (const opportunity of result.opportunities) {
                  if (opportunity.priority === OpportunityPriority.HIGH) {
                    await this.processOpportunity(opportunity);
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('[AutonomySystem] Error in opportunity detection:', error);
        }
      },
      null,
      true, // Start the job right away
      'America/New_York' // Timezone (can be configured)
    );
    
    // Store the job so we can stop it later if needed
    this.activeJobs.set('opportunity-detection', job);
  }
  
  /**
   * Process an opportunity using the new system
   */
  private async processNewOpportunity(opportunity: Opportunity): Promise<void> {
    try {
      console.log(`[AutonomySystem] Processing high priority opportunity: ${opportunity.id}`);
      
      // First try to use our opportunity manager's built-in processor
      if (this.opportunityManager) {
        try {
          // Process the opportunity into tasks
          const result = await this.opportunityManager.processOpportunity(opportunity.id);
          
          // Schedule the tasks that were created
          if (result.taskIds && result.taskIds.length > 0) {
            console.log(`[AutonomySystem] Created ${result.taskIds.length} tasks from opportunity`);
            
            // Update the opportunity status to in progress
            await this.opportunityManager.updateOpportunityStatus(
              opportunity.id, 
              OpportunityStatus.IN_PROGRESS
            );
            
            return; // Successfully processed with the new system
          }
        } catch (error) {
          console.error(`[AutonomySystem] Error processing opportunity with new system: ${error}`);
          // Fall through to manual processing below
        }
      }
      
      // Manual processing if the built-in processor fails or isn't available
      const title = opportunity.title || 'Untitled Opportunity';
      const description = opportunity.description || '';
      
      // Create a goal prompt from the opportunity
      const goalPrompt = this.createGoalPromptForNewOpportunity(opportunity);
      
      // Get scheduler manager if available
      const schedulerManager = this.agent.getManager<SchedulerManager>(ManagerType.SCHEDULER);
      if (!schedulerManager) {
        console.error('[AutonomySystem] Cannot process opportunity - Scheduler manager not available');
        return;
      }
      
      // Create a task from the opportunity
      const taskOptions = {
        name: `Opportunity: ${title}`,
        description,
        priority: opportunity.priority === 'high' ? 8 : (opportunity.priority === 'medium' ? 5 : 3),
        context: {
          opportunityId: opportunity.id,
          opportunityType: opportunity.type,
          goalPrompt
        },
        goalPrompt,
        scheduleType: TaskScheduleType.PRIORITY,
        schedule: {
          type: 'immediate'
        }
      };
      
      // Schedule the task
      const taskId = await schedulerManager.createTask(taskOptions);
      
      console.log(`[AutonomySystem] Created task ${taskId} for opportunity ${opportunity.id}`);
      
      // Update the opportunity status
      if (this.opportunityManager) {
        await this.opportunityManager.updateOpportunityStatus(
          opportunity.id,
          OpportunityStatus.IN_PROGRESS,
          { taskId }
        );
      }
    } catch (error) {
      console.error(`[AutonomySystem] Error processing opportunity: ${error}`);
    }
  }
  
  /**
   * Create a goal prompt from an opportunity
   */
  private createGoalPromptForNewOpportunity(opportunity: Opportunity): string {
    const title = opportunity.title || '';
    const description = opportunity.description || '';
    const type = opportunity.type || '';
    
    // Basic template
    let prompt = `Process this opportunity: ${title}.\n\n`;
    
    if (description) {
      prompt += `Details: ${description}\n\n`;
    }
    
    // Add type-specific guidance using string type values
    switch (typeof type === 'string' ? type : String(type)) {
      case 'task_optimization':
        prompt += 'Optimize this task to improve efficiency and results.';
        break;
      case 'error_recovery':
        prompt += 'Analyze this error and develop a recovery strategy.';
        break;
      case 'resource_optimization':
        prompt += 'Optimize resource usage for better efficiency.';
        break;
      case 'user_assistance':
        prompt += 'Provide assistance to the user with their request.';
        break;
      case 'scheduled_task':
        prompt += 'Execute this scheduled task according to requirements.';
        break;
      case 'knowledge_acquisition':
        prompt += 'Acquire and integrate this missing knowledge.';
        break;
      case 'performance_optimization':
        prompt += 'Identify and address performance bottlenecks.';
        break;
      case 'system_optimization':
        prompt += 'Optimize system configuration and settings.';
        break;
      default:
        prompt += 'Analyze and address this opportunity appropriately.';
    }
    
    return prompt;
  }
  
  /**
   * Process an opportunity from the legacy system
   */
  private async processOpportunity(opportunity: IdentifiedOpportunity): Promise<void> {
    try {
      console.log(`[AutonomySystem] Processing high priority opportunity: ${opportunity.id}`);
      
      // Create a goal prompt from the opportunity
      const goalPrompt = this.createGoalPromptForOpportunity(opportunity);
      
      // Get scheduler manager if available
      const schedulerManager = this.agent.getManager<SchedulerManager>(ManagerType.SCHEDULER);
      if (!schedulerManager) {
        console.error('[AutonomySystem] Cannot process opportunity - Scheduler manager not available');
        return;
      }
      
      // Create a task from the opportunity
      const taskOptions = {
        name: `Opportunity: ${opportunity.type}`,
        description: typeof opportunity.trigger.context.content === 'string' ? 
          opportunity.trigger.context.content : 'Opportunity detected',
        priority: opportunity.priority === OpportunityPriority.HIGH ? 8 : 
                (opportunity.priority === OpportunityPriority.MEDIUM ? 5 : 3),
        context: {
          opportunityId: opportunity.id,
          opportunityType: opportunity.type,
          trigger: opportunity.trigger,
          goalPrompt
        },
        goalPrompt,
        scheduleType: TaskScheduleType.PRIORITY,
        schedule: {
          type: 'immediate'
        }
      };
      
      // Schedule the task
      const taskId = await schedulerManager.createTask(taskOptions);
      
      console.log(`[AutonomySystem] Created task ${taskId} for opportunity ${opportunity.id}`);
      
      // Update the opportunity status
      await this.opportunityIdentifier.updateOpportunityStatus(
        opportunity.id,
        'in_progress',
        { taskId }
      );
    } catch (error) {
      console.error(`[AutonomySystem] Error processing opportunity: ${error}`);
    }
  }
  
  /**
   * Create a goal prompt for an opportunity from the legacy system
   */
  private createGoalPromptForOpportunity(opportunity: IdentifiedOpportunity): string {
    let prompt = `Process a ${opportunity.type} opportunity.\n\n`;
    
    if (opportunity.trigger && opportunity.trigger.context && opportunity.trigger.context.content) {
      prompt += `Context: ${opportunity.trigger.context.content}\n\n`;
    }
    
    // Add type-specific guidance
    switch (typeof opportunity.type === 'string' ? opportunity.type : String(opportunity.type)) {
      case 'task_optimization':
        prompt += 'Optimize this task to improve efficiency and results.';
        break;
      case 'error_recovery':
        prompt += 'Analyze this error and develop a recovery strategy.';
        break;
      case 'resource_optimization':
        prompt += 'Optimize resource usage for better efficiency.';
        break;
      case 'user_assistance':
        prompt += 'Provide assistance to the user with their request.';
        break;
      case 'scheduled_task':
        prompt += 'Execute this scheduled task according to requirements.';
        break;
      case 'knowledge_acquisition':
        prompt += 'Acquire and integrate this missing knowledge.';
        break;
      case 'performance_optimization':
        prompt += 'Identify and address performance bottlenecks.';
        break;
      case 'system_optimization':
        prompt += 'Optimize system configuration and settings.';
        break;
      default:
        prompt += 'Analyze and address this opportunity appropriately.';
    }
    
    return prompt;
  }
  
  /**
   * Shutdown the autonomy system
   */
  async shutdown(): Promise<void> {
    this.logger.info("Shutting down autonomy system");
    
    try {
      // Disable autonomy mode
      if (this.autonomyMode) {
        this.logger.debug("Disabling autonomy mode before shutdown");
        await this.setAutonomyMode(false);
      }
      
      // Stop all active jobs
      for (const [taskId, job] of Array.from(this.activeJobs.entries())) {
        this.logger.debug("Stopping scheduled job", { taskId });
        job.stop();
      }
      this.activeJobs.clear();
      
      // Shutdown opportunity manager if available
      if (this.opportunityManager) {
        this.logger.debug("Shutting down opportunity manager");
        // Note: OpportunityManager doesn't have a shutdown method
        // Just clear the reference
        this.opportunityManager = null;
      }
      
      this.status = AutonomyStatus.INACTIVE;
      
      this.logger.success("Autonomy system shutdown completed");
    } catch (error) {
      this.logger.error("Error during autonomy system shutdown", {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  /**
   * Get the current status of the autonomy system
   */
  getStatus(): AutonomyStatus {
    this.logger.debug("Status requested", { status: this.status });
    return this.status;
  }
  
  /**
   * Set the autonomy mode (enable/disable autonomous operation)
   */
  async setAutonomyMode(enabled: boolean): Promise<boolean> {
    this.logger.info("Setting autonomy mode", {
      enabled,
      currentMode: this.autonomyMode,
      currentStatus: this.status
    });
    
    try {
      this.autonomyMode = enabled;
      
      if (enabled) {
        // Start all enabled scheduled tasks
        let startedTaskCount = 0;
        for (const [id, task] of Array.from(this.scheduledTasks.entries())) {
          if (task.enabled) {
            this.logger.debug("Starting scheduled task", {
              taskId: id,
              taskName: task.name,
              schedule: task.schedule
            });
            this.startTask(id);
            startedTaskCount++;
          }
        }
        
        this.status = AutonomyStatus.ACTIVE;
        
        // Log to memory if available
        const memoryManager = this.agent.getManager(ManagerType.MEMORY) as MemoryManager;
        if (memoryManager) {
          await memoryManager.addMemory(
            'Autonomy mode enabled', 
            { 
              type: 'SYSTEM_EVENT',
              eventType: 'autonomy_enabled',
              timestamp: new Date().toISOString(),
              startedTasks: startedTaskCount
            }
          );
        }
        
        this.logger.success("Autonomy mode enabled", {
          agentId: this.agent.getAgentId(),
          startedTasks: startedTaskCount,
          totalScheduledTasks: this.scheduledTasks.size
        });
      } else {
        // Stop all scheduled tasks
        let stoppedTaskCount = 0;
        for (const [id, job] of Array.from(this.activeJobs.entries())) {
          this.logger.debug("Stopping scheduled job", { taskId: id });
          job.stop();
          stoppedTaskCount++;
        }
        
        this.activeJobs.clear();
        this.status = AutonomyStatus.STANDBY;
        
        // Log to memory if available
        const memoryManager = this.agent.getManager(ManagerType.MEMORY) as MemoryManager;
        if (memoryManager) {
          await memoryManager.addMemory(
            'Autonomy mode disabled', 
            { 
              type: 'SYSTEM_EVENT',
              eventType: 'autonomy_disabled',
              timestamp: new Date().toISOString(),
              stoppedTasks: stoppedTaskCount
            }
          );
        }
        
        this.logger.success("Autonomy mode disabled", {
          agentId: this.agent.getAgentId(),
          stoppedTasks: stoppedTaskCount
        });
      }
      
      return true;
    } catch (error) {
      this.logger.error("Error setting autonomy mode", {
        enabled,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return false;
    }
  }
  
  /**
   * Get the current autonomy mode
   */
  getAutonomyMode(): boolean {
    this.logger.debug("Autonomy mode requested", { mode: this.autonomyMode });
    return this.autonomyMode;
  }
  
  /**
   * Get all scheduled tasks
   */
  getScheduledTasks(): ScheduledTask[] {
    this.logger.debug("Retrieving scheduled tasks", {
      taskCount: this.scheduledTasks.size
    });
    
    const tasks = Array.from(this.scheduledTasks.values());
    
    this.logger.debug("Scheduled tasks retrieved", {
      taskCount: tasks.length,
      taskIds: tasks.map(t => t.id).slice(0, 10) // Log first 10 task IDs
    });
    
    return tasks;
  }
  
  /**
   * Schedule a new task
   */
  async scheduleTask(task: ScheduledTask): Promise<boolean> {
    this.logger.info("Scheduling new task", {
      taskId: task.id,
      taskName: task.name,
      schedule: task.schedule,
      goalPrompt: task.goalPrompt?.substring(0, 100),
      enabled: task.enabled
    });
    
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
        this.logger.debug("Starting task immediately (autonomy mode active)", {
          taskId: task.id
        });
        this.startTask(task.id);
      } else {
        this.logger.debug("Task scheduled but not started", {
          taskId: task.id,
          autonomyMode: this.autonomyMode,
          taskEnabled: internalTask.enabled
        });
      }
      
      this.logger.success("Task scheduled successfully", {
        taskId: task.id,
        taskName: task.name,
        totalScheduledTasks: this.scheduledTasks.size
      });
      
      return true;
    } catch (error) {
      this.logger.error("Error scheduling task", {
        taskId: task.id,
        taskName: task.name,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return false;
    }
  }
  
  /**
   * Start a scheduled task
   */
  private startTask(taskId: string): void {
    this.logger.debug("Starting scheduled task", { taskId });
    
    const task = this.scheduledTasks.get(taskId);
    if (!task) {
      this.logger.error("Cannot start task - not found", { taskId });
      return;
    }

    try {
      // Stop existing job if running
      const existingJob = this.activeJobs.get(taskId);
      if (existingJob) {
        this.logger.debug("Stopping existing job before restart", { taskId });
        existingJob.stop();
      }

      // Create and start the cron job
      const job = new CronJob(
        task.schedule,
        () => {
          this.logger.debug("Cron job triggered", {
            taskId,
            taskName: task.name,
            schedule: task.schedule
          });
          this.executeTask(taskId);
        },
        null,
        true, // Start immediately
        'UTC'
      );

      this.activeJobs.set(taskId, job);
      
      this.logger.success("Scheduled task started", {
        taskId,
        taskName: task.name,
        schedule: task.schedule,
        activeJobs: this.activeJobs.size
      });
    } catch (error) {
      this.logger.error("Error starting scheduled task", {
        taskId,
        taskName: task.name,
        schedule: task.schedule,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  /**
   * Execute a scheduled task
   */
  private async executeTask(taskId: string): Promise<boolean> {
    const task = this.scheduledTasks.get(taskId);
    if (!task) {
      this.logger.error("Task not found for execution", { taskId });
      return false;
    }
    
    this.logger.info("Executing scheduled task", {
      taskId,
      taskName: task.name,
      goalPrompt: task.goalPrompt?.substring(0, 100)
    });
    
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
    this.scheduledTasks.set(taskId, task);
    
    this.logger.debug("Task execution started", {
      taskId,
      runCount: taskStats.runs,
      lastRun: task.lastRun
    });
    
    const startTime = Date.now();
    try {
      // Initialize task execution options
      const executionOptions: AutonomousExecutionOptions = {
        goalPrompt: task.goalPrompt || task.description,
        autonomyMode: true,
        tags: task.tags || [],
        requireApproval: false,
        recordReasoning: true
      };
      
      this.logger.debug("Planning and executing task", {
        taskId,
        goalPrompt: executionOptions.goalPrompt?.substring(0, 100),
        autonomyMode: executionOptions.autonomyMode
      });
      
      // Execute the task
      const result = await this.planAndExecuteTask(task, executionOptions);
      
      // Update task stats
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      taskStats.totalTimeMs += executionTime;
      
      if (result.success) {
        taskStats.successes++;
        this.taskHistory.set(taskId, taskStats);
        
        this.logger.success("Task execution completed successfully", {
          taskId,
          taskName: task.name,
          executionTimeMs: executionTime,
          totalRuns: taskStats.runs,
          successRate: (taskStats.successes / taskStats.runs * 100).toFixed(1) + '%'
        });
        return true;
      } else {
        taskStats.failures++;
        this.taskHistory.set(taskId, taskStats);
        
        this.logger.error("Task execution failed", {
          taskId,
          taskName: task.name,
          executionTimeMs: executionTime,
          error: result.message,
          totalRuns: taskStats.runs,
          failureRate: (taskStats.failures / taskStats.runs * 100).toFixed(1) + '%'
        });
        return false;
      }
    } catch (error) {
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      taskStats.failures++;
      taskStats.totalTimeMs += executionTime;
      this.taskHistory.set(taskId, taskStats);
      
      this.logger.error("Task execution threw exception", {
        taskId,
        taskName: task.name,
        executionTimeMs: executionTime,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        totalRuns: taskStats.runs
      });
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
    this.logger.debug("Planning and executing task", {
      taskId: task.id,
      taskName: task.name,
      goalPrompt: options.goalPrompt?.substring(0, 100)
    });
    
    try {
      // Get the planning manager
      const planningManager = this.agent.getManager(ManagerType.PLANNING) as PlanningManager;
      if (!planningManager) {
        this.logger.error("Planning manager not available for task execution", {
          taskId: task.id
        });
        return {
          success: false,
          message: 'Planning manager not available',
          error: 'PLANNING_MANAGER_NOT_AVAILABLE'
        };
      }
      
      this.logger.debug("Planning manager found, starting plan execution", {
        taskId: task.id,
        goalPrompt: options.goalPrompt?.substring(0, 50)
      });
      
      // Combine task parameters with options
      const executionOptions: PlanAndExecuteOptions = {
        ...options,
        goalPrompt: task.description
      };
      
      // Execute the plan - adding a cast to any since some Planning Managers might have this method
      // This is a temporary solution until PlanningManager interface is updated with this method
      const result = await (planningManager as any).planAndExecute(executionOptions.goalPrompt, executionOptions);
      
      this.logger.debug("Plan execution completed", {
        taskId: task.id,
        success: result.success,
        hasSteps: !!result.plan?.steps,
        stepCount: result.plan?.steps?.length || 0
      });
      
      // Add analytics data
      const analyticsResult: AutonomousExecutionResult = {
        ...result,
        analytics: {
          totalTimeMs: 0, // Will be calculated by caller
          stepsExecuted: result.plan?.steps.filter((s: SharedPlanStep) => s.status === 'completed').length || 0,
          resourceUsage: {
            cpuTime: 0, // Not tracked
            memoryBytes: 0, // Not tracked
            apiCalls: 0, // Not tracked
            tokenCount: 0 // Not tracked
          }
        }
      };
      
      this.logger.debug("Analytics added to execution result", {
        taskId: task.id,
        stepsExecuted: analyticsResult.analytics?.stepsExecuted || 0
      });
      
      return analyticsResult;
    } catch (error) {
      this.logger.error("Error during task plan and execute", {
        taskId: task.id,
        taskName: task.name,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
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
    this.logger.info("Running task immediately", { taskId });
    
    const task = this.scheduledTasks.get(taskId);
    if (!task) {
      this.logger.error("Task not found for immediate execution", { taskId });
      return false;
    }
    
    this.logger.debug("Task found for immediate execution", {
      taskId,
      taskName: task.name,
      enabled: task.enabled
    });
    
    // Execute the task regardless of schedule
    return await this.executeTask(taskId);
  }
  
  /**
   * Cancel a scheduled task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    this.logger.info("Cancelling task", { taskId });
    
    try {
      // Stop the job if it's running
      const job = this.activeJobs.get(taskId);
      if (job) {
        this.logger.debug("Stopping active job", { taskId });
        job.stop();
        this.activeJobs.delete(taskId);
      }
      
      // Remove from scheduled tasks
      const taskRemoved = this.scheduledTasks.delete(taskId);
      
      if (taskRemoved) {
        this.logger.success("Task cancelled and removed", {
          taskId,
          remainingTasks: this.scheduledTasks.size
        });
      } else {
        this.logger.warn("Task not found for cancellation", { taskId });
      }
      
      return taskRemoved;
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
    
    try {
      const task = this.scheduledTasks.get(taskId);
      if (!task) {
        this.logger.error("Task not found for enable/disable", { taskId });
        return false;
      }
      
      // Update the task's enabled status
      task.enabled = enabled;
      this.scheduledTasks.set(taskId, task);
      
      if (this.autonomyMode) {
        if (enabled) {
          // Start the task if autonomy mode is active
          this.logger.debug("Starting task (now enabled)", { taskId });
          this.startTask(taskId);
        } else {
          // Stop the task if it's running
          const job = this.activeJobs.get(taskId);
          if (job) {
            this.logger.debug("Stopping task (now disabled)", { taskId });
            job.stop();
            this.activeJobs.delete(taskId);
          }
        }
      }
      
      this.logger.success("Task enabled status updated", {
        taskId,
        enabled,
        taskName: task.name
      });
      
      return true;
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
    try {
      // Get manager references
      const memoryManager = this.agent.getManager(ManagerType.MEMORY) as MemoryManager;
      const planningManager = this.agent.getManager(ManagerType.PLANNING) as PlanningManager;
      const schedulerManager = this.agent.getManager(ManagerType.SCHEDULER) as SchedulerManager;
      
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
        try {
          // This may not exist in all implementations
          const utilization = await (schedulerManager as any).getResourceUtilization();
          resourceUtilization = {
            cpuUtilization: utilization.cpuUtilization,
            memoryUtilization: utilization.memoryBytes / (1024 * 1024 * 1024), // Convert to GB
            apiCallsPerMinute: utilization.apiCallsPerMinute
          };
        } catch (error) {
          console.warn('[AutonomySystem] Resource utilization not available:', error);
        }
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
      const memoryManager = this.agent.getManager(ManagerType.MEMORY) as MemoryManager;
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
      const planningManager = this.agent.getManager(ManagerType.PLANNING) as PlanningManager;
      if (!planningManager) {
        return {
          success: false,
          message: 'Planning manager not available',
          error: 'PLANNING_MANAGER_NOT_AVAILABLE'
        };
      }
      
      const startTime = Date.now();
      
      // Execute the plan - adding a cast to any since some Planning Managers might have this method
      // This is a temporary solution until PlanningManager interface is updated with this method
      const result = await (planningManager as any).planAndExecute(options.goalPrompt, options);
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // Create result with additional metadata
      const enhancedResult: AutonomousExecutionResult = {
        ...result,
        analytics: {
          totalTimeMs: executionTime,
          stepsExecuted: result.plan?.steps.filter((s: SharedPlanStep) => s.status === 'completed').length || 0,
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
        .filter(task => task.tags && 
                task.tags.includes('daily'));
      
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
      
      // Calculate task categories based on tags
      const tasksByCategory: Record<string, number> = {};
      for (const task of tasks) {
        if (task.tags && task.tags.length > 0) {
          // Use the first tag as category for simplicity
          const category = task.tags[0];
          tasksByCategory[category] = (tasksByCategory[category] || 0) + 1;
        } else {
          tasksByCategory['uncategorized'] = (tasksByCategory['uncategorized'] || 0) + 1;
        }
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
        enabled: true,
        goalPrompt: goal,
        tags: options?.tags || ['generated', 'autonomous']
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