/**
 * AgentInitializer.ts - Handles agent initialization and manager setup
 * 
 * This component is responsible for:
 * - Manager initialization logic
 * - Configuration validation
 * - Dependency injection setup
 * - Error handling for initialization failures
 */

import { v4 as uuidv4 } from 'uuid';
import { AgentBase } from '../base/AgentBase.interface';
import { BaseManager } from '../base/managers/BaseManager';
import { ManagerType } from '../base/managers/ManagerType';
import { ManagerConfig } from '../base/managers/BaseManager';
import { InputProcessorConfig } from '../base/managers/InputProcessor.interface';
import { OutputProcessorConfig } from '../base/managers/OutputProcessor.interface';
import { ResourceUtilizationTrackerOptions } from '../scheduler/ResourceUtilization';
import { PersonaInfo } from '../messaging/PromptFormatter';

// Manager imports
import { DefaultMemoryManager } from '../../../lib/agents/implementations/managers/DefaultMemoryManager';
import { DefaultPlanningManager } from '../../../lib/agents/implementations/managers/DefaultPlanningManager';
import { DefaultToolManager } from '../../../lib/agents/implementations/managers/DefaultToolManager';
import { DefaultKnowledgeManager } from '../../../lib/agents/implementations/managers/DefaultKnowledgeManager';
import { EnhancedMemoryManager } from '../memory/managers/EnhancedMemoryManager';
import { EnhancedReflectionManager } from '../reflection/managers/EnhancedReflectionManager';
import { DefaultReflectionManager } from '../reflection/managers/DefaultReflectionManager';
import { DefaultLoggerManager } from '../logger/DefaultLoggerManager';
import { LogLevel } from '../logger/DefaultLoggerManager';
import { DefaultInputProcessor } from '../input/managers/DefaultInputProcessor';
import { DefaultOutputProcessor } from '../output/managers/DefaultOutputProcessor';
import { ModularSchedulerManager } from '../../../lib/scheduler/implementations/ModularSchedulerManager';
import { createSchedulerManager } from '../../../lib/scheduler/factories/SchedulerFactory';
import { 
  OpportunityManager,
  OpportunityStorageType,
  createOpportunitySystem,
  OpportunitySystemConfig
} from '../../../lib/opportunity';
import { createLogger } from '../../../lib/logging/winston-logger';

// New manager imports for Phase 2 integration
import { EthicsManagerConfig } from '../base/managers/EthicsManager.interface';
import { CollaborationManagerConfig } from '../base/managers/CollaborationManager.interface';
import { CommunicationManagerConfig } from '../base/managers/CommunicationManager.interface';
import { NotificationManagerConfig } from '../base/managers/NotificationManager.interface';

/**
 * Configuration interface for agent initialization
 */
export interface AgentInitializationConfig {
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
  
  // New manager enablement flags (Phase 2 integration)
  enableEthicsManager?: boolean;
  enableCollaborationManager?: boolean;
  enableCommunicationManager?: boolean;
  enableNotificationManager?: boolean;
  
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
    /** Enable periodic memory refreshing */
    enabled: boolean;
    /** Interval in milliseconds between refreshes */
    interval: number;
    /** Maximum number of critical memories to include */
    maxCriticalMemories: number;
  };
  
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
    reflectionManager?: ManagerConfig;
    
    // New manager configurations (Phase 2 integration)
    ethicsManager?: EthicsManagerConfig;
    collaborationManager?: CollaborationManagerConfig;
    communicationManager?: CommunicationManagerConfig;
    notificationManager?: NotificationManagerConfig;
    
    [key: string]: ManagerConfig | Record<string, unknown> | undefined;
  };
}

/**
 * Result of agent initialization
 */
export interface AgentInitializationResult {
  success: boolean;
  managers: Map<ManagerType, BaseManager>;
  schedulerManager?: ModularSchedulerManager;
  opportunityManager?: OpportunityManager;
  errors: Array<{
    managerType: string;
    error: Error;
  }>;
}

/**
 * Error class for initialization-related errors
 */
export class AgentInitializationError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown>;

  constructor(message: string, code = 'INITIALIZATION_ERROR', context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'AgentInitializationError';
    this.code = code;
    this.context = context;
  }
}

