/**
 * Comprehensive type definitions for the Chloe agent system
 */
import { MemoryManager } from '../../../agents/shared/base/managers/MemoryManager.interface';
import { KnowledgeManager } from '../../../agents/shared/base/managers/KnowledgeManager.interface';
import { PlanningManager } from '../../../agents/shared/base/managers/PlanningManager.interface';
import { ToolManager } from '../../../agents/shared/base/managers/ToolManager.interface';
import { ReflectionManager } from '../../../agents/shared/base/managers/ReflectionManager.interface';
import { SchedulerManager } from '../../../agents/shared/base/managers/SchedulerManager.interface';
import { InputProcessor } from '../../../agents/shared/base/managers/InputProcessor.interface';
import { OutputProcessor } from '../../../agents/shared/base/managers/OutputProcessor.interface';
import { AutonomyManager } from '../../../agents/shared/base/managers/AutonomyManager.interface';
import { MemoryType } from '../../../server/memory/config/types';
import { ImportanceLevel } from '../../../constants/memory';
import { MessageRole } from '../../../agents/shared/types/MessageTypes';
import { TaskStatus } from '../../../constants/task';

import { AgentMemory } from '../../../agents/shared/memory/AgentMemory.interface';
import { TaskLogger } from '../../../agents/shared/logging/TaskLogger.interface';
import { Notifier } from '../../../agents/shared/notifications/Notifier.interface';

// ============= CORE INTERFACES =============

/**
 * Core agent interface that all agent implementations must follow
 */
export interface IAgent {
  // Core properties
  readonly agentId: string;
  readonly initialized: boolean;
  
  // Core methods
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  isInitialized(): boolean;
  
  // Message processing
  processMessage(message: string, options?: MessageOptions): Promise<string>;
  
  // Memory management
  getMemoryManager(): MemoryManager | null;
  
  // Tool management
  getToolManager(): ToolManager | null;
  
  // Planning and execution
  getPlanningManager(): PlanningManager | null;
  planAndExecute(goal: string, options?: PlanAndExecuteOptions): Promise<PlanAndExecuteResult>;
  
  // Reflection and learning
  getReflectionManager(): ReflectionManager | null;
  reflect(prompt: string): Promise<string>;
  
  // Autonomy
  getAutonomySystem(): Promise<AutonomySystem | null>;
  runDailyTasks(): Promise<void>;
  runWeeklyReflection(): Promise<string>;
  
  // Notifications
  getNotifiers(): Array<{ notify(message: string, type: string): Promise<void> }>;
  addNotifier(notifier: { notify(message: string, type: string): Promise<void> }): void;
  removeNotifier(notifierId: string): void;
  notify(message: string): void;

  // Memory consolidation
  summarizeConversation(options?: { maxEntries?: number; maxLength?: number }): Promise<string | null>;

  // Knowledge gaps
  getKnowledgeGapsManager(): KnowledgeGapsManager | null;
}

/**
 * Base interface for all manager components
 */
export interface IManager {
  /**
   * Initialize the manager with necessary resources
   */
  initialize(): Promise<void>;
  
  /**
   * Check if the manager has been initialized
   */
  isInitialized(): boolean;

  /**
   * Get the ID of the agent this manager belongs to
   */
  getAgentId(): string;
  
  /**
   * Shutdown the manager and cleanup resources
   */
  shutdown?(): Promise<void>;
  
  /**
   * Log an event or action taken by the manager
   */
  logAction?(action: string, metadata?: Record<string, unknown>): void;
}

/**
 * Options for processing messages
 */
