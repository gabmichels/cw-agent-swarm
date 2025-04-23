import { CronJob } from 'cron';
import { ChloeAgent } from './agent';
import { PlanAndExecuteOptions } from './planAndExecute';

// Setup scheduler for the agent's recurring tasks
export function setupScheduler(agent: ChloeAgent) {
  // Tasks to run daily at 9:00 AM
  const dailyTasks = new CronJob(
    '0 9 * * *', // Run at 9:00 AM every day
    async () => {
      console.log('Running daily tasks...');
      await agent.runDailyTasks();
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
  
  // Task scheduler controller
  return {
    start: () => {
      dailyTasks.start();
      weeklyReflection.start();
      console.log('Task scheduler started');
    },
    stop: () => {
      dailyTasks.stop();
      weeklyReflection.stop();
      console.log('Task scheduler stopped');
    },
    status: () => {
      // Check if job is active safely
      const isJobActive = (job: any) => {
        // Cron v4 uses isActive, earlier versions used running
        return job.isActive || false;
      };
      
      return {
        dailyTasks: isJobActive(dailyTasks),
        weeklyReflection: isJobActive(weeklyReflection),
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
      console.error(`Error scheduling task ${id}:`, error);
      return false;
    }
  }

  /**
   * Start a scheduled task
   */
  private startTask(id: string): boolean {
    const taskConfig = this.scheduledTasks.get(id);
    if (!taskConfig) {
      console.error(`Task ${id} not found`);
      return false;
    }

    // If task is already running, stop it first
    if (taskConfig.task) {
      taskConfig.task.stop();
    }

    try {
      // Schedule the task
      taskConfig.task = new CronJob(
        taskConfig.cronExpression, 
        async () => {
          await this.executeTask(id);
        },
        null, // onComplete
        true, // start
        'UTC' // timezone
      );
      
      console.log(`Started scheduled task ${id}`);
      return true;
    } catch (error) {
      console.error(`Error starting task ${id}:`, error);
      return false;
    }
  }

  /**
   * Stop a scheduled task
   */
  private stopTask(id: string): boolean {
    const taskConfig = this.scheduledTasks.get(id);
    if (!taskConfig || !taskConfig.task) {
      console.error(`Task ${id} not found or not running`);
      return false;
    }

    try {
      taskConfig.task.stop();
      taskConfig.task = undefined;
      console.log(`Stopped scheduled task ${id}`);
      return true;
    } catch (error) {
      console.error(`Error stopping task ${id}:`, error);
      return false;
    }
  }

  /**
   * Execute a scheduled task
   */
  private async executeTask(id: string): Promise<void> {
    const taskConfig = this.scheduledTasks.get(id);
    if (!taskConfig) {
      console.error(`Task ${id} not found`);
      return;
    }

    try {
      console.log(`Executing scheduled task ${id}: ${taskConfig.goalPrompt}`);
      
      // Update last run timestamp
      taskConfig.lastRun = new Date();
      
      // Create options for planAndExecute
      const options: PlanAndExecuteOptions = {
        goalPrompt: taskConfig.goalPrompt,
        autonomyMode: true,
        requireApproval: false,
        tags: [...taskConfig.tags, 'scheduled']
      };
      
      // Execute the task
      const result = await (this.agent as any).planAndExecute(options);
      
      console.log(`Completed scheduled task ${id}, output: ${result.finalOutput}`);
    } catch (error) {
      console.error(`Error executing scheduled task ${id}:`, error);
    }
  }

  /**
   * Get all scheduled tasks
   */
  public getScheduledTasks(): ScheduledTask[] {
    return Array.from(this.scheduledTasks.values()).map(task => ({
      ...task,
      task: undefined // Don't expose the cron task object
    }));
  }

  /**
   * Run a task immediately, regardless of schedule
   */
  public async runTaskNow(id: string): Promise<boolean> {
    if (!this.scheduledTasks.has(id)) {
      console.error(`Task ${id} not found`);
      return false;
    }

    try {
      await this.executeTask(id);
      return true;
    } catch (error) {
      console.error(`Error running task ${id}:`, error);
      return false;
    }
  }

  /**
   * Remove a scheduled task
   */
  public removeTask(id: string): boolean {
    const taskConfig = this.scheduledTasks.get(id);
    if (!taskConfig) {
      console.error(`Task ${id} not found`);
      return false;
    }

    // Stop the task if it's running
    if (taskConfig.task) {
      taskConfig.task.stop();
    }

    // Remove from the map
    this.scheduledTasks.delete(id);
    console.log(`Removed scheduled task ${id}`);
    return true;
  }

  /**
   * Enable or disable a specific task
   */
  public setTaskEnabled(id: string, enabled: boolean): boolean {
    const taskConfig = this.scheduledTasks.get(id);
    if (!taskConfig) {
      console.error(`Task ${id} not found`);
      return false;
    }

    taskConfig.enabled = enabled;
    
    if (enabled && this.autonomyMode) {
      return this.startTask(id);
    } else if (!enabled && taskConfig.task) {
      return this.stopTask(id);
    }
    
    return true;
  }
} 