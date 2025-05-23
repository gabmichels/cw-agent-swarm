/**
 * AgentTaskHandler.interface.ts - Interface for Agent-Task Integration
 * 
 * This interface defines how scheduled tasks integrate with agent planning and execution systems.
 * Following implementation guidelines: Interface-first design, no placeholder implementations.
 */

import { Task } from '../models/Task.model';
import { TaskExecutionResult } from '../models/TaskExecutionResult.model';
import { AgentBase } from '../../../agents/shared/base/AgentBase.interface';
import { PlanAndExecuteOptions } from '../../../agents/chloe/planAndExecute';
import { PlanningState } from '../../../agents/chloe/graph/nodes/types';

/**
 * Analysis result from examining a task for execution requirements
 */
export interface TaskAnalysis {
  /** Estimated complexity score (1-10) */
  complexity: number;
  /** Required capabilities for execution */
  requiredCapabilities: string[];
  /** Estimated execution time in milliseconds */
  estimatedDurationMs: number;
  /** Priority adjustment based on content analysis */
  adjustedPriority: number;
  /** Detected task type/category */
  taskType: string;
  /** Whether task requires external resources */
  requiresExternalResources: boolean;
  /** Dependencies on other tasks or data */
  dependencies: string[];
}

/**
 * Agent capacity information for load balancing
 */
export interface AgentCapacityInfo {
  /** Current number of running tasks */
  currentLoad: number;
  /** Maximum concurrent tasks this agent can handle */
  maxCapacity: number;
  /** Agent availability status */
  isAvailable: boolean;
  /** Agent health status */
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  /** Estimated time until next available slot */
  nextAvailableSlotMs: number;
}

/**
 * Error types specific to agent-task integration
 */
export class AgentTaskError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'AgentTaskError';
  }
}

/**
 * Registry interface for managing task-agent relationships
 */
export interface TaskAgentRegistry {
  /**
   * Get an agent by ID
   * @param agentId - The agent identifier
   * @returns The agent instance or null if not found
   */
  getAgentById(agentId: string): Promise<AgentBase | null>;

  /**
   * Find agents capable of executing a specific task
   * @param task - The task to find agents for
   * @returns Array of capable agent instances
   */
  findCapableAgents(task: Task): Promise<AgentBase[]>;

  /**
   * Check if an agent is available for task execution
   * @param agentId - The agent identifier
   * @returns True if agent is available
   */
  isAgentAvailable(agentId: string): Promise<boolean>;

  /**
   * Get current capacity information for an agent
   * @param agentId - The agent identifier
   * @returns Capacity information
   */
  getAgentCapacity(agentId: string): Promise<AgentCapacityInfo>;

  /**
   * Register an agent with the registry
   * @param agent - The agent to register
   */
  registerAgent(agent: AgentBase): Promise<void>;

  /**
   * Unregister an agent from the registry
   * @param agentId - The agent identifier
   */
  unregisterAgent(agentId: string): Promise<void>;
}

/**
 * Core interface for executing tasks through agents
 */
export interface AgentTaskExecutor {
  /**
   * Execute a task using a specific agent
   * @param task - The task to execute
   * @param agent - The agent to execute with
   * @returns Task execution result
   * @throws {AgentTaskError} If execution fails
   */
  executeTask(task: Task, agent: AgentBase): Promise<TaskExecutionResult>;

  /**
   * Validate that a task can be executed by a specific agent
   * @param task - The task to validate
   * @param agent - The agent to validate against
   * @returns True if agent can execute the task
   */
  validateTaskForAgent(task: Task, agent: AgentBase): boolean;

  /**
   * Create plan-and-execute options from a task
   * @param task - The task to convert
   * @returns Options for agent planning system
   */
  createPlanAndExecuteOptions(task: Task): PlanAndExecuteOptions;

  /**
   * Map agent execution result to task execution result
   * @param agentResult - The result from agent execution
   * @param task - The original task
   * @returns Standardized task execution result
   */
  mapExecutionResult(agentResult: PlanningState, task: Task): TaskExecutionResult;
}

/**
 * Main interface for handling agent-task integration
 */
export interface AgentTaskHandler {
  /**
   * Handle complete task execution workflow
   * @param task - The task to handle
   * @returns Task execution result
   * @throws {AgentTaskError} If handling fails
   */
  handleTask(task: Task): Promise<TaskExecutionResult>;

  /**
   * Analyze task requirements and complexity
   * @param task - The task to analyze
   * @returns Analysis results
   */
  analyzeTaskRequirements(task: Task): Promise<TaskAnalysis>;

  /**
   * Select the optimal agent for a task from available agents
   * @param task - The task to select agent for
   * @param agents - Available agent instances
   * @returns Selected agent
   * @throws {AgentTaskError} If no suitable agent is found
   */
  selectOptimalAgent(task: Task, agents: AgentBase[]): Promise<AgentBase>;

  /**
   * Monitor task execution progress
   * @param task - The task being executed
   * @param agent - The agent executing the task
   * @returns Promise that resolves when monitoring is complete
   */
  monitorExecution(task: Task, agent: AgentBase): Promise<void>;

  /**
   * Get the task-agent registry
   * @returns Registry instance
   */
  getRegistry(): TaskAgentRegistry;

  /**
   * Get the task executor
   * @returns Executor instance
   */
  getExecutor(): AgentTaskExecutor;
} 