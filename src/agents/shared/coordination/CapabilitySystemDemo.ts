/**
 * CapabilitySystemDemo.ts - Example usage of the capability system
 * 
 * This module demonstrates:
 * - Initializing the capability registry
 * - Configuring agents with capabilities
 * - Using capability-based delegation and discovery
 */

import { AgentBase } from '../base/AgentBase.interface';
import { AgentBaseConfig, AgentStatus } from '../base/types';
import { AgentCoordinator } from './AgentCoordinator';
import { CapabilityRegistry, CapabilityLevel } from './CapabilityRegistry';
import { registerPredefinedCapabilities, SkillCapabilities, RoleCapabilities, DomainCapabilities } from './CapabilityDefinitions';
import { BaseManager } from '../base/managers/BaseManager';
import { ManagerType } from '../base/managers/ManagerType';
import { DefaultSchedulerManager } from '../../../lib/agents/implementations/managers/DefaultSchedulerManager';
import { 
  TaskExecutionResult, 
  TaskCreationOptions, 
  TaskCreationResult, 
  ScheduledTask 
} from '../base/managers/SchedulerManager.interface';
import {
  Tool,
  ToolExecutionResult,
  ToolUsageMetrics
} from '../base/managers/ToolManager.interface';
import {
  KnowledgeManager,
  KnowledgeEntry,
  KnowledgeSearchOptions,
  KnowledgeSearchResult,
  KnowledgeGap
} from '../base/managers/KnowledgeManager.interface';
import {
  PlanningManager,
  PlanCreationOptions,
  PlanCreationResult,
  Plan,
  PlanExecutionResult
} from '../base/managers/PlanningManager.interface';
import { createAgentId, StructuredId } from '../../../utils/ulid';
import { MemoryManager } from '../base/managers/MemoryManager.interface';
import { ToolManager } from '../base/managers/ToolManager.interface';
import { SchedulerManager } from '../base/managers/SchedulerManager.interface';
import { AgentMemoryEntity } from '../../../server/memory/schema/agent';
import { ManagerHealth } from '../base/managers/ManagerHealth';
import { MemoryEntry, MemoryConsolidationResult, MemoryPruningResult } from '../base/managers/MemoryManager.interface';
import { AgentStatus as ServerAgentStatus, AgentCapability } from '../../../server/memory/schema/agent';
import { ReflectionManager } from '../base/managers/ReflectionManager.interface';
import { 
  AgentResponse, 
  MessageProcessingOptions, 
  ThinkOptions, 
  GetLLMResponseOptions 
} from '../base/AgentBase.interface';
import { ThinkingResult } from '../../../services/thinking/types';

/**
 * Example agent implementation with specialized capabilities
 */
class SpecializedAgent implements AgentBase {
  private readonly _config: AgentMemoryEntity;
  private enabled: boolean = true;
  private managers: Map<ManagerType, BaseManager> = new Map();
  private capabilities: Map<string, AgentCapability> = new Map();

  constructor(
    id: string, 
    capabilities: Record<string, CapabilityLevel>,
    domains: string[] = [],
    roles: string[] = []
  ) {
    const agentId = createAgentId().toString();
    this._config = {
      id: agentId,
      name: `${id.charAt(0).toUpperCase()}${id.slice(1)}`,
      description: `Specialized agent for ${roles.join(', ')}`,
      capabilities: [
        ...Object.entries(capabilities).map(([id, level]) => ({
          id,
          name: id.split('.').pop() || id,
          description: `${level} level ${id} capability`,
          version: '1.0.0',
          parameters: { level }
        })),
        ...domains.map(domain => ({
          id: domain,
          name: domain.split('.').pop() || domain,
          description: `Domain expertise in ${domain}`,
          version: '1.0.0',
          parameters: { level: CapabilityLevel.INTERMEDIATE }
        })),
        ...roles.map(role => ({
          id: role,
          name: role.split('.').pop() || role,
          description: `Role capability for ${role}`,
          version: '1.0.0',
          parameters: { level: CapabilityLevel.INTERMEDIATE }
        }))
      ],
      parameters: {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2048,
        tools: []
      },
      status: ServerAgentStatus.AVAILABLE,
      lastActive: new Date(),
      chatIds: [],
      teamIds: [],
      metadata: {
        tags: [],
        domain: domains,
        specialization: roles,
        performanceMetrics: {
          successRate: 0,
          averageResponseTime: 0,
          taskCompletionRate: 0
        },
        version: '1.0.0',
        isPublic: false
      },
      content: '',
      type: 'agent',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
      schemaVersion: '1.0.0'
    };
  }

