import { CronJob } from 'cron';
import { ChloeAgent } from './core/agent';
import { PlanAndExecuteOptions } from './planAndExecute';
import { logger } from '../../lib/logging';
import { runMemoryConsolidation } from './tasks/memoryConsolidation';
import { 
  runMarketScanTask, 
  runNewsScanTask, 
  runTrendingTopicResearchTask, 
  runSocialMediaTrendsTask 
} from './tasks/marketScanTask';
import { ScheduledTask as AgentScheduledTask } from '../../lib/shared/types/agentTypes';
import { TASK_IDS } from '../../lib/shared/constants';
import { calculateChloeCapacity, deferOverflowTasks } from './scheduler/capacityManager';
import { enableAutonomousMode as _enableAutonomousMode, runAutonomousMaintenance } from './scheduler/autonomousScheduler';
import { ChloeScheduler as AutonomousScheduler } from './scheduler/chloeScheduler';
import { ImportanceLevel, MemorySource } from '../../constants/memory';

// Types for scheduler
export type TaskId = string;

// Setup scheduler for the agent's recurring tasks
export function setupScheduler(agent: ChloeAgent) {
  // Tasks to run daily at 9:00 AM
  const dailyTasks = new CronJob(
    '0 9 * * *', // Run at 9:00 AM every day
    async () => {
      console.log('Running daily tasks...');
      
      // Calculate capacity before running daily tasks
      try {
        // Check if we have a scheduler property on the agent
        const scheduler = (agent as { scheduler?: { getAgent?: () => ChloeAgent } }).scheduler || null;
        
        // Check if it's a valid scheduler object that has the properties we need
        if (scheduler && typeof scheduler.getAgent === 'function') {
          console.log('Checking daily capacity...');
          
          // Try to use our capacity functions with the scheduler
          try {
            const capacity = await calculateChloeCapacity(
              scheduler as unknown as AutonomousScheduler,
              undefined,
              undefined
            );
            
            console.log(`Daily capacity: ${capacity.allocatedHours}/${capacity.totalHours} hours allocated`);
            
            // If overloaded, defer lower priority tasks
            if (capacity.overload) {
              console.log('Capacity overloaded, deferring lower priority tasks...');
              const deferResult = await deferOverflowTasks(
                scheduler as unknown as AutonomousScheduler,
                undefined,
                undefined
              );
              
              console.log(`Deferred ${deferResult.deferredTasks} tasks (${deferResult.deferredHours.toFixed(1)} hours)`);
              
              // Notify about deferrals
              if (deferResult.deferredTasks > 0 && agent && agent.notify) {
                agent.notify(`🔄 Deferred ${deferResult.deferredTasks} lower priority tasks due to capacity constraints.`);
              }
            }
          } catch (capacityError) {
            console.error('Error in capacity management:', capacityError);
          }
        }
      } catch (error) {
        console.error('Error checking capacity:', error);
        // Continue with daily tasks even if capacity check fails
      }
      
      // Run daily tasks
      if (agent && agent.runDailyTasks) {
        await agent.runDailyTasks();
      }
    },
    null, // onComplete
    false, // start
    'UTC' // timezone
  );
  
  // Weekly reflection on Sunday at 10:00 AM
  const weeklyReflection = new CronJob(
    '0 10 * * 0', // Run at 10:00 AM every Sunday
    async () => {
      console.log('Running weekly reflection...');
      await agent.reflect('What went well this week? What can be improved?');
      agent.notify('Weekly reflection completed.');
    },
    null,
    false,
    'UTC'
  );
  
  // Weekly maintenance on Sunday at 3:00 AM
  const weeklyMaintenance = new CronJob(
    '0 3 * * 0', // Run at 3:00 AM every Sunday
    async () => {
      console.log('Running weekly maintenance...');
      try {
        await runAutonomousMaintenance();
        if (agent && agent.notify) {
          agent.notify('Weekly maintenance completed.');
        }
      } catch (error) {
        console.error('Error in maintenance:', error);
        if (agent && agent.notify) {
          agent.notify('❌ Error in weekly maintenance.');
        }
      }
    },
    null,
    false,
    'UTC'
  );
  
  // Task scheduler controller
  return {
    start: () => {
      dailyTasks.start();
      weeklyReflection.start();
      weeklyMaintenance.start();
      console.log('Task scheduler started');
    },
    stop: () => {
      dailyTasks.stop();
      weeklyReflection.stop();
      weeklyMaintenance.stop();
      console.log('Task scheduler stopped');
    },
    status: () => {
      // Check if job is active safely
      const isJobActive = (job: CronJob) => {
        // Cron v4 uses isActive, earlier versions use running
        return typeof job.running === 'boolean' ? job.running : false;
      };
      
      return {
        dailyTasks: isJobActive(dailyTasks),
        weeklyReflection: isJobActive(weeklyReflection),
        weeklyMaintenance: isJobActive(weeklyMaintenance),
      };
    },
    // Add a task to run once at a specific time
    scheduleTask: (cronTime: string, taskFunc: () => Promise<void>, runOnce = false) => {
      const job = new CronJob(
        cronTime,
        async () => {
          await taskFunc();
          if (runOnce) {
            job.stop();
          }
        },
        null,
        true,
        'UTC'
      );
      return job;
    },
  };
}

