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
      
      // Special handling for specific task types
      if (id === 'daily-summary') {
        // Execute the daily summary method directly
        await this.agent.sendDailySummaryToDiscord();
        console.log(`Completed daily summary task`);
        return;
      } else if (id === 'weekly-reflection') {
        // Execute the weekly reflection method directly
        await this.agent.runWeeklyReflection();
        console.log(`Completed weekly reflection task`);
        return;
      }
      
      // For standard tasks, use planAndExecute
      const options: PlanAndExecuteOptions = {
        goalPrompt: taskConfig.goalPrompt,
        autonomyMode: true,
        requireApproval: false,
        tags: [...taskConfig.tags, 'scheduled']
      };
      
      // Execute the task
      const result = await (this.agent as any).planAndExecute(options);
      
      console.log(`Completed scheduled task ${id}, output: ${result?.finalOutput || 'No output'}`);
      
      // Send notification to Discord for completed task
      try {
        const { notifyDiscord } = require('./notifiers');
        await notifyDiscord(`Task completed: ${taskConfig.goalPrompt.substring(0, 100)}...`, 'update');
      } catch (error) {
        console.error('Failed to send task completion notification:', error);
      }
    } catch (error) {
      console.error(`Error executing scheduled task ${id}:`, error);
      
      // Try to send error notification
      try {
        const { notifyDiscord } = require('./notifiers');
        await notifyDiscord(`Error in task ${id}: ${error instanceof Error ? error.message : String(error)}`, 'alert', true);
      } catch (notifyError) {
        console.error('Failed to send error notification:', notifyError);
      }
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

// Set up default scheduled tasks for Chloe
export function setupDefaultSchedule(scheduler: ChloeScheduler): void {
  console.log('Setting up default scheduled tasks for Chloe');
  
  // Daily planning task - runs at 8:00 AM every day
  scheduler.scheduleTask(
    'daily-planning',
    '0 8 * * *',
    'Create a detailed plan for today\'s marketing tasks, prioritizing the most important items.',
    ['planning', 'daily', 'marketing']
  );
  
  // Daily summary - runs at 5:00 PM every day
  scheduler.scheduleTask(
    'daily-summary',
    '0 17 * * *',
    'Create and send a daily summary of tasks and accomplishments for today.',
    ['summary', 'daily', 'reporting']
  );
  
  // Weekly reflection - runs every Sunday at 6:00 PM
  scheduler.scheduleTask(
    'weekly-reflection',
    '0 18 * * 0',
    'Perform a weekly reflection on performance, accomplishments, and areas for improvement.',
    ['reflection', 'weekly', 'analysis']
  );
  
  // Content strategy review - runs every Monday at 9:00 AM
  scheduler.scheduleTask(
    'weekly-content-review',
    '0 9 * * 1',
    'Review our content strategy for the week ahead. Analyze performance of last week\'s content and suggest improvements.',
    ['content', 'weekly', 'planning']
  );
  
  // Marketing performance analysis - runs every Friday at 2:00 PM
  scheduler.scheduleTask(
    'weekly-performance-analysis',
    '0 14 * * 5',
    'Analyze the performance of our marketing campaigns this week. Identify trends, successes, and areas for improvement.',
    ['analytics', 'weekly', 'performance']
  );
  
  // Social media planning - runs every Tuesday and Thursday at 10:00 AM
  scheduler.scheduleTask(
    'social-media-planning',
    '0 10 * * 2,4',
    'Plan social media content for the next few days. Consider trending topics, audience engagement metrics, and our content calendar.',
    ['social-media', 'content', 'planning']
  );
  
  // Industry research - runs every Wednesday at 1:00 PM
  scheduler.scheduleTask(
    'industry-research',
    '0 13 * * 3',
    'Research the latest trends and innovations in our industry. Identify opportunities for new content or marketing strategies.',
    ['research', 'industry', 'innovation']
  );
  
  console.log('Default scheduled tasks have been set up');
}

// Main initialization for Chloe's autonomy system
export function initializeAutonomy(agent: ChloeAgent): { 
  scheduler: ChloeScheduler, 
  tasks: ReturnType<typeof setupScheduler>
} {
  const scheduler = new ChloeScheduler(agent);
  const tasks = setupScheduler(agent);
  
  // Set up default schedule
  setupDefaultSchedule(scheduler);
  
  // Start the scheduler in autonomous mode
  scheduler.setAutonomyMode(true);
  tasks.start();
  
  console.log('Chloe autonomy system initialized');
  
  return { scheduler, tasks };
} 