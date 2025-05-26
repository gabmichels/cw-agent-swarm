/**
 * DefaultAgent.ts - Refactored Agent Implementation
 * 
 * This is the refactored version that delegates to specialized components:
 * - AgentInitializer: Handles component initialization and dependency injection
 * - AgentLifecycleManager: Manages agent lifecycle (start/stop/pause/resume)
 * - AgentCommunicationHandler: Handles message processing and routing
 * - AgentExecutionEngine: Coordinates task execution and manager orchestration
 * - InputProcessingCoordinator: Handles input validation and preprocessing
 * - OutputProcessingCoordinator: Handles output formatting and delivery
 * - ThinkingProcessor: Handles reasoning and decision-making
 * - AgentConfigValidator: Validates configuration
 */

import { v4 as uuidv4 } from 'uuid';
import { AbstractAgentBase } from './base/AbstractAgentBase';
import { AgentBaseConfig } from './base/types';
import { BaseManager } from './base/managers/BaseManager';
import { ManagerType } from './base/managers/ManagerType';
import { createLogger } from '@/lib/logging/winston-logger';

// Import our refactored components
import { AgentInitializer, AgentInitializationConfig } from './core/AgentInitializer';
import { AgentLifecycleManager } from './core/AgentLifecycleManager';
import { AgentCommunicationHandler } from './core/AgentCommunicationHandler';
import { AgentExecutionEngine } from './core/AgentExecutionEngine';
import { InputProcessingCoordinator } from './processors/InputProcessingCoordinator';
import { OutputProcessingCoordinator } from './processors/OutputProcessingCoordinator';
import { ThinkingProcessor } from './processors/ThinkingProcessor';
import { AgentConfigValidator } from './utils/AgentConfigValidator';

// Import interfaces
import { 
  AgentResponse, 
  GetLLMResponseOptions, 
  MessageProcessingOptions, 
  ThinkOptions 
} from './base/AgentBase.interface';
import { ThinkingResult } from '../../services/thinking/types';
import { TaskCreationOptions, TaskCreationResult, TaskExecutionResult } from './base/managers/SchedulerManager.interface';
import { Task, TaskStatus } from '../../lib/scheduler/models/Task.model';
import { ModularSchedulerManager } from '../../lib/scheduler/implementations/ModularSchedulerManager';
import { PlanCreationOptions, PlanCreationResult, PlanExecutionResult } from './base/managers/PlanningManager.interface';
import { ReflectionResult } from './base/managers/ReflectionManager.interface';

// Import types for configuration
import { PromptFormatter, PersonaInfo } from '../../agents/shared/messaging/PromptFormatter';
import { ResourceUtilizationTracker, ResourceUtilizationTrackerOptions, ResourceUsageListener } from './scheduler/ResourceUtilization';
import { OpportunityManager } from '../../lib/opportunity';

// Agent status constants
const AGENT_STATUS = {
  AVAILABLE: 'available',
  BUSY: 'busy',
  OFFLINE: 'offline',
  ERROR: 'error'
} as const;

// Configuration interface for the refactored agent
interface DefaultAgentConfig {
  /** Optional agent ID */
  id?: string;
  
  /** Optional agent name */
  name?: string;
  
  /** Optional agent description */
  description?: string;
  
  /** Optional agent type */
  type?: string;
  
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
  enableReflectionManager?: boolean;
  
  // Enhanced manager flags
  useEnhancedMemory?: boolean;
  useEnhancedReflection?: boolean;
  
  // Behavior configuration
  adaptiveBehavior?: boolean;
  
  // Persona and system prompt configuration
  systemPrompt?: string;
  persona?: PersonaInfo;
  
  // Memory refresh configuration
  memoryRefresh?: {
    enabled: boolean;
    interval: number;
    maxCriticalMemories: number;
  };
  
  // Component configurations
  componentsConfig?: {
    initializer?: Record<string, unknown>;
    lifecycleManager?: Record<string, unknown>;
    communicationHandler?: Record<string, unknown>;
    executionEngine?: Record<string, unknown>;
    inputProcessor?: Record<string, unknown>;
    outputProcessor?: Record<string, unknown>;
    thinkingProcessor?: Record<string, unknown>;
    configValidator?: Record<string, unknown>;
    resourceTracker?: Partial<ResourceUtilizationTrackerOptions>;
    [key: string]: Record<string, unknown> | undefined;
  };


}

