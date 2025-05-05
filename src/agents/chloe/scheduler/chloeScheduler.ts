/**
 * ChloeScheduler - Enables autonomous behavior by scheduling recurring tasks
 * Handles daily planning, weekly reflection, and maintenance cycles
 */

import { ChloeAgent } from '../core/agent';
import { ChatOpenAI } from '@langchain/openai';
import { ChloeMemory } from '../memory';
import { TaskLogger } from '../task-logger';
import { MemoryType as MemType, ImportanceLevel, MemorySource } from '../../../constants/memory';
import { MemoryType } from '../../../server/memory/config/types';
import { runWeeklySelfImprovement } from '../self-improvement/weeklySelfImprovement';
import { PlanAndExecuteOptions } from '../planAndExecute';

/**
 * Interface for scheduler configuration
 */
export interface SchedulerConfig {
  dailyGoal?: string;
  enableNotifications?: boolean;
  dailyCycleTime?: string; // Format: 'HH:MM'
  weeklyCycleDay?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  weeklyCycleTime?: string; // Format: 'HH:MM'
  maintenanceCycleTime?: string; // Format: 'HH:MM'
}

/**
 * Interface for ChloeScheduler
 * Defines the interface that autonomousScheduler.ts uses
 */
export interface ChloeScheduler {
  /**
   * Check if the scheduler is initialized
   */
  isInitialized(): boolean;
  
  /**
   * Initialize the scheduler
   */
  initialize(): Promise<void>;
  
  /**
   * Get the agent instance
   */
  getAgent(): ChloeAgent;
  
  /**
   * Register a weekly task
   */
  registerWeeklyTask(
    id: string,
    day: string, 
    time: string,
    callback: () => Promise<void>,
    tags?: string[]
  ): void;
  
  /**
   * Register a daily task
   */
  registerDailyTask(
    id: string,
    time: string,
    callback: () => Promise<void>,
    tags?: string[]
  ): void;
}

/**
 * ChloeScheduler class for managing autonomous behavior
 */
export class ChloeScheduler {
  private agent: ChloeAgent;
  private memory: ChloeMemory;
  private taskLogger: TaskLogger;
  private model: ChatOpenAI | null = null;
  private config: SchedulerConfig;
  private initialized: boolean = false;

  /**
   * Constructor for ChloeScheduler
   * @param agent The ChloeAgent instance to use
   * @param config Scheduler configuration options
   */
  constructor(agent: ChloeAgent, config: SchedulerConfig = {}) {
    this.agent = agent;
    this.memory = new ChloeMemory();
    this.taskLogger = new TaskLogger();
    this.config = {
      dailyGoal: "Plan and prioritize today's growth tasks",
      enableNotifications: true,
      dailyCycleTime: '08:00',
      weeklyCycleDay: 'monday',
      weeklyCycleTime: '09:00',
      maintenanceCycleTime: '03:00',
      ...config
    };
  }

  /**
   * Initialize the scheduler
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize the agent (this also initializes memory and taskLogger)
    await this.agent.initialize();
    
    // Get model from the agent
    this.model = this.agent.getModel();
    
    // Create a dedicated session for scheduler activities
    this.taskLogger.createSession("ChloeScheduler Session", ["scheduler", "autonomous"]);
    
    this.taskLogger.logAction("Scheduler initialized", {
      config: this.config,
      timestamp: new Date().toISOString()
    });
    
    this.initialized = true;
  }

  /**
   * Run the daily cycle for Chloe
   * This includes generating a daily goal, planning tasks, and storing summaries
   */
  async runDailyCycle(): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      this.taskLogger.logAction("Starting daily cycle", {
        timestamp: new Date().toISOString()
      });
      
      // 1. Generate or fetch a daily goal
      const dailyGoal = this.config.dailyGoal || "Plan and prioritize today's growth tasks";
      
      // 2. Call Chloe's planTask() logic for the daily goal
      const planOptions: PlanAndExecuteOptions = {
        goalPrompt: dailyGoal,
        autonomyMode: true,
        tags: ["daily_cycle", "scheduled"]
      };
      
      // Run plan and execute through the agent
      const result = await this.agent.planAndExecute(dailyGoal, planOptions);
      
