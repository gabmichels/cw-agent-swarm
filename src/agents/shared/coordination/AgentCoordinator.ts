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
import { AgentMonitor } from '../monitoring/AgentMonitor';
import { AgentHealthChecker } from './AgentHealthChecker';
import { CapabilityRegistry, CapabilityType, CapabilityLevel, Capability } from './CapabilityRegistry';
import * as crypto from 'crypto';
import { AgentStatus, AgentCapability } from '../../../server/memory/schema/agent';

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
  preferredCapabilities?: string[];
  requiredCapabilityLevels?: Record<string, CapabilityLevel>;
  preferredDomain?: string;
  requiredRoles?: string[];
  priority?: number;
  deadline?: Date;
  context?: Record<string, any>;
  requestingAgentId: string;
  // Delegation tracking fields
  parentTaskId?: string;
  delegationContextId?: string;
  originAgentId?: string;
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
  // Delegation tracking fields
  delegationContextId?: string;
  parentTaskId?: string;
  originAgentId?: string;
}

// Coordinator options
export interface CoordinatorOptions {
  defaultAgentId?: string;
  enableLoadBalancing?: boolean;
  enableReliabilityTracking?: boolean;
  enableCapabilityMatching?: boolean;
  agentTimeout?: number;
  healthCheckConfig?: {
    enableHealthChecks?: boolean;
    quotaEnforcement?: boolean;
    unhealthyFailureThreshold?: number;
  };
}

/**
 * Agent coordinator for task delegation and multi-agent workflows
 */
export class AgentCoordinator {
  private agents: Map<string, RegisteredAgent> = new Map();
  private delegations: Map<string, DelegationResult> = new Map();
  private options: CoordinatorOptions;
  private initialized: boolean = false;
  private capabilityRegistry: CapabilityRegistry;
  
  constructor(options: CoordinatorOptions = {}) {
    this.options = {
      defaultAgentId: 'chloe',
      enableLoadBalancing: true,
      enableReliabilityTracking: true,
      enableCapabilityMatching: true,
      agentTimeout: 60000, // 1 minute default timeout
      healthCheckConfig: {
        enableHealthChecks: true,
        quotaEnforcement: true,
        unhealthyFailureThreshold: 0.6
      },
      ...options
    };
    
    // Get capability registry instance
    this.capabilityRegistry = CapabilityRegistry.getInstance();
  }
  
