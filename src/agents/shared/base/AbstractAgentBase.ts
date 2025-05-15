/**
 * AgentBase.ts - Core base class for all agents in the system
 * 
 * This base class provides common functionality that all agents share:
 * - Memory management with agent-scoped access using standardized memory system
 * - Tool management with permissions
 * - Planning and execution capabilities
 * - Agent coordination for delegation
 * - Inter-agent messaging
 * - Pluggable manager architecture for customizing agent capabilities
 */

import { BaseManager } from './managers/BaseManager';
import { AgentCapability } from './types';
import type { AgentBase } from './AgentBase.interface';
import type { ManagersConfig } from './ManagersConfig.interface';
import { DefaultSchedulerManager } from '../../../lib/agents/implementations/managers/DefaultSchedulerManager';
import type { 
  MemoryManager, 
  MemoryEntry, 
  MemorySearchOptions,
  MemoryConsolidationResult,
  MemoryPruningResult 
} from './managers/MemoryManager';
import type { PlanningManager, PlanCreationOptions, PlanCreationResult, Plan, PlanExecutionResult } from './managers/PlanningManager.interface';
import type { 
  ToolManager, 
  Tool, 
  ToolExecutionResult, 
  ToolUsageMetrics,
  ToolFallbackRule
} from './managers/ToolManager.interface';
import type {
  KnowledgeManager,
  KnowledgeEntry,
  KnowledgeSearchResult,
  KnowledgeSearchOptions,
  KnowledgeGap
} from './managers/KnowledgeManager.interface';
import type {
  SchedulerManager,
  ScheduledTask,
  TaskCreationOptions,
  TaskCreationResult,
  TaskExecutionResult
} from './managers/SchedulerManager.interface';
import { ManagerType } from './managers/ManagerType';
import { AgentMemoryEntity, AgentStatus } from '../../../server/memory/schema/agent';

/**
 * Abstract implementation of the AgentBase interface
 * Provides common functionality for concrete agent implementations
 */
export abstract class AbstractAgentBase implements AgentBase {
  /** Agent configuration */
  protected config: AgentMemoryEntity;
  
  /** Registered managers */
  protected managers: Map<ManagerType, BaseManager> = new Map();
  
  /** Scheduler manager */
  protected schedulerManager?: DefaultSchedulerManager;
  
  /**
   * Create a new agent instance
   * @param config Agent configuration
   * @param managers Optional managers to inject during construction
   */
  constructor(
    config: AgentMemoryEntity,
    managers?: BaseManager[]
  ) {
    this.config = config;
    
    // Initialize managers if provided (dependency injection)
    if (managers && Array.isArray(managers)) {
      managers.forEach(manager => this.registerManager(manager));
    }
  }
  
  /**
   * Get the unique ID of this agent
   */
  getAgentId(): string {
    return this.config.id;
  }
  
  /**
   * Get the agent name
   */
  getName(): string {
    return this.config.name;
  }
  
  /**
   * Get the agent configuration
   */
  getConfig(): Record<string, unknown> {
    return {
      ...this.config,
      status: this.config.status,
      capabilities: this.config.capabilities
    };
  }
  
  /**
   * Update the agent configuration
   */
  updateConfig(config: Record<string, unknown>): void {
    this.config = { 
      ...this.config,
      ...config,
      status: (config as { status?: AgentStatus })?.status ?? this.config.status
    };
  }
  
  /**
   * Initialize the agent
   */
  async initialize(): Promise<boolean> {
    // Initialize all registered managers
    await this.initializeManagers();
    return true;
  }
  
  /**
   * Shutdown the agent
   */
  abstract shutdown(): Promise<void>;
  
  /**
   * Register a manager with this agent
   */
  registerManager<T extends BaseManager>(manager: T): T {
    const managerType = manager.managerType;
    this.managers.set(managerType, manager);
    
    // Store specialized references for frequently used managers
    if (managerType === ManagerType.SCHEDULER && manager instanceof DefaultSchedulerManager) {
      this.schedulerManager = manager as DefaultSchedulerManager;
    }
    
    return manager;
  }
  
  /**
   * Get a registered manager by type
   */
  getManager<T extends BaseManager>(managerType: ManagerType): T | null {
    const manager = this.managers.get(managerType);
    return manager ? manager as T : null;
  }
  
