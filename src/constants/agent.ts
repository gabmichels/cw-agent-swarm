/**
 * Constants related to agent types and configurations
 * For future multi-agent architecture support
 */

/**
 * Agent types
 */
export enum AgentType {
  CHLOE = 'chloe',
  ASSISTANT = 'assistant',
  SPECIALIST = 'specialist',
  EVALUATOR = 'evaluator',
}

/**
 * Agent modes for determining behavior
 */
export enum AgentMode {
  AUTONOMOUS = 'autonomous',
  SUPERVISED = 'supervised',
  COLLABORATIVE = 'collaborative',
}

/**
 * Agent interaction types
 */
export enum AgentInteraction {
  DIRECT = 'direct',
  SEQUENTIAL = 'sequential',
  PARALLEL = 'parallel',
  HIERARCHICAL = 'hierarchical',
} 