  /**
   * Initialize the coordinator
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing AgentCoordinator...');
      
      // Initialize health checker if enabled
      if (this.options.healthCheckConfig?.enableHealthChecks) {
        AgentHealthChecker.initialize({
          quotaEnforcement: this.options.healthCheckConfig.quotaEnforcement,
          unhealthyFailureThreshold: this.options.healthCheckConfig.unhealthyFailureThreshold
        });
      }
      
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
  registerAgent(
    agent: AgentBase, 
    capabilities: AgentCapability[], 
    domain: string, 
    quota: number = 5,
    options?: {
      capabilityLevels?: Record<string, CapabilityLevel>;
      roles?: string[];
      domains?: string[];
    }
  ): void {
    const agentId = agent.getAgentId();
    
    if (this.agents.has(agentId)) {
      console.warn(`Agent ${agentId} already registered and will be updated`);
    }
    
    this.agents.set(agentId, {
      agent,
      capabilities,
      domain,
      reliability: 1.0, // Start with perfect reliability
      status: AgentStatus.AVAILABLE,
      lastActive: new Date()
    });
    
    // Register with health checker for quota enforcement
    if (this.options.healthCheckConfig?.enableHealthChecks) {
      AgentHealthChecker.register(agentId, quota);
    }
    
    // Register capabilities if capability matching is enabled
    if (this.options.enableCapabilityMatching) {
      // Convert capability array to record with default levels
      const capabilityLevels: Record<string, CapabilityLevel> = {};
      
      capabilities.forEach(cap => {
        // Use provided level or default to STANDARD
        capabilityLevels[cap.id] = (options?.capabilityLevels && options.capabilityLevels[cap.id]) 
          ? options.capabilityLevels[cap.id] 
          : CapabilityLevel.INTERMEDIATE;
      });
      
      // Register with capability registry
      this.capabilityRegistry.registerAgentCapabilities(
        agentId,
        capabilityLevels,
        {
          preferredDomains: options?.domains || [domain],
          primaryRoles: options?.roles || []
        }
      );
    }
    
    console.log(`Registered agent ${agentId} with capabilities: ${capabilities.map(c => c.id).join(', ')} and quota: ${quota}`);
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
      
      // Generate delegation tracking IDs if not provided
      const delegationContextId = request.delegationContextId || 
        `delegation_${crypto.randomUUID()}`;
      
      const parentTaskId = request.parentTaskId || request.taskId;
      const originAgentId = request.originAgentId || request.requestingAgentId;
      
      // Find the most appropriate agent with health awareness
      let assignedAgentId = this.findBestAgent(request);
      
      if (!assignedAgentId) {
        return {
          taskId: request.taskId,
          assignedAgentId: '',
          status: 'rejected',
          error: 'No suitable agent found for this task',
          delegationContextId,
          parentTaskId,
          originAgentId
        };
      }
      
      // Check if agent is available based on health and quota
      if (this.options.healthCheckConfig?.enableHealthChecks) {
        if (!AgentHealthChecker.isAvailable(assignedAgentId)) {
          const fallbackAgentId = this.findFallbackAgent(request, assignedAgentId);
          
          if (!fallbackAgentId) {
            return {
              taskId: request.taskId,
              assignedAgentId: '',
              status: 'rejected',
              error: `Primary agent ${assignedAgentId} unavailable and no fallback found`,
              delegationContextId,
              parentTaskId,
              originAgentId
            };
          }
          
          // Log fallback routing
          console.log(`Primary agent ${assignedAgentId} unavailable, using fallback ${fallbackAgentId}`);
          AgentMonitor.log({
            agentId: request.requestingAgentId,
            taskId: request.taskId,
            parentTaskId,
            delegationContextId,
            eventType: 'delegation',
            status: 'success',
            timestamp: Date.now(),
            metadata: {
              fallbackReason: AgentHealthChecker.getStatus(assignedAgentId)?.healthy ? 'quota_exceeded' : 'unhealthy',
              originalAgent: assignedAgentId,
              fallbackAgent: fallbackAgentId
            }
          });
          
          // Use fallback instead
          assignedAgentId = fallbackAgentId;
        }
        
        // Track task start for quota management
        if (!AgentHealthChecker.beginTask(assignedAgentId)) {
          return {
            taskId: request.taskId,
            assignedAgentId: '',
            status: 'rejected',
            error: `Agent ${assignedAgentId} rejected task due to quota limits`,
            delegationContextId,
            parentTaskId,
            originAgentId
          };
        }
      }
      
      // Create delegation result
      const delegation: DelegationResult = {
        taskId: request.taskId,
        assignedAgentId,
        status: 'accepted',
        startTime: new Date(),
        delegationContextId,
        parentTaskId,
        originAgentId
      };
      
      // Log delegation event
      AgentMonitor.log({
        agentId: request.requestingAgentId,
        taskId: request.taskId,
        parentTaskId,
        delegationContextId,
        eventType: 'delegation',
        status: 'success',
        timestamp: Date.now(),
        metadata: {
          toAgent: assignedAgentId,
          fromAgent: request.requestingAgentId,
          taskGoal: request.goal,
          originAgentId,
          agentHealth: AgentHealthChecker.getStatus(assignedAgentId)
        }
      });
      
      // Store delegation
      this.delegations.set(request.taskId, delegation);
      
      // Update agent status
      const agentEntry = this.agents.get(assignedAgentId)!;
      agentEntry.status = 'busy';
      agentEntry.lastActive = new Date();
      
      // Enhance context with delegation tracking information
      const enhancedContext = {
        ...(request.context || {}),
        delegationContextId,
        parentTaskId,
        originAgentId,
        delegatingAgentId: request.requestingAgentId
      };
      
      // Execute the task asynchronously
      this.executeTaskAsync({
        ...request,
        delegationContextId,
        parentTaskId,
        originAgentId,
        context: enhancedContext
      }, assignedAgentId).catch(error => {
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
      
      // Execute the task with delegation context
      const result = await agent.planAndExecute(request.goal, request.context);
      
      // Update delegation result
      const delegation = this.delegations.get(request.taskId);
      if (delegation) {
        delegation.status = 'completed';
        delegation.result = result;
        delegation.completionTime = new Date();
      }
      
      // Update health checker on success
      if (this.options.healthCheckConfig?.enableHealthChecks) {
        AgentHealthChecker.reportSuccess(agentId);
      }
      
      // Log task completion
      if (request.delegationContextId) {
        AgentMonitor.log({
          agentId,
          taskId: request.taskId,
          parentTaskId: request.parentTaskId,
          delegationContextId: request.delegationContextId,
          eventType: 'task_end',
          status: 'success',
          timestamp: Date.now(),
          metadata: {
            fromAgent: request.requestingAgentId,
            originAgentId: request.originAgentId,
            result: JSON.stringify(result).substring(0, 100)
          }
        });
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
      
      // Update health checker on failure
      if (this.options.healthCheckConfig?.enableHealthChecks) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        AgentHealthChecker.reportFailure(agentId, errorMessage);
      }
      
      // Update delegation result
      const delegation = this.delegations.get(request.taskId);
      if (delegation) {
        delegation.status = 'failed';
        delegation.error = `Execution error: ${error instanceof Error ? error.message : String(error)}`;
        delegation.completionTime = new Date();
      }
      
      // Log task failure
      if (request.delegationContextId) {
        AgentMonitor.log({
          agentId,
          taskId: request.taskId,
          parentTaskId: request.parentTaskId,
          delegationContextId: request.delegationContextId,
          eventType: 'error',
          status: 'failure',
          timestamp: Date.now(),
          errorMessage: error instanceof Error ? error.message : String(error),
          metadata: {
            fromAgent: request.requestingAgentId,
            originAgentId: request.originAgentId
          }
        });
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
    // If capability matching is enabled and required capabilities are specified, use capability registry
    if (this.options.enableCapabilityMatching && 
        request.requiredCapabilities && 
        request.requiredCapabilities.length > 0) {
      
      const bestAgent = this.capabilityRegistry.findBestAgentForTask({
        requiredCapabilities: request.requiredCapabilities,
        preferredCapabilities: request.preferredCapabilities,
        requiredLevels: request.requiredCapabilityLevels,
        preferredDomain: request.preferredDomain,
        requiredRoles: request.requiredRoles,
        minMatchScore: 0.6 // Require at least 60% match
      });
      
      if (bestAgent) {
        console.log(`Found best agent ${bestAgent} based on capability matching`);
        return bestAgent;
      }
      
      console.warn('No agent found with required capabilities, falling back to standard selection');
    }
    
    // Fall back to the original logic if capability matching is disabled or no match found
    
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
    
    // If health checks enabled, consider agent health status
    if (this.options.healthCheckConfig?.enableHealthChecks) {
      // Filter for healthy agents first
      const healthyCandidates = candidates.filter(({ id }) => 
        AgentHealthChecker.isAvailable(id)
      );
      
      // If we have healthy candidates, use those
      if (healthyCandidates.length > 0) {
        candidates = healthyCandidates;
      } else {
        console.warn('No healthy agents available with required capabilities, using fallbacks');
      }
    }
    
    // Sort by reliability if tracking is enabled
    if (this.options.enableReliabilityTracking) {
      candidates.sort((a, b) => b.entry.reliability - a.entry.reliability);
    }
    
    // Return the best candidate
    return candidates[0].id;
  }
  
  /**
   * Find a fallback agent when primary is unavailable
   */
  private findFallbackAgent(request: DelegationRequest, excludedAgentId: string): string | null {
    // If capability matching is enabled, use capability registry with relaxed requirements
    if (this.options.enableCapabilityMatching && 
        request.requiredCapabilities && 
        request.requiredCapabilities.length > 0) {
      
      // Use a lower match threshold for fallbacks
      const fallbackAgent = this.capabilityRegistry.findBestAgentForTask({
        requiredCapabilities: request.requiredCapabilities,
        preferredCapabilities: request.preferredCapabilities,
        requiredLevels: request.requiredCapabilityLevels,
        preferredDomain: request.preferredDomain,
        requiredRoles: request.requiredRoles,
        minMatchScore: 0.4, // Lower threshold for fallbacks
        includeUnavailableAgents: false
      });
      
      if (fallbackAgent && fallbackAgent !== excludedAgentId) {
        console.log(`Found fallback agent ${fallbackAgent} based on capability matching`);
        return fallbackAgent;
      }
      
      // If we still didn't find a fallback, suggest alternative capabilities
      const alternatives = this.capabilityRegistry.suggestAlternativeCapabilities(
        request.requiredCapabilities
      );
      
      if (alternatives.length > 0) {
        console.log(`Suggesting alternative capabilities: ${alternatives.map(c => c.name).join(', ')}`);
        
        // Try to find an agent with the alternative capabilities
        const alternativeCapIds = alternatives.map(c => c.id);
        
        // Build a new request with alternative capabilities
        const alternativeRequest: DelegationRequest = {
          ...request,
          requiredCapabilities: alternativeCapIds
        };
        
        // Try to find an agent with these alternative capabilities
        const alternativeAgent = this.findBestAgent(alternativeRequest);
        
        if (alternativeAgent && alternativeAgent !== excludedAgentId) {
          console.log(`Found alternative agent ${alternativeAgent} with similar capabilities`);
          return alternativeAgent;
        }
      }
    }
    
    // Fall back to the original logic if capability matching is disabled or no match found
    
    // First get all candidates with required capabilities
    const candidates = Array.from(this.agents.entries())
      .filter(([id, entry]) => id !== excludedAgentId && 
                               entry.status === 'available' &&
                               (!request.requiredCapabilities || 
                                request.requiredCapabilities.every(cap => entry.capabilities.includes(cap))))
      .map(([id]) => id);
    
    if (candidates.length === 0) {
      return null;
    }
    
    // Use AgentHealthChecker to find best available agent from candidates
    if (this.options.healthCheckConfig?.enableHealthChecks) {
      return AgentHealthChecker.getBestAvailable(candidates);
    }
    
    // Fallback to first candidate if health checking not enabled
    return candidates[0];
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
    
    // Shutdown health checker if enabled
    if (this.options.healthCheckConfig?.enableHealthChecks) {
      AgentHealthChecker.shutdown();
    }
    
    // Cleanup logic will be added here
  }
  
