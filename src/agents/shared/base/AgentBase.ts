/**
 * AgentBase.ts - Core base class for all agents in the system
 * 
 * This base class provides common functionality that all agents share:
 * - Memory management with agent-scoped access using standardized memory system
 * - Tool management with permissions
 * - Planning and execution capabilities
 * - Agent coordination for delegation
 * - Inter-agent messaging
 */

import { ChatOpenAI } from '@langchain/openai';
// Standardized memory system imports
import { getMemoryServices } from '../../../server/memory/services';
import { MemoryType } from '../../../server/memory/config';
import { BaseMemorySchema, MemoryPoint } from '../../../server/memory/models';
// Core agent types and systems
import { BaseTool } from '../../../lib/shared/types/agentTypes';
import { AgentMonitor } from '../monitoring/AgentMonitor';
import { AgentMessage, MessageRouter, MessageType } from '../messaging/MessageRouter';
import { Planner, PlanningContext, Plan } from '../planning/Planner';
import { AgentHealthChecker } from '../coordination/AgentHealthChecker';
import { CapabilityRegistry, CapabilityLevel, CapabilityType, Capability } from '../coordination/CapabilityRegistry';
// Imports for memory operations
import { 
  addMessageMemory, 
  addCognitiveProcessMemory, 
  addTaskMemory,
  addDocumentMemory
} from '../../../server/memory/services/memory/memory-service-wrappers';
import { 
  createThreadInfo,
  createMessageMetadata
} from '../../../server/memory/services/helpers/metadata-helpers';
import {
  createAgentId,
  createUserId,
  createChatId
} from '../../../types/structured-id';
import {
  CognitiveProcessType,
  TaskStatus,
  TaskPriority,
  DocumentSource
} from '../../../types/metadata';
import { MessageRole } from '../../chloe/types/state';

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
}

/**
 * Base class for all agents in the system
 */
