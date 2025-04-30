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
    try {
      console.log(`Initializing agent ${this.agentId}...`);
      
      // Initialize model
      this.model = new ChatOpenAI({
        modelName: this.config.model,
        temperature: this.config.temperature || 0.7,
      });
      
      // Other initialization logic will be added here
      
      this.initialized = true;
      console.log(`Agent ${this.agentId} initialized successfully`);
    } catch (error) {
      console.error(`Error initializing agent ${this.agentId}:`, error);
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
    throw new Error('Method not implemented in base class');
  }

  /**
   * Plan and execute a task
   * This will be implemented by specific agent subclasses
   */
  async planAndExecute(goal: string, options?: any): Promise<any> {
    throw new Error('Method not implemented in base class');
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
    console.log(`Shutting down agent ${this.agentId}...`);
    // Cleanup logic will be added here
  }
} 