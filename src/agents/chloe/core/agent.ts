/**
 * Simplified ChloeAgent - Core implementation for Chloe marketing agent
 * Implements the agent using the enhanced AgentBase with manager support
 */

import { ChatOpenAI } from '@langchain/openai';
import { AgentBase, AgentBaseConfig, AgentCapabilityLevel } from '../../shared/base/AgentBase';
import { TaskLogger } from '../task-logger';
import { ManagerConfig } from '../../shared/base/managers/BaseManager';

// Define default system prompt
const DEFAULT_SYSTEM_PROMPT = "You are Chloe, CMO of Crowd Wisdom. You provide marketing expertise and strategy.";

/**
 * Options for creating a Chloe agent
 */
export interface ChloeAgentOptions {
  config?: Partial<AgentBaseConfig & { department?: string }>;
}

/**
 * Interface for plan and execute results
 */
export interface PlanAndExecuteResult {
  success: boolean;
  message?: string;
  error?: string;
  plan?: any;
}

/**
 * Interface for plan and execute options
 */
export interface PlanAndExecuteOptions {
  [key: string]: any;
}

/**
 * Reflection manager interface
 */
export interface ReflectionManager {
  createReflection(topic: string): Promise<string>;
  getReflections(limit?: number): Promise<any[]>;
  runEnhancedWeeklyReflection(): Promise<string>;
  runWeeklyReflection(): Promise<string>;
}

/**
 * Planning manager interface
 */
export interface PlanningManager {
  createPlan(goal: string, options?: any): Promise<any>;
  executePlan(plan: any): Promise<any>;
  getStats(): Promise<any>;
}

/**
 * Knowledge gaps manager interface
 */
export interface KnowledgeGapsManager {
  identifyGaps(): Promise<string[]>;
  fillGap(gap: string): Promise<boolean>;
  getStats(): Promise<any>;
}

/**
 * Tool manager interface
 */
export interface ToolManager {
  getAvailableTools(): string[];
  executeTool(toolName: string, params: any): Promise<any>;
  getToolUsageStats(): Promise<any>;
}

/**
 * Scheduler interface
 */
export interface Scheduler {
  getScheduledTasks(): any[];
  runTaskNow(taskId: string): Promise<boolean>;
  setTaskEnabled(taskId: string, enabled: boolean): Promise<boolean>;
}

/**
 * Autonomy system interface
 */
export interface AutonomySystem {
  scheduler: Scheduler;
  getScheduledTasks(): any[];
  runTask(taskId: string): Promise<any>;
  toggleTask(taskId: string, enabled: boolean): Promise<boolean>;
}

/**
 * Simplified ChloeAgent that extends AgentBase
 */
export class ChloeAgent extends AgentBase {
  private taskLogger: TaskLogger;
  private department: string;
  
  /**
   * Create a new Chloe agent
   */
  constructor(options: ChloeAgentOptions = {}) {
    // Base configuration
    const chloeConfig: AgentBaseConfig = {
      agentId: 'chloe',
      name: 'Chloe',
      description: 'CMO of Crowd Wisdom focused on marketing strategy',
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      model: process.env.OPENAI_MODEL_NAME || 'gpt-4o',
      temperature: 0.7,
      maxTokens: 4000,
      capabilities: {
        skills: {}, // Will be populated
        domains: ['marketing', 'growth', 'strategy'],
        roles: ['cmo', 'advisor', 'strategist']
      },
      managers: {
        // Enable specific managers with Chloe's configuration
        memory: {
          enabled: true,
          // Memory manager specific config
          enableAutoPruning: true,
          pruningIntervalMs: 300000, // 5 minutes
          maxShortTermEntries: 100,
          relevanceThreshold: 0.2,
          enableAutoConsolidation: true
        },
        planning: {
          enabled: true,
          // Planning manager specific config
        },
        scheduler: {
          enabled: true,
          // Scheduler manager specific config
        },
        knowledge: {
          enabled: true,
          // Knowledge manager specific config
        },
        reflection: {
          enabled: true,
          // Reflection manager specific config
        },
        tools: {
          enabled: true,
          // Tools manager specific config
        }
      }
    };
    
    // Initialize base agent
    super({
      config: chloeConfig,
      capabilityLevel: AgentCapabilityLevel.ADVANCED,
      toolPermissions: [
        'web_search', 'document_creation', 'social_media_analysis'
      ]
    });
    
    // Initialize basic properties
    this.department = options.config?.department || 'marketing';
    this.taskLogger = new TaskLogger();
  }
  
  /**
   * Initialize the agent
   */
  async initialize(): Promise<boolean> {
    try {
      // Initialize the base agent
      const baseInitialized = await super.initialize();
      if (!baseInitialized) return false;
      
      // Initialize the task logger
      await this.taskLogger.initialize();

      return true;
    } catch (error) {
      console.error('Failed to initialize ChloeAgent:', error);
      return false;
    }
  }
  
