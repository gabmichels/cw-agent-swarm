import { ChatOpenAI } from '@langchain/openai';
import { type AgentConfig } from '../types';
import { type StateGraph } from '@langchain/langgraph';
import { type Message, type Task } from '../types';

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
  status: 'active' | 'inactive';
  scheduledTasks: ScheduledTask[];
  scheduler?: {
    runTaskNow: (taskId: string) => Promise<boolean>;
    getScheduledTasks: () => ScheduledTask[];
    setTaskEnabled: (taskId: string, enabled: boolean) => boolean;
  };
  planAndExecute?: (options: any) => Promise<any>;
  runTask(taskName: string): Promise<boolean>;
  scheduleTask(task: ScheduledTask): Promise<boolean>;
  initialize(): Promise<boolean>;
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
  source: string;
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
  importance: number | 'low' | 'medium' | 'high';
  category: string;
  tags: string[];
  sentiment?: string;
  entities?: string[];
  created: Date;
} 