/**
 * AgentInitializer class - Handles agent initialization and manager setup
 */
export class AgentInitializer {
  private logger: ReturnType<typeof createLogger>;
  private managers: Map<ManagerType, BaseManager> = new Map();
  private schedulerManager?: ModularSchedulerManager;
  private opportunityManager?: OpportunityManager;

  constructor() {
    this.logger = createLogger({
      moduleId: 'agent-initializer',
    });
  }

  /**
   * Initialize an agent with the given configuration
   */
  async initializeAgent(
    agent: AgentBase,
    config: AgentInitializationConfig
  ): Promise<AgentInitializationResult> {
    const agentId = agent.getId();
    const errors: Array<{ managerType: string; error: Error }> = [];
    
    try {
      this.logger.info(`Initializing agent ${agentId}`);
      
      // Initialize logger manager first - other managers can use it during initialization
      await this.initializeLoggerManager(agent, config, errors);
      
      // Initialize memory manager - we'll use this to store our persona, memories, etc.
      if (config.enableMemoryManager) {
        await this.initializeMemoryManager(agent, config, errors);
      }
      
      // Initialize planning manager - used for complex task planning
      if (config.enablePlanningManager) {
        await this.initializePlanningManager(agent, config, errors);
      }
      
      // Initialize tool manager - used to provide capabilities to the agent
      if (config.enableToolManager) {
        await this.initializeToolManager(agent, config, errors);
      }
      
      // Initialize knowledge manager - used to store and retrieve knowledge
      if (config.enableKnowledgeManager) {
        await this.initializeKnowledgeManager(agent, config, errors);
      }
      
      // Initialize scheduler manager - used for task scheduling
      if (config.enableSchedulerManager) {
        await this.initializeSchedulerManager(agent, config, errors);
      }
      
      // Initialize reflection manager if enabled - for enhanced self-reflection
      if (config.enableReflectionManager) {
        await this.initializeReflectionManager(agent, config, errors);
      }
      
      // Initialize input and output processors if enabled
      if (config.enableInputProcessor) {
        await this.initializeInputProcessor(agent, config, errors);
      }
      
      if (config.enableOutputProcessor) {
        await this.initializeOutputProcessor(agent, config, errors);
      }
      
      // Initialize new managers (Phase 2 integration)
      if (config.enableEthicsManager) {
        await this.initializeEthicsManager(agent, config, errors);
      }
      
      if (config.enableCollaborationManager) {
        await this.initializeCollaborationManager(agent, config, errors);
      }
      
      if (config.enableCommunicationManager) {
        await this.initializeCommunicationManager(agent, config, errors);
      }
      
      if (config.enableNotificationManager) {
        await this.initializeNotificationManagerWrapper(agent, config, errors);
      }
      
      // Initialize opportunity manager
      await this.initializeOpportunityManager(agent, config, errors);
      
      // Wire managers together
      this.wireManagersTogether();
      
      // Initialize all managers that were created
      await this.initializeAllManagers(errors);
      
      const success = errors.length === 0;
      this.logger.info(`Agent ${agentId} initialization ${success ? 'completed successfully' : 'completed with errors'}`);
      
      return {
        success,
        managers: this.managers,
        schedulerManager: this.schedulerManager,
        opportunityManager: this.opportunityManager,
        errors
      };
      
    } catch (error) {
      this.logger.error(`Critical error during agent initialization:`, { error: error instanceof Error ? error.message : String(error) });
      
      // Clean up any resources that were created
      await this.cleanup();
      
      return {
        success: false,
        managers: new Map(),
        errors: [{ managerType: 'initialization', error: error as Error }]
      };
    }
  }

  /**
   * Initialize logger manager
   */
  private async initializeLoggerManager(
    agent: AgentBase,
    config: AgentInitializationConfig,
    errors: Array<{ managerType: string; error: Error }>
  ): Promise<void> {
    try {
      this.logger.info('Initializing Logger Manager');
      
      const loggerManager = new DefaultLoggerManager(agent, {
        enabled: true,
        level: LogLevel.INFO,
        logToConsole: true,
        formatMessages: true,
        trackLogHistory: true
      });
      
      this.managers.set(ManagerType.LOGGER, loggerManager);
      this.logger.info('Logger Manager initialized successfully');
      
    } catch (error) {
      this.logger.error('Error initializing Logger Manager:', { error: error instanceof Error ? error.message : String(error) });
      errors.push({ managerType: 'logger', error: error as Error });
    }
  }