export interface MessageOptions {
  userId: string;
  attachments?: Array<{
    type: string;
    url?: string;
    data?: Buffer | string;
    filename?: string;
    contentType?: string;
  }>;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

// ============= MANAGER OPTIONS INTERFACES =============

/**
 * Base options for all managers
 */
export interface BaseManagerOptions {
  agentId: string;
}

/**
 * Options for initializing the memory manager
 */
export interface MemoryManagerOptions extends BaseManagerOptions {
  namespace?: string;
  workingMemoryCapacity?: number;
  consolidationInterval?: number;
  useOpenAI?: boolean;
  logger?: { logTask(task: string, status: string, details?: Record<string, unknown>): Promise<void> };
}

/**
 * Options for initializing the tool manager
 */
export interface ToolManagerOptions extends BaseManagerOptions {
  logger?: { logTask(task: string, status: string, details?: Record<string, unknown>): Promise<void> };
  model: any;
  memory: any;
}

/**
 * Options for initializing the planning manager
 */
export interface PlanningManagerOptions extends BaseManagerOptions {
  memory: any;
  model: any;
  taskLogger: { logTask(task: string, status: string, details?: Record<string, unknown>): Promise<void> };
  autonomySystem?: AutonomySystem;
  notifyFunction?: NotifyFunction;
}

/**
 * Options for initializing the reflection manager
 */
export interface ReflectionManagerOptions extends BaseManagerOptions {
  memory: any;
  model: any;
  taskLogger: { logTask(task: string, status: string, details?: Record<string, unknown>): Promise<void> };
  notifyFunction?: NotifyFunction;
}

/**
 * Options for initializing the thought manager
 */
export interface ThoughtManagerOptions extends BaseManagerOptions {
  memory: any;
  model: any;
  taskLogger: { logTask(task: string, status: string, details?: Record<string, unknown>): Promise<void> };
}

/**
 * Options for initializing the market scanner manager
 */
export interface MarketScannerManagerOptions extends BaseManagerOptions {
  memory: any;
  model: any;
  taskLogger: { logTask(task: string, status: string, details?: Record<string, unknown>): Promise<void> };
  notifyFunction?: NotifyFunction;
}

/**
 * Options for initializing the knowledge gaps manager
 */
export interface KnowledgeGapsManagerOptions extends BaseManagerOptions {
  memory: any;
  openaiApiKey: string;
  logger: { logTask(task: string, status: string, details?: Record<string, unknown>): Promise<void> };
  notifyFunction: NotifyFunction;
}

// ============= MEMORY TYPES =============

/**
 * Memory search options
 */
export interface MemorySearchOptions {
  limit?: number;
  offset?: number;
  minScore?: number;
  type?: MemoryType;
  metadata?: Record<string, unknown>;
}

/**
 * Memory statistics
 */
export interface MemoryStats {
  totalMemories: number;
  shortTermMemories: number;
  longTermMemories: number;
  memoryUsageRatio: number;
  averageMemorySize: number;
  consolidationStats: {
    lastConsolidation: Date;
    memoriesConsolidated: number;
  };
  pruningStats: {
    lastPruning: Date;
    memoriesPruned: number;
  };
}

/**
 * Options for configuring the AgentMemory system.
 */
export interface AgentMemoryOptions {
  namespace?: string;
  collectionName?: string;
  useOpenAI?: boolean;
  memoryType?: 'local' | 'chroma' | 'pinecone'; // Example types
  config?: Record<string, any>; // Specific config for memory type
}

/**
 * Base memory entry interface
 */
export interface MemoryEntry {
  id: string;
  content: string;
  type: string;
  importance: ImportanceLevel;
  source: string;
  metadata: Record<string, unknown>;
  created: Date;
  lastAccessed?: Date;
  accessCount?: number;
}

/**
 * Memory entry with tags
 */
export interface TaggedMemory extends MemoryEntry {
  tags: string[];
  metadata: Record<string, unknown> & {
    sentiment?: string;
    entities?: string[];
  };
}

/**
 * Message memory entry
 */
export interface MessageMemory extends MemoryEntry {
  type: 'message';
  metadata: Record<string, unknown> & {
    sender: string;
    recipient: string;
    conversationId?: string;
    attachments?: Array<{
      type: string;
      url?: string;
      data?: Buffer | string;
      filename?: string;
      contentType?: string;
    }>;
  };
}

/**
 * Thought memory entry
 */
export interface ThoughtMemory extends MemoryEntry {
  type: 'thought';
  metadata: Record<string, unknown> & {
    category: string;
    confidence: number;
    relatedThoughts?: string[];
    reasoning?: string;
    assumptions?: string[];
  };
}

/**
 * Strategic insight memory entry
 */
export interface StrategicInsightMemory extends MemoryEntry {
  type: 'strategic_insight';
  metadata: Record<string, unknown> & {
    category: string;
    confidence: number;
    impact: ImportanceLevel;
    relatedInsights?: string[];
    evidence?: string[];
    recommendations?: string[];
  };
}

/**
 * Task memory entry
 */
export interface TaskMemory extends MemoryEntry {
  type: 'task';
  metadata: Record<string, unknown> & {
    status: TaskStatus;
    priority: ImportanceLevel;
    dueDate?: Date;
    assignedTo?: string;
    steps?: string[];
    dependencies?: string[];
  };
}

/**
 * Strategic insight for marketing decisions
 */
export interface StrategicInsight {
  id: string;
  insight: string;
  source: string;
  tags: string[];
  timestamp: string;
  category: string;
  confidence?: number;
  related?: string[];
}

// ============= TOOL TYPES =============

/**
 * Base tool interface
 */
export abstract class BaseTool {
  public name: string;
  public description: string;
  public schema: Record<string, any>;

