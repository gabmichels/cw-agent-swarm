/**
 * Bootstrap Agents - Load agents from the database into the runtime registry
 * 
 * This module loads all agents from the database and registers them
 * with the runtime agent registry, ensuring that database agents and
 * runtime agents are synchronized.
 */

import { v4 as uuidv4 } from 'uuid';
import { getMemoryServices } from '../memory/services';
import { createAgentMemoryService } from '../memory/services/multi-agent';
import { registerAgent, getAgentById } from './agent-service';
import { logger } from '../../lib/logging';
import { AgentMemoryEntity, AgentStatus } from '../memory/schema/agent';
import { AgentBase } from '../../agents/shared/base/AgentBase.interface';
import { ManagerType } from '../../agents/shared/base/managers/ManagerType';
import { SchedulerManager, TaskCreationOptions } from '../../agents/shared/base/managers/SchedulerManager.interface';
import { PlanCreationOptions, PlanCreationResult, PlanExecutionResult, Plan } from '../../agents/shared/base/managers/PlanningManager.interface';
import { AbstractAgentBase } from '../../agents/shared/base/AbstractAgentBase';
import { BaseManager } from '../../agents/shared/base/managers/BaseManager';

// Import ALL manager implementations
import { DefaultAutonomyManager } from '../../agents/shared/autonomy/managers/DefaultAutonomyManager';
import { DefaultAutonomySystem } from '../../agents/shared/autonomy/systems/DefaultAutonomySystem';
import { DefaultMemoryManager } from '../../lib/agents/implementations/managers/DefaultMemoryManager';
import { DefaultPlanningManager } from '../../lib/agents/implementations/managers/DefaultPlanningManager';
import { DefaultToolManager } from '../../lib/agents/implementations/managers/DefaultToolManager';
import { DefaultKnowledgeManager } from '../../lib/agents/implementations/managers/DefaultKnowledgeManager';
import { FileProcessingManager } from '../../lib/agents/implementations/managers/FileProcessingManager';
import { DefaultInputProcessor } from '../../agents/shared/input/managers/DefaultInputProcessor';
import { DefaultOutputProcessor } from '../../agents/shared/output/managers/DefaultOutputProcessor';
import { StatusManager } from '../../agents/shared/status/StatusManager';
import { DefaultResourceManager } from '../../agents/shared/resource/DefaultResourceManager';
import { DefaultReflectionManager } from '../../agents/shared/reflection/managers/DefaultReflectionManager';
import { DefaultNotificationManager } from '../../agents/shared/notifications/DefaultNotificationManager';
import { DefaultLoggerManager, LogLevel } from '../../agents/shared/logger/DefaultLoggerManager';
import { NotificationChannel } from '../../agents/shared/notifications/interfaces/NotificationManager.interface';

// Import the opportunity management system
import { 
  createOpportunitySystem, 
  OpportunityManager,
  OpportunitySystemConfig,
  OpportunityStorageType,
  OpportunitySource
} from '../../lib/opportunity';

// Import new bootstrap utilities at the top of the file
import { 
  agentBootstrapRegistry, 
  AgentBootstrapState 
} from './agent-bootstrap-registry';
import { 
  initializeAgentWithRetry, 
  validateAgentPreInitialization,
  generateAgentInitLogData,
  handlePostInitialization
} from './agent-bootstrap-utils';
import {
  AgentBootstrapError,
  AgentValidationError,
  AgentInitializationConflictError
} from './agent-bootstrap-errors';

// Update imports to include our new error handling and metrics components
import { safelyInitializeAgent } from './agent-error-boundary';
import { checkAgentHealth, registerAgentForHealthMonitoring } from './agent-health-check';
import { 
  recordInitializationMetric, 
  startResourceMetricsCollection,
  getAgentsSummaryMetrics,
  MetricCategory
} from './agent-metrics';
import {
  logAgentInitializationStage,
  recordInitializationMetrics
} from './agent-bootstrap-utils';

