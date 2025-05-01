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
} 