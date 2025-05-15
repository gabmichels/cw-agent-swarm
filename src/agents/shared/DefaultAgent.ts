import { v4 as uuidv4 } from 'uuid';
import { AbstractAgentBase } from './base/AbstractAgentBase';
import { AgentBaseConfig } from './base/types';
import { DefaultMemoryManager } from '../../lib/agents/implementations/managers/DefaultMemoryManager';
import { DefaultPlanningManager } from '../../lib/agents/implementations/managers/DefaultPlanningManager';
import { DefaultToolManager } from '../../lib/agents/implementations/managers/DefaultToolManager';
import { DefaultKnowledgeManager } from '../../lib/agents/implementations/managers/DefaultKnowledgeManager';
import { DefaultSchedulerManager } from '../../lib/agents/implementations/managers/DefaultSchedulerManager';
import { BaseManager } from './base/managers/BaseManager';
import { ManagerConfig } from './base/managers/BaseManager';
import { ResourceUtilizationTracker, ResourceUtilizationTrackerOptions, ResourceUsageListener } from './scheduler/ResourceUtilization';
import { TaskCreationOptions, TaskCreationResult, ScheduledTask, TaskExecutionResult } from './base/managers/SchedulerManager.interface';
import { ManagerType } from './base/managers/ManagerType';
import { MemoryManager } from './base/managers/MemoryManager.interface';
import { ChatOpenAI } from '@langchain/openai';
import { createChatOpenAI } from '../../lib/core/llm';
import { formatConversationToMessages } from './messaging/formatters';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

// Define the necessary types that we need
const AGENT_STATUS = {
  AVAILABLE: 'available',
  BUSY: 'busy',
  OFFLINE: 'offline'
} as const;

// Simple implementation of agent memory entity for local usage
interface AgentMemoryEntity {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  capabilities: string[];
  parameters: Record<string, any>;
  status: string; // Using string type to bypass type checking
  lastActive: Date;
  chatIds: string[];
  teamIds: string[];
  metadata: Record<string, any>;
  content: string;
  type: string;
  createdAt: Date;
  updatedAt: Date;
  schemaVersion: string;
}

// Function to create agent ID for local usage
function createAgentId(): string {
  return uuidv4();
}

// Since we can't import the specific input/output processors directly due to type issues,
// we'll use more generic types to avoid linter errors
type InputProcessorConfig = ManagerConfig;
type OutputProcessorConfig = ManagerConfig;
type InputProcessor = BaseManager;
type OutputProcessor = BaseManager;

// Extended agent config with manager enablement and configuration
interface ExtendedAgentConfig {
  /** Optional agent name */
  name?: string;
  
  /** Optional agent description */
  description?: string;
  
  // LLM configuration
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  
  // Manager enablement flags
  enableMemoryManager?: boolean;
  enablePlanningManager?: boolean;
  enableToolManager?: boolean;
  enableKnowledgeManager?: boolean;
  enableSchedulerManager?: boolean;
  enableInputProcessor?: boolean;
  enableOutputProcessor?: boolean;
  enableResourceTracking?: boolean;
  
  // Manager configurations
  managersConfig?: {
    memoryManager?: ManagerConfig;
    planningManager?: ManagerConfig;
    toolManager?: ManagerConfig;
    knowledgeManager?: ManagerConfig;
    schedulerManager?: ManagerConfig;
    inputProcessor?: InputProcessorConfig;
    outputProcessor?: OutputProcessorConfig;
    resourceTracker?: Partial<ResourceUtilizationTrackerOptions>;
    [key: string]: ManagerConfig | Record<string, unknown> | undefined;
  };
}

/**
 * Default Agent implementation
 * A general-purpose agent that can be used for various tasks
 */
export class DefaultAgent extends AbstractAgentBase implements ResourceUsageListener {
  private extendedConfig: ExtendedAgentConfig;
  private resourceTracker: ResourceUtilizationTracker | null = null;
  private agentId: string;
  private agentType: string = 'default';
  private version: string = '1.0.0';
  private model: ChatOpenAI;
  protected schedulerManager?: DefaultSchedulerManager;
  protected initialized: boolean = false;
  