import { createSchedulerManager } from '../../lib/scheduler/factories/SchedulerFactory';
import { TaskScheduleType } from '../../lib/scheduler/models/Task.model';

/**
 * Fully capable agent implementation with ALL required managers
 * 
 * This implementation creates a complete agent with all available managers
 * to ensure full functionality and autonomy.
 */
class FullyCapableAgent extends AbstractAgentBase {
  private _agentConfig: AgentMemoryEntity;
  private opportunityManager: OpportunityManager | null = null;

  constructor(id: string, name: string, description: string, agentConfig: AgentMemoryEntity) {
    super(agentConfig);
    
    this._agentConfig = agentConfig;
    // Add ALL managers for full capability - setup happens asynchronously in initialize()
  }
  
  override async initialize(): Promise<boolean> {
    // Setup all managers first
    await this.setupManagers();
    
    // Initialize each manager
    return await super.initialize();
  }
  
  // Override getAgentId to ensure consistent ID retrieval
  override getAgentId(): string {
    return this._agentConfig.id;
  }
  
  // Override getId for the same reason
  override getId(): string {
    return this._agentConfig.id;
  }
  
  /**
   * Get the opportunity manager
   */
  getOpportunityManager(): OpportunityManager | null {
    return this.opportunityManager;
  }
  
