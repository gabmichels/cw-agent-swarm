import { CronJob } from 'cron';
import { ChloeAgent, PlanAndExecuteResult as ChloeAgentPlanAndExecuteResult } from './core/agent';
import { 
  AutonomySystem, 
  PlanAndExecuteOptions,
  PlanAndExecuteResult,
  ScheduledTask as AgentScheduledTask 
} from '../../lib/shared/types/agentTypes';
import { v4 as uuidv4 } from 'uuid';
import { TASK_IDS } from '../../lib/shared/constants';
import { calculateChloeCapacity, deferOverflowTasks } from './scheduler/capacityManager';
import { enableAutonomousMode as _enableAutonomousMode, runAutonomousMaintenance } from './scheduler/autonomousScheduler';
import { ChloeScheduler as AutonomousScheduler } from './scheduler/chloeScheduler';
import { ImportanceLevel, MemorySource } from '../../constants/memory';
import { MemoryType } from '../../server/memory/config/types';

// Types for scheduler
export type TaskId = string;

// Define our own ScheduledTask interface to avoid conflicts
interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  schedule: string; // Cron pattern
  goalPrompt: string;
  lastRun?: Date;
  nextRun?: Date;
  enabled: boolean;
  tags: string[];
  interval?: number; // Interval in milliseconds for non-cron tasks
  intervalId?: NodeJS.Timeout; // For tracking interval-based tasks
  task?: CronJob; // For backward compatibility
  cronExpression?: string; // For backward compatibility
}

// Type for our extended agent - using type instead of interface
// to avoid compatibility issues with ChloeAgent
type ExtendedChloeAgent = ChloeAgent & {
  // Optional methods that might be implemented
  getPlanningManager?(): any;
  getMemoryManager?(): any;
  getReflectionManager?(): any;
  getKnowledgeGapsManager?(): any;
  getToolManager?(): any;
  
  // Task execution methods
  runDailyTasks?(): Promise<void>;
  runWeeklyReflection?(): Promise<string>;
  reflect?(prompt: string): Promise<string>;
  getMemory?(): any;
  scheduleTask?(task: ScheduledTask): Promise<boolean>;
};

