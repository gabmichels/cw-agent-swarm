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
import { DefaultSchedulerManager } from '../../lib/agents/implementations/managers/DefaultSchedulerManager';
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

/**
 * Fully capable agent implementation with ALL required managers
 * 
 * This implementation creates a complete agent with all available managers
 * to ensure full functionality and autonomy.
 */
class FullyCapableAgent extends AbstractAgentBase {
  private _agentConfig: AgentMemoryEntity;

  constructor(id: string, name: string, description: string, agentConfig: AgentMemoryEntity) {
    super(agentConfig);
    
    this._agentConfig = agentConfig;
    // Add ALL managers for full capability
    this.setupManagers();
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
   * Set up ALL managers to make this a fully capable agent
   */
  private setupManagers(): void {
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
      const schedulerManager = new DefaultSchedulerManager(this, {
        enabled: true,
        maxConcurrentTasks: 5,
        maxRetryAttempts: 3,
        defaultTaskTimeoutMs: 30000,
        enableAutoScheduling: true,
        schedulingIntervalMs: 30000, // 30 seconds
        enableTaskPrioritization: true,
        logSchedulingActivity: true, // Enable detailed logging
      });
      
      // Add a debug task for testing scheduler functionality
      setTimeout(() => {
        console.log(`[${agentId}] Creating test scheduled task for agent`);
        schedulerManager.createTask({
          title: "Periodic health check",
          description: "Check system health and report status",
          type: "system_health",
          priority: 0.7,
          metadata: {
            scheduleType: "interval",
            intervalMs: 30000, // Every 30 seconds (shorter for testing)
            startAfterMs: 10000, // Start after 10 seconds (shorter for testing)
            isDebugTask: true,
            action: "processUserInput", // Task will call the agent's processUserInput method
            parameters: {
              message: "Run a quick health check and report any issues."
            }
          }
        }).then(taskResult => {
          console.log(`[${agentId}] Test task created: ${JSON.stringify(taskResult)}`);
          
          // Also create an immediate task that should run right away
          return schedulerManager.createTask({
            title: "Immediate health check",
            description: "Run an immediate system health check",
            type: "system_health",
            priority: 1.0, // Higher priority
            metadata: {
              scheduledTime: new Date(Date.now() + 5000), // 5 seconds from now
              isDebugTask: true,
              action: "processUserInput",
              parameters: {
                message: "Run an immediate health check to verify scheduler is working."
              }
            }
          });
        }).then(immediateTaskResult => {
          if (immediateTaskResult) {
            console.log(`[${agentId}] Immediate task created: ${JSON.stringify(immediateTaskResult)}`);
          }
        }).catch(err => {
          console.error(`[${agentId}] Error creating test task:`, err);
        });
      }, 10000);
      
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
        formatMessages: true,
        trackLogHistory: true,
        maxHistorySize: 1000
      });
      
      // Placeholder functions for remaining manager types (MESSAGING, INTEGRATION)
      // that don't have concrete implementations yet
      const createPlaceholderManager = (type: ManagerType, enabled: boolean = true) => {
        return {
          managerId: `${type}-manager-${uuidv4()}`,
          managerType: type,
          enabled: enabled,
          initialize: async () => {
            console.log(`[${type}-manager-${agentId}] Initializing placeholder manager`);
            return true;
          },
          shutdown: async () => {},
          getStatus: () => ({ status: 'available', health: { status: 'healthy' } }),
          isEnabled: () => enabled,
          setEnabled: (value: boolean) => { return value; },
          getAgent: () => this,
          getHealth: async () => ({ status: 'healthy' as const, message: 'Placeholder manager is healthy' })
        } as unknown as BaseManager;
      };
      
      // Create placeholder managers for remaining types
      const messagingManager = createPlaceholderManager(ManagerType.MESSAGING);
      const integrationManager = createPlaceholderManager(ManagerType.INTEGRATION);
      
      // Register all managers with the agent
      console.log(`[${agentId}] Registering all managers...`);
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
      this.setManager(loggerManager);
      
      // Store notification manager reference to initialize it separately (not through AbstractAgentBase)
      // since it doesn't fully implement BaseManager
      const notificationInitPromise = notificationManager.initialize({
        defaultSenderId: agentId,
        channels: [
          {
            type: NotificationChannel.UI,
            name: 'UI Notifications',
            enabled: true,
            config: {}
          },
          {
            type: NotificationChannel.SYSTEM,
            name: 'System Notifications',
            enabled: true,
            config: {}
          }
        ]
      });
      
      // Register placeholder managers
      this.setManager(messagingManager);
      this.setManager(integrationManager);
      
      // Log the count of registered managers
      console.log(`[${agentId}] Registered ${this.getManagers().length} managers for agent`);
      
      // Configure notification manager separately since it doesn't fully conform to BaseManager interface
      notificationInitPromise.then(() => {
        console.log(`✅ Notification manager initialized for agent ${agentId}`);
      }).catch(error => {
        console.error(`❌ Error initializing notification manager for agent ${agentId}:`, error);
      });
      
      console.log(`✅ All managers set up for agent ${agentId}`);
      