// Simple agent memory entity for compatibility
interface AgentMemoryEntity {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  capabilities: string[];
  parameters: Record<string, unknown>;
  status: string;
  lastActive: Date;
  chatIds: string[];
  teamIds: string[];
  metadata: Record<string, unknown>;
  content: string;
  type: string;
  createdAt: Date;
  updatedAt: Date;
  schemaVersion: string;
}

/**
 * Refactored DefaultAgent implementation
 * 
 * This agent delegates all major functionality to specialized components,
 * providing a clean orchestration layer that coordinates between components.
 */
export class DefaultAgent extends AbstractAgentBase implements ResourceUsageListener {
  // Core properties
  private readonly agentId: string;
  private readonly agentType: string;
  private readonly version: string = '2.0.0'; // Updated version for refactored agent
  private readonly logger: ReturnType<typeof createLogger>;
  private agentConfig: DefaultAgentConfig;
  
  // Component instances
  private initializer: AgentInitializer | null = null;
  private lifecycleManager: AgentLifecycleManager | null = null;
  private communicationHandler: AgentCommunicationHandler | null = null;
  private executionEngine: AgentExecutionEngine | null = null;
  private inputProcessor: InputProcessingCoordinator | null = null;
  private outputProcessor: OutputProcessingCoordinator | null = null;
  private thinkingProcessor: ThinkingProcessor | null = null;
  private configValidator: AgentConfigValidator | null = null;
  
  // Legacy compatibility properties
  private resourceTracker: ResourceUtilizationTracker | null = null;
  private opportunityManager: OpportunityManager | null = null;
  protected schedulerManager?: ModularSchedulerManager;
  protected initialized: boolean = false;

  /**
   * Create a new refactored DefaultAgent
   * @param config Agent configuration
   */
  constructor(config: DefaultAgentConfig) {
    // Generate agent ID
    const agentId = config.id || uuidv4();
    
    // Create agent memory entity for base class compatibility
    const baseConfig: AgentMemoryEntity = {
      id: agentId,
      name: config.name || 'Default Agent',
      description: config.description || 'A refactored general-purpose agent',
      createdBy: 'system',
      capabilities: [],
      parameters: {
        model: config.modelName || process.env.OPENAI_MODEL_NAME || 'gpt-4.1-2025-04-14',
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens || (process.env.OPENAI_MAX_TOKENS ? parseInt(process.env.OPENAI_MAX_TOKENS, 10) : 32000),
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
        version: '2.0.0',
        isPublic: false,
        persona: config.persona || {}
      },
      content: '',
      type: 'agent',
      createdAt: new Date(),
      updatedAt: new Date(),
      schemaVersion: '2.0'
    };
    
    // Initialize base class
    super(baseConfig as unknown as AgentBaseConfig);
    
    // Set properties
    this.agentId = agentId;
    this.agentType = config.type || 'default';
    this.agentConfig = config;
    
    // Initialize logger
    this.logger = createLogger({
      moduleId: `default-agent-${agentId}`,
      agentId: agentId
    });
    
    this.logger.system("Refactored DefaultAgent created", {
      agentId: agentId,
      agentName: config.name || 'Default Agent',
      version: this.version,
      config: config
    });
  }

  /**
   * Get the agent's unique identifier
   */
  getId(): string {
    return this.agentId;
  }

  /**
   * Get the agent's unique identifier (alias for getId for backward compatibility)
   */
  getAgentId(): string {
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
    return 'A refactored general-purpose agent';
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
      'scheduling',
      'thinking',
      'communication'
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
      status: AGENT_STATUS.AVAILABLE,
      type: this.agentType,
      config: this.agentConfig,
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
        model: process.env.OPENAI_MODEL_NAME || 'gpt-4.1-2025-04-14',
        temperature: this.agentConfig.temperature || 0.7,
        maxTokens: process.env.OPENAI_MAX_TOKENS ? parseInt(process.env.OPENAI_MAX_TOKENS, 10) : 32000,
        tools: []
      },
      lastActive: new Date(),
      chatIds: [],
      teamIds: [],
      content: '',
      schemaVersion: '2.0'
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

