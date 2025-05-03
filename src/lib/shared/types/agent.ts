import { ChatOpenAI } from '@langchain/openai';
import { type StateGraph } from '@langchain/langgraph';
import { type Message, type Task } from '../types';
import { PlanAndExecuteOptions, PlanAndExecuteResult } from './agentTypes';
import { ImportanceLevel } from '../../../constants/memory';
import { ExtendedMemorySource } from '../../../agents/chloe/types/memory';

/**
 * Agent configuration with all required properties
 */
export interface AgentConfig {
  systemPrompt: string;
  model?: string;
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  agentId: string;
  logDir?: string;
}

/**
 * Type definitions for the Chloe agent system
 */

/**
 * Base tool interface that doesn't rely on external packages
 */
export interface BaseTool {
  name: string;
  description: string;
  schema?: Record<string, any>;
  execute(params: Record<string, any>): Promise<any>;
}

/**
 * SimpleTool interface for tools that take string input and return string output
 */
export interface SimpleTool {
  name: string;
  description: string;
  _call(input: string): Promise<string>;
}

/**
 * Type for accessing the model in the global scope (without global declaration)
 */
export type GlobalModel = ChatOpenAI | null;

/**
 * State interface for agent state graph - updated to use proper Message and Task types
 */
export interface ChloeState {
  messages: Message[];
  memory: string[];
  tasks: Task[];
  currentTask?: Task;
  reflections: string[];
  response?: string;
  error?: string;
}

/**
 * Memory system configuration
 */
export interface MemoryConfig {
  collectionName?: string;
  namespace?: string;
  useOpenAI?: boolean;
  agentId?: string;
  useExternalMemory?: boolean;
  externalMemory?: any;
}

/**
 * Advanced cognitive systems
 */
export interface CognitiveFunctions {
  namespace: string;
  workingMemoryCapacity?: number;
  consolidationInterval?: number;
}

/**
 * Types for the autonomy system
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

/**
 * Type for the result of the autonomy system diagnosis
 */
export interface AutonomyDiagnosis {
  memory: { status: string; messageCount: number };
  scheduler: { status: string; activeTasks: number };
  planning: { status: string };
}

export interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  schedule: string; // Cron pattern
  lastRun?: Date;
  nextRun?: Date;
  enabled: boolean;
}

/**
 * Strategic insight types
 */
export interface StrategicInsight {
  insight: string;
  source: ExtendedMemorySource | string;
  tags: string[];
  timestamp: string;
  category: string;
}

/**
 * TaggedMemory interface for memory tagger
 */
export interface TaggedMemory {
  id: string;
  content: string;
  importance: number | ImportanceLevel;
  category: string;
  tags: string[];
  sentiment?: string;
  entities?: string[];
  created: Date;
} 