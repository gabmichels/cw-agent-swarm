import type { AgentStatus, AgentBaseConfig, AgentCapability } from './types';
import type { DefaultSchedulerManager } from '../../../lib/agents/implementations/managers/DefaultSchedulerManager';
import type { ManagersConfig } from './ManagersConfig.interface';
import type { BaseManager } from './managers/BaseManager';
import type { MemoryManager } from './managers/MemoryManager';
import type { PlanningManager, PlanCreationOptions, PlanCreationResult, Plan, PlanExecutionResult } from '../../../lib/agents/base/managers/PlanningManager';
import type { 
  ToolManager, 
  Tool, 
  ToolExecutionResult, 
  ToolUsageMetrics,
  ToolFallbackRule
} from '../../../lib/agents/base/managers/ToolManager';
import type {
  KnowledgeManager,
  KnowledgeEntry,
  KnowledgeSearchResult,
  KnowledgeSearchOptions,
  KnowledgeGap
} from '../../../lib/agents/base/managers/KnowledgeManager';
import type {
  SchedulerManager,
  ScheduledTask,
  TaskCreationOptions,
  TaskCreationResult,
  TaskExecutionResult
} from '../../../lib/agents/base/managers/SchedulerManager';

export interface AgentBase {
  getAgentId(): string;
  getName(): string;
  getConfig(): AgentBaseConfig;
  updateConfig(config: Partial<AgentBaseConfig>): void;
  initialize(): Promise<boolean>;
  shutdown(): Promise<void>;
  registerManager<T extends BaseManager>(manager: T): T;
  getManager<T extends BaseManager>(managerType: string): T | undefined;
  getManagers(): BaseManager[];
  isEnabled(): boolean;
  setEnabled(enabled: boolean): boolean;
  hasCapability(capabilityId: string): boolean;
  enableCapability(capability: AgentCapability): void;
  disableCapability(capabilityId: string): void;
  getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    managerHealth?: Record<string, {
      status: 'healthy' | 'degraded' | 'unhealthy';
      message?: string;
    }>;
  }>;
  getSchedulerManager(): DefaultSchedulerManager | undefined;
  initializeManagers(): Promise<void>;
  shutdownManagers(): Promise<void>;
  
  // Memory Manager delegations
  addMemory(content: string, metadata: Record<string, unknown>): Promise<unknown>;
  searchMemories(query: string, options: Record<string, unknown>): Promise<unknown[]>;
  getRecentMemories(limit: number): Promise<unknown[]>;
  consolidateMemories(): Promise<void>;
  pruneMemories(): Promise<void>;
  
  // Planning Manager delegations
  createPlan(options: PlanCreationOptions): Promise<PlanCreationResult>;
  getPlan(planId: string): Promise<Plan | null>;
  getAllPlans(): Promise<Plan[]>;
  updatePlan(planId: string, updates: Partial<Plan>): Promise<Plan | null>;
  deletePlan(planId: string): Promise<boolean>;
  executePlan(planId: string): Promise<PlanExecutionResult>;
  adaptPlan(planId: string, reason: string): Promise<Plan | null>;
  validatePlan(planId: string): Promise<boolean>;
  optimizePlan(planId: string): Promise<Plan | null>;

  // Tool Manager delegations
  registerTool(tool: Tool): Promise<Tool>;
  unregisterTool(toolId: string): Promise<boolean>;
  getTool(toolId: string): Promise<Tool | null>;
  getTools(filter?: {
    enabled?: boolean;
    categories?: string[];
    capabilities?: string[];
    experimental?: boolean;
  }): Promise<Tool[]>;
  setToolEnabled(toolId: string, enabled: boolean): Promise<Tool>;
  executeTool(
    toolId: string,
    params: unknown,
    options?: {
      context?: unknown;
      timeoutMs?: number;
      retries?: number;
      useFallbacks?: boolean;
    }
  ): Promise<ToolExecutionResult>;
  getToolMetrics(toolId?: string): Promise<ToolUsageMetrics[]>;
  findBestToolForTask(taskDescription: string, context?: unknown): Promise<Tool | null>;
  
  // Knowledge Manager delegations
  loadKnowledge(): Promise<void>;
  searchKnowledge(query: string, options?: KnowledgeSearchOptions): Promise<KnowledgeSearchResult[]>;
  addKnowledgeEntry(entry: Omit<KnowledgeEntry, 'id' | 'timestamp'>): Promise<KnowledgeEntry>;
  getKnowledgeEntry(id: string): Promise<KnowledgeEntry | null>;
  updateKnowledgeEntry(id: string, updates: Partial<KnowledgeEntry>): Promise<KnowledgeEntry>;
  deleteKnowledgeEntry(id: string): Promise<boolean>;
  getKnowledgeEntries(options?: {
    category?: string;
    tags?: string[];
    source?: string;
    verified?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<KnowledgeEntry[]>;
  identifyKnowledgeGaps(): Promise<KnowledgeGap[]>;
  getKnowledgeGap(id: string): Promise<KnowledgeGap | null>;
  
  // Scheduler Manager delegations
  createTask(options: TaskCreationOptions): Promise<TaskCreationResult>;
  getTask(taskId: string): Promise<ScheduledTask | null>;
  getAllTasks(): Promise<ScheduledTask[]>;
  updateTask(taskId: string, updates: Partial<ScheduledTask>): Promise<ScheduledTask | null>;
  deleteTask(taskId: string): Promise<boolean>;
  executeTask(taskId: string): Promise<TaskExecutionResult>;
  cancelTask(taskId: string): Promise<boolean>;
  getDueTasks(): Promise<ScheduledTask[]>;
  getRunningTasks(): Promise<ScheduledTask[]>;
  getPendingTasks(): Promise<ScheduledTask[]>;
  getFailedTasks(): Promise<ScheduledTask[]>;
  retryTask(taskId: string): Promise<TaskExecutionResult>;
} 