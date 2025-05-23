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
  console.log(`🔍 Creating DefaultAgent for ${dbAgent.id} (${dbAgent.name})...`);
  
  // Create agent configuration
  const agentConfig = {
    id: dbAgent.id,
    name: dbAgent.name || 'Unnamed Agent',
    description: dbAgent.description || '',
    
    // Enable all managers
    enableMemoryManager: true,
    enablePlanningManager: true,
    enableToolManager: true,
    enableKnowledgeManager: true,
    enableSchedulerManager: true,
    enableInputProcessor: true,
    enableOutputProcessor: true,
    enableResourceTracking: true,
    enableReflectionManager: true,
    
    // Use enhanced managers
    useEnhancedMemory: true,
    useEnhancedReflection: true,
    
    // Enable adaptive behavior
    adaptiveBehavior: true,
    
    // Configure memory refresh
    memoryRefresh: {
      enabled: true,
      interval: 3600000, // 1 hour
      maxCriticalMemories: 10
    },
    
    // System prompt and persona
    systemPrompt: (dbAgent.parameters as any)?.systemPrompt || 
                 (dbAgent.parameters as any)?.customInstructions || 
                 "You are a helpful assistant. Provide concise, accurate, and helpful responses.",
                 
    persona: (dbAgent.metadata as any)?.persona || {},
    
    // Manager configurations
    managersConfig: {
      memoryManager: {
        enabled: true,
        createPrivateScope: true,
        defaultScopeName: `agent-${dbAgent.id}-memory`,
        enableAutoPruning: true,
        enableAutoConsolidation: true,
        pruningIntervalMs: 3600000, // 1 hour
        consolidationIntervalMs: 86400000, // 24 hours
        maxMemoryItems: 10000
      },
      planningManager: {
        enabled: true,
        maxPlans: 100,
        enablePlanOptimization: true,
        enablePlanAdaptation: true,
        enablePlanValidation: true
      },
      toolManager: {
        enabled: true,
        maxTools: 50,
        enableAutoDiscovery: true,
        allowUnsafeTool: false
      },
      knowledgeManager: {
        enabled: true,
        enableAutoRefresh: true,
        refreshIntervalMs: 300000,
        maxKnowledgeItems: 1000
      },
      schedulerManager: {
        enabled: true,
        maxConcurrentTasks: 5,
        maxRetryAttempts: 3,
        defaultTaskTimeoutMs: 30000,
        enableAutoScheduling: true,
        schedulingIntervalMs: 30000, // 30 seconds
        enableTaskPrioritization: true,
        logSchedulingActivity: true
      },
      reflectionManager: {
        enabled: true,
        reflectionFrequencyMs: 3600000, // 1 hour
        maxReflectionDepth: 3,
        keepReflectionHistory: true,
        maxHistoryItems: 50
      },
      resourceTracker: {
        samplingIntervalMs: 60000, // 1 minute
        maxHistorySamples: 60, // 1 hour of history at 1 min interval
        defaultLimits: {
          cpuUtilization: 0.8, // 80% maximum CPU usage
          memoryBytes: 1024 * 1024 * 512, // 512MB memory limit
          tokensPerMinute: 50000, // 50K tokens per minute
          apiCallsPerMinute: 100 // 100 API calls per minute
        },
        enforceResourceLimits: true,
        limitWarningBuffer: 0.2, // Warn at 80% of limit
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
          // Check if the lock or bootstrap state is stale
          if (agentBootstrapRegistry.isLockStale(dbAgent.id) || agentBootstrapRegistry.isBootstrapStateStale(dbAgent.id)) {
            logger.warn(`Detected stale lock/state for agent ${dbAgent.id}, force releasing`, { 
              agentId: dbAgent.id,
              lockTimestamp: bootstrapInfo.lockTimestamp,
              startTime: bootstrapInfo.startTime,
              state: bootstrapInfo.state,
              locked: bootstrapInfo.locked
            });
            
            // Force release the stale lock and reset state
            agentBootstrapRegistry.forceReleaseStaleLock(dbAgent.id);
            console.log(`🔧 Reset stale bootstrap state for agent ${dbAgent.id} (${dbAgent.name})`);
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