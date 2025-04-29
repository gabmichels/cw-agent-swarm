/**
 * Comprehensive type definitions for the Chloe agent system
 */
import { ChatOpenAI } from '@langchain/openai';
import { StateGraph } from '@langchain/langgraph';
import { TaskLogger } from '../../../agents/chloe/task-logger';
import { ChloeMemory } from '../../../agents/chloe/memory';
import { MemoryManager } from '../../../agents/chloe/core/memoryManager';
import { ToolManager } from '../../../agents/chloe/core/toolManager';
import { PlanningManager } from '../../../agents/chloe/core/planningManager';
import { ReflectionManager } from '../../../agents/chloe/core/reflectionManager';
import { Notifier } from '../../../agents/chloe/notifiers';
import { KnowledgeGapsManager } from '@/agents/chloe/core/knowledgeGapsManager';

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
  getNotifiers(): Notifier[];
  addNotifier(notifier: Notifier): void;
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
  logger?: TaskLogger;
}

/**
 * Options for initializing the tool manager
 */
export interface ToolManagerOptions extends BaseManagerOptions {
  logger?: TaskLogger;
  model: ChatOpenAI;
  memory: ChloeMemory;
}

/**
 * Options for initializing the planning manager
 */
export interface PlanningManagerOptions extends BaseManagerOptions {
  memory: ChloeMemory;
  model: ChatOpenAI;
  taskLogger: TaskLogger;
  autonomySystem?: AutonomySystem;
  notifyFunction?: NotifyFunction;
}

/**
 * Options for initializing the reflection manager
 */
export interface ReflectionManagerOptions extends BaseManagerOptions {
  memory: ChloeMemory;
  model: ChatOpenAI;
  taskLogger: TaskLogger;
  notifyFunction?: NotifyFunction;
}

/**
 * Options for initializing the thought manager
 */
export interface ThoughtManagerOptions extends BaseManagerOptions {
  memory: ChloeMemory;
  model: ChatOpenAI;
  taskLogger: TaskLogger;
}

/**
 * Options for initializing the market scanner manager
 */
export interface MarketScannerManagerOptions extends BaseManagerOptions {
  memory: ChloeMemory;
  model: ChatOpenAI;
  taskLogger: TaskLogger;
  notifyFunction?: NotifyFunction;
}

/**
 * Options for initializing the knowledge gaps manager
 */
export interface KnowledgeGapsManagerOptions extends BaseManagerOptions {
  memory: ChloeMemory;
  openaiApiKey: string;
  logger: TaskLogger;
  notifyFunction: NotifyFunction;
}

// ============= MEMORY TYPES =============

/**
 * Options for configuring the ChloeMemory system.
 */
export interface ChloeMemoryOptions {
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
  type: MemoryType;
  importance: ImportanceLevel;
  source: MemorySource;
  context?: string;
  created: Date;
  lastAccessed?: Date;
  accessCount?: number;
}

/**
 * Types of memories
 */
export type MemoryType = 'message' | 'thought' | 'insight' | 'fact' | 'reflection' | 'task' | 'document';

/**
 * Importance levels for memories
 */
export type ImportanceLevel = 'low' | 'medium' | 'high' | number;

/**
 * Sources of memories
 */
export type MemorySource = 'user' | 'chloe' | 'system' | 'tool' | 'web' | string;

/**
 * Message memory entry
 */
export interface MessageMemory extends MemoryEntry {
  type: 'message';
  sender: string;
  recipient: string;
  conversationId?: string;
  metadata?: {
    attachments?: Array<{
      type: string;
      url?: string;
      data?: Buffer | string;
      filename?: string;
      contentType?: string;
    }>;
    [key: string]: unknown;
  };
}

/**
 * Thought memory entry
 */
export interface ThoughtMemory extends MemoryEntry {
  type: 'thought';
  category: string;
  confidence: number;
  relatedThoughts?: string[];
  metadata?: {
    reasoning?: string;
    assumptions?: string[];
    [key: string]: unknown;
  };
}

/**
 * Strategic insight memory entry
 */
export interface StrategicInsightMemory extends MemoryEntry {
  type: 'insight';
  category: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  relatedInsights?: string[];
  metadata?: {
    evidence?: string[];
    recommendations?: string[];
    [key: string]: unknown;
  };
}

/**
 * Task memory entry
 */
export interface TaskMemory extends MemoryEntry {
  type: 'task';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
  assignedTo?: string;
  metadata?: {
    steps?: string[];
    dependencies?: string[];
    [key: string]: unknown;
  };
}

/**
 * Tagged memory with additional metadata
 */
export interface TaggedMemory extends MemoryEntry {
  tags: string[];
  sentiment?: string;
  entities?: string[];
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
}

/**
 * Individual step in a plan
 */
export interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  tool?: string;
  params?: Record<string, unknown>;
  result?: ToolExecutionResult;
  startTime?: Date;
  endTime?: Date;
  children?: PlanStep[];  // Support for hierarchical steps
  parentId?: string;      // Reference to parent step
  depth?: number;         // Nesting level (0 = top level)
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
    role: 'system' | 'user' | 'assistant';
    content: string;
    metadata?: Record<string, unknown>;
  }>;
  memory: string[];
  tasks: Array<{
    id: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
  }>;
  currentTask?: {
    id: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
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
  return memory.type === 'insight';
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