  getId(): string {
    return this.getAgentId();
  }

  getAgentId(): string {
    return this._config.id;
  }

  getType(): string {
    return 'specialized';
  }

  getName(): string {
    return this._config.name;
  }

  getDescription(): string {
    return this._config.description;
  }

  getVersion(): string {
    return this._config.metadata.version;
  }

  async getCapabilities(): Promise<string[]> {
    return Array.from(this.capabilities.keys());
  }

  getStatus(): { status: string; message?: string } {
    return {
      status: String(this._config.status),
      message: `Agent ${this.getName()} is ${this._config.status}`
    };
  }

  async initialize(): Promise<boolean> {
    await this.initializeManagers();
    return true;
  }

  async shutdown(): Promise<void> {
    await this.shutdownManagers();
  }

  async reset(): Promise<void> {
    await this.shutdownManagers();
    await this.initializeManagers();
  }

  async registerTool(tool: Tool): Promise<Tool> {
    const toolManager = this.getManager<ToolManager>(ManagerType.TOOL);
    if (!toolManager) {
      throw new Error('Tool manager not available');
    }
    return toolManager.registerTool(tool);
  }

  async unregisterTool(toolId: string): Promise<boolean> {
    const toolManager = this.getManager<ToolManager>(ManagerType.TOOL);
    if (!toolManager) {
      throw new Error('Tool manager not available');
    }
    return toolManager.unregisterTool(toolId);
  }

  async getTool(toolId: string): Promise<Tool | null> {
    const toolManager = this.getManager<ToolManager>(ManagerType.TOOL);
    if (!toolManager) {
      return null;
    }
    return toolManager.getTool(toolId);
  }

  async getTools(): Promise<Tool[]> {
    const toolManager = this.getManager<ToolManager>(ManagerType.TOOL);
    if (!toolManager) {
      return [];
    }
    return toolManager.getTools();
  }

  async setToolEnabled(toolId: string, enabled: boolean): Promise<Tool> {
    const toolManager = this.getManager<ToolManager>(ManagerType.TOOL);
    if (!toolManager) {
      throw new Error('Tool manager not available');
    }
    return toolManager.setToolEnabled(toolId, enabled);
  }

  getManager<T extends BaseManager>(type: ManagerType): T | null {
    return (this.managers.get(type) as T) || null;
  }

  getManagers(): BaseManager[] {
    return Array.from(this.managers.values());
  }

  setManager<T extends BaseManager>(manager: T): void {
    this.managers.set(manager.managerType, manager);
  }

  removeManager(type: ManagerType): void {
    this.managers.delete(type);
  }

  hasManager(type: ManagerType): boolean {
    return this.managers.has(type);
  }

  async createTask(options: Record<string, unknown>): Promise<TaskCreationResult> {
    const scheduler = this.getSchedulerManager();
    if (!scheduler) {
      throw new Error('Scheduler manager not available');
    }

    // Convert options to TaskCreationOptions
    const taskOptions: TaskCreationOptions = {
      title: String(options.title || 'Untitled Task'),
      description: String(options.description || 'No description provided'),
      type: String(options.type || 'default'),
      priority: typeof options.priority === 'number' ? options.priority : 0.5,
      dependencies: Array.isArray(options.dependencies) ? options.dependencies : undefined,
      metadata: typeof options.metadata === 'object' ? options.metadata as Record<string, unknown> : undefined
    };

    return scheduler.createTask(taskOptions);
  }

  async getTask(taskId: string): Promise<Record<string, unknown> | null> {
    const scheduler = this.getSchedulerManager();
    if (!scheduler) {
      return null;
    }
    const task = await scheduler.getTask(taskId);
    return task ? { ...task } : null;
  }

  async getTasks(): Promise<Record<string, unknown>[]> {
    const scheduler = this.getSchedulerManager();
    if (!scheduler) {
      return [];
    }
    const tasks = await scheduler.getTasks();
    return tasks.map(task => ({ ...task }));
  }

  async executeTask(taskId: string): Promise<TaskExecutionResult> {
    const scheduler = this.getSchedulerManager();
    if (!scheduler) {
      throw new Error('Scheduler manager not available');
    }
    return scheduler.executeTask(taskId);
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const scheduler = this.getSchedulerManager();
    if (!scheduler) {
      throw new Error('Scheduler manager not available');
    }
    return scheduler.cancelTask(taskId);
  }

