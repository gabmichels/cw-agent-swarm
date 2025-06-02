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
import { InputProcessorConfig } from './base/managers/InputProcessor.interface';
import { OutputProcessorConfig } from './base/managers/OutputProcessor.interface';

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
import { PlanCreationOptions, PlanCreationResult, PlanExecutionResult, PlanningManager } from './base/managers/PlanningManager.interface';
import { ReflectionResult } from './base/managers/ReflectionManager.interface';
import { MemoryManager, MemoryEntry } from './base/managers/MemoryManager.interface';

// Import types for configuration
import { PromptFormatter, PersonaInfo } from './messaging/PromptFormatter';
import { ResourceUtilizationTracker, ResourceUtilizationTrackerOptions, ResourceUsageListener } from './scheduler/ResourceUtilization';
import { OpportunityManager } from '../../lib/opportunity';

// Import processInputWithLangChain helper at the top
import { processInputWithLangChain } from './processInput';
import { ChatOpenAI } from '@langchain/openai';

// Import ThinkingService and related types
import { ThinkingService } from '../../services/thinking/ThinkingService';
import { ImportanceCalculatorService, ImportanceCalculationMode } from '../../services/importance/ImportanceCalculatorService';
import { getLLM } from '../../lib/core/llm';

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
    enabled: boolean;
    interval: number;
    maxCriticalMemories: number;
  };
  
  // Component configurations
  componentsConfig?: {
    // Core component configurations
    initializer?: Record<string, unknown>;
    lifecycleManager?: Record<string, unknown>;
    communicationHandler?: Record<string, unknown>;
    executionEngine?: Record<string, unknown>;
    inputProcessor?: Record<string, unknown>;
    outputProcessor?: Record<string, unknown>;
    thinkingProcessor?: Record<string, unknown>;
    configValidator?: Record<string, unknown>;
    resourceTracker?: Partial<ResourceUtilizationTrackerOptions>;
    
    // Manager configurations
    memoryManager?: { enabled: boolean; [key: string]: unknown };
    planningManager?: { enabled: boolean; [key: string]: unknown };
    toolManager?: { enabled: boolean; [key: string]: unknown };
    knowledgeManager?: { enabled: boolean; [key: string]: unknown };
    schedulerManager?: { enabled: boolean; [key: string]: unknown };
    reflectionManager?: { enabled: boolean; [key: string]: unknown };
    
    // New manager configurations (Phase 2 integration)
    ethicsManager?: { enabled: boolean; [key: string]: unknown };
    collaborationManager?: { enabled: boolean; [key: string]: unknown };
    communicationManager?: { enabled: boolean; [key: string]: unknown };
    notificationManager?: { enabled: boolean; [key: string]: unknown };
    
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
  
  // Add ThinkingService for proper thought storage
  private thinkingService: ThinkingService | null = null;
  
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

  // getId() and getAgentId() inherited from AbstractAgentBase
  // (using this.agentId internally for consistency with existing code)

  /**
   * Get the agent's type
   */
  getType(): string {
    return this.agentType;
  }

  // getDescription() and getVersion() inherited from AbstractAgentBase
  // (DefaultAgent uses custom values set in constructor)

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
      
      // Map componentsConfig to the format AgentInitializer expects
      const initConfig: AgentInitializationConfig = {
        ...this.agentConfig,
        // Map componentsConfig manager settings to enable flags
        enableMemoryManager: this.agentConfig.enableMemoryManager || this.agentConfig.componentsConfig?.memoryManager?.enabled || false,
        enablePlanningManager: this.agentConfig.enablePlanningManager || this.agentConfig.componentsConfig?.planningManager?.enabled || false,
        enableToolManager: this.agentConfig.enableToolManager || this.agentConfig.componentsConfig?.toolManager?.enabled || false,
        enableKnowledgeManager: this.agentConfig.enableKnowledgeManager || this.agentConfig.componentsConfig?.knowledgeManager?.enabled || false,
        enableSchedulerManager: this.agentConfig.enableSchedulerManager || this.agentConfig.componentsConfig?.schedulerManager?.enabled || false,
        enableReflectionManager: this.agentConfig.enableReflectionManager || this.agentConfig.componentsConfig?.reflectionManager?.enabled || false,
        
        // New manager enablement flags (Phase 2 integration)
        enableEthicsManager: this.agentConfig.enableEthicsManager || this.agentConfig.componentsConfig?.ethicsManager?.enabled || false,
        enableCollaborationManager: this.agentConfig.enableCollaborationManager || this.agentConfig.componentsConfig?.collaborationManager?.enabled || false,
        enableCommunicationManager: this.agentConfig.enableCommunicationManager || this.agentConfig.componentsConfig?.communicationManager?.enabled || false,
        enableNotificationManager: this.agentConfig.enableNotificationManager || this.agentConfig.componentsConfig?.notificationManager?.enabled || false,
        
        // Map componentsConfig to managersConfig for AgentInitializer
        managersConfig: {
          memoryManager: this.agentConfig.componentsConfig?.memoryManager || { enabled: this.agentConfig.enableMemoryManager || false },
          planningManager: this.agentConfig.componentsConfig?.planningManager || { enabled: this.agentConfig.enablePlanningManager || false },
          toolManager: this.agentConfig.componentsConfig?.toolManager || { enabled: this.agentConfig.enableToolManager || false },
          knowledgeManager: this.agentConfig.componentsConfig?.knowledgeManager || { enabled: this.agentConfig.enableKnowledgeManager || false },
          schedulerManager: this.agentConfig.componentsConfig?.schedulerManager || { enabled: this.agentConfig.enableSchedulerManager || false },
          reflectionManager: this.agentConfig.componentsConfig?.reflectionManager || { enabled: this.agentConfig.enableReflectionManager || false },
          inputProcessor: this.agentConfig.componentsConfig?.inputProcessor as InputProcessorConfig || { enabled: this.agentConfig.enableInputProcessor || false },
          outputProcessor: this.agentConfig.componentsConfig?.outputProcessor as OutputProcessorConfig || { enabled: this.agentConfig.enableOutputProcessor || false },
          resourceTracker: this.agentConfig.componentsConfig?.resourceTracker || {},
          
          // New manager configurations (Phase 2 integration)
          ethicsManager: this.agentConfig.componentsConfig?.ethicsManager || { enabled: this.agentConfig.enableEthicsManager || false },
          collaborationManager: this.agentConfig.componentsConfig?.collaborationManager || { enabled: this.agentConfig.enableCollaborationManager || false },
          communicationManager: this.agentConfig.componentsConfig?.communicationManager || { enabled: this.agentConfig.enableCommunicationManager || false },
          notificationManager: this.agentConfig.componentsConfig?.notificationManager || { enabled: this.agentConfig.enableNotificationManager || false }
        }
      };
      
      const initResult = await this.initializer.initializeAgent(this, initConfig);
      if (!initResult.success) {
        this.logger.error("Component initialization failed", { errors: initResult.errors });
        return false;
      }
      
      // Register all managers with the base class
      for (const [managerType, manager] of initResult.managers) {
        this.setManager(manager);
        this.logger.info('Registered manager', {
          managerType: managerType.toString(),
          managerName: manager.constructor.name,
          hasInitialize: typeof (manager as any).initialize === 'function',
          hasPlanAndExecute: 'planAndExecute' in manager
        });
      }
      
      // Store scheduler manager reference
      if (initResult.schedulerManager) {
        this.schedulerManager = initResult.schedulerManager;
      }
      
      // Store opportunity manager reference
      if (initResult.opportunityManager) {
        this.opportunityManager = initResult.opportunityManager;
      }
      
      this.logger.system("Component initialization passed", {
        managersRegistered: initResult.managers.size,
        finalManagersCount: this.managers.size,
        finalManagers: Array.from(this.managers.keys()).map(key => key.toString())
      });
      
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
      
      // Step 6.5: Initialize ThinkingService for proper thought storage
      try {
        // Create a generic LLM service wrapper using shared factory - no business logic here
        const llmService = {
          generateStructuredOutput: async <T>(
            model: string,
            prompt: string,
            outputSchema: Record<string, unknown>
          ): Promise<T> => {
            // Use the shared getLLM factory with cheap model for importance calculation
            const cheapModel = getLLM({ 
              useCheapModel: true, 
              temperature: 0.3, 
              maxTokens: 300 
            });
            
            try {
              const response = await cheapModel.invoke(prompt);
              const content = typeof response === 'string' ? response : response.content;
              
              // Try to parse as JSON first (for structured output)
              try {
                return JSON.parse(content) as T;
              } catch {
                // If not JSON, return the content as-is and let the caller handle it
                return content as T;
              }
            } catch (error) {
              this.logger.warn('LLM call failed, throwing error for ImportanceCalculatorService to handle', { error });
              throw error; // Let ImportanceCalculatorService handle the fallback logic
            }
          }
        };
        
        const importanceCalculator = new ImportanceCalculatorService(llmService, {
          defaultMode: ImportanceCalculationMode.RULE_BASED, // Use rule-based by default to save costs
          hybridConfidenceThreshold: 0.8 // Only use LLM if rule-based confidence is very low
        });
        this.thinkingService = new ThinkingService(importanceCalculator);
        this.logger.system("ThinkingService initialized with shared LLM factory - thoughts will now be stored in the thoughts collection via CognitiveArtifactService");
      } catch (error) {
        this.logger.warn("Failed to initialize ThinkingService, falling back to ThinkingProcessor only - thoughts will only appear in message conversationContext", { error });
      }
      
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
      
      // Clean up ThinkingService
      if (this.thinkingService) {
        this.thinkingService = null;
        this.logger.system("ThinkingService cleaned up");
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
   * Get LLM response - uses actual LLM with thinking context
   */
  async getLLMResponse(message: string, options?: GetLLMResponseOptions): Promise<AgentResponse> {
    try {
      this.logger.info('Getting LLM response', {
        message: message.substring(0, 100),
        hasThinkingResult: !!options?.thinkingResult,
        hasConversationHistory: !!(options?.conversationHistory && Array.isArray(options.conversationHistory) && options.conversationHistory.length > 0)
      });

      // Check if we have a mock model for testing
      const mockModel = (this as any).model;
      let llmContent: string;

      if (mockModel && typeof mockModel.invoke === 'function') {
        // Use the mock model for testing
        this.logger.debug('Using mock model for testing');
        
        // Prepare enhanced input with thinking context
        let enhancedInput = message;
        
        if (options?.thinkingResult) {
          const thinking = options.thinkingResult;
          
          // Get formatted memory context from thinking results
          const memoryContext = thinking.context?.formattedMemoryContext || '';
          const memoryContextSection = memoryContext ? 
            `\nRelevant Memory Context:\n${memoryContext}` : '';
          
          enhancedInput = `User Input: ${message}

Context from thinking analysis:
- Intent: ${thinking.intent.primary} (confidence: ${thinking.intent.confidence})
- Entities: ${thinking.entities.map(e => `${e.value} (${e.type})`).join(', ')}
- Complexity: ${thinking.complexity}/10
- Priority: ${thinking.priority}/10
- Is Urgent: ${thinking.isUrgent}
- Required Capabilities: ${thinking.requiredCapabilities.join(', ')}
${thinking.reasoning && thinking.reasoning.length > 0 ? `- Reasoning: ${thinking.reasoning.join('; ')}` : ''}${memoryContextSection}

Please provide a helpful, contextual response based on this analysis and memory context.`;
        }

        try {
          // Call the mock model
          const mockResult = await mockModel.invoke(enhancedInput);
          llmContent = typeof mockResult === 'string' ? mockResult : mockResult.content;
        } catch (mockError) {
          // If mock model throws, we should also throw to match expected test behavior
          const { LLMResponseError, AgentErrorCodes } = await import('./errors/AgentErrors');
          throw new LLMResponseError(
            `LLM inference failed: ${mockError instanceof Error ? mockError.message : String(mockError)}`,
            AgentErrorCodes.LLM_RESPONSE_FAILED,
            { originalError: mockError }
          );
        }
      } else {
        // Use real LLM for production using shared factory
        this.logger.debug('Using shared LLM factory for production');
        
        // Use shared LLM factory with agent configuration
        const model = getLLM({
          modelName: this.agentConfig.modelName || process.env.OPENAI_MODEL_NAME || 'gpt-4.1-2025-04-14',
          temperature: this.agentConfig.temperature || 0.7,
          maxTokens: this.agentConfig.maxTokens || (process.env.OPENAI_MAX_TOKENS ? parseInt(process.env.OPENAI_MAX_TOKENS, 10) : 32000)
        });

        // Prepare enhanced input with thinking context
        let enhancedInput = message;
        
        if (options?.thinkingResult) {
          const thinking = options.thinkingResult;
          
          // Get formatted memory context from thinking results
          const memoryContext = thinking.context?.formattedMemoryContext || '';
          const memoryContextSection = memoryContext ? 
            `\nRelevant Memory Context:\n${memoryContext}` : '';
          
          enhancedInput = `User Input: ${message}

Context from thinking analysis:
- Intent: ${thinking.intent.primary} (confidence: ${thinking.intent.confidence})
- Entities: ${thinking.entities.map(e => `${e.value} (${e.type})`).join(', ')}
- Complexity: ${thinking.complexity}/10
- Priority: ${thinking.priority}/10
- Is Urgent: ${thinking.isUrgent}
- Required Capabilities: ${thinking.requiredCapabilities.join(', ')}
${thinking.reasoning && thinking.reasoning.length > 0 ? `- Reasoning: ${thinking.reasoning.join('; ')}` : ''}${memoryContextSection}

Please provide a helpful, contextual response based on this analysis and memory context.`;
        }

        // Get conversation history - ensure it's a proper array
        const conversationHistory: MemoryEntry[] = Array.isArray(options?.conversationHistory) ? options.conversationHistory : [];

        // Generate formatted system prompt with agent configuration and persona
        const systemPrompt = await this.generateSystemPrompt();

        try {
          // Call LLM using the helper function with custom system prompt
          llmContent = await processInputWithLangChain(
            model,
            enhancedInput,
            conversationHistory,
            systemPrompt
          );
        } catch (llmError) {
          // For real LLM errors, throw LLMResponseError to match expected behavior
          const { LLMResponseError, AgentErrorCodes } = await import('./errors/AgentErrors');
          throw new LLMResponseError(
            `LLM inference failed: ${llmError instanceof Error ? llmError.message : String(llmError)}`,
            AgentErrorCodes.LLM_RESPONSE_FAILED,
            { originalError: llmError }
          );
        }
      }

      this.logger.info('LLM response received', {
        responseLength: llmContent.length,
        usedThinkingContext: !!options?.thinkingResult,
        usedConversationHistory: Array.isArray(options?.conversationHistory) ? options.conversationHistory.length : 0,
        usedMockModel: !!mockModel
      });

      // Handle memory operations for input and output
      if ((this as any).addTaggedMemory && typeof (this as any).addTaggedMemory === 'function') {
        try {
          // Store input in memory
          await (this as any).addTaggedMemory(message, {
            type: 'user_input',
            timestamp: Date.now(),
            source: 'getLLMResponse',
            ...(options?.metadata || {})
          });

          // Store response in memory
          await (this as any).addTaggedMemory(llmContent, {
            type: 'agent_response',
            timestamp: Date.now(),
            source: 'getLLMResponse',
            llmProcessed: true,
            ...(options?.metadata || {})
          });
        } catch (memoryError) {
          this.logger.warn('Memory operations failed in getLLMResponse', {
            error: memoryError instanceof Error ? memoryError.message : String(memoryError)
          });
          // Continue processing even if memory operations fail (graceful degradation)
        }
      }

      // Handle vision processing if requested
      if (options?.useVisionModel && options?.attachments && (this as any).processWithVisionModel) {
        try {
          const visionResult = await (this as any).processWithVisionModel(message, options.attachments);
          
          return {
            content: visionResult,
            thoughts: options?.thinkingResult?.reasoning || [],
            metadata: {
              ...(options?.metadata || {}),
              llmProcessed: true,
              visionUsed: true,
              modelUsed: this.agentConfig.modelName || process.env.OPENAI_MODEL_NAME || 'gpt-4.1-2025-04-14',
              temperature: this.agentConfig.temperature || 0.7,
              contextUsed: {
                thinkingResult: !!options?.thinkingResult,
                conversationHistory: Array.isArray(options?.conversationHistory) ? options.conversationHistory.length : 0,
                attachments: options.attachments.length
              },
              timestamp: new Date().toISOString(),
              agentId: this.agentId,
              agentVersion: this.version
            }
          };
        } catch (visionError) {
          this.logger.warn('Vision processing failed, continuing with text response', {
            error: visionError instanceof Error ? visionError.message : String(visionError)
          });
          // Fall through to regular text response
        }
      }

      // Prepare response with proper metadata
      const response: AgentResponse = {
        content: llmContent,
        thoughts: options?.thinkingResult?.reasoning || [],
        metadata: {
          ...(options?.metadata || {}),
          llmProcessed: true,
          modelUsed: this.agentConfig.modelName || process.env.OPENAI_MODEL_NAME || 'gpt-4.1-2025-04-14',
          temperature: this.agentConfig.temperature || 0.7,
          contextUsed: {
            thinkingResult: !!options?.thinkingResult,
            conversationHistory: Array.isArray(options?.conversationHistory) ? options.conversationHistory.length : 0,
            enhancedInput: options?.thinkingResult ? true : false,
            formattedMemoryContext: !!(options?.thinkingResult?.context?.formattedMemoryContext),
            memoryContextLength: options?.thinkingResult?.context?.formattedMemoryContext?.length || 0
          },
          timestamp: new Date().toISOString(),
          agentId: this.agentId,
          agentVersion: this.version
        }
      };

      return response;

    } catch (error) {
      this.logger.error('Error getting LLM response', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      // If it's already an AgentError (like LLMResponseError), re-throw it
      if (error && typeof error === 'object' && 'code' in error) {
        throw error;
      }

      // For unexpected errors, throw LLMResponseError
      const { LLMResponseError, AgentErrorCodes } = await import('./errors/AgentErrors');
      throw new LLMResponseError(
        `Unexpected error in getLLMResponse: ${error instanceof Error ? error.message : String(error)}`,
        AgentErrorCodes.LLM_RESPONSE_FAILED,
        { originalError: error }
      );
    }
  }

  /**
   * Process user input - orchestrates thinking and LLM response
   */
  async processUserInput(message: string, options?: MessageProcessingOptions): Promise<AgentResponse> {
    try {
      this.logger.info('Processing user input', {
        message: message.substring(0, 100),
        hasOptions: !!options
      });

      // Step 1: Thinking phase - analyze the input and determine intent
      const thinkingResult = await this.think(message, {
        userId: options?.userId,
        ...options
      });
      
      this.logger.info('=== THINKING COMPLETED - ANALYZING RESULT ===', {
        intent: thinkingResult.intent.primary,
        confidence: thinkingResult.intent.confidence,
        shouldDelegate: thinkingResult.shouldDelegate,
        complexity: thinkingResult.complexity,
        priority: thinkingResult.priority,
        reasoningLength: thinkingResult.reasoning?.length || 0,
        reasoning: thinkingResult.reasoning,
        planStepsLength: thinkingResult.planSteps?.length || 0,
        entitiesLength: thinkingResult.entities?.length || 0
      });

      // Step 2: Get memory manager for conversation history
      const memoryManager = this.getManager<MemoryManager>(ManagerType.MEMORY);
      let conversationHistory: MemoryEntry[] = [];
      
      // Check if this is a summary request to expand conversation history
      const isSummaryRequest = thinkingResult.intent?.isSummaryRequest || false;
      const conversationHistoryLimit = isSummaryRequest ? 30 : 10; // Expand for summaries
      
      if (memoryManager) {
        try {
          // Store the user input in memory first
          await memoryManager.addMemory(message, {
            type: 'user_input',
            timestamp: Date.now(),
            source: 'processUserInput',
            intent: thinkingResult.intent.primary,
            ...(options || {})
          });
          
          // Retrieve recent conversation history with expanded limit for summaries
          conversationHistory = await memoryManager.getRecentMemories(conversationHistoryLimit);
          this.logger.info('Retrieved conversation history', {
            historyCount: conversationHistory.length,
            isSummaryRequest,
            expandedLimit: conversationHistoryLimit
          });
        } catch (error) {
          this.logger.warn('Memory operations failed', {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Step 3: Check if we should create a task based on thinking results
      const shouldCreateTask = this.shouldCreateTaskFromIntent(thinkingResult, message);
      const schedulerManager = this.schedulerManager || this.getManager(ManagerType.SCHEDULER);
      const planningManager = this.getManager<PlanningManager>(ManagerType.PLANNING);

      // Debug logging to understand manager availability
      this.logger.info('Manager availability check', {
        shouldCreateTask,
        hasSchedulerManager: !!schedulerManager,
        hasPlanningManager: !!planningManager,
        schedulerManagerType: schedulerManager?.constructor?.name,
        allManagers: this.getManagers().map(m => ({
          type: (m as any).type || 'unknown',
          name: m.constructor.name
        }))
      });

      // Step 4: Enhanced options for LLM response with thinking context
      const enhancedOptions: GetLLMResponseOptions = {
        ...options,
        thinkingResult,
        thinkingResults: thinkingResult, // For backward compatibility
        conversationHistory,
        metadata: {
          ...(options?.metadata || {}),
          intent: thinkingResult.intent,
          entities: thinkingResult.entities,
          complexity: thinkingResult.complexity,
          priority: thinkingResult.priority
        }
      };

      // Step 5: Choose processing path based on intent and configuration
      let response: AgentResponse;

      if (shouldCreateTask && schedulerManager) {
        // Path A: Task creation with LLM response
        this.logger.info('Processing as task creation with LLM guidance', {
          intent: thinkingResult.intent.primary,
          priority: thinkingResult.priority,
          hasSchedulerManager: !!schedulerManager,
          hasPlanningManager: !!planningManager
        });

        // Get LLM response first to understand the request better
        const llmResponse = await this.getLLMResponse(message, enhancedOptions);
        
        // Create task based on LLM understanding
        try {
          const taskResult = await (schedulerManager as any).createTask({
            name: `Task: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`,
            description: `Task created from user input: ${message}`,
            priority: this.determinePriorityFromIntent(thinkingResult),
            metadata: {
              source: 'user_input',
              originalMessage: message,
              createdBy: 'DefaultAgent',
              llmGuidance: llmResponse.content,
              intent: thinkingResult.intent.primary,
              ...(options || {})
            }
          });

          if (taskResult && (taskResult.success || taskResult.id)) {
            const task = taskResult.task || taskResult;
            const priority = this.determinePriorityFromIntent(thinkingResult);
            const priorityText = priority >= 9 ? 'high priority' : priority >= 7 ? 'medium-high priority' : priority >= 5 ? 'medium priority' : 'low priority';
            
            response = {
              content: `${llmResponse.content}\n\nI've scheduled a ${priorityText} task to handle this properly. The task will be processed according to its priority and scheduling requirements.`,
              thoughts: llmResponse.thoughts || thinkingResult.reasoning,
              metadata: {
                ...llmResponse.metadata,
                taskCreated: true,
                taskId: task.id,
                taskPriority: priority,
                llmProcessed: true,
                thinkingAnalysis: {
                  intent: thinkingResult.intent,
                  entities: thinkingResult.entities,
                  shouldDelegate: thinkingResult.shouldDelegate,
                  requiredCapabilities: thinkingResult.requiredCapabilities,
                  complexity: thinkingResult.complexity,
                  priority: thinkingResult.priority,
                  importance: thinkingResult.importance,
                  importanceScore: thinkingResult.importanceScore
                }
              }
            };
          } else {
            // Task creation failed, return LLM response
            response = llmResponse;
          }
        } catch (error) {
          this.logger.error('Task creation failed, returning LLM response', { error });
          response = llmResponse;
        }

      } else if (planningManager && thinkingResult.complexity >= 7) {
        // Path B: Complex requests - use planning with LLM verification
        this.logger.info('Processing as complex request with planning and LLM verification', {
          intent: thinkingResult.intent.primary,
          complexity: thinkingResult.complexity
        });

        try {
          // Execute using planning manager with conversation context
          const planResult = await (planningManager as any).planAndExecute(message, {
            dryRun: false,
            maxSteps: 5,
            timeout: 180000, // 3 minutes
            conversationHistory: conversationHistory,
            thinkingContext: thinkingResult
          });

          if (planResult && planResult.success && planResult.message) {
            // Get LLM verification/enhancement of the plan result
            const llmResponse = await this.getLLMResponse(
              `Please review and enhance this response: ${planResult.message}`,
              enhancedOptions
            );

            response = {
              content: llmResponse.content,
              thoughts: llmResponse.thoughts || thinkingResult.reasoning,
              metadata: {
                ...llmResponse.metadata,
                immediateExecution: true,
                planExecuted: true,
                planResult: planResult,
                llmEnhanced: true,
                conversationHistoryUsed: conversationHistory.length > 0,
                thinkingAnalysis: {
                  intent: thinkingResult.intent,
                  entities: thinkingResult.entities,
                  shouldDelegate: thinkingResult.shouldDelegate,
                  requiredCapabilities: thinkingResult.requiredCapabilities,
                  complexity: thinkingResult.complexity,
                  priority: thinkingResult.priority,
                  importance: thinkingResult.importance,
                  importanceScore: thinkingResult.importanceScore
                }
              }
            };
          } else {
            // Plan execution failed, get direct LLM response
            response = await this.getLLMResponse(message, enhancedOptions);
          }
        } catch (error) {
          this.logger.error('Planning execution failed, falling back to direct LLM response', {
            error: error instanceof Error ? error.message : String(error)
          });
          response = await this.getLLMResponse(message, enhancedOptions);
        }

      } else {
        // Path C: Direct LLM response (the standard path)
        this.logger.info('Processing as direct LLM request', {
          intent: thinkingResult.intent.primary,
          complexity: thinkingResult.complexity
        });

        response = await this.getLLMResponse(message, enhancedOptions);
      }

      // Step 6: Ensure thoughts are included from thinking if not in LLM response
      if (!response.thoughts && thinkingResult.reasoning && thinkingResult.reasoning.length > 0) {
        response.thoughts = thinkingResult.reasoning;
      }

      // Step 7: Ensure thinking analysis is in metadata
      if (!response.metadata?.thinkingAnalysis) {
        response.metadata = {
          ...response.metadata,
          thinkingAnalysis: {
            intent: thinkingResult.intent,
            entities: thinkingResult.entities,
            shouldDelegate: thinkingResult.shouldDelegate,
            requiredCapabilities: thinkingResult.requiredCapabilities,
            complexity: thinkingResult.complexity,
            priority: thinkingResult.priority,
            importance: thinkingResult.importance,
            importanceScore: thinkingResult.importanceScore
          }
        };
      }

      // Step 8: Store the final response in memory
      if (memoryManager) {
        try {
          await memoryManager.addMemory(response.content, {
            type: 'agent_response',
            timestamp: Date.now(),
            source: 'processUserInput',
            intent: thinkingResult.intent.primary,
            llmProcessed: true,
            ...(response.metadata || {})
          });
        } catch (error) {
          this.logger.warn('Failed to store response in memory', {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      this.logger.info('User input processing completed', {
        responseLength: response.content.length,
        hasThoughts: !!response.thoughts,
        hasMetadata: !!response.metadata,
        intent: thinkingResult.intent.primary
      });

      this.logger.info('=== FINAL RESPONSE THOUGHTS CHECK (PROCESS USER INPUT) ===', {
        responseHasThoughts: !!response.thoughts,
        responseThoughtsLength: response.thoughts?.length || 0,
        responseThoughts: response.thoughts,
        thinkingResultReasoningLength: thinkingResult.reasoning?.length || 0,
        thinkingResultReasoning: thinkingResult.reasoning,
        intentPrimary: thinkingResult.intent.primary
      });

      return response;

    } catch (error) {
      this.logger.error('Error processing user input', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      // Determine error type based on the error source
      let errorType = 'general';
      if (error instanceof Error) {
        if (error.message.includes('think') || error.message.includes('thinking')) {
          errorType = 'thinking';
        } else if (error.message.includes('LLM') || error.message.includes('llm')) {
          errorType = 'llm_response';
        }
      }

      // Return error response in proper format instead of throwing
      return {
        content: "I'm sorry, but I encountered an error while processing your request. Please try again or rephrase your message.",
        thoughts: [`Error in processUserInput: ${error instanceof Error ? error.message : String(error)}`],
        metadata: {
          error: true,
          errorCode: 'PROCESSING_FAILED',
          errorType: errorType,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Determine if thinking result suggests task creation
   */
  private shouldCreateTaskFromIntent(thinkingResult: ThinkingResult, message: string): boolean {
    const intent = thinkingResult.intent.primary.toLowerCase();
    const messageContent = message.toLowerCase(); // Use actual message content
    
    // Check for explicit scheduling/timing language
    const hasTimingKeywords = [
      'schedule', 'later', 'future', 'delay', 'after', 'in 10 seconds', 'in 5 minutes',
      'tomorrow', 'next week', 'when', 'defer', 'queue', 'wait'
    ].some(keyword => messageContent.includes(keyword));
    
    // Check for multi-step complex requests that need scheduling
    const hasMultiStepKeywords = [
      'multiple steps', 'step 1', 'step 2', 'first', 'then', 'after that',
      'sequence', 'order', 'comprehensive report', 'create a report:'
    ].some(keyword => messageContent.includes(keyword));
    
    // Check for external API/tool requirements that suggest async execution
    const requiresExternalTools = [
      'api call', 'external data', 'real-time', 'bitcoin price', 'coingecko',
      'search for', 'fetch', 'retrieve', 'get current', 'latest'
    ].some(keyword => messageContent.includes(keyword));
    
    // Check for scheduling/task-related intents
    const taskIntents = [
      'schedule', 'remind', 'monitor', 'track', 'watch', 'follow_up',
      'create_task', 'add_task', 'queue', 'defer', 'later'
    ];
    
    const hasTaskIntent = taskIntents.some(taskIntent => intent.includes(taskIntent));
    
    // Check for high priority or urgent requests that should be tracked
    const isUrgent = thinkingResult.isUrgent || thinkingResult.priority >= 9;
    
    // Check for complex requests that benefit from task tracking
    const isComplex = thinkingResult.complexity >= 7;
    
    // Enhanced logic: Schedule if:
    // 1. Explicit timing/scheduling language
    // 2. Multi-step processes
    // 3. Requires external tools/APIs
    // 4. Traditional task intents
    // 5. High complexity + urgency combo
    const shouldCreate = hasTimingKeywords || 
                        hasMultiStepKeywords || 
                        requiresExternalTools ||
                        hasTaskIntent || 
                        (isUrgent && isComplex);
    
    this.logger.info('Enhanced task creation decision from intent', {
      intent: intent,
      message: message.substring(0, 100),
      hasTimingKeywords,
      hasMultiStepKeywords,
      requiresExternalTools,
      hasTaskIntent,
      isUrgent,
      isComplex,
      shouldCreate,
      priority: thinkingResult.priority,
      complexity: thinkingResult.complexity
    });
    
    return shouldCreate;
  }

  /**
   * Determine task priority based on thinking result
   */
  private determinePriorityFromIntent(thinkingResult: ThinkingResult): number {
    // Use the priority from thinking result, with adjustments
    let priority = thinkingResult.priority || 5;
    
    // Adjust based on urgency
    if (thinkingResult.isUrgent) {
      priority = Math.max(priority, 9);
    }
    
    // Adjust based on complexity (complex tasks get higher priority for proper handling)
    if (thinkingResult.complexity >= 8) {
      priority = Math.max(priority, 7);
    }
    
    return Math.min(10, Math.max(1, priority));
  }

  /**
   * Think about a message - delegates to ThinkingService (preferred) or ThinkingProcessor (fallback)
   */
  async think(message: string, options?: ThinkOptions): Promise<ThinkingResult> {
    this.logger.info('=== THINKING PIPELINE START ===', {
      message: message.substring(0, 100),
      hasThinkingService: !!this.thinkingService,
      hasThinkingProcessor: !!this.thinkingProcessor
    });

    // Try to use ThinkingService first (stores thoughts properly)
    if (this.thinkingService) {
      try {
        this.logger.info('Using ThinkingService for enhanced thought processing and storage', {
          message: message.substring(0, 100)
        });
        
        // Add timeout wrapper to prevent hanging
        const thinkingPromise = this.thinkingService.processRequest(
          options?.userId || 'user',
          message,
          {
            userId: options?.userId,
            // Pass current message ID to exclude from memory retrieval
            excludeMessageIds: options?.userMessageId ? [options?.userMessageId] : [],
            // Detect summary request from message content for memory retrieval optimization
            isSummaryRequest: this.isSimpleSummaryRequest(message),
            // Convert ThinkOptions to ThinkingOptions format
            ...(options || {})
          }
        );
        
        // Race against timeout (30 seconds for thinking - reasonable timeout for memory + LLM calls)
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('ThinkingService timeout after 30 seconds'));
          }, 30000);
        });
        
        this.logger.info('Starting ThinkingService processing with complex analysis');
        const thinkingResult = await Promise.race([thinkingPromise, timeoutPromise]);
        
        this.logger.info('=== THINKINGSERVICE SUCCESS ===', {
          intent: thinkingResult.intent.primary,
          confidence: thinkingResult.intent.confidence,
          thoughtsStored: true,
          reasoningSteps: thinkingResult.reasoning?.length || 0,
          planSteps: thinkingResult.planSteps?.length || 0,
          entities: thinkingResult.entities?.length || 0,
          detailedReasoning: thinkingResult.reasoning
        });
        
        return thinkingResult;
      } catch (error) {
        this.logger.warn('=== THINKINGSERVICE FAILED - FALLBACK TO PROCESSOR ===', {
          error: error instanceof Error ? error.message : String(error),
          isTimeout: error instanceof Error && error.message.includes('timeout')
        });
        // Fall through to ThinkingProcessor fallback
      }
    }
    
    // Fallback to ThinkingProcessor (original behavior)
    if (!this.thinkingProcessor) {
      // If no ThinkingProcessor, create a minimal thinking result
      this.logger.warn('=== NO THINKING COMPONENTS - MINIMAL RESULT ===');
      return {
        intent: {
          primary: 'user_request',
          confidence: 0.8
        },
        entities: [],
        shouldDelegate: false,
        requiredCapabilities: ['general_conversation'],
        priority: 5,
        isUrgent: false,
        complexity: 3,
        reasoning: [`Analyzed user input: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`],
        contextUsed: {
          memories: [],
          files: [],
          tools: []
        },
        planSteps: []
      };
    }
    
    this.logger.info('=== USING THINKINGPROCESSOR FALLBACK ===', {
      message: message.substring(0, 100)
    });
    
    try {
      // Add timeout to ThinkingProcessor as well (10 seconds)
      const processingPromise = this.thinkingProcessor.processThinking(message, options);
      const processingTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('ThinkingProcessor timeout after 10 seconds'));
        }, 10000);
      });
      
      const processingResult = await Promise.race([processingPromise, processingTimeoutPromise]);
      
      this.logger.info('=== THINKINGPROCESSOR SUCCESS ===', {
        confidence: processingResult.confidence,
        conclusion: processingResult.finalConclusion,
        alternatives: processingResult.alternativeConclusions?.length || 0
      });

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
    } catch (error) {
      this.logger.warn('=== THINKINGPROCESSOR ALSO FAILED - ULTIMATE FALLBACK ===', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Ultimate fallback - always return a valid thinking result
      return {
        intent: {
          primary: 'user_request',
          confidence: 0.7
        },
        entities: [],
        shouldDelegate: false,
        requiredCapabilities: ['general_conversation'],
        priority: 5,
        isUrgent: false,
        complexity: 3,
        reasoning: [`Basic analysis of: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`],
        contextUsed: {
          memories: [],
          files: [],
          tools: []
        },
        planSteps: []
      };
    }
  }

  /**
   * Create a task - delegates to SchedulerManager
   */
  async createTask(options: TaskCreationOptions): Promise<TaskCreationResult> {
    const schedulerManager = this.getManager(ManagerType.SCHEDULER);
    if (!schedulerManager || !('createTask' in schedulerManager)) {
      throw new Error('Scheduler manager not available');
    }
    
    try {
      // Use the scheduler manager's createTask method
      const result = await (schedulerManager as any).createTask(options);
      
      // Transform the result to match TaskCreationResult interface
      if (result && result.id) {
        // If the scheduler manager returned a Task object directly
        return {
          success: true,
          task: result
        };
      } else if (result && result.success !== undefined) {
        // If the scheduler manager already returned TaskCreationResult format
        return result;
      } else {
        // Fallback: assume success if we got any result
      return {
          success: !!result,
          task: result
        };
      }
    } catch (error) {
      this.logger.error('Error creating task:', { error: error instanceof Error ? error.message : String(error) });
      
      // Return proper error format - throw the error since TaskCreationResult doesn't support error field
        throw error;
    }
  }
  
  /**
   * Execute a task - delegates to SchedulerManager
   */
  async executeTask(taskId: string): Promise<TaskExecutionResult> {
    // First try to use the scheduler manager for proper task execution
    const schedulerManager = this.getManager(ManagerType.SCHEDULER);
    if (schedulerManager && 'executeTaskNow' in schedulerManager) {
      this.logger.info("Executing task via scheduler manager", { taskId });
      return (schedulerManager as any).executeTaskNow(taskId);
    }
    
    // Fallback to execution engine if no scheduler manager
    if (!this.executionEngine) {
      throw new Error('Neither scheduler manager nor execution engine available');
    }
    
    this.logger.warn("No scheduler manager available, falling back to execution engine", { taskId });
    
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
    this.logger.info('planAndExecute called', { 
      goal: typeof goal === 'string' ? goal.substring(0, 100) : `[${typeof goal}] ${JSON.stringify(goal).substring(0, 100)}`,
      options,
      managersCount: this.managers.size,
      availableManagers: Array.from(this.managers.keys()).map(key => key.toString())
    });
    
    const planningManager = this.getManager(ManagerType.PLANNING);
    
    // Check if planning manager exists and has planAndExecute method (including prototype chain)
    const hasPlanAndExecuteMethod = planningManager && 
      (typeof (planningManager as any).planAndExecute === 'function');
    
    this.logger.info('Planning manager lookup result', {
      planningManagerExists: !!planningManager,
      planningManagerType: planningManager?.constructor.name,
      hasPlanAndExecute: hasPlanAndExecuteMethod,
      managerTypeValue: ManagerType.PLANNING,
      goalType: typeof goal,
      goalIsString: typeof goal === 'string'
    });
    
    if (!planningManager || !hasPlanAndExecuteMethod) {
      this.logger.error('Planning manager not available', {
        planningManagerExists: !!planningManager,
        hasPlanAndExecuteMethod: hasPlanAndExecuteMethod,
        allManagers: Array.from(this.managers.entries()).map(([type, manager]) => ({
          type: type.toString(),
          managerName: manager.constructor.name,
          methods: Object.getOwnPropertyNames(Object.getPrototypeOf(manager))
        }))
      });
      throw new Error('Planning manager not available');
    }
    
    // Ensure goal is a string
    const goalString = typeof goal === 'string' ? goal : 
      (typeof goal === 'object' && goal && 'goalPrompt' in goal) ? 
        (goal as any).goalPrompt : 
        JSON.stringify(goal);
    
    this.logger.info('Calling planning manager planAndExecute', {
      goalString: goalString.substring(0, 100),
      options,
      planningManagerType: planningManager.constructor.name
    });

    // Use the planning manager's planAndExecute method
    return (planningManager as any).planAndExecute(goalString, options);
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

  /**
   * Get a specific task by ID
   */
  async getTask(taskId: string): Promise<Task | null> {
    const schedulerManager = this.getManager(ManagerType.SCHEDULER);
    if (schedulerManager && 'getTask' in schedulerManager) {
      return (schedulerManager as any).getTask(taskId);
    }
    return null;
  }

  /**
   * Get pending tasks
   */
  async getPendingTasks(): Promise<Task[]> {
    const schedulerManager = this.getManager(ManagerType.SCHEDULER);
    if (schedulerManager && 'getPendingTasks' in schedulerManager) {
      return (schedulerManager as any).getPendingTasks();
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

  /**
   * Generate formatted system prompt using agent configuration and persona
   * @returns Formatted system prompt that includes agent's custom instructions and persona
   */
  private async generateSystemPrompt(): Promise<string> {
    try {
      // Import PromptFormatter dynamically
      const { PromptFormatter } = await import('./messaging/PromptFormatter');
      
      // Extract system prompt from agent configuration
      const baseSystemPrompt = this.agentConfig.systemPrompt || 
                               'You are a helpful assistant. Provide concise, accurate, and helpful responses.';
      
      // Extract persona from agent configuration
      const persona = this.agentConfig.persona;
      
      // Format the system prompt with persona information
      const formattedPrompt = PromptFormatter.formatSystemPrompt({
        basePrompt: baseSystemPrompt,
        persona: persona,
        includeCapabilities: true
      });
      
      this.logger.info('Generated formatted system prompt', {
        hasPersona: !!persona,
        basePromptLength: baseSystemPrompt.length,
        formattedPromptLength: formattedPrompt.length
      });
      
      return formattedPrompt;
    } catch (error) {
      this.logger.warn('Failed to generate formatted system prompt, using base prompt', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Fallback to base system prompt or default
      return this.agentConfig.systemPrompt || 
             'You are a helpful assistant. Provide concise, accurate, and helpful responses.';
    }
  }

  /**
   * Simple detection of summary requests based on common patterns
   * This helps optimize memory retrieval before full intent analysis
   */
  private isSimpleSummaryRequest(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    
    // Common summary patterns
    const summaryPatterns = [
      'summarize', 'summary', 'recap', 'overview', 'brief',
      'what did we', 'what have we', 'can you recap',
      'give me an overview', 'what topics', 'main points',
      'key takeaways', 'highlights', 'review our',
      'what we discussed', 'what we talked about'
    ];
    
    return summaryPatterns.some(pattern => lowerMessage.includes(pattern));
  }
} 