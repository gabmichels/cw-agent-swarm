/**
 * DefaultAgent.ts - Refactored Agent Implementation
 * 
 * ⚠️ IMPORTANT FOR AI ASSISTANTS: Before modifying this file, READ:
 * docs/refactoring/default-agent-v3/default-agent-v3.md
 * 
 * This file is currently ~3,783 lines and is scheduled for architectural refactoring
 * to reduce it to ~1,000 lines using Command/Strategy patterns, Service Layer, and Plugin Architecture.
 * 
 * Current Architecture (Delegated Components):
 * - AgentInitializer: Handles component initialization and dependency injection
 * - AgentLifecycleManager: Manages agent lifecycle (start/stop/pause/resume)
 * - AgentCommunicationHandler: Handles message processing and routing
 * - AgentExecutionEngine: Coordinates task execution and manager orchestration
 * - InputProcessingCoordinator: Handles input validation and preprocessing
 * - OutputProcessingCoordinator: Handles output formatting and delivery
 * - ThinkingProcessor: Handles reasoning and decision-making
 * - AgentConfigValidator: Validates configuration
 * 
 * REFACTORING RULES:
 * 1. Follow @IMPLEMENTATION_GUIDELINES.md principles
 * 2. Apply @arch-refactor-guidelines and @modular-code rules
 * 3. No method should exceed 100 lines of code
 * 4. Maintain all existing functionality and tests
 * 5. Use gradual, incremental refactoring approach
 * 6. All changes must be backward compatible
 */

import { createLogger } from '@/lib/logging/winston-logger';
import { v4 as uuidv4 } from 'uuid';
import { AbstractAgentBase } from './base/AbstractAgentBase';
import { BaseManager } from './base/managers/BaseManager';
import { ManagerType } from './base/managers/ManagerType';
import { ToolManager } from './base/managers/ToolManager.interface';
import { AgentBaseConfig } from './base/types';

// Import our refactored components
import { InputProcessorConfig } from './base/managers/InputProcessor.interface';
import { OutputProcessorConfig } from './base/managers/OutputProcessor.interface';
import { AgentCommunicationHandler } from './core/AgentCommunicationHandler';
import { AgentExecutionEngine } from './core/AgentExecutionEngine';
import { AgentInitializationConfig, AgentInitializer } from './core/AgentInitializer';
import { AgentLifecycleManager } from './core/AgentLifecycleManager';
import { InputProcessingCoordinator } from './processors/InputProcessingCoordinator';
import { OutputProcessingCoordinator } from './processors/OutputProcessingCoordinator';
import { ThinkingProcessor } from './processors/ThinkingProcessor';
import { AgentConfigValidator } from './utils/AgentConfigValidator';

// Import interfaces
import { ModularSchedulerManager } from '../../lib/scheduler/implementations/ModularSchedulerManager';
import { Task, TaskStatus } from '../../lib/scheduler/models/Task.model';
import { ThinkingResult } from '../../services/thinking/types';
import {
  AgentResponse,
  GetLLMResponseOptions,
  MessageProcessingOptions,
  ThinkOptions
} from './base/AgentBase.interface';
import { MemoryEntry, MemoryManager } from './base/managers/MemoryManager.interface';
import { PlanExecutionResult, PlanningManager } from './base/managers/PlanningManager.interface';
import { ReflectionResult } from './base/managers/ReflectionManager.interface';
import { TaskCreationOptions, TaskCreationResult, TaskExecutionResult } from './base/managers/SchedulerManager.interface';

// Import types for configuration
import { OpportunityManager } from '../../lib/opportunity';
import { PersonaInfo } from './messaging/PromptFormatter';
import { ResourceUsageListener, ResourceUtilizationTracker, ResourceUtilizationTrackerOptions } from './scheduler/ResourceUtilization';

// Import processInputWithLangChain helper at the top
import { processInputWithLangChain } from './processInput';

// Import ThinkingService and related types
import { getLLM } from '../../lib/core/llm';
import { TaskScheduleType } from '../../lib/scheduler/models/Task.model';
import { ImportanceCalculationMode, ImportanceCalculatorService } from '../../services/importance/ImportanceCalculatorService';
import { ThinkingService } from '../../services/thinking/ThinkingService';
import { IAgent } from '../../services/thinking/graph/types';

// Import multi-agent delegation service
import {
  createMultiAgentDelegationService,
  type IMultiAgentDelegationService
} from '../../lib/multi-agent/MultiAgentDelegationService';
import {
  ToolCapabilityCategory,
  ToolDelegationPriority
} from '../../lib/multi-agent/delegation/ToolDelegationProtocol';

// Import new types
// Removed problematic import from './types' as it doesn't exist

// Import workspace integration
import { EnhancedWorkspaceAgentIntegration } from '../../services/workspace/integration/EnhancedWorkspaceAgentIntegration';
import { WorkspaceAgentIntegration } from '../../services/workspace/integration/WorkspaceAgentIntegration';

// Import ACG services - Phase 7 Integration
import { DefaultContentGenerationService } from '../../services/acg/core/DefaultContentGenerationService';
import { DocumentContentGenerator } from '../../services/acg/generators/document/DocumentContentGenerator';
import { EmailContentGenerator } from '../../services/acg/generators/email/EmailContentGenerator';
import { WorkspaceACGIntegration } from '../../services/acg/integration/WorkspaceACGIntegration';
import { IContentGenerationService } from '../../services/acg/interfaces/IContentGenerationService';
import { WorkspaceNLPProcessor } from '../../services/workspace/integration/WorkspaceNLPProcessor';

// Import visualization components
import { ThinkingVisualizer } from '../../services/thinking/visualization/ThinkingVisualizer';
import { AgentVisualizationTracker } from '../../services/visualization/AgentVisualizationTracker';

// Import workspace tool executor bridge
import { WorkspaceToolExecutorBridge } from '../../services/thinking/tools/WorkspaceToolExecutorBridge';
import { UnifiedToolBridge } from '../../services/tools/UnifiedToolBridge';
import {
  AgentVisualizationContext,
  DEFAULT_VISUALIZATION_CONFIG,
  LLMInteractionVisualizationData,
  VisualizationConfig,
  VisualizationRequestIdFactory
} from '../../types/visualization-integration';

// Import error management services
import { AgentErrorIntegration } from '../../services/errors/AgentErrorIntegration';
import { DefaultErrorManagementService } from '../../services/errors/DefaultErrorManagementService';
import { DefaultErrorClassificationEngine } from '../../services/errors/ErrorClassificationEngine';
import { DefaultErrorNotificationService } from '../../services/errors/ErrorNotificationService';
import { DefaultRecoveryStrategyManager } from '../../services/errors/RecoveryStrategyManager';

// Import tool name constants - NO STRING LITERALS 
import {
  CALENDAR_TOOL_NAMES,
  EMAIL_TOOL_NAMES
} from '../../constants/tool-names';

// Import tool response formatter

