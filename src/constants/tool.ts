/**
 * Constants related to tool commands and operations
 */

/**
 * Tool command types
 */
export enum ToolCommand {
  GENERATE_TOOL = 'generate-tool',
  SCAN_MARKET = 'scan-market',
  EXECUTE_STRATEGY = 'execute-strategy',
}

/**
 * Tool execution results
 */
export enum ToolExecutionResult {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PARTIAL = 'partial',
  PENDING = 'pending',
} 