/**
 * Agent Health Check System
 * 
 * This module provides functionality to check agent health status
 * and perform recovery actions for unhealthy agents.
 */

import { AgentBase } from '../../agents/shared/base/AgentBase.interface';
import { logger } from '../../lib/logging';
import { agentBootstrapRegistry, AgentBootstrapState } from './agent-bootstrap-registry';
import { AgentStatus } from '../memory/schema/agent';
import { executeWithErrorBoundary } from './agent-error-boundary';
import { v4 as uuidv4 } from 'uuid';

/**
 * Health status of an agent
 */
export enum AgentHealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

/**
 * Results of an agent health check
 */
export interface AgentHealthCheckResult {
  agentId: string;
  status: AgentHealthStatus;
  timestamp: Date;
  checksPerformed: string[];
  healthMetrics: Record<string, any>;
  checkId: string;
  warnings: string[];
  errors: string[];
  recoveryAttempted: boolean;
  recoverySuccessful: boolean;
  durationMs: number;
}

/**
 * Options for agent health checks
 */
export interface AgentHealthCheckOptions {
  deepCheck?: boolean;
  checkManagers?: boolean;
  attemptRecovery?: boolean;
  timeoutMs?: number;
  metadata?: Record<string, any>;
}

/**
 * Check the health of an agent
 * 
 * @param agent The agent to check
 * @param options Health check options
 * @returns Promise resolving to health check results
 */