interface ScheduledTask {
  id: string;
  cronExpression: string;
  goalPrompt: string;
  tags: string[];
  enabled: boolean;
  lastRun?: Date;
  task?: CronJob;
}

/**
 * Manages scheduled autonomous tasks for Chloe
 */
export class ChloeScheduler {
  private agent: ChloeAgent;
  private scheduledTasks: Map<string, ScheduledTask> = new Map();
  private autonomyMode: boolean = false;

  constructor(agent: ChloeAgent) {
    this.agent = agent;
    console.log('ChloeScheduler initialized');
  }

  /**
   * Enable or disable autonomy mode
   */
  public setAutonomyMode(enabled: boolean): void {
    this.autonomyMode = enabled;
    console.log(`Autonomy mode ${enabled ? 'enabled' : 'disabled'}`);
    
    // Start or stop all scheduled tasks
    // Use Array.from to iterate over Map entries safely
    Array.from(this.scheduledTasks.entries()).forEach(([id, task]) => {
      if (enabled) {
        this.startTask(id);
      } else {
        this.stopTask(id);
      }
    });
  }

  /**
   * Get current autonomy mode status
   */
  public getAutonomyMode(): boolean {
    return this.autonomyMode;
  }

  /**
   * Schedule a new recurring task
   */
  public scheduleTask(
    id: string,
    cronExpression: string,
    goalPrompt: string,
    tags: string[] = []
  ): boolean {
    if (this.scheduledTasks.has(id)) {
      console.warn(`Task with ID ${id} already exists`);
      return false;
    }

    try {
      // Validate cron expression by attempting to create a CronJob
      try {
        // This will throw if the cron expression is invalid
        new CronJob(cronExpression, () => {}, null, false, 'UTC');
      } catch (e) {
        console.error(`Invalid cron expression: ${cronExpression}`);
        return false;
      }

      const taskConfig: ScheduledTask = {
        id,
        cronExpression,
        goalPrompt,
        tags: [...tags, 'scheduled', 'autonomous'],
        enabled: true
      };
      
      this.scheduledTasks.set(id, taskConfig);
      
      // Start the task if autonomy mode is enabled
      if (this.autonomyMode) {
        this.startTask(id);
      }
      
      console.log(`Scheduled task ${id} with cron: ${cronExpression}`);
      return true;
    } catch (error) {
      console.error(`Failed to schedule task ${id}:`, error);
      return false;
    }
  }

  /**
   * Start a scheduled task
   */
  private startTask(id: string): boolean {
    try {
      const task = this.scheduledTasks.get(id);
      if (!task) {
        console.warn(`No task found with ID ${id}`);
        return false;
      }

      // Don't start if already running or disabled
      if (task.task || !task.enabled) {
        console.log(`Task ${id} is already running or disabled`);
        return true;
      }

      // Create a new CronJob
      const job = new CronJob(
        task.cronExpression,
        async () => {
          console.log(`Executing scheduled task: ${id}`);
          try {
            await this.executeTask(id);
          } catch (error) {
            console.error(`Error executing task ${id}:`, error);
          }
        },
        null, // onComplete
        true, // start immediately
        'UTC' // timezone
      );

      // Update task in map
      task.task = job;
      this.scheduledTasks.set(id, task);
      console.log(`Started task ${id}`);
      return true;
    } catch (error) {
      console.error(`Failed to start task ${id}:`, error);
      return false;
    }
  }