  /**
   * Get the task logger
   */
  getTaskLogger(): TaskLogger {
    return this.taskLogger;
  }
  
  /**
   * Get model
   */
  getModel(): ChatOpenAI | null {
    return this.model;
  }

  /**
   * Execute a plan (now using planning manager)
   */
  async planAndExecute(goal: string, options?: PlanAndExecuteOptions): Promise<PlanAndExecuteResult> {
    return await super.planAndExecute(goal, options) as PlanAndExecuteResult;
  }
  
  /**
   * Get the Chloe memory (through memory manager)
   */
  getChloeMemory(): any {
    const memoryManager = this.getManager('memory');
    return memoryManager;
  }
  
  /**
   * Notification function
   */
  notify(message: string): void {
    console.log(`[Chloe Notification] ${message}`);
  }

  /**
   * Get memory for the agent (for compatibility with methods that expect getMemory)
   */
  getMemory(): any {
    return this.getChloeMemory();
  }

  /**
   * Get the agent's autonomy system (through scheduler manager)
   */
  getAutonomySystem(): AutonomySystem | null {
    const schedulerManager = this.getManager('scheduler');
    return schedulerManager as unknown as AutonomySystem;
  }

  /**
   * Get the agent's reflection manager
   */
  getReflectionManager(): ReflectionManager | null {
    return this.getManager('reflection') as unknown as ReflectionManager;
  }

  /**
   * Get the agent's planning manager
   */
  getPlanningManager(): PlanningManager | null {
    return this.getManager('planning') as unknown as PlanningManager;
  }

  /**
   * Get the agent's knowledge gaps manager
   */
  getKnowledgeGapsManager(): KnowledgeGapsManager | null {
    return this.getManager('knowledge') as unknown as KnowledgeGapsManager;
  }

  /**
   * Get the agent's tool manager
   */
  getToolManager(): ToolManager | null {
    return this.getManager('tools') as unknown as ToolManager;
  }

  /**
   * Schedule a task
   */
  async scheduleTask(task: any): Promise<boolean> {
    const schedulerManager = this.getManager('scheduler');
    if (schedulerManager && typeof (schedulerManager as any).scheduleTask === 'function') {
      return await (schedulerManager as any).scheduleTask(task);
    }
    
    console.log(`[Chloe] Scheduling task: ${JSON.stringify(task)}`);
    return true;
  }

  /**
   * Get tasks with a specific tag
   */
  async getTasksWithTag(tag: string): Promise<any[]> {
    const schedulerManager = this.getManager('scheduler');
    if (schedulerManager && typeof (schedulerManager as any).getTasksWithTag === 'function') {
      return await (schedulerManager as any).getTasksWithTag(tag);
    }
    
    console.log(`[Chloe] Getting tasks with tag: ${tag}`);
    return [];
  }

  /**
   * Queue a task
   */
  async queueTask(task: any): Promise<boolean> {
    const schedulerManager = this.getManager('scheduler');
    if (schedulerManager && typeof (schedulerManager as any).queueTask === 'function') {
      return await (schedulerManager as any).queueTask(task);
    }
    
    console.log(`[Chloe] Queuing task: ${JSON.stringify(task)}`);
    return true;
  }

  /**
   * Run daily tasks
   */
  async runDailyTasks(): Promise<any> {
    const schedulerManager = this.getManager('scheduler');
    if (schedulerManager && typeof (schedulerManager as any).runDailyTasks === 'function') {
      return await (schedulerManager as any).runDailyTasks();
    }
    
    console.log(`[Chloe] Running daily tasks`);
    return { success: true };
  }

  /**
   * Run weekly reflection
   */
  async runWeeklyReflection(): Promise<string> {
    const reflectionManager = this.getManager('reflection');
    if (reflectionManager && typeof (reflectionManager as any).runWeeklyReflection === 'function') {
      return await (reflectionManager as any).runWeeklyReflection();
    }
    
    console.log(`[Chloe] Running weekly reflection`);
    return "Weekly reflection completed";
  }

  /**
   * Summarize conversation
   */
  async summarizeConversation(options: { maxEntries?: number } = {}): Promise<string> {
    const memoryManager = this.getManager('memory');
    if (memoryManager && typeof (memoryManager as any).summarizeConversation === 'function') {
      return await (memoryManager as any).summarizeConversation(options);
    }
    
    console.log(`[Chloe] Summarizing conversation with max ${options.maxEntries || 'all'} entries`);
    return "Conversation summary placeholder";
  }
  
  /**
   * Send daily summary to Discord
   */
  async sendDailySummaryToDiscord(): Promise<boolean> {
    // This could be implemented through a notification manager in the future
    console.log(`[Chloe] Sending daily summary to Discord`);
    return true;
  }
}