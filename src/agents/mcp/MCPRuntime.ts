/**
 * MCPRuntime.ts - Multi-Agent Control Plane Core
 * 
 * This module provides:
 * - Central orchestration layer for managing all live agents
 * - Task routing based on capability, health, and quota
 * - Agent registration, deregistration, and inspection
 * - Foundation for advanced agent lifecycle operations
 */

import { AgentBase } from '../shared/base/AgentBase';
import { AgentHealthChecker, AgentHealthStatus } from '../shared/coordination/AgentHealthChecker';
import { CapabilityRegistry, CapabilitySearchOptions, CapabilityLevel } from '../shared/coordination/CapabilityRegistry';

// Define the necessary types based on the codebase exploration
export interface PlannedTask {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedTimeMinutes?: number;
  tags?: string[];
  roles?: string[];
  capabilities?: string[];
  triggerReason?: string;
}

export interface TaskResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

// SubAgent interface based on the codebase
export interface SubAgent {
  id: string;
  name: string;
  description?: string;
  capabilities: string[];
  roles?: string[];
  tags?: string[];
  execute: (task: PlannedTask) => Promise<TaskResult>;
}

// Enhanced agent registration with health and status tracking
export interface AgentRegistration extends SubAgent {
  lastSeen: number;
  registeredAt: number;
  status: 'active' | 'idle' | 'unhealthy' | 'failed';
}

/**
 * Multi-Agent Control Plane Runtime
 * Central orchestration layer for managing all agents and routing tasks
 */
export class MCPRuntime {
  // Registry of all registered agents
  private static registry: Record<string, AgentRegistration> = {};
  
  // Reference to capability registry
  private static capabilityRegistry = CapabilityRegistry.getInstance();

  /**
   * Register an agent with the MCP
   */
  static registerAgent(agent: SubAgent): void {
    this.registry[agent.id] = {
      ...agent,
      lastSeen: Date.now(),
      registeredAt: Date.now(),
      status: 'active'
    };
    
    // Register with health checker for quota and health tracking
    AgentHealthChecker.register(agent.id, 3); // default quota of 3 concurrent tasks
    
    // Register agent capabilities if provided
    if (agent.capabilities && agent.capabilities.length > 0) {
      // Map capabilities to intermediate level as default
      const capabilityMap: Record<string, CapabilityLevel> = {};
      agent.capabilities.forEach(cap => {
        capabilityMap[cap] = CapabilityLevel.INTERMEDIATE;
      });
      
      // Register capabilities with the capability registry
      this.capabilityRegistry.registerAgentCapabilities(
        agent.id,
        capabilityMap,
        {
          primaryRoles: agent.roles,
          preferredDomains: agent.tags
        }
      );
    }
    
    console.log(`MCP: Registered agent ${agent.id} with ${agent.capabilities?.length || 0} capabilities`);
  }

  /**
   * Deregister an agent from the MCP
   */
  static deregisterAgent(agentId: string): void {
    if (this.registry[agentId]) {
      delete this.registry[agentId];
      console.log(`MCP: Deregistered agent ${agentId}`);
    }
  }

  /**
   * Get a specific agent by ID
   */
  static getAgent(agentId: string): AgentRegistration | undefined {
    return this.registry[agentId];
  }

  /**
   * Get all registered agents
   */
  static getAllAgents(): AgentRegistration[] {
    return Object.values(this.registry);
  }

  /**
   * Route a task to the most suitable agent based on capabilities and health
   */
  static routeTask(task: PlannedTask): SubAgent | null {
    // Create search options for capability registry
    const searchOptions: CapabilitySearchOptions = {
      requiredCapabilities: task.capabilities || [],
      requiredRoles: task.roles,
      preferredDomain: task.tags?.[0], // Use first tag as preferred domain if available
      minMatchScore: 0.7, // Require at least 70% capability match
      includeUnavailableAgents: false // Only include available agents
    };
    
    // Find best agent for the task
    const agentId = this.capabilityRegistry.findBestAgentForTask(searchOptions);
    
    if (agentId && this.registry[agentId]) {
      // Check if agent is healthy
      if (AgentHealthChecker.isAvailable(agentId)) {
        return this.registry[agentId];
      } else {
        console.warn(`MCP: Best agent ${agentId} is not healthy, looking for alternatives`);
        
        // Get the matched candidates and filter by health
        const candidates = this.capabilityRegistry.findAgentsWithCapabilities(searchOptions)
          .map(match => match.agentId)
          .filter(id => AgentHealthChecker.isAvailable(id) && this.registry[id]);
        
        if (candidates.length > 0) {
          return this.registry[candidates[0]];
        }
      }
    }
    
    console.warn(`MCP: No suitable agent found for task with capabilities ${task.capabilities?.join(', ')}`);
    return null;
  }

  /**
   * Execute a task via the MCP routing system
   */
  static async executeViaMCP(task: PlannedTask): Promise<TaskResult> {
    // Find the best agent for this task
    const agent = this.routeTask(task);
    
    if (!agent) {
      throw new Error(`MCP: No suitable agent found for task ${task.id}`);
    }
    
    // Track task execution with health checker
    AgentHealthChecker.beginTask(agent.id);
    
    try {
      console.log(`MCP: Routing task ${task.id} to agent ${agent.id}`);
      
      // Update agent's last seen timestamp
      if (this.registry[agent.id]) {
        this.registry[agent.id].lastSeen = Date.now();
        this.registry[agent.id].status = 'active';
      }
      
      // Execute the task
      const result = await agent.execute(task);
      
      // Report success to health checker
      AgentHealthChecker.reportSuccess(agent.id);
      
      return result;
    } catch (error) {
      // Report failure to health checker
      AgentHealthChecker.reportFailure(agent.id, error instanceof Error ? error.message : String(error));
      
      // Update agent status
      if (this.registry[agent.id]) {
        this.registry[agent.id].status = 'failed';
      }
      
      throw error;
    }
  }

  /**
   * Get health status for all registered agents
   */
  static getAgentHealthStatus(): Record<string, AgentHealthStatus> {
    return AgentHealthChecker.getAllStatuses();
  }

  /**
   * Update an agent's task quota
   */
  static updateAgentQuota(agentId: string, newQuota: number): boolean {
    return AgentHealthChecker.updateQuota(agentId, newQuota);
  }

  /**
   * Reset an agent's health status
   */
  static resetAgentHealth(agentId: string): boolean {
    return AgentHealthChecker.resetHealthStatus(agentId);
  }
} 