    if (this.lifecycleManager) {
      const status = this.lifecycleManager.getStatus();
      return {
        status: status.toString(),
        message: 'Agent lifecycle managed'
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
      if (this.lifecycleManager) {
        await this.lifecycleManager.stop();
      }
      
      // Reset all managers
      for (const manager of Array.from(this.managers.values())) {
        await manager.reset();
      }
      
      // Reset resource tracker
      if (this.resourceTracker) {
        this.resourceTracker.stop();
        this.resourceTracker = null;
      }
      
      this.initialized = false;
    } catch (error) {
      this.logger.error('Error resetting agent', { error });
      throw error;
    }
  }

  /**
   * Initialize the agent using the new component-based architecture
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }
    
    try {
      this.logger.system("Initializing refactored agent", { agentId: this.agentId });
      
      // Step 1: Validate configuration
      this.configValidator = new AgentConfigValidator();
      try {
        const validationResult = this.configValidator.validateConfig(this.agentConfig as Record<string, unknown>, 'DefaultAgent');
        if (!validationResult.valid) {
          this.logger.error("Configuration validation failed", { errors: validationResult.errors });
          return false;
        }
        this.logger.system("Configuration validation passed");
      } catch (validationError) {
        // If schema doesn't exist, skip validation for now
        this.logger.warn("Configuration validation skipped - schema not found", { error: validationError });
      }
      
      // Step 2: Initialize components using AgentInitializer
      this.initializer = new AgentInitializer();
      const initResult = await this.initializer.initializeAgent(this, this.agentConfig as AgentInitializationConfig);
      if (!initResult.success) {
        this.logger.error("Component initialization failed", { errors: initResult.errors });
        return false;
      }
      
      // Register all managers with the base class
      for (const [managerType, manager] of initResult.managers) {
        this.setManager(manager);
      }
      
      // Store scheduler manager reference
      if (initResult.schedulerManager) {
        this.schedulerManager = initResult.schedulerManager;
      }
      
      // Store opportunity manager reference
      if (initResult.opportunityManager) {
        this.opportunityManager = initResult.opportunityManager;
      }
      
      this.logger.system("Component initialization passed");
      
      // Step 3: Initialize lifecycle manager
      this.lifecycleManager = new AgentLifecycleManager(this);
      await this.lifecycleManager.start();
      this.logger.system("Lifecycle manager initialized");
      
      // Step 4: Initialize communication handler
      this.communicationHandler = new AgentCommunicationHandler(this);
      this.logger.system("Communication handler initialized");
      
      // Step 5: Initialize execution engine
      this.executionEngine = new AgentExecutionEngine(this);
      this.logger.system("Execution engine initialized");
      
      // Step 6: Initialize processing coordinators
      this.inputProcessor = new InputProcessingCoordinator(this);
      this.outputProcessor = new OutputProcessingCoordinator(this);
      this.thinkingProcessor = new ThinkingProcessor(this);
      this.logger.system("Processing coordinators initialized");
      
      // Step 7: Initialize resource tracking if enabled
      if (this.agentConfig.enableResourceTracking) {
        this.initializeResourceTracking();
        this.logger.system("Resource tracking initialized");
      }
      
      this.initialized = true;
      this.logger.system("Agent initialization completed successfully", { 
        agentId: this.agentId,
        managersInitialized: initResult.managers.size
      });
      
      return true;
    } catch (error) {
      this.logger.error("Error during agent initialization", { error });
      
      // Clean up any resources that were created
      try {
        await this.shutdown();
      } catch (shutdownError) {
        this.logger.error("Error during shutdown after failed initialization", { shutdownError });
      }
      
      return false;
    }
  }

  /**
   * Initialize resource utilization tracking
   */
  private initializeResourceTracking(): void {
    try {
      // Create the resource tracker with config
      this.resourceTracker = new ResourceUtilizationTracker(
        this.agentConfig.componentsConfig?.resourceTracker || {}
      );
      
      // Register this agent as a listener
      this.resourceTracker.addListener(this);
      
      // Start tracking
      this.resourceTracker.start();
      
      this.logger.system("Resource utilization tracking initialized", { agentId: this.agentId });
    } catch (error) {
      this.logger.error('Error initializing resource tracking', { error });
    }
  }