  /**
   * Get delegation chain for a task
   */
  getDelegationChain(taskId: string): DelegationResult[] {
    const chain: DelegationResult[] = [];
    let currentTaskId = taskId;
    
    // Find the task
    const task = this.delegations.get(currentTaskId);
    if (!task) {
      return chain;
    }
    
    // Add the task to the chain
    chain.push(task);
    
    // Find all other tasks in the same delegation context
    if (task.delegationContextId) {
      // Convert Map entries to Array before iterating
      Array.from(this.delegations.entries()).forEach(([id, delegation]) => {
        if (id !== currentTaskId && delegation.delegationContextId === task.delegationContextId) {
          chain.push(delegation);
        }
      });
      
      // Sort by parentTaskId to reconstruct the chain order
      chain.sort((a, b) => {
        // Tasks without parentTaskId come first (they are root tasks)
        if (!a.parentTaskId) return -1;
        if (!b.parentTaskId) return 1;
        
        // Otherwise sort by parentTaskId
        return a.parentTaskId.localeCompare(b.parentTaskId);
      });
    }
    
    return chain;
  }
  
  /**
   * Get all agents with a specific capability
   */
  getAgentsWithCapability(capability: string): string[] {
    if (this.options.enableCapabilityMatching) {
      return this.capabilityRegistry.getAgentsWithCapability(capability);
    }
    
    // Fallback if capability registry not enabled
    const agents: string[] = [];
    
    for (const [agentId, entry] of Array.from(this.agents.entries())) {
      if (entry.capabilities.includes(capability)) {
        agents.push(agentId);
      }
    }
    
    return agents;
  }
  
  /**
   * Register a new capability definition
   */
  registerCapability(capability: Capability): void {
    if (!this.options.enableCapabilityMatching) {
      console.warn('Capability matching is disabled, but registering capability anyway');
    }
    
    this.capabilityRegistry.registerCapability(capability);
  }
  
  /**
   * Get all registered capabilities
   */
  getAllCapabilities(): Capability[] {
    return this.capabilityRegistry.getAllCapabilities();
  }
  
  /**
   * Get all capabilities for an agent
   */
  getAgentCapabilities(agentId: string): Record<string, CapabilityLevel> {
    const capabilities = this.capabilityRegistry.getAgentCapabilities(agentId);
    
    if (!capabilities) {
      return {};
    }
    
    // Convert Map to Record
    const result: Record<string, CapabilityLevel> = {};
    capabilities.forEach((level, id) => {
      result[id] = level;
    });
    
    return result;
  }
} 