  /**
   * Get all registered managers
   */
  getManagers(): BaseManager[] {
    return Array.from(this.managers.values());
  }
  
  /**
   * Check if the agent is currently enabled
   */
  isEnabled(): boolean {
    // Treat status OFFLINE as not enabled
    return this.config.status !== AgentStatus.OFFLINE;
  }
  
  /**
   * Enable or disable the agent
   */
  setEnabled(enabled: boolean): boolean {
    // Set status based on enabled flag
    this.config.status = enabled ? AgentStatus.AVAILABLE : AgentStatus.OFFLINE;
    return this.isEnabled();
  }
  
  /**
   * Check if a capability is enabled
   * @param capabilityId The ID of the capability to check
   * @returns Whether the capability is enabled
   */
  hasCapability(capabilityId: string): boolean {
    return this.config.capabilities.some(cap => {
      const capability = {
        id: cap.id,
        name: cap.name,
        description: cap.description,
        enabled: true, // Default to true since schema doesn't have this
        version: cap.version || '1.0.0',
        metadata: cap.parameters // Convert parameters to metadata
      } as AgentCapability;
      return capability.id === capabilityId && capability.enabled;
    });
  }
  
  /**
   * Enable a capability
   * @param capability The capability to enable
   */
  enableCapability(capability: AgentCapability): void {
    if (!this.hasCapability(capability.id)) {
      const schemaCapability = {
        id: capability.id,
        name: capability.name,
        description: capability.description,
        version: capability.version,
        parameters: capability.metadata // Convert metadata to parameters
      };
      this.config.capabilities.push(schemaCapability);
    }
  }
  
  /**
   * Disable a capability
   * @param capabilityId The ID of the capability to disable
   */
  disableCapability(capabilityId: string): void {
    this.config.capabilities = this.config.capabilities.filter(cap => {
      const capability = {
        id: cap.id,
        name: cap.name,
        description: cap.description,
        enabled: true,
        version: cap.version || '1.0.0',
        metadata: cap.parameters // Convert parameters to metadata
      } as AgentCapability;
      return capability.id !== capabilityId;
    });
  }
  
  /**
   * Get agent health status
   * @returns The current health status
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    managerHealth?: Record<string, {
      status: 'healthy' | 'degraded' | 'unhealthy';
      message?: string;
    }>;
  }> {
    // Get health status from all managers
    const managerHealthPromises = Array.from(this.managers.values()).map(
      async manager => {
        try {
          const health = await manager.getHealth();
          return [manager.managerType, health] as const;
        } catch (error) {
          return [
            manager.managerType, 
            { 
              status: 'unhealthy' as const,
              message: `Failed to get health: ${error}`
            }
          ] as const;
        }
      }
    );
    
    const managerHealthResults = await Promise.all(managerHealthPromises);
    const managerHealth: Record<string, {
      status: 'healthy' | 'degraded' | 'unhealthy';
      message?: string;
    }> = Object.fromEntries(managerHealthResults);
    
    // Determine overall agent health based on manager health
    const healthStatuses = Object.values(managerHealth).map(h => h.status);
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (healthStatuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (healthStatuses.includes('degraded')) {
      overallStatus = 'degraded';
    }
      
    return {
      status: overallStatus,
      message: `Agent ${this.getAgentId()} is ${overallStatus}`,
      managerHealth
    };
  }

  /**
   * Get the scheduler manager instance
   */
  getSchedulerManager(): DefaultSchedulerManager | undefined {
    return this.schedulerManager;
  }

  /**
   * Initialize all registered managers
   */
  async initializeManagers(): Promise<void> {
    for (const manager of Array.from(this.managers.values())) {
      if (typeof manager.initialize === 'function') {
        await manager.initialize();
      }
    }
  }

  /**
   * Shut down all registered managers
   */
  async shutdownManagers(): Promise<void> {
    for (const manager of Array.from(this.managers.values())) {
      if (typeof manager.shutdown === 'function') {
        await manager.shutdown();
      }
    }
  }

  /**
   * Add memory content via the registered MemoryManager
   */
  async addMemory(content: string, metadata: Record<string, unknown>): Promise<MemoryEntry> {
    const memoryManager = this.getManager<MemoryManager>(ManagerType.MEMORY);
    if (!memoryManager) throw new Error('MemoryManager not registered');
    if (!memoryManager.initialize) throw new Error('MemoryManager not initialized');
    return memoryManager.addMemory(content, metadata);
  }

