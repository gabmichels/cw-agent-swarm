/**
 * agent.ts - Core agent implementation
 * 
 * This file provides the core agent implementation that can be used
 * by any agent in the system.
 */

import { AbstractAgentBase } from '../../shared/base/AgentBase';
import { AgentBaseConfig } from '../../shared/base/types';
import { BaseManager } from '../../shared/base/managers/BaseManager';
import { ManagerAdapter } from '../../shared/base/managers/ManagerAdapter';
import { ChatOpenAI } from '@langchain/openai';
import { TaskLogger } from './taskLogger';
import { IAgentMemory } from '../../shared/memory/types';
import { IManager } from '../../../lib/shared/types/agentTypes';

// Local manager implementations
import { PlanningManager as LocalPlanningManager, PlanWithSteps } from './planningManager';
import { MemoryManager as LocalMemoryManager } from './memoryManager';
import { ToolManager as LocalToolManager } from './toolManager';

const DEFAULT_SYSTEM_PROMPT = "You are an AI agent. You provide expertise and assistance.";

/**
 * Options for creating an agent
 */
export interface AgentOptions {
  systemPrompt?: string;
  memory?: IAgentMemory;
  taskLogger?: TaskLogger;
  config?: Partial<AgentBaseConfig>;
}

/**
 * Interface for plan and execute results
 */
export interface PlanAndExecuteResult {
  success: boolean;
  message?: string;
  error?: string;
  plan?: PlanWithSteps;
}

/**
 * Interface for plan and execute options
 */
export interface PlanAndExecuteOptions {
  [key: string]: any;
}

/**
 * Core agent implementation
 */
export class Agent extends AbstractAgentBase {
  private planningManager: LocalPlanningManager;
  private memoryManager: LocalMemoryManager;
  private toolManager: LocalToolManager;
  private taskLogger: TaskLogger;
  private model: ChatOpenAI;

  /**
   * Create a new agent
   */
  constructor(config: AgentBaseConfig) {
    super(config);
    
    // Initialize core components
    this.taskLogger = new TaskLogger();
    this.model = new ChatOpenAI({
      modelName: 'gpt-4',
      temperature: 0.7
    });
    
    // Initialize managers in dependency order
    this.memoryManager = new LocalMemoryManager({
      agentId: this.getAgentId(),
      logger: this.taskLogger
    });
    
    this.toolManager = new LocalToolManager({
      agentId: this.getAgentId(),
      logger: this.taskLogger,
      model: this.model,
      memory: this.memoryManager.getChloeMemory()!
    });
    
    this.planningManager = new LocalPlanningManager({
      agentId: this.getAgentId(),
      memory: this.memoryManager.getChloeMemory()!,
      model: this.model,
      taskLogger: this.taskLogger
    });
    
    // Register managers with adapters
    this.registerManager(new ManagerAdapter(this.memoryManager, this, 'memory'));
    this.registerManager(new ManagerAdapter(this.toolManager, this, 'tools'));
    this.registerManager(new ManagerAdapter(this.planningManager, this, 'planning'));
  }

  /**
   * Initialize the agent
   */
  async initialize(): Promise<boolean> {
    console.log(`[${this.getAgentId()}] Initializing agent`);
    
    // Initialize all registered managers
    const managerInitResults = await Promise.all(
      this.getManagers().map(manager => manager.initialize())
    );
    
    // Check if all managers initialized successfully
    return managerInitResults.every(result => result === true);
  }

  /**
   * Shutdown the agent
   */
  async shutdown(): Promise<void> {
    console.log(`[${this.getAgentId()}] Shutting down agent`);
    
    // Shutdown all registered managers
    await Promise.all(
      this.getManagers().map(manager => manager.shutdown())
    );
  }

  /**
   * Get the agent's ID
   */
  getAgentId(): string {
    return this.config.id.toString();
  }
  
  /**
   * Get the agent's name
   */
  getName(): string {
    return this.config.name;
  }
  
  /**
   * Get the agent's configuration
   */
  getConfig(): AgentBaseConfig {
    return this.config;
  }
  
  /**
   * Update the agent's configuration
   */
  updateConfig(config: Partial<AgentBaseConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Get the agent's memory
   */
  getMemory(): IAgentMemory | null {
    return this.memoryManager.getChloeMemory();
  }
  
  /**
   * Notification function
   */
  notify(message: string): void {
    console.log(`[Agent Notification] ${message}`);
  }

  /**
   * Get the agent's memory manager
   */
  getMemoryManager(): LocalMemoryManager {
    return this.memoryManager;
  }

  /**
   * Get the agent's tool manager
   */
  getToolManager(): LocalToolManager {
    return this.toolManager;
  }

  /**
   * Get the agent's planning manager
   */
  getPlanningManager(): LocalPlanningManager {
    return this.planningManager;
  }

  /**
   * Schedule a task
   */
  async scheduleTask(task: any): Promise<boolean> {
    const schedulerManager = this.getManager('scheduler');
    if (schedulerManager && typeof (schedulerManager as any).scheduleTask === 'function') {
      return await (schedulerManager as any).scheduleTask(task);
    }
    
    console.log(`[Agent] Scheduling task: ${JSON.stringify(task)}`);
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
    
    console.log(`[Agent] Getting tasks with tag: ${tag}`);
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
    
    console.log(`[Agent] Queuing task: ${JSON.stringify(task)}`);
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
    
    console.log(`[Agent] Running daily tasks`);
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
    
    console.log(`[Agent] Running weekly reflection`);
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
    
    console.log(`[Agent] Summarizing conversation with max ${options.maxEntries || 'all'} entries`);
    return "Conversation summary placeholder";
  }
  
  /**
   * Send daily summary to Discord
   */
  async sendDailySummaryToDiscord(): Promise<boolean> {
    // This could be implemented through a notification manager in the future
    console.log(`[Agent] Sending daily summary to Discord`);
    return true;
  }
}