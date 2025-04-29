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
} 