export class AgentBase {
  protected agentId: string;
  protected config: AgentBaseConfig;
  protected capabilityLevel: AgentCapabilityLevel;
  protected model: ChatOpenAI | null = null;
  // Standardized memory services
  protected memoryService: any = null;
  protected searchService: any = null;
  protected toolPermissions: string[] = [];
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
      model: 'gpt-4o',
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
   * Initialize the agent
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }
    
    console.log(`Initializing agent: ${this.agentId}`);
    
    try {
      // Initialize LLM
      if (!this.model) {
        this.model = new ChatOpenAI({
          modelName: this.config.model || 'gpt-4o',
          temperature: this.config.temperature || 0,
          maxTokens: this.config.maxTokens || 4000,
          verbose: process.env.NODE_ENV === 'development'
        });
        console.log(`[${this.agentId}] Initialized LLM: ${this.config.model || 'gpt-4o'}`);
      }
      
      // Initialize memory services
      try {
        // Server-side only initialization for standardized memory services
        if (typeof window === 'undefined') {
          const services = await getMemoryServices();
          this.memoryService = services.memoryService;
          this.searchService = services.searchService;
          
          // Setup memory pruning if enabled
          if (this.config.memoryOptions?.enableAutoPruning) {
            this.setupMemoryPruning();
          }
          
          // Setup memory consolidation if enabled
          if (this.config.memoryOptions?.enableAutoConsolidation) {
            this.setupMemoryConsolidation();
          }
        }
      } catch (memoryError) {
        console.error(`[${this.agentId}] Error initializing memory services:`, memoryError);
        // Continue initialization without memory
      }
      
      // Register capabilities with registry if available
      if (this.capabilities && Object.keys(this.capabilities).length > 0) {
        try {
          const registry = await CapabilityRegistry.getInstance();
          
          // Register agent capabilities
          for (const [skill, level] of Object.entries(this.capabilities)) {
            await registry.registerCapability({
              id: `${this.agentId}-${skill}`,
              type: CapabilityType.SKILL,
              name: skill,
              level: level
            } as Capability);
          }
          
          // Register domains if any
          for (const domain of this.domains) {
            await registry.registerCapability({
              id: `${this.agentId}-domain-${domain}`,
              type: CapabilityType.DOMAIN,
              name: domain
            } as Capability);
          }
          
          // Register roles if any
          for (const role of this.roles) {
            await registry.registerCapability({
              id: `${this.agentId}-role-${role}`,
              type: CapabilityType.ROLE,
              name: role
            } as Capability);
          }
          
          console.log(`[${this.agentId}] Registered capabilities with registry`);
        } catch (registryError) {
          console.error(`[${this.agentId}] Error registering capabilities:`, registryError);
          // Continue initialization without capability registration
        }
      }
      
      this.initialized = true;
      console.log(`[${this.agentId}] Agent initialized successfully`);
      return true;
    } catch (error) {
      console.error(`[${this.agentId}] Error initializing agent:`, error);
      return false;
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
  private setupMemoryPruning(): void {
    if (!this.config.memoryOptions) return;
    
    const interval = this.config.memoryOptions.pruningIntervalMs || 3600000; // Default: 1 hour
    
    // Clear any existing timer
    if (this.memoryPruningTimer) {
      clearInterval(this.memoryPruningTimer);
    }
    
    // Set up new timer
    this.memoryPruningTimer = setInterval(() => {
      this.pruneMemory().catch(error => {
        console.error(`[${this.agentId}] Error during automatic memory pruning:`, error);
      });
    }, interval);
    
    console.log(`[${this.agentId}] Set up memory pruning with interval ${interval}ms`);
  }

  /**
   * Set up automatic memory consolidation
   */
  private setupMemoryConsolidation(): void {
    if (!this.config.memoryOptions) return;
    
    const interval = this.config.memoryOptions.consolidationIntervalMs || 7200000; // Default: 2 hours
    
    // Clear any existing timer
    if (this.memoryConsolidationTimer) {
      clearInterval(this.memoryConsolidationTimer);
    }
    
    // Set up new timer
    this.memoryConsolidationTimer = setInterval(() => {
      this.consolidateMemory().catch(error => {
        console.error(`[${this.agentId}] Error during automatic memory consolidation:`, error);
      });
    }, interval);
    
    console.log(`[${this.agentId}] Set up memory consolidation with interval ${interval}ms`);
  }
  
  /**
   * Prune agent's memory by removing low-relevance or outdated entries
   */
  async pruneMemory(): Promise<void> {
    if (!this.memoryService || !this.initialized) {
      console.warn(`Cannot prune memory for agent ${this.agentId}: Memory services not initialized`);
      return;
    }
    
    console.log(`[${this.agentId}] Running memory pruning...`);
    
    try {
      // Implement memory pruning with standardized memory system
      // Get memories below relevance threshold to prune
      const threshold = this.config.memoryOptions?.relevanceThreshold || 0.2;
      
      // This would be implemented with actual memory pruning logic via the standardized system
      console.log(`[${this.agentId}] Memory pruning completed (threshold: ${threshold})`);
    } catch (error) {
      console.error(`[${this.agentId}] Error during memory pruning:`, error);
    }
  }
  
  /**
   * Consolidate agent memory by generating insights from collected memories
   */
  async consolidateMemory(options: { 
    contextId?: string; 
  } = {}): Promise<void> {
    if (!this.memoryService || !this.initialized) {
      console.warn(`Cannot consolidate memory for agent ${this.agentId}: Memory services not initialized`);
      return;
    }
    
    console.log(`[${this.agentId}] Running memory consolidation...`);
    
    try {
      // This would be implemented with the standardized memory system
      // Group related memories and generate insights
      console.log(`[${this.agentId}] Memory consolidation completed`);
    } catch (error) {
      console.error(`[${this.agentId}] Error during memory consolidation:`, error);
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
      await this.consolidateMemory({ contextId: message.correlationId });
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
        await this.storeMessageInMemory(message);
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
   * Store a message in the standardized memory system
   */
  protected async storeMessageInMemory(message: ExtendedAgentMessage): Promise<void> {
    if (!this.memoryService) return;
    
    try {
      // Format the message content
      const content = typeof message.payload === 'string' 
        ? message.payload 
        : JSON.stringify(message.payload);
      
      // Generate a content hash to check for duplicates
      const contentHash = await this.generateContentHash(content);
      
      // Check if this message content was recently stored (within last 5 seconds)
      const isDuplicate = await this.checkRecentDuplicate(contentHash, 5000);
      if (isDuplicate) {
        console.log(`[${this.agentId}] Duplicate message detected, skipping storage`);
        return;
      }
      
      // Create structured IDs
      const agentStructuredId = createAgentId(this.agentId);
      
      // Default user and chat IDs if not provided
      const userIdStr = message.metadata?.userId || 'system';
      const chatIdStr = message.metadata?.chatId || 'default';
      
      const userStructuredId = createUserId(userIdStr);
      const chatStructuredId = createChatId(chatIdStr);
      
      // Create thread info
      const threadId = message.metadata?.threadId || `thread_${Date.now()}`;
      const threadInfo = createThreadInfo(threadId, 0);
      
      // Store based on message kind
      if (message.metadata?.kind === 'thought') {
        // Add as cognitive process
        await addCognitiveProcessMemory(
          this.memoryService,
          content,
          CognitiveProcessType.THOUGHT,
          agentStructuredId,
          {
            contextId: message.correlationId || message.delegationContextId,
            relatedTo: message.metadata?.relatedTo,
            influencedBy: message.metadata?.influencedBy,
            importance: message.metadata?.importance,
            metadata: {
              source: 'agent',
              category: message.metadata?.category || 'thought'
            }
          }
        );
        
        // Log the contentHash separately
        console.log(`Content hash for thought: ${contentHash}`);
      } else if (message.metadata?.kind === 'task') {
        // Add as task
        await addTaskMemory(
          this.memoryService,
          content,
          message.metadata?.title || 'Untitled Task',
          message.metadata?.status || TaskStatus.PENDING,
          message.metadata?.priority || TaskPriority.MEDIUM,
          agentStructuredId,
          {
            description: message.metadata?.description,
            assignedTo: message.metadata?.assignedTo ? createAgentId(message.metadata.assignedTo) : undefined,
            dueDate: message.metadata?.dueDate,
            parentTaskId: message.metadata?.parentTaskId,
            importance: message.metadata?.importance
            // Avoid adding custom fields not in TaskMetadata
          }
        );
        
        // Log correlation info separately
        console.log(`Task correlation ID: ${message.correlationId}, delegation context: ${message.delegationContextId}`);
      } else if (message.metadata?.kind === 'document') {
        // Add as document
        await addDocumentMemory(
          this.memoryService,
          content,
          message.metadata?.source || DocumentSource.AGENT,
          {
            title: message.metadata?.title || 'Agent Document',
            contentType: message.metadata?.contentType || 'text/plain',
            agentId: agentStructuredId,
            importance: message.metadata?.importance
            // Avoid adding custom fields not in DocumentMetadata
          }
        );
        
        // Log content hash separately
        console.log(`Content hash for document: ${contentHash}`);
      } else {
        // Default: add as regular message
        const messageRole = message.fromAgentId === this.agentId 
          ? MessageRole.ASSISTANT 
          : MessageRole.USER;
          
        // Add as message with proper metadata structure
        await addMessageMemory(
          this.memoryService,
          content,
          messageRole,
          userStructuredId,
          agentStructuredId,
          chatStructuredId,
          threadInfo,
          {
            importance: message.metadata?.importance,
            messageType: message.type,
            // Add only fields that are part of MessageMetadata
            metadata: {
              tags: [
                ...(message.metadata?.tags || []),
                'correlation:' + (message.correlationId || 'none'),
                'delegation:' + (message.delegationContextId || 'none')
              ]
            }
          }
        );
        
        // Log additional context separately
        console.log(`Message from ${message.fromAgentId}, correlation: ${message.correlationId}`);
      }
      
      // Add to recent messages cache for deduplication
      await this.trackRecentMessage(contentHash);
      
      console.log(`[${this.agentId}] Stored message in memory (kind: ${message.metadata?.kind || 'message'})`);
    } catch (error) {
      console.error(`[${this.agentId}] Error storing message in memory:`, error);
    }
  }

  /**
   * Generate a simple hash of content for deduplication
   * @param content The content to hash
   * @returns A string hash
   */
  private async generateContentHash(content: string): Promise<string> {
    // Simple hash function for quick comparison
    // For production, consider using a more robust hashing function
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return String(hash);
  }

  // Store recent message hashes with timestamps for deduplication
  private recentMessageHashes: Map<string, number> = new Map();

  /**
   * Track a recently processed message for deduplication
   * @param contentHash The hash of the message content
   */
  private async trackRecentMessage(contentHash: string): Promise<void> {
    this.recentMessageHashes.set(contentHash, Date.now());
    
    // Periodically clean up old entries (every 100 messages)
    if (this.recentMessageHashes.size % 100 === 0) {
      this.cleanupOldHashes();
    }
  }

  /**
   * Check if content was recently processed
   * @param contentHash The hash to check
   * @param timeWindowMs Time window in milliseconds
   * @returns Boolean indicating if this is a duplicate
   */
  private async checkRecentDuplicate(contentHash: string, timeWindowMs: number): Promise<boolean> {
    const lastSeen = this.recentMessageHashes.get(contentHash);
    if (!lastSeen) return false;
    
    const timeSince = Date.now() - lastSeen;
    return timeSince < timeWindowMs;
  }

  /**
   * Clean up old hash entries to prevent memory leaks
   */
  private cleanupOldHashes(): void {
    const now = Date.now();
    const retentionPeriod = 24 * 60 * 60 * 1000; // 24 hours
    
    // Convert Map entries to array to avoid iterator issues
    Array.from(this.recentMessageHashes.entries()).forEach(([hash, timestamp]) => {
      if (now - timestamp > retentionPeriod) {
        this.recentMessageHashes.delete(hash);
      }
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
    
    // Create planning context
    const planningContext: PlanningContext = {
      goal,
      tags,
      agentId: this.agentId,
      delegationContextId,
      additionalContext
    };
    
    // Generate plan
    const plan = await Planner.plan(planningContext);
    
    // Record the plan in memory
    if (this.memoryService) {
      await this.memoryService.addMemory({
        type: MemoryType.THOUGHT,
        content: `Created plan for "${goal}" with ${plan.steps.length} steps.`,
        metadata: {
          agentId: this.agentId,
          delegationContextId: delegationContextId,
          planTitle: plan.title,
          stepCount: plan.steps.length
        },
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
        contextId: plan.context.delegationContextId
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
   * Get agent's current health status
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
        clearInterval(this.memoryPruningTimer);
        this.memoryPruningTimer = null;
      }
      
      // Cancel scheduled memory consolidation
      if (this.memoryConsolidationTimer) {
        clearInterval(this.memoryConsolidationTimer);
        this.memoryConsolidationTimer = null;
      }
      
      // Run final memory pruning and consolidation
      if (this.memoryService) {
        await this.pruneMemory();
        await this.consolidateMemory();
      }
      
      this.initialized = false;
      console.log(`Agent ${this.agentId} shutdown complete`);
    } catch (error) {
      console.error(`Error during agent ${this.agentId} shutdown:`, error);
    }
  }

  /**
   * Check if agent has permission to use a specific tool
   */
  hasToolPermission(toolName: string): boolean {
    return this.toolPermissions.includes(toolName);
  }

  /**
   * Plan and execute a task with proper planning and execution management
   * This is a standard interface method that can be implemented by subclasses or used directly
   */
  async planAndExecute(goal: string, options: any = {}): Promise<any> {
    if (!this.initialized) {
      const initSuccess = await this.initialize();
      if (!initSuccess) {
        return {
          success: false,
          error: `Failed to initialize agent ${this.agentId} for task execution`
        };
      }
    }
    
    try {
      console.log(`[${this.agentId}] Planning and executing task: ${goal.substring(0, 50)}...`);
      
      // Create a plan for the task
      const plan = await this.planTask({
        goal,
        tags: options.tags || [],
        delegationContextId: options.delegationContextId,
        additionalContext: options.additionalContext || {}
      });
      
      // Execute the plan
      const executionResult = await this.executePlan(plan);
      
      return {
        success: true,
        plan,
        results: executionResult.results,
        metadata: {
          agentId: this.agentId,
          executionTime: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error(`[${this.agentId}] Error in planAndExecute:`, error);
      return {
        success: false,
        error: `Execution error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