export async function checkAgentHealth(
  agent: AgentBase,
  options: AgentHealthCheckOptions = {}
): Promise<AgentHealthCheckResult> {
  const {
    deepCheck = false,
    checkManagers = true,
    attemptRecovery = false,
    timeoutMs = 30000,
    metadata = {}
  } = options;
  
  const agentId = agent.getAgentId();
  const checkId = uuidv4();
  const startTime = Date.now();
  
  const checksPerformed: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const healthMetrics: Record<string, any> = {};
  
  let status = AgentHealthStatus.UNKNOWN;
  let recoveryAttempted = false;
  let recoverySuccessful = false;
  
  try {
    logger.info(`Starting health check for agent ${agentId}`, {
      agentId,
      checkId,
      options
    });
    
    // Basic agent check - verify it has all required methods
    checksPerformed.push('basic_methods_check');
    
    const requiredMethods = [
      'getAgentId',
      'initialize',
      'processUserInput',
      'think',
      'getLLMResponse'
    ];
    
    const missingMethods = requiredMethods.filter(
      method => !(method in agent && typeof (agent as any)[method] === 'function')
    );
    
    if (missingMethods.length > 0) {
      errors.push(`Agent is missing required methods: ${missingMethods.join(', ')}`);
      status = AgentHealthStatus.UNHEALTHY;
    }
    
    // Check bootstrap state
    checksPerformed.push('bootstrap_state_check');
    
    const bootstrapInfo = agentBootstrapRegistry.getAgentBootstrapInfo(agentId);
    if (!bootstrapInfo) {
      warnings.push('Agent is not registered in bootstrap registry');
    } else {
      healthMetrics.bootstrapState = bootstrapInfo.state;
      
      if (bootstrapInfo.state === AgentBootstrapState.FAILED) {
        errors.push(`Agent bootstrap failed: ${bootstrapInfo.error?.message || 'Unknown error'}`);
        status = AgentHealthStatus.UNHEALTHY;
      } else if (bootstrapInfo.state !== AgentBootstrapState.COMPLETED) {
        warnings.push(`Agent bootstrap is not complete, current state: ${bootstrapInfo.state}`);
        status = AgentHealthStatus.DEGRADED;
      }
    }
    
    // Check managers if requested and available
    if (checkManagers && 'getManagers' in agent && typeof (agent as any).getManagers === 'function') {
      checksPerformed.push('managers_check');
      
      const managers = (agent as any).getManagers();
      healthMetrics.managersCount = managers.length;
      
      const unhealthyManagers: string[] = [];
      
      // Basic manager check - verify they have required methods
      for (const manager of managers) {
        const managerId = manager.managerId || 'unknown';
        const managerType = manager.managerType || 'unknown';
        
        if (!manager.isEnabled || typeof manager.isEnabled !== 'function') {
          warnings.push(`Manager ${managerId} (${managerType}) missing isEnabled method`);
          continue;
        }
        
        const isEnabled = manager.isEnabled();
        healthMetrics[`manager_${managerType}_enabled`] = isEnabled;
        
        if (!isEnabled) {
          warnings.push(`Manager ${managerId} (${managerType}) is disabled`);
          continue;
        }
        
        // Deep check - verify manager health if it has a getHealth method
        if (deepCheck && manager.getHealth && typeof manager.getHealth === 'function') {
          try {
            const healthResult = await Promise.race([
              manager.getHealth(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Manager health check timed out`)), 5000)
              )
            ]);
            
            healthMetrics[`manager_${managerType}_health`] = healthResult;
            
            if (healthResult.status !== 'healthy') {
              unhealthyManagers.push(`${managerType} (${healthResult.status}: ${healthResult.message || 'No message'})`);
            }
          } catch (error) {
            unhealthyManagers.push(`${managerType} (Error: ${String(error)})`);
          }
        }
      }
      
      if (unhealthyManagers.length > 0) {
        if (unhealthyManagers.length === managers.length) {
          errors.push(`All managers unhealthy: ${unhealthyManagers.join(', ')}`);
          status = AgentHealthStatus.UNHEALTHY;
        } else {
          warnings.push(`${unhealthyManagers.length} unhealthy managers: ${unhealthyManagers.join(', ')}`);
          status = AgentHealthStatus.DEGRADED;
        }
      }
    }
    
    // If no status determined yet, mark as healthy
    if (status === AgentHealthStatus.UNKNOWN) {
      if (warnings.length > 0) {
        status = AgentHealthStatus.DEGRADED;
      } else {
        status = AgentHealthStatus.HEALTHY;
      }
    }
    
    // Attempt recovery if needed and requested
    if (attemptRecovery && (status === AgentHealthStatus.UNHEALTHY || status === AgentHealthStatus.DEGRADED)) {
      recoveryAttempted = true;
      checksPerformed.push('recovery_attempt');
      
      const recoveryResult = await recoverAgent(agent, {
        restartManagers: status === AgentHealthStatus.DEGRADED,
        reinitialize: status === AgentHealthStatus.UNHEALTHY,
        timeoutMs
      });
      
      recoverySuccessful = recoveryResult.success;
      healthMetrics.recoveryDetails = recoveryResult;
      
      if (recoverySuccessful) {
        // Update status based on recovery result
        if (status === AgentHealthStatus.UNHEALTHY) {
          status = AgentHealthStatus.DEGRADED; // Improved but may not be fully healthy
        } else if (status === AgentHealthStatus.DEGRADED) {
          // Recheck managers after recovery
          const managersHealthy = await checkManagersAfterRecovery(agent);
          status = managersHealthy ? AgentHealthStatus.HEALTHY : AgentHealthStatus.DEGRADED;
        }
      }
    }
    
  } catch (error) {
    // If health check itself fails, agent is likely unhealthy
    errors.push(`Health check error: ${String(error)}`);
    status = AgentHealthStatus.UNHEALTHY;
  }
  
  const endTime = Date.now();
  const durationMs = endTime - startTime;
  
  // Compile result
  const result: AgentHealthCheckResult = {
    agentId,
    status,
    timestamp: new Date(),
    checksPerformed,
    healthMetrics,
    checkId,
    warnings,
    errors,
    recoveryAttempted,
    recoverySuccessful,
    durationMs
  };
  
  logger.info(`Health check completed for agent ${agentId}: ${status}`, {
    agentId,
    checkId,
    status,
    durationMs,
    warningsCount: warnings.length,
    errorsCount: errors.length,
    recoveryAttempted,
    recoverySuccessful
  });
  
  return result;
}

/**
 * Attempt to recover an unhealthy agent
 * 
 * @param agent The agent to recover
 * @param options Recovery options
 * @returns Promise resolving to recovery result
 */
async function recoverAgent(
  agent: AgentBase,
  options: {
    restartManagers?: boolean;
    reinitialize?: boolean;
    timeoutMs?: number;
  }
): Promise<{ success: boolean; actions: string[]; errors: string[] }> {
  const { restartManagers = false, reinitialize = false, timeoutMs = 30000 } = options;
  const agentId = agent.getAgentId();
  const actions: string[] = [];
  const errors: string[] = [];
  
  logger.info(`Attempting to recover agent ${agentId}`, {
    agentId,
    restartManagers,
    reinitialize
  });
  
  try {
    // Restart managers if requested and available
    if (restartManagers && 'getManagers' in agent && typeof (agent as any).getManagers === 'function') {
      actions.push('restart_managers');
      
      const managers = (agent as any).getManagers();
      
      for (const manager of managers) {
        if (!manager.initialize || typeof manager.initialize !== 'function') {
          continue;
        }
        
        try {
          await Promise.race([
            manager.initialize(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Manager initialization timed out')), 5000)
            )
          ]);
          
          actions.push(`restarted_${manager.managerType || 'unknown'}_manager`);
        } catch (error) {
          errors.push(`Failed to restart ${manager.managerType || 'unknown'} manager: ${String(error)}`);
        }
      }
    }
    
    // Reinitialize the entire agent if requested
    if (reinitialize) {
      actions.push('reinitialize_agent');
      
      const result = await executeWithErrorBoundary(
        async () => {
          return await agent.initialize();
        },
        {
          operationName: 'agent_recovery_initialization',
          agentId,
          timeoutMs
        }
      );
      
      if (result.success && result.value === true) {
        actions.push('agent_reinitialized_successfully');
      } else {
        errors.push(`Failed to reinitialize agent: ${result.error?.message || 'Unknown error'}`);
      }
    }
    
    // Update agent status in registry
    if (agentBootstrapRegistry.isAgentRegistered(agentId)) {
      const info = agentBootstrapRegistry.getAgentBootstrapInfo(agentId);
      if (info) {
        info.status = errors.length > 0 ? AgentStatus.MAINTENANCE : AgentStatus.AVAILABLE;
        agentBootstrapRegistry.updateAgentBootstrapState(
          agentId,
          errors.length > 0 ? AgentBootstrapState.FAILED : AgentBootstrapState.COMPLETED
        );
        actions.push('updated_agent_status');
      }
    }
    
    return {
      success: errors.length === 0,
      actions,
      errors
    };
    
  } catch (error) {
    errors.push(`Recovery process error: ${String(error)}`);
    return {
      success: false,
      actions,
      errors
    };
  }
}

/**
 * Check managers health after recovery
 * 
 * @param agent The agent to check
 * @returns Promise resolving to whether all managers are healthy
 */
async function checkManagersAfterRecovery(agent: AgentBase): Promise<boolean> {
  if (!('getManagers' in agent && typeof (agent as any).getManagers === 'function')) {
    return false;
  }
  
  try {
    const managers = (agent as any).getManagers();
    
    // Check if all required managers exist and are enabled
    const requiredManagerTypes = [
      'MEMORY',
      'PLANNING',
      'SCHEDULER'
    ];
    
    const availableManagerTypes = managers.map((m: any) => m.managerType);
    
    // Check if all required manager types exist
    const missingManagerTypes = requiredManagerTypes.filter(
      type => !availableManagerTypes.includes(type)
    );
    
    if (missingManagerTypes.length > 0) {
      return false;
    }
    
    // Check if all managers are enabled
    for (const manager of managers) {
      if (!manager.isEnabled || typeof manager.isEnabled !== 'function') {
        continue;
      }
      
      if (!manager.isEnabled()) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Register an agent for automatic periodic health checks
 * 
 * @param agent The agent to monitor
 * @param intervalMs Interval between health checks in milliseconds
 * @param options Health check options
 * @returns Function to stop health checks
 */
export function registerAgentForHealthMonitoring(
  agent: AgentBase,
  intervalMs: number = 300000, // 5 minutes
  options: AgentHealthCheckOptions = {}
): () => void {
  const agentId = agent.getAgentId();
  
  logger.info(`Registering agent ${agentId} for health monitoring every ${intervalMs}ms`, {
    agentId,
    intervalMs,
    options
  });
  
  // Perform initial health check
  checkAgentHealth(agent, options).catch(error => {
    logger.error(`Error in initial health check for agent ${agentId}`, {
      agentId,
      error
    });
  });
  
  // Schedule periodic health checks
  const intervalId = setInterval(async () => {
    try {
      await checkAgentHealth(agent, options);
    } catch (error) {
      logger.error(`Error in periodic health check for agent ${agentId}`, {
        agentId,
        error
      });
    }
  }, intervalMs);
  
  // Return function to stop monitoring
  return () => {
    clearInterval(intervalId);
    logger.info(`Stopped health monitoring for agent ${agentId}`, { agentId });
  };
} 