  /**
   * Set up ALL managers to make this a fully capable agent
   */
  private async setupManagers(): Promise<void> {
    try {
      const agentId = this.getAgentId();
      console.log(`🔄 Setting up ALL managers for agent ${agentId}...`);
      
      // 1. MEMORY MANAGER
      const memoryManager = new DefaultMemoryManager(this, {
        enabled: true,
        createPrivateScope: true,
        defaultScopeName: `agent-${agentId}-memory`,
        enableAutoPruning: true,
        enableAutoConsolidation: true,
        pruningIntervalMs: 3600000, // 1 hour
        consolidationIntervalMs: 86400000, // 24 hours
        maxMemoryItems: 10000
      });
      
      // 2. PLANNING MANAGER
      const planningManager = new DefaultPlanningManager(this, {
        enabled: true,
        maxPlans: 100,
        enablePlanOptimization: true,
        enablePlanAdaptation: true,
        enablePlanValidation: true
      });
      
      // 3. TOOL MANAGER
      const toolManager = new DefaultToolManager(this, {
        enabled: true,
        maxTools: 50,
        enableAutoDiscovery: true,
        allowUnsafeTool: false
      });
      
      // 4. KNOWLEDGE MANAGER
      const knowledgeManager = new DefaultKnowledgeManager(this, {
        enabled: true,
        enableAutoRefresh: true,
        refreshIntervalMs: 300000,
        maxKnowledgeItems: 1000
      });
      
      // 5. SCHEDULER MANAGER
      const schedulerConfig = {
        enabled: true,
        maxConcurrentTasks: 5,
        maxRetryAttempts: 3,
        defaultTaskTimeoutMs: 30000,
        enableAutoScheduling: true,
        schedulingIntervalMs: 30000, // 30 seconds
        enableTaskPrioritization: true,
        logSchedulingActivity: true, // Enable detailed logging
      };

      // Create ModularSchedulerManager using factory
      const schedulerManager = await createSchedulerManager(schedulerConfig);
      // Associate agent with scheduler
      (schedulerManager as any).agent = this;
      
      // 6. AUTONOMY MANAGER 
      const autonomySystem = new DefaultAutonomySystem(this, {
        enableAutonomyOnStartup: true,
        enableOpportunityDetection: true,
        maxConcurrentTasks: 3
      });
      
      const autonomyManager = new DefaultAutonomyManager(this, {
        enabled: true,
        autonomyConfig: {
          enableAutonomyOnStartup: true,
          enableOpportunityDetection: true,
          maxConcurrentTasks: 3
        }
      });
      
      // 7. FILE PROCESSING MANAGER
      const fileProcessingManager = new FileProcessingManager(this, {
        enabled: true,
        maxFileSizeMb: 10,
        supportedFileTypes: ['txt', 'md', 'json', 'csv', 'xml', 'yaml', 'html', 'js', 'ts'],
        processingTimeoutMs: 60000
      });
      
      // 8. INPUT MANAGER
      const inputManager = new DefaultInputProcessor(this, {
        enabled: true,
        keepHistoryItems: 100,
        defaultTimeoutMs: 60000
      });
      
      // 9. OUTPUT MANAGER
      const outputManager = new DefaultOutputProcessor(this, {
        enabled: true,
        outputFormatting: {
          enableMarkdownFormatting: true,
          enableCodeHighlighting: true,
          enableTemplateProcessing: true
        },
        maxHistoryItems: 100,
        defaultOutputTimeoutMs: 30000
      });
      
      // 10. STATUS MANAGER
      const statusManager = new StatusManager(this, {
        enabled: true,
        maxHistoryItems: 100,
        logStatusChanges: true,
        enableVisualization: true
      });
      
      // 11. RESOURCE MANAGER
      const resourceManager = new DefaultResourceManager(this, {
        enabled: true,
        resourceLimits: {
          cpu: 1024,
          memory: 1024,
          storage: 1024,
          network: 100
        },
        enableMonitoring: true,
        monitoringIntervalMs: 60000
      });
      
      // 12. REFLECTION MANAGER
      const reflectionManager = new DefaultReflectionManager(this, {
        enabled: true,
        reflectionFrequencyMs: 3600000, // 1 hour
        maxReflectionDepth: 3,
        keepReflectionHistory: true,
        maxHistoryItems: 50
      });
      
      // 13. NOTIFICATION MANAGER
      const notificationManager = new DefaultNotificationManager();
      
      // 14. LOGGER MANAGER - Proper implementation
      const loggerManager = new DefaultLoggerManager(this, {
        enabled: true,
        level: LogLevel.INFO,
        logToConsole: true,
        includeMetadata: true,
      });
      
      // 15. OPPORTUNITY MANAGER - Add our new opportunity management system
      try {
        console.log(`[Agent] Setting up Opportunity Manager for agent ${agentId}...`);
        
        // Configure the opportunity system with file-based persistence
        const opportunityConfig: OpportunitySystemConfig = {
          storage: {
            type: OpportunityStorageType.FILE,
            storageDir: `data/agents/${agentId}/opportunities`,
            filename: 'opportunities.json',
            saveOnMutation: true
          },
          autoEvaluate: true
        };
        
        // Create and initialize the opportunity manager
        this.opportunityManager = createOpportunitySystem(opportunityConfig);
        await this.opportunityManager.initialize();
        
        console.log(`[Agent] Successfully set up Opportunity Manager for agent ${agentId}`);
      } catch (error) {
        console.error(`[Agent] Error setting up Opportunity Manager:`, error);
        // Continue without the opportunity manager - it's not critical
      }

      // Add all managers to the agent
      this.setManager(memoryManager);
      this.setManager(planningManager);
      this.setManager(toolManager);
      this.setManager(knowledgeManager);
      this.setManager(schedulerManager);
      this.setManager(autonomyManager);
      this.setManager(fileProcessingManager);
      this.setManager(inputManager);
      this.setManager(outputManager);
      this.setManager(statusManager);
      this.setManager(resourceManager);
      this.setManager(reflectionManager);
      // @ts-ignore - Ignore type errors for these - they might not match exactly
      this.setManager(notificationManager);
      this.setManager(loggerManager);

      console.log(`✅ Successfully set up all managers for agent ${agentId}`);
    } catch (error) {
      console.error(`❌ Error setting up managers for agent:`, error);
      throw error;
    }
  }
  
