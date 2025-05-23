/**
 * RuntimeAgentRegistry.ts - Registry for Task-Agent Integration
 * 
 * This implementation provides access to runtime agents for task execution.
 * Integrates with the existing agent runtime registry system.
 */

import { ulid } from 'ulid';
import { AgentBase } from '../../../../agents/shared/base/AgentBase.interface';
import { Task } from '../../models/Task.model';
import { 
  TaskAgentRegistry, 
  AgentCapacityInfo, 
  AgentTaskError 
} from '../../interfaces/AgentTaskHandler.interface';
import { createLogger } from '@/lib/logging/winston-logger';

/**
 * Agent registry that integrates with the runtime agent system
 */
export class RuntimeAgentRegistry implements TaskAgentRegistry {
  private readonly registryId: string;
  private readonly logger: ReturnType<typeof createLogger>;
  private readonly agents = new Map<string, AgentBase>();
  private readonly capacityCache = new Map<string, AgentCapacityInfo>();
  private readonly cacheExpiryMs = 30000; // 30 seconds

  constructor() {
    this.registryId = `runtime-agent-registry-${ulid()}`;
    this.logger = createLogger({
      moduleId: this.registryId,
      agentId: 'system'
    });
    
    this.logger.info("RuntimeAgentRegistry initialized", {
      registryId: this.registryId
    });
  }