  constructor(
    name: string,
    description: string,
    schema: Record<string, any> = {}
  ) {
    this.name = name;
    this.description = description;
    this.schema = schema;
  }

  abstract execute(params: Record<string, any>): Promise<any>;
}

/**
 * Simple tool interface that takes string input and returns string output
 */
export interface SimpleTool {
  name: string;
  description: string;
  _call(input: string): Promise<string>;
}

/**
 * Result of tool execution
 */
export interface ToolExecutionResult {
  success: boolean;
  response?: string;
  error?: string;
  data?: unknown;
}

/**
 * Tool metadata interface
 */
export interface ToolMetadata {
  name: string;
  description: string;
  version: string;
  author?: string;
  category: string;
  tags: string[];
  parameters: {
    [key: string]: {
      type: string;
      description: string;
      required: boolean;
      default?: unknown;
      enum?: unknown[];
    };
  };
  returns: {
    type: string;
    description: string;
  };
  examples: Array<{
    input: Record<string, unknown>;
    output: unknown;
    description: string;
  }>;
  metadata?: {
    rateLimit?: number;
    timeout?: number;
    [key: string]: unknown;
  };
}

// ============= PLANNING TYPES =============

/**
 * Plan with steps
 */
export interface PlanWithSteps {
  goal: string;
  steps: PlanStep[];
  reasoning: string;
  estimatedCompletion?: Date;
  retryCount?: number;    // Number of retries for the entire plan
  retryDelayMs?: number;  // Base delay between retries in milliseconds
  timeoutMs?: number;     // Maximum execution time for the entire plan
}

/**
 * Individual step in a plan
 */
export interface PlanStep {
  id: string;
  description: string;
  status: TaskStatus;
  tool?: string;
  params?: Record<string, unknown>;
  result?: ToolExecutionResult;
  startTime?: Date;
  endTime?: Date;
  children?: PlanStep[];  // Support for hierarchical steps
  parentId?: string;      // Reference to parent step
  depth?: number;         // Nesting level (0 = top level)
  retryCount?: number;    // Number of retries if the step fails
  retryDelayMs?: number;  // Base delay between retries in milliseconds
  timeoutMs?: number;     // Maximum execution time for this step
  metadata?: {
    prerequisites?: string[];
    estimatedDuration?: number;
    [key: string]: unknown;
  };
}

/**
 * Result of plan execution
 */
export interface ExecutionResult {
  success: boolean;
  message: string;
  completedSteps: number;
  totalSteps: number;
  error?: string;
  plan?: PlanWithSteps;
}

/**
 * Plan result interface
 */
export interface PlanResult {
  success: boolean;
  message: string;
  steps: PlanStep[];
  startTime: Date;
  endTime?: Date;
  metadata?: {
    totalDuration?: number;
    completedSteps: number;
    failedSteps: number;
    [key: string]: unknown;
  };
}

// ============= AUTONOMY SYSTEM =============

/**
 * Type for notification function
 * Always returns a Promise to ensure compatibility
 */
export type NotifyFunction = (message: string) => Promise<void>;

/**
 * Plan and execute options
 */
export interface PlanAndExecuteOptions {
  goalPrompt: string;
  autonomyMode?: boolean;
  requireApproval?: boolean;
  tools?: string[];
  tags?: string[];
  maxSteps?: number;
  timeLimit?: number;
  dryRun?: boolean;  // When true, simulate decisions without executing tool actions
}

/**
 * Plan and execute result
 */
export interface PlanAndExecuteResult {
  success: boolean;
  message: string;
  plan?: PlanWithSteps;
  error?: string;
}

/**
 * Scheduled task interface
 */
export interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  schedule: string; // Cron pattern
  goalPrompt?: string;
  lastRun?: Date;
  nextRun?: Date;
  enabled: boolean;
  tags?: string[];
  interval?: number; // Interval in milliseconds for non-cron tasks
  intervalId?: NodeJS.Timeout; // For tracking interval-based tasks
}