  async retryTask(taskId: string): Promise<TaskExecutionResult> {
    const scheduler = this.getSchedulerManager();
    if (!scheduler) {
      throw new Error('Scheduler manager not available');
    }
    return scheduler.retryTask(taskId);
  }

  getConfig(): Record<string, unknown> {
    return {
      ...this._config,
      status: this._config.status,
      capabilities: this._config.capabilities
    };
  }

  updateConfig(config: Record<string, unknown>): void {
    Object.assign(this._config, config);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): boolean {
    this.enabled = enabled;
    return enabled;
  }

  hasCapability(capabilityId: string): boolean {
    return this.capabilities.has(capabilityId);
  }

  enableCapability(capability: AgentCapability): void {
    this.capabilities.set(capability.id, capability);
  }

  disableCapability(capabilityId: string): void {
    this.capabilities.delete(capabilityId);
  }

  async getHealth(): Promise<ManagerHealth> {
    const managerHealth: Record<string, {
      status: 'healthy' | 'degraded' | 'unhealthy';
      message?: string;
    }> = {};

    const managerEntries = Array.from(this.managers.entries());
    for (const [type, manager] of managerEntries) {
      const health = await manager.getHealth();
      managerHealth[type] = {
        status: health.status,
        message: health.details.issues.length > 0 ? health.details.issues[0].message : undefined
      };
    }

    const unhealthyManagers = Object.values(managerHealth).filter(h => h.status === 'unhealthy');
    const degradedManagers = Object.values(managerHealth).filter(h => h.status === 'degraded');

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let message = 'All systems operational';

    if (unhealthyManagers.length > 0) {
      status = 'unhealthy';
      message = `${unhealthyManagers.length} managers are unhealthy`;
    } else if (degradedManagers.length > 0) {
      status = 'degraded';
      message = `${degradedManagers.length} managers are degraded`;
    }

    return {
      status,
      details: {
        lastCheck: new Date(),
        issues: unhealthyManagers.length > 0 || degradedManagers.length > 0 ? [{
          severity: unhealthyManagers.length > 0 ? 'high' : 'medium',
          message,
          detectedAt: new Date()
        }] : [],
        metrics: {
          totalManagers: managerEntries.length,
          healthyManagers: managerEntries.length - unhealthyManagers.length - degradedManagers.length,
          degradedManagers: degradedManagers.length,
          unhealthyManagers: unhealthyManagers.length
        }
      }
    };
  }

  getSchedulerManager(): DefaultSchedulerManager | undefined {
    return this.getManager(ManagerType.SCHEDULER) as DefaultSchedulerManager | undefined;
  }

  getToolManager(): ToolManager | undefined {
    return this.getManager(ManagerType.TOOL) as ToolManager | undefined;
  }

  getMemoryManager(): MemoryManager | undefined {
    return this.getManager(ManagerType.MEMORY) as MemoryManager | undefined;
  }

  getReflectionManager(): ReflectionManager | undefined {
    return this.getManager(ManagerType.REFLECTION) as ReflectionManager | undefined;
  }

  getPlanningManager(): PlanningManager | undefined {
    return this.getManager(ManagerType.PLANNING) as PlanningManager | undefined;
  }

  async initializeManagers(): Promise<void> {
    const managers = Array.from(this.managers.values());
    for (const manager of managers) {
      await manager.initialize();
    }
  }

  async shutdownManagers(): Promise<void> {
    const managers = Array.from(this.managers.values());
    for (const manager of managers) {
      await manager.shutdown();
    }
  }

  // Memory Manager delegations
  async addMemory(content: string, metadata: Record<string, unknown>): Promise<MemoryEntry> {
    const memoryManager = this.getManager<MemoryManager>(ManagerType.MEMORY);
    if (!memoryManager) {
      throw new Error('Memory manager not available');
    }
    return memoryManager.addMemory(content, metadata);
  }

  async searchMemories(query: string, options: Record<string, unknown>): Promise<MemoryEntry[]> {
    const memoryManager = this.getManager<MemoryManager>(ManagerType.MEMORY);
    if (!memoryManager) {
      throw new Error('Memory manager not available');
    }
    return memoryManager.searchMemories(query, options);
  }

