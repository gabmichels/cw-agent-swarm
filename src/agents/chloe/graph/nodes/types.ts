/**
 * Types for the Chloe graph nodes
 */

import { BaseMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { ChloeMemory } from "../../memory";
import { TaskLogger } from "../../task-logger";

/**
 * Shared node context
 */
export interface NodeContext {
  model: ChatOpenAI;
  memory: ChloeMemory;
  taskLogger: TaskLogger;
  tools: Record<string, any>;
  dryRun?: boolean;  // When true, operations are simulated without actual execution
}

/**
 * Sub-goal type for task decomposition
 */
export interface SubGoal {
  id: string;
  description: string;
  priority: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  reasoning?: string;
  result?: string;
  children?: SubGoal[];
  parentId?: string;
  depth?: number;
}

/**
 * Task type for planning
 */
export interface PlanningTask {
  goal: string;
  subGoals: SubGoal[];
  currentSubGoalId?: string;
  reasoning: string;
  status: 'planning' | 'executing' | 'completed' | 'failed' | 'awaiting_clarification';
  confidenceScore?: number;
  needsClarification?: boolean;
  clarificationQuestions?: string[];
  params?: Record<string, any>;
  requiredParams?: string[];
}

/**
 * Execution trace entry with timing information
 */
export interface ExecutionTraceEntry {
  step: string;             // Description of the step
  startTime: Date;          // When the step started
  endTime?: Date;           // When the step completed (if applicable)
  duration?: number;        // Duration in milliseconds (if completed)
  status: 'success' | 'error' | 'info' | 'simulated';  // Status of the step
  details?: any;            // Additional details about the step
}

/**
 * State for the planning graph
 */
export interface PlanningState {
  goal: string;
  task?: PlanningTask;
  messages: BaseMessage[];
  executionTrace: ExecutionTraceEntry[];
  finalResult?: string;
  route?: string;
  error?: string;
}

/**
 * Options for executing nodes
 */
export interface NodeOptions {
  trace?: boolean;
} 