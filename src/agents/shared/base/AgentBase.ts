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
import { MemoryPruner } from '../../../lib/memory/src/MemoryPruner';
import { MemoryConsolidator } from '../../../lib/memory/src/MemoryConsolidator';
import { MemoryInjector } from '../../../lib/memory/src/MemoryInjector';
import { MemoryScope, MemoryKind, MemoryEntry } from '../../../lib/memory/src/memory';
import { BaseTool } from '../../../lib/shared/types/agentTypes';
import { AgentMonitor } from '../monitoring/AgentMonitor';
import { AgentMessage, MessageRouter, MessageType } from '../messaging/MessageRouter';
import { Planner, PlanningContext, Plan } from '../planning/Planner';
import { AgentHealthChecker } from '../coordination/AgentHealthChecker';
import { CapabilityRegistry, CapabilityLevel, CapabilityType, Capability } from '../coordination/CapabilityRegistry';

// Extend MessageType to include 'command' type
type ExtendedMessageType = MessageType | 'command';

// Extended agent message interface to include id
interface ExtendedAgentMessage extends AgentMessage {
  id?: string;
}

// Basic agent configuration
export interface AgentBaseConfig {
  agentId: string;
  name?: string; 
  description?: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  quota?: number; // Maximum concurrent tasks the agent can handle
  capabilities?: { // Agent capabilities configuration
    skills?: Record<string, CapabilityLevel>;
    domains?: string[];
    roles?: string[];
  };
  memoryOptions?: {
    enableAutoPruning?: boolean;
    pruningIntervalMs?: number;
    maxShortTermEntries?: number;
    relevanceThreshold?: number;
    enableAutoConsolidation?: boolean;
    consolidationIntervalMs?: number;
    minMemoriesForConsolidation?: number;
    forgetSourceMemoriesAfterConsolidation?: boolean;
    enableMemoryInjection?: boolean;
    maxInjectedMemories?: number;
  };
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
  memoryScopes?: MemoryScope[];
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
  protected memoryScopes: MemoryScope[] = ['shortTerm', 'longTerm', 'inbox', 'reflections'];
  protected initialized: boolean = false;
  protected messageInbox: ExtendedAgentMessage[] = [];
  protected memoryPruningTimer: NodeJS.Timeout | null = null;
  protected memoryConsolidationTimer: NodeJS.Timeout | null = null;
  protected quota: number;
  protected capabilities: Record<string, CapabilityLevel> = {};
  protected domains: string[] = [];
  protected roles: string[] = [];
  protected capabilityRegistry: CapabilityRegistry;

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
      quota: 5, // Default to 5 concurrent tasks
      capabilities: {
        skills: {},
        domains: [],
        roles: []
      },
      memoryOptions: {
        enableAutoPruning: true,
        pruningIntervalMs: 300000, // 5 minutes
        maxShortTermEntries: 100,
        relevanceThreshold: 0.2,
        enableAutoConsolidation: true,
        consolidationIntervalMs: 600000, // 10 minutes
        minMemoriesForConsolidation: 5,
        forgetSourceMemoriesAfterConsolidation: false,
        enableMemoryInjection: true,
        maxInjectedMemories: 5
      },
      ...options.config
    };
    
    this.capabilityLevel = options.capabilityLevel || AgentCapabilityLevel.BASIC;
    this.toolPermissions = options.toolPermissions || [];
    this.memoryScopes = options.memoryScopes || this.memoryScopes;
    this.quota = this.config.quota || 5;
    
    // Set up capabilities
    if (this.config.capabilities) {
      this.capabilities = this.config.capabilities.skills || {};
      this.domains = this.config.capabilities.domains || [];
      this.roles = this.config.capabilities.roles || [];
    }
    
    // Get capability registry
    this.capabilityRegistry = CapabilityRegistry.getInstance();
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
          toolPermissionsCount: this.toolPermissions.length,
          quota: this.quota
        }
      });
      
      // Register with health checker
      AgentHealthChecker.register(this.agentId, this.quota);
      
      // Register agent capabilities
      this.registerCapabilities();
      
      // Initialize model
      this.model = new ChatOpenAI({
        modelName: this.config.model,
        temperature: this.config.temperature || 0.7,
      });
      
      // Initialize memory
      this.memory = new AgentMemory({ namespace: this.agentId });
      
      // Setup memory pruning if enabled
      if (this.config.memoryOptions?.enableAutoPruning) {
        this.setupMemoryPruning();
      }
      
      // Setup memory consolidation if enabled
      if (this.config.memoryOptions?.enableAutoConsolidation) {
        this.setupMemoryConsolidation();
      }
      
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
   * Register the agent's capabilities with the capability registry
   */
  protected registerCapabilities(): void {
    // Register capabilities with the registry
    this.capabilityRegistry.registerAgentCapabilities(
      this.agentId,
      this.capabilities,
      {
        preferredDomains: this.domains,
        primaryRoles: this.roles
      }
    );
    
    console.log(`Registered ${Object.keys(this.capabilities).length} capabilities for agent ${this.agentId}`);
  }
  
  /**
   * Declare a new capability for this agent
   */
  declareCapability(
    capabilityId: string, 
    level: CapabilityLevel = CapabilityLevel.INTERMEDIATE
  ): void {
    // Add to agent's capabilities
    this.capabilities[capabilityId] = level;
    
    // Update in registry
    this.capabilityRegistry.registerAgentCapabilities(
      this.agentId,
      { [capabilityId]: level },
      {
        preferredDomains: this.domains,
        primaryRoles: this.roles
      }
    );
    
    console.log(`Declared capability ${capabilityId} at level ${level} for agent ${this.agentId}`);
  }
  
  /**
   * Add a domain of expertise for this agent
   */
  addDomain(domain: string): void {
    if (!this.domains.includes(domain)) {
      this.domains.push(domain);
      
      // Update in registry
      this.capabilityRegistry.registerAgentCapabilities(
        this.agentId,
        this.capabilities,
        {
          preferredDomains: this.domains,
          primaryRoles: this.roles
        }
      );
      
      console.log(`Added domain ${domain} for agent ${this.agentId}`);
    }
  }
  
  /**
   * Add a role for this agent
   */
  addRole(role: string): void {
    if (!this.roles.includes(role)) {
      this.roles.push(role);
      
      // Update in registry
      this.capabilityRegistry.registerAgentCapabilities(
        this.agentId,
        this.capabilities,
        {
          preferredDomains: this.domains,
          primaryRoles: this.roles
        }
      );
      
      console.log(`Added role ${role} for agent ${this.agentId}`);
    }
  }
  
  /**
   * Check if agent has a specific capability
   */
  hasAgentCapability(capabilityId: string): boolean {
    return capabilityId in this.capabilities;
  }
  
  /**
   * Get agent's capability level for a specific capability
   */
  getSpecificCapabilityLevel(capabilityId: string): CapabilityLevel | null {
    return this.capabilities[capabilityId] || null;
  }
  
  /**
   * Check if agent specializes in a domain
   */
  specializesInDomain(domain: string): boolean {
    return this.domains.includes(domain);
  }
  
  /**
   * Check if agent has a specific role
   */
  hasRole(role: string): boolean {
    return this.roles.includes(role);
  }
  
  /**
   * Get all agent capabilities
   */
  getCapabilities(): Record<string, CapabilityLevel> {
    return { ...this.capabilities };
  }
  
  /**
   * Get all agent domains
   */
  getDomains(): string[] {
    return [...this.domains];
  }
  
  /**
   * Get all agent roles
   */
  getRoles(): string[] {
    return [...this.roles];
  }

  /**
   * Set up automatic memory pruning
   */
  protected setupMemoryPruning(): void {
    const options = this.config.memoryOptions;
    
    if (!options) return;
    
    this.memoryPruningTimer = MemoryPruner.scheduleAutoPrune(
      this.agentId,
      options.pruningIntervalMs,
      {
        relevanceThreshold: options.relevanceThreshold,
        maxShortTermEntries: options.maxShortTermEntries
      }
    );
    
    console.log(`Set up automatic memory pruning for agent ${this.agentId}`);
  }

  /**
   * Set up automatic memory consolidation
   */
  protected setupMemoryConsolidation(): void {
    const options = this.config.memoryOptions;
    
    if (!options) return;
    
    this.memoryConsolidationTimer = MemoryConsolidator.scheduleAutoConsolidate(
      this.agentId,
      options.consolidationIntervalMs,
      {
        minMemories: options.minMemoriesForConsolidation,
        relevanceThreshold: options.relevanceThreshold,
        forgetSourceMemories: options.forgetSourceMemoriesAfterConsolidation
      }
    );
    
    console.log(`Set up automatic memory consolidation for agent ${this.agentId}`);
  }

  /**
   * Manually trigger memory pruning
   */
  async pruneMemory(): Promise<void> {
    if (!this.memory) return;
    
    const result = await MemoryPruner.prune(this.agentId, {
      relevanceThreshold: this.config.memoryOptions?.relevanceThreshold,
      maxShortTermEntries: this.config.memoryOptions?.maxShortTermEntries
    });
    
    console.log(`Pruned ${result.pruned} memories for agent ${this.agentId}, ${result.retained} remaining`);
  }

  /**
   * Manually trigger memory consolidation
   */
  async consolidateMemory(options: {
    targetScope?: MemoryScope;
    filterTags?: string[];
    contextId?: string;
  } = {}): Promise<void> {
    if (!this.memory) return;
    
    const result = await MemoryConsolidator.consolidate(this.agentId, {
      targetScope: options.targetScope,
      filterTags: options.filterTags,
      contextId: options.contextId,
      forgetSourceMemories: this.config.memoryOptions?.forgetSourceMemoriesAfterConsolidation
    });
    
    if (result) {
      console.log(`Consolidated memories for agent ${this.agentId}, created entry: ${result.id}`);
    } else {
      console.log(`No memory consolidation performed for agent ${this.agentId}`);
    }
  }

  /**
   * Register this agent's message handler
   */
  protected registerMessageHandler(): void {
    MessageRouter.registerHandler(this.agentId, async (message: AgentMessage) => {
      await this.handleMessage(message as ExtendedAgentMessage);
    });
  }

  /**
   * Handle an incoming message
   */
  protected async handleMessage(message: ExtendedAgentMessage): Promise<void> {
    // Store message in inbox
    this.messageInbox.push(message);
    
    console.log(`[${this.agentId}] Received message of type '${message.type}' from ${message.fromAgentId}`);
    
    // Handle pruneNow command (using type assertion since we're extending the type)
    if ((message.type as ExtendedMessageType) === 'command' && message.payload?.command === 'pruneNow') {
      await this.pruneMemory();
      await this.sendMessage(message.fromAgentId, 'result' as MessageType, { 
        success: true, 
        message: 'Memory pruning completed' 
      }, { 
        correlationId: message.correlationId
      });
      return;
    }
    
    // Handle consolidateNow command
    if ((message.type as ExtendedMessageType) === 'command' && message.payload?.command === 'consolidateNow') {
      await this.consolidateMemory(message.payload?.options || {});
      await this.sendMessage(message.fromAgentId, 'result' as MessageType, { 
        success: true, 
        message: 'Memory consolidation completed' 
      }, { 
        correlationId: message.correlationId
      });
      return;
    }
    
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
  protected async storeMessageInMemory(message: ExtendedAgentMessage): Promise<void> {
    if (!this.memory) return;
    
    // Determine appropriate scope based on message type
    let scope: MemoryScope = 'shortTerm';
    
    if (message.metadata?.importance === 'high' || message.metadata?.permanent) {
      scope = 'longTerm';
    } else if (message.type === 'result' || message.type === 'update') {
      scope = 'inbox';
    } else if (message.metadata?.isReflection) {
      scope = 'reflections';
    }
    
    // Determine appropriate kind based on message type
    let kind: MemoryKind | undefined = undefined;
    
    if (message.metadata?.kind) {
      kind = message.metadata.kind as MemoryKind;
    } else if (message.type === 'update') {
      kind = 'fact';
    } else if (message.type === 'result') {
      kind = 'feedback';
    } else if (message.metadata?.isDecision) {
      kind = 'decision';
    } else if (message.type === 'ask' || message.type === 'handoff') {
      kind = 'task';
    } else {
      kind = 'message';
    }
    
    // Calculate relevance if not provided (simple example)
    const relevance = message.metadata?.relevance || 
      (message.metadata?.importance === 'high' ? 0.9 : 0.5);
    
    // Determine expiration for short-term memory
    const expiresAt = scope === 'shortTerm' ? 
      Date.now() + (24 * 60 * 60 * 1000) : // 24 hours
      undefined;
    
    // Store in memory
    await this.memory.write({
      content: typeof message.payload === 'string' ? 
        message.payload : 
        JSON.stringify(message.payload),
      scope,
      kind,
      timestamp: message.timestamp || Date.now(),
      relevance,
      expiresAt,
      sourceAgent: message.fromAgentId,
      contextId: message.delegationContextId || message.correlationId,
      tags: message.metadata?.tags || []
    });
  }

  /**
   * Plan a task with memory context injection
   */
  async planTask({
    goal,
    tags = [],
    delegationContextId,
    additionalContext = {}
  }: {
    goal: string;
    tags?: string[];
    delegationContextId?: string;
    additionalContext?: Record<string, any>;
  }): Promise<Plan> {
    console.log(`[${this.agentId}] Planning task: ${goal}`);
    
    let memoryContext: MemoryEntry[] = [];
    
    // Inject memory context if enabled
    if (this.config.memoryOptions?.enableMemoryInjection) {
      try {
        memoryContext = await MemoryInjector.getRelevantContext({
          agentId: this.agentId,
          goal,
          tags,
          delegationContextId,
          options: {
            maxContextEntries: this.config.memoryOptions.maxInjectedMemories
          }
        });
        
        console.log(`[${this.agentId}] Injected ${memoryContext.length} memories for planning`);
      } catch (error) {
        console.error(`[${this.agentId}] Error injecting memory for planning:`, error);
        // Continue with empty context
      }
    }
    
    // Create planning context
    const planningContext: PlanningContext = {
      goal,
      tags,
      agentId: this.agentId,
      delegationContextId,
      memoryContext,
      additionalContext
    };
    
    // Generate plan
    const plan = await Planner.plan(planningContext);
    
    // Store plan in memory as 'decision'
    if (this.memory) {
      const planSummary = `Created plan for "${goal}" with ${plan.steps.length} steps.`;
      
      await this.memory.write({
        content: planSummary,
        scope: 'shortTerm',
        kind: 'decision',
        timestamp: Date.now(),
        relevance: 0.8,
        contextId: delegationContextId,
        tags: [...tags, 'plan', 'decision']
      });
    }
    
    return plan;
  }

  /**
   * Execute a plan
   */
  async executePlan(plan: Plan): Promise<{ success: boolean; results: any[] }> {
    console.log(`[${this.agentId}] Executing plan: ${plan.title}`);
    
    // Execute the plan
    const result = await Planner.executePlan(plan);
    
    // After execution, consolidate the memories related to this task
    if (plan.context.delegationContextId) {
      await this.consolidateMemory({ 
        contextId: plan.context.delegationContextId,
        targetScope: 'reflections'
      });
    }
    
    return result;
  }

  /**
   * Handle a task handoff message
   */
  protected async handleTaskHandoff(message: ExtendedAgentMessage): Promise<void> {
    try {
      // Extract task details from message payload
      const { taskId, goal, context, tags } = message.payload;
      
      console.log(`[${this.agentId}] Handling task handoff: ${taskId}`);
      
      // Create context with delegation tracking
      const delegationContextId = message.delegationContextId || `task_${Date.now()}`;
      
      // Plan the task with memory context injection
      const plan = await this.planTask({
        goal,
        tags: tags || [],
        delegationContextId,
        additionalContext: {
          ...context,
          parentTaskId: message.correlationId,
          originAgentId: message.metadata?.originAgentId || message.fromAgentId,
          handoffFromAgent: message.fromAgentId
        }
      });
      
      // Execute the plan
      const result = await this.executePlan(plan);
      
      // Send response back to the sender
      await MessageRouter.sendResponse(message, {
        taskId,
        status: result.success ? 'completed' : 'failed',
        result: result.results
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
  protected async handleQuestion(message: ExtendedAgentMessage): Promise<void> {
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
  protected async processResult(message: ExtendedAgentMessage): Promise<void> {
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
   * Process a message to generate a response
   * This is a high-level method that should be implemented by specific agent subclasses
   */
  async processMessage(message: string, options?: any): Promise<string> {
    if (!this.initialized) {
      throw new Error(`Agent ${this.agentId} not initialized`);
    }
    
    // Check if agent is available based on health and quota
    if (!AgentHealthChecker.isAvailable(this.agentId)) {
      const status = AgentHealthChecker.getStatus(this.agentId);
      if (!status?.healthy) {
        throw new Error(`Agent ${this.agentId} is unhealthy and cannot process messages`);
      } else {
        throw new Error(`Agent ${this.agentId} at quota limit (${status?.currentLoad}/${status?.quota})`);
      }
    }
    
    // Begin task tracking in health checker
    AgentHealthChecker.beginTask(this.agentId);
    
    try {
      const startTime = Date.now();
      const taskId = `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      // Log message processing start
      AgentMonitor.log({
        agentId: this.agentId,
        taskId,
        taskType: 'message',
        eventType: 'task_start',
        timestamp: startTime,
        metadata: { messageLength: message.length }
      });
      
      // Default implementation that real agents should override
      console.log(`Agent ${this.agentId} processing message: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
      
      // Store message in memory if available
      if (this.memory) {
        await this.memory.write({
          content: message,
          kind: 'user_message' as MemoryKind,
          scope: 'shortTerm',
          relevance: 0.8,
          timestamp: Date.now()
        });
      }
      
      // Generate a simple response (in real agents, this would use LLMs, tools, etc.)
      const response = `Agent ${this.agentId} received your message (${message.length} chars)`;
      
      // Log message processing completion
      AgentMonitor.log({
        agentId: this.agentId,
        taskId,
        taskType: 'message',
        eventType: 'task_end',
        status: 'success',
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
        metadata: { responseLength: response.length }
      });
      
      // Report task success
      AgentHealthChecker.reportSuccess(this.agentId);
      
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error in ${this.agentId} processMessage:`, error);
      
      // Report task failure
      AgentHealthChecker.reportFailure(this.agentId, errorMessage);
      
      throw error;
    }
  }

  /**
   * Plan and execute a task with a given goal
   * This is a high-level method that should be implemented by specific agent subclasses
   */
  async planAndExecute(goal: string, options?: any): Promise<any> {
    if (!this.initialized) {
      throw new Error(`Agent ${this.agentId} not initialized`);
    }
    
    // Check if agent is available based on health and quota
    if (!AgentHealthChecker.isAvailable(this.agentId)) {
      const status = AgentHealthChecker.getStatus(this.agentId);
      if (!status?.healthy) {
        throw new Error(`Agent ${this.agentId} is unhealthy and cannot execute tasks`);
      } else {
        throw new Error(`Agent ${this.agentId} at quota limit (${status?.currentLoad}/${status?.quota})`);
      }
    }
    
    // Begin task tracking in health checker
    AgentHealthChecker.beginTask(this.agentId);
    
    try {
      const startTime = Date.now();
      const taskId = `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      // Log task start
      AgentMonitor.log({
        agentId: this.agentId,
        taskId,
        taskType: 'plan_and_execute',
        eventType: 'task_start',
        timestamp: startTime,
        metadata: {
          goal,
          options: options ? JSON.stringify(options).substring(0, 100) : undefined
        }
      });
      
      console.log(`Agent ${this.agentId} planning and executing goal: ${goal}`);
      
      // In a real implementation, this method would:
      // 1. Plan the task using the Planner
      // 2. Execute the plan steps
      // 3. Handle errors and adapt as needed
      // For now, we just simulate a successful execution
      
      const result = {
        success: true,
        message: `Simulated execution of goal: ${goal}`,
        data: {
          // Would contain actual execution results
          executionTime: Date.now() - startTime
        }
      };
      
      // Log task completion
      AgentMonitor.log({
        agentId: this.agentId,
        taskId,
        taskType: 'plan_and_execute',
        eventType: 'task_end',
        status: 'success',
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
        metadata: {
          result: JSON.stringify(result).substring(0, 100)
        }
      });
      
      // Report task success
      AgentHealthChecker.reportSuccess(this.agentId);
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error in ${this.agentId} planAndExecute:`, error);
      
      // Report task failure
      AgentHealthChecker.reportFailure(this.agentId, errorMessage);
      
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
  getAgentCapabilityLevel(): AgentCapabilityLevel {
    return this.capabilityLevel;
  }

  /**
   * Get the agent's quota
   */
  getQuota(): number {
    return this.quota;
  }

  /**
   * Update the agent's quota
   */
  updateQuota(newQuota: number): void {
    this.quota = newQuota;
    AgentHealthChecker.updateQuota(this.agentId, newQuota);
    console.log(`Updated quota for agent ${this.agentId} to ${newQuota}`);
  }

  /**
   * Get the agent's current health status
   */
  getHealthStatus(): any {
    return AgentHealthChecker.getStatus(this.agentId);
  }

  /**
   * Reset the agent's health status
   */
  resetHealth(): void {
    AgentHealthChecker.resetHealthStatus(this.agentId);
    console.log(`Reset health status for agent ${this.agentId}`);
  }

  /**
   * Shutdown the agent
   */
  async shutdown(): Promise<void> {
    try {
      console.log(`Shutting down agent ${this.agentId}...`);
      
      // Reset agent state to ensure it's not taking new tasks
      if (AgentHealthChecker.getStatus(this.agentId)) {
        AgentHealthChecker.reportFailure(this.agentId, 'Agent shutting down');
      }
      
      // Cancel scheduled memory pruning
      if (this.memoryPruningTimer) {
        MemoryPruner.cancelAutoPrune(this.memoryPruningTimer);
        this.memoryPruningTimer = null;
      }
      
      // Cancel scheduled memory consolidation
      if (this.memoryConsolidationTimer) {
        MemoryConsolidator.cancelAutoConsolidate(this.memoryConsolidationTimer);
        this.memoryConsolidationTimer = null;
      }
      
      // Run final memory pruning and consolidation
      if (this.memory) {
        await this.pruneMemory();
        await this.consolidateMemory();
      }
      
      // Existing cleanup code...
      
      this.initialized = false;
      console.log(`Agent ${this.agentId} shutdown complete`);
    } catch (error) {
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

  /**
   * Post-task hook to check for ethics violations and record reflections
   * This is called after a task completes to enable agent self-improvement
   */
  async postTaskHook(taskId: string): Promise<void> {
    if (!this.memory || !this.initialized) {
      console.warn(`Cannot run postTaskHook for agent ${this.agentId}: Agent not fully initialized`);
      return;
    }

    // Get ethics violations for this task
    // Note: BiasAuditor logs ethics violations as 'error' events with metadata.type = 'ethics_violation'
    const ethicsViolations = AgentMonitor.getLogs({
      taskId,
      eventType: 'error',
      agentId: this.agentId
    }).filter(log => log.metadata?.type === 'ethics_violation');

    if (ethicsViolations.length > 0) {
      // Create a summary of violations
      const summary = ethicsViolations.map(v => {
        const severity = v.metadata?.severity || 'unknown';
        const description = v.metadata?.description || 'Unknown ethics violation';
        const ruleId = v.metadata?.ruleId || 'unknown';
        return `- [${severity}] ${description} (Rule: ${ruleId})`;
      }).join('\n');

      // Store a reflection entry in memory
      await this.memory.write({
        content: `⚖️ Ethical reflection on task ${taskId}:\n${summary}`,
        scope: 'reflections',
        kind: 'feedback',
        relevance: 0.8,
        timestamp: Date.now(),
        tags: ['ethics', 'violation', taskId],
      });

      console.log(`Agent ${this.agentId} created ethical reflection for task ${taskId} with ${ethicsViolations.length} violations`);
    }
  }
}