  async getRecentMemories(limit: number): Promise<MemoryEntry[]> {
    const memoryManager = this.getManager<MemoryManager>(ManagerType.MEMORY);
    if (!memoryManager) {
      throw new Error('Memory manager not available');
    }
    return memoryManager.getRecentMemories(limit);
  }

  async consolidateMemories(): Promise<MemoryConsolidationResult> {
    const memoryManager = this.getManager<MemoryManager>(ManagerType.MEMORY);
    if (!memoryManager) {
      throw new Error('Memory manager not available');
    }
    return memoryManager.consolidateMemories();
  }

  async pruneMemories(): Promise<MemoryPruningResult> {
    const memoryManager = this.getManager<MemoryManager>(ManagerType.MEMORY);
    if (!memoryManager) {
      throw new Error('Memory manager not available');
    }
    return memoryManager.pruneMemories();
  }

  // Planning Manager delegations
  async createPlan(options: PlanCreationOptions): Promise<PlanCreationResult> {
    const planningManager = this.getManager<PlanningManager>(ManagerType.PLANNING);
    if (!planningManager) {
      throw new Error('Planning manager not available');
    }
    return planningManager.createPlan(options);
  }

  async getPlan(planId: string): Promise<Plan | null> {
    const planningManager = this.getManager<PlanningManager>(ManagerType.PLANNING);
    if (!planningManager) {
      return null;
    }
    return planningManager.getPlan(planId);
  }

  async getAllPlans(): Promise<Plan[]> {
    const planningManager = this.getManager<PlanningManager>(ManagerType.PLANNING);
    if (!planningManager) {
      return [];
    }
    return planningManager.getAllPlans();
  }

  async updatePlan(planId: string, updates: Partial<Plan>): Promise<Plan | null> {
    const planningManager = this.getManager<PlanningManager>(ManagerType.PLANNING);
    if (!planningManager) {
      throw new Error('Planning manager not available');
    }
    return planningManager.updatePlan(planId, updates);
  }

  async deletePlan(planId: string): Promise<boolean> {
    const planningManager = this.getManager<PlanningManager>(ManagerType.PLANNING);
    if (!planningManager) {
      throw new Error('Planning manager not available');
    }
    return planningManager.deletePlan(planId);
  }

  async executePlan(planId: string): Promise<PlanExecutionResult> {
    const planningManager = this.getManager<PlanningManager>(ManagerType.PLANNING);
    if (!planningManager) {
      throw new Error('Planning manager not available');
    }
    return planningManager.executePlan(planId);
  }

  async adaptPlan(planId: string, reason: string): Promise<Plan | null> {
    const planningManager = this.getManager<PlanningManager>(ManagerType.PLANNING);
    if (!planningManager) {
      throw new Error('Planning manager not available');
    }
    return planningManager.adaptPlan(planId, reason);
  }

  async validatePlan(planId: string): Promise<boolean> {
    const planningManager = this.getManager<PlanningManager>(ManagerType.PLANNING);
    if (!planningManager) {
      throw new Error('Planning manager not available');
    }
    return planningManager.validatePlan(planId);
  }

  async optimizePlan(planId: string): Promise<Plan | null> {
    const planningManager = this.getManager<PlanningManager>(ManagerType.PLANNING);
    if (!planningManager) {
      throw new Error('Planning manager not available');
    }
    return planningManager.optimizePlan(planId);
  }

  // Knowledge Manager delegations
  async loadKnowledge(): Promise<void> {
    const knowledgeManager = this.getManager<KnowledgeManager>(ManagerType.KNOWLEDGE);
    if (!knowledgeManager) {
      throw new Error('Knowledge manager not available');
    }
    return knowledgeManager.loadKnowledge();
  }

  async searchKnowledge(query: string, options?: KnowledgeSearchOptions): Promise<KnowledgeSearchResult[]> {
    const knowledgeManager = this.getManager<KnowledgeManager>(ManagerType.KNOWLEDGE);
    if (!knowledgeManager) {
      throw new Error('Knowledge manager not available');
    }
    return knowledgeManager.searchKnowledge(query, options);
  }

  async addKnowledgeEntry(entry: Omit<KnowledgeEntry, 'id' | 'timestamp'>): Promise<KnowledgeEntry> {
    const knowledgeManager = this.getManager<KnowledgeManager>(ManagerType.KNOWLEDGE);
    if (!knowledgeManager) {
      throw new Error('Knowledge manager not available');
    }
    return knowledgeManager.addKnowledgeEntry(entry);
  }