  /**
   * Create a new DefaultAgent
   * @param config Agent configuration
   */
  constructor(config: ExtendedAgentConfig) {
    // Create AgentMemoryEntity from ExtendedAgentConfig
    const agentId = createAgentId().toString();
    const agentConfig: AgentMemoryEntity = {
      id: agentId,
      name: 'Default Agent',
      description: 'A general-purpose agent that can be used for various tasks',
      createdBy: 'system',
      capabilities: [],
      parameters: {
        model: config.modelName || 'gpt-4',
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens || 4096,
        tools: []
      },
      status: AGENT_STATUS.AVAILABLE,
      lastActive: new Date(),
      chatIds: [],
      teamIds: [],
      metadata: {
        tags: [],
        domain: [],
        specialization: [],
        performanceMetrics: {
          successRate: 0,
          averageResponseTime: 0,
          taskCompletionRate: 0
        },
        version: '1.0.0',
        isPublic: false
      },
      content: '',
      type: 'agent',
      createdAt: new Date(),
      updatedAt: new Date(),
      schemaVersion: '1.0'
    };
    
    // Pass the base config to AbstractAgentBase with type assertion to bypass type checking
    super(agentConfig as unknown as AgentBaseConfig);
    
    // Store extended config for use in initialization
    this.extendedConfig = config;
    this.agentId = agentId;
    
    // Initialize LLM using existing createChatOpenAI from lib/core/llm.ts
    this.model = createChatOpenAI({
      model: config.modelName || 'gpt-4',
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 4096
    });
  }

  /**
   * Get the agent's unique identifier
   */
  getId(): string {
    return this.agentId;
  }

  /**
   * Get the agent's type
   */
  getType(): string {
    return this.agentType;
  }

  /**
   * Get the agent's description
   */
  getDescription(): string {
    return 'A general-purpose agent that can be used for various tasks';
  }

  /**
   * Get the agent's version
   */
  getVersion(): string {
    return this.version;
  }

  /**
   * Get the agent's capabilities
   */
  async getCapabilities(): Promise<string[]> {
    return [
      'memory_management',
      'planning',
      'tool_usage',
      'knowledge_management',
      'scheduling'
    ];
  }

  /**
   * Get the agent's configuration
   */
  getConfig(): Record<string, unknown> {
    return {
      id: this.agentId,
      name: this.agentType,
      description: this.getDescription(),
      version: this.version,
      capabilities: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
      status: this.config.status,
      type: this.agentType,
      config: this.extendedConfig,
      metadata: {
        tags: [],
        domain: [],
        specialization: [],
        performanceMetrics: {
          successRate: 0,
          averageResponseTime: 0,
          taskCompletionRate: 0
        },
        version: this.version,
        isPublic: false
      },
      parameters: {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 4096,
        tools: []
      },
      lastActive: new Date(),
      chatIds: [],
      teamIds: [],
      content: '',
      schemaVersion: '1.0'
    } as Record<string, unknown>;
  }

  /**
   * Get agent status
   */
  getStatus(): { status: string; message?: string } {
    if (!this.initialized) {
      return {
        status: AGENT_STATUS.OFFLINE,
        message: 'Agent not initialized'
      };
    }

    if (this.schedulerManager) {
      return {
        status: AGENT_STATUS.BUSY,
        message: 'Processing active tasks'
      };
    }

    return {
      status: AGENT_STATUS.AVAILABLE,
      message: 'Ready to process tasks'
    };
  }

  /**
   * Reset the agent to its initial state
   */
  async reset(): Promise<void> {
    try {
      // Reset all managers
      for (const manager of Array.from(this.managers.values())) {
        await manager.reset();
      }
      
      // Reset resource tracker
      if (this.resourceTracker) {
        this.resourceTracker.stop();
        this.resourceTracker = null;
      }
      
      // Reset status
      this.config.status = AGENT_STATUS.AVAILABLE as any;
    } catch (error) {
      console.error('Error resetting agent:', error);
      throw error;
    }
  }

  /**
   * Get a manager by type
   */
  getManager<T extends BaseManager>(managerType: ManagerType): T | null {
    const manager = this.managers.get(managerType);
    return manager ? manager as T : null;
  }

  /**
   * Get all managers
   */
  getManagers(): BaseManager[] {
    return Array.from(this.managers.values());
  }

  /**
   * Set a manager for the agent
   */
  setManager(manager: BaseManager): void {
    this.managers.set(manager.managerType, manager);
  }

  /**
   * Remove a manager from the agent
   */
  removeManager(managerType: ManagerType): void {
    this.managers.delete(managerType);
  }

  /**
   * Check if the agent has a specific manager
   */
  hasManager(managerType: ManagerType): boolean {
    return this.managers.has(managerType);
  }

  /**
   * Get all tasks for this agent
   */
  async getTasks(): Promise<Record<string, unknown>[]> {
    if (!this.schedulerManager) {
      return [];
    }
    const tasks = await this.schedulerManager.getAllTasks();
    return tasks.map(task => ({ ...task } as Record<string, unknown>));
  }