/**
 * Enhanced autonomy system interface
 */
export interface AutonomySystem {
  // Core properties
  status: 'active' | 'inactive';
  scheduledTasks: ScheduledTask[];
  
  // Scheduler interface
  scheduler: {
    runTaskNow: (taskId: string) => Promise<boolean>;
    getScheduledTasks: () => ScheduledTask[];
    setTaskEnabled: (taskId: string, enabled: boolean) => boolean;
    setAutonomyMode: (enabled: boolean) => void;
    getAutonomyMode: () => boolean;
  };
  
  // Core methods
  initialize(): Promise<boolean>;
  shutdown(): Promise<void>;
  
  // Task management
  runTask(taskName: string): Promise<boolean>;
  scheduleTask(task: ScheduledTask): Promise<boolean>;
  cancelTask(taskId: string): Promise<boolean>;
  
  // Planning and execution
  planAndExecute(options: PlanAndExecuteOptions): Promise<PlanAndExecuteResult>;
  
  // Diagnostics
  diagnose(): Promise<{
    memory: { status: string; messageCount: number };
    scheduler: { status: string; activeTasks: number };
    planning: { status: string };
  }>;
}

// ============= AGENT STATE =============

/**
 * State interface for agent state graph
 */
export interface ChloeState {
  messages: Array<{
    role: MessageRole;
    content: string;
    metadata?: Record<string, unknown>;
  }>;
  memory: string[];
  tasks: Array<{
    id: string;
    description: string;
    status: TaskStatus;
  }>;
  currentTask?: {
    id: string;
    description: string;
    status: TaskStatus;
  };
  reflections: string[];
  response?: string;
  error?: string;
}

// ============= TYPE GUARDS =============

/**
 * Type guard for MessageMemory
 */
export function isMessageMemory(memory: MemoryEntry): memory is MessageMemory {
  return memory.type === 'message';
}

/**
 * Type guard for ThoughtMemory
 */
export function isThoughtMemory(memory: MemoryEntry): memory is ThoughtMemory {
  return memory.type === 'thought';
}

/**
 * Type guard for StrategicInsightMemory
 */
export function isStrategicInsightMemory(memory: MemoryEntry): memory is StrategicInsightMemory {
  return memory.type === 'strategic_insight';
}

/**
 * Type guard for TaskMemory
 */
export function isTaskMemory(memory: MemoryEntry): memory is TaskMemory {
  return memory.type === 'task';
}

/**
 * Type guard for successful plan result
 */
export function isSuccessfulPlanResult(result: PlanResult): result is PlanResult & { success: true } {
  return result.success === true;
}

/**
 * Type guard for failed plan result
 */
export function isFailedPlanResult(result: PlanResult): result is PlanResult & { success: false } {
  return result.success === false;
}

/**
 * Type guard for successful tool execution
 */
export function isSuccessfulToolExecution(result: ToolExecutionResult): result is ToolExecutionResult & { success: true } {
  return result.success === true;
}