  async getKnowledgeEntry(id: string): Promise<KnowledgeEntry | null> {
    const knowledgeManager = this.getManager<KnowledgeManager>(ManagerType.KNOWLEDGE);
    if (!knowledgeManager) {
      return null;
    }
    return knowledgeManager.getKnowledgeEntry(id);
  }

  async updateKnowledgeEntry(id: string, updates: Partial<KnowledgeEntry>): Promise<KnowledgeEntry> {
    const knowledgeManager = this.getManager<KnowledgeManager>(ManagerType.KNOWLEDGE);
    if (!knowledgeManager) {
      throw new Error('Knowledge manager not available');
    }
    return knowledgeManager.updateKnowledgeEntry(id, updates);
  }

  async deleteKnowledgeEntry(id: string): Promise<boolean> {
    const knowledgeManager = this.getManager<KnowledgeManager>(ManagerType.KNOWLEDGE);
    if (!knowledgeManager) {
      throw new Error('Knowledge manager not available');
    }
    return knowledgeManager.deleteKnowledgeEntry(id);
  }

  async getKnowledgeEntries(options?: {
    category?: string;
    tags?: string[];
    source?: string;
    verified?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<KnowledgeEntry[]> {
    const knowledgeManager = this.getManager<KnowledgeManager>(ManagerType.KNOWLEDGE);
    if (!knowledgeManager) {
      return [];
    }
    return knowledgeManager.getKnowledgeEntries(options);
  }

  async identifyKnowledgeGaps(): Promise<KnowledgeGap[]> {
    const knowledgeManager = this.getManager<KnowledgeManager>(ManagerType.KNOWLEDGE);
    if (!knowledgeManager) {
      return [];
    }
    return knowledgeManager.identifyKnowledgeGaps();
  }

  async getKnowledgeGap(id: string): Promise<KnowledgeGap | null> {
    const knowledgeManager = this.getManager<KnowledgeManager>(ManagerType.KNOWLEDGE);
    if (!knowledgeManager) {
      return null;
    }
    return knowledgeManager.getKnowledgeGap(id);
  }

  // Scheduler Manager delegations
  async getAllTasks(): Promise<ScheduledTask[]> {
    const schedulerManager = this.getSchedulerManager();
    if (!schedulerManager) {
      return [];
    }
    return schedulerManager.getAllTasks();
  }

  async updateTask(taskId: string, updates: Partial<ScheduledTask>): Promise<ScheduledTask | null> {
    const schedulerManager = this.getSchedulerManager();
    if (!schedulerManager) {
      throw new Error('Scheduler manager not available');
    }
    return schedulerManager.updateTask(taskId, updates);
  }

  async deleteTask(taskId: string): Promise<boolean> {
    const schedulerManager = this.getSchedulerManager();
    if (!schedulerManager) {
      throw new Error('Scheduler manager not available');
    }
    return schedulerManager.deleteTask(taskId);
  }

  async getDueTasks(): Promise<ScheduledTask[]> {
    const schedulerManager = this.getSchedulerManager();
    if (!schedulerManager) {
      return [];
    }
    return schedulerManager.getDueTasks();
  }

  async getRunningTasks(): Promise<ScheduledTask[]> {
    const schedulerManager = this.getSchedulerManager();
    if (!schedulerManager) {
      return [];
    }
    return schedulerManager.getRunningTasks();
  }

  async getPendingTasks(): Promise<ScheduledTask[]> {
    const schedulerManager = this.getSchedulerManager();
    if (!schedulerManager) {
      return [];
    }
    return schedulerManager.getPendingTasks();
  }

  async getFailedTasks(): Promise<ScheduledTask[]> {
    const scheduler = this.getSchedulerManager();
    if (!scheduler) {
      return [];
    }
    return scheduler.getFailedTasks();
  }

  /**
   * Process user input with thinking and LLM response
   * @param message User input message
   * @param options Processing options
   * @returns Agent response with content and possible metadata
   */
  async processUserInput(message: string, options?: MessageProcessingOptions): Promise<AgentResponse> {
    // Simplified implementation for demo purposes
    const thinkingResult = await this.think(message, options);
    const response = await this.getLLMResponse(message, {
      ...options,
      thinkingResult
    });
    
    return {
      content: response.content,
      thoughts: thinkingResult.reasoning || [],
      metadata: {
        intent: thinkingResult.intent,
        entities: thinkingResult.entities,
        requestId: options?.requestId || 'demo-request'
      }
    };
  }
  
  /**
   * Perform thinking analysis on user input
   * @param message User input message
   * @param options Thinking options
   * @returns Thinking analysis result
   */
  async think(message: string, options?: ThinkOptions): Promise<ThinkingResult> {
    // Simplified implementation for demo purposes
    return {
      intent: { primary: 'query', confidence: 0.9 },
      entities: [],
      reasoning: [`Analyzing input: ${message}`],
      complexity: 2,
      priority: 3,
      context: {},
      shouldDelegate: false,
      requiredCapabilities: [],
      isUrgent: false,
      contextUsed: {
        memories: [],
        files: [],
        tools: []
      }
    };
  }
  
  /**
   * Get LLM response based on user input and thinking results
   * @param message User input message
   * @param options LLM response options including thinking results
   * @returns Agent response with content and possible metadata
   */
  async getLLMResponse(message: string, options?: GetLLMResponseOptions): Promise<AgentResponse> {
    // Simplified implementation for demo purposes
    return {
      content: `Response to: ${message}`,
      thoughts: options?.thinkingResult?.reasoning || [],
      metadata: {
        source: 'demo-specialized-agent',
        processingTime: 100
      }
    };
  }

  // Tool Manager delegations
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
    if (!toolManager) {
      throw new Error('Tool manager not available');
    }
    return toolManager.executeTool(toolId, params, options);
  }

  async getToolMetrics(toolId?: string): Promise<ToolUsageMetrics[]> {
    const toolManager = this.getManager<ToolManager>(ManagerType.TOOL);
    if (!toolManager) {
      return [];
    }
    return toolManager.getToolMetrics(toolId);
  }

  async findBestToolForTask(taskDescription: string, context?: unknown): Promise<Tool | null> {
    const toolManager = this.getManager<ToolManager>(ManagerType.TOOL);
    if (!toolManager) {
      return null;
    }
    return toolManager.findBestToolForTask(taskDescription, context);
  }

  // Demo implementation
  async planAndExecute(goal: string, options?: Record<string, unknown>): Promise<TaskExecutionResult> {
    console.log(`[${this.getAgentId()}] Executing goal: ${goal}`);
    
    return {
      success: true,
      taskId: 'demo-task',
      durationMs: 0
    };
  }
}

/**
 * Demo function to run a capability-based agent system
 */
export async function runCapabilityDemo() {
  console.log('Starting capability system demo...');
  
  // 1. Initialize the capability registry with predefined capabilities
  const registry = CapabilityRegistry.getInstance();
  registerPredefinedCapabilities(registry);
  
  // 2. Create an agent coordinator with capability matching enabled
  const coordinator = new AgentCoordinator({
    enableCapabilityMatching: true,
    enableLoadBalancing: true
  });
  
  await coordinator.initialize();
  
  // 3. Create specialized agents with different capabilities
  
  // Research agent with research and text analysis capabilities
  const researchAgent = new SpecializedAgent(
    'researchAgent',
    {
      'skill.research': CapabilityLevel.EXPERT,
      'skill.text_analysis': CapabilityLevel.ADVANCED,
      'skill.data_analysis': CapabilityLevel.INTERMEDIATE
    },
    ['domain.general', 'domain.science'],
    ['role.researcher']
  );
  
  // Developer agent with code-related capabilities
  const developerAgent = new SpecializedAgent(
    'developerAgent',
    {
      'skill.code_generation': CapabilityLevel.EXPERT,
      'skill.code_review': CapabilityLevel.ADVANCED,
      'skill.planning': CapabilityLevel.INTERMEDIATE
    },
    ['domain.software'],
    ['role.developer']
  );
  
  // Coordinator agent with coordination capabilities
  const coordinatorAgent = new SpecializedAgent(
    'coordinatorAgent',
    {
      'skill.coordination': CapabilityLevel.EXPERT,
      'skill.decision_making': CapabilityLevel.ADVANCED,
      'skill.planning': CapabilityLevel.ADVANCED
    },
    ['domain.general', 'domain.business'],
    ['role.coordinator', 'role.planner']
  );
  
  // Creative agent with creative capabilities
  const creativeAgent = new SpecializedAgent(
    'creativeAgent',
    {
      'skill.creativity': CapabilityLevel.EXPERT,
      'skill.text_analysis': CapabilityLevel.INTERMEDIATE
    },
    ['domain.general'],
    ['role.creative']
  );
  
  // 4. Initialize all agents
  await researchAgent.initialize();
  await developerAgent.initialize();
  await coordinatorAgent.initialize();
  await creativeAgent.initialize();
  
  // 5. Register agents with the coordinator
  coordinator.registerAgent(
    researchAgent, 
    ['research', 'information_retrieval', 'data_analysis'], 
    'research'
  );
  
  coordinator.registerAgent(
    developerAgent, 
    ['code_generation', 'code_review', 'debugging'], 
    'development'
  );
  
  coordinator.registerAgent(
    coordinatorAgent, 
    ['coordination', 'planning', 'delegation'], 
    'management'
  );
  
  coordinator.registerAgent(
    creativeAgent, 
    ['creative_writing', 'idea_generation', 'content_creation'], 
    'content'
  );
  
  // 6. Demo capability-based delegation
  
  // Example 1: Delegate a research task
  console.log('\n=== Example 1: Research Task ===');
  const researchResult = await coordinator.delegateTask({
    taskId: 'task-research-1',
    goal: 'Research the impact of AI on healthcare',
    requiredCapabilities: ['skill.research'],
    preferredDomain: 'domain.healthcare',
    requestingAgentId: 'user'
  });
  
  console.log(`Task delegated to: ${researchResult.agentId}`);
  console.log(`Task status: ${researchResult.status}`);
  
  // Example 2: Delegate a code generation task
  console.log('\n=== Example 2: Code Generation Task ===');
  const codeResult = await coordinator.delegateTask({
    taskId: 'task-code-1',
    goal: 'Generate a React component for a login form',
    requiredCapabilities: ['skill.code_generation'],
    requiredCapabilityLevels: {
      'skill.code_generation': CapabilityLevel.EXPERT
    },
    preferredDomain: 'domain.software',
    requestingAgentId: 'user'
  });
  
  console.log(`Task delegated to: ${codeResult.agentId}`);
  console.log(`Task status: ${codeResult.status}`);
  
  // Example 3: Delegate a task with multiple capability requirements
  console.log('\n=== Example 3: Multi-capability Task ===');
  const complexResult = await coordinator.delegateTask({
    taskId: 'task-complex-1',
    goal: 'Analyze user feedback data and create a report',
    requiredCapabilities: ['skill.data_analysis', 'skill.text_analysis'],
    preferredCapabilities: ['skill.research'],
    requestingAgentId: 'user'
  });
  
  console.log(`Task delegated to: ${complexResult.agentId}`);
  console.log(`Task status: ${complexResult.status}`);
  
  // Example 4: Delegate to unavailable agent (should find fallback)
  console.log('\n=== Example 4: Fallback Routing ===');
  
  // Manually mark the research agent as busy
  const researchEntry = (coordinator as any).agents.get('researchAgent');
  if (researchEntry) {
    researchEntry.status = 'busy';
  }
  
  // Try to delegate a research task (should go to fallback agent)
  const fallbackResult = await coordinator.delegateTask({
    taskId: 'task-research-2',
    goal: 'Research emerging trends in quantum computing',
    requiredCapabilities: ['skill.research'],
    preferredDomain: 'domain.technology',
    requestingAgentId: 'user'
  });
  
  console.log(`Task delegated to: ${fallbackResult.agentId}`);
  console.log(`Task status: ${fallbackResult.status}`);
  
  // 7. Demo capability discovery
  
  console.log('\n=== Capability Discovery ===');
  
  // Find agents with research capability
  const researchAgents = coordinator.getAgentsWithCapability('skill.research');
  console.log(`Agents with research capability: ${researchAgents.join(', ')}`);
  
  // Get all registered capabilities
  const allCapabilities = coordinator.getAllCapabilities();
  console.log(`Total registered capabilities: ${allCapabilities.length}`);
  
  // Get capabilities for an agent
  const developerCapabilities = coordinator.getAgentCapabilities('developerAgent');
  console.log(`Developer agent capabilities: ${Object.keys(developerCapabilities).join(', ')}`);
  
  // 8. Clean up
  await researchAgent.shutdown();
  await developerAgent.shutdown();
  await coordinatorAgent.shutdown();
  await creativeAgent.shutdown();
  await coordinator.shutdown();
  
  console.log('\nCapability system demo completed');
}

// Run the demo if executed directly
if (require.main === module) {
  runCapabilityDemo().catch(console.error);
} 