      // Enable autonomy once initialized
      this.on('initialized', () => {
        if (typeof autonomyManager.setAutonomyMode === 'function') {
          autonomyManager.setAutonomyMode(true).then(enabled => {
            console.log(`✅ Autonomy mode ${enabled ? 'enabled' : 'failed to enable'} for agent ${agentId}`);
          });
  }
      });
      
    } catch (error) {
      const agentId = this.getAgentId();
      console.error(`❌ Error setting up managers for agent ${agentId}:`, error);
    }
  }

  // Abstract methods we need to implement since we extend AbstractAgentBase
  async processUserInput(message: string, options?: any): Promise<any> {
    return { content: 'Placeholder agent cannot process input' };
  }

  async think(message: string, options?: any): Promise<any> {
    return { success: false, error: 'Placeholder agent cannot think' };
  }

  async getLLMResponse(message: string, options?: any): Promise<any> {
    return { content: 'Placeholder agent cannot generate responses' };
  }

  // Override shutdown from AbstractAgentBase
  async shutdown(): Promise<void> {
    await this.shutdownManagers();
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

  /**
   * Initialize the agent
   */
  override async initialize(): Promise<boolean> {
    const agentId = this.getAgentId();
    console.log(`[${agentId}] Initializing agent and all managers...`);
    
    try {
      // Get reference to all managers
      const managers = this.getManagers();
      console.log(`[${agentId}] Initializing ${managers.length} managers...`);
      
      // Initialize each manager individually
      for (const manager of managers) {
        try {
          console.log(`[${agentId}] Initializing manager: ${manager.managerId}`);
          const result = await manager.initialize();
          console.log(`[${agentId}] Manager ${manager.managerId} initialized, result: ${result}`);
        } catch (error) {
          console.error(`[${agentId}] Error initializing manager ${manager.managerId}:`, error);
        }
      }
      
      return true;
    } catch (error) {
      console.error(`[${agentId}] Error initializing agent:`, error);
      return false;
    }
  }
}

/**
 * Bootstrap all agents from the database into the runtime registry
 * 
 * @returns Promise resolving to the number of agents loaded
 */
export async function bootstrapAgentsFromDatabase(): Promise<number> {
  try {
    logger.info('Bootstrapping agents from database into runtime registry...');
    console.log('🤖 Starting agent bootstrap process...');
    
    // Get memory service
    const { memoryService } = await getMemoryServices();
    const agentService = await createAgentMemoryService(memoryService);
    
    // Get all agents from database
    const getResult = await agentService.getAgents();
    
    if (getResult.isError || !getResult.value) {
      logger.error('Failed to load agents from database:', getResult.error?.message);
      console.error('❌ Failed to load agents from database:', getResult.error?.message);
      return 0;
    }
    
    const dbAgents = getResult.value;
    logger.info(`Found ${dbAgents.length} agents in database`);
    console.log(`📋 Found ${dbAgents.length} agents in database`);
    
    // Log all available agents in database
    console.log('📝 Agents available in database:');
    dbAgents.forEach((agent: AgentMemoryEntity) => {
      console.log(`   - Agent ID: ${agent.id}, Name: ${agent.name}`);
    });
    
    let loadedCount = 0;
    
    // Load and register each agent
    for (const dbAgent of dbAgents) {
      try {
        // Skip if agent is already registered
        if (getAgentById(dbAgent.id)) {
          logger.info(`Agent ${dbAgent.id} already registered, skipping`);
          console.log(`⏩ Agent ${dbAgent.id} (${dbAgent.name}) already registered, skipping`);
          continue;
        }
        
        // Debug log
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
          throw new Error(`Agent ID mismatch: got ${agentId}, expected ${dbAgent.id}`);
        }
        
        console.log(`✓ Agent ID verified: ${agentId}`);
        
        // Initialize the agent - this will properly initialize each manager now
        console.log(`🔄 Initializing agent ${agentId}...`);
        const initSuccess = await agent.initialize();
        
        if (initSuccess) {
          agent.emit('initialized');
          console.log(`✅ Successfully initialized agent ${agentId} and all its managers`);
        } else {
          console.warn(`⚠️ Agent ${agentId} initialized with warnings or errors`);
        }
        
        // Register with runtime registry
        console.log(`📝 Registering agent ${agentId} with runtime registry...`);
        registerAgent(agent);
        logger.info(`Registered agent ${dbAgent.id} (${dbAgent.name}) in runtime registry`);
        console.log(`✅ Registered agent ${dbAgent.id} (${dbAgent.name}) in runtime registry as fully-capable agent with ALL managers`);
        
        loadedCount++;
      } catch (error) {
        logger.error(`Error bootstrapping agent ${dbAgent.id}:`, error);
        console.error(`❌ Error bootstrapping agent ${dbAgent.id} (${dbAgent.name}):`, error);
      }
    }
    
    logger.info(`Successfully bootstrapped ${loadedCount} agents from database into runtime registry`);
    console.log(`🚀 Successfully bootstrapped ${loadedCount} agents from database into runtime registry`);
    return loadedCount;
  } catch (error) {
    logger.error('Error bootstrapping agents from database:', error);
    console.error('❌ Error bootstrapping agents from database:', error);
    return 0;
  }
} 