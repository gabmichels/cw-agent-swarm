/**
 * AgentBase.ts - Core base class for all agents in the system
 * 
 * This base class provides common functionality that all agents share:
 * - Memory management with agent-scoped access
 * - Tool management with permissions
 * - Planning and execution capabilities
 * - Agent coordination for delegation
 * - Inter-agent messaging
 */

import { ChatOpenAI } from '@langchain/openai';
import { AgentMemory } from '../../../lib/memory';
import { BaseTool } from '../../../lib/shared/types/agentTypes';
import { AgentMonitor } from '../monitoring/AgentMonitor';
import { AgentMessage, MessageRouter, MessageType } from '../messaging/MessageRouter';

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
  protected messageInbox: AgentMessage[] = [];

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
      
      // Register message handler
      this.registerMessageHandler();
      
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
   * Register this agent's message handler
   */
  protected registerMessageHandler(): void {
    MessageRouter.registerHandler(this.agentId, async (message: AgentMessage) => {
      await this.handleMessage(message);
    });
  }

  /**
   * Handle an incoming message
   */
  protected async handleMessage(message: AgentMessage): Promise<void> {
    // Store message in inbox
    this.messageInbox.push(message);
    
    console.log(`[${this.agentId}] Received message of type '${message.type}' from ${message.fromAgentId}`);
    
    // Dispatch based on message type
    switch (message.type) {
      case 'update':
        // Store in memory/knowledge base
        if (this.memory) {
          await this.storeMessageInMemory(message);
        }
        break;
        
      case 'handoff':
        // Execute a task based on the message
        await this.handleTaskHandoff(message);
        break;
        
      case 'ask':
        // Generate a response to a question
        await this.handleQuestion(message);
        break;
        
      case 'log':
        // Just log the message, no response needed
        console.log(`[${this.agentId}] Log message: ${JSON.stringify(message.payload)}`);
        break;
        
      case 'result':
        // Process a result from another agent
        await this.processResult(message);
        break;
        
      default:
        console.warn(`[${this.agentId}] Unhandled message type: ${message.type}`);
    }
  }

  /**
   * Store a message in agent memory
   */
  protected async storeMessageInMemory(message: AgentMessage): Promise<void> {
    if (!this.memory) return;
    
    // This is a simplified example - actual memory storage would depend on memory implementation
    const memoryItem = {
      type: 'message',
      source: message.fromAgentId,
      content: message.payload,
      timestamp: message.timestamp,
      tags: ['message', message.fromAgentId, message.type]
    };
    
    // Store in memory (assuming a log method exists)
    console.log(`[${this.agentId}] Storing message in memory: ${JSON.stringify(memoryItem)}`);
  }

  /**
   * Handle a task handoff message
   */
  protected async handleTaskHandoff(message: AgentMessage): Promise<void> {
    try {
      // Extract task details from message payload
      const { taskId, goal, context } = message.payload;
      
      console.log(`[${this.agentId}] Handling task handoff: ${taskId}`);
      
      // Create context with delegation tracking
      const taskContext = {
        ...context,
        delegationContextId: message.delegationContextId,
        parentTaskId: message.correlationId,
        originAgentId: message.metadata?.originAgentId || message.fromAgentId,
        handoffFromAgent: message.fromAgentId
      };
      
      // Plan and execute the task
      const result = await this.planAndExecute(goal, taskContext);
      
      // Send response back to the sender
      await MessageRouter.sendResponse(message, {
        taskId,
        status: 'completed',
        result
      });
    } catch (error) {
      console.error(`[${this.agentId}] Error handling task handoff:`, error);
      
      // Send error response
      await MessageRouter.sendResponse(message, {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handle a question message
   */
  protected async handleQuestion(message: AgentMessage): Promise<void> {
    try {
      // Extract question from payload
      const { question } = message.payload;
      
      console.log(`[${this.agentId}] Answering question: ${question}`);
      
      // This would typically use the LLM to generate a response
      // For now, just echo back a placeholder response
      const answer = `Placeholder answer to: ${question}`;
      
      // Send response back to the sender
      await MessageRouter.sendResponse(message, {
        answer,
        confidence: 0.8
      });
    } catch (error) {
      console.error(`[${this.agentId}] Error answering question:`, error);
      
      // Send error response
      await MessageRouter.sendResponse(message, {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Process a result message
   */
  protected async processResult(message: AgentMessage): Promise<void> {
    // This would typically integrate the result into ongoing work
    console.log(`[${this.agentId}] Processing result from ${message.fromAgentId}: ${JSON.stringify(message.payload)}`);
  }

  /**
   * Send a message to another agent
   */
  async sendMessage(
    toAgentId: string,
    type: MessageType,
    payload: any,
    options: {
      correlationId?: string,
      delegationContextId?: string,
      metadata?: Record<string, any>
    } = {}
  ): Promise<void> {
    await MessageRouter.sendMessage({
      fromAgentId: this.agentId,
      toAgentId,
      type,
      payload,
      timestamp: Date.now(),
      correlationId: options.correlationId,
      delegationContextId: options.delegationContextId,
      metadata: options.metadata
    });
  }

  /**
   * Ask a question to another agent
   */
  async askQuestion(
    toAgentId: string,
    question: string,
    context?: any,
    delegationContextId?: string
  ): Promise<any> {
    const correlationId = `ask_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    
    // Send the question as a message
    await this.sendMessage(toAgentId, 'ask', { question, context }, {
      correlationId,
      delegationContextId
    });
    
    // In a real implementation, would wait for response
    // This would typically use a promise and callback registration
    // For now, just return a placeholder
    return {
      status: 'sent',
      correlationId,
      note: 'Response would be processed asynchronously in a real implementation'
    };
  }

  /**
   * Get unread messages from the inbox
   */
  getMessages(options: {
    unreadOnly?: boolean,
    fromAgent?: string,
    messageType?: MessageType,
    limit?: number
  } = {}): AgentMessage[] {
    let messages = [...this.messageInbox];
    
    // Filter by sender if specified
    if (options.fromAgent) {
      messages = messages.filter(msg => msg.fromAgentId === options.fromAgent);
    }
    
    // Filter by message type if specified
    if (options.messageType) {
      messages = messages.filter(msg => msg.type === options.messageType);
    }
    
    // Limit results if specified
    if (options.limit && options.limit > 0) {
      messages = messages.slice(0, options.limit);
    }
    
    return messages;
  }

  /**
   * Clear the message inbox
   */
  clearInbox(): void {
    this.messageInbox = [];
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