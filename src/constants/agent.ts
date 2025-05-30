/**
 * Constants related to agent types and configurations
 * For future multi-agent architecture support
 */

/**
 * Agent types
 */
export enum AgentType {
  DEFAULT = 'default',
  ASSISTANT = 'assistant',
  SEARCH = 'search',
  CODE = 'code',
  SPECIALIST = 'specialist',
  EVALUATOR = 'evaluator',
  CUSTOM = 'custom',
}

/**
 * Agent modes for determining behavior
 */
export enum AgentMode {
  AUTONOMOUS = 'autonomous',
  SUPERVISED = 'supervised',
  COLLABORATIVE = 'collaborative',
  FLEXIBLE = 'flexible',
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