  /**
   * Initialize memory manager
   */
  private async initializeMemoryManager(
    agent: AgentBase,
    config: AgentInitializationConfig,
    errors: Array<{ managerType: string; error: Error }>
  ): Promise<void> {
    try {
      this.logger.info('Initializing Memory Manager');
      const agentId = agent.getId();
      
      let memoryManager: BaseManager;
      
      // Use enhanced memory manager if specified
      if (config.useEnhancedMemory) {
        this.logger.info('Using Enhanced Memory Manager');
        
        memoryManager = new EnhancedMemoryManager(agent, {
          enabled: true,
          systemMemoryScope: `agent-${agentId}-system`,
          userMemoryScope: `agent-${agentId}-user`,
          createPrivateScope: true,
          defaultScopeName: `agent-${agentId}-default`,
          ...config.managersConfig?.memoryManager
        });
      } else {
        memoryManager = new DefaultMemoryManager(agent, {
          enabled: true,
          systemMemoryScope: `agent-${agentId}-system`,
          userMemoryScope: `agent-${agentId}-user`,
          createPrivateScope: true,
          defaultScopeName: `agent-${agentId}-default`,
          ...config.managersConfig?.memoryManager
        });
      }
      
      this.managers.set(ManagerType.MEMORY, memoryManager);
      this.logger.info('Memory Manager initialized successfully');
      
    } catch (error) {
      this.logger.error('Error initializing Memory Manager:', { error: error instanceof Error ? error.message : String(error) });
      errors.push({ managerType: 'memory', error: error as Error });
    }
  }

  /**
   * Initialize planning manager
   */
  private async initializePlanningManager(
    agent: AgentBase,
    config: AgentInitializationConfig,
    errors: Array<{ managerType: string; error: Error }>
  ): Promise<void> {
    if (!config.enablePlanningManager) {
      this.logger.info('Planning Manager disabled in configuration');
      return;
    }

    try {
      this.logger.info('Initializing Planning Manager...');
      const planningConfig = config.managersConfig?.planningManager || {};
      const { DefaultPlanningManager } = await import('../../../lib/agents/implementations/managers/DefaultPlanningManager');
      const planningManager = new DefaultPlanningManager(agent, planningConfig);
      this.managers.set(ManagerType.PLANNING, planningManager);
      this.logger.info('Planning Manager initialized successfully');
      
    } catch (error) {
      this.logger.error('Error initializing Planning Manager:', { error: error instanceof Error ? error.message : String(error) });
      errors.push({ managerType: 'planning', error: error as Error });
    }
  }

  /**
   * Initialize tool manager
   */
  private async initializeToolManager(
    agent: AgentBase,
    config: AgentInitializationConfig,
    errors: Array<{ managerType: string; error: Error }>
  ): Promise<void> {
    if (!config.enableToolManager) {
      this.logger.info('Tool Manager disabled in configuration');
      return;
    }

    try {
      this.logger.info('Initializing Tool Manager...');
      const toolConfig = config.managersConfig?.toolManager || {};
      const { DefaultToolManager } = await import('../../../lib/agents/implementations/managers/DefaultToolManager');
      const toolManager = new DefaultToolManager(agent, toolConfig);
      
      // CRITICAL: Initialize the tool manager BEFORE registering tools
      const initialized = await toolManager.initialize();
      if (!initialized) {
        throw new Error('Tool manager initialization failed');
      }
      
      // Store the manager in the map so it can be found by other processes
      this.managers.set(ManagerType.TOOL, toolManager);
      
      // Now register shared tools AFTER initialization
      await this.registerSharedTools(toolManager);
      
      this.logger.info('Tool Manager initialized successfully');
      
    } catch (error) {
      this.logger.error('Error initializing Tool Manager:', { error: error instanceof Error ? error.message : String(error) });
      errors.push({ managerType: 'tool', error: error as Error });
    }
  }