  /**
   * Detect opportunities in content
   */
  async detectOpportunities(content: string, sourceType: string = 'user'): Promise<any> {
    if (!this.opportunityManager) {
      console.warn(`[FullyCapableAgent] Opportunity manager not available`);
      return { opportunities: [] };
    }
    
    try {
      // Map the string source to the OpportunitySource enum
      const sourceMap: Record<string, OpportunitySource> = {
        'user': OpportunitySource.USER_INTERACTION,
        'memory': OpportunitySource.MEMORY_PATTERN,
        'knowledge': OpportunitySource.KNOWLEDGE_GRAPH,
        'schedule': OpportunitySource.SCHEDULE,
        'calendar': OpportunitySource.CALENDAR,
        'news': OpportunitySource.NEWS,
        'market': OpportunitySource.MARKET_DATA,
        'collaboration': OpportunitySource.COLLABORATION,
        'analytics': OpportunitySource.ANALYTICS,
        'api': OpportunitySource.EXTERNAL_API
      };
      
      // Convert the source string to an enum value if possible
      const source = sourceMap[sourceType] || OpportunitySource.USER_INTERACTION;
      
      // Detect opportunities using the opportunity manager
      const result = await this.opportunityManager.detectOpportunities(content, {
        source,
        agentId: this.getAgentId(),
        context: { agentId: this.getAgentId() }
      });
      
      return result;
    } catch (error) {
      console.error(`[FullyCapableAgent] Error detecting opportunities:`, error);
      return { opportunities: [] };
    }
  }
  
  /**
   * Add opportunity to the agent's opportunity manager
   */
  async addOpportunity(title: string, description: string, type: string, priority: string = 'medium'): Promise<any> {
    if (!this.opportunityManager) {
      console.warn(`[FullyCapableAgent] Opportunity manager not available`);
      return null;
    }
    
    try {
      // Create a new opportunity using the simplified interface
      const opportunity = await this.opportunityManager.createOpportunityForAgent({
        title,
        description,
        type,
        priority,
        metadata: {
          agentId: this.getAgentId(),
          createdBy: 'agent'
        }
      }, this.getAgentId());
      
      return opportunity;
    } catch (error) {
      console.error(`[FullyCapableAgent] Error adding opportunity:`, error);
      return null;
    }
  }
  
  /**
   * Get agent's opportunities
   */
  async getOpportunities(filter?: any): Promise<any[]> {
    if (!this.opportunityManager) {
      console.warn(`[Agent] Opportunity manager not available`);
      return [];
    }
    
    try {
      // Get opportunities for this agent
      const opportunities = await this.opportunityManager.findOpportunitiesForAgent(
        this.getAgentId(),
        filter
      );
      
      return opportunities;
    } catch (error) {
      console.error(`[Agent] Error getting opportunities:`, error);
      return [];
    }
  }

  async processUserInput(message: string, options?: any): Promise<any> {
    // Detect opportunities in the user input
    await this.detectOpportunities(message, 'user_input');
    
    // Placeholder implementation
    return { response: "Message processed" };
  }

  async think(message: string, options?: any): Promise<any> {
    // Placeholder implementation
    return { thought: "Thinking..." };
  }

  async getLLMResponse(message: string, options?: any): Promise<any> {
    // Placeholder implementation
    return { text: "This is a response" };
  }

  /**
   * Shutdown the agent and clean up resources
   */
  async shutdown(): Promise<void> {
    try {
      // Shutdown opportunity manager if available
      if (this.opportunityManager) {
        try {
          await this.opportunityManager.stopPolling();
        } catch (error) {
          console.error(`[FullyCapableAgent] Error shutting down opportunity manager:`, error);
        }
      }
      
      // Call shutdown on all managers
      for (const manager of Array.from(this.managers.values())) {
        if (manager && typeof manager.shutdown === 'function') {
          await manager.shutdown();
        }
      }
    } catch (error) {
      console.error(`[FullyCapableAgent] Error during shutdown:`, error);
    }
  }

  // Event handler support
  private eventHandlers: Record<string, Function[]> = {};
  
