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
import { DefaultAgent } from '../../agents/shared/DefaultAgent';
import { ManagerType } from '../../agents/shared/base/managers/ManagerType';
import { VisualizationConfig } from '../../types/visualization-integration';

// Import new bootstrap utilities at the top of the file
import { 
  agentBootstrapRegistry, 
  AgentBootstrapState 
} from './agent-bootstrap-registry';
import { 
  validateAgentPreInitialization,
  handlePostInitialization
} from './agent-bootstrap-utils';
import {
  AgentBootstrapError,
  AgentValidationError,
} from './agent-bootstrap-errors';

// Update imports to include our new error handling and metrics components
import { safelyInitializeAgent } from './agent-error-boundary';
import { checkAgentHealth, registerAgentForHealthMonitoring } from './agent-health-check';
import { 
  recordInitializationMetric, 
  startResourceMetricsCollection,
  getAgentsSummaryMetrics,
} from './agent-metrics';
import {
  logAgentInitializationStage,
  recordInitializationMetrics
} from './agent-bootstrap-utils';



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
  
  // Register with bootstrap registry if not already registered
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
  logger.debug(`🔍 Creating DefaultAgent for ${dbAgent.id} (${dbAgent.name})...`);
  
  // Create agent configuration
  const agentConfig = {
    id: dbAgent.id,
    name: dbAgent.name || 'Unnamed Agent',
    description: dbAgent.description || '',
    
    // Use enhanced managers
    useEnhancedMemory: true,
    useEnhancedReflection: true,
    
    // Enable adaptive behavior
    adaptiveBehavior: true,
    
    // CRITICAL: Enable all required managers explicitly
    enableMemoryManager: true,
    enablePlanningManager: true,
    enableToolManager: true,
    enableKnowledgeManager: true,
    enableSchedulerManager: true,
    enableReflectionManager: true,
    enableInputProcessor: true,
    enableOutputProcessor: true,
    enableResourceTracking: true,
    
    // Phase 2 managers (disabled for now)
    enableEthicsManager: false,
    enableCollaborationManager: false,
    enableCommunicationManager: false,
    enableNotificationManager: false,
    
    // Configure memory refresh
    memoryRefresh: {
      enabled: true,
      interval: 3600000, // 1 hour
      maxCriticalMemories: 10
    },
    
    // System prompt and persona
    systemPrompt: (dbAgent.parameters as any)?.systemPrompt || 
                 "You are a helpful assistant. Provide concise, accurate, and helpful responses.",
                 
    persona: (dbAgent.metadata as any)?.persona || {},
    
    // Visualization configuration - ensure comprehensive tracking is enabled
    visualizationConfig: {
      enabled: true,
      trackMemoryRetrieval: true,
      trackLLMInteraction: true,
      trackToolExecution: true,
      trackTaskCreation: true,
      includePerformanceMetrics: true,
      includeContextData: true
    },
    
    // Manager-specific configurations
    managersConfig: {
      memoryManager: {},
      planningManager: {},
      toolManager: {},
      knowledgeManager: {},
      schedulerManager: {},
      reflectionManager: {},
      inputProcessor: {},
      outputProcessor: {},
      resourceTracker: {
        samplingIntervalMs: 60000,
        maxHistorySamples: 60,
        defaultLimits: {
          cpuUtilization: 0.8,
          memoryBytes: 1024 * 1024 * 512,
          tokensPerMinute: 50000,
          apiCallsPerMinute: 100
        },
        enforceResourceLimits: true,
        limitWarningBuffer: 0.2,
        trackPerTaskUtilization: true
      }
    },
    
    // Clean slate component configurations (legacy support)
    componentsConfig: {
      // Manager configurations (these provide backward compatibility)
      memoryManager: { enabled: true },
      planningManager: { enabled: true },
      toolManager: { enabled: true },
      knowledgeManager: { enabled: true },
      schedulerManager: { enabled: true },
      reflectionManager: { enabled: true },
      
      // New manager configurations (Phase 2 integration - disabled by default)
      ethicsManager: { enabled: false },
      collaborationManager: { enabled: false },
      communicationManager: { enabled: false },
      notificationManager: { enabled: false },
      
      // Component configurations
      initializer: {
        enabled: true,
        timeoutMs: 60000
      },
      lifecycleManager: {
        enabled: true,
        healthCheckInterval: 120000,
        memoryRefreshInterval: 3600000
      },
      communicationHandler: {
        enabled: true,
        maxConcurrentMessages: 10
      },
      executionEngine: {
        enabled: true,
        maxConcurrentTasks: 5,
        taskTimeoutMs: 60000
      },
      inputProcessor: {
        enabled: true,
        processingSteps: ['validate', 'sanitize', 'transform'],
        maxInputLength: 50000
      },
      outputProcessor: {
        enabled: true,
        processingSteps: ['format', 'validate', 'transform'],
        maxOutputLength: 50000
      },
      thinkingProcessor: {
        enabled: true,
        maxReasoningDepth: 5,
        enableReflection: true
      },
      configValidator: {
        enabled: true,
        strictValidation: false
      },
      resourceTracker: {
        samplingIntervalMs: 60000,
        maxHistorySamples: 60,
        defaultLimits: {
          cpuUtilization: 0.8,
          memoryBytes: 1024 * 1024 * 512,
          tokensPerMinute: 50000,
          apiCallsPerMinute: 100
        },
        enforceResourceLimits: true,
        limitWarningBuffer: 0.2,
        trackPerTaskUtilization: true
      }
    }
  };
  
  // Create the agent using DefaultAgent
  const agent = new DefaultAgent(agentConfig);
  
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
  
  logger.debug(`✓ Agent ID verified: ${agentId}`);
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
    logger.debug('🤖 Starting agent bootstrap process...');
    
    // Get memory service
    const { memoryService } = await getMemoryServices();
    const agentService = await createAgentMemoryService(memoryService);
    
    // Get all agents from database
    const getResult = await agentService.getAgents();
    
    if (getResult.isError || !getResult.value) {
      const errorMsg = 'Failed to load agents from database: ' + 
        (getResult.error?.message || 'Unknown error');
      
      logger.error(errorMsg, { requestId: bootstrapRequestId });
      logger.debug('❌ ' + errorMsg);
      return 0;
    }
    
    const dbAgents = getResult.value;
    logger.info(`Found ${dbAgents.length} agents in database`, { 
      requestId: bootstrapRequestId,
      agentCount: dbAgents.length
    });
    logger.debug(`📋 Found ${dbAgents.length} agents in database`);
    
    // Log all available agents in database
    logger.debug('📝 Agents available in database:');
    dbAgents.forEach((agent: AgentMemoryEntity) => {
      logger.debug(`   - Agent ID: ${agent.id}, Name: ${agent.name}`);
    });
    
    let loadedCount = 0;
    const failedAgents: Array<{ id: string; reason: string }> = [];
    
    // Load and register each agent simply
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
          logger.debug(`⏩ ${logMsg}`);
          continue;
        }
        
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
        logger.debug(`🔄 Initializing agent ${dbAgent.id}...`);
        
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
          logger.debug(`✅ Successfully initialized agent ${dbAgent.id} and all its managers`);
          
          // Register with runtime registry
          logger.debug(`📝 Registering agent ${dbAgent.id} with runtime registry...`);
          
          // DEBUG: Check agent state before registration
          const preRegManagers = agent.getManagers();
          const preRegToolManager = agent.getManager(ManagerType.TOOL);
          logger.debug(`🔍 PRE-REGISTRATION agent state for ${dbAgent.id}`, {
            agentInstanceId: (agent as any)._instanceId || 'no-instance-id',
            managersCount: preRegManagers.length,
            hasToolManager: !!preRegToolManager,
            toolManagerType: preRegToolManager?.constructor.name,
            managerTypes: preRegManagers.map(m => m.managerType)
          });
          
          registerAgent(agent);
          
          // VERIFY REGISTRATION: Check if agent was actually registered
          const registeredAgent = getAgentById(dbAgent.id);
          if (!registeredAgent) {
            throw new AgentBootstrapError(
              `Agent registration failed - agent not found in registry after registration`,
              dbAgent.id,
              'REGISTRATION_VERIFICATION_FAILED',
              { agentId: dbAgent.id, agentName: dbAgent.name }
            );
          }
          
          // DEBUG: Check if it's the same instance
          const isSameInstance = registeredAgent === agent;
          logger.debug(`🔍 POST-REGISTRATION verification for ${dbAgent.id}`, {
            isSameInstance,
            originalInstanceId: (agent as any)._instanceId || 'no-instance-id',
            registeredInstanceId: (registeredAgent as any)._instanceId || 'no-instance-id'
          });
          
          // VERIFY AGENT METHODS: Ensure the agent has required methods
          try {
            const agentId = registeredAgent.getId();
            const health = await registeredAgent.getHealth();
            
            // VERIFY TOOL REGISTRATION: Check if tools are registered
            const toolManager = registeredAgent.getManager(ManagerType.TOOL);
            
            // DEBUG: Add detailed manager inspection
            const allManagers = registeredAgent.getManagers();
            const managerInfo = allManagers.map(m => ({
              name: m.constructor.name,
              type: m.managerType,
              hasGetAllTools: typeof (m as any).getAllTools === 'function',
              hasGetTools: typeof (m as any).getTools === 'function'
            }));
            
            logger.debug(`🔍 Manager inspection for agent ${dbAgent.id}`, { 
              managerCount: allManagers.length,
              managers: managerInfo,
              toolManagerFound: !!toolManager,
              lookingForType: ManagerType.TOOL
            });
            
            if (toolManager && typeof (toolManager as any).getTools === 'function') {
              try {
                const allTools = await (toolManager as any).getTools();
                const toolCount = Array.isArray(allTools) ? allTools.length : 0;
                const toolNames = Array.isArray(allTools) ? allTools.map((t: any) => t.name || t.id).join(', ') : 'none';
                
                // Check specifically for send_message tool
                const hasSendMessage = Array.isArray(allTools) && allTools.some((t: any) => t.id === 'send_message' || t.name === 'send_message');
                
                logger.debug(`🔧 Tool registration verification for agent ${dbAgent.id}`, {
                  toolCount,
                  hasSendMessage,
                  toolNames: toolNames.substring(0, 200) + (toolNames.length > 200 ? '...' : '')
                });
                
                if (hasSendMessage) {
                  console.log(`✅ CRITICAL: send_message tool successfully registered for agent ${dbAgent.id}`);
                } else {
                  console.log(`❌ CRITICAL: send_message tool NOT FOUND for agent ${dbAgent.id} - scheduled messaging will not work!`);
                }
                
                if (toolCount === 0) {
                  console.log(`⚠️ WARNING: No tools registered for agent ${dbAgent.id} - agent will have limited capabilities`);
                } else {
                  console.log(`📋 Agent ${dbAgent.id} registered with ${toolCount} tools: ${toolNames.substring(0, 100)}${toolNames.length > 100 ? '...' : ''}`);
                }
                
              } catch (toolError) {
                logger.debug(`Failed to verify tool registration for agent ${dbAgent.id}`, {
                  error: toolError instanceof Error ? toolError.message : String(toolError)
                });
                console.log(`⚠️ Could not verify tool registration for agent ${dbAgent.id}: ${toolError instanceof Error ? toolError.message : String(toolError)}`);
              }
            } else {
              console.log(`❌ CRITICAL: No tool manager found for agent ${dbAgent.id} - tools will not be available!`);
            }
            
            logger.debug(`Verified registered agent ${dbAgent.id}`, {
              agentId,
              healthStatus: health.status,
              hasPlanAndExecute: typeof (registeredAgent as any).planAndExecute === 'function'
            });
            
          } catch (verificationError) {
            logger.debug(`Agent verification failed for ${dbAgent.id}`, {
              error: verificationError instanceof Error ? verificationError.message : String(verificationError)
            });
          }
          
          logger.info(`Agent registered: ${dbAgent.id} (${dbAgent.name})`, {
            agentId: dbAgent.id,
            requestId: bootstrapRequestId,
            agentType: agent.constructor.name
          });
          
          logger.debug('Agent registration capabilities', {
            agentId: dbAgent.id,
            hasGetId: typeof agent.getId === 'function',
            hasGetHealth: typeof agent.getHealth === 'function',
            hasPlanAndExecute: typeof (agent as any).planAndExecute === 'function'
          });
          
          console.log(`✅ Registered agent ${dbAgent.id} (${dbAgent.name}) in runtime registry as DefaultAgent with all managers`);
          
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
          logger.debug(`❌ ${errorMsg}`);
          
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
        logger.debug(`❌ Error bootstrapping agent ${dbAgent.id} (${dbAgent.name}):`, error);
        
        failedAgents.push({ 
          id: dbAgent.id, 
          reason: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Get summary metrics
    const summaryMetrics = getAgentsSummaryMetrics();
    
    // FINAL VERIFICATION: Check runtime registry state
    const { getAllAgents, getRegistryStats } = await import('./agent-service');
    const finalAgents = getAllAgents();
    const finalStats = getRegistryStats();
    
    logger.debug(`🔍 Final runtime registry verification:`);
    logger.debug(`   - Agents in runtime registry: ${finalAgents.length}`);
    logger.debug(`   - Registry size: ${finalStats.totalAgents}`);
    logger.debug(`   - Agent IDs: [${finalStats.agentIds.join(', ')}]`);
    logger.debug(`   - Agent Types: [${finalStats.agentTypes.join(', ')}]`);
    
    if (finalAgents.length === 0 && loadedCount > 0) {
      logger.error('Runtime registry empty despite successful agent loading', {
        requestId: bootstrapRequestId,
        loadedCount,
        finalAgentCount: finalAgents.length
      });
    } else if (finalAgents.length !== loadedCount) {
      logger.warn(`⚠️ WARNING: Registry count (${finalAgents.length}) doesn't match loaded count (${loadedCount})`);
    } else {
      logger.info(`✅ Registry verification successful: ${finalAgents.length} agents available`);
    }
    
    // Log summary of bootstrap process
    const summaryMsg = `Successfully bootstrapped ${loadedCount} agents from database into runtime registry`;
    logger.info(summaryMsg, { 
      requestId: bootstrapRequestId,
      loadedCount,
      failedCount: failedAgents.length,
      failedAgents,
      summaryMetrics,
      finalRuntimeRegistryCount: finalAgents.length
    });
    logger.debug(`🚀 ${summaryMsg}`);
    
    if (failedAgents.length > 0) {
      logger.debug(`⚠️ Failed to bootstrap ${failedAgents.length} agents:`);
      failedAgents.forEach(({ id, reason }) => {
        logger.debug(`   - Agent ID: ${id}, Reason: ${reason}`);
      });
    }
    
    // Output summary metrics to console
    logger.debug(`📊 Bootstrap Summary:`);
    logger.debug(`   - Total Agents: ${summaryMetrics.totalAgents}`);
    logger.debug(`   - Success Rate: ${(summaryMetrics.initializationSuccessRate * 100).toFixed(1)}%`);
    logger.debug(`   - Avg Init Time: ${(summaryMetrics.averageInitializationTime / 1000).toFixed(2)}s`);
    
    // Start a single centralized scheduler for all agents
    if (loadedCount > 0) {
      logger.info('Agent-specific schedulers will handle task execution - global scheduler disabled');
      // DISABLED: Using agent-specific schedulers instead of global scheduler
      // This prevents multiple scheduler conflicts and ensures each agent only handles its own tasks
      /*
      logger.info('Starting centralized scheduler for all agents...');
      try {
        // Import the scheduler factory to create a global scheduler
        const { createSchedulerManager } = await import('../../lib/scheduler/factories/SchedulerFactory');
        
        // Create a global scheduler without being tied to a specific agent
        const globalScheduler = await createSchedulerManager({
          enableAutoScheduling: true,
          schedulingIntervalMs: 60000, // Check every minute
          maxConcurrentTasks: 20, // Higher limit for global scheduler
          logSchedulingActivity: false // Reduce logging for global scheduler
        });
        
        // Start the global scheduler
        await globalScheduler.startScheduler();
        logger.info('Global centralized scheduler started successfully');
        
        // Store reference to global scheduler for cleanup if needed
        (global as any).__globalScheduler = globalScheduler;
        
      } catch (schedulerError) {
        logger.error('Failed to start centralized scheduler:', { error: schedulerError });
      }
      */
    }
    
    return loadedCount;
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    logger.error('Error bootstrapping agents from database:', {
      error: errorObj,
      requestId: bootstrapRequestId
    });
    logger.debug('❌ Error bootstrapping agents from database:', error);
    return 0;
  }
} 