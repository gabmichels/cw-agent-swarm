/**
 * AgentCoordinator.ts - Coordinates multiple agents for task delegation
 * 
 * This module provides:
 * - Task delegation to specialized agents
 * - Agent registry and capability discovery
 * - Inter-agent communication
 * - Result aggregation from sub-agents
 */

import { AgentBase, AgentCapabilityLevel } from '../base/AgentBase';
import { Plan } from '../planning/Planner';
import { ExecutionResult } from '../execution/Executor';

// Agent registry entry
export interface RegisteredAgent {
  agent: AgentBase;
  capabilities: string[];
  domain: string;
  reliability: number;
  status: 'available' | 'busy' | 'offline';
  lastActive: Date;
}

// Task delegation request
export interface DelegationRequest {
  taskId: string;
  goal: string;
  requiredCapabilities?: string[];
  priority?: number;
  deadline?: Date;
  context?: Record<string, any>;
  requestingAgentId: string;
}

// Delegation result
export interface DelegationResult {
  taskId: string;
  assignedAgentId: string;
  status: 'accepted' | 'rejected' | 'pending' | 'completed' | 'failed';
  result?: any;
  error?: string;
  startTime?: Date;
  completionTime?: Date;
}

// Coordinator options
export interface CoordinatorOptions {
  defaultAgentId?: string;
  enableLoadBalancing?: boolean;
  enableReliabilityTracking?: boolean;
  agentTimeout?: number;
}

/**
 * Agent coordinator for task delegation and multi-agent workflows
 */
export class AgentCoordinator {
  private agents: Map<string, RegisteredAgent> = new Map();
  private delegations: Map<string, DelegationResult> = new Map();
  private options: CoordinatorOptions;
  private initialized: boolean = false;
  
  constructor(options: CoordinatorOptions = {}) {
    this.options = {
      defaultAgentId: 'chloe',
      enableLoadBalancing: true,
      enableReliabilityTracking: true,
      agentTimeout: 60000, // 1 minute default timeout
      ...options
    };
  }
  
  /**
   * Initialize the coordinator
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing AgentCoordinator...');
      
      // Initialization logic will be added here
      
      this.initialized = true;
      console.log('AgentCoordinator initialized successfully');
    } catch (error) {
      console.error('Error initializing AgentCoordinator:', error);
      throw error;
    }
  }
  
  /**
   * Register an agent with the coordinator
   */
  registerAgent(agent: AgentBase, capabilities: string[], domain: string): void {
    const agentId = agent.getAgentId();
    
    if (this.agents.has(agentId)) {
      console.warn(`Agent ${agentId} already registered and will be updated`);
    }
    
    this.agents.set(agentId, {
      agent,
      capabilities,
      domain,
      reliability: 1.0, // Start with perfect reliability
      status: 'available',
      lastActive: new Date()
    });
    
    console.log(`Registered agent ${agentId} with capabilities: ${capabilities.join(', ')}`);
  }
  