  /**
   * Search memories via the registered MemoryManager
   */
  async searchMemories(query: string, options: Record<string, unknown>): Promise<MemoryEntry[]> {
    const memoryManager = this.getManager<MemoryManager>(ManagerType.MEMORY);
    if (!memoryManager) throw new Error('MemoryManager not registered');
    if (!memoryManager.initialize) throw new Error('MemoryManager not initialized');
    return memoryManager.searchMemories(query, options);
  }

  /**
   * Get recent memories via the registered MemoryManager
   */
  async getRecentMemories(limit: number): Promise<MemoryEntry[]> {
    const memoryManager = this.getManager<MemoryManager>(ManagerType.MEMORY);
    if (!memoryManager) throw new Error('MemoryManager not registered');
    if (!memoryManager.initialize) throw new Error('MemoryManager not initialized');
    return memoryManager.getRecentMemories(limit);
  }

  /**
   * Consolidate memories via the registered MemoryManager
   */
  async consolidateMemories(): Promise<MemoryConsolidationResult> {
    const memoryManager = this.getManager<MemoryManager>(ManagerType.MEMORY);
    if (!memoryManager) throw new Error('MemoryManager not registered');
    if (!memoryManager.initialize) throw new Error('MemoryManager not initialized');
    return memoryManager.consolidateMemories();
  }

  /**
   * Prune memories via the registered MemoryManager
   */
  async pruneMemories(): Promise<MemoryPruningResult> {
    const memoryManager = this.getManager<MemoryManager>(ManagerType.MEMORY);
    if (!memoryManager) throw new Error('MemoryManager not registered');
    if (!memoryManager.initialize) throw new Error('MemoryManager not initialized');
    return memoryManager.pruneMemories();
  }

  /**
   * Create a new plan via the registered PlanningManager
   */
  async createPlan(options: PlanCreationOptions): Promise<PlanCreationResult> {
    const planningManager = this.getManager<PlanningManager>(ManagerType.PLANNING);
    if (!planningManager) throw new Error('PlanningManager not registered');
    if (!planningManager.initialize) throw new Error('PlanningManager not initialized');
    return planningManager.createPlan(options);
  }

  /**
   * Get a plan by ID via the registered PlanningManager
   */
  async getPlan(planId: string): Promise<Plan | null> {
    const planningManager = this.getManager<PlanningManager>(ManagerType.PLANNING);
    if (!planningManager) throw new Error('PlanningManager not registered');
    if (!planningManager.initialize) throw new Error('PlanningManager not initialized');
    return planningManager.getPlan(planId);
  }

  /**
   * Get all plans via the registered PlanningManager
   */
  async getAllPlans(): Promise<Plan[]> {
    const planningManager = this.getManager<PlanningManager>(ManagerType.PLANNING);
    if (!planningManager) throw new Error('PlanningManager not registered');
    if (!planningManager.initialize) throw new Error('PlanningManager not initialized');
    return planningManager.getAllPlans();
  }

  /**
   * Update a plan via the registered PlanningManager
   */
  async updatePlan(planId: string, updates: Partial<Plan>): Promise<Plan | null> {
    const planningManager = this.getManager<PlanningManager>(ManagerType.PLANNING);
    if (!planningManager) throw new Error('PlanningManager not registered');
    if (!planningManager.initialize) throw new Error('PlanningManager not initialized');
    return planningManager.updatePlan(planId, updates);
  }

  /**
   * Delete a plan via the registered PlanningManager
   */
  async deletePlan(planId: string): Promise<boolean> {
    const planningManager = this.getManager<PlanningManager>(ManagerType.PLANNING);
    if (!planningManager) throw new Error('PlanningManager not registered');
    if (!planningManager.initialize) throw new Error('PlanningManager not initialized');
    return planningManager.deletePlan(planId);
  }

  /**
   * Execute a plan via the registered PlanningManager
   */
  async executePlan(planId: string): Promise<PlanExecutionResult> {
    const planningManager = this.getManager<PlanningManager>(ManagerType.PLANNING);
    if (!planningManager) throw new Error('PlanningManager not registered');
    if (!planningManager.initialize) throw new Error('PlanningManager not initialized');
    return planningManager.executePlan(planId);
  }

