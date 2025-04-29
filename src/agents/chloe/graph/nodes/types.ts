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
}

/**
 * Task type for planning
 */
export interface PlanningTask {
  goal: string;
  subGoals: SubGoal[];
  currentSubGoalId?: string;
  reasoning: string;
  status: 'planning' | 'executing' | 'completed' | 'failed';
}

/**
 * State for the planning graph
 */
export interface PlanningState {
  goal: string;
  task?: PlanningTask;
  messages: BaseMessage[];
  executionTrace: string[];
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