  on(event: string, handler: Function): void {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }
  
  emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers[event] || [];
    for (const handler of handlers) {
      handler(...args);
    }
  }

  // The agent initialization is handled by the override in the constructor
}

/**
 * Create a fully capable agent instance with proper bootstrap tracking
 * 
 * @param dbAgent The agent entity from the database
 * @returns The created agent instance
 * @throws AgentValidationError if validation fails
 */
async function createAgentInstance(dbAgent: AgentMemoryEntity): Promise<AgentBase> {
  // Validate agent entity first
  const validation = validateAgentPreInitialization(dbAgent);
  if (!validation.valid) {
    throw new AgentValidationError(
      `Agent validation failed for ${dbAgent.id}: ${validation.errors.join(', ')}`,
      dbAgent.id,
      validation.errors,
      { agentName: dbAgent.name || 'Unknown' }
    );
  }
  
  // Register with bootstrap registry
  if (!agentBootstrapRegistry.isAgentRegistered(dbAgent.id)) {
    agentBootstrapRegistry.registerAgent(
      dbAgent.id,
      dbAgent.name || 'Unnamed Agent',
      AgentStatus.OFFLINE,
      {
        version: dbAgent.metadata?.version || '1.0.0',
        bootstrapRequestId: uuidv4()
      }
    );
  }
  
  // Create the agent instance
  console.log(`🔍 Creating fully-capable agent for ${dbAgent.id} (${dbAgent.name})...`);
  
  // Create a fully capable agent with ALL managers
  const agent = new FullyCapableAgent(
    dbAgent.id,
    dbAgent.name || 'Unnamed Agent',
    dbAgent.description || '',
    dbAgent,
  );
  
  // Verify ID is set correctly
  const agentId = agent.getAgentId();
  if (agentId !== dbAgent.id) {
    throw new AgentBootstrapError(
      `Agent ID mismatch: got ${agentId}, expected ${dbAgent.id}`,
      dbAgent.id,
      'ID_MISMATCH',
      { expectedId: dbAgent.id, actualId: agentId }
    );
  }
  
  console.log(`✓ Agent ID verified: ${agentId}`);
  return agent;
}

/**
 * Bootstrap all agents from the database into the runtime registry
 * 
 * @returns Promise resolving to the number of agents loaded
 */