  /**
   * Adapt a plan via the registered PlanningManager
   */
  async adaptPlan(planId: string, reason: string): Promise<Plan | null> {
    const planningManager = this.getManager<PlanningManager>(ManagerType.PLANNING);
    if (!planningManager) throw new Error('PlanningManager not registered');
    if (!planningManager.initialize) throw new Error('PlanningManager not initialized');
    return planningManager.adaptPlan(planId, reason);
  }

  /**
   * Validate a plan via the registered PlanningManager
   */
  async validatePlan(planId: string): Promise<boolean> {
    const planningManager = this.getManager<PlanningManager>(ManagerType.PLANNING);
    if (!planningManager) throw new Error('PlanningManager not registered');
    if (!planningManager.initialize) throw new Error('PlanningManager not initialized');
    return planningManager.validatePlan(planId);
  }

  /**
   * Optimize a plan via the registered PlanningManager
   */
  async optimizePlan(planId: string): Promise<Plan | null> {
    const planningManager = this.getManager<PlanningManager>(ManagerType.PLANNING);
    if (!planningManager) throw new Error('PlanningManager not registered');
    if (!planningManager.initialize) throw new Error('PlanningManager not initialized');
    return planningManager.optimizePlan(planId);
  }

  /**
   * Register a new tool via the registered ToolManager
   */
  async registerTool(tool: Tool): Promise<Tool> {
    const toolManager = this.getManager<ToolManager>(ManagerType.TOOL);
    if (!toolManager) throw new Error('ToolManager not registered');
    if (!toolManager.initialize) throw new Error('ToolManager not initialized');
    return toolManager.registerTool(tool);
  }

  /**
   * Unregister a tool via the registered ToolManager
   */
  async unregisterTool(toolId: string): Promise<boolean> {
    const toolManager = this.getManager<ToolManager>(ManagerType.TOOL);
    if (!toolManager) throw new Error('ToolManager not registered');
    if (!toolManager.initialize) throw new Error('ToolManager not initialized');
    return toolManager.unregisterTool(toolId);
  }

  /**
   * Get a tool by ID via the registered ToolManager
   */
  async getTool(toolId: string): Promise<Tool | null> {
    const toolManager = this.getManager<ToolManager>(ManagerType.TOOL);
    if (!toolManager) throw new Error('ToolManager not registered');
    if (!toolManager.initialize) throw new Error('ToolManager not initialized');
    return toolManager.getTool(toolId);
  }

  /**
   * Get tools via the registered ToolManager
   */
  async getTools(filter?: {
    enabled?: boolean;
    categories?: string[];
    capabilities?: string[];
    experimental?: boolean;
  }): Promise<Tool[]> {
    const toolManager = this.getManager<ToolManager>(ManagerType.TOOL);
    if (!toolManager) throw new Error('ToolManager not registered');
    if (!toolManager.initialize) throw new Error('ToolManager not initialized');
    return toolManager.getTools(filter);
  }

  /**
   * Enable or disable a tool via the registered ToolManager
   */
  async setToolEnabled(toolId: string, enabled: boolean): Promise<Tool> {
    const toolManager = this.getManager<ToolManager>(ManagerType.TOOL);
    if (!toolManager) throw new Error('ToolManager not registered');
    if (!toolManager.initialize) throw new Error('ToolManager not initialized');
    return toolManager.setToolEnabled(toolId, enabled);
  }

  /**
   * Execute a tool via the registered ToolManager
   */
  async executeTool(
    toolId: string,
    params: unknown,
    options?: {
      context?: unknown;
      timeoutMs?: number;
      retries?: number;
      useFallbacks?: boolean;
    }
  ): Promise<ToolExecutionResult> {
    const toolManager = this.getManager<ToolManager>(ManagerType.TOOL);
    if (!toolManager) throw new Error('ToolManager not registered');
    if (!toolManager.initialize) throw new Error('ToolManager not initialized');
    return toolManager.executeTool(toolId, params, options);
  }

  /**
   * Get tool metrics via the registered ToolManager
   */
  async getToolMetrics(toolId?: string): Promise<ToolUsageMetrics[]> {
    const toolManager = this.getManager<ToolManager>(ManagerType.TOOL);
    if (!toolManager) throw new Error('ToolManager not registered');
    if (!toolManager.initialize) throw new Error('ToolManager not initialized');
    return toolManager.getToolMetrics(toolId);
  }