// Setup scheduler for the agent's recurring tasks
export function setupScheduler(agent: any) {
  // Tasks to run daily at 9:00 AM
  const dailyTasks = new CronJob(
    '0 9 * * *', // Run at 9:00 AM every day
    async () => {
      console.log('Running daily tasks...');
      
      // Calculate capacity before running daily tasks
      try {
        // Check if we have a scheduler through the planning manager
        const planningManager = agent.getPlanningManager?.();
        const scheduler = planningManager?.getScheduler?.();
        
        // Check if it's a valid scheduler object
        if (scheduler) {
          console.log('Checking daily capacity...');
          
          // Try to use our capacity functions with the scheduler
          try {
            const capacity = await calculateChloeCapacity(
              scheduler,
              undefined,
              undefined
            );
            
            console.log(`Daily capacity: ${capacity.allocatedHours}/${capacity.totalHours} hours allocated`);
            
            // If overloaded, defer lower priority tasks
            if (capacity.overload) {
              console.log('Capacity overloaded, deferring lower priority tasks...');
              const deferResult = await deferOverflowTasks(
                scheduler,
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
      // Use optional chaining to safely call reflect and notify
      await (agent as any).reflect?.('What went well this week? What can be improved?');
      (agent as any).notify?.('Weekly reflection completed.');
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
        // Use hasOwnProperty to check if property exists, as running property 
        // might not be directly accessible in all CronJob versions
        return Object.prototype.hasOwnProperty.call(job, 'running') ? 
          (job as any).running : false;
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

/**
 * Manages scheduled autonomous tasks for Chloe
 */
export class ChloeScheduler {
  private agent: ExtendedChloeAgent;
  private scheduledTasks: Map<string, ScheduledTask> = new Map();
  private autonomyMode: boolean = false;

  constructor(agent: ChloeAgent) {
    this.agent = agent as ExtendedChloeAgent;
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
        name: id, // Use ID as name for backward compatibility
        description: goalPrompt, // Use prompt as description
        schedule: cronExpression, // Set schedule to cronExpression
        cronExpression, // Keep for backward compatibility
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

      // Use schedule as the primary source, fall back to cronExpression
      const cronPattern = task.schedule || task.cronExpression;
      if (!cronPattern) {
        console.error(`No schedule or cronExpression found for task ${id}`);
        return false;
      }

      // Create a new CronJob
      const job = new CronJob(
        cronPattern,
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
      
      // Get references to memories and taskLoggers using optional chaining
      const memory = this.agent.getMemory?.();
      const taskLogger = this.agent.getTaskLogger?.();
      
      // Log task start if we have a task logger
      if (taskLogger) {
        taskLogger.logAction(`Starting scheduled task ${id}`, {
          id,
          goalPrompt: task.goalPrompt,
          timestamp: new Date().toISOString(),
          tags: task.tags || []
        });
      }
      
      // Execute the task based on goal using plan and execute if available
      if (this.agent.planAndExecute) {
        // Option parameters for the plan and execute
        const options: PlanAndExecuteOptions = {
          goalPrompt: task.goalPrompt,
          autonomyMode: true,
          tags: task.tags || []
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
            MemoryType.SCHEDULED_TASK_RESULT,
            ImportanceLevel.MEDIUM,
            MemorySource.SYSTEM,
            `Completed execution of scheduled task ${id}`,
            [...(task.tags || []), "scheduled", "autonomous"]
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
      const taskLogger = this.agent.getTaskLogger?.();
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
  public getAgent(): ExtendedChloeAgent {
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
export function initializeAutonomy(agent: any): import('../../lib/shared/types/agentTypes').AutonomySystem {
  const scheduler = new ChloeScheduler(agent as any);
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
          const result = await agent.planAndExecute(options.goalPrompt, options);
          // Ensure result conforms to PlanAndExecuteResult interface
          return {
            success: result.success,
            message: result.message || 'Task completed',
            plan: result.plan,
            error: result.error
          };
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

// Type guard to handle potential undefined values
function isRunning(job: CronJob | undefined): boolean {
  if (!job) return false;
  
  // Use hasOwnProperty to safely check if the property exists
  if (Object.prototype.hasOwnProperty.call(job, 'running')) {
    return (job as any).running === true;
  }
  
  return false;
}

/**
 * AutonomySystem implementation for Chloe Agent
 */
export class SchedulerSystem implements AutonomySystem {
  private agent: ExtendedChloeAgent;
  private _scheduledTasks: Map<string, ScheduledTask> = new Map();
  private activeJobs: Map<string, CronJob> = new Map();
  private autonomyMode: boolean = false;
  public status: 'active' | 'inactive' = 'inactive';
  
  // Fix the getter to correctly match AutonomySystem interface
  get scheduledTasks(): AgentScheduledTask[] {
    // Convert internal ScheduledTask to AgentScheduledTask
    return Array.from(this._scheduledTasks.values()).map(task => {
      // Create a proper AgentScheduledTask object that matches the interface
      const agentTask: AgentScheduledTask = {
        id: task.id,
        name: task.name,
        description: task.description,
        schedule: task.schedule,
        goalPrompt: task.goalPrompt,
        // Keep as Date objects to match the interface
        lastRun: task.lastRun,
        nextRun: task.nextRun,
        enabled: task.enabled,
        tags: task.tags || []
      };
      return agentTask;
    });
  }
  
  constructor(agent: ChloeAgent) {
    this.agent = agent as ExtendedChloeAgent;
    this.status = 'inactive';
  }
  
  /**
   * Initialize the autonomy system
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('[SchedulerSystem] Initializing...');
      
      // Check if the planning manager is available as an optional feature
      const planningManager = this.agent.getPlanningManager?.();
      
      // Schedule default tasks
      await this.scheduleDefaultTasks();
      
      this.status = 'active';
      console.log('[SchedulerSystem] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[SchedulerSystem] Failed to initialize:', error);
      this.status = 'inactive';
      return false;
    }
  }
  
  /**
   * Schedule default system tasks
   */
  private async scheduleDefaultTasks(): Promise<void> {
    console.log('[SchedulerSystem] Setting up default tasks...');
    
    // Daily tasks runner - at 8 AM
    await this.scheduleTask({
      id: 'daily-tasks-runner',
      name: 'Daily Tasks Runner',
      description: 'Runs daily tasks automatically',
      schedule: '0 8 * * *',
      goalPrompt: 'Run daily agent tasks',
      enabled: true,
      tags: ['system', 'maintenance']
    });
    
    // Weekly reflection - Sunday at 10 AM
    await this.scheduleTask({
      id: 'weekly-reflection',
      name: 'Weekly Reflection',
      description: 'Perform weekly reflection on activities and insights',
      schedule: '0 10 * * 0',
      goalPrompt: 'What went well this week? What can be improved?',
      enabled: true,
      tags: ['system', 'reflection']
    });
  }
  
  /**
   * Run daily tasks
   */
  async runDailyTasks(): Promise<boolean> {
    console.log('[SchedulerSystem] Running daily tasks...');
    const agent = this.agent;
    
    if (agent && agent.runDailyTasks) {
      await agent.runDailyTasks();
      return true;
    }
    
    console.log('[SchedulerSystem] Agent does not support runDailyTasks');
    return false;
  }
  
  /**
   * Run weekly reflection
   */
  async runWeeklyReflection(): Promise<boolean> {
    console.log('[SchedulerSystem] Running weekly reflection...');
    
    try {
      await this.agent.reflect?.('What went well this week? What can be improved?');
      return true;
    } catch (error) {
      console.error('[SchedulerSystem] Failed to run weekly reflection:', error);
      return false;
    }
  }
  
  /**
   * Get the scheduler interface
   */
  get scheduler() {
    return {
      runTaskNow: async (taskId: string) => this.runTask(taskId),
      getScheduledTasks: () => Array.from(this._scheduledTasks.values()),
      setTaskEnabled: (taskId: string, enabled: boolean) => this.setTaskEnabled(taskId, enabled),
      setAutonomyMode: (enabled: boolean) => this.setAutonomyMode(enabled),
      getAutonomyMode: () => this.autonomyMode
    };
  }
  
  /**
   * Set autonomy mode
   */
  setAutonomyMode(enabled: boolean): void {
    this.autonomyMode = enabled;
    console.log(`[SchedulerSystem] Autonomy mode ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Get autonomy mode status
   */
  getAutonomyMode(): boolean {
    return this.autonomyMode;
  }
  
  /**
   * Check if a task is currently running
   */
  isTaskRunning(taskId: string): boolean {
    const job = this.activeJobs.get(taskId);
    return isRunning(job);
  }
  
  /**
   * Set a task's enabled status
   */
  setTaskEnabled(taskId: string, enabled: boolean): boolean {
    const task = this._scheduledTasks.get(taskId);
    if (!task) {
      console.error(`[SchedulerSystem] Task not found: ${taskId}`);
      return false;
    }
    
    task.enabled = enabled;
    
    // Stop the job if disabling
    if (!enabled && this.activeJobs.has(taskId)) {
      const job = this.activeJobs.get(taskId);
      job?.stop();
    } else if (enabled && !this.isTaskRunning(taskId)) {
      // Restart the job if enabling
      this.setupCronJob(task);
    }
    
    console.log(`[SchedulerSystem] Task '${task.name}' ${enabled ? 'enabled' : 'disabled'}`);
    return true;
  }
  
  /**
   * Set up a cron job for a scheduled task
   */
  private setupCronJob(task: ScheduledTask): void {
    // Stop existing job if any
    if (this.activeJobs.has(task.id)) {
      const existingJob = this.activeJobs.get(task.id);
      existingJob?.stop();
      this.activeJobs.delete(task.id);
    }
    
    if (!task.enabled) {
      return;
    }
    
    // Skip if no schedule pattern
    if (!task.schedule) {
      console.warn(`[SchedulerSystem] Task '${task.name}' has no schedule pattern`);
      return;
    }
    
    try {
      // Create new cron job
      const job = new CronJob(
        task.schedule,
        async () => {
          console.log(`[SchedulerSystem] Running scheduled task '${task.name}'`);
          await this.runTask(task.id);
        },
        null, // onComplete
        true, // start
        'America/New_York' // timezone
      );
      
      this.activeJobs.set(task.id, job);
      
      // Calculate next run time - safer access to nextDates
      try {
        // Approximate the next run time - avoid using nextDate() which doesn't exist
        task.nextRun = new Date();
        task.nextRun.setDate(task.nextRun.getDate() + 1); // Rough estimate for daily
        
        console.log(`[SchedulerSystem] Scheduled task '${task.name}' for ${task.nextRun.toLocaleString()}`);
      } catch (e) {
        console.error(`[SchedulerSystem] Failed to calculate next run time for task '${task.name}':`, e);
      }
    } catch (error) {
      console.error(`[SchedulerSystem] Failed to set up cron job for task '${task.name}':`, error);
    }
  }
  
  /**
   * Schedule a task
   */
  async scheduleTask(task: ScheduledTask): Promise<boolean> {
    // Generate ID if not provided
    if (!task.id) {
      task.id = uuidv4();
    }
    
    // Store the task
    this._scheduledTasks.set(task.id, task);
    
    // Set up cron job if enabled
    if (task.enabled) {
      this.setupCronJob(task);
    }
    
    console.log(`[SchedulerSystem] Task scheduled: ${task.name}`);
    return true;
  }
  
  /**
   * Run a scheduled task
   */
  async runTask(taskId: string): Promise<boolean> {
    const task = this._scheduledTasks.get(taskId);
    if (!task) {
      console.error(`[SchedulerSystem] Task not found: ${taskId}`);
      return false;
    }
    
    console.log(`[SchedulerSystem] Running task: ${task.name}`);
    task.lastRun = new Date();
    
    try {
      // Handle specific system tasks
      if (taskId === 'daily-tasks-runner') {
        return await this.runDailyTasks();
      } else if (taskId === 'weekly-reflection') {
        return await this.runWeeklyReflection();
      }
      
      // Execute task with goal prompt
      if (task.goalPrompt) {
        const result = await this.planAndExecute({
          goalPrompt: task.goalPrompt,
          tags: task.tags
        });
        
        return result.success;
      }
      
      console.log(`[SchedulerSystem] Task has no goal prompt: ${task.name}`);
      return true;
    } catch (error) {
      console.error(`[SchedulerSystem] Failed to run task '${task.name}':`, error);
      return false;
    }
  }
  
  /**
   * Cancel a scheduled task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    // Stop the cron job if active
    if (this.activeJobs.has(taskId)) {
      const job = this.activeJobs.get(taskId);
      job?.stop();
      this.activeJobs.delete(taskId);
    }
    
    // Remove the task
    const result = this._scheduledTasks.delete(taskId);
    return result;
  }
  
  /**
   * Shutdown the autonomy system
   */
  async shutdown(): Promise<void> {
    console.log('[SchedulerSystem] Shutting down...');
    
    // Stop all cron jobs - use Array.from to avoid iterator issues
    Array.from(this.activeJobs.entries()).forEach(([taskId, job]) => {
      console.log(`[SchedulerSystem] Stopping task: ${taskId}`);
      job.stop();
    });
    
    this.activeJobs.clear();
    this.status = 'inactive';
    
    console.log('[SchedulerSystem] Shutdown complete');
  }
  
  /**
   * Diagnose the system state
   */
  async diagnose(): Promise<{
    memory: { status: string; messageCount: number };
    scheduler: { status: string; activeTasks: number };
    planning: { status: string };
  }> {
    console.log('[SchedulerSystem] Running diagnostics...');
    
    // Check memory status
    const memory = this.agent.getMemory?.();
    const messageCount = memory ? await memory.getMessageCount() : 0;
    
    // Check scheduler status
    const activeTasks = Array.from(this.activeJobs.values()).filter(job => 
      isRunning(job)
    ).length;
    
    // Check planning system
    let planningStatus = 'unavailable';
    try {
      const planningManager = this.agent.getPlanningManager?.();
      planningStatus = planningManager ? 'operational' : 'unavailable';
    } catch (error) {
      planningStatus = 'error';
    }
    
    return {
      memory: {
        status: memory ? 'operational' : 'unavailable',
        messageCount
      },
      scheduler: {
        status: this.status,
        activeTasks
      },
      planning: {
        status: planningStatus
      }
    };
  }
  
  /**
   * Plan and execute a task
   */
  async planAndExecute(options: PlanAndExecuteOptions): Promise<PlanAndExecuteResult> {
    if (!this.agent) {
      return {
        success: false,
        message: 'Agent is not available',
        error: 'No agent instance'
      };
    }
    
    console.log(`[SchedulerSystem] Planning and executing: ${options.goalPrompt}`);
    
    // Call agent's planAndExecute if available
    try {
      const agent = this.agent;
      if (typeof agent.planAndExecute !== 'function') {
        return {
          success: false,
          message: 'Agent does not support planAndExecute',
          error: 'Method not implemented'
        };
      }
      
      // Execute the plan
      const result = await agent.planAndExecute(options.goalPrompt, options) as ChloeAgentPlanAndExecuteResult;
      
      // Return a properly formatted result
      return {
        success: result.success,
        message: result.message || 'Task executed',
        plan: result.plan,
        error: result.error
      };
    } catch (error) {
      console.error('[SchedulerSystem] Plan execution failed:', error);
      return {
        success: false,
        message: 'Plan execution failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Run daily autonomous tasks
   */
  async runDailyAutonomous(): Promise<boolean> {
    if (!this.autonomyMode) {
      console.log('[SchedulerSystem] Autonomy mode is disabled, skipping daily autonomous tasks');
      return false;
    }
    
    const agent = this.agent;
    try {
      console.log('[SchedulerSystem] Running daily autonomous tasks');
      
      // Run daily tasks if available
      if (agent.runDailyTasks) {
        await agent.runDailyTasks();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[SchedulerSystem] Failed to run daily autonomous tasks:', error);
      return false;
    }
  }
  
  /**
   * Run weekly autonomous tasks
   */
  async runWeeklyAutonomous(): Promise<boolean> {
    if (!this.autonomyMode) {
      console.log('[SchedulerSystem] Autonomy mode is disabled, skipping weekly autonomous tasks');
      return false;
    }
    
    const agent = this.agent;
    try {
      console.log('[SchedulerSystem] Running weekly autonomous tasks');
      
      // Run weekly reflection if available
      if (agent.runWeeklyReflection) {
        await agent.runWeeklyReflection();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[SchedulerSystem] Failed to run weekly autonomous tasks:', error);
      return false;
    }
  }
  
  /**
   * Get agent memory statistics
   */
  async getMemoryStats(): Promise<{
    totalMessages: number;
    totalReflections: number;
    totalTasks: number;
  }> {
    const memoryManager = this.agent.getMemoryManager ? this.agent.getMemoryManager() : null;
    
    if (!memoryManager) {
      return {
        totalMessages: 0,
        totalReflections: 0,
        totalTasks: 0
      };
    }
    
    try {
      const totalMessages = await memoryManager.getMessageCount();
      const totalReflections = await memoryManager.getReflectionCount();
      const totalTasks = await memoryManager.getTaskCount();
      
      return {
        totalMessages,
        totalReflections,
        totalTasks
      };
    } catch (error) {
      console.error('[SchedulerSystem] Failed to get memory stats:', error);
      return {
        totalMessages: 0,
        totalReflections: 0,
        totalTasks: 0
      };
    }
  }
  
  /**
   * Get planning statistics
   */
  async getPlanningStats(): Promise<{
    totalPlans: number;
    successfulPlans: number;
    failedPlans: number;
  }> {
    const planningManager = this.agent.getPlanningManager ? this.agent.getPlanningManager() : null;
    
    if (!planningManager) {
      return {
        totalPlans: 0,
        successfulPlans: 0,
        failedPlans: 0
      };
    }
    
    try {
      return await planningManager.getStats();
    } catch (error) {
      console.error('[SchedulerSystem] Failed to get planning stats:', error);
      return {
        totalPlans: 0,
        successfulPlans: 0,
        failedPlans: 0
      };
    }
  }
  
  /**
   * Get knowledge gaps statistics
   */
  async getKnowledgeGapsStats(): Promise<{
    totalGaps: number;
    addressedGaps: number;
    pendingGaps: number;
  }> {
    const knowledgeGapsManager = this.agent.getKnowledgeGapsManager?.();
    
    if (!knowledgeGapsManager) {
      return {
        totalGaps: 0,
        addressedGaps: 0,
        pendingGaps: 0
      };
    }
    
    try {
      return await knowledgeGapsManager.getStats();
    } catch (error) {
      console.error('[SchedulerSystem] Failed to get knowledge gaps stats:', error);
      return {
        totalGaps: 0,
        addressedGaps: 0,
        pendingGaps: 0
      };
    }
  }
  
  /**
   * Get tools usage statistics
   */
  async getToolsUsageStats(): Promise<Record<string, number>> {
    const toolManager = this.agent.getToolManager?.();
    
    if (!toolManager) {
      return {};
    }
    
    try {
      return await toolManager.getToolUsageStats();
    } catch (error) {
      console.error('[SchedulerSystem] Failed to get tool usage stats:', error);
      return {};
    }
  }
}

/**
 * Create an autonomy system for the given agent
 */
export async function createAutonomySystem(agent: any): Promise<AutonomySystem> {
  const schedulerSystem = new SchedulerSystem(agent as any);
  await schedulerSystem.initialize();
  
  // Create a new object that satisfies the AutonomySystem interface
  const system: AutonomySystem = {
    status: schedulerSystem.status,
    scheduledTasks: schedulerSystem.scheduledTasks,
    scheduler: schedulerSystem.scheduler,
    initialize: schedulerSystem.initialize.bind(schedulerSystem),
    shutdown: schedulerSystem.shutdown.bind(schedulerSystem),
    runTask: schedulerSystem.runTask.bind(schedulerSystem),
    scheduleTask: async (task: AgentScheduledTask): Promise<boolean> => {
      return schedulerSystem.scheduleTask(task as unknown as ScheduledTask);
    },
    cancelTask: schedulerSystem.cancelTask.bind(schedulerSystem),
    planAndExecute: schedulerSystem.planAndExecute.bind(schedulerSystem),
    diagnose: schedulerSystem.diagnose.bind(schedulerSystem)
  };
  
  return system;
}

/**
 * Schedule a daily reflection task
 */
export async function scheduleDailyReflection(agent: ExtendedChloeAgent): Promise<boolean> {
  try {
    if (agent.scheduleTask) {
      agent.scheduleTask({
        id: 'daily-reflection',
        name: 'Daily Reflection',
        description: 'Reflect on the day and identify opportunities for improvement',
        schedule: '0 19 * * *', // Every day at 7 PM
        enabled: true,
        goalPrompt: 'Reflect on activities from today. Identify patterns and opportunities for improvement. What went well? What could be improved?',
        tags: ['reflection', 'improvement']
      });
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[Scheduler] Failed to schedule daily reflection:', error);
    return false;
  }
}

/**
 * Schedule a weekly planning task
 */
export async function scheduleWeeklyPlanning(agent: ExtendedChloeAgent): Promise<boolean> {
  try {
    if (agent.scheduleTask) {
      agent.scheduleTask({
        id: 'weekly-planning',
        name: 'Weekly Planning',
        description: 'Plan the week ahead based on priorities and insights',
        schedule: '0 9 * * 1', // Every Monday at 9 AM
        enabled: true,
        goalPrompt: 'Based on reflections and key insights, plan strategic priorities for the week. Identify 3-5 key marketing initiatives to focus on.',
        tags: ['planning', 'strategy']
      });
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[Scheduler] Failed to schedule weekly planning:', error);
    return false;
  }
} 