  /**
   * Delegate a task to the most appropriate agent
   */
  async delegateTask(request: DelegationRequest): Promise<DelegationResult> {
    try {
      if (!this.initialized) {
        throw new Error('AgentCoordinator not initialized');
      }
      
      console.log(`Delegating task ${request.taskId}: ${request.goal}`);
      
      // Find the most appropriate agent
      const assignedAgentId = this.findBestAgent(request);
      
      if (!assignedAgentId) {
        return {
          taskId: request.taskId,
          assignedAgentId: '',
          status: 'rejected',
          error: 'No suitable agent found for this task'
        };
      }
      
      // Create delegation result
      const delegation: DelegationResult = {
        taskId: request.taskId,
        assignedAgentId,
        status: 'accepted',
        startTime: new Date()
      };
      
      // Store delegation
      this.delegations.set(request.taskId, delegation);
      
      // Update agent status
      const agentEntry = this.agents.get(assignedAgentId)!;
      agentEntry.status = 'busy';
      
      // Execute the task asynchronously
      this.executeTaskAsync(request, assignedAgentId).catch(error => {
        console.error(`Error executing delegated task ${request.taskId}:`, error);
      });
      
      return delegation;
    } catch (error) {
      console.error(`Error delegating task ${request.taskId}:`, error);
      
      return {
        taskId: request.taskId,
        assignedAgentId: '',
        status: 'failed',
        error: `Delegation error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  /**
   * Execute a delegated task asynchronously
   */
  private async executeTaskAsync(request: DelegationRequest, agentId: string): Promise<void> {
    try {
      const agent = this.agents.get(agentId)?.agent;
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }
      
      // Execute the task
      const result = await agent.planAndExecute(request.goal, request.context);
      
      // Update delegation result
      const delegation = this.delegations.get(request.taskId);
      if (delegation) {
        delegation.status = 'completed';
        delegation.result = result;
        delegation.completionTime = new Date();
      }
      
      // Update agent status and reliability
      const agentEntry = this.agents.get(agentId);
      if (agentEntry) {
        agentEntry.status = 'available';
        agentEntry.lastActive = new Date();
        
        // Update reliability if tracking is enabled
        if (this.options.enableReliabilityTracking) {
          // Simple success-based reliability update
          const success = result && !result.error;
          agentEntry.reliability = agentEntry.reliability * 0.9 + (success ? 0.1 : 0);
        }
      }
    } catch (error) {
      console.error(`Error executing task ${request.taskId} by agent ${agentId}:`, error);
      
      // Update delegation result
      const delegation = this.delegations.get(request.taskId);
      if (delegation) {
        delegation.status = 'failed';
        delegation.error = `Execution error: ${error instanceof Error ? error.message : String(error)}`;
        delegation.completionTime = new Date();
      }
      
      // Update agent status and reliability
      const agentEntry = this.agents.get(agentId);
      if (agentEntry) {
        agentEntry.status = 'available';
        agentEntry.lastActive = new Date();
        
        // Update reliability if tracking is enabled
        if (this.options.enableReliabilityTracking) {
          agentEntry.reliability = Math.max(0.1, agentEntry.reliability * 0.9);
        }
      }
    }
  }
  
  /**
   * Find the best agent for a task
   */
  private findBestAgent(request: DelegationRequest): string | null {
    // Get available agents
    const availableAgents = Array.from(this.agents.entries())
      .filter(([_, entry]) => entry.status === 'available')
      .map(([id, entry]) => ({ id, entry }));
    
    if (availableAgents.length === 0) {
      console.warn('No available agents for task delegation');
      return null;
    }
    
    // If required capabilities are specified, filter by capability
    let candidates = availableAgents;
    if (request.requiredCapabilities && request.requiredCapabilities.length > 0) {
      candidates = candidates.filter(({ entry }) => {
        return request.requiredCapabilities!.every(cap => entry.capabilities.includes(cap));
      });
    }
    
    if (candidates.length === 0) {
      console.warn('No agents with required capabilities found');
      return null;
    }
    
    // Sort by reliability if tracking is enabled
    if (this.options.enableReliabilityTracking) {
      candidates.sort((a, b) => b.entry.reliability - a.entry.reliability);
    }
    
    // Return the best candidate
    return candidates[0].id;
  }
  
  /**
   * Get the status of a delegated task
   */
  getDelegationStatus(taskId: string): DelegationResult | null {
    return this.delegations.get(taskId) || null;
  }
  
  /**
   * Get all registered agents
   */
  getRegisteredAgents(): Record<string, Omit<RegisteredAgent, 'agent'>> {
    const result: Record<string, any> = {};
    
    this.agents.forEach((entry, id) => {
      // Omit the actual agent instance
      const { agent, ...rest } = entry;
      result[id] = rest;
    });
    
    return result;
  }
  
  /**
   * Check if coordinator is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Shutdown the coordinator
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down AgentCoordinator...');
    // Cleanup logic will be added here
  }
} 