  /**
   * Stop a scheduled task
   */
  private stopTask(id: string): boolean {
    try {
      const task = this.scheduledTasks.get(id);
      if (!task || !task.task) {
        console.warn(`No running task found with ID ${id}`);
        return false;
      }

      // Stop the CronJob
      task.task.stop();
      task.task = undefined;
      this.scheduledTasks.set(id, task);
      console.log(`Stopped task ${id}`);
      return true;
    } catch (error) {
      console.error(`Failed to stop task ${id}:`, error);
      return false;
    }
  }

  /**
   * Execute a task by ID
   */
  private async executeTask(id: string): Promise<void> {
    const task = this.scheduledTasks.get(id);
    if (!task) {
      console.warn(`No task found with ID ${id}`);
      return;
    }

    if (!task.enabled) {
      console.log(`Task ${id} is disabled, skipping execution`);
      return;
    }

    // Record this execution
    task.lastRun = new Date();
    this.scheduledTasks.set(id, task);

    try {
      console.log(`Executing task ${id}: ${task.goalPrompt}`);
      
      // Get references to memories and taskLoggers
      const memory = this.agent.getMemory ? this.agent.getMemory() : null;
      const taskLogger = this.agent.getTaskLogger ? this.agent.getTaskLogger() : null;
      
      // Log task start if we have a task logger
      if (taskLogger) {
        taskLogger.logAction(`Starting scheduled task ${id}`, {
          id,
          goalPrompt: task.goalPrompt,
          timestamp: new Date().toISOString(),
          tags: task.tags
        });
      }
      
      // Execute the task based on goal using plan and execute if available
      if (this.agent.planAndExecute) {
        // Option parameters for the plan and execute
        const options: PlanAndExecuteOptions = {
          goalPrompt: task.goalPrompt,
          autonomyMode: true,
          tags: task.tags
        };
        
        // Run the task
        const result = await this.agent.planAndExecute(task.goalPrompt, options);
        
        // Log results
        if (taskLogger) {
          taskLogger.logAction(`Completed scheduled task ${id}`, {
            id,
            result,
            timestamp: new Date().toISOString()
          });
        }
        
        // Store in memory if we have a memory system
        if (memory && memory.addMemory) {
          const resultSummary = (result as { summary?: string }).summary || "Completed scheduled task";
          
          memory.addMemory(
            `Scheduled Task Result (${id}): ${resultSummary}`,
            "scheduled_task_result",
            ImportanceLevel.MEDIUM,
            MemorySource.SYSTEM,
            `Completed execution of scheduled task ${id}`,
            [...task.tags, "scheduled", "autonomous"]
          ).catch((e: Error | unknown) => console.error(`Failed to store task result in memory:`, e));
        }
        
        // Notify about completion
        if (this.agent.notify) {
          this.agent.notify(`✅ Scheduled task completed: ${task.goalPrompt}`);
        }
      } else {
        console.warn(`Agent doesn't support planAndExecute. Unable to run scheduled task ${id}.`);
      }
    } catch (error) {
      console.error(`Error executing task ${id}:`, error);
      
      // Log error if we have a task logger
      const taskLogger = this.agent.getTaskLogger ? this.agent.getTaskLogger() : null;
      if (taskLogger) {
        taskLogger.logAction(`Error in scheduled task ${id}`, {
          id,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
      }
      
      // Notify about failure
      if (this.agent.notify) {
        this.agent.notify(`❌ Error in scheduled task: ${task.goalPrompt}`);
      }
    }
  }

  /**
   * Get all scheduled tasks
   */
  public getScheduledTasks(): ScheduledTask[] {
    return Array.from(this.scheduledTasks.values());
  }
  
  /**
   * Get the agent
   */
  public getAgent(): ChloeAgent {
    return this.agent;
  }

  /**
   * Run a task immediately (once)
   */
  public async runTaskNow(id: string): Promise<boolean> {
    try {
      console.log(`Running task ${id} immediately`);
      await this.executeTask(id);
      return true;
    } catch (error) {
      console.error(`Failed to run task ${id}:`, error);
      return false;
    }
  }

  /**
   * Remove a scheduled task
   */
  public removeTask(id: string): boolean {
    try {
      const task = this.scheduledTasks.get(id);
      if (!task) {
        console.warn(`No task found with ID ${id}`);
        return false;
      }

      // Stop task if running
      if (task.task) {
        task.task.stop();
      }

      // Remove from map
      this.scheduledTasks.delete(id);
      console.log(`Removed task ${id}`);
      return true;
    } catch (error) {
      console.error(`Failed to remove task ${id}:`, error);
      return false;
    }
  }

  /**
   * Enable or disable a scheduled task
   */
  public setTaskEnabled(id: string, enabled: boolean): boolean {
    try {
      const task = this.scheduledTasks.get(id);
      if (!task) {
        console.warn(`No task found with ID ${id}`);
        return false;
      }

      // Update enabled status
      task.enabled = enabled;
      this.scheduledTasks.set(id, task);

      // Start or stop task based on new status
      if (enabled && this.autonomyMode) {
        this.startTask(id);
      } else if (!enabled) {
        this.stopTask(id);
      }

      console.log(`Set task ${id} enabled: ${enabled}`);
      return true;
    } catch (error) {
      console.error(`Failed to set task ${id} enabled status:`, error);
      return false;
    }
  }
}

export function setupDefaultSchedule(scheduler: ChloeScheduler): void {
  // Daily planning task
  scheduler.scheduleTask(
    TASK_IDS.DAILY_PLANNING,
    '0 9 * * *', // 9 AM every day
    "Review today's tasks and set priorities",
    ['daily', 'planning']
  );

  // Weekly reflection task
  scheduler.scheduleTask(
    'weekly-reflection', // Use string literal instead of TASK_IDS.WEEKLY_REFLECTION
    '0 10 * * 0', // 10 AM every Sunday
    "Reflect on the past week and identify insights",
    ['weekly', 'reflection']
  );

  // Memory consolidation
  scheduler.scheduleTask(
    TASK_IDS.MEMORY_CONSOLIDATION,
    '0 2 * * *', // 2 AM every day
    "Consolidate memories and reinforce important connections",
    ['memory', 'maintenance']
  );

  // Market scan (twice weekly)
  scheduler.scheduleTask(
    TASK_IDS.MARKET_SCAN,
    '0 11 * * 2,5', // 11 AM Tuesday and Friday
    "Scan the market for new trends and opportunities",
    ['market', 'research']
  );

  // News scan (daily)
  scheduler.scheduleTask(
    TASK_IDS.NEWS_SCAN,
    '0 8 * * *', // 8 AM every day
    "Review latest news and identify relevant items",
    ['news', 'research']
  );

  // Trending topics (weekly)
  scheduler.scheduleTask(
    'trending-topics', // Use string literal instead of TASK_IDS.TRENDING_TOPICS
    '0 14 * * 3', // 2 PM every Wednesday
    "Research trending topics in technology and AI",
    ['trending', 'research']
  );

  // Social media trends (weekly)
  scheduler.scheduleTask(
    TASK_IDS.SOCIAL_MEDIA_TRENDS,
    '0 15 * * 4', // 3 PM every Thursday
    "Analyze social media trends and engagement patterns",
    ['social', 'research']
  );

  console.log('Default schedule set up with 7 tasks');
}

/**
 * Helper function to convert day name to cron day number
 */
function convertDayToCronFormat(day: string): number {
  const dayMap: { [key: string]: number } = {
    'sunday': 0,
    'monday': 1, 
    'tuesday': 2, 
    'wednesday': 3, 
    'thursday': 4, 
    'friday': 5, 
    'saturday': 6
  };

  const normalizedDay = day.toLowerCase();
  return normalizedDay in dayMap ? dayMap[normalizedDay] : 0;
}

/**
 * Initializes Chloe's autonomy system, enabling self-management capabilities
 */
export function initializeAutonomy(agent: ChloeAgent): import('../../lib/shared/types/agentTypes').AutonomySystem {
  const scheduler = new ChloeScheduler(agent);
  const tasks = setupScheduler(agent);
  
  // Set up default schedule
  setupDefaultSchedule(scheduler);
  
  // Start the scheduler in autonomous mode
  scheduler.setAutonomyMode(true);
  tasks.start();
  
  console.log('Chloe autonomy system initialized');
  
  // Create a scheduler wrapper with needed properties
  try {
    // Use a wrapper class that adapts the ChloeScheduler from main file
    // to the expected interface in autonomousScheduler
    const schedulerWrapper = {
      isInitialized: () => true,
      initialize: async () => {},
      getAgent: () => agent,
      registerWeeklyTask: (id: string, day: string, time: string, callback: () => Promise<void>, tags: string[] = []) => {
        // Convert day/time to cron expression for weekly tasks
        const dayNumber = convertDayToCronFormat(day);
        const [hours, minutes] = time.split(':').map(Number);
        const cronExpression = `${minutes} ${hours} * * ${dayNumber}`;
        
        if (scheduler && scheduler.scheduleTask) {
          scheduler.scheduleTask(id, cronExpression, `Weekly task: ${id}`, tags);
        }
      },
      registerDailyTask: (id: string, time: string, callback: () => Promise<void>, tags: string[] = []) => {
        // Convert time to cron expression for daily tasks
        const [hours, minutes] = time.split(':').map(Number);
        const cronExpression = `${minutes} ${hours} * * *`;
        
        if (scheduler && scheduler.scheduleTask) {
          scheduler.scheduleTask(id, cronExpression, `Daily task: ${id}`, tags);
        }
      }
    };
    
    // Enable autonomous maintenance and self-triggered tasks
    _enableAutonomousMode(schedulerWrapper as unknown as AutonomousScheduler);
  } catch (error) {
    console.error('Failed to initialize autonomous mode:', error);
  }
  
  // Helper function to convert between scheduler task format and agent task format
  const mapToAgentTask = (task: ScheduledTask): AgentScheduledTask => {
    // Apply the mapping if the task object is available
    if (!task) {
      return {
        id: '',
        name: '',
        description: '',
        schedule: '',
        goalPrompt: '',
        enabled: false,
        tags: [],
        createdAt: new Date().toISOString(),
        status: 'error'
      } as any; // Use any to bypass type checking for the non-standard fields
    }
    
    return {
      id: task.id,
      name: task.id, // Use id for name as fallback
      description: task.goalPrompt,
      schedule: task.cronExpression,
      goalPrompt: task.goalPrompt,
      enabled: task.enabled,
      tags: task.tags || [],
      lastRun: task.lastRun ? task.lastRun.toISOString() : undefined,
      // Non-standard fields that are expected in the UI
      status: task.enabled ? 'active' : 'disabled',
      createdAt: task.lastRun ? task.lastRun.toISOString() : new Date().toISOString()
    } as any; // Use any to bypass type checking for the non-standard fields
  };
  
  // Return an object that implements AutonomySystem interface
  return {
    // Core properties
    status: 'active',
    scheduledTasks: scheduler.getScheduledTasks().map(mapToAgentTask),
    
    // Scheduler interface
    scheduler: {
      runTaskNow: async (taskId: string) => scheduler.runTaskNow(taskId),
      getScheduledTasks: () => scheduler.getScheduledTasks().map(mapToAgentTask),
      setTaskEnabled: (taskId: string, enabled: boolean) => scheduler.setTaskEnabled(taskId, enabled),
      setAutonomyMode: (enabled: boolean) => scheduler.setAutonomyMode(enabled),
      getAutonomyMode: () => scheduler.getAutonomyMode()
    },
    
    // Core methods
    initialize: async (): Promise<boolean> => {
      try {
        // We've already initialized in this function, so just return true
        return true;
      } catch (error) {
        console.error('Failed to initialize autonomy system:', error);
        return false;
      }
    },
    
    shutdown: async (): Promise<void> => {
      try {
        // Stop all tasks
        tasks.stop();
        scheduler.setAutonomyMode(false);
      } catch (error) {
        console.error('Error shutting down autonomy system:', error);
      }
    },
    
    // Task management
    runTask: async (taskName: string): Promise<boolean> => {
      try {
        switch (taskName) {
          case 'dailyTasks':
            if (typeof agent.runDailyTasks === 'function') {
              await agent.runDailyTasks();
            }
            break;
          case 'weeklyReflection':
            if (typeof agent.runWeeklyReflection === 'function') {
              await agent.runWeeklyReflection();
            }
            break;
          default:
            // Try to find a scheduled task with this name or id
            const tasks = scheduler.getScheduledTasks();
            const task = tasks.find(t => t.id === taskName || t.goalPrompt.includes(taskName));
            if (!task) {
              throw new Error(`Unknown task: ${taskName}`);
            }
            return await scheduler.runTaskNow(task.id);
        }
        return true;
      } catch (error) {
        console.error(`Error running task ${taskName}:`, error);
        return false;
      }
    },
    
    scheduleTask: async (task: AgentScheduledTask): Promise<boolean> => {
      return scheduler.scheduleTask(
        task.id,
        task.schedule, // Cron pattern
        task.goalPrompt || task.description,
        task.tags || []
      );
    },
    
    cancelTask: async (taskId: string): Promise<boolean> => {
      return scheduler.removeTask(taskId);
    },
    
    // Planning and execution
    planAndExecute: async (options: PlanAndExecuteOptions): Promise<import('../../lib/shared/types/agentTypes').PlanAndExecuteResult> => {
      try {
        if (typeof agent.planAndExecute === 'function') {
          return await agent.planAndExecute(options.goalPrompt, options);
        } else {
          return {
            success: false,
            message: "Agent does not implement planAndExecute method",
            error: "Method not available"
          };
        }
      } catch (error) {
        console.error('Error in planAndExecute:', error);
        return {
          success: false,
          message: `Error executing plan: ${error instanceof Error ? error.message : String(error)}`,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    },
    
    // Diagnostics
    diagnose: async (): Promise<{
      memory: { status: string; messageCount: number };
      scheduler: { status: string; activeTasks: number };
      planning: { status: string };
    }> => {
      try {
        // Get scheduler status
        const schedulerStatus = scheduler.getAutonomyMode() ? 'active' : 'inactive';
        const activeTasks = scheduler.getScheduledTasks().filter(t => t.enabled).length;
        
        // Get memory status - default placeholder values
        let memoryStatus = { status: 'unknown', messageCount: 0 };
        
        try {
          // Try to get memory status from the agent
          const memoryManager = agent.getMemoryManager ? agent.getMemoryManager() : null;
          if (memoryManager && typeof memoryManager.diagnose === 'function') {
            const memoryDiagnosis = await memoryManager.diagnose();
            memoryStatus = {
              status: memoryDiagnosis?.status || 'unknown',
              messageCount: memoryDiagnosis?.messageCount || 0
            };
          }
        } catch (memoryError) {
          console.error('Error getting memory status:', memoryError);
        }
        
        // Get planning status
        let planningStatus = 'unknown';
        try {
          const planningManager = agent.getPlanningManager ? agent.getPlanningManager() : null;
          if (planningManager && typeof planningManager.isInitialized === 'function') {
            planningStatus = planningManager.isInitialized() ? 'operational' : 'not initialized';
          }
        } catch (planningError) {
          console.error('Error getting planning status:', planningError);
        }
        
        return {
          memory: memoryStatus,
          scheduler: {
            status: schedulerStatus,
            activeTasks
          },
          planning: {
            status: planningStatus
          }
        };
      } catch (error) {
        console.error('Error in autonomy system diagnostics:', error);
        
        // Return fallback data
        return {
          memory: { status: 'error', messageCount: 0 },
          scheduler: { status: 'error', activeTasks: 0 },
          planning: { status: 'error' }
        };
      }
    }
  };
} 