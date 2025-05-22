import type { AgentStatus, AgentBaseConfig, AgentCapability } from './types';
import type { ModularSchedulerManager } from '../../../lib/scheduler/implementations/ModularSchedulerManager';
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
  TaskCreationOptions,
  TaskCreationResult,
  TaskExecutionResult
} from './managers/SchedulerManager.interface';
import type { Task } from '../../../lib/scheduler/models/Task.model';
import { ManagerType } from './managers/ManagerType';

// Import ThinkingService related types
import type { ThinkingResult, ThinkingOptions } from '../../../services/thinking/types';

// Define agent response type
export interface AgentResponse {
  content: string;
  memories?: string[];
  thoughts?: string[];
  metadata?: Record<string, unknown>;
}

// Define message processing options
export interface MessageProcessingOptions {
  attachments?: Array<{
    filename: string;
    type: string;
    size?: number;
    mimeType?: string;
    fileId?: string;
    preview?: string;
    has_full_preview?: boolean;
    is_image_for_vision?: boolean;
  }>;
  userId?: string;
  userMessageId?: string;
  skipResponseMemoryStorage?: boolean;
  internal?: boolean;
  thinking?: boolean;
  isThinking?: boolean;
  contextThoughts?: string[];
  formattedMemoryContext?: string;
  thinkingResults?: Partial<ThinkingResult>;
  originalMessage?: string;
  persona?: Record<string, unknown>;
  processingInstructions?: string[];
  useVisionModel?: boolean;
  requestId?: string;
  chatId?: string;
  messageId?: string;
  enableVisualization?: boolean;
  visualizationOptions?: {
    storeVisualization?: boolean;
    trackMemoryOperations?: boolean;
    trackToolExecution?: boolean;
    trackThinking?: boolean;
  };
  [key: string]: unknown;
}

// Define think options
export interface ThinkOptions extends MessageProcessingOptions {
  debug?: boolean;
}

// Define LLM response options
export interface GetLLMResponseOptions extends MessageProcessingOptions {
  thinkingResult?: ThinkingResult;
}

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
  createTask(options: TaskCreationOptions): Promise<TaskCreationResult>;
  getTask(taskId: string): Promise<Task | null>;
  getTasks(): Promise<Task[]>;
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
  getSchedulerManager(): ModularSchedulerManager | undefined;
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
  getAllTasks(): Promise<Task[]>;
  updateTask(taskId: string, updates: Partial<Task>): Promise<string>;
  deleteTask(taskId: string): Promise<boolean>;
  getDueTasks(): Promise<Task[]>;
  getRunningTasks(): Promise<Task[]>;
  getPendingTasks(): Promise<Task[]>;
  getFailedTasks(): Promise<Task[]>;

  // New agent message processing methods
  /**
   * Process user input with thinking and LLM response
   * @param message User input message
   * @param options Processing options
   * @returns Agent response with content and possible metadata
   */
  processUserInput(message: string, options?: MessageProcessingOptions): Promise<AgentResponse>;
  
  /**
   * Perform thinking analysis on user input
   * @param message User input message
   * @param options Thinking options
   * @returns Thinking analysis result
   */
  think(message: string, options?: ThinkOptions): Promise<ThinkingResult>;
  
  /**
   * Get LLM response based on user input and thinking results
   * @param message User input message
   * @param options LLM response options including thinking results
   * @returns Agent response with content and possible metadata
   */
  getLLMResponse(message: string, options?: GetLLMResponseOptions): Promise<AgentResponse>;
} 