  /**
   * Shutdown the agent gracefully
   */
  async shutdown(): Promise<void> {
    try {
      this.logger.system("Shutting down agent", { agentId: this.agentId });
      
      // Stop lifecycle manager
      if (this.lifecycleManager) {
        await this.lifecycleManager.stop();
      }
      
      // Stop resource tracking
      if (this.resourceTracker) {
        this.resourceTracker.stop();
        this.resourceTracker = null;
      }
      
      // Shutdown all managers
      for (const manager of Array.from(this.managers.values())) {
        if (typeof manager.shutdown === 'function') {
          await manager.shutdown();
        }
      }
      
      this.initialized = false;
      this.logger.system("Agent shutdown completed", { agentId: this.agentId });
    } catch (error) {
      this.logger.error('Error during agent shutdown', { error });
      throw error;
    }
  }

  // ===== DELEGATED METHODS =====
  // These methods delegate to our specialized components

  /**
   * Get LLM response - delegates to CommunicationHandler
   */
  async getLLMResponse(message: string, options?: GetLLMResponseOptions): Promise<AgentResponse> {
    if (!this.communicationHandler) {
      throw new Error('Communication handler not initialized');
    }
    
    // Use the communication handler's processMessage method
    return this.communicationHandler.processMessage(message, options);
  }

  /**
   * Process user input - delegates to CommunicationHandler
   */
  async processUserInput(message: string, options?: MessageProcessingOptions): Promise<AgentResponse> {
    if (!this.communicationHandler) {
      throw new Error('Communication handler not initialized');
    }
    
    // Use the communication handler's processMessage method
    return this.communicationHandler.processMessage(message, options);
  }

  /**
   * Think about a message - delegates to ThinkingProcessor
   */
  async think(message: string, options?: ThinkOptions): Promise<ThinkingResult> {
    if (!this.thinkingProcessor) {
      throw new Error('Thinking processor not initialized');
    }
    
    // Convert ThinkingProcessor result to expected ThinkingResult format
    const processingResult = await this.thinkingProcessor.processThinking(message, options);
    
    // Transform the result to match the expected interface
    return {
      intent: {
        primary: 'user_request',
        confidence: processingResult.confidence
      },
      entities: [],
      shouldDelegate: false,
      requiredCapabilities: [],
      priority: 5,
      isUrgent: false,
      complexity: 5,
      reasoning: [processingResult.finalConclusion],
      contextUsed: {
        memories: [],
        files: [],
        tools: []
      },
      planSteps: processingResult.alternativeConclusions
    };
  }

  /**
   * Create a task - delegates to SchedulerManager
   */
  async createTask(options: TaskCreationOptions): Promise<TaskCreationResult> {
    const schedulerManager = this.getManager(ManagerType.SCHEDULER);
    if (!schedulerManager || !('createTask' in schedulerManager)) {
      throw new Error('Scheduler manager not available');
    }
    
    // Use the scheduler manager's createTask method
    return (schedulerManager as any).createTask(options);
  }