  /**
   * Register shared tools with the tool manager
   */
  private async registerSharedTools(toolManager: DefaultToolManager): Promise<void> {
    try {
      this.logger.info('Registering shared tools...');
      
      // Register send_message tool (required for message delivery during task execution)
      try {
        const { createSendMessageTool } = await import('../tools/messaging/SendMessageTool');
        const sendMessageToolInstance = createSendMessageTool();
        
        // Wrap the tool with the same pattern as other tools to ensure interface compatibility
        const sendMessageTool = {
          id: sendMessageToolInstance.id,
          name: sendMessageToolInstance.name,
          description: sendMessageToolInstance.description,
          version: sendMessageToolInstance.version,
          categories: sendMessageToolInstance.categories,
          capabilities: sendMessageToolInstance.capabilities,
          enabled: sendMessageToolInstance.enabled,
          experimental: sendMessageToolInstance.experimental,
          costPerUse: sendMessageToolInstance.costPerUse,
          timeoutMs: sendMessageToolInstance.timeoutMs,
          execute: async (params: unknown, context?: unknown): Promise<unknown> => {
            // Use the original tool's execute method
            const result = await sendMessageToolInstance.execute(params, context);
            return result;
          }
        };
        
        await toolManager.registerTool(sendMessageTool);
        this.logger.info('Registered send_message tool successfully', {
          toolId: sendMessageTool.id,
          toolName: sendMessageTool.name
        });
      } catch (sendMessageError) {
        this.logger.warn('Failed to register send_message tool:', {
          error: sendMessageError instanceof Error ? sendMessageError.message : String(sendMessageError)
        });
      }
      
      // Register Coda tools from the adapter
      try {
        const { createAllCodaTools } = await import('../tools/adapters/CodaToolAdapter');
        const codaTools = createAllCodaTools();
        
        let registeredCount = 0;
        for (const tool of codaTools) {
          try {
            // Convert to the ToolManager interface format
            const managerTool = {
              id: tool.id,
              name: tool.name,
              description: tool.description,
              version: (tool.metadata?.version as string) || '1.0.0',
              categories: [tool.category],
              capabilities: [],
              enabled: tool.enabled,
              experimental: false,
              costPerUse: (tool.metadata?.costEstimate as number) || 1,
              timeoutMs: 30000,
              metadata: tool.metadata,
              execute: async (params: unknown, context?: unknown): Promise<unknown> => {
                // Adapt the execute function signature
                const args = (params as Record<string, unknown>) || {};
                const result = await tool.execute(args);
                return result.data;
              }
            };
            await toolManager.registerTool(managerTool);
            registeredCount++;
            this.logger.info(`Registered Coda tool: ${tool.id}`, {
              toolName: tool.name,
              category: tool.category,
              enabled: tool.enabled
            });
          } catch (toolError) {
            this.logger.warn(`Failed to register Coda tool ${tool.id}:`, {
              error: toolError instanceof Error ? toolError.message : String(toolError)
            });
          }
        }
        
        this.logger.info(`Successfully registered ${registeredCount}/${codaTools.length} Coda tools`);
        
      } catch (codaError) {
        this.logger.warn('Failed to import or register Coda tools:', {
          error: codaError instanceof Error ? codaError.message : String(codaError)
        });
      }
      
      // Register other shared tools from SharedToolRegistry
      try {
        const { SharedToolRegistry } = await import('../tools/registry/SharedToolRegistry');
        const sharedToolRegistry = new SharedToolRegistry();
        await sharedToolRegistry.ensureInitialized();
        
        const sharedTools = sharedToolRegistry.getAllTools();
        let sharedRegisteredCount = 0;
        
        for (const tool of sharedTools) {
          try {
            // Convert shared tools to ToolManager interface format
            const managerTool = {
              id: tool.id,
              name: tool.name,
              description: tool.description,
              version: '1.0.0',
              categories: [tool.category],
              capabilities: [],
              enabled: tool.enabled,
              experimental: false,
              costPerUse: 1,
              timeoutMs: 30000,
              metadata: tool.metadata,
              execute: async (params: unknown, context?: unknown): Promise<unknown> => {
                // Adapt the execute function signature
                const args = (params as Record<string, unknown>) || {};
                const result = await tool.execute(args);
                return result.data;
              }
            };
            await toolManager.registerTool(managerTool);
            sharedRegisteredCount++;
            this.logger.info(`Registered shared tool: ${tool.id}`, {
              toolName: tool.name,
              category: tool.category,
              enabled: tool.enabled
            });
          } catch (toolError) {
            this.logger.warn(`Failed to register shared tool ${tool.id}:`, {
              error: toolError instanceof Error ? toolError.message : String(toolError)
            });
          }
        }
        
        this.logger.info(`Successfully registered ${sharedRegisteredCount}/${sharedTools.length} shared tools from registry`);
        
      } catch (registryError) {
        this.logger.warn('Failed to register tools from SharedToolRegistry:', {
          error: registryError instanceof Error ? registryError.message : String(registryError)
        });
      }
      
      this.logger.info('Shared tools registration completed');
      
    } catch (error) {
      this.logger.error('Error during shared tools registration:', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new AgentInitializationError(
        'Failed to register shared tools',
        'SHARED_TOOLS_REGISTRATION_FAILED',
        { originalError: error }
      );
    }
  }

  /**
   * Initialize knowledge manager
   */
  private async initializeKnowledgeManager(
    agent: AgentBase,
    config: AgentInitializationConfig,
    errors: Array<{ managerType: string; error: Error }>
  ): Promise<void> {
    if (!config.enableKnowledgeManager) {
      this.logger.info('Knowledge Manager disabled in configuration');
      return;
    }

    try {
      this.logger.info('Initializing Knowledge Manager...');
      const knowledgeConfig = config.managersConfig?.knowledgeManager || {};
      const { DefaultKnowledgeManager } = await import('../../../lib/agents/implementations/managers/DefaultKnowledgeManager');
      const knowledgeManager = new DefaultKnowledgeManager(agent, knowledgeConfig);
      this.managers.set(ManagerType.KNOWLEDGE, knowledgeManager);
      this.logger.info('Knowledge Manager initialized successfully');
      
    } catch (error) {
      this.logger.error('Error initializing Knowledge Manager:', { error: error instanceof Error ? error.message : String(error) });
      errors.push({ managerType: 'knowledge', error: error as Error });
    }
  }

  /**
   * Initialize scheduler manager
   */
  private async initializeSchedulerManager(
    agent: AgentBase,
    config: AgentInitializationConfig,
    errors: Array<{ managerType: string; error: Error }>
  ): Promise<void> {
    if (!config.enableSchedulerManager) {
      this.logger.info('Scheduler Manager disabled in configuration');
      return;
    }

    try {
      this.logger.info('Initializing Scheduler Manager...');
      
      const schedulerConfig = config.managersConfig?.schedulerManager || {};
      
      // Import the agent-specific scheduler factory
      const { createSchedulerManagerForAgent } = await import('../../../lib/scheduler/factories/SchedulerFactory');
      
      // Use agent-specific scheduler that only handles tasks for this agent
      this.schedulerManager = await createSchedulerManagerForAgent({
        enabled: true,
        enableAutoScheduling: true, // Enable auto-scheduling for agent-specific schedulers
        ...schedulerConfig
      }, agent.getId()); // Pass agent ID for filtering
      
      // Register the scheduler manager with the managers map so it can be found by getManager()
      if (this.schedulerManager) {
        this.managers.set(ManagerType.SCHEDULER, this.schedulerManager as any);
        
        // CRITICAL FIX: Start the scheduler so it begins polling for due tasks
        try {
          await this.schedulerManager.startScheduler();
          this.logger.info(`Scheduler Manager started successfully for agent ${agent.getId()} - now polling for due tasks`);
        } catch (startError) {
          this.logger.error(`Failed to start scheduler for agent ${agent.getId()}:`, { 
            error: startError instanceof Error ? startError.message : String(startError) 
          });
          throw startError;
        }
      }
      
      this.logger.info('Scheduler Manager initialized and started successfully');
      
    } catch (error) {
      this.logger.error(`CRITICAL: Failed to initialize scheduler manager for agent ${agent.getId()}:`, { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        agentId: agent.getId()
      });
      errors.push({ managerType: 'scheduler', error: error as Error });
      
      // IMPORTANT: Scheduler failure is now considered critical - do not continue
      console.error(`❌ CRITICAL: Agent ${agent.getId()} scheduler initialization failed: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`❌ This agent will not have a running scheduler and cannot process scheduled tasks!`);
      
      // For now, continue but with very visible warnings
      // TODO: Consider making this fatal in production
    }
  }

  /**
   * Initialize reflection manager
   */
  private async initializeReflectionManager(
    agent: AgentBase,
    config: AgentInitializationConfig,
    errors: Array<{ managerType: string; error: Error }>
  ): Promise<void> {
    if (!config.enableReflectionManager) {
      this.logger.info('Reflection Manager disabled in configuration');
      return;
    }

    try {
      this.logger.info('Initializing Reflection Manager...');
      
      const reflectionConfig = config.managersConfig?.reflectionManager || {};
      
      let reflectionManager: BaseManager;
      
      if (config.useEnhancedReflection) {
        this.logger.info('Using Enhanced Reflection Manager');
        reflectionManager = new EnhancedReflectionManager(agent, reflectionConfig);
      } else {
        this.logger.info('Using Default Reflection Manager');
        reflectionManager = new DefaultReflectionManager(agent, reflectionConfig);
      }
      
      this.managers.set(ManagerType.REFLECTION, reflectionManager);
      this.logger.info('Reflection Manager initialized successfully');
      
    } catch (error) {
      this.logger.error('Error initializing Reflection Manager:', { error: error instanceof Error ? error.message : String(error) });
      errors.push({ managerType: 'reflection', error: error as Error });
    }
  }

  /**
   * Initialize input processor
   */
  private async initializeInputProcessor(
    agent: AgentBase,
    config: AgentInitializationConfig,
    errors: Array<{ managerType: string; error: Error }>
  ): Promise<void> {
    if (!config.enableInputProcessor) {
      this.logger.info('Input Processor disabled in configuration');
      return;
    }

    try {
      this.logger.info('Initializing Input Processor...');
      const inputConfig = config.managersConfig?.inputProcessor || {};
      const { DefaultInputProcessor } = await import('../input/managers/DefaultInputProcessor');
      const inputProcessor = new DefaultInputProcessor(agent, inputConfig);
      this.managers.set(ManagerType.INPUT_PROCESSOR, inputProcessor);
      this.logger.info('Input Processor initialized successfully');
      
    } catch (error) {
      this.logger.error('Error initializing Input Processor:', { error: error instanceof Error ? error.message : String(error) });
      errors.push({ managerType: 'input_processor', error: error as Error });
    }
  }

  /**
   * Initialize output processor
   */
  private async initializeOutputProcessor(
    agent: AgentBase,
    config: AgentInitializationConfig,
    errors: Array<{ managerType: string; error: Error }>
  ): Promise<void> {
    if (!config.enableOutputProcessor) {
      this.logger.info('Output Processor disabled in configuration');
      return;
    }

    try {
      this.logger.info('Initializing Output Processor...');
      const outputConfig = config.managersConfig?.outputProcessor || {};
      const { DefaultOutputProcessor } = await import('../output/managers/DefaultOutputProcessor');
      const outputProcessor = new DefaultOutputProcessor(agent, outputConfig);
      this.managers.set(ManagerType.OUTPUT_PROCESSOR, outputProcessor);
      this.logger.info('Output Processor initialized successfully');
      
    } catch (error) {
      this.logger.error('Error initializing Output Processor:', { error: error instanceof Error ? error.message : String(error) });
      errors.push({ managerType: 'output_processor', error: error as Error });
    }
  }

  /**
   * Initialize opportunity manager
   */
  private async initializeOpportunityManager(
    agent: AgentBase,
    config: AgentInitializationConfig,
    errors: Array<{ managerType: string; error: Error }>
  ): Promise<void> {
    try {
      this.logger.info('Initializing Opportunity Manager...');
      
      // Skip opportunity manager initialization for now - requires complex setup
      this.logger.info('Opportunity Manager initialization skipped - requires component setup');
      
    } catch (error) {
      this.logger.error('Error initializing Opportunity Manager:', { error: error instanceof Error ? error.message : String(error) });
      errors.push({ managerType: 'opportunity', error: error as Error });
      // Continue without the opportunity manager - it's not critical
    }
  }

  /**
   * Wire managers together for cross-manager communication
   */
  private wireManagersTogether(): void {
    try {
      this.logger.info('Wiring managers together...');
      
      // Wire memory manager to other managers
      const memoryManager = this.managers.get(ManagerType.MEMORY);
      const planningManager = this.managers.get(ManagerType.PLANNING);
      const toolManager = this.managers.get(ManagerType.TOOL);
      const knowledgeManager = this.managers.get(ManagerType.KNOWLEDGE);
      
      // Set up cross-references if managers exist and support it
      if (memoryManager && planningManager && typeof (planningManager as any).setMemoryManager === 'function') {
        (planningManager as any).setMemoryManager(memoryManager);
      }
      
      if (memoryManager && toolManager && typeof (toolManager as any).setMemoryManager === 'function') {
        (toolManager as any).setMemoryManager(memoryManager);
      }
      
      if (memoryManager && knowledgeManager && typeof (knowledgeManager as any).setMemoryManager === 'function') {
        (knowledgeManager as any).setMemoryManager(memoryManager);
      }
      
      this.logger.info('Manager wiring completed');
      
    } catch (error) {
      this.logger.error('Error wiring managers together:', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Initialize all managers that support initialization
   */
  private async initializeAllManagers(
    errors: Array<{ managerType: string; error: Error }>
  ): Promise<void> {
    try {
      this.logger.info('Initializing all managers...');
      
      // Initialize each manager that supports it
      for (const [managerType, manager] of Array.from(this.managers.entries())) {
        if (typeof (manager as any).initialize === 'function') {
          try {
            this.logger.info(`Initializing manager: ${managerType}`);
            await (manager as any).initialize();
            
            // Check if manager has an _initialized flag
            const isInitialized = (manager as any)._initialized;
            this.logger.info(`Manager ${managerType} _initialized flag: ${isInitialized}`);
          } catch (managerError) {
            this.logger.error(`ERROR initializing manager ${managerType}:`, { error: managerError instanceof Error ? managerError.message : String(managerError) });
            errors.push({ managerType: managerType.toString(), error: managerError as Error });
          }
        } else {
          this.logger.info(`Manager ${managerType} does not support initialization`);
        }
      }
      
    } catch (error) {
      this.logger.error('Error during manager initialization:', { error: error instanceof Error ? error.message : String(error) });
      errors.push({ managerType: 'all_managers', error: error as Error });
    }
  }

  /**
   * Clean up resources
   */
  private async cleanup(): Promise<void> {
    try {
      this.logger.info('Cleaning up initialization resources...');
      
      // Shutdown all managers
      for (const [managerType, manager] of Array.from(this.managers.entries())) {
        try {
          if (typeof (manager as any).shutdown === 'function') {
            await (manager as any).shutdown();
          }
        } catch (error) {
          this.logger.error(`Error shutting down manager ${managerType}:`, { error: error instanceof Error ? error.message : String(error) });
        }
      }
      
      // Shutdown scheduler manager
      if (this.schedulerManager && typeof this.schedulerManager.shutdown === 'function') {
        try {
          await this.schedulerManager.shutdown();
        } catch (error) {
          this.logger.error('Error shutting down scheduler manager:', { error: error instanceof Error ? error.message : String(error) });
        }
      }
      
      // Shutdown opportunity manager
      if (this.opportunityManager && typeof (this.opportunityManager as any).shutdown === 'function') {
        try {
          await (this.opportunityManager as any).shutdown();
        } catch (error) {
          this.logger.error('Error shutting down opportunity manager:', { error: error instanceof Error ? error.message : String(error) });
        }
      }
      
      // Clear collections
      this.managers.clear();
      this.schedulerManager = undefined;
      this.opportunityManager = undefined;
      
      this.logger.info('Cleanup completed');
      
    } catch (error) {
      this.logger.error('Error during cleanup:', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Get initialized managers
   */
  getManagers(): Map<ManagerType, BaseManager> {
    return this.managers;
  }

  /**
   * Get scheduler manager
   */
  getSchedulerManager(): ModularSchedulerManager | undefined {
    return this.schedulerManager;
  }

  /**
   * Get opportunity manager
   */
  getOpportunityManager(): OpportunityManager | undefined {
    return this.opportunityManager;
  }

  /**
   * Initialize ethics manager
   */
  private async initializeEthicsManager(
    agent: AgentBase,
    config: AgentInitializationConfig,
    errors: Array<{ managerType: string; error: Error }>
  ): Promise<void> {
    if (!config.enableEthicsManager) {
      this.logger.info('Ethics Manager disabled in configuration');
      return;
    }

    try {
      this.logger.info('Initializing Ethics Manager...');
      const ethicsConfig = config.managersConfig?.ethicsManager || { enabled: false };
      const { DefaultEthicsManager } = await import('../../../lib/agents/implementations/managers/DefaultEthicsManager');
      const ethicsManager = new DefaultEthicsManager(agent, ethicsConfig);
      this.managers.set(ManagerType.ETHICS, ethicsManager);
      this.logger.info('Ethics Manager initialized successfully');
      
    } catch (error) {
      this.logger.error('Error initializing Ethics Manager:', { error: error instanceof Error ? error.message : String(error) });
      errors.push({ managerType: 'ethics', error: error as Error });
    }
  }

  /**
   * Initialize collaboration manager
   */
  private async initializeCollaborationManager(
    agent: AgentBase,
    config: AgentInitializationConfig,
    errors: Array<{ managerType: string; error: Error }>
  ): Promise<void> {
    if (!config.enableCollaborationManager) {
      this.logger.info('Collaboration Manager disabled in configuration');
      return;
    }

    try {
      this.logger.info('Initializing Collaboration Manager...');
      const collaborationConfig = config.managersConfig?.collaborationManager || { enabled: false };
      const { DefaultCollaborationManager } = await import('../../../lib/agents/implementations/managers/DefaultCollaborationManager');
      const collaborationManager = new DefaultCollaborationManager(agent, collaborationConfig);
      this.managers.set(ManagerType.COLLABORATION, collaborationManager);
      this.logger.info('Collaboration Manager initialized successfully');
      
    } catch (error) {
      this.logger.error('Error initializing Collaboration Manager:', { error: error instanceof Error ? error.message : String(error) });
      errors.push({ managerType: 'collaboration', error: error as Error });
    }
  }

  /**
   * Initialize communication manager
   */
  private async initializeCommunicationManager(
    agent: AgentBase,
    config: AgentInitializationConfig,
    errors: Array<{ managerType: string; error: Error }>
  ): Promise<void> {
    if (!config.enableCommunicationManager) {
      this.logger.info('Communication Manager disabled in configuration');
      return;
    }

    try {
      this.logger.info('Initializing Communication Manager...');
      const communicationConfig = config.managersConfig?.communicationManager || { enabled: false };
      const { DefaultCommunicationManager } = await import('../../../lib/agents/implementations/managers/DefaultCommunicationManager');
      const communicationManager = new DefaultCommunicationManager(agent, communicationConfig);
      this.managers.set(ManagerType.COMMUNICATION, communicationManager);
      this.logger.info('Communication Manager initialized successfully');
      
    } catch (error) {
      this.logger.error('Error initializing Communication Manager:', { error: error instanceof Error ? error.message : String(error) });
      errors.push({ managerType: 'communication', error: error as Error });
    }
  }

  /**
   * Initialize notification manager wrapper
   */
  private async initializeNotificationManagerWrapper(
    agent: AgentBase,
    config: AgentInitializationConfig,
    errors: Array<{ managerType: string; error: Error }>
  ): Promise<void> {
    if (!config.enableNotificationManager) {
      this.logger.info('Notification Manager disabled in configuration');
      return;
    }

    try {
      this.logger.info('Initializing Notification Manager Wrapper...');
      const notificationConfig = config.managersConfig?.notificationManager || { enabled: false };
      const { DefaultNotificationManagerWrapper } = await import('../../../lib/agents/implementations/managers/DefaultNotificationManagerWrapper');
      const notificationManager = new DefaultNotificationManagerWrapper(agent, notificationConfig);
      this.managers.set(ManagerType.NOTIFICATION, notificationManager);
      this.logger.info('Notification Manager Wrapper initialized successfully');
      
    } catch (error) {
      this.logger.error('Error initializing Notification Manager Wrapper:', { error: error instanceof Error ? error.message : String(error) });
      errors.push({ managerType: 'notification', error: error as Error });
    }
  }
} 