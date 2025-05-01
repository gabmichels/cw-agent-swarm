/**
 * AgentBase.ts - Core base class for all agents in the system
 * 
 * This base class provides common functionality that all agents share:
 * - Memory management with agent-scoped access
 * - Tool management with permissions
 * - Planning and execution capabilities
 * - Agent coordination for delegation
 */

import { ChatOpenAI } from '@langchain/openai';
import { AgentMemory } from '../../../lib/memory';
import { BaseTool } from '../../../lib/shared/types/agentTypes';
import { AgentMonitor } from '../monitoring/AgentMonitor';

// Basic agent configuration
export interface AgentBaseConfig {
  agentId: string;
  name?: string; 
  description?: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

// Agent capability levels
export enum AgentCapabilityLevel {
  BASIC = 'basic',
  STANDARD = 'standard',
  ADVANCED = 'advanced',
  COORDINATOR = 'coordinator'
}

// Agent options for initialization
export interface AgentBaseOptions {
  config: AgentBaseConfig;
  capabilityLevel?: AgentCapabilityLevel;
  toolPermissions?: string[];
  memoryScopes?: string[];
}

/**
 * Base class for all agents in the system
 */
export class AgentBase {
  protected agentId: string;
  protected config: AgentBaseConfig;
  protected capabilityLevel: AgentCapabilityLevel;
  protected model: ChatOpenAI | null = null;
  protected memory: AgentMemory | null = null;
  protected toolPermissions: string[] = [];
  protected memoryScopes: string[] = [];
  protected initialized: boolean = false;

  constructor(options: AgentBaseOptions) {
    if (!options.config.agentId) {
      throw new Error('Agent ID is required');
    }
    
    this.agentId = options.config.agentId;
    this.config = {
      name: this.agentId,
      description: `Agent ${this.agentId}`,
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 4000,
      ...options.config
    };
    
    this.capabilityLevel = options.capabilityLevel || AgentCapabilityLevel.BASIC;
    this.toolPermissions = options.toolPermissions || [];
    this.memoryScopes = options.memoryScopes || [];
  }

