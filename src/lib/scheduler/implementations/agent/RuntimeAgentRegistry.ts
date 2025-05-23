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
    this.logger.info("Finding capable agents for task", {
      taskId: task.id,
      taskName: task.name,
      requiredAgentId: task.metadata?.agentId
    });

    try {
      const capableAgents: AgentBase[] = [];

      // If task specifies a specific agent, try that first
      if (task.metadata?.agentId) {
        const agentId = typeof task.metadata.agentId === 'string' 
          ? task.metadata.agentId 
          : (task.metadata.agentId as any).id;
        
        if (agentId) {
          const specificAgent = await this.getAgentById(agentId);
          if (specificAgent && await this.isAgentAvailable(agentId)) {
            capableAgents.push(specificAgent);
            this.logger.info("Found specific agent for task", {
              taskId: task.id,
              agentId
            });
            return capableAgents;
          }
        }
      }

      // Get all available agents from runtime registry
      const { getAllAgents } = await import('../../../../server/agent/agent-service');
      const allAgents = getAllAgents();
      
      this.logger.info("Checking agent capabilities", {
        taskId: task.id,
        totalAgents: allAgents.length
      });

      // Filter agents based on availability and capabilities
      for (const agent of allAgents) {
        const agentId = agent.getId();
        
        // Check if agent is available
        if (await this.isAgentAvailable(agentId)) {
          // Check if agent has required capabilities
          if (this.hasRequiredCapabilities(agent, task)) {
            capableAgents.push(agent);
            // Cache for future use
            this.agents.set(agentId, agent);
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
      
      this.logger.info("Agent availability check", {
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
   * Check if agent has required capabilities for a task
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

      this.logger.info("Agent capability check", {
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