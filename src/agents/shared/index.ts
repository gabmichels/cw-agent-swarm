/**
 * Shared Multi-Agent Architecture Index
 * 
 * This file exports all the shared components for the multi-agent system.
 * These components can be imported and used by any agent in the system.
 */

// Base Agent
export { AbstractAgentBase as AgentBase } from './base/AbstractAgentBase';
export { AgentCapabilityLevel } from './base/types';
export type { 
  AgentBaseConfig
} from './base/types';

// Memory
export { MemoryRouter } from './memory/MemoryRouter';
export type { 
  MemoryRouterOptions
} from './memory/MemoryRouter';

// Planning
export { Planner } from './planning/Planner';
export type { 
  PlanningContext,
  Plan,
  PlanStep
} from './planning/Planner';

// Execution
export { 
  Executor,
  ExecutionStatus
} from './execution/Executor';
export type {
  ExecutionContext,
  ExecutionOptions,
  ExecutionResult,
  StepExecutionResult
} from './execution/Executor';

// Tools
export { ToolRouter } from './tools/ToolRouter';
export type {
  ToolDefinition,
  ToolResult,
  ToolAccessOptions,
  ToolRouterOptions
} from './tools/ToolRouter';

// Coordination
export { AgentCoordinator } from './coordination/AgentCoordinator';
export type {
  RegisteredAgent,
  DelegationRequest,
  DelegationResult,
  CoordinatorOptions
} from './coordination/AgentCoordinator'; 