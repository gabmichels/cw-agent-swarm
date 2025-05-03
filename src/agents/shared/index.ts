/**
 * Shared Multi-Agent Architecture Index
 * 
 * This file exports all the shared components for the multi-agent system.
 * These components can be imported and used by any agent in the system.
 */

// Base Agent
export { AgentBase, AgentCapabilityLevel } from './base/AgentBase';
export type { 
  AgentBaseConfig,
  AgentBaseOptions
} from './base/AgentBase';

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

/**
 * Create a new agent with the specified configuration
 */
export function createAgent(
  type: 'coordinator' | 'research' | 'content' | 'custom',
  config: any
): any {
  // This is just a placeholder factory function
  // In a real implementation, this would dynamically import and instantiate the appropriate agent type
  
  switch (type) {
    case 'coordinator':
      // Dynamic import would be used here
      const { ChloeCoordinator } = require('../chloe/ChloeCoordinator');
      return new ChloeCoordinator({ config });
      
    case 'research':
      // Dynamic import would be used here
      const { ResearchAgent } = require('../subagents/ResearchAgent');
      return new ResearchAgent({ config });
      
    case 'content':
      // This would be implemented later
      throw new Error('Content agent not yet implemented');
      
    case 'custom':
      // This would allow for custom agent types
      if (!config.agentClass) {
        throw new Error('Custom agent requires agentClass property');
      }
      const CustomAgent = config.agentClass;
      return new CustomAgent({ config });
      
    default:
      throw new Error(`Unknown agent type: ${type}`);
  }
} 