  /**
   * Initialize the agent with necessary services
   */
  async initialize(): Promise<void> {
    const startTime = Date.now();
    try {
      console.log(`Initializing agent ${this.agentId}...`);
      
      // Log initialization start
      AgentMonitor.log({
        agentId: this.agentId,
        taskId: `init_${this.agentId}`,
        eventType: 'task_start',
        timestamp: startTime,
        metadata: {
          capabilityLevel: this.capabilityLevel,
          toolPermissionsCount: this.toolPermissions.length
        }
      });
      
      // Initialize model
      this.model = new ChatOpenAI({
        modelName: this.config.model,
        temperature: this.config.temperature || 0.7,
      });
      
      // Other initialization logic will be added here
      
      this.initialized = true;
      console.log(`Agent ${this.agentId} initialized successfully`);
      
      // Log initialization success
      AgentMonitor.log({
        agentId: this.agentId,
        taskId: `init_${this.agentId}`,
        eventType: 'task_end',
        status: 'success',
        timestamp: Date.now(),
        durationMs: Date.now() - startTime
      });
    } catch (error) {
      console.error(`Error initializing agent ${this.agentId}:`, error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Log initialization error
      AgentMonitor.log({
        agentId: this.agentId,
        taskId: `init_${this.agentId}`,
        eventType: 'error',
        status: 'failure',
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
        errorMessage
      });
      
      throw error;
    }
  }

  /**
   * Get agent ID
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Check if agent is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Process a message or task
   * This will be implemented by specific agent subclasses
   */
  async processMessage(message: string, options?: any): Promise<string> {
    const startTime = Date.now();
    const taskId = `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Log message processing start
    AgentMonitor.log({
      agentId: this.agentId,
      taskId,
      taskType: 'message',
      eventType: 'task_start',
      timestamp: startTime,
      metadata: { 
        messageLength: message.length,
        options 
      }
    });
    
    try {
      throw new Error('Method not implemented in base class');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Log error
      AgentMonitor.log({
        agentId: this.agentId,
        taskId,
        taskType: 'message',
        eventType: 'error',
        status: 'failure',
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
        errorMessage
      });
      
      throw error;
    }
  }

  /**
   * Plan and execute a task
   * This will be implemented by specific agent subclasses
   */
  async planAndExecute(goal: string, options?: any): Promise<any> {
    const startTime = Date.now();
    const taskId = `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Log task planning start
    AgentMonitor.log({
      agentId: this.agentId,
      taskId,
      taskType: 'planning',
      eventType: 'task_start',
      timestamp: startTime,
      metadata: { 
        goal,
        options 
      }
    });
    
    try {
      throw new Error('Method not implemented in base class');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Log error
      AgentMonitor.log({
        agentId: this.agentId,
        taskId,
        taskType: 'planning',
        eventType: 'error',
        status: 'failure',
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
        errorMessage
      });
      
      throw error;
    }
  }

  /**
   * Get available tools for this agent based on permissions
   */
  async getAvailableTools(): Promise<BaseTool[]> {
    // This will be implemented to return only tools this agent has permission to use
    return [];
  }

  /**
   * Check if agent has permission to use a specific tool
   */
  hasToolPermission(toolName: string): boolean {
    return this.toolPermissions.includes(toolName);
  }

  /**
   * Get agent's capability level
   */
  getCapabilityLevel(): AgentCapabilityLevel {
    return this.capabilityLevel;
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`Shutting down agent ${this.agentId}...`);
      // Cleanup logic will be added here
      
      // Log shutdown success
      AgentMonitor.log({
        agentId: this.agentId,
        taskId: `shutdown_${this.agentId}`,
        eventType: 'task_end',
        status: 'success',
        timestamp: Date.now(),
        durationMs: Date.now() - startTime
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Log shutdown error
      AgentMonitor.log({
        agentId: this.agentId,
        taskId: `shutdown_${this.agentId}`,
        eventType: 'error',
        status: 'failure',
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
        errorMessage
      });
      
      // Still want to log the error but not throw during shutdown
      console.error(`Error during agent ${this.agentId} shutdown:`, error);
    }
  }

  /**
   * Delegate a task to another agent
   * This will be implemented by specific agent subclasses that support delegation
   */
  async delegateTask(
    targetAgentId: string, 
    taskDescription: string, 
    options?: any
  ): Promise<any> {
    const startTime = Date.now();
    const delegationId = `delegation_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const currentTaskId = options?.parentTaskId || `task_${this.agentId}_${Date.now()}`;
    
    // Log delegation start
    AgentMonitor.log({
      agentId: this.agentId,
      taskId: currentTaskId,
      eventType: 'delegation',
      timestamp: startTime,
      delegationContextId: delegationId,
      metadata: { 
        targetAgentId,
        taskDescription: taskDescription.substring(0, 100),
        options
      }
    });
    
    try {
      // In a real implementation, would find and call the target agent
      console.log(`[${this.agentId}] Delegating task to ${targetAgentId}: ${taskDescription}`);
      
      // Prepare delegation context that includes parent task information
      const delegationContext = {
        parentTaskId: currentTaskId,
        delegationContextId: delegationId,
        delegatingAgentId: this.agentId,
        ...options
      };
      
      // This would be implemented in subclasses or through an agent registry
      // For now, just simulate successful delegation
      const result = {
        success: true,
        message: `Simulated delegation to ${targetAgentId}`,
        data: { delegated: true, taskId: `task_${targetAgentId}_${Date.now()}` }
      };
      
      // Log delegation success
      AgentMonitor.log({
        agentId: this.agentId,
        taskId: currentTaskId,
        eventType: 'delegation',
        status: 'success',
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
        delegationContextId: delegationId,
        metadata: { 
          result: JSON.stringify(result).substring(0, 100)
        }
      });
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Log delegation error
      AgentMonitor.log({
        agentId: this.agentId,
        taskId: currentTaskId,
        eventType: 'delegation',
        status: 'failure',
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
        errorMessage,
        delegationContextId: delegationId
      });
      
      // Re-throw the error or return a failure result
      throw error;
    }
  }

  /**
   * Process a delegated task from another agent
   * This will be implemented by specific agent subclasses that support delegation
   */
  async processDelegatedTask(
    taskDescription: string, 
    delegationContext: {
      parentTaskId: string;
      delegationContextId: string;
      delegatingAgentId: string;
    }
  ): Promise<any> {
    const startTime = Date.now();
    const taskId = `delegated_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Log delegated task start
    AgentMonitor.log({
      agentId: this.agentId,
      taskId,
      taskType: 'delegated_task',
      eventType: 'task_start',
      timestamp: startTime,
      parentTaskId: delegationContext.parentTaskId,
      delegationContextId: delegationContext.delegationContextId,
      tags: [`from:${delegationContext.delegatingAgentId}`],
      metadata: { 
        taskDescription: taskDescription.substring(0, 100),
        delegatingAgentId: delegationContext.delegatingAgentId
      }
    });
    
    try {
      // This would be implemented in subclasses
      console.log(`[${this.agentId}] Processing delegated task from ${delegationContext.delegatingAgentId}`);
      
      // For now, just simulate successful processing
      const result = {
        success: true,
        message: `Simulated processing of delegated task by ${this.agentId}`,
        data: { processed: true }
      };
      
      // Log delegated task success
      AgentMonitor.log({
        agentId: this.agentId,
        taskId,
        taskType: 'delegated_task',
        eventType: 'task_end',
        status: 'success',
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
        parentTaskId: delegationContext.parentTaskId,
        delegationContextId: delegationContext.delegationContextId,
        tags: [`from:${delegationContext.delegatingAgentId}`],
        metadata: { 
          result: JSON.stringify(result).substring(0, 100)
        }
      });
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Log delegated task error
      AgentMonitor.log({
        agentId: this.agentId,
        taskId,
        taskType: 'delegated_task',
        eventType: 'error',
        status: 'failure',
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
        errorMessage,
        parentTaskId: delegationContext.parentTaskId,
        delegationContextId: delegationContext.delegationContextId,
        tags: [`from:${delegationContext.delegatingAgentId}`]
      });
      
      // Re-throw the error or return a failure result
      throw error;
    }
  }
} 