/**
 * Type guard for failed tool execution
 */
export function isFailedToolExecution(result: ToolExecutionResult): result is ToolExecutionResult & { success: false } {
  return result.success === false;
}

// Type guards for plan steps
export function isPlanStep(step: unknown): step is PlanStep {
  return (
    typeof step === 'object' &&
    step !== null &&
    'id' in step &&
    'description' in step &&
    'status' in step &&
    Object.values(TaskStatus).includes((step as PlanStep).status)
  );
}

export function isExtendedPlanStep(step: unknown): step is ExtendedPlanStep {
  return (
    isPlanStep(step) &&
    'type' in step &&
    'parameters' in step &&
    Array.isArray((step as ExtendedPlanStep).dependencies)
  );
}

export function isPlanWithSteps(plan: unknown): plan is PlanWithSteps {
  return (
    typeof plan === 'object' &&
    plan !== null &&
    'goal' in plan &&
    'steps' in plan &&
    'reasoning' in plan &&
    Array.isArray((plan as PlanWithSteps).steps) &&
    (plan as PlanWithSteps).steps.every(isPlanStep)
  );
}

// Extended plan step type definition
export interface ExtendedPlanStep extends Omit<PlanStep, 'status'> {
  type: string;
  status: TaskStatus;
  parameters: Record<string, unknown>;
  dependencies: string[];
  estimatedTime?: number;
  priority?: number;
  retryCount?: number;
  validationRules?: string[];
  fallbackOptions?: PlanStep[];
}

// Update type references
export interface ChloeAgent {
  initialize(): Promise<void>;
  getModel(): any;
  getMemory(): AgentMemory | null;
  getTaskLogger(): TaskLogger | null;
  notify(message: string): void;
  planAndExecute(goal: string, options: any): Promise<any>;
  runDailyTasks?: () => Promise<void>;
  runWeeklyReflection?: () => Promise<string>;
  getReflectionManager?: () => any;
  getPlanningManager?: () => any;
  getKnowledgeGapsManager?: () => any;
  getToolManager?: () => any;
  getTasksWithTag?: (tag: string) => Promise<any[]>;
  queueTask?: (task: any) => Promise<any>;
  scheduleTask?: (task: any) => void;
}

export interface AgentProfile {
  id: string;
  name: string;
  description: string;
  getNotifiers(): Notifier[];
  addNotifier(notifier: Notifier): void;
  getKnowledgeManager(): KnowledgeManager | null;
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  managers: {
    memory?: boolean;
    knowledge?: boolean;
    planning?: boolean;
    tools?: boolean;
    reflection?: boolean;
    logger?: boolean;
  };
  [key: string]: unknown;
}

export interface AgentExecutorOptions {
  memory: MemoryEntry;
  taskLogger: Record<string, unknown>;
}

export interface AgentPlannerOptions {
  memory: MemoryEntry;
  taskLogger: Record<string, unknown>;
}

export interface AgentReflectorOptions {
  memory: MemoryEntry;
  taskLogger: Record<string, unknown>;
}

export interface AgentLearnerOptions {
  memory: MemoryEntry;
  taskLogger: Record<string, unknown>;
}

export interface AgentMonitorOptions {
  memory: MemoryEntry;
  taskLogger: Record<string, unknown>;
}

export interface AgentOptions {
  memory: MemoryEntry;
  logger: Record<string, unknown>;
}

export interface AgentBase {
  getMemoryManager(): MemoryManager | null;
  getPlanningManager(): PlanningManager | null;
  getToolManager(): ToolManager | null;
  getKnowledgeManager(): KnowledgeManager | null;
  getReflectionManager(): ReflectionManager | null;
  getSchedulerManager(): SchedulerManager | null;
  getInputProcessor(): InputProcessor | null;
  getOutputProcessor(): OutputProcessor | null;
  getAutonomyManager(): AutonomyManager | null;
  getMemory(): MemoryManager | null;
  getTaskLogger(): Record<string, unknown> | null;
  getKnowledgeGapsManager(): KnowledgeManager | null;
}

