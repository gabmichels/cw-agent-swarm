import { CronJob } from 'cron';
import { ChloeAgent } from './agent';
import { PlanAndExecuteOptions } from './planAndExecute';
import { logger } from '../../lib/logging';
import { runMemoryConsolidation } from './tasks/memoryConsolidation';
import { 
  runMarketScanTask, 
  runNewsScanTask, 
  runTrendingTopicResearchTask, 
  runSocialMediaTrendsTask 
} from './tasks/marketScanTask';

// Types for scheduler
export type TaskId = string;

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
      console.error(`Task ${id} not found during execution`);
      return;
    }
    
    console.log(`Executing scheduled task: ${id}`);
    
    try {
      // Update last run timestamp
      taskConfig.lastRun = new Date();
      
      // Handle special task cases
      switch (id) {
        case 'memory-consolidation':
          try {
            const success = await runMemoryConsolidation(this.agent);
            console.log(`Memory consolidation ${success ? 'completed successfully' : 'failed'}`);
          } catch (error) {
            console.error('Error running memory consolidation:', error);
          }
          break;
          
        case 'market-scan':
          try {
            const success = await runMarketScanTask(this.agent);
            console.log(`Market scan ${success ? 'completed successfully' : 'failed'}`);
          } catch (error) {
            console.error('Error running market scan:', error);
          }
          break;
          
        case 'news-scan':
          try {
            const success = await runNewsScanTask(this.agent);
            console.log(`News scan ${success ? 'completed successfully' : 'failed'}`);
          } catch (error) {
            console.error('Error running news scan:', error);
          }
          break;
          
        case 'trending-topic-research':
          try {
            const success = await runTrendingTopicResearchTask(this.agent);
            console.log(`Trending topic research ${success ? 'completed successfully' : 'failed'}`);
          } catch (error) {
            console.error('Error running trending topic research:', error);
          }
          break;
          
        case 'social-media-trends':
          try {
            const success = await runSocialMediaTrendsTask(this.agent);
            console.log(`Social media trends analysis ${success ? 'completed successfully' : 'failed'}`);
          } catch (error) {
            console.error('Error running social media trends analysis:', error);
          }
          break;
          
        default:
          // Standard execution process for most tasks
          // Get the autonomy system for plan & execute
          const autonomySystem = await this.agent.getAutonomySystem();
          if (!autonomySystem) {
            console.error('Autonomy system not initialized');
            return;
          }
          
          // Standard execution process for most tasks
          const options: PlanAndExecuteOptions = {
            goalPrompt: taskConfig.goalPrompt,
            autonomyMode: true,
            requireApproval: false,
            tags: taskConfig.tags
          };
          
          // Execute the task
          console.log(`Running task ${id} with goal: ${taskConfig.goalPrompt.substring(0, 100)}...`);
          const result = await autonomySystem.planAndExecute(options);
          
          // Log the result
          if (result && result.success) {
            console.log(`Task ${id} completed successfully`);
          } else {
            console.error(`Task ${id} failed: ${result?.error || 'Unknown error'}`);
          }
          break;
      }
    } catch (error) {
      console.error(`Error executing task ${id}:`, error);
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
  
  // Daily morning briefing - Generate a summary of what's happening and what's planned
  scheduler.scheduleTask(
    'daily-briefing',
    '0 8 * * *', // 8 AM daily
    'Create a morning briefing summarizing recent marketing activities, trends, and goals for the day.',
    ['daily', 'planning']
  );
  
  // Weekly marketing review - Analyze marketing performance
  scheduler.scheduleTask(
    'weekly-marketing-review',
    '0 10 * * 1', // Monday at 10 AM
    'Review the previous week\'s marketing performance. Analyze key metrics, campaign results, and social media engagement. Provide insights and recommendations.',
    ['weekly', 'analytics']
  );
  
  // Content idea generation - Generate content ideas twice a week
  scheduler.scheduleTask(
    'content-idea-generation',
    '0 14 * * 2,4', // Tuesday and Thursday at 2 PM
    'Generate 5-10 fresh content ideas for our blog, social media, and newsletter. Consider current trends, customer interests, and business objectives.',
    ['content', 'creativity']
  );
  
  // Memory consolidation - Process and organize memories
  scheduler.scheduleTask(
    'memory-consolidation',
    '0 2 * * *', // 2 AM daily
    'Review recent memories and conversations. Identify important insights, action items, and recurring themes. Organize and categorize this information to improve knowledge retrieval.',
    ['memory', 'maintenance']
  );
  
  // Market scan integration - Runs a comprehensive market scan
  scheduler.scheduleTask(
    'market-scan',
    '0 7 * * 1,3,5', // Monday, Wednesday, Friday at 7 AM
    'Run a comprehensive market scan to identify trends, competitor activities, and industry news. Store valuable insights in the knowledge base for future reference.',
    ['research', 'marketing', 'knowledge']
  );
  
  // News scan for daily monitoring
  scheduler.scheduleTask(
    'news-scan',
    '0 9,15 * * *', // 9 AM and 3 PM daily
    'Scan recent news sources for marketing-related updates, industry changes, and relevant events. Flag any critical information that requires attention.',
    ['news', 'monitoring', 'alerts']
  );
  
  // Trending topic research - Weekly research into trending topics
  scheduler.scheduleTask(
    'trending-topic-research',
    '0 13 * * 3', // Wednesday at 1 PM
    'Analyze current trending topics in marketing and customer experience. Research emerging patterns and assess how they might impact our marketing strategy.',
    ['trends', 'research', 'strategy']
  );
  
  // Social media trend detection - Monitors social media trends
  scheduler.scheduleTask(
    'social-media-trends',
    '0 11 * * 2,5', // Tuesday and Friday at 11 AM
    'Monitor and detect trending topics and conversations on social media platforms. Identify opportunities for engagement and content creation.',
    ['social-media', 'trends', 'engagement']
  );
  
  // Monthly strategic planning
  scheduler.scheduleTask(
    'monthly-strategic-planning',
    '0 9 1 * *', // 1st day of each month at 9 AM
    'Develop a strategic marketing plan for the upcoming month. Consider business objectives, past performance, market conditions, and available resources.',
    ['monthly', 'planning', 'strategy']
  );
  
  // Quarterly performance evaluation
  scheduler.scheduleTask(
    'quarterly-performance-review',
    '0 10 1 1,4,7,10 *', // First day of each quarter at 10 AM
    'Conduct a comprehensive review of the previous quarter\'s marketing performance. Analyze KPIs, campaign effectiveness, budget utilization, and strategic alignment.',
    ['quarterly', 'review', 'analytics']
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