  /**
   * Get an agent by ID from the runtime registry
   */
  async getAgentById(agentId: string): Promise<AgentBase | null> {
    this.logger.info("Getting agent by ID", { agentId });
    
    try {
      // Check local cache first
      if (this.agents.has(agentId)) {
        const agent = this.agents.get(agentId)!;
        this.logger.info("Agent found in local cache", { agentId });
        return agent;
      }

      // Get from global runtime registry
      const { getAllAgents } = await import('../../../../server/agent/agent-service');
      const allAgents = getAllAgents();
      const agent = allAgents.find(a => a.getId() === agentId);
      
      if (agent) {
        // Cache for future use
        this.agents.set(agentId, agent);
        this.logger.info("Agent found in runtime registry", { 
          agentId, 
          agentName: agent.getName ? agent.getName() : 'unknown'
        });
        return agent;
      }

      this.logger.warn("Agent not found", { agentId });
      return null;
    } catch (error) {
      this.logger.error("Error getting agent by ID", {
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new AgentTaskError(
        `Failed to get agent ${agentId}`,
        'AGENT_LOOKUP_ERROR',
        { agentId, originalError: error }
      );
    }
  }

  /**
   * Find agents capable of executing a specific task
   */
  async findCapableAgents(task: Task): Promise<AgentBase[]> {
    const capableAgents: AgentBase[] = [];

    try {
      this.logger.debug("Starting capable agent search", {
        taskId: task.id,
        currentCachedAgents: this.agents.size,
        hasSpecificAgent: !!task.metadata?.agentId
      });

      // PRIORITY 1: Check if task specifies a specific agent
      if (task.metadata?.agentId) {
        const agentId = typeof task.metadata.agentId === 'string' 
          ? task.metadata.agentId 
          : (task.metadata.agentId as any).id;
        
        if (agentId) {
          const specificAgent = await this.getAgentById(agentId);
          if (specificAgent) {
            // For specifically assigned agents, only check basic availability, not strict capabilities
            // Since there's an LLM behind every agent, it should be able to handle the task
            const isAvailable = await this.isAgentAvailable(agentId);
            
            this.logger.debug("Checking specifically assigned agent", {
              taskId: task.id,
              agentId,
              isAvailable,
              forcingExecution: !isAvailable // If not available, we'll still try
            });
            
            if (isAvailable) {
              capableAgents.push(specificAgent);
              this.logger.debug("Using specifically assigned agent (available)", {
                taskId: task.id,
                agentId
              });
              return capableAgents;
            } else {
              // Even if not "available", still try the assigned agent since it's specifically requested
              // The LLM should be able to handle it
              this.logger.debug("Assigned agent not fully available, but using anyway (LLM fallback)", {
                taskId: task.id,
                agentId,
                reason: "Agent specifically assigned to task"
              });
              capableAgents.push(specificAgent);
              return capableAgents;
            }
          } else {
            this.logger.warn("Specifically assigned agent not found", {
              taskId: task.id,
              assignedAgentId: agentId
            });
          }
        }
      }

      // PRIORITY 2: Get all available agents from runtime registry
      const { getAllAgents } = await import('../../../../server/agent/agent-service');
      const allAgents = getAllAgents();
      
      this.logger.debug("Retrieved agents from agent-service", {
        taskId: task.id,
        totalAgents: allAgents.length,
        agentIds: allAgents.map(a => {
          try {
            return a.getId ? a.getId() : 'unknown-id';
          } catch (e) {
            return 'error-getting-id';
          }
        })
      });

      if (allAgents.length === 0) {
        this.logger.error("No agents found in runtime registry", {
          taskId: task.id
        });
        return capableAgents;
      }

      // DEBUG: Log details about each agent
      for (let i = 0; i < allAgents.length; i++) {
        const agent = allAgents[i];
        try {
          this.logger.debug(`Agent ${i} details`, {
            taskId: task.id,
            agentId: agent.getId ? agent.getId() : 'no-getId-method',
            hasGetId: typeof agent.getId === 'function',
            hasGetHealth: typeof agent.getHealth === 'function',
            hasPlanAndExecute: typeof (agent as any).planAndExecute === 'function',
            agentType: agent.constructor.name
          });
        } catch (e) {
          this.logger.debug(`Error examining agent ${i}`, {
            taskId: task.id,
            error: e instanceof Error ? e.message : String(e)
          });
        }
      }

      // PRIORITY 3: Filter agents with lenient capability checks
      // Since all agents have LLMs, be more forgiving with capabilities
      for (const agent of allAgents) {
        try {
          const agentId = agent.getId();
          
          this.logger.debug("Checking agent for task", {
            taskId: task.id,
            agentId,
            checkingAvailability: true
          });
          
          // Check basic agent functionality (more lenient than before)
          if (this.hasBasicAgentCapabilities(agent, task)) {
            // Check if agent is available (but don't be too strict)
            const isAvailable = await this.isAgentAvailable(agentId);
            
            if (isAvailable) {
              capableAgents.push(agent);
              // Cache for future use
              this.agents.set(agentId, agent);
              
              this.logger.debug("Agent added to capable agents list", {
                taskId: task.id,
                agentId
              });
            } else {
              this.logger.debug("Agent not available but has capabilities", {
                taskId: task.id,
                agentId
              });
            }
          } else {
            this.logger.debug("Agent failed basic capability check", {
              taskId: task.id,
              agentId
            });
          }
        } catch (agentError) {
          this.logger.error("Error checking agent capabilities", {
            taskId: task.id,
            agentError: agentError instanceof Error ? agentError.message : String(agentError)
          });
        }
      }

      // FALLBACK: If no agents are "capable" but we have agents, pick the first healthy one
      // Since every agent has an LLM, it should be able to attempt the task
      if (capableAgents.length === 0 && allAgents.length > 0) {
        this.logger.debug("No agents passed capability checks, using LLM fallback strategy", {
          taskId: task.id,
          totalAgents: allAgents.length
        });
        
        for (const agent of allAgents) {
          try {
            const agentId = agent.getId();
            const health = await agent.getHealth();
            
            if (health.status === 'healthy' || health.status === 'degraded') {
              capableAgents.push(agent);
              this.logger.debug("Using agent as LLM fallback", {
                taskId: task.id,
                agentId,
                healthStatus: health.status,
                reason: "All agents have LLM capabilities"
              });
              break; // Just use the first healthy agent
            }
          } catch (e) {
            this.logger.debug("Error checking agent health for fallback", {
              taskId: task.id,
              error: e instanceof Error ? e.message : String(e)
            });
          }
        }
      }

      this.logger.info("Found capable agents", {
        taskId: task.id,
        capableAgentCount: capableAgents.length,
        agentIds: capableAgents.map(a => a.getId())
      });

      return capableAgents;
    } catch (error) {
      this.logger.error("Error finding capable agents", {
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new AgentTaskError(
        `Failed to find capable agents for task ${task.id}`,
        'AGENT_CAPABILITY_ERROR',
        { taskId: task.id, originalError: error }
      );
    }
  }

  /**
   * Check if an agent is available for task execution
   */
  async isAgentAvailable(agentId: string): Promise<boolean> {
    try {
      const agent = await this.getAgentById(agentId);
      if (!agent) {
        return false;
      }

      // Check agent health
      const health = await agent.getHealth();
      const isHealthy = health.status === 'healthy';
      
      // Check capacity
      const capacity = await this.getAgentCapacity(agentId);
      const hasCapacity = capacity.isAvailable && capacity.currentLoad < capacity.maxCapacity;

      const available = isHealthy && hasCapacity;
      
      this.logger.debug("Agent availability check", {
        agentId,
        isHealthy,
        hasCapacity,
        available,
        currentLoad: capacity.currentLoad,
        maxCapacity: capacity.maxCapacity
      });

      return available;
    } catch (error) {
      this.logger.error("Error checking agent availability", {
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Get current capacity information for an agent
   */
  async getAgentCapacity(agentId: string): Promise<AgentCapacityInfo> {
    // Check cache first
    const cacheKey = `capacity-${agentId}`;
    const cached = this.capacityCache.get(cacheKey);
    if (cached && Date.now() - (cached as any).cachedAt < this.cacheExpiryMs) {
      return cached;
    }

    try {
      const agent = await this.getAgentById(agentId);
      if (!agent) {
        throw new AgentTaskError(
          `Agent ${agentId} not found`,
          'AGENT_NOT_FOUND',
          { agentId }
        );
      }

      // Get agent health for capacity calculation
      const health = await agent.getHealth();
      
      // Calculate capacity based on health and configuration
      const capacity: AgentCapacityInfo = {
        currentLoad: 0, // TODO: Get from agent task tracking
        maxCapacity: 5, // Default capacity, should be configurable
        isAvailable: health.status === 'healthy',
        healthStatus: health.status as 'healthy' | 'degraded' | 'unhealthy',
        nextAvailableSlotMs: 0 // Immediate if available
      };

      // Cache the result
      (capacity as any).cachedAt = Date.now();
      this.capacityCache.set(cacheKey, capacity);

      this.logger.info("Agent capacity calculated", {
        agentId,
        capacity
      });

      return capacity;
    } catch (error) {
      this.logger.error("Error getting agent capacity", {
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Return degraded capacity on error
      return {
        currentLoad: 999,
        maxCapacity: 1,
        isAvailable: false,
        healthStatus: 'unhealthy',
        nextAvailableSlotMs: 60000 // 1 minute
      };
    }
  }

  /**
   * Register an agent with the registry
   */
  async registerAgent(agent: AgentBase): Promise<void> {
    const agentId = agent.getId();
    this.agents.set(agentId, agent);
    
    this.logger.info("Agent registered", {
      agentId,
      agentName: agent.getName ? agent.getName() : 'unknown'
    });
  }

  /**
   * Unregister an agent from the registry
   */
  async unregisterAgent(agentId: string): Promise<void> {
    this.agents.delete(agentId);
    this.capacityCache.delete(`capacity-${agentId}`);
    
    this.logger.info("Agent unregistered", { agentId });
  }

  /**
   * Check if agent has basic capabilities for a task (more lenient than strict capability checking)
   * Since all agents have LLMs, we focus on basic functionality rather than specific capabilities
   */
  private hasBasicAgentCapabilities(agent: AgentBase, task: Task): boolean {
    try {
      // Basic functionality checks - much more lenient
      const hasBasicMethods = Boolean(
        agent.getId && 
        typeof agent.getId === 'function'
      );

      // Check if agent has some form of execution capability
      // Either planAndExecute or processUserInput should work since there's an LLM behind it
      const hasExecutionCapability = Boolean(
        (agent as any).planAndExecute || 
        (agent as any).processUserInput ||
        (agent as any).processInput
      );

      const isCapable = hasBasicMethods && hasExecutionCapability;

      this.logger.debug("Basic agent capability check", {
        agentId: agent.getId(),
        taskId: task.id,
        hasBasicMethods,
        hasExecutionCapability,
        hasPlanAndExecute: Boolean((agent as any).planAndExecute),
        hasProcessUserInput: Boolean((agent as any).processUserInput),
        hasProcessInput: Boolean((agent as any).processInput),
        isCapable,
        reason: "LLM-based agents should handle most tasks"
      });

      return isCapable;
    } catch (error) {
      this.logger.error("Error checking basic agent capabilities", {
        agentId: agent.getId ? agent.getId() : 'unknown',
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // If we can't check capabilities, assume the agent can try (LLM fallback)
      this.logger.debug("Capability check failed, defaulting to LLM fallback assumption", {
        taskId: task.id,
        agentId: agent.getId ? agent.getId() : 'unknown'
      });
      return true;
    }
  }

  /**
   * Check if agent has required capabilities for a task (strict checking - kept for backward compatibility)
   */
  private hasRequiredCapabilities(agent: AgentBase, task: Task): boolean {
    try {
      // For now, assume all agents can handle all tasks
      // In the future, this would check agent capabilities against task requirements
      
      // Basic capability checks
      const hasBasicCapabilities = Boolean(
        agent.getId && 
        agent.getHealth &&
        typeof agent.getId === 'function' &&
        typeof agent.getHealth === 'function'
      );

      // Check if agent has planAndExecute capability for Chloe agents
      const hasPlanAndExecute = Boolean((agent as any).planAndExecute);

      this.logger.debug("Agent capability check", {
        agentId: agent.getId(),
        taskId: task.id,
        hasBasicCapabilities,
        hasPlanAndExecute,
        hasRequiredCapabilities: hasBasicCapabilities && hasPlanAndExecute
      });

      return hasBasicCapabilities && hasPlanAndExecute;
    } catch (error) {
      this.logger.error("Error checking agent capabilities", {
        agentId: agent.getId ? agent.getId() : 'unknown',
        taskId: task.id,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.capacityCache.clear();
    this.logger.info("Agent registry caches cleared");
  }

  /**
   * Get registry statistics
   */
  getStats() {
    return {
      registryId: this.registryId,
      cachedAgents: this.agents.size,
      cachedCapacities: this.capacityCache.size
    };
  }
} 