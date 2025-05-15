import type { AgentStatus, AgentBaseConfig, AgentCapability } from './types';
import type { DefaultSchedulerManager } from '../../../lib/agents/implementations/managers/DefaultSchedulerManager';
import type { ManagersConfig } from './ManagersConfig.interface';
import type { BaseManager } from './managers/BaseManager';
import type { 
  MemoryManager, 
  MemoryEntry,
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

export interface AgentBase {
  getId(): string;
  getAgentId(): string;
  getType(): string;
  getName(): string;
  getDescription(): string;
  getVersion(): string;
  getCapabilities(): Promise<string[]>;
  getStatus(): { status: string; message?: string };
  initialize(): Promise<boolean>;
  shutdown(): Promise<void>;
  reset(): Promise<void>;
  registerTool(tool: Tool): Promise<Tool>;
  unregisterTool(toolId: string): Promise<boolean>;
  getTool(toolId: string): Promise<Tool | null>;
  getTools(): Promise<Tool[]>;
  setToolEnabled(toolId: string, enabled: boolean): Promise<Tool>;
  getManager<T extends BaseManager>(type: ManagerType): T | null;
  getManagers(): BaseManager[];
  setManager<T extends BaseManager>(manager: T): void;
  removeManager(type: ManagerType): void;
  hasManager(type: ManagerType): boolean;
  createTask(options: Record<string, unknown>): Promise<TaskCreationResult>;
  getTask(taskId: string): Promise<Record<string, unknown> | null>;
  getTasks(): Promise<Record<string, unknown>[]>;
  executeTask(taskId: string): Promise<TaskExecutionResult>;
  cancelTask(taskId: string): Promise<boolean>;
  retryTask(taskId: string): Promise<TaskExecutionResult>;
  getConfig(): Record<string, unknown>;
  updateConfig(config: Record<string, unknown>): void;
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
  addMemory(content: string, metadata: Record<string, unknown>): Promise<MemoryEntry>;
  searchMemories(query: string, options: Record<string, unknown>): Promise<MemoryEntry[]>;
  getRecentMemories(limit: number): Promise<MemoryEntry[]>;
  consolidateMemories(): Promise<MemoryConsolidationResult>;
  pruneMemories(): Promise<MemoryPruningResult>;
  
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
  getAllTasks(): Promise<ScheduledTask[]>;
  updateTask(taskId: string, updates: Partial<ScheduledTask>): Promise<ScheduledTask | null>;
  deleteTask(taskId: string): Promise<boolean>;
  getDueTasks(): Promise<ScheduledTask[]>;
  getRunningTasks(): Promise<ScheduledTask[]>;
  getPendingTasks(): Promise<ScheduledTask[]>;
  getFailedTasks(): Promise<ScheduledTask[]>;
} 