  /**
   * Find best tool for a task via the registered ToolManager
   */
  async findBestToolForTask(taskDescription: string, context?: unknown): Promise<Tool | null> {
    const toolManager = this.getManager<ToolManager>(ManagerType.TOOL);
    if (!toolManager) throw new Error('ToolManager not registered');
    if (!toolManager.initialize) throw new Error('ToolManager not initialized');
    return toolManager.findBestToolForTask(taskDescription, context);
  }

  /**
   * Load knowledge via the registered KnowledgeManager
   */
  async loadKnowledge(): Promise<void> {
    const knowledgeManager = this.getManager<KnowledgeManager>(ManagerType.KNOWLEDGE);
    if (!knowledgeManager) throw new Error('KnowledgeManager not registered');
    if (!knowledgeManager.initialize) throw new Error('KnowledgeManager not initialized');
    return knowledgeManager.loadKnowledge();
  }

  /**
   * Search knowledge via the registered KnowledgeManager
   */
  async searchKnowledge(query: string, options?: KnowledgeSearchOptions): Promise<KnowledgeSearchResult[]> {
    const knowledgeManager = this.getManager<KnowledgeManager>(ManagerType.KNOWLEDGE);
    if (!knowledgeManager) throw new Error('KnowledgeManager not registered');
    if (!knowledgeManager.initialize) throw new Error('KnowledgeManager not initialized');
    return knowledgeManager.searchKnowledge(query, options);
  }

  /**
   * Add a knowledge entry via the registered KnowledgeManager
   */
  async addKnowledgeEntry(entry: Omit<KnowledgeEntry, 'id' | 'timestamp'>): Promise<KnowledgeEntry> {
    const knowledgeManager = this.getManager<KnowledgeManager>(ManagerType.KNOWLEDGE);
    if (!knowledgeManager) throw new Error('KnowledgeManager not registered');
    if (!knowledgeManager.initialize) throw new Error('KnowledgeManager not initialized');
    return knowledgeManager.addKnowledgeEntry(entry);
  }

  /**
   * Get a knowledge entry via the registered KnowledgeManager
   */
  async getKnowledgeEntry(id: string): Promise<KnowledgeEntry | null> {
    const knowledgeManager = this.getManager<KnowledgeManager>(ManagerType.KNOWLEDGE);
    if (!knowledgeManager) throw new Error('KnowledgeManager not registered');
    if (!knowledgeManager.initialize) throw new Error('KnowledgeManager not initialized');
    return knowledgeManager.getKnowledgeEntry(id);
  }

  /**
   * Update a knowledge entry via the registered KnowledgeManager
   */
  async updateKnowledgeEntry(id: string, updates: Partial<KnowledgeEntry>): Promise<KnowledgeEntry> {
    const knowledgeManager = this.getManager<KnowledgeManager>(ManagerType.KNOWLEDGE);
    if (!knowledgeManager) throw new Error('KnowledgeManager not registered');
    if (!knowledgeManager.initialize) throw new Error('KnowledgeManager not initialized');
    return knowledgeManager.updateKnowledgeEntry(id, updates);
  }

  /**
   * Delete a knowledge entry via the registered KnowledgeManager
   */
  async deleteKnowledgeEntry(id: string): Promise<boolean> {
    const knowledgeManager = this.getManager<KnowledgeManager>(ManagerType.KNOWLEDGE);
    if (!knowledgeManager) throw new Error('KnowledgeManager not registered');
    if (!knowledgeManager.initialize) throw new Error('KnowledgeManager not initialized');
    return knowledgeManager.deleteKnowledgeEntry(id);
  }