// Import tool name constants - NO STRING LITERALS 

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

  // Error management flags
  enableErrorManagement?: boolean;
  errorManagementConfig?: {
    enableUserNotifications?: boolean;
    enableAutoRetry?: boolean;
    maxRetries?: number;
    escalateAfterFailures?: number;
    timeoutMs?: number;
  };

  // Enhanced manager flags
  useEnhancedMemory?: boolean;
  useEnhancedReflection?: boolean;

  // Behavior configuration
  adaptiveBehavior?: boolean;

  // Tool response formatting configuration
  enableLLMFormatting?: boolean;

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
    memoryManager?: { enabled: boolean;[key: string]: unknown };
    planningManager?: { enabled: boolean;[key: string]: unknown };
    toolManager?: { enabled: boolean;[key: string]: unknown };
    knowledgeManager?: { enabled: boolean;[key: string]: unknown };
    schedulerManager?: { enabled: boolean;[key: string]: unknown };
    reflectionManager?: { enabled: boolean;[key: string]: unknown };

    // New manager configurations (Phase 2 integration)
    ethicsManager?: { enabled: boolean;[key: string]: unknown };
    collaborationManager?: { enabled: boolean;[key: string]: unknown };
    communicationManager?: { enabled: boolean;[key: string]: unknown };
    notificationManager?: { enabled: boolean;[key: string]: unknown };

    [key: string]: Record<string, unknown> | undefined;
  };

  // Visualization configuration
  visualizationConfig?: Partial<VisualizationConfig>;

  // ACG Configuration - Phase 7 Integration
  enableACG?: boolean;
  acgConfig?: {
    enableAutoGeneration?: boolean;
    requireConfirmation?: boolean;
    maxGenerationTimeMs?: number;
    fallbackOnError?: boolean;
    enabledGenerators?: string[]; // ContentType array as strings
    cacheEnabled?: boolean;
    cacheTTL?: number;
    maxRetries?: number;
    batchSize?: number;
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
export class DefaultAgent extends AbstractAgentBase implements ResourceUsageListener, IAgent {
  // Core properties
  private readonly agentId: string;
  private readonly agentType: string;
  private readonly version: string = '2.0.0'; // Updated version for refactored agent
  private readonly logger: ReturnType<typeof createLogger>;
  private agentConfig: DefaultAgentConfig;

  // DEBUG: Add instance tracking
  private readonly _instanceId: string = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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

  // Multi-agent delegation service
  private multiAgentDelegationService: IMultiAgentDelegationService | null = null;

  // Legacy compatibility properties
  private resourceTracker: ResourceUtilizationTracker | null = null;
  private opportunityManager: OpportunityManager | null = null;
  protected schedulerManager?: ModularSchedulerManager;
  protected initialized: boolean = false;

  private workspaceIntegration: WorkspaceAgentIntegration | null = null;
  private enhancedWorkspaceIntegration: EnhancedWorkspaceAgentIntegration | null = null;

  // ACG Services - Phase 7 Integration
  private contentGenerationService: IContentGenerationService | null = null;
  private workspaceACGIntegration: WorkspaceACGIntegration | null = null;

  // Error management services
  private errorManagementService: DefaultErrorManagementService | null = null;
  private errorClassificationEngine: DefaultErrorClassificationEngine | null = null;
  private recoveryStrategyManager: DefaultRecoveryStrategyManager | null = null;
  private errorNotificationService: DefaultErrorNotificationService | null = null;
  private agentErrorIntegration: AgentErrorIntegration | null = null;

  // Visualization components for agent decision tracking
  private visualizer: ThinkingVisualizer | null = null;
  private visualizationTracker: AgentVisualizationTracker | null = null;
  private visualizationConfig: VisualizationConfig = DEFAULT_VISUALIZATION_CONFIG;

  // Workspace tool executor bridge for thinking system integration
  private workspaceToolExecutorBridge: WorkspaceToolExecutorBridge | null = null;
  private unifiedToolBridge: UnifiedToolBridge | null = null;

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

    // Initialize ACG services if enabled - Phase 7 Integration
    if (config.enableACG) {
      this.logger.info('ACG enabled - initializing content generation services', {
        agentId: agentId,
        acgConfig: config.acgConfig
      });

      try {
        // Create a simple LLM service adapter for content generators
        const llmService = {
          generateText: async (prompt: string, options?: any) => {
            // Use the existing LLM response method
            const response = await this.getLLMResponse(prompt, options);
            return response.content;
          },
          generateResponse: async (prompt: string, options?: any) => {
            // Use the existing LLM response method
            const response = await this.getLLMResponse(prompt, options);
            return {
              content: response.content,
              usage: { totalTokens: 0, promptTokens: 0, completionTokens: 0 },
              model: process.env.OPENAI_MODEL_NAME || 'gpt-4.1-2025-04-14'
            };
          },
          isAvailable: async () => {
            // Always return true since we have access to the agent's LLM
            return true;
          },
          getModel: () => process.env.OPENAI_MODEL_NAME || 'gpt-4.1-2025-04-14'
        };

        // Initialize content generation service
        const emailGenerator = new EmailContentGenerator();
        const documentGenerator = new DocumentContentGenerator(llmService as any);

        // Create a simple cache implementation
        const cache = {
          data: new Map(),
          async get(key: string) { return this.data.get(key) || null; },
          async set(key: string, content: any, ttl?: number) { this.data.set(key, content); },
          async has(key: string) { return this.data.has(key); },
          async delete(key: string) { return this.data.delete(key); },
          generateKey: (context: any) => JSON.stringify(context),
          async clearByType(contentType: any) { this.data.clear(); },
          async clear() { this.data.clear(); }
        };

        this.contentGenerationService = new DefaultContentGenerationService({
          generators: [emailGenerator, documentGenerator],
          cache: cache,
          logger: this.logger,
          config: {
            maxConcurrentRequests: 10,
            defaultTimeoutMs: config.acgConfig?.maxGenerationTimeMs || 30000,
            maxRetries: config.acgConfig?.maxRetries || 3,
            cachingEnabled: config.acgConfig?.cacheEnabled ?? true,
            validationEnabled: true,
            metricsEnabled: true,
            fallbackEnabled: true,
            batchSize: config.acgConfig?.batchSize || 10,
            cleanupIntervalMs: 300000, // 5 minutes
            requestHistoryLimit: 1000
          }
        });

        // Note: contentGenerationService.initialize() will be called in the main initialize() method

        // Initialize ACG-enhanced workspace integration
        this.workspaceACGIntegration = new WorkspaceACGIntegration(
          new WorkspaceNLPProcessor(),
          this.contentGenerationService,
          {
            enableAutoGeneration: config.acgConfig?.enableAutoGeneration ?? true,
            requireConfirmation: config.acgConfig?.requireConfirmation ?? false,
            maxGenerationTimeMs: config.acgConfig?.maxGenerationTimeMs || 30000,
            fallbackOnError: config.acgConfig?.fallbackOnError ?? true
          }
        );

        // CRITICAL FIX: ACG integration is NOT a replacement for workspace integration!
        // ACG enhances commands, then passes them to the regular workspace integration
        this.workspaceIntegration = new WorkspaceAgentIntegration();

        this.logger.info('✅ ACG services initialized successfully', {
          agentId: agentId,
          generatorCount: 2,
          acgEnabled: true,
          hasWorkspaceIntegration: !!this.workspaceIntegration,
          hasACGIntegration: !!this.workspaceACGIntegration
        });
      } catch (error) {
        this.logger.error('❌ Failed to initialize ACG services', {
          agentId: agentId,
          error: error instanceof Error ? error.message : String(error)
        });

        // Fallback to standard workspace integration
        this.workspaceIntegration = new WorkspaceAgentIntegration();
        this.contentGenerationService = null;
        this.workspaceACGIntegration = null;
      }
    } else {
      // Standard workspace integration when ACG is disabled
      this.workspaceIntegration = new WorkspaceAgentIntegration();
      this.contentGenerationService = null;
      this.workspaceACGIntegration = null;

      this.logger.debug('ACG disabled - using standard workspace integration', {
        agentId: agentId
      });
    }

    // Initialize enhanced workspace integration (will be set up during initialization)
    this.enhancedWorkspaceIntegration = null;

    // Initialize workspace tool executor bridge
    this.workspaceToolExecutorBridge = new WorkspaceToolExecutorBridge({
      enableDebugLogging: true,
      maxExecutionTimeMs: 30000,
      validateParameters: true
    });

    // Initialize unified tool bridge to fix tool discovery mess
    this.unifiedToolBridge = new UnifiedToolBridge();
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
      // Initialize components using AgentInitializer
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
        throw new Error("Failed to initialize components");
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

      // Step 3: Initialize managers and core components
      await this.initializeManagers();
      this.logger.system("Managers initialized");

      // Step 4: Initialize new manager instances and services
      await this.initializeNewManagerInstances();
      this.logger.system("New manager instances initialized");

      // Step 5: Initialize resource tracking if enabled
      if (this.agentConfig.enableResourceTracking) {
        this.initializeResourceTracking();
      }

      // Step 6: Initialize workspace integration
      if (this.workspaceIntegration) {
        try {
          await this.workspaceIntegration.initializeAgentWorkspace(this);
          this.logger.system("Workspace integration initialized successfully", {
            agentId: this.agentId
          });
        } catch (workspaceError) {
          this.logger.warn("Failed to initialize workspace integration", {
            error: workspaceError instanceof Error ? workspaceError.message : String(workspaceError)
          });
        }
      }

      // Step 7: Initialize ACG services if enabled - Phase 7 Integration
      console.log('🔍 ACG INITIALIZATION CHECK', {
        enableACG: this.agentConfig.enableACG,
        hasContentGenerationService: !!this.contentGenerationService,
        contentGenerationServiceType: this.contentGenerationService?.constructor?.name,
        willInitialize: !!(this.agentConfig.enableACG && this.contentGenerationService)
      });

      if (this.agentConfig.enableACG && this.contentGenerationService) {
        try {
          this.logger.info('Initializing ACG services...', {
            agentId: this.agentId,
            hasContentGenerationService: !!this.contentGenerationService
          });

          // CRITICAL: Initialize the content generation service to set up generators with dependencies
          if ('initialize' in this.contentGenerationService && typeof (this.contentGenerationService as any).initialize === 'function') {
            await (this.contentGenerationService as any).initialize();
          } else {
            this.logger.warn('Content generation service does not have initialize method', {
              serviceType: this.contentGenerationService.constructor.name
            });
          }

          this.logger.debug('ACG services are ready for use', {
            agentId: this.agentId,
            serviceType: this.contentGenerationService?.constructor.name
          });

          this.logger.system("✅ ACG services initialized successfully", {
            agentId: this.agentId,
            acgEnabled: true
          });
        } catch (acgError) {
          this.logger.error("❌ Failed to initialize ACG services during agent initialization", {
            agentId: this.agentId,
            error: acgError instanceof Error ? acgError.message : String(acgError),
            stack: acgError instanceof Error ? acgError.stack : undefined
          });

          // Fallback to standard workspace integration
          this.workspaceIntegration = new WorkspaceAgentIntegration();
          this.contentGenerationService = null;
          this.workspaceACGIntegration = null;
        }
      }

      // Step 8: Connect unified tool systems (FIXES TOOL DISCOVERY MESS)
      if (this.unifiedToolBridge) {
        try {
          this.logger.info('🔧 Connecting unified tool systems to fix tool discovery mess', {
            agentId: this.agentId
          });

          // Import the singleton tool service from the thinking system
          const { toolService } = await import('../../services/thinking/tools');

          if (toolService) {
            // Connect all tool systems through unified bridge
            await this.unifiedToolBridge.connectAllSystems(this, toolService);
            this.logger.system("✅ UNIFIED TOOL SYSTEMS CONNECTED - Tool discovery mess fixed!", {
              agentId: this.agentId,
              toolServiceType: toolService.constructor.name
            });
          } else {
            this.logger.warn("Could not access thinking system's tool service for unified connection", {
              agentId: this.agentId
            });
          }
        } catch (error) {
          this.logger.error("❌ Failed to connect unified tool systems", {
            agentId: this.agentId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Step 8b: Legacy workspace tool executor bridge (fallback)
      if (this.workspaceToolExecutorBridge) {
        try {
          this.logger.info('Registering legacy workspace tool executors (fallback)', {
            agentId: this.agentId
          });

          // Import the singleton tool service from the thinking system
          const { toolService } = await import('../../services/thinking/tools');

          if (toolService) {
            await this.workspaceToolExecutorBridge.registerWorkspaceExecutors(this, toolService);
            this.logger.system("✅ Legacy workspace tool executors registered (fallback)", {
              agentId: this.agentId
            });
          }
        } catch (error) {
          this.logger.error("❌ Failed to register legacy workspace tool executors", {
            agentId: this.agentId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Step 9: Initialize error management system
      if (this.agentConfig.enableErrorManagement !== false) { // Default to enabled
        await this.initializeErrorManagement();
        this.logger.system("Error management system initialized");
      } else {
        this.logger.system("Error management system disabled by configuration");
      }

      // Step 10: Mark as initialized
      this.initialized = true;
      this.logger.system("Agent initialization completed successfully", {
        agentId: this.agentId,
        version: this.version
      });

      return true;

    } catch (error) {
      this.logger.error("Agent initialization failed", { error });
      this.initialized = false;
      return false;
    }
  }

  /**
   * Initialize managers
   */
  public async initializeManagers(): Promise<void> {
    // Initialize lifecycle manager
    this.lifecycleManager = new AgentLifecycleManager(this);
    await this.lifecycleManager.start();
    this.logger.system("Lifecycle manager initialized");

    // Initialize communication handler
    this.communicationHandler = new AgentCommunicationHandler(this);
    this.logger.system("Communication handler initialized");

    // Initialize execution engine
    this.executionEngine = new AgentExecutionEngine(this);
    this.logger.system("Execution engine initialized");

    // Initialize processing coordinators
    this.inputProcessor = new InputProcessingCoordinator(this);
    this.outputProcessor = new OutputProcessingCoordinator(this);

    // Register the LLM-based tool response formatter with highest priority
    if (this.outputProcessor && this.agentConfig.enableLLMFormatting) {
      // Initialize LLM formatter immediately during setup to avoid race conditions
      try {
        await this.initializeLLMPersonaFormatter();
        this.logger.info('LLM Persona Formatter initialized during agent setup', { agentId: this.agentId });
      } catch (error) {
        this.logger.warn("Failed to initialize LLM Persona Formatter during setup", {
          agentId: this.agentId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    this.thinkingProcessor = new ThinkingProcessor(this);
    this.logger.system("Processing coordinators initialized");
  }

  /**
   * Initialize new manager instances
   */
  private async initializeNewManagerInstances(): Promise<void> {
    // Initialize ThinkingService
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

    // Initialize multi-agent delegation service if communication manager is enabled
    if (this.agentConfig.enableCommunicationManager) {
      try {
        this.multiAgentDelegationService = createMultiAgentDelegationService({
          messagingService: {
            sendMessage: async (toAgentId: string, request: any) => {
              // Use the communication manager for inter-agent messaging
              const commManager = this.getManager(ManagerType.COMMUNICATION);
              if (commManager && typeof (commManager as any).sendMessage === 'function') {
                return await (commManager as any).sendMessage({
                  id: request.id,
                  type: 'delegation_request',
                  senderId: this.agentId,
                  recipientId: toAgentId,
                  payload: request,
                  timestamp: new Date(),
                  priority: request.priority || 'normal'
                });
              }
              throw new Error('Communication manager not available');
            }
          }
        });

        this.logger.system("Multi-agent delegation service initialized", {
          hasCapabilityDiscovery: !!this.multiAgentDelegationService,
          agentId: this.agentId
        });

        // Auto-register this agent's capabilities from available tools
        // This allows other agents to discover what this agent can do
        setTimeout(async () => {
          try {
            await this.registerCapabilitiesFromTools();
            this.logger.system("Agent capabilities auto-registered for multi-agent discovery", {
              agentId: this.agentId
            });
          } catch (error) {
            this.logger.warn("Failed to auto-register agent capabilities", {
              agentId: this.agentId,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }, 1000); // Wait 1 second for tools to be fully initialized

      } catch (error) {
        this.logger.warn("Failed to initialize MultiAgentDelegationService", { error });
      }
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
    let llmNodeId: string | null = null;
    const llmStartTime = Date.now();

    try {
      this.logger.info('Getting LLM response', {
        message: message.substring(0, 100),
        hasThinkingResult: !!options?.thinkingResult,
        hasConversationHistory: !!(options?.conversationHistory && Array.isArray(options.conversationHistory) && options.conversationHistory.length > 0)
      });

      // Initialize LLM visualization tracking if visualization context is available
      const visualizationContext = (options as any)?.visualizationContext as AgentVisualizationContext;

      // Prepare enhanced input with thinking context for accurate processing and token counting
      let enhancedInput = message;
      if (options?.thinkingResult) {
        const thinking = options.thinkingResult;
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

      if (visualizationContext && this.visualizationTracker) {
        try {
          const systemPrompt = await this.generateSystemPrompt();
          const conversationHistory: MemoryEntry[] = Array.isArray(options?.conversationHistory) ? options.conversationHistory : [];

          // Create LLM interaction visualization data
          const llmVisualizationData: LLMInteractionVisualizationData = {
            promptTokens: this.estimateTokens(enhancedInput),
            completionTokens: 0, // Will be updated after response
            totalTokens: this.estimateTokens(enhancedInput + systemPrompt + conversationHistory.map(h => h.content).join('')),
            model: this.agentConfig.modelName || process.env.OPENAI_MODEL_NAME || 'gpt-4.1-2025-04-14',
            temperature: this.agentConfig.temperature || 0.7,
            maxTokens: this.agentConfig.maxTokens || (process.env.OPENAI_MAX_TOKENS ? parseInt(process.env.OPENAI_MAX_TOKENS, 10) : 32000),
            systemPromptLength: systemPrompt.length,
            contextLength: conversationHistory.map(h => h.content).join('').length,
            userMessageLength: enhancedInput.length
          };

          llmNodeId = await this.visualizationTracker.createLLMInteractionNode(
            visualizationContext,
            llmVisualizationData,
            systemPrompt,
            enhancedInput
          );

        } catch (visualizationError) {
          this.logger.warn('Failed to create LLM visualization node', { error: visualizationError });
        }
      }

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
            memoryContextLength: (options?.thinkingResult?.context?.formattedMemoryContext as string)?.length || 0
          },
          timestamp: new Date().toISOString(),
          agentId: this.agentId,
          agentVersion: this.version
        }
      };

      // Update LLM visualization with completion data
      if (visualizationContext && this.visualizationTracker && llmNodeId) {
        try {
          const actualTokenUsage: LLMInteractionVisualizationData = {
            promptTokens: this.estimateTokens(enhancedInput || message),
            completionTokens: this.estimateTokens(llmContent),
            totalTokens: this.estimateTokens((enhancedInput || message) + llmContent),
            model: this.agentConfig.modelName || process.env.OPENAI_MODEL_NAME || 'gpt-4.1-2025-04-14',
            temperature: this.agentConfig.temperature || 0.7,
            maxTokens: this.agentConfig.maxTokens || (process.env.OPENAI_MAX_TOKENS ? parseInt(process.env.OPENAI_MAX_TOKENS, 10) : 32000),
            systemPromptLength: (await this.generateSystemPrompt()).length,
            contextLength: Array.isArray(options?.conversationHistory) ? options.conversationHistory.map(h => h.content).join('').length : 0,
            userMessageLength: (enhancedInput || message).length
          };

          await this.visualizationTracker.completeLLMInteractionNode(
            visualizationContext,
            llmNodeId,
            response,
            actualTokenUsage
          );
        } catch (visualizationError) {
          this.logger.warn('Failed to complete LLM visualization node', { error: visualizationError });
        }
      }

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
   * Process user input - orchestrates thinking and LLM response with visualization tracking
   */
  async processUserInput(message: string, options?: MessageProcessingOptions): Promise<AgentResponse> {
    const startTime = Date.now();
    let visualizationContext: AgentVisualizationContext | null = null;
    let operationId: string | undefined;

    // Start tracking this operation with error management
    if (this.agentErrorIntegration) {
      try {
        operationId = this.agentErrorIntegration.trackOperationStart({
          agentId: this.agentId,
          userId: options?.userId || 'anonymous',
          conversationId: options?.chatId || 'unknown',
          operation: 'process_user_input',
          timestamp: new Date(),
          metadata: {
            messageLength: message.length,
            hasOptions: !!options
          }
        });
      } catch (error) {
        this.logger.warn('Failed to start operation tracking', { error });
      }
    }

    try {
      this.logger.info('Processing user input', {
        message: message.substring(0, 100),
        hasOptions: !!options
      });

      // Initialize visualization tracking if enabled
      if (this.visualizationTracker && this.visualizer) {
        try {
          const requestId = VisualizationRequestIdFactory.generate();
          const visualization = this.visualizer.initializeVisualization(
            requestId.toString(),
            options?.userId || 'anonymous',
            this.agentId,
            options?.chatId || 'unknown',
            message,
            options?.messageId
          );

          visualizationContext = {
            requestId,
            userId: options?.userId || 'anonymous',
            agentId: this.agentId,
            chatId: options?.chatId || 'unknown',
            messageId: options?.messageId,
            userMessage: message,
            visualization,
            startTime
          };

          // Create initial user input node
          await this.visualizationTracker.createUserInputNode(visualizationContext);

          this.logger.debug('Visualization tracking initialized', {
            requestId: requestId.toString(),
            visualizationId: visualization.id
          });
        } catch (error) {
          this.logger.warn('Failed to initialize visualization tracking for request', { error });
        }
      }

      // Step 1: Thinking phase - analyze the input and determine intent
      const thinkingResult = await this.think(message, {
        userId: options?.userId,
        ...options
      });

      // Create thinking visualization node
      let thinkingNodeId: string | undefined;
      if (visualizationContext && this.visualizationTracker) {
        try {
          thinkingNodeId = await this.visualizationTracker.createThinkingNode(
            visualizationContext,
            thinkingResult
          );
        } catch (error) {
          this.logger.warn('Failed to create thinking visualization node', { error });
        }
      }

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
      let memoryNodeId: string | undefined;

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

          // Create memory retrieval visualization node
          if (visualizationContext && this.visualizationTracker) {
            try {
              // Convert MemoryManager.MemoryEntry to types.MemoryEntry for visualization
              const visualizationMemories = conversationHistory.map(entry => ({
                id: entry.id,
                content: entry.content,
                type: 'conversation_history',
                source: 'memory_manager',
                embedding: [] as number[], // Empty embedding for visualization
                metadata: entry.metadata,
                importance: 0.5,
                created_at: entry.createdAt.toISOString(),
                updated_at: entry.lastAccessedAt?.toISOString() || entry.createdAt.toISOString()
              }));

              memoryNodeId = await this.visualizationTracker.createMemoryRetrievalNode(
                visualizationContext,
                `Recent conversation history (limit: ${conversationHistoryLimit})`,
                visualizationMemories,
                thinkingNodeId
              );
            } catch (error) {
              this.logger.warn('Failed to create memory retrieval visualization node', { error });
            }
          }

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

      // Step 2.5: Check for delegation opportunities based on user message
      let delegationResult: { needsDelegation: boolean; suggestedTool?: string; suggestedCategory?: string; reasoning?: string } | null = null;
      if (this.multiAgentDelegationService) {
        try {
          delegationResult = await this.analyzeForDelegation(message);

          if (delegationResult.needsDelegation) {
            this.logger.info('Delegation opportunity detected', {
              suggestedTool: delegationResult.suggestedTool,
              suggestedCategory: delegationResult.suggestedCategory,
              reasoning: delegationResult.reasoning
            });

            // Attempt delegation first before proceeding with other processing paths
            if (delegationResult.suggestedTool && delegationResult.suggestedCategory) {
              try {
                // Extract parameters from the user message using simple heuristics
                const delegationParameters = this.extractParametersFromMessage(message, delegationResult.suggestedTool);

                const delegationResponse = await this.delegateToolToAgent(
                  delegationResult.suggestedTool,
                  delegationParameters,
                  {
                    toolCategory: delegationResult.suggestedCategory,
                    priority: thinkingResult.priority > 7 ? 'high' : 'normal',
                    timeout: 30000
                  }
                );

                this.logger.info('Successfully delegated task to another agent', {
                  tool: delegationResult.suggestedTool,
                  delegationResponse: typeof delegationResponse === 'object' ? 'object' : String(delegationResponse)
                });

                // Return delegation success response
                return {
                  content: `I've delegated your ${delegationResult.suggestedTool} request to a specialized agent. ${delegationResponse.message || 'The task has been processed successfully.'}`,
                  thoughts: [`Detected delegation opportunity for ${delegationResult.suggestedTool}`, `Successfully delegated to capable agent`, delegationResult.reasoning || 'Delegation completed'],
                  metadata: {
                    delegated: true,
                    delegationTool: delegationResult.suggestedTool,
                    delegationCategory: delegationResult.suggestedCategory,
                    delegationResponse,
                    thinkingResult,
                    processingPath: 'delegation'
                  }
                };

              } catch (delegationError) {
                this.logger.warn('Delegation attempt failed, continuing with normal processing', {
                  error: delegationError instanceof Error ? delegationError.message : String(delegationError),
                  suggestedTool: delegationResult.suggestedTool
                });

                // Don't block normal processing if delegation fails
                // The agent will handle the request itself as a fallback
              }
            }
          }

        } catch (error) {
          this.logger.warn('Failed to analyze for delegation opportunities', {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

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

      // Step 4: Check for workspace commands and process if applicable
      if (this.workspaceIntegration) {
        this.logger.debug('Attempting workspace command processing', {
          agentId: this.agentId,
          message: message.substring(0, 100) + '...',
          hasWorkspaceIntegration: !!this.workspaceIntegration
        });

        try {
          // Use ACG-enhanced processing if available
          let workspaceResult;
          if (this.workspaceACGIntegration) {
            this.logger.debug('Using ACG-enhanced workspace processing', {
              agentId: this.agentId,
              hasACG: true
            });

            const acgEnhancedCommand = await this.workspaceACGIntegration.parseCommandWithACG(
              message,
              options?.userId,
              this.agentId
            );

            if (acgEnhancedCommand) {
              this.logger.info('✨ ACG enhanced workspace command', {
                commandType: acgEnhancedCommand.type,
                contentGenerated: acgEnhancedCommand.contentGenerated,
                generatedContent: acgEnhancedCommand.generatedContent ? Object.keys(acgEnhancedCommand.generatedContent) : [],
                requiresConfirmation: acgEnhancedCommand.requiresConfirmation
              });

              // CRITICAL FIX: Actually execute the ACG-enhanced command!
              this.logger.info('🔧 Executing ACG-enhanced workspace command', {
                agentId: this.agentId,
                commandType: acgEnhancedCommand.type,
                hasGeneratedContent: !!acgEnhancedCommand.contentGenerated
              });

              try {
                // CRITICAL FIX: Use the ACG-enhanced command directly to avoid re-parsing
                // The issue was that processWorkspaceInput() re-parses the message and
                // chrono-node detects time references in generated content which triggers scheduling

                this.logger.debug('Using ACG-enhanced command directly to bypass re-parsing', {
                  agentId: this.agentId,
                  commandType: acgEnhancedCommand.type,
                  hasGeneratedContent: !!acgEnhancedCommand.contentGenerated,
                  generatedContentTypes: acgEnhancedCommand.generatedContent ? Object.keys(acgEnhancedCommand.generatedContent) : [],
                  hasScheduledTime: !!acgEnhancedCommand.scheduledTime
                });

                // Execute the command through workspace integration using the PRE-PARSED command
                // This bypasses the problematic re-parsing that was causing false scheduling detection
                const executionResult = await this.workspaceIntegration.processWorkspaceCommand(
                  this.agentId,
                  acgEnhancedCommand, // Use the ACG-enhanced command directly
                  undefined // Let it auto-select connection
                );

                this.logger.info('✅ ACG-enhanced command executed successfully', {
                  agentId: this.agentId,
                  commandType: acgEnhancedCommand.type,
                  executionSuccess: executionResult.success,
                  hasData: !!executionResult.data,
                  contentGenerated: acgEnhancedCommand.contentGenerated
                });

                // Combine ACG metadata with execution result
                workspaceResult = {
                  success: executionResult.success,
                  data: {
                    command: acgEnhancedCommand,
                    contentGenerated: acgEnhancedCommand.contentGenerated,
                    generatedContent: acgEnhancedCommand.generatedContent,
                    requiresConfirmation: acgEnhancedCommand.requiresConfirmation,
                    executionResult: executionResult.data,
                    actuallyExecuted: true // Flag to confirm execution happened
                  },
                  error: executionResult.error,
                  scheduled: executionResult.scheduled,
                  taskId: executionResult.taskId
                };
              } catch (executionError) {
                this.logger.error('❌ ACG-enhanced command execution failed', {
                  agentId: this.agentId,
                  commandType: acgEnhancedCommand.type,
                  error: executionError instanceof Error ? executionError.message : String(executionError)
                });

                workspaceResult = {
                  success: false,
                  data: {
                    command: acgEnhancedCommand,
                    contentGenerated: acgEnhancedCommand.contentGenerated,
                    generatedContent: acgEnhancedCommand.generatedContent,
                    requiresConfirmation: acgEnhancedCommand.requiresConfirmation,
                    actuallyExecuted: false
                  },
                  error: `ACG command execution failed: ${executionError instanceof Error ? executionError.message : String(executionError)}`
                };
              }
            } else {
              // No workspace command detected
              workspaceResult = {
                success: false,
                error: 'No workspace command detected'
              };
            }
          } else {
            // Standard workspace processing
            this.logger.debug('Using standard workspace processing', {
              agentId: this.agentId,
              hasACG: false
            });

            workspaceResult = await this.workspaceIntegration.processWorkspaceInput(
              this.agentId,
              message
            );
          }

          this.logger.info('🔍 Workspace processing result received', {
            success: workspaceResult.success,
            scheduled: workspaceResult.scheduled,
            taskId: workspaceResult.taskId,
            hasData: !!workspaceResult.data,
            error: workspaceResult.error,
            dataPreview: workspaceResult.data ? JSON.stringify(workspaceResult.data).substring(0, 200) : 'none'
          });

          // Process both successful AND failed workspace results
          if (workspaceResult.success || workspaceResult.error) {
            if (workspaceResult.success) {
              this.logger.info('✅ Workspace command processed successfully', {
                scheduled: workspaceResult.scheduled,
                taskId: workspaceResult.taskId,
                hasData: !!workspaceResult.data
              });
            } else {
              this.logger.warn('❌ Workspace command failed', {
                error: workspaceResult.error,
                hasData: !!workspaceResult.data
              });
            }

            // Determine content strategy based on LLM formatting configuration
            let responseContent: string;
            const enableLLMFormatting = this.agentConfig.enableLLMFormatting ?? false;

            if (enableLLMFormatting) {
              // When LLM formatting is enabled, pass minimal content and let the LLM formatter handle the data
              if (workspaceResult.scheduled) {
                responseContent = `I've scheduled that task for you. Task ID: ${workspaceResult.taskId}`;
              } else if (workspaceResult.success && workspaceResult.data) {
                responseContent = 'Workspace command executed successfully';
              } else {
                responseContent = `Workspace command failed: ${workspaceResult.error}`;
              }
            } else {
              // When LLM formatting is disabled, use the traditional formatting approach
              responseContent = await this.formatWorkspaceResponse(workspaceResult, message);
              if (workspaceResult.scheduled) {
                responseContent = `I've scheduled that task for you. Task ID: ${workspaceResult.taskId}`;
              }
            }

            // Create workspace response for unified formatting (both success and failure)
            const workspaceResponse: AgentResponse = {
              content: responseContent,
              thoughts: workspaceResult.success
                ? [`Processed workspace command successfully`]
                : [`Workspace command failed: ${workspaceResult.error}`],
              metadata: {
                workspaceProcessed: true,
                scheduled: workspaceResult.scheduled,
                taskId: workspaceResult.taskId,
                workspaceData: workspaceResult.data,
                intent: thinkingResult.intent,
                entities: thinkingResult.entities,
                toolResult: {
                  id: `workspace_${Date.now()}`,
                  toolId: 'workspace_integration',
                  success: workspaceResult.success,
                  data: workspaceResult.data,
                  error: workspaceResult.error ? {
                    message: workspaceResult.error,
                    code: 'WORKSPACE_EXECUTION_FAILED',
                    details: workspaceResult.data
                  } : undefined,
                  metrics: {
                    startTime: Date.now() - 1000,
                    endTime: Date.now(),
                    durationMs: 1000
                  }
                },
                originalMessage: message,
                agentId: this.agentId,
                agentPersona: this.agentConfig.persona,
                agentCapabilities: await this.getCapabilities(),
                userId: options?.userId || 'anonymous',
                userPreferences: options?.userPreferences || {},
                conversationHistory: conversationHistory?.slice(-3)?.map(entry => ({
                  id: entry.id,
                  sender: 'user',
                  content: entry.content,
                  timestamp: entry.createdAt,
                  metadata: entry.metadata || {}
                })) || []
              }
            };

            // Apply unified formatting via OutputProcessingCoordinator
            const formattedResponse = await this.applyUnifiedFormatting(workspaceResponse);
            return formattedResponse;
          }
        } catch (error) {
          this.logger.warn('Workspace processing failed, continuing with normal flow', {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Step 5: Enhanced options for LLM response with thinking context
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

      // Step 5: Choose processing path based on intelligent request type classification
      let response: AgentResponse;

      // Use intelligent classification from thinking process instead of manual rules
      const requestType = thinkingResult.requestType?.type || 'PURE_LLM_TASK';
      const requestClassification = thinkingResult.requestType?.reasoning || 'No classification available';

      console.log(`🧠 Smart routing decision: ${requestType} (confidence: ${thinkingResult.requestType?.confidence?.toFixed(2) || 'N/A'})`);
      console.log(`📝 Classification reasoning: ${requestClassification}`);

      // Enhanced routing logic based on LLM classification:
      // 1. SCHEDULED_TASK → Task creation path  
      // 2. EXTERNAL_TOOL_TASK → Planning path (for tool execution)
      // 3. PURE_LLM_TASK → Direct LLM path (for conversational responses)

      if (requestType === 'SCHEDULED_TASK' && schedulerManager) {
        // Path A: Scheduled task creation with LLM response
        this.logger.info('Processing as scheduled task based on LLM classification', {
          intent: thinkingResult.intent.primary,
          requestType,
          confidence: thinkingResult.requestType?.confidence,
          priority: thinkingResult.priority
        });

        // Get LLM response first to understand the request
        const llmResponse = await this.getLLMResponse(message, enhancedOptions);

        // Create task based on LLM understanding - ensure we have the right manager type
        if (schedulerManager && 'createTask' in schedulerManager) {
          // Extract time expression from LLM classification, or use the original message to extract time info
          let timeExpression = thinkingResult.requestType?.suggestedSchedule?.timeExpression;

          // If LLM didn't extract time expression, try to extract from the message
          if (!timeExpression) {
            // Simple regex to catch common time expressions
            const timePatterns = [
              /in\s+(\d+)\s+(second|minute|hour|day)s?/i,
              /(\d+)\s+(second|minute|hour|day)s?\s+from\s+now/i,
              /(tomorrow|today|tonight|later|soon)/i,
              /(next|this)\s+(week|month|friday|monday|tuesday|wednesday|thursday|saturday|sunday)/i
            ];

            for (const pattern of timePatterns) {
              const match = message.match(pattern);
              if (match) {
                timeExpression = match[0];
                break;
              }
            }

            // If still no time expression, default to "now"
            if (!timeExpression) {
              timeExpression = "now";
            }
          }

          this.logger.info('Creating scheduled task with time expression', {
            originalMessage: message,
            extractedTimeExpression: timeExpression,
            llmSuggestedExpression: thinkingResult.requestType?.suggestedSchedule?.timeExpression
          });

          // Create tool-specific task description for message scheduling
          let taskDescription = `Task created from user input: ${message}`;

          // If this is a message scheduling task, make it explicit that the agent should use the send_message tool
          if (message.toLowerCase().includes('send') && message.toLowerCase().includes('message') ||
            message.toLowerCase().includes('deliver') && message.toLowerCase().includes('joke') ||
            message.toLowerCase().includes('schedule') && message.toLowerCase().includes('chat')) {

            // Extract chat ID from options context first, then try message text if not available
            const contextChatId = options?.chatId;
            const messageTextChatId = message.match(/chat\s+([a-f0-9-]{36})/i)?.[1];
            const chatId = contextChatId || messageTextChatId;

            this.logger.info('Chat ID extraction for scheduled message', {
              contextChatId,
              messageTextChatId,
              finalChatId: chatId,
              hasContextChatId: !!contextChatId
            });

            // Create explicit tool execution instructions
            taskDescription = `Execute send_message tool to deliver the scheduled message. ` +
              `Original request: ${message}. ` +
              `IMPORTANT: Use the send_message tool with the following parameters: ` +
              `{chatId: "${chatId || 'MISSING_CHAT_ID'}", content: "generated-joke-content", messageType: "scheduled_message"}. ` +
              `Generate a funny programming joke as the content and deliver it via the send_message tool.`;
          }

          // Create a simple task that AgentTaskExecutor can process directly
          // The AgentTaskExecutor will extract the goal from the description and call agent.planAndExecute()
          const taskData = {
            name: `Task: ${message.length > 50 ? message.substring(0, 50) + '...' : message}`,
            description: taskDescription, // This is what AgentTaskExecutor will use as the goal
            priority: thinkingResult.priority,
            scheduleType: TaskScheduleType.EXPLICIT,
            scheduledTime: timeExpression, // ModularSchedulerManager will handle string parsing
            metadata: {
              source: 'user_input',
              originalMessage: message,
              createdBy: 'DefaultAgent',
              llmGuidance: llmResponse.content,
              intent: thinkingResult.intent.primary,
              requestType: thinkingResult.requestType,
              originalTimeExpression: timeExpression,
              requiresToolExecution: true,
              targetTool: 'send_message',
              chatId: options?.chatId, // Add chat ID from options context
              context: `Original user message: "${message}". Chat ID: ${options?.chatId}. This is a scheduled messaging task.`,
              requirements: 'Use the send_message tool to deliver the content to the appropriate chat',
              contextualInfo: {
                userId: options?.userId,
                chatId: options?.chatId,
                messageId: options?.messageId,
                requestId: options?.requestId
              },
              agentId: {
                namespace: 'agent',
                type: 'agent',
                id: this.getId()
              }
            }
          } as any; // Use 'as any' to bypass type checking since we're creating a partial

          const taskResult = await (schedulerManager as any).createTask(taskData);

          // Debug the task result structure
          this.logger.info('Task creation result structure', {
            taskResult,
            taskResultKeys: Object.keys(taskResult || {}),
            taskResultType: typeof taskResult,
            hasTaskId: 'taskId' in (taskResult || {}),
            hasId: 'id' in (taskResult || {}),
            actualTaskId: taskResult?.taskId || taskResult?.id || 'not_found'
          });

          // Extract task ID with fallback options
          const actualTaskId = taskResult?.taskId || taskResult?.id || 'unknown';

          // Generate appropriate scheduling confirmation message
          const schedulingResponse = this.generateSchedulingConfirmation(message, timeExpression, actualTaskId);

          response = {
            content: schedulingResponse,
            metadata: {
              ...llmResponse.metadata,
              taskCreated: true,
              taskId: actualTaskId,
              processingPath: 'scheduled_task_creation',
              thinkingResult,
              requestClassification,
              confidence: thinkingResult.requestType?.confidence
            }
          };
        } else {
          // Fallback if scheduler manager doesn't have createTask method
          this.logger.warn('Scheduler manager does not support createTask, falling back to LLM response');
          response = {
            content: `${llmResponse.content}\n\nNote: I would have scheduled a task for this but the task manager is not available.`,
            metadata: {
              ...llmResponse.metadata,
              taskCreated: false,
              processingPath: 'scheduled_task_fallback',
              thinkingResult,
              requestClassification,
              confidence: thinkingResult.requestType?.confidence
            }
          };
        }

      } else if (requestType === 'EXTERNAL_TOOL_TASK' && planningManager) {
        // Path B: External tool execution via planning manager
        this.logger.info('Processing with planning manager for external tool execution', {
          intent: thinkingResult.intent.primary,
          requestType,
          requiredTools: thinkingResult.requestType?.requiredTools,
          confidence: thinkingResult.requestType?.confidence
        });

        // Check if planning manager has planAndExecute method, otherwise use createPlan + executePlan
        if ('planAndExecute' in planningManager && typeof (planningManager as any).planAndExecute === 'function') {
          const planResult = await (planningManager as any).planAndExecute(message, {
            complexity: thinkingResult.complexity,
            priority: thinkingResult.priority,
            userId: options?.userId,
            conversationId: options?.conversationId,
            isUrgent: thinkingResult.isUrgent,
            thinkingResult
          });

          response = {
            content: planResult.response || 'Completed tool execution.',
            metadata: {
              processingPath: 'external_tool_execution',
              plan: planResult.plan,
              planSuccess: planResult.success,
              error: planResult.error,
              thinkingResult,
              requestClassification,
              confidence: thinkingResult.requestType?.confidence
            }
          };
        } else {
          // Fallback: use standard PlanningManager methods
          this.logger.info('Planning manager does not have planAndExecute, using createPlan + executePlan');

          try {
            const createResult = await planningManager.createPlan({
              name: `External Tool Task: ${message.substring(0, 50)}`,
              description: `Execute external tools for: ${message}`,
              goals: [message],
              priority: thinkingResult.priority / 10, // Convert to 0-1 scale
              metadata: {
                requestType: thinkingResult.requestType,
                requiredTools: thinkingResult.requestType?.requiredTools,
                thinkingResult
              }
            });

            if (createResult.success && createResult.plan) {
              const executeResult = await planningManager.executePlan(createResult.plan.id);

              response = {
                content: executeResult.success ? 'Completed external tool execution via planning.' : 'External tool execution encountered issues.',
                metadata: {
                  processingPath: 'external_tool_execution_fallback',
                  planCreated: createResult.success,
                  planExecuted: executeResult.success,
                  plan: createResult.plan,
                  error: executeResult.error,
                  thinkingResult,
                  requestClassification,
                  confidence: thinkingResult.requestType?.confidence
                }
              };
            } else {
              throw new Error(`Plan creation failed: ${createResult.error}`);
            }
          } catch (planningError) {
            this.logger.warn('Planning manager execution failed, falling back to LLM response', {
              error: planningError instanceof Error ? planningError.message : String(planningError)
            });

            response = await this.getLLMResponse(message, enhancedOptions);
            response.metadata = {
              ...response.metadata,
              processingPath: 'external_tool_execution_error_fallback',
              planningError: planningError instanceof Error ? planningError.message : String(planningError),
              thinkingResult,
              requestClassification,
              confidence: thinkingResult.requestType?.confidence
            };
          }
        }

      } else {
        // Path C: Direct LLM response for pure knowledge/reasoning tasks
        this.logger.info('Processing with direct LLM response', {
          intent: thinkingResult.intent.primary,
          requestType,
          confidence: thinkingResult.requestType?.confidence
        });

        response = await this.getLLMResponse(message, enhancedOptions);

        // Add classification info to metadata
        response.metadata = {
          ...response.metadata,
          processingPath: 'direct_llm_response',
          thinkingResult,
          requestClassification,
          confidence: thinkingResult.requestType?.confidence
        };
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

      // Finalize visualization tracking with complete processing information
      if (visualizationContext && this.visualizationTracker) {
        try {
          const processingTimeMs = Date.now() - startTime;
          await this.visualizationTracker.finalizeVisualization(
            visualizationContext,
            response,
            processingTimeMs
          );

          this.logger.debug('Visualization tracking finalized', {
            requestId: visualizationContext.requestId.toString(),
            processingTimeMs,
            responseLength: response.content.length
          });
        } catch (error) {
          this.logger.warn('Failed to finalize visualization tracking', { error });
        }
      }

      return response;

    } catch (error) {
      this.logger.error('Error processing user input', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      // Track the error with agent error integration
      if (this.agentErrorIntegration && operationId) {
        try {
          await this.agentErrorIntegration.handleAgentError(
            error instanceof Error ? error : new Error(String(error)),
            {
              agentId: this.agentId,
              userId: options?.userId || 'anonymous',
              conversationId: options?.chatId || 'unknown',
              operation: 'process_user_input',
              timestamp: new Date(),
              metadata: {
                messageLength: message.length,
                hasOptions: !!options
              }
            }
          );
        } catch (trackingError) {
          this.logger.warn('Failed to track error with error management system', { trackingError });
        }
      }

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
    } finally {
      // Stop tracking this operation if it was started
      if (operationId && this.agentErrorIntegration) {
        try {
          await this.agentErrorIntegration.trackOperationSuccess(operationId);
        } catch (finallyError) {
          this.logger.warn('Failed to complete operation tracking', { finallyError });
        }
      }
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

    // EXPANDED: Check for action commands and imperative intents
    const actionIntents = [
      // Traditional scheduling/task intents
      'schedule', 'remind', 'monitor', 'track', 'watch', 'follow_up',
      'create_task', 'add_task', 'queue', 'defer', 'later',

      // Core action verbs (imperatives that require doing something)
      'create', 'make', 'build', 'generate', 'produce', 'develop',
      'write', 'compose', 'draft', 'author', 'pen',
      'plan', 'design', 'architect', 'outline', 'structure',
      'execute', 'perform', 'do', 'run', 'implement',
      'analyze', 'research', 'investigate', 'study', 'examine',
      'calculate', 'compute', 'process', 'solve', 'figure out',
      'find', 'search', 'locate', 'discover', 'identify',
      'organize', 'arrange', 'sort', 'categorize', 'group',
      'format', 'convert', 'transform', 'modify', 'update',
      'send', 'post', 'publish', 'share', 'distribute',
      'download', 'upload', 'export', 'import', 'sync',
      'test', 'verify', 'validate', 'check', 'confirm',
      'optimize', 'improve', 'enhance', 'refine', 'polish',
      'fix', 'repair', 'correct', 'resolve', 'troubleshoot',
      'install', 'setup', 'configure', 'deploy', 'launch',
      'backup', 'restore', 'save', 'store', 'archive',
      'delete', 'remove', 'clear', 'clean', 'purge',

      // Tool-specific actions
      'coda', 'document', 'spreadsheet', 'table', 'database',
      'twitter', 'tweet', 'post', 'social media',
      'email', 'message', 'notification', 'alert',
      'report', 'summary', 'analysis', 'dashboard',
      'api', 'integration', 'webhook', 'automation'
    ];

    // Check if the message starts with action verbs (imperative form)
    const messageWords = messageContent.split(/\s+/);
    const firstWord = messageWords[0];
    const startsWithAction = actionIntents.includes(firstWord);

    // Check if intent or message contains action keywords
    const hasActionIntent = actionIntents.some(actionIntent =>
      intent.includes(actionIntent) || messageContent.includes(actionIntent)
    );

    // Check for imperative sentence patterns (commands)
    const imperativePatterns = [
      /^(create|make|build|generate|write|plan|do|execute|perform|run)/i,
      /^(please\s+)?(create|make|build|generate|write|plan|do|execute|perform|run)/i,
      /^(can you|could you|would you)\s+(create|make|build|generate|write|plan|do|execute|perform|run)/i,
      /^(i want you to|i need you to)\s+(create|make|build|generate|write|plan|do|execute|perform|run)/i
    ];

    const hasImperativePattern = imperativePatterns.some(pattern => pattern.test(messageContent));

    // Check for high priority or urgent requests that should be tracked
    const isUrgent = thinkingResult.isUrgent || thinkingResult.priority >= 9;

    // Check for complex requests that benefit from task tracking
    const isComplex = thinkingResult.complexity >= 7;

    // Enhanced logic: Schedule if:
    // 1. Explicit timing/scheduling language
    // 2. Multi-step processes
    // 3. Requires external tools/APIs
    // 4. Action intents or imperative commands
    // 5. High complexity + urgency combo
    const shouldCreate = hasTimingKeywords ||
      hasMultiStepKeywords ||
      requiresExternalTools ||
      hasActionIntent ||
      startsWithAction ||
      hasImperativePattern ||
      (isUrgent && isComplex);

    this.logger.info('Enhanced action intent detection', {
      intent: intent,
      message: message.substring(0, 100),
      firstWord,
      hasTimingKeywords,
      hasMultiStepKeywords,
      requiresExternalTools,
      hasActionIntent,
      startsWithAction,
      hasImperativePattern,
      isUrgent,
      isComplex,
      shouldCreate,
      priority: thinkingResult.priority,
      complexity: thinkingResult.complexity,
      detectionReason: shouldCreate ?
        (hasTimingKeywords ? 'timing keywords' :
          hasMultiStepKeywords ? 'multi-step keywords' :
            requiresExternalTools ? 'external tools needed' :
              hasActionIntent ? 'action intent detected' :
                startsWithAction ? 'starts with action verb' :
                  hasImperativePattern ? 'imperative pattern' :
                    'high complexity + urgency') : 'no triggers detected'
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
            // Pass agent instance for tool discovery - cast this to IAgent
            agent: this as IAgent,
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
        requestType: {
          type: 'PURE_LLM_TASK',
          confidence: 0.5,
          reasoning: 'No thinking components available, defaulting to pure LLM task',
          requiredTools: []
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

      // Simple classification logic for fallback scenarios
      const isSchedulingRequest = this.detectSchedulingRequest(message);
      const requestType = isSchedulingRequest ? 'SCHEDULED_TASK' : 'PURE_LLM_TASK';
      const confidence = isSchedulingRequest ? 0.8 : 0.5;
      const reasoning = isSchedulingRequest
        ? 'ThinkingProcessor fallback detected scheduling keywords'
        : 'ThinkingProcessor fallback, defaulting to pure LLM task';

      // Transform the result to match the expected interface
      return {
        intent: {
          primary: 'user_request',
          confidence: processingResult.confidence
        },
        requestType: {
          type: requestType,
          confidence,
          reasoning,
          requiredTools: isSchedulingRequest ? ['send_message'] : []
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
        requestType: {
          type: 'PURE_LLM_TASK',
          confidence: 0.5,
          reasoning: 'Ultimate fallback, defaulting to pure LLM task',
          requiredTools: []
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
    if (!schedulerManager || typeof schedulerManager !== 'object' || !('createTask' in schedulerManager)) {
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
    if (schedulerManager && typeof schedulerManager === 'object' && 'executeTaskNow' in schedulerManager) {
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
    if (!reflectionManager || typeof reflectionManager !== 'object' || !('reflect' in reflectionManager)) {
      throw new Error('Reflection manager not available');
    }

    // Use the reflection manager's reflect method
    return (reflectionManager as any).reflect(options);
  }

  // ===== MANAGER COMPATIBILITY METHODS =====
  // These methods maintain compatibility with the existing manager system

  /**
   * Get a manager by type (required by IAgent interface)
   */
  getManager<T>(managerType: unknown): T | null {
    return super.getManager(managerType as ManagerType) as T | null;
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
    if (schedulerManager && typeof schedulerManager === 'object' && 'getTasks' in schedulerManager) {
      return (schedulerManager as any).getTasks();
    }
    return [];
  }

  /**
   * Get a specific task by ID
   */
  async getTask(taskId: string): Promise<Task | null> {
    const schedulerManager = this.getManager(ManagerType.SCHEDULER);
    if (schedulerManager && typeof schedulerManager === 'object' && 'getTask' in schedulerManager) {
      return (schedulerManager as any).getTask(taskId);
    }
    return null;
  }

  /**
   * Get pending tasks
   */
  async getPendingTasks(): Promise<Task[]> {
    const schedulerManager = this.getManager(ManagerType.SCHEDULER);
    if (schedulerManager && typeof schedulerManager === 'object' && 'getPendingTasks' in schedulerManager) {
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
    this.resourceTracker?.recordTaskUtilization(taskId, metrics);
  }

  updateTaskCounts(activeTasks: number, pendingTasks: number): void {
    this.resourceTracker?.updateTaskCounts(activeTasks, pendingTasks);
  }

  getResourceUtilization() {
    return this.resourceTracker?.getCurrentUtilization() || {
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
        `You are a helpful assistant. Provide concise, accurate, and helpful responses.

🚨 CRITICAL: NEVER invent, fabricate, or guess factual information. If you don't have specific information, explicitly state "I don't have that information". Only provide factual claims that are explicitly present in your context or well-established general knowledge.`;

      // Extract persona from agent configuration
      const persona = this.agentConfig.persona;

      // Build agent context for dynamic tool discovery
      const agentContext = {
        agentPersona: {
          capabilities: await this.getCapabilities()
        },
        availableTools: await this.getAvailableToolNames(),
        contextUsed: {
          tools: this.getRegisteredTools()
        }
      };

      // Format the system prompt with persona information and dynamic capabilities
      const formattedPrompt = await PromptFormatter.formatSystemPrompt({
        basePrompt: baseSystemPrompt,
        persona: persona,
        includeCapabilities: true,
        agentContext: agentContext
      });

      this.logger.info('Generated formatted system prompt with dynamic capabilities', {
        hasPersona: !!persona,
        basePromptLength: baseSystemPrompt.length,
        formattedPromptLength: formattedPrompt.length,
        toolsDiscovered: agentContext.availableTools?.length || 0
      });

      return formattedPrompt;
    } catch (error) {
      this.logger.warn('Failed to generate formatted system prompt, using base prompt', {
        error: error instanceof Error ? error.message : String(error)
      });

      // Fallback to base system prompt or default
      return this.agentConfig.systemPrompt ||
        `You are a helpful assistant. Provide concise, accurate, and helpful responses.

🚨 CRITICAL: NEVER invent, fabricate, or guess factual information. If you don't have specific information, explicitly state "I don't have that information".`;
    }
  }

  /**
   * Get available tool names for dynamic capability detection
   */
  private async getAvailableToolNames(): Promise<string[]> {
    try {
      const allToolNames: string[] = [];

      this.logger.info('🔧 DEBUG: Starting getAvailableToolNames', {
        hasWorkspaceIntegration: !!this.workspaceIntegration,
        hasWorkspaceACGIntegration: !!this.workspaceACGIntegration,
        agentId: this.agentId
      });

      // Step 1: Get tools from ToolManager
      const toolManager = this.getManager<ToolManager>(ManagerType.TOOL);
      if (toolManager) {
        try {
          // Use the proper async getTools method
          const tools = await toolManager.getTools();
          if (Array.isArray(tools) && tools.length > 0) {
            const toolNames = tools.map((tool: any) => tool.name || tool.id || 'unknown_tool');
            allToolNames.push(...toolNames);
            this.logger.debug('Retrieved tools from ToolManager', {
              toolCount: tools.length,
              toolNames
            });
          }
        } catch (error) {
          this.logger.warn('ToolManager.getTools() failed, trying fallback methods', {
            error: error instanceof Error ? error.message : String(error)
          });

          // Try alternative methods if getTools fails
          if (typeof (toolManager as any).getAllTools === 'function') {
            try {
              const tools = await (toolManager as any).getAllTools();
              if (Array.isArray(tools)) {
                const toolNames = tools.map((tool: any) => tool.name || tool.id || 'unknown_tool');
                allToolNames.push(...toolNames);
              }
            } catch (error) {
              this.logger.warn('ToolManager.getAllTools() failed', {
                error: error instanceof Error ? error.message : String(error)
              });
            }
          }
        }
      }

      // Step 2: Get tools from WorkspaceAgentIntegration (CRITICAL for email tools)
      if (this.workspaceIntegration || this.workspaceACGIntegration) {
        try {
          const workspaceIntegration = this.workspaceACGIntegration || this.workspaceIntegration;

          // Check if the workspace integration has getAvailableTools method
          if (typeof (workspaceIntegration as any).getAvailableTools === 'function') {
            const workspaceTools = await (workspaceIntegration as any).getAvailableTools(this.agentId);
            if (Array.isArray(workspaceTools)) {
              const workspaceToolNames = workspaceTools.map((tool: any) =>
                tool.name || tool.id || 'unknown_workspace_tool'
              );
              allToolNames.push(...workspaceToolNames);
              this.logger.info('✅ Retrieved workspace tools successfully', {
                toolCount: workspaceTools.length,
                toolNames: workspaceToolNames,
                integration: this.workspaceACGIntegration ? 'ACG' : 'Standard'
              });
            }
          }

          // Also check if there's a workspaceTools property with getAvailableTools
          if ((workspaceIntegration as any).workspaceTools) {
            const workspaceTools = (workspaceIntegration as any).workspaceTools;
            if (typeof workspaceTools.getAvailableTools === 'function') {
              const tools = await workspaceTools.getAvailableTools(this.agentId);
              if (Array.isArray(tools)) {
                const workspaceToolNames = tools.map((tool: any) =>
                  tool.name || tool.id || 'unknown_workspace_tool'
                );
                allToolNames.push(...workspaceToolNames);
                this.logger.info('✅ Retrieved workspace tools from workspaceTools property', {
                  toolCount: tools.length,
                  toolNames: workspaceToolNames,
                  integration: this.workspaceACGIntegration ? 'ACG' : 'Standard'
                });
              }
            }
          }

          // FALLBACK: If no tools found yet, manually add common workspace tools if we have valid connections
          if (allToolNames.length === 0) {
            this.logger.warn('No workspace tools found via methods, adding fallback workspace tools');
            // Add basic workspace tools that should be available if workspace is integrated - NO STRING LITERALS
            const fallbackWorkspaceTools = [
              EMAIL_TOOL_NAMES.SEND_EMAIL,
              EMAIL_TOOL_NAMES.SMART_SEND_EMAIL,
              'read_email', // TODO: Add to constants
              EMAIL_TOOL_NAMES.FIND_IMPORTANT_EMAILS,
              CALENDAR_TOOL_NAMES.READ_CALENDAR,
              CALENDAR_TOOL_NAMES.SCHEDULE_EVENT,
              CALENDAR_TOOL_NAMES.FIND_AVAILABILITY
            ];
            allToolNames.push(...fallbackWorkspaceTools);
            this.logger.info('✅ Added fallback workspace tools', {
              toolCount: fallbackWorkspaceTools.length,
              toolNames: fallbackWorkspaceTools
            });
          }
        } catch (error) {
          this.logger.warn('Failed to get workspace tools', {
            error: error instanceof Error ? error.message : String(error)
          });

          // Even if there's an error, add basic workspace tools as fallback - NO STRING LITERALS
          const fallbackWorkspaceTools = [
            EMAIL_TOOL_NAMES.SEND_EMAIL,
            EMAIL_TOOL_NAMES.SMART_SEND_EMAIL,
            'read_email' // TODO: Add to constants
          ];
          allToolNames.push(...fallbackWorkspaceTools);
          this.logger.info('✅ Added error fallback workspace tools', {
            toolCount: fallbackWorkspaceTools.length,
            toolNames: fallbackWorkspaceTools
          });
        }
      }

      // Step 3: Fallback to registered tools if no tools found yet
      if (allToolNames.length === 0) {
        const registeredTools = this.getRegisteredTools();
        if (Array.isArray(registeredTools)) {
          const registeredToolNames = registeredTools.map((tool: any) =>
            typeof tool === 'string' ? tool : tool.name || tool.id || 'unknown_tool'
          );
          allToolNames.push(...registeredToolNames);
        }
      }

      // Step 4: Add basic capabilities if we still have no tools
      if (allToolNames.length === 0) {
        this.logger.warn('No tools available from any source, using fallback tools');
        allToolNames.push('send_message', 'general_llm_capabilities');
      }

      // Remove duplicates and return
      const uniqueToolNames = [...new Set(allToolNames)];
      this.logger.debug('Final available tool names', {
        totalCount: uniqueToolNames.length,
        toolNames: uniqueToolNames
      });

      return uniqueToolNames;
    } catch (error) {
      this.logger.warn('Failed to get available tool names:', {
        error: error instanceof Error ? error.message : String(error)
      });
      return ['send_message', 'general_llm_capabilities']; // Safe fallback
    }
  }

  /**
   * Get registered tools from this agent instance
   */
  private getRegisteredTools(): any[] {
    try {
      // Try to get tools from tool manager
      const toolManager = this.getManager<BaseManager>(ManagerType.TOOL);
      if (toolManager) {
        // Try different methods tool managers might have
        if (typeof (toolManager as any).getTools === 'function') {
          const tools = (toolManager as any).getTools();
          // Handle both sync and async returns, and ensure it's an array
          if (Array.isArray(tools)) {
            return tools;
          } else if (tools && typeof tools.then === 'function') {
            // It's a Promise, we can't wait for it here, so return fallback
            this.logger.warn('getTools returned a Promise, using fallback tools');
            return ['send_message', 'general_llm_capabilities'];
          }
        }

        if (typeof (toolManager as any).getAllTools === 'function') {
          const tools = (toolManager as any).getAllTools();
          // Handle both sync and async returns, and ensure it's an array
          if (Array.isArray(tools)) {
            return tools;
          } else if (tools && typeof tools.then === 'function') {
            // It's a Promise, we can't wait for it here, so return fallback
            this.logger.warn('getAllTools returned a Promise, using fallback tools');
            return ['send_message', 'general_llm_capabilities'];
          }
        }

        if ((toolManager as any).tools) {
          const tools = (toolManager as any).tools;
          if (Array.isArray(tools)) {
            return tools;
          } else if (tools instanceof Map) {
            return Array.from(tools.values());
          } else if (typeof tools === 'object') {
            return Object.values(tools);
          }
        }
      }

      // Try to get from agent configuration
      if (this.agentConfig.componentsConfig?.toolManager) {
        return []; // Will be populated by tool manager
      }

      // Default tools that are typically available
      return ['send_message', 'schedule_task', 'general_capabilities'];
    } catch (error) {
      this.logger.warn('Failed to get registered tools:', {
        error: error instanceof Error ? error.message : String(error)
      });
      return ['send_message']; // Minimal fallback
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
      // Direct summary requests
      'summarize', 'summary', 'recap', 'overview', 'brief',
      'what did we', 'what have we', 'can you recap',
      'give me an overview', 'what topics', 'main points',
      'key takeaways', 'highlights', 'review our',
      'what we discussed', 'what we talked about',

      // Context-based summary requests (new patterns)
      'based on our recent messages', 'based on previous messages',
      'based on our recent conversation', 'based on our conversation',
      'based on provided information', 'based on the information',
      'based on what we discussed', 'based on our discussion',
      'from our previous conversation', 'from our recent messages',
      'from what we talked about', 'from our chat',
      'considering our conversation', 'given our discussion',
      'looking at our messages', 'reviewing our conversation',
      'from the context above', 'based on the context',
      'according to our conversation', 'per our discussion'
    ];

    return summaryPatterns.some(pattern => lowerMessage.includes(pattern));
  }

  // NEW: Check for action requests that need tool execution (regardless of complexity)
  private needsToolExecution(thinkingResult: ThinkingResult, message: string): boolean {
    const intent = thinkingResult.intent.primary.toLowerCase();
    const messageContent = message.toLowerCase(); // Use actual message content

    // Check for external API/tool requirements that suggest async execution
    const requiresExternalTools = [
      'api call', 'external data', 'real-time', 'bitcoin price', 'coingecko',
      'search for', 'fetch', 'retrieve', 'get current', 'latest'
    ].some(keyword => messageContent.includes(keyword));

    // EXPANDED: Use the same action intents as shouldCreateTaskFromIntent
    const actionIntents = [
      // Traditional scheduling/task intents
      'schedule', 'remind', 'monitor', 'track', 'watch', 'follow_up',
      'create_task', 'add_task', 'queue', 'defer', 'later',

      // Core action verbs (imperatives that require doing something)
      'create', 'make', 'build', 'generate', 'produce', 'develop',
      'write', 'compose', 'draft', 'author', 'pen',
      'plan', 'design', 'architect', 'outline', 'structure',
      'execute', 'perform', 'do', 'run', 'implement',
      'analyze', 'research', 'investigate', 'study', 'examine',
      'calculate', 'compute', 'process', 'solve', 'figure out',
      'find', 'search', 'locate', 'discover', 'identify',
      'organize', 'arrange', 'sort', 'categorize', 'group',
      'format', 'convert', 'transform', 'modify', 'update',
      'send', 'post', 'publish', 'share', 'distribute',
      'download', 'upload', 'export', 'import', 'sync',
      'test', 'verify', 'validate', 'check', 'confirm',
      'optimize', 'improve', 'enhance', 'refine', 'polish',
      'fix', 'repair', 'correct', 'resolve', 'troubleshoot',
      'install', 'setup', 'configure', 'deploy', 'launch',
      'backup', 'restore', 'save', 'store', 'archive',
      'delete', 'remove', 'clear', 'clean', 'purge',

      // Tool-specific actions
      'coda', 'document', 'spreadsheet', 'table', 'database',
      'twitter', 'tweet', 'post', 'social media',
      'email', 'message', 'notification', 'alert',
      'report', 'summary', 'analysis', 'dashboard',
      'api', 'integration', 'webhook', 'automation'
    ];

    // Check if the message starts with action verbs (imperative form)
    const messageWords = messageContent.split(/\s+/);
    const firstWord = messageWords[0];
    const startsWithAction = actionIntents.includes(firstWord);

    // Check if intent or message contains action keywords
    const hasActionIntent = actionIntents.some(actionIntent =>
      intent.includes(actionIntent) || messageContent.includes(actionIntent)
    );

    // Check for imperative sentence patterns (commands)
    const imperativePatterns = [
      /^(create|make|build|generate|write|plan|do|execute|perform|run)/i,
      /^(please\s+)?(create|make|build|generate|write|plan|do|execute|perform|run)/i,
      /^(can you|could you|would you)\s+(create|make|build|generate|write|plan|do|execute|perform|run)/i,
      /^(i want you to|i need you to)\s+(create|make|build|generate|write|plan|do|execute|perform|run)/i
    ];

    const hasImperativePattern = imperativePatterns.some(pattern => pattern.test(messageContent));

    // Check for high priority or urgent requests that should be tracked
    const isUrgent = thinkingResult.isUrgent || thinkingResult.priority >= 9;

    // Check for complex requests that benefit from task tracking
    const isComplex = thinkingResult.complexity >= 7;

    // Tool execution needed if:
    // 1. Requires external tools/APIs
    // 2. Action intents or imperative commands
    // 3. High complexity + urgency combo
    const needsExecution = requiresExternalTools ||
      hasActionIntent ||
      startsWithAction ||
      hasImperativePattern ||
      (isUrgent && isComplex);

    this.logger.info('Tool execution need assessment', {
      intent: intent,
      message: message.substring(0, 100),
      firstWord,
      requiresExternalTools,
      hasActionIntent,
      startsWithAction,
      hasImperativePattern,
      isUrgent,
      isComplex,
      needsExecution,
      priority: thinkingResult.priority,
      complexity: thinkingResult.complexity,
      executionReason: needsExecution ?
        (requiresExternalTools ? 'external tools needed' :
          hasActionIntent ? 'action intent detected' :
            startsWithAction ? 'starts with action verb' :
              hasImperativePattern ? 'imperative pattern' :
                'high complexity + urgency') : 'no execution triggers'
    });

    return needsExecution;
  }

  private detectSchedulingRequest(message: string): boolean {
    // Check for common scheduling keywords
    const schedulingKeywords = [
      'schedule', 'remind', 'monitor', 'track', 'watch', 'follow_up',
      'create_task', 'add_task', 'queue', 'defer', 'later',
      'tomorrow', 'next week', 'when', 'defer', 'queue', 'wait'
    ];

    // Check if any of the scheduling keywords are present in the message
    return schedulingKeywords.some(keyword => message.toLowerCase().includes(keyword));
  }

  /**
   * Generate appropriate confirmation message for scheduled tasks
   */
  private generateSchedulingConfirmation(originalMessage: string, timeExpression: string, taskId: string): string {
    // Extract the intent from the message for personalized response
    const lowerMessage = originalMessage.toLowerCase();

    // Safely handle task ID - provide fallback if undefined/empty
    const safeTaskId = taskId && taskId !== 'unknown' && taskId !== 'not_found'
      ? taskId.substring(0, 8) + '...'
      : 'generated';

    if (lowerMessage.includes('joke')) {
      return `Perfect! I'll send you a surprise developer joke ${timeExpression}. Get ready for some coding humor! 😄⏰

Task scheduled successfully (ID: ${safeTaskId})`;
    }

    if (lowerMessage.includes('reminder') || lowerMessage.includes('remind')) {
      return `Got it! I'll send you a reminder ${timeExpression} as requested. ✅⏰

Task scheduled successfully (ID: ${safeTaskId})`;
    }

    if (lowerMessage.includes('message')) {
      return `Understood! I'll deliver your message ${timeExpression}. The task has been scheduled and will execute automatically. 📅✨

Task scheduled successfully (ID: ${safeTaskId})`;
    }

    // Generic scheduling confirmation
    return `Perfect! I've scheduled your request to be handled ${timeExpression}. The task will execute automatically when the time comes. ⏰✅

Task scheduled successfully (ID: ${safeTaskId})`;
  }

  /**
   * Simple token estimation method (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Format workspace command results into conversational responses
   */
  private async formatWorkspaceResponse(workspaceResult: any, originalMessage: string): Promise<string> {
    // Handle failed workspace results first
    if (!workspaceResult.success && workspaceResult.error) {
      // Return the error message directly if available
      return workspaceResult.error;
    }

    if (!workspaceResult.data) {
      return 'I completed that task for you successfully.';
    }

    const data = workspaceResult.data;

    // Handle failed smart email tool responses (data.success = false)
    if (data.success === false && data.error) {
      return data.error;
    }

    // Handle smart email tool response format (success, result, selectedAccount, message)
    if (data.success && data.result && data.selectedAccount) {
      const emailData = data.result;
      const selectedAccount = data.selectedAccount;

      if (emailData.id && emailData.to && emailData.subject) {
        const recipients = Array.isArray(emailData.to) ? emailData.to.join(', ') : emailData.to;
        const fromEmail = selectedAccount.email || emailData.from;
        return `✅ I've successfully sent your email to ${recipients} with the subject "${emailData.subject}". The email was delivered from ${fromEmail}. ${data.reason || ''}`;
      }

      // Fallback to the tool's own message if available
      if (data.message) {
        return `✅ ${data.message}`;
      }
    }

    // Direct email sending response (legacy format)
    if (data.id && data.from && data.to && data.subject) {
      const recipients = Array.isArray(data.to) ? data.to.join(', ') : data.to;
      return `✅ I've successfully sent your email to ${recipients} with the subject "${data.subject}". The email was delivered from ${data.from}.`;
    }

    // Enhanced Email attention analysis response - provide detailed email information
    if (data.needsAttention !== undefined || data.unreadCount !== undefined) {
      // Check if the new formatEmailAttentionResponse has already provided a formatted response
      if (data.formattedSummary) {
        // Use the new table format from WorkspaceAgentTools.formatEmailAttentionResponse()
        return data.formattedSummary;
      }

      // Fallback to original formatting logic for backward compatibility
      const unreadCount = data.unreadCount || 0;
      const urgentCount = data.urgentCount || 0;
      const needsAttention = data.needsAttention || [];

      if (unreadCount === 0) {
        return "Good news! You have no unread emails that need your attention right now.";
      } else {
        // Format emails in a clean table format
        const emailsToShow = needsAttention.slice(0, 10); // Show up to 10 emails

        if (emailsToShow.length === 0) {
          return `I found ${unreadCount} unread emails, but couldn't retrieve detailed information. Would you like me to try again?`;
        }

        const tableHeader = '| Priority | Subject | From | Date/Time |\n|----------|---------|------|-----------|';

        const tableRows = emailsToShow.map((email: any, index: number) => {
          const date = new Date(email.date);
          const isToday = date.toDateString() === new Date().toDateString();
          const timeFormat = isToday ?
            date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) :
            date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          // Clean and truncate subject
          const subject = (email.subject || 'No Subject').substring(0, 40) + (email.subject?.length > 40 ? '...' : '');

          // Extract sender name and clean it
          const senderMatch = email.from?.match(/^(.*?)\s*<([^>]+)>/) || [null, email.from, email.from];
          const senderName = (senderMatch[1]?.trim() || senderMatch[2] || 'Unknown').substring(0, 25);

          // Determine priority based on urgency criteria
          const isUrgent = index < urgentCount || email.isImportant || email.labels?.includes('IMPORTANT');
          const priority = isUrgent ? '🔴 Urgent' : '📧 Normal';

          return `| ${priority} | ${subject} | ${senderName} | ${timeFormat} |`;
        }).join('\n');

        const hasMore = needsAttention.length > 10;
        const moreText = hasMore ? `\n\n*Showing top 10 of ${needsAttention.length} total unread emails.*` : '';

        // Build the response
        let response = `**📬 Email Summary:** Found ${unreadCount} unread emails`;
        if (urgentCount > 0) {
          response += ` (${urgentCount} urgent)`;
        }
        response += '\n\n';
        response += tableHeader + '\n' + tableRows;
        response += moreText;
        response += '\n\nWould you like me to help draft responses, provide more details on specific emails, or prioritize these messages?';

        return response;
      }
    }

    // Calendar response
    if (data.events !== undefined || data.summary) {
      if (Array.isArray(data.events)) {
        const eventCount = data.events.length;
        if (eventCount === 0) {
          return "Your calendar is clear - no events scheduled for the requested time period.";
        } else {
          return `I found ${eventCount} event${eventCount > 1 ? 's' : ''} on your calendar. ${data.summary || ''}`;
        }
      }
      return data.summary || "I've checked your calendar for you.";
    }

    // File/Drive response
    if (data.files && Array.isArray(data.files)) {
      const fileCount = data.files.length;
      if (fileCount === 0) {
        return "I didn't find any files matching your search criteria.";
      } else {
        return `I found ${fileCount} file${fileCount > 1 ? 's' : ''} that match${fileCount === 1 ? 'es' : ''} your search.`;
      }
    }

    // Spreadsheet response
    if (data.id && data.title && data.url) {
      return `✅ I've created a new spreadsheet called "${data.title}" for you. You can access it at: ${data.url}`;
    }

    // Generic success response for other operations
    if (data.success === true || (typeof data === 'object' && Object.keys(data).length > 0)) {
      return 'I completed that task for you successfully.';
    }

    return 'Task completed successfully.';
  }

  // ====== Multi-Agent Delegation Methods ======

  /**
   * Generic tool delegation - can delegate any tool to any capable agent
   */
  async delegateToolToAgent(
    toolName: string,
    parameters: Record<string, any>,
    options: {
      toolCategory?: string;
      priority?: 'low' | 'normal' | 'high';
      timeout?: number;
      targetAgentId?: string;
      requiresConfirmation?: boolean;
    } = {}
  ): Promise<any> {
    if (!this.multiAgentDelegationService) {
      throw new Error('Multi-agent delegation service not available. Communication manager may be disabled.');
    }

    const priorityEnum = options.priority === 'high' ? ToolDelegationPriority.HIGH :
      options.priority === 'low' ? ToolDelegationPriority.LOW :
        ToolDelegationPriority.NORMAL;

    // Auto-detect tool category if not provided
    const toolCategory = options.toolCategory || this.detectToolCategory(toolName, parameters);

    return await this.multiAgentDelegationService.delegateToolRequest(
      this.agentId,
      toolName,
      toolCategory as ToolCapabilityCategory,
      parameters,
      {
        priority: priorityEnum,
        timeout: options.timeout || 30000,
        targetAgentId: options.targetAgentId,
        requiresConfirmation: options.requiresConfirmation || false
      }
    );
  }

  /**
   * Find agents that can handle a specific tool
   */
  async findAgentsForTool(
    toolName: string,
    toolCategory?: string,
    options: {
      excludeAgents?: string[];
      minReliability?: number;
      maxExecutionTime?: number;
    } = {}
  ): Promise<string[]> {
    if (!this.multiAgentDelegationService) {
      throw new Error('Multi-agent delegation service not available. Communication manager may be disabled.');
    }

    const criteria = {
      toolName,
      toolCategory: toolCategory || this.detectToolCategory(toolName),
      excludeAgents: options.excludeAgents,
      minReliability: options.minReliability,
      maxExecutionTime: options.maxExecutionTime
    };

    const agentResults = await this.multiAgentDelegationService.findCapableAgents(criteria as any);
    return Array.from(agentResults);
  }

  /**
   * Register this agent's capabilities dynamically based on available tools
   */
  async registerCapabilitiesFromTools(): Promise<void> {
    if (!this.multiAgentDelegationService) {
      throw new Error('Multi-agent delegation service not available. Communication manager may be disabled.');
    }

    try {
      // Get all available tools from this agent
      const tools = await this.getTools();

      // Convert tools to capabilities
      const capabilities = tools.map(tool => ({
        name: tool.name || tool.id,
        category: this.detectToolCategory(tool.name || tool.id, tool.description),
        description: tool.description || `${tool.name || tool.id} tool capability`,
        parameters: {},
        permissions: ['execute'],
        estimatedExecutionTime: 5000,
        reliability: 0.95
      }));

      await this.multiAgentDelegationService.registerAgentCapabilities(
        this.agentId,
        capabilities
      );

      this.logger.info('Registered agent capabilities from available tools', {
        agentId: this.agentId,
        capabilitiesCount: capabilities.length,
        toolNames: capabilities.map(c => c.name)
      });

    } catch (error) {
      this.logger.warn('Failed to register capabilities from tools', {
        agentId: this.agentId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Intelligently detect if a user request requires delegation
   */
  async analyzeForDelegation(userMessage: string): Promise<{
    needsDelegation: boolean;
    suggestedTool?: string;
    suggestedCategory?: string;
    suggestedParameters?: Record<string, any>;
    reasoning?: string;
  }> {
    // Look for delegation keywords and patterns
    const emailKeywords = ['send email', 'email', 'mail to', 'notify via email'];
    const socialKeywords = ['post to', 'share on', 'tweet', 'linkedin post', 'social media'];
    const analysisKeywords = ['analyze', 'report', 'calculate', 'data analysis', 'generate report'];
    const fileKeywords = ['create file', 'save to', 'export', 'download', 'upload'];

    const message = userMessage.toLowerCase();

    // Check for email delegation
    if (emailKeywords.some(keyword => message.includes(keyword))) {
      return {
        needsDelegation: true,
        suggestedTool: 'sendEmail',
        suggestedCategory: 'email',
        reasoning: 'User request mentions email functionality'
      };
    }

    // Check for social media delegation
    if (socialKeywords.some(keyword => message.includes(keyword))) {
      return {
        needsDelegation: true,
        suggestedTool: 'createPost',
        suggestedCategory: 'social_media',
        reasoning: 'User request mentions social media functionality'
      };
    }

    // Check for analysis delegation
    if (analysisKeywords.some(keyword => message.includes(keyword))) {
      return {
        needsDelegation: true,
        suggestedTool: 'analyzeData',
        suggestedCategory: 'analytics',
        reasoning: 'User request mentions data analysis functionality'
      };
    }

    // Check for file operations
    if (fileKeywords.some(keyword => message.includes(keyword))) {
      return {
        needsDelegation: true,
        suggestedTool: 'processFile',
        suggestedCategory: 'file_processing',
        reasoning: 'User request mentions file operations'
      };
    }

    // Check if message mentions other agents directly
    if (message.includes('agent') && (message.includes('ask') || message.includes('tell') || message.includes('have'))) {
      return {
        needsDelegation: true,
        suggestedTool: 'generic_task',
        suggestedCategory: 'communication',
        reasoning: 'User request mentions delegating to other agents'
      };
    }

    return {
      needsDelegation: false,
      reasoning: 'No delegation patterns detected'
    };
  }

  /**
   * Auto-detect tool category based on tool name and context
   */
  private detectToolCategory(toolName: string, context?: any): ToolCapabilityCategory {
    const name = toolName.toLowerCase();
    const contextStr = context ? String(context).toLowerCase() : '';

    // Email patterns
    if (name.includes('email') || name.includes('mail') || name.includes('send_message')) {
      return ToolCapabilityCategory.EMAIL;
    }

    // Social media patterns
    if (name.includes('post') || name.includes('tweet') || name.includes('social') ||
      name.includes('linkedin') || name.includes('facebook') || name.includes('instagram')) {
      return ToolCapabilityCategory.SOCIAL_MEDIA;
    }

    // Analytics patterns
    if (name.includes('analyze') || name.includes('report') || name.includes('calculate') ||
      name.includes('data') || name.includes('metric') || name.includes('chart')) {
      return ToolCapabilityCategory.ANALYTICS;
    }

    // File processing patterns
    if (name.includes('file') || name.includes('upload') || name.includes('download') ||
      name.includes('export') || name.includes('import') || name.includes('process')) {
      return ToolCapabilityCategory.FILE_PROCESSING;
    }

    // Communication patterns
    if (name.includes('message') || name.includes('notify') || name.includes('alert') ||
      name.includes('communicate') || contextStr.includes('send') || contextStr.includes('message')) {
      return ToolCapabilityCategory.COMMUNICATION;
    }

    // Workspace patterns
    if (name.includes('workspace') || name.includes('project') || name.includes('task') ||
      name.includes('calendar') || name.includes('schedule')) {
      return ToolCapabilityCategory.WORKSPACE;
    }

    // Default to custom
    return ToolCapabilityCategory.CUSTOM;
  }

  /**
   * Extract parameters from user message for tool delegation
   */
  private extractParametersFromMessage(message: string, toolName: string): Record<string, any> {
    const lowerMessage = message.toLowerCase();
    const parameters: Record<string, any> = {};

    // Tool-specific parameter extraction
    switch (toolName.toLowerCase()) {
      case 'sendemail':
      case EMAIL_TOOL_NAMES.SEND_EMAIL:
        // Extract email components
        const emailMatch = message.match(/(?:to|email|send)\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
        if (emailMatch) {
          parameters.to = [emailMatch[1]];
        }

        // Extract subject
        const subjectMatch = message.match(/(?:subject|about|regarding)[\s:]+([^.!?]+)/i);
        if (subjectMatch) {
          parameters.subject = subjectMatch[1].trim();
        } else {
          parameters.subject = `Message from ${this.getName()}`;
        }

        // Extract body content
        const bodyMatch = message.match(/(?:saying|tell them|message|content)[\s:]+["']?([^"']+)["']?/i);
        if (bodyMatch) {
          parameters.body = bodyMatch[1].trim();
        } else {
          parameters.body = message; // Use entire message as fallback
        }

        parameters.priority = lowerMessage.includes('urgent') || lowerMessage.includes('asap') ? 'high' : 'normal';
        break;

      case 'createpost':
      case 'post':
        // Extract social media content
        const contentMatch = message.match(/(?:post|share|tweet)[\s:]+["']?([^"']+)["']?/i);
        if (contentMatch) {
          parameters.content = contentMatch[1].trim();
        } else {
          parameters.content = message;
        }

        // Extract platforms
        const platforms = [];
        if (lowerMessage.includes('twitter') || lowerMessage.includes('tweet')) platforms.push('twitter');
        if (lowerMessage.includes('linkedin')) platforms.push('linkedin');
        if (lowerMessage.includes('facebook')) platforms.push('facebook');
        if (lowerMessage.includes('instagram')) platforms.push('instagram');

        parameters.platforms = platforms.length > 0 ? platforms : ['twitter']; // Default to twitter

        // Extract hashtags
        const hashtagMatches = message.match(/#[\w]+/g);
        if (hashtagMatches) {
          parameters.hashtags = hashtagMatches;
        }
        break;

      case 'analyzedata':
      case 'analyze':
        // Extract data source
        const dataMatch = message.match(/(?:analyze|data|report)[\s:]+([^.!?]+)/i);
        if (dataMatch) {
          parameters.dataSource = dataMatch[1].trim();
        }

        // Extract analysis type
        if (lowerMessage.includes('performance')) parameters.analysisType = 'performance';
        else if (lowerMessage.includes('trend')) parameters.analysisType = 'trend';
        else if (lowerMessage.includes('summary')) parameters.analysisType = 'summary';
        else parameters.analysisType = 'general';
        break;

      case 'processfile':
      case 'file':
        // Extract file path or name
        const fileMatch = message.match(/(?:file|document)[\s:]+([^\s.!?]+(?:\.[^\s.!?]+)?)/i);
        if (fileMatch) {
          parameters.fileName = fileMatch[1].trim();
        }

        // Extract operation type
        if (lowerMessage.includes('upload')) parameters.operation = 'upload';
        else if (lowerMessage.includes('download')) parameters.operation = 'download';
        else if (lowerMessage.includes('process')) parameters.operation = 'process';
        else if (lowerMessage.includes('convert')) parameters.operation = 'convert';
        else parameters.operation = 'process';
        break;

      default:
        // Generic parameter extraction
        // Extract any quoted strings as content
        const quotedMatches = message.match(/"([^"]+)"/g) || message.match(/'([^']+)'/g);
        if (quotedMatches) {
          parameters.content = quotedMatches[0].replace(/['"]/g, '');
        }

        // Extract any @mentions as targets
        const mentionMatches = message.match(/@[\w]+/g);
        if (mentionMatches) {
          parameters.mentions = mentionMatches;
        }

        // Use the entire message as a general parameter
        parameters.request = message;
        break;
    }

    // Add common metadata
    parameters.timestamp = Date.now();
    parameters.requestedBy = this.agentId;
    parameters.originalMessage = message;

    return parameters;
  }

  /**
   * Apply unified formatting to agent responses using the tool response formatter
   */
  private async applyUnifiedFormatting(response: AgentResponse): Promise<AgentResponse> {
    try {
      // Check if LLM formatting is enabled in configuration
      const enableLLMFormatting = this.agentConfig.enableLLMFormatting ?? false;

      if (!enableLLMFormatting) {
        this.logger.debug('LLM formatting disabled in agent configuration');
        return response;
      }

      // Check if we have an OutputProcessingCoordinator
      if (!this.outputProcessor) {
        this.logger.warn('No output processor available for unified formatting');
        return response;
      }

      // Get the configuration for LLM formatting
      const config = {
        enableLLMFormatting: true,
        maxResponseLength: 500,
        includeEmojis: true,
        includeNextSteps: true,
        includeMetrics: false,
        responseStyle: 'conversational' as const,
        enableCaching: true,
        cacheTTLSeconds: 3600,
        toolCategoryOverrides: {}
      };

      // Add formatter configuration to response metadata
      response.metadata = {
        ...response.metadata,
        toolResponseConfig: config
      };

      // Process output through the coordinator (which will use our LLMPersonaFormatter if available)
      const processingResult = await this.outputProcessor.processOutput(response);

      if (processingResult.success) {
        this.logger.info('Unified formatting applied successfully', {
          formattersUsed: processingResult.formatters,
          originalLength: response.content.length,
          processedLength: processingResult.processedContent.length
        });

        return {
          ...response,
          content: processingResult.processedContent,
          metadata: {
            ...response.metadata,
            formattingApplied: true,
            formattersUsed: processingResult.formatters,
            processingMetrics: processingResult.metadata
          }
        };
      } else {
        this.logger.warn('Output processing failed, using original response', {
          errors: processingResult.errors,
          warnings: processingResult.warnings
        });
        return response;
      }

    } catch (error) {
      this.logger.error('Failed to apply unified formatting', {
        error: error instanceof Error ? error.message : String(error)
      });
      return response; // Return original response on error
    }
  }

  /**
   * Initialize error management system for the agent
   */
  private async initializeErrorManagement(): Promise<void> {
    try {
      // Create a mock database provider for now (in production, this would use Prisma)
      const mockDatabaseProvider = {
        saveError: async (error: any) => error.id,
        getErrorById: async (id: string) => null,
        searchErrors: async (criteria: any) => [],
        updateErrorStatus: async (id: string, status: any) => true,
        updateError: async (id: string, updates: any) => true,
        saveErrorResolution: async (resolution: any) => true,
        getErrorStatistics: async (criteria?: any) => ({
          totalErrors: 0,
          errorsByType: new Map(),
          errorsBySeverity: new Map(),
          errorsByStatus: new Map(),
          resolutionRate: 0,
          averageResolutionTime: 0,
          topFailingComponents: []
        }),
        getErrorsForRetry: async () => [],
        getErrorsForEscalation: async () => [],
        updateRetryInfo: async (id: string, attempt: number, nextRetry?: Date) => true,
        getErrorPatterns: async (timeWindow: number) => [],
        getErrorsByStatus: async (status: any) => [],
        getErrorsByAgent: async (agentId: string) => [],
        getErrorsByType: async (errorType: any) => [],
        saveErrorPattern: async (pattern: any) => true,
        getErrorStats: async () => ({}),
        cleanupOldErrors: async (daysOld: number) => 0
      };

      // Create notification service adapter
      const notificationAdapter = {
        sendUserNotification: async (error: any, routing: any) => true,
        sendRetryNotification: async (error: any, attempt: number, maxAttempts: number) => true,
        sendEscalationNotification: async (error: any, reason: string) => true,
        sendResolutionNotification: async (errorId: string, resolution: any) => true
      };

      // Create compatible logger adapter
      const loggerAdapter = {
        debug: (message: string, ...args: any[]) => this.logger.debug(message, args.length > 0 ? args[0] : undefined),
        info: (message: string, ...args: any[]) => this.logger.info(message, args.length > 0 ? args[0] : undefined),
        warn: (message: string, ...args: any[]) => this.logger.warn(message, args.length > 0 ? args[0] : undefined),
        error: (message: string, ...args: any[]) => this.logger.error(message, args.length > 0 ? args[0] : undefined)
      };

      // Initialize error management components
      this.errorClassificationEngine = new DefaultErrorClassificationEngine(loggerAdapter);
      this.recoveryStrategyManager = new DefaultRecoveryStrategyManager(loggerAdapter);
      this.errorNotificationService = new DefaultErrorNotificationService(loggerAdapter);

      // Initialize error management service
      this.errorManagementService = new DefaultErrorManagementService(
        loggerAdapter,
        mockDatabaseProvider,
        notificationAdapter
      );

      // Initialize agent error integration
      this.agentErrorIntegration = new AgentErrorIntegration(
        this.logger,
        this.errorManagementService,
        this.errorClassificationEngine,
        this.recoveryStrategyManager,
        this.errorNotificationService
      );

      // Initialize agent error handling for this agent with configuration
      const errorConfig = this.agentConfig.errorManagementConfig || {};
      await this.agentErrorIntegration.initializeAgentErrorHandling(this, {
        enableErrorRecovery: errorConfig.enableAutoRetry !== false,
        enableUserNotifications: errorConfig.enableUserNotifications !== false,
        maxRetries: errorConfig.maxRetries || 3,
        timeoutMs: errorConfig.timeoutMs || 30000,
        escalateAfterFailures: errorConfig.escalateAfterFailures || 5
      });

      this.logger.system("Error management services initialized successfully", {
        agentId: this.agentId,
        hasErrorManagement: !!this.errorManagementService,
        hasClassificationEngine: !!this.errorClassificationEngine,
        hasRecoveryManager: !!this.recoveryStrategyManager,
        hasNotificationService: !!this.errorNotificationService,
        hasAgentErrorIntegration: !!this.agentErrorIntegration
      });

    } catch (error) {
      this.logger.error("Failed to initialize error management system", {
        error: error instanceof Error ? error.message : String(error),
        agentId: this.agentId
      });
      throw error;
    }
  }

  /**
   * Initialize LLM Persona Formatter for enhanced tool response formatting
   */
  private async initializeLLMPersonaFormatter(): Promise<void> {
    try {
      if (!this.outputProcessor) {
        this.logger.warn("No OutputProcessingCoordinator available for LLM formatter");
        return;
      }

      this.logger.info("Initializing LLM Persona Formatter", { agentId: this.agentId });

      // Import required services dynamically to avoid circular dependencies
      const { LLMToolResponseFormatter } = await import('../../services/tool-response-formatter/LLMToolResponseFormatter');
      const { PromptTemplateService } = await import('../../services/tool-response-formatter/PromptTemplateService');
      const { createMessagingLLMService } = await import('../../services/messaging/llm-adapter');
      const { LLMPersonaFormatter } = await import('../../services/tool-response-formatter/LLMPersonaFormatter');

      // Create a persona-aware configuration service
      const persona = this.agentConfig.persona;
      const communicationStyle = persona?.communicationStyle || 'professional and helpful';
      const responseStyle = this.determineResponseStyleFromPersona(persona);
      const customInstructions = this.buildPersonaAwareInstructions(persona);

      const configService = {
        async getConfig(agentId: string): Promise<{
          enableLLMFormatting: boolean;
          maxResponseLength: number;
          includeEmojis: boolean;
          includeNextSteps: boolean;
          includeMetrics: boolean;
          responseStyle: 'conversational' | 'business' | 'technical' | 'casual';
          enableCaching: boolean;
          cacheTTLSeconds: number;
          personaAware: boolean;
          communicationStyle: string;
          customInstructions: string;
        }> {
          return {
            enableLLMFormatting: true,
            maxResponseLength: 500,
            includeEmojis: persona?.preferences?.includeEmojis !== 'false',
            includeNextSteps: true,
            includeMetrics: false,
            responseStyle: responseStyle,
            enableCaching: true,
            cacheTTLSeconds: 3600,
            // NEW: Persona-aware response guidelines
            personaAware: true,
            communicationStyle: communicationStyle,
            customInstructions: customInstructions
          };
        }
      };

      // Create a simple in-memory response cache
      const responseCache = {
        cache: new Map<string, { value: any; expiry: number }>(),
        async get(key: string) {
          const entry = this.cache.get(key);
          if (entry && entry.expiry > Date.now()) {
            return entry.value;
          }
          return null;
        },
        async set(key: string, value: any, ttlSeconds: number) {
          this.cache.set(key, {
            value,
            expiry: Date.now() + (ttlSeconds * 1000)
          });
        }
      };

      // Create LLM service
      const llmService = createMessagingLLMService();

      // Create dependencies
      const promptTemplateService = new PromptTemplateService();
      const toolResponseFormatter = new LLMToolResponseFormatter(
        llmService,
        promptTemplateService,
        responseCache as any
      );

      // Create the LLM persona formatter
      const llmPersonaFormatter = new LLMPersonaFormatter(
        toolResponseFormatter,
        configService as any
      );

      // Register with OutputProcessingCoordinator
      this.outputProcessor.addFormatter(llmPersonaFormatter);

      this.logger.system("LLM Persona Formatter successfully registered with OutputProcessingCoordinator", {
        agentId: this.agentId,
        formatterPriority: llmPersonaFormatter.priority
      });

    } catch (error) {
      this.logger.error("Failed to initialize LLM Persona Formatter", {
        agentId: this.agentId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Determine response style from agent persona
   */
  private determineResponseStyleFromPersona(persona?: PersonaInfo): 'conversational' | 'business' | 'technical' | 'casual' {
    if (!persona) return 'conversational';

    const style = persona.communicationStyle?.toLowerCase() || '';
    const personality = persona.personality?.toLowerCase() || '';

    // Analyze communication style and personality to determine appropriate response style
    if (style.includes('casual') || style.includes('relaxed') || style.includes('friendly')) {
      return 'casual';
    } else if (style.includes('technical') || style.includes('precise') || style.includes('analytical')) {
      return 'technical';
    } else if (style.includes('business') || style.includes('professional') || style.includes('formal')) {
      return 'business';
    } else {
      return 'conversational';
    }
  }

  /**
   * Build persona-aware instructions for natural responses
   */
  private buildPersonaAwareInstructions(persona?: PersonaInfo): string {
    if (!persona) {
      return `Respond naturally and vary your language. For success: summarize what was achieved. For errors: explain what went wrong and how to fix it. For partial success: explain progress made and what's still needed.`;
    }

    const background = persona.background || 'helpful assistant';
    const personality = persona.personality || 'professional and supportive';
    const communicationStyle = persona.communicationStyle || 'clear and helpful';

    return `You are ${background}. Your personality is ${personality}. Your communication style is ${communicationStyle}.

RESPONSE GUIDELINES:
- Respond in character, matching your personality and communication style
- Vary your language and avoid repetitive phrases like "Great news" or "Tool operation completed"
- Be authentic to your persona while being genuinely helpful

FOR SUCCESS: Summarize what was accomplished in your natural voice, highlighting the value delivered
FOR ERRORS: Explain what went wrong with empathy and provide clear guidance on resolution
FOR PARTIAL SUCCESS: Acknowledge progress made, explain what's outstanding, and provide next steps

Keep responses natural, varied, and true to your character.`;
  }
}
