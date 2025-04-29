/**
 * Constants related to action routing and execution
 */

/**
 * Action routing types
 */
export enum ActionRouting {
  REQUEST_APPROVAL = 'request-approval',
  REQUEST_CLARIFICATION = 'request-clarification',
  EXECUTE = 'execute',
  SKIP = 'skip',
}

/**
 * Execution status types for trace entries
 */
export enum ExecutionStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  INFO = 'info',
  SIMULATED = 'simulated',
} 