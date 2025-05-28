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
        level: LogLevel.DEBUG,
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
      
      // Register shared tools
      await this.registerSharedTools(toolManager);
      
      this.managers.set(ManagerType.TOOL, toolManager);
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
      
      // Skip shared tools registration since the module doesn't exist yet
      // This can be implemented later when the shared tools module is created
      this.logger.info('Shared tools module not available, skipping registration');
      this.logger.info('Tools can be registered individually using toolManager.registerTool() later');
      
    } catch (error) {
      this.logger.warn('Failed to register shared tools:', { error: error instanceof Error ? error.message : String(error) });
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
      // Use factory function to create scheduler manager with agent instance
      try {
        this.schedulerManager = await createSchedulerManager({
          enabled: true,
          ...schedulerConfig
        }, agent); // Pass the agent instance to enable AgentAwareTaskExecutor
        
        // Register the scheduler manager with the managers map so it can be found by getManager()
        if (this.schedulerManager) {
          this.managers.set(ManagerType.SCHEDULER, this.schedulerManager as any);
        }
      } catch (importError) {
        this.logger.warn('Failed to create scheduler manager, skipping scheduler initialization');
        errors.push({ managerType: 'scheduler', error: new Error('Failed to create scheduler manager') });
      }
      this.logger.info('Scheduler Manager initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize scheduler manager:', { error: error instanceof Error ? error.message : String(error) });
      errors.push({ managerType: 'scheduler', error: error as Error });
      // Continue without scheduler manager - not critical for basic operation
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
} 