  /**
   * Get knowledge entries via the registered KnowledgeManager
   */
  async getKnowledgeEntries(options?: {
    category?: string;
    tags?: string[];
    source?: string;
    verified?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<KnowledgeEntry[]> {
    const knowledgeManager = this.getManager<KnowledgeManager>(ManagerType.KNOWLEDGE);
    if (!knowledgeManager) throw new Error('KnowledgeManager not registered');
    if (!knowledgeManager.initialize) throw new Error('KnowledgeManager not initialized');
    return knowledgeManager.getKnowledgeEntries(options);
  }

  /**
   * Identify knowledge gaps via the registered KnowledgeManager
   */
  async identifyKnowledgeGaps(): Promise<KnowledgeGap[]> {
    const knowledgeManager = this.getManager<KnowledgeManager>(ManagerType.KNOWLEDGE);
    if (!knowledgeManager) throw new Error('KnowledgeManager not registered');
    if (!knowledgeManager.initialize) throw new Error('KnowledgeManager not initialized');
    return knowledgeManager.identifyKnowledgeGaps();
  }

  /**
   * Get a knowledge gap via the registered KnowledgeManager
   */
  async getKnowledgeGap(id: string): Promise<KnowledgeGap | null> {
    const knowledgeManager = this.getManager<KnowledgeManager>(ManagerType.KNOWLEDGE);
    if (!knowledgeManager) throw new Error('KnowledgeManager not registered');
    if (!knowledgeManager.initialize) throw new Error('KnowledgeManager not initialized');
    return knowledgeManager.getKnowledgeGap(id);
  }

  /**
   * Create a new task via the registered SchedulerManager
   */
  async createTask(options: Record<string, unknown>): Promise<TaskCreationResult> {
    const schedulerManager = this.getManager<SchedulerManager>(ManagerType.SCHEDULER);
    if (!schedulerManager) throw new Error('SchedulerManager not registered');
    if (!schedulerManager.initialize) throw new Error('SchedulerManager not initialized');
    return schedulerManager.createTask(options as unknown as TaskCreationOptions);
  }

  /**
   * Get a task by ID via the registered SchedulerManager
   */
  async getTask(taskId: string): Promise<Record<string, unknown> | null> {
    const schedulerManager = this.getManager<SchedulerManager>(ManagerType.SCHEDULER);
    if (!schedulerManager) throw new Error('SchedulerManager not registered');
    if (!schedulerManager.initialize) throw new Error('SchedulerManager not initialized');
    const task = await schedulerManager.getTask(taskId);
    return task ? { ...task } as Record<string, unknown> : null;
  }

  /**
   * Get all tasks via the registered SchedulerManager
   */
  async getAllTasks(): Promise<ScheduledTask[]> {
    const schedulerManager = this.getManager<SchedulerManager>(ManagerType.SCHEDULER);
    if (!schedulerManager) throw new Error('SchedulerManager not registered');
    if (!schedulerManager.initialize) throw new Error('SchedulerManager not initialized');
    return schedulerManager.getTasks();
  }

  /**
   * Get tasks in a generic format
   */
  async getTasks(): Promise<Record<string, unknown>[]> {
    const tasks = await this.getAllTasks();
    return tasks.map(task => ({ ...task } as Record<string, unknown>));
  }

  /**
   * Update a task via the registered SchedulerManager
   */
  async updateTask(taskId: string, updates: Partial<ScheduledTask>): Promise<ScheduledTask | null> {
    const schedulerManager = this.getManager<SchedulerManager>(ManagerType.SCHEDULER);
    if (!schedulerManager) throw new Error('SchedulerManager not registered');
    if (!schedulerManager.initialize) throw new Error('SchedulerManager not initialized');
    
    // Get the current task
    const task = await schedulerManager.getTask(taskId);
    if (!task) {
      return null;
    }

    // Create updated task
    const updatedTask = { ...task, ...updates };
    
    // Cancel the current task
    await schedulerManager.cancelTask(taskId);
    
    // Create a new task with the updates
    const result = await schedulerManager.createTask({
      title: updatedTask.title,
      description: updatedTask.description,
      type: updatedTask.type,
      priority: updatedTask.priority,
      dependencies: updatedTask.dependencies,
      metadata: updatedTask.metadata
    });

    return result.success ? result.task : null;
  }

  /**
   * Delete a task via the registered SchedulerManager
   */
  async deleteTask(taskId: string): Promise<boolean> {
    const schedulerManager = this.getManager<SchedulerManager>(ManagerType.SCHEDULER);
    if (!schedulerManager) throw new Error('SchedulerManager not registered');
    if (!schedulerManager.initialize) throw new Error('SchedulerManager not initialized');
    return schedulerManager.cancelTask(taskId);
  }

  /**
   * Execute a task via the registered SchedulerManager
   */
  async executeTask(taskId: string): Promise<TaskExecutionResult> {
    const schedulerManager = this.getManager<SchedulerManager>(ManagerType.SCHEDULER);
    if (!schedulerManager) throw new Error('SchedulerManager not registered');
    if (!schedulerManager.initialize) throw new Error('SchedulerManager not initialized');
    return schedulerManager.executeTask(taskId);
  }

  /**
   * Cancel a task via the registered SchedulerManager
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const schedulerManager = this.getManager<SchedulerManager>(ManagerType.SCHEDULER);
    if (!schedulerManager) throw new Error('SchedulerManager not registered');
    if (!schedulerManager.initialize) throw new Error('SchedulerManager not initialized');
    return schedulerManager.cancelTask(taskId);
  }

  /**
   * Get due tasks via the registered SchedulerManager
   */
  async getDueTasks(): Promise<ScheduledTask[]> {
    const schedulerManager = this.getManager<SchedulerManager>(ManagerType.SCHEDULER);
    if (!schedulerManager) throw new Error('SchedulerManager not registered');
    if (!schedulerManager.initialize) throw new Error('SchedulerManager not initialized');
    return schedulerManager.getDueTasks();
  }

  /**
   * Get running tasks via the registered SchedulerManager
   */
  async getRunningTasks(): Promise<ScheduledTask[]> {
    const schedulerManager = this.getManager<SchedulerManager>(ManagerType.SCHEDULER);
    if (!schedulerManager) throw new Error('SchedulerManager not registered');
    if (!schedulerManager.initialize) throw new Error('SchedulerManager not initialized');
    return schedulerManager.getRunningTasks();
  }

  /**
   * Get pending tasks via the registered SchedulerManager
   */
  async getPendingTasks(): Promise<ScheduledTask[]> {
    const schedulerManager = this.getManager<SchedulerManager>(ManagerType.SCHEDULER);
    if (!schedulerManager) throw new Error('SchedulerManager not registered');
    if (!schedulerManager.initialize) throw new Error('SchedulerManager not initialized');
    return schedulerManager.getPendingTasks();
  }

  /**
   * Get failed tasks via the registered SchedulerManager
   */
  async getFailedTasks(): Promise<ScheduledTask[]> {
    const schedulerManager = this.getManager<SchedulerManager>(ManagerType.SCHEDULER);
    if (!schedulerManager) throw new Error('SchedulerManager not registered');
    if (!schedulerManager.initialize) throw new Error('SchedulerManager not initialized');
    return schedulerManager.getFailedTasks();
  }

  /**
   * Retry a task via the registered SchedulerManager
   */
  async retryTask(taskId: string): Promise<TaskExecutionResult> {
    const schedulerManager = this.getManager<SchedulerManager>(ManagerType.SCHEDULER);
    if (!schedulerManager) throw new Error('SchedulerManager not registered');
    if (!schedulerManager.initialize) throw new Error('SchedulerManager not initialized');
    return schedulerManager.retryTask(taskId);
  }

  /**
   * Get the agent's ID (alias for getAgentId)
   */
  getId(): string {
    return this.getAgentId();
  }

  /**
   * Get the agent's type
   */
  getType(): string {
    return 'agent';
  }

  /**
   * Get the agent's description
   */
  getDescription(): string {
    return this.config.description || '';
  }

  /**
   * Get the agent's version
   */
  getVersion(): string {
    return this.config.metadata.version;
  }

  /**
   * Get the agent's capabilities
   */
  async getCapabilities(): Promise<string[]> {
    return this.config.capabilities.map(cap => cap.id);
  }

  /**
   * Get the agent's status
   */
  getStatus(): { status: string; message?: string } {
    return {
      status: this.config.status,
      message: `Agent ${this.getName()} is ${this.config.status}`
    };
  }

  /**
   * Reset the agent to initial state
   */
  async reset(): Promise<void> {
    // Reset all managers
    for (const manager of this.getManagers()) {
      await manager.reset();
    }
  }

  /**
   * Set a manager
   */
  setManager<T extends BaseManager>(manager: T): void {
    this.registerManager(manager);
  }

  /**
   * Remove a manager
   */
  removeManager(type: ManagerType): void {
    this.managers.delete(type);
  }

  /**
   * Check if a manager exists
   */
  hasManager(type: ManagerType): boolean {
    return this.managers.has(type);
  }
}