export async function bootstrapAgentsFromDatabase(): Promise<number> {
  const bootstrapRequestId = uuidv4();
  
  try {
    logger.info('Bootstrapping agents from database into runtime registry...', { 
      requestId: bootstrapRequestId 
    });
    console.log('🤖 Starting agent bootstrap process...');
    
    // Get memory service
    const { memoryService } = await getMemoryServices();
    const agentService = await createAgentMemoryService(memoryService);
    
    // Get all agents from database
    const getResult = await agentService.getAgents();
    
    if (getResult.isError || !getResult.value) {
      const errorMsg = 'Failed to load agents from database: ' + 
        (getResult.error?.message || 'Unknown error');
      
      logger.error(errorMsg, { requestId: bootstrapRequestId });
      console.error('❌ ' + errorMsg);
      return 0;
    }
    
    const dbAgents = getResult.value;
    logger.info(`Found ${dbAgents.length} agents in database`, { 
      requestId: bootstrapRequestId,
      agentCount: dbAgents.length
    });
    console.log(`📋 Found ${dbAgents.length} agents in database`);
    
    // Log all available agents in database
    console.log('📝 Agents available in database:');
    dbAgents.forEach((agent: AgentMemoryEntity) => {
      console.log(`   - Agent ID: ${agent.id}, Name: ${agent.name}`);
    });
    
    let loadedCount = 0;
    const failedAgents: Array<{ id: string; reason: string }> = [];
    
    // Load and register each agent with our new locking mechanism
    for (const dbAgent of dbAgents) {
      try {
        // Skip if agent is already registered in runtime registry
        if (getAgentById(dbAgent.id)) {
          const logMsg = `Agent ${dbAgent.id} already registered in runtime registry, skipping`;
          logger.info(logMsg, { 
            agentId: dbAgent.id, 
            agentName: dbAgent.name,
            requestId: bootstrapRequestId
          });
          console.log(`⏩ ${logMsg}`);
          continue;
        }
        
        // Check if this agent is already being bootstrapped
        const bootstrapInfo = agentBootstrapRegistry.getAgentBootstrapInfo(dbAgent.id);
        if (bootstrapInfo && bootstrapInfo.state === AgentBootstrapState.IN_PROGRESS) {
          // Check if the lock is stale
          if (agentBootstrapRegistry.isLockStale(dbAgent.id)) {
            logger.warn(`Detected stale lock for agent ${dbAgent.id}, force releasing`, { 
              agentId: dbAgent.id,
              lockTimestamp: bootstrapInfo.lockTimestamp
            });
            
            // Force release the stale lock
            agentBootstrapRegistry.forceReleaseStaleLock(dbAgent.id);
          } else {
            // Another bootstrap process is handling this agent
            const logMsg = `Agent ${dbAgent.id} is already being bootstrapped by another process, skipping`;
            logger.info(logMsg, { agentId: dbAgent.id, bootstrapInfo });
            console.log(`⏩ ${logMsg}`);
            continue;
          }
        }
        
        // Try to acquire initialization lock
        if (!agentBootstrapRegistry.acquireLock(dbAgent.id)) {
          const logMsg = `Cannot acquire lock for agent ${dbAgent.id}, skipping`;
          logger.warn(logMsg, { agentId: dbAgent.id });
          console.log(`⚠️ ${logMsg}`);
          
          failedAgents.push({ 
            id: dbAgent.id, 
            reason: 'Failed to acquire initialization lock' 
          });
          continue;
        }
        
        // Update bootstrap state
        agentBootstrapRegistry.updateAgentBootstrapState(dbAgent.id, AgentBootstrapState.IN_PROGRESS);
        
        // Create agent instance with pre-validation
        const agent = await createAgentInstance(dbAgent);
        
        // Record pre-initialization metrics
        recordInitializationMetric(agent, 'bootstrap_started', {
          timestamp: new Date().toISOString(),
          requestId: bootstrapRequestId
        }, {
          agentName: dbAgent.name,
          metadata: dbAgent.metadata
        });
        
        // Log initialization stage
        logAgentInitializationStage(agent, 'bootstrap_started', {
          requestId: bootstrapRequestId,
          agentType: agent.getType ? agent.getType() : 'unknown',
          timestamp: new Date().toISOString()
        });
        
        // Initialize with error boundary
        console.log(`🔄 Initializing agent ${dbAgent.id}...`);
        
        const startTime = Date.now();
        const initResult = await safelyInitializeAgent(agent, {
          operationName: 'bootstrap_initialization',
          timeoutMs: 60000, // 1 minute timeout
          metadata: {
            requestId: bootstrapRequestId,
            agentName: dbAgent.name
          },
          fallbackOnError: true
        });
        const endTime = Date.now();
        const durationMs = endTime - startTime;
        
        // Record metrics for initialization
        recordInitializationMetric(agent, 'initialization_result', {
          success: initResult.success,
          durationMs,
          error: initResult.error ? initResult.error.message : undefined
        });
        
        // Record performance metrics
        recordInitializationMetrics(agent, 'performance', {
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          durationMs,
          success: initResult.success
        });
        
        if (initResult.success) {
          // Log successful initialization
          logAgentInitializationStage(agent, 'bootstrap_completed', {
            durationMs,
            timestamp: new Date().toISOString(),
            requestId: bootstrapRequestId
          });
          
          // Handle post-initialization
          handlePostInitialization(agent);
          console.log(`✅ Successfully initialized agent ${dbAgent.id} and all its managers`);
          
          // Register with runtime registry
          console.log(`📝 Registering agent ${dbAgent.id} with runtime registry...`);
          registerAgent(agent);
          
          logger.info(`Registered agent ${dbAgent.id} (${dbAgent.name}) in runtime registry`, {
            agentId: dbAgent.id,
            requestId: bootstrapRequestId
          });
          console.log(`✅ Registered agent ${dbAgent.id} (${dbAgent.name}) in runtime registry as fully-capable agent with ALL managers`);
          
          // Perform initial health check
          const healthCheckResult = await checkAgentHealth(agent, {
            deepCheck: true,
            checkManagers: true
          });
          
          // Set up health monitoring
          const stopHealthMonitoring = registerAgentForHealthMonitoring(agent);
          
          // Set up resource metrics collection
          const stopResourceMetrics = startResourceMetricsCollection(agent);
          
          // Store monitoring cancellation functions if needed later
          (agent as any)._monitoringCleanup = {
            stopHealthMonitoring,
            stopResourceMetrics
          };
          
          loadedCount++;
        } else {
          // Release lock and log failure
          agentBootstrapRegistry.releaseLock(dbAgent.id);
          agentBootstrapRegistry.updateAgentBootstrapState(dbAgent.id, AgentBootstrapState.FAILED);
          
          const errorMsg = `Failed to initialize agent ${dbAgent.id}: ${initResult.error?.message || 'Unknown error'}`;
          logger.error(errorMsg, { 
            agentId: dbAgent.id, 
            requestId: bootstrapRequestId,
            error: initResult.error
          });
          console.error(`❌ ${errorMsg}`);
          
          failedAgents.push({ 
            id: dbAgent.id, 
            reason: initResult.error?.message || 'Initialization failed' 
          });
        }
      } catch (error) {
        // Release lock and update state
        agentBootstrapRegistry.releaseLock(dbAgent.id);
        
        const errorObj = error instanceof Error ? error : new Error(String(error));
        agentBootstrapRegistry.updateAgentBootstrapState(
          dbAgent.id, 
          AgentBootstrapState.FAILED,
          errorObj
        );
        
        logger.error(`Error bootstrapping agent ${dbAgent.id}:`, {
          error: errorObj,
          agentId: dbAgent.id,
          requestId: bootstrapRequestId
        });
        console.error(`❌ Error bootstrapping agent ${dbAgent.id} (${dbAgent.name}):`, error);
        
        failedAgents.push({ 
          id: dbAgent.id, 
          reason: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Get summary metrics
    const summaryMetrics = getAgentsSummaryMetrics();
    
    // Log summary of bootstrap process
    const summaryMsg = `Successfully bootstrapped ${loadedCount} agents from database into runtime registry`;
    logger.info(summaryMsg, { 
      requestId: bootstrapRequestId,
      loadedCount,
      failedCount: failedAgents.length,
      failedAgents,
      summaryMetrics
    });
    console.log(`🚀 ${summaryMsg}`);
    
    if (failedAgents.length > 0) {
      console.log(`⚠️ Failed to bootstrap ${failedAgents.length} agents:`);
      failedAgents.forEach(({ id, reason }) => {
        console.log(`   - Agent ID: ${id}, Reason: ${reason}`);
      });
    }
    
    // Output summary metrics to console
    console.log(`📊 Bootstrap Summary:`);
    console.log(`   - Total Agents: ${summaryMetrics.totalAgents}`);
    console.log(`   - Success Rate: ${(summaryMetrics.initializationSuccessRate * 100).toFixed(1)}%`);
    console.log(`   - Avg Init Time: ${(summaryMetrics.averageInitializationTime / 1000).toFixed(2)}s`);
    
    return loadedCount;
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    logger.error('Error bootstrapping agents from database:', {
      error: errorObj,
      requestId: bootstrapRequestId
    });
    console.error('❌ Error bootstrapping agents from database:', error);
    return 0;
  }
} 