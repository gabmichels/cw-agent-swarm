/**
 * Base Agent Interfaces
 * 
 * This file defines common interfaces used by all agents in the system.
 */

import { ChatOpenAI } from '@langchain/openai';

/**
 * Agent capability levels
 */
export enum AgentCapabilityLevel {
  /**
   * Basic agent with minimal capabilities
   */
  BASIC = 'basic',
  
  /**
   * Standard agent with common capabilities
   */
  STANDARD = 'standard',
  
  /**
   * Advanced agent with enhanced capabilities
   */
  ADVANCED = 'advanced',
  
  /**
   * Expert agent with all capabilities enabled
   */
  EXPERT = 'expert'
}

/**
 * Base agent configuration interface
 */
export interface BaseAgentConfig {
  /**
   * Unique identifier for the agent
   */
  agentId: string;

  /**
   * Display name for the agent
   */
  name?: string;

  /**
   * Description of the agent
   */
  description?: string;

  /**
   * System prompt to use for the agent
   */
  systemPrompt?: string;
  
  /**
   * Model to use for the agent
   */
  model?: string;

  /**
   * Generation temperature (0-1)
   */
  temperature?: number;

  /**
   * Maximum tokens to generate
   */
  maxTokens?: number;

  /**
   * Agent capabilities configuration
   */
  capabilities?: {
    /**
     * Skills the agent has
     */
    skills?: Record<string, any>;
    
    /**
     * Knowledge domains
     */
    domains?: string[];
    
    /**
     * Roles the agent can fulfill
     */
    roles?: string[];
  };

  /**
   * Manager configurations
   */
  managers?: Record<string, {
    /**
     * Whether this manager is enabled
     */
    enabled: boolean;

    /**
     * Additional manager-specific configuration
     */
    [key: string]: any;
  }>;
  
  /**
   * Any other configuration properties
   */
  [key: string]: any;
}

/**
 * Base agent options interface
 */
export interface BaseAgentOptions {
  /**
   * Agent configuration
   */
  config: BaseAgentConfig;
  
  /**
   * Agent capability level
   */
  capabilityLevel?: AgentCapabilityLevel;
  
  /**
   * Tool permissions
   */
  toolPermissions?: string[];
}

/**
 * Base manager interface definition
 */
export interface BaseManagerInterface {
  /**
   * Initialize the manager
   */
  initialize(): Promise<boolean>;
  
  /**
   * Shutdown the manager
   */
  shutdown(): Promise<void>;
  
  /**
   * Get manager status
   */
  getStatus(): any;
}

/**
 * Memory manager interface definition
 */
export interface MemoryManagerInterface extends BaseManagerInterface {
  /**
   * Add memory
   */
  addMemory(content: string, metadata?: any): Promise<any>;
  
  /**
   * Search memories
   */
  searchMemories(query: string, options?: any): Promise<any[]>;
  
  /**
   * Get recent memories
   */
  getRecentMemories(limit?: number): Promise<any[]>;
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