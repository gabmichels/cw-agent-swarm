/**
 * Constants related to agent reflection and review systems
 */

/**
 * Reflection types
 * Used in reflection manager and performance review systems
 */
export enum ReflectionType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  TASK = 'task',
  ERROR = 'error',
  ALL = 'all', // For when all data is needed regardless of time period
  CAUSAL = 'causal', // For causal relationship reflections
  CAUSAL_CHAIN = 'causal_chain', // For causal chain analysis
}

/**
 * Performance review types
 * Used in the performance review system
 */
export enum PerformanceReviewType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

/**
 * Reflection categories
 * Used to categorize different types of reflections
 */
export enum ReflectionCategory {
  TASK_PERFORMANCE = 'task_performance',
  STRATEGY = 'strategy',
  USER_INTERACTION = 'user_interaction',
  TOOLS_USAGE = 'tools_usage',
  PLANNING = 'planning',
  CAUSAL_ANALYSIS = 'causal_analysis', // Added for causal relationship analysis
}

/**
 * Insight types from reflections
 * Used to classify insights that emerge from reflections
 */
export enum InsightType {
  SUCCESS = 'success',
  FAILURE = 'failure',
  IMPROVEMENT = 'improvement',
  PATTERN = 'pattern',
  CAUSAL = 'causal', // Added for cause-effect relationships
}

/**
 * Types of causal relationships that can be detected
 */
export enum CausalRelationshipType {
  DIRECT = 'direct', // Clear direct cause and effect
  CONTRIBUTING = 'contributing', // One of several contributing factors
  CORRELATED = 'correlated', // Correlation observed but causation not certain
  SEQUENTIAL = 'sequential', // Events occurred in sequence but causation not proven
} 