  /**
   * Execute a task - delegates to ExecutionEngine
   */
  async executeTask(taskId: string): Promise<TaskExecutionResult> {
    if (!this.executionEngine) {
      throw new Error('Execution engine not initialized');
    }
    
    const startTime = new Date();
    
    try {
      // Execute the task using the execution engine
      const result = await this.executionEngine.executeTask(`Task execution: ${taskId}`);
      const endTime = new Date();
      
      // Convert AgentResponse to TaskExecutionResult
      return {
        taskId,
        status: TaskStatus.COMPLETED,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        successful: true,
        result: result.content,
        error: undefined,
        wasRetry: false,
        retryCount: 0,
        metadata: result.metadata || {}
      };
    } catch (error) {
      const endTime = new Date();
      return {
        taskId,
        status: TaskStatus.FAILED,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        successful: false,
        result: undefined,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'EXECUTION_FAILED'
        },
        wasRetry: false,
        retryCount: 0,
        metadata: {}
      };
    }
  }

  /**
   * Plan and execute - delegates to PlanningManager
   */
  async planAndExecute(goal: string, options: Record<string, unknown> = {}): Promise<PlanExecutionResult> {
    const planningManager = this.getManager(ManagerType.PLANNING);
    if (!planningManager || !('planAndExecute' in planningManager)) {
      throw new Error('Planning manager not available');
    }
    
    // Use the planning manager's planAndExecute method
    return (planningManager as any).planAndExecute(goal, options);
  }

  /**
   * Reflect - delegates to ReflectionManager
   */
  async reflect(options: Record<string, unknown> = {}): Promise<ReflectionResult> {
    const reflectionManager = this.getManager(ManagerType.REFLECTION);
    if (!reflectionManager || !('reflect' in reflectionManager)) {
      throw new Error('Reflection manager not available');
    }
    
    // Use the reflection manager's reflect method
    return (reflectionManager as any).reflect(options);
  }

  // ===== MANAGER COMPATIBILITY METHODS =====
  // These methods maintain compatibility with the existing manager system

  /**
   * Get a manager by type
   */
  getManager<T extends BaseManager>(managerType: ManagerType): T | null {
    return super.getManager(managerType);
  }

  /**
   * Get all managers
   */
  getManagers(): BaseManager[] {
    return super.getManagers();
  }

  /**
   * Set a manager
   */
  setManager(manager: BaseManager): void {
    super.setManager(manager);
  }

  /**
   * Remove a manager
   */
  removeManager(managerType: ManagerType): void {
    super.removeManager(managerType);
  }

  /**
   * Check if manager exists
   */
  hasManager(managerType: ManagerType): boolean {
    return super.hasManager(managerType);
  }

  /**
   * Get scheduler manager
   */
  getSchedulerManager(): ModularSchedulerManager | undefined {
    return this.schedulerManager;
  }

  /**
   * Get tasks
   */
  async getTasks(): Promise<Task[]> {
    const schedulerManager = this.getManager(ManagerType.SCHEDULER);
    if (schedulerManager && 'getTasks' in schedulerManager) {
      return (schedulerManager as any).getTasks();
    }
    return [];
  }

  // ===== RESOURCE USAGE LISTENER METHODS =====

  updateTaskUtilization(
    taskId: string,
    metrics: Partial<{
      cpuUtilization: number;
      memoryBytes: number;
      tokensPerMinute: number;
      apiCallsPerMinute: number;
    }>
  ): void {
    // Resource tracking functionality would be implemented here
    this.logger.debug('Task utilization updated', { taskId, metrics });
  }

  updateTaskCounts(activeTasks: number, pendingTasks: number): void {
    // Resource tracking functionality would be implemented here
    this.logger.debug('Task counts updated', { activeTasks, pendingTasks });
  }

  getResourceUtilization() {
    // Return default resource utilization
    return {
      cpuUtilization: 0,
      memoryBytes: 0,
      tokensPerMinute: 0,
      apiCallsPerMinute: 0,
      activeTasks: 0,
      pendingTasks: 0
    };
  }

  getResourceUtilizationHistory(options?: {
    from?: Date;
    to?: Date;
    interval?: 'minute' | 'hour' | 'day';
    limit?: number;
  }) {
    // Return empty history for now
    return [];
  }

  onResourceWarning(metric: string, value: number, limit: number): void {
    this.logger.warn("Resource warning", { metric, value, limit });
  }

  onResourceLimitExceeded(metric: string, value: number, limit: number): void {
    this.logger.error("Resource limit exceeded", { metric, value, limit });
  }

  onResourceUsageNormalized(metric: string): void {
    this.logger.info("Resource usage normalized", { metric });
  }

    // ===== CLEAN SLATE IMPLEMENTATION =====
  // No legacy compatibility methods - clean break from old patterns
} 