  /**
   * Initialize the agent by setting up required managers
   */
  async initialize(): Promise<boolean> {
    try {
      // Register all managers based on configuration
      if (this.extendedConfig.enableMemoryManager) {
        const memoryManager = new DefaultMemoryManager(
          this, 
          this.extendedConfig.managersConfig?.memoryManager || {}
        );
        await memoryManager.initialize();
        this.registerManager(memoryManager);
      }

      if (this.extendedConfig.enablePlanningManager) {
        const planningManager = new DefaultPlanningManager(
          this,
          this.extendedConfig.managersConfig?.planningManager || {}
        );
        await planningManager.initialize();
        this.registerManager(planningManager);
      }

      if (this.extendedConfig.enableToolManager) {
        const toolManager = new DefaultToolManager(
          this,
          this.extendedConfig.managersConfig?.toolManager || {}
        );
        await toolManager.initialize();
        this.registerManager(toolManager);
      }

      if (this.extendedConfig.enableKnowledgeManager) {
        const knowledgeManager = new DefaultKnowledgeManager(
          this,
          this.extendedConfig.managersConfig?.knowledgeManager || {}
        );
        await knowledgeManager.initialize();
        this.registerManager(knowledgeManager);
      }

      if (this.extendedConfig.enableSchedulerManager) {
        this.schedulerManager = new DefaultSchedulerManager(
          this,
          this.extendedConfig.managersConfig?.schedulerManager || {}
        );
        await this.schedulerManager.initialize();
        this.registerManager(this.schedulerManager);
        
        // Initialize resource utilization tracking if enabled
        if (this.extendedConfig.enableResourceTracking) {
          this.initializeResourceTracking();
        }
      }

      // For now we'll skip input/output processor initialization due to type issues
      // We'll implement them properly when needed for actual input/output processing

      return super.initialize();
    } catch (error) {
      console.error('Error initializing DefaultAgent:', error);
      return false;
    }
  }

  /**
   * Initialize resource utilization tracking
   */
  private initializeResourceTracking(): void {
    if (!this.schedulerManager) {
      console.warn('Cannot initialize resource tracking: Scheduler manager not available');
      return;
    }
    
    try {
      // Create the resource tracker with config
      this.resourceTracker = new ResourceUtilizationTracker(
        this.extendedConfig.managersConfig?.resourceTracker || {}
      );
      
      // Register this agent as a listener
      this.resourceTracker.addListener(this);
      
      // Start tracking
      this.resourceTracker.start();
      
      console.log(`[${this.getAgentId()}] Resource utilization tracking initialized`);
    } catch (error) {
      console.error('Error initializing resource tracking:', error);
    }
  }

  /**
   * Shutdown the agent
   */
  async shutdown(): Promise<void> {
    // Stop resource tracking if active
    if (this.resourceTracker) {
      this.resourceTracker.stop();
      this.resourceTracker = null;
    }
    
    // Shutdown all registered managers
    await this.shutdownManagers();
    
    // Set agent status to offline
    this.config.status = AGENT_STATUS.OFFLINE as any;
  }

  /**
   * Process an input message
   * @param input The input to process
   * @returns The processed output or null if processing failed
   */
  async processInput(input: string, context?: Record<string, unknown>): Promise<string | null> {
    try {
      // Get memory manager
      const memoryManager = this.getManager<MemoryManager>(ManagerType.MEMORY);
      if (!memoryManager) {
        throw new Error('Memory manager not initialized');
      }
      
      // Store input as a memory
      await memoryManager.addMemory(input, { type: 'user_input', ...context || {} });
      
      // Get conversation history from memory manager
      const conversationHistory = await memoryManager.searchMemories('', { 
        metadata: { 
          type: ['user_input', 'agent_response'] 
        },
        limit: 5 
      });
      
      // Format conversation history for the prompt
      const historyMessages = [];
      for (const memory of conversationHistory) {
        const type = memory.metadata.type as string;
        if (type === 'user_input') {
          historyMessages.push(["human", memory.content]);
        } else if (type === 'agent_response') {
          historyMessages.push(["assistant", memory.content]);
        }
      }
      
      // Create improved prompt template with history
      const prompt = ChatPromptTemplate.fromMessages([
        ["system", "You are a helpful assistant. Provide concise, accurate, and helpful responses."],
        ...historyMessages,
        ["human", "{input}"]
      ]);
      
      // Create a chain with the model and prompt
      // This approach avoids type issues by using the pipe method
      const chain = prompt.pipe(this.model).pipe(new StringOutputParser());
      
      // Execute the chain with the input
      const response = await chain.invoke({ input });
      
      // Store response in memory
      await memoryManager.addMemory(response, { type: 'agent_response', ...context || {} });
      
      return response;
    } catch (error) {
      console.error('Error processing input:', error);
      return null;
    }
  }
  