      // 3. Store summary in memory with metadata
      const resultSummary = (result as any).summary || "Completed daily planning cycle";
      
      await this.memory.addMemory(
        `Daily Cycle Summary: ${resultSummary}`,
        MemType.DAILY_CYCLE_LOG,
        ImportanceLevel.MEDIUM,
        MemorySource.SYSTEM,
        `Daily planning for ${new Date().toISOString().split('T')[0]}`,
        ["daily_cycle", "autonomous", "scheduler"]
      );
      
      // Run daily tasks if agent has that capability
      if (typeof this.agent.runDailyTasks === 'function') {
        await this.agent.runDailyTasks();
      }
      
      this.taskLogger.logAction("Completed daily cycle", {
        timestamp: new Date().toISOString(),
        result: {
          goalPrompt: dailyGoal,
          status: (result as any).status || 'completed',
          hasError: !!result.error
        }
      });
      
      // Send notification if enabled
      if (this.config.enableNotifications) {
        this.agent.notify("✅ Daily cycle completed successfully");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.taskLogger.logAction("Error in daily cycle", {
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
      
      // Store error in memory
      await this.memory.addMemory(
        `Error in daily cycle: ${errorMessage}`,
        MemType.ERROR_LOG,
        ImportanceLevel.HIGH,
        MemorySource.SYSTEM,
        `Daily cycle failure on ${new Date().toISOString().split('T')[0]}`,
        ["error", "daily_cycle", "scheduler"]
      );
      
      // Send notification if enabled
      if (this.config.enableNotifications) {
        this.agent.notify("❌ Error in daily cycle: " + errorMessage);
      }
      
      // Rethrow error for further handling
      throw error;
    }
  }

  /**
   * Run the weekly cycle for Chloe
   * This includes self-improvement, reflection, and optionally reprioritizing the backlog
   */
  async runWeeklyCycle(): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      this.taskLogger.logAction("Starting weekly cycle", {
        timestamp: new Date().toISOString()
      });
      
      // 1. Call runWeeklySelfImprovement() from self-improvement module
      const { KnowledgeGraphManager } = require('../knowledge/graphManager');
      // Create a graph manager for handling knowledge operations
      const graphManager = new KnowledgeGraphManager();
      const selfImprovementResult = await runWeeklySelfImprovement(this.memory, graphManager);
      
      // 2. Trigger generateWeeklyReflection() if defined
      let weeklyReflection = "";
      if (typeof this.agent.runWeeklyReflection === 'function') {
        weeklyReflection = await this.agent.runWeeklyReflection();
      } else {
        // Fallback using reflection manager
        const reflectionManager = this.agent.getReflectionManager?.();
        if (reflectionManager) {
          // Use enhanced weekly reflection with causal analysis if available
          if (typeof reflectionManager.runEnhancedWeeklyReflection === 'function') {
            weeklyReflection = await reflectionManager.runEnhancedWeeklyReflection();
            this.taskLogger.logAction("Generated enhanced weekly reflection with causal analysis", {
              timestamp: new Date().toISOString()
            });
          } else if (typeof reflectionManager.runWeeklyReflection === 'function') {
            weeklyReflection = await reflectionManager.runWeeklyReflection();
            this.taskLogger.logAction("Generated standard weekly reflection", {
              timestamp: new Date().toISOString()
            });
          }
        }
      }
      
      // 3. Store summary memory with type 'weekly_cycle_log'
      await this.memory.addMemory(
        `Weekly Cycle Summary:\n
Tasks Scored: ${selfImprovementResult.tasksScored}
Insights Generated: ${selfImprovementResult.insightsGenerated}
Adjustments Proposed: ${selfImprovementResult.adjustmentsProposed}
Errors: ${selfImprovementResult.errors.length ? selfImprovementResult.errors.join(", ") : "None"}
\n${weeklyReflection ? `Weekly Reflection:\n${weeklyReflection.substring(0, 500)}...` : ""}`,
        MemType.WEEKLY_CYCLE_LOG,
        ImportanceLevel.HIGH,
        MemorySource.SYSTEM,
        `Weekly cycle for week ending ${new Date().toISOString().split('T')[0]}`,
        ["weekly_cycle", "autonomous", "scheduler", "reflection"]
      );
      
      // 4. Optionally reprioritize backlog using planning manager
      const planningManager = this.agent.getPlanningManager?.();
      if (planningManager) {
        const planningManagerAny = planningManager as any;
        if (typeof planningManagerAny.reprioritizeBacklog === 'function') {
          await planningManagerAny.reprioritizeBacklog();
          this.taskLogger.logAction("Reprioritized task backlog", {
            timestamp: new Date().toISOString()
          });
        }
      }
      
      this.taskLogger.logAction("Completed weekly cycle", {
        timestamp: new Date().toISOString(),
        selfImprovementResult,
        reflectionGenerated: !!weeklyReflection
      });
      
      // Send notification if enabled
      if (this.config.enableNotifications) {
        this.agent.notify("✅ Weekly cycle completed successfully");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.taskLogger.logAction("Error in weekly cycle", {
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
      
      // Store error in memory
      await this.memory.addMemory(
        `Error in weekly cycle: ${errorMessage}`,
        MemType.ERROR_LOG,
        ImportanceLevel.HIGH,
        MemorySource.SYSTEM,
        `Weekly cycle failure on ${new Date().toISOString().split('T')[0]}`,
        ["error", "weekly_cycle", "scheduler"]
      );
      
      // Send notification if enabled
      if (this.config.enableNotifications) {
        this.agent.notify("❌ Error in weekly cycle: " + errorMessage);
      }
      
      // Rethrow error for further handling
      throw error;
    }
  }

  /**
   * Run maintenance tasks for Chloe
   * This includes checking tool status, memory consistency, and knowledge graph integrity
   */
  async runMaintenance(): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      this.taskLogger.logAction("Starting maintenance cycle", {
        timestamp: new Date().toISOString()
      });
      
      // Store maintenance start log
      await this.memory.addMemory(
        "Started maintenance cycle",
        MemType.MAINTENANCE_LOG,
        ImportanceLevel.LOW,
        MemorySource.SYSTEM,
        `Maintenance cycle on ${new Date().toISOString().split('T')[0]}`,
        ["maintenance", "scheduler"]
      );
      
      // 1. Check memory health
      const memoryStats = await this.memory.diagnose();
      
      // 2. Check knowledge graph integrity if available
      let knowledgeGraphStats: any = { status: 'unavailable' };
      const knowledgeGapsManager = this.agent.getKnowledgeGapsManager?.();
      if (knowledgeGapsManager) {
        try {
          const knowledgeGapsManagerAny = knowledgeGapsManager as any;
          if (typeof knowledgeGapsManagerAny.diagnoseKnowledgeGraph === 'function') {
            knowledgeGraphStats = await knowledgeGapsManagerAny.diagnoseKnowledgeGraph();
          }
        } catch (error) {
          knowledgeGraphStats = { status: 'error', error: String(error) };
        }
      }
      
      // 3. Check tool status
      let toolsStatus: any = { status: 'unavailable' };
      const toolManager = this.agent.getToolManager?.();
      if (toolManager) {
        try {
          const toolManagerAny = toolManager as any;
          if (typeof toolManagerAny.checkToolsStatus === 'function') {
            toolsStatus = await toolManagerAny.checkToolsStatus();
          }
        } catch (error) {
          toolsStatus = { status: 'error', error: String(error) };
        }
      }
      
      // Compile maintenance report
      const maintenanceReport = {
        timestamp: new Date().toISOString(),
        memoryStats,
        knowledgeGraphStats,
        toolsStatus
      };
      
      // Store maintenance summary
      await this.memory.addMemory(
        `Maintenance Cycle Summary: ${JSON.stringify(maintenanceReport, null, 2)}`,
        MemType.MAINTENANCE_LOG,
        ImportanceLevel.MEDIUM,
        MemorySource.SYSTEM,
        `Maintenance cycle completed on ${new Date().toISOString().split('T')[0]}`,
        ["maintenance", "scheduler", "system_health"]
      );
      
      this.taskLogger.logAction("Completed maintenance cycle", {
        timestamp: new Date().toISOString(),
        maintenanceReport
      });
      
      // Send notification if enabled and there were issues
      if (this.config.enableNotifications && 
          (memoryStats.status !== 'healthy' || 
           knowledgeGraphStats.status !== 'healthy' || 
           toolsStatus.status !== 'healthy')) {
        this.agent.notify("⚠️ Maintenance cycle completed with issues - check maintenance log");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.taskLogger.logAction("Error in maintenance cycle", {
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
      
      // Store error in memory
      await this.memory.addMemory(
        `Error in maintenance cycle: ${errorMessage}`,
        MemType.ERROR_LOG,
        ImportanceLevel.HIGH,
        MemorySource.SYSTEM,
        `Maintenance cycle failure on ${new Date().toISOString().split('T')[0]}`,
        ["error", "maintenance", "scheduler"]
      );
      
      // Send notification if enabled
      if (this.config.enableNotifications) {
        this.agent.notify("❌ Error in maintenance cycle: " + errorMessage);
      }
      
      // Rethrow error for further handling
      throw error;
    }
  }

  /**
   * Check if the scheduler is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the agent instance
   */
  getAgent(): ChloeAgent {
    return this.agent;
  }
  
  /**
   * Register a weekly task to run on a specific day and time
   * @param id Task identifier
   * @param day Day of the week to run the task
   * @param time Time in HH:MM format
   * @param callback Async function to execute
   * @param tags Optional tags for the task
   */
  registerWeeklyTask(
    id: string, 
    day: string, 
    time: string, 
    callback: () => Promise<void>,
    tags: string[] = []
  ): void {
    const dayNumber = this.getDayNumber(day);
    const [hours, minutes] = time.split(':').map(Number);
    
    // Create cron expression for the specified day/time
    // Format: minute hour * * dayOfWeek
    const cronExpression = `${minutes} ${hours} * * ${dayNumber}`;
    
    this.taskLogger.logAction("Registering weekly task", {
      id,
      cronExpression,
      day,
      time,
      tags
    });
    
    // Use the agent's scheduler if available to schedule the task
    if (typeof this.agent.scheduleTask === 'function') {
      this.agent.scheduleTask({
        id,
        name: id,
        cronExpression,
        execute: callback,
        tags: [...tags, 'weekly', 'scheduled']
      });
    } else {
      console.warn(`Agent doesn't support task scheduling. Task ${id} not scheduled.`);
    }
  }
  
  /**
   * Register a daily task to run at a specific time
   * @param id Task identifier
   * @param time Time in HH:MM format
   * @param callback Async function to execute
   * @param tags Optional tags for the task
   */
  registerDailyTask(
    id: string, 
    time: string, 
    callback: () => Promise<void>,
    tags: string[] = []
  ): void {
    const [hours, minutes] = time.split(':').map(Number);
    
    // Create cron expression for daily at the specified time
    // Format: minute hour * * *
    const cronExpression = `${minutes} ${hours} * * *`;
    
    this.taskLogger.logAction("Registering daily task", {
      id,
      cronExpression,
      time,
      tags
    });
    
    // Use the agent's scheduler if available to schedule the task
    if (typeof this.agent.scheduleTask === 'function') {
      this.agent.scheduleTask({
        id,
        name: id,
        cronExpression,
        execute: callback,
        tags: [...tags, 'daily', 'scheduled']
      });
    } else {
      console.warn(`Agent doesn't support task scheduling. Task ${id} not scheduled.`);
    }
  }
  
  /**
   * Helper method to convert day name to cron day number
   * @param day Day name (sunday, monday, etc.)
   * @returns Cron day number (0-6, where 0 is Sunday)
   */
  private getDayNumber(day: string): number {
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
}

/**
 * Entry point for running Chloe's daily cycle
 * Can be triggered by CRON or manual intervention
 */
export async function runChloeDaily(agent: ChloeAgent): Promise<void> {
  const scheduler = new ChloeScheduler(agent);
  await scheduler.runDailyCycle();
}

/**
 * Entry point for running Chloe's weekly cycle
 * Can be triggered by CRON or manual intervention
 */
export async function runChloeWeekly(agent: ChloeAgent): Promise<void> {
  const scheduler = new ChloeScheduler(agent);
  await scheduler.runWeeklyCycle();
}

/**
 * Entry point for running Chloe's maintenance tasks
 * Can be triggered by CRON or manual intervention
 */
export async function runChloeMaintenance(agent: ChloeAgent): Promise<void> {
  const scheduler = new ChloeScheduler(agent);
  await scheduler.runMaintenance();
} 