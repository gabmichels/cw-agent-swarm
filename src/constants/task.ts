/**
 * Constants related to tasks and their statuses
 */

/**
 * Task types
 */
export enum TaskType {
  EXTERNAL_POST = 'external_post',
  PLAN_TOOL = 'plan_tool',
  SUBGOAL = 'subgoal',
  NEW_TOOL = 'new_tool',
}

/**
 * Task status values
 */
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  BLOCKED = 'blocked',
  PAUSED = 'paused',
  EXECUTED = 'executed',
}

/**
 * Planning task status values
 */
export enum PlanningStatus {
  PLANNING = 'planning',
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  AWAITING_CLARIFICATION = 'awaiting_clarification',
} 