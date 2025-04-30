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
 * Interface representing a sub-goal of a planning task
 */
export interface SubGoal {
  id: string;
  description: string;
  priority: number;
  status: 'pending' | 'in_progress' | 'complete' | 'failed' | 'skipped';
  reasoning?: string;
  parentId?: string;
  children?: SubGoal[];
  depth?: number;
  estimatedTime?: number;
  failureReason?: string; // Added to store failure information
  result?: string; // Added to store the result of the sub-goal
}

/**
 * Interface representing a planning task
 */
export interface PlanningTask {
  goal: string;
  subGoals: SubGoal[];
  reasoning: string;
  status: 'planning' | 'executing' | 'complete' | 'failed' | 'paused' | 'awaiting_clarification' | 'awaiting_approval';
  confidenceScore?: number;
  currentSubGoalId?: string;
  clarificationQuestions?: string[];
  type?: string;
  needsClarification?: boolean;
  requiresApproval?: boolean;
  approvalGranted?: boolean;
  stakeholderProfile?: any;
  isStrategic?: boolean;
  blockedReason?: string;
  metadata?: Record<string, any>;
  id?: string; // Added to track unique task ID
  failedTool?: string; // Added to store the name of failed tool
  failureDetails?: {  // Added to store detailed information about failures
    toolName: string;
    error: string;
    parameters: string;
    subGoalId: string;
    retryCount?: number;
  };
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