export interface KnowledgeGapsManager {
  getMemoriesByImportance(importance: ImportanceLevel, limit: number): Promise<MemoryEntry[]>;
  getRelevantMemories(query: string, limit: number): Promise<MemoryEntry[]>;
}

export interface ExtendedTaskLogger extends TaskLogger {
  logError(task: string, error: Error, context?: Record<string, unknown>): Promise<void>;
  logWarning(task: string, warning: string, context?: Record<string, unknown>): Promise<void>;
  logProgress(task: string, progress: number, message?: string): Promise<void>;
  logCompletion(task: string, results: Record<string, unknown>): Promise<void>;
}

export interface ExtendedNotifier extends Notifier {
  getId(): string;
  getType(): string;
  isEnabled(): boolean;
  setEnabled(enabled: boolean): void;
}

/**
 * Knowledge graph manager interface
 */
export interface KnowledgeGraphManager {
  initialize(): Promise<void>;
  addNode(node: KnowledgeNode): Promise<void>;
  addEdge(edge: KnowledgeEdge): Promise<void>;
  getNode(id: string): Promise<KnowledgeNode | null>;
  getEdges(nodeId: string, direction?: 'incoming' | 'outgoing' | 'both'): Promise<KnowledgeEdge[]>;
  findNodes(query: string, type?: KnowledgeNodeType, limit?: number): Promise<KnowledgeNode[]>;
  findPaths(fromId: string, toId: string, maxDepth?: number): Promise<KnowledgeEdge[][]>;
  updateNode(id: string, updates: Partial<KnowledgeNode>): Promise<void>;
  updateEdge(from: string, to: string, updates: Partial<KnowledgeEdge>): Promise<void>;
  deleteNode(id: string): Promise<void>;
  deleteEdge(from: string, to: string): Promise<void>;
  getStats(): Promise<{
    totalNodes: number;
    totalEdges: number;
    nodeTypes: Record<KnowledgeNodeType, number>;
    edgeTypes: Record<KnowledgeEdgeType, number>;
  }>;
  buildGraphFromMemory(memories: Array<{ id: string; content: string; metadata?: any }>, tasks: Array<{ id: string; goal: string; subGoals?: any[]; status: string }>): Promise<void>;
  injectGraphContextIntoPlan(goal: string, maxNodes?: number): Promise<string>;
  getGraphVisualizationData(): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] };
  clear(): void;
  shutdown(): Promise<void>;
}

/**
 * Knowledge graph node types
 */
export enum KnowledgeNodeType {
  TASK = 'task',
  CONCEPT = 'concept',
  TREND = 'trend',
  TOOL = 'tool',
  STRATEGY = 'strategy',
  INSIGHT = 'insight',
  PROJECT = 'project',
  AGENT = 'agent',
  ENTITY = 'entity',
  PROCESS = 'process',
  RESOURCE = 'resource',
  METRIC = 'metric',
  EVENT = 'event',
  DECISION = 'decision'
}

/**
 * Knowledge graph edge types
 */
export enum KnowledgeEdgeType {
  RELATED_TO = 'related_to',
  DEPENDS_ON = 'depends_on',
  CONTRADICTS = 'contradicts',
  SUPPORTS = 'supports',
  USED_BY = 'used_by',
  REPORTED_BY = 'reported_by',
  PRODUCED_BY = 'produced_by',
  PART_OF = 'part_of',
  LEADS_TO = 'leads_to',
  SIMILAR_TO = 'similar_to',
  DERIVED_FROM = 'derived_from',
  INFLUENCES = 'influences',
  CATEGORIZES = 'categorizes',
  REFERENCES = 'references'
}

/**
 * Knowledge graph node
 */
export interface KnowledgeNode {
  id: string;
  label: string;
  type: KnowledgeNodeType;
  description?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Knowledge graph edge
 */
export interface KnowledgeEdge {
  from: string;
  to: string;
  type: KnowledgeEdgeType;
  label?: string;
  strength?: number;
  metadata?: Record<string, unknown>;
} 