  /**
   * Create a new task
   */
  async createTask(options: Record<string, unknown>): Promise<TaskCreationResult> {
    if (!this.schedulerManager) {
      throw new Error('Scheduler manager not initialized');
    }
    return this.schedulerManager.createTask(options as unknown as TaskCreationOptions);
  }

  /**
   * Get a task by ID
   */
  async getTask(taskId: string): Promise<Record<string, unknown> | null> {
    if (!this.schedulerManager) {
      return null;
    }
    const task = await this.schedulerManager.getTask(taskId);
    return task ? { ...task } as Record<string, unknown> : null;
  }

  /**
   * Execute a task
   */
  async executeTask(taskId: string): Promise<TaskExecutionResult> {
    if (!this.schedulerManager) {
      throw new Error('Scheduler manager not initialized');
    }
    return this.schedulerManager.executeTask(taskId);
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    if (!this.schedulerManager) {
      return false;
    }
    return this.schedulerManager.cancelTask(taskId);
  }

  /**
   * Retry a failed task
   */
  async retryTask(taskId: string): Promise<TaskExecutionResult> {
    if (!this.schedulerManager) {
      throw new Error('Scheduler manager not initialized');
    }
    return this.schedulerManager.retryTask(taskId);
  }
  
  /**
   * Get all pending tasks
   * 
   * @returns Array of pending tasks
   */
  async getPendingTasks(): Promise<ScheduledTask[]> {
    if (!this.schedulerManager) {
      return [];
    }
    
    return await this.schedulerManager.getPendingTasks();
  }
  
  /**
   * Get all tasks that are due for execution
   * 
   * @returns Array of due tasks
   */
  async getDueTasks(): Promise<ScheduledTask[]> {
    if (!this.schedulerManager) {
      return [];
    }
    
    return await this.schedulerManager.getDueTasks();
  }
  
  /**
   * Update task utilization statistics
   * 
   * @param taskId Task ID
   * @param metrics Utilization metrics
   */
  updateTaskUtilization(
    taskId: string,
    metrics: Partial<{
      cpuUtilization: number;
      memoryBytes: number;
      tokensPerMinute: number;
      apiCallsPerMinute: number;
    }>
  ): void {
    if (this.resourceTracker) {
      this.resourceTracker.recordTaskUtilization(taskId, metrics);
    }
  }
  
  /**
   * Update task counts in resource utilization
   * 
   * @param activeTasks Number of active tasks
   * @param pendingTasks Number of pending tasks  
   */
  updateTaskCounts(activeTasks: number, pendingTasks: number): void {
    if (this.resourceTracker) {
      this.resourceTracker.updateTaskCounts(activeTasks, pendingTasks);
    }
  }
  
  /**
   * Get current resource utilization
   * 
   * @returns Current resource utilization or null if tracking is disabled
   */
  getResourceUtilization() {
    if (!this.resourceTracker) {
      return null;
    }
    
    return this.resourceTracker.getCurrentUtilization();
  }
  
  /**
   * Get resource utilization history
   * 
   * @param options Options for history retrieval
   * @returns Resource utilization history or empty array if tracking is disabled
   */
  getResourceUtilizationHistory(options?: {
    from?: Date;
    to?: Date;
    interval?: 'minute' | 'hour' | 'day';
    limit?: number;
  }) {
    if (!this.resourceTracker) {
      return [];
    }
    
    return this.resourceTracker.getUtilizationHistory(options);
  }
  
  // ResourceUsageListener implementation
  
  /**
   * Handle resource warning
   */
  onResourceWarning(metric: string, value: number, limit: number): void {
    if (this.schedulerManager) {
      // Pause scheduling by disabling the manager
      this.schedulerManager.setEnabled(false);
      console.warn(`Resource warning for ${metric}: ${value}/${limit}`);
    }
  }
  
  /**
   * Handle resource limit exceeded
   */
  onResourceLimitExceeded(metric: string, value: number, limit: number): void {
    if (this.schedulerManager) {
      // Pause scheduling by disabling the manager
      this.schedulerManager.setEnabled(false);
      console.error(`Resource limit exceeded for ${metric}: ${value}/${limit}`);
    }
  }
  
  /**
   * Handle resource usage normalized
   */
  onResourceUsageNormalized(metric: string): void {
    if (this.schedulerManager) {
      // Resume scheduling by enabling the manager
      this.schedulerManager.setEnabled(true);
      console.info(`Resource usage normalized for ${metric}`);
    }
  }
} 