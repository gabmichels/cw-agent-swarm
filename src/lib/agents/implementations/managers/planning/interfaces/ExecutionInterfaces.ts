/**
 * ExecutionInterfaces.ts - Execution-specific interfaces
 * 
 * These interfaces define the contracts for plan execution, action execution,
 * and result processing components.
 */

import { 
  Plan, 
  PlanStep, 
  PlanAction,
  PlanExecutionResult 
} from '../../../../../../agents/shared/base/managers/PlanningManager.interface';

/**
 * Execution status for plans, steps, and actions
 */
export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PAUSED = 'paused',
  SKIPPED = 'skipped'
}

/**
 * Configuration for plan execution
 */
export interface PlanExecutionConfig {
  /** Maximum concurrent steps */
  maxConcurrentSteps: number;
  
  /** Maximum concurrent actions per step */
  maxConcurrentActions: number;
  
  /** Timeout for step execution (ms) */
  stepTimeoutMs: number;
  
  /** Timeout for action execution (ms) */
  actionTimeoutMs: number;
  
  /** Whether to continue on step failure */
  continueOnStepFailure: boolean;
  
  /** Whether to continue on action failure */
  continueOnActionFailure: boolean;
  
  /** Maximum retry attempts */
  maxRetryAttempts: number;
  
  /** Retry delay (ms) */
  retryDelayMs: number;
}

/**
 * Context for plan execution
 */
export interface ExecutionContext {
  /** Execution ID */
  executionId: string;
  
  /** Plan being executed */
  plan: Plan;
  
  /** Current execution state */
  state: ExecutionState;
  
  /** Shared data between steps/actions */
  sharedData: Record<string, unknown>;
  
  /** Execution configuration */
  config: PlanExecutionConfig;
  
  /** Start time */
  startTime: Date;
  
  /** Current time */
  currentTime: Date;
  
  /** Available resources */
  availableResources?: Record<string, unknown>;
}

/**
 * Execution state tracking
 */
export interface ExecutionState {
  /** Overall execution status */
  status: ExecutionStatus;
  
  /** Current step being executed */
  currentStepId?: string;
  
  /** Completed steps */
  completedSteps: string[];
  
  /** Failed steps */
  failedSteps: string[];
  
  /** Step execution states */
  stepStates: Record<string, StepExecutionState>;
  
  /** Execution progress (0-1) */
  progress: number;
  
  /** Error information if failed */
  error?: ExecutionError;
}

/**
 * Step execution state
 */
export interface StepExecutionState {
  /** Step ID */
  stepId: string;
  
  /** Execution status */
  status: ExecutionStatus;
  
  /** Start time */
  startTime?: Date;
  
  /** End time */
  endTime?: Date;
  
  /** Action execution states */
  actionStates: Record<string, ActionExecutionState>;
  
  /** Step result */
  result?: StepExecutionResult;
  
  /** Error information if failed */
  error?: ExecutionError;
  
  /** Retry count */
  retryCount: number;
}

/**
 * Action execution state
 */
export interface ActionExecutionState {
  /** Action ID */
  actionId: string;
  
  /** Execution status */
  status: ExecutionStatus;
  
  /** Start time */
  startTime?: Date;
  
  /** End time */
  endTime?: Date;
  
  /** Action result */
  result?: ActionExecutionResult;
  
  /** Error information if failed */
  error?: ExecutionError;
  
  /** Retry count */
  retryCount: number;
}

/**
 * Execution error information
 */
export interface ExecutionError {
  /** Error message */
  message: string;
  
  /** Error code */
  code: string;
  
  /** Error details */
  details?: Record<string, unknown>;
  
  /** Stack trace */
  stack?: string;
  
  /** Whether error is recoverable */
  recoverable: boolean;
  
  /** Suggested recovery actions */
  recoveryActions?: string[];
}

/**
 * Result of step execution
 */
export interface StepExecutionResult {
  /** Whether step succeeded */
  success: boolean;
  
  /** Step output data */
  output?: unknown;
  
  /** Execution metrics */
  metrics: ExecutionMetrics;
  
  /** Action results */
  actionResults: ActionExecutionResult[];
  
  /** Generated artifacts */
  artifacts?: Record<string, unknown>;
  
  /** Metadata */
  metadata: Record<string, unknown>;
}

/**
 * Result of action execution
 */
export interface ActionExecutionResult {
  /** Action ID */
  actionId: string;
  
  /** Whether action succeeded */
  success: boolean;
  
  /** Action output data */
  output?: unknown;
  
  /** Execution metrics */
  metrics: ExecutionMetrics;
  
  /** Tool results if applicable */
  toolResults?: ToolExecutionResult[];
  
  /** Generated artifacts */
  artifacts?: Record<string, unknown>;
  
  /** Metadata */
  metadata: Record<string, unknown>;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  /** Tool name */
  toolName: string;
  
  /** Whether tool execution succeeded */
  success: boolean;
  
  /** Tool output */
  output?: unknown;
  
  /** Error information if failed */
  error?: ExecutionError;
  
  /** Execution time (ms) */
  executionTime: number;
  
  /** Resource usage */
  resourceUsage?: Record<string, number>;
}

/**
 * Execution metrics
 */
export interface ExecutionMetrics {
  /** Execution time (ms) */
  executionTime: number;
  
  /** Queue time (ms) */
  queueTime: number;
  
  /** CPU usage */
  cpuUsage?: number;
  
  /** Memory usage (bytes) */
  memoryUsage?: number;
  
  /** Network usage (bytes) */
  networkUsage?: number;
  
  /** API calls made */
  apiCalls?: number;
  
  /** Tokens used */
  tokensUsed?: number;
  
  /** Cost incurred */
  cost?: number;
}

/**
 * Options for action execution
 */
export interface ActionExecutionOptions {
  /** Execution timeout (ms) */
  timeoutMs?: number;
  
  /** Maximum retry attempts */
  maxRetries?: number;
  
  /** Retry delay (ms) */
  retryDelayMs?: number;
  
  /** Whether to use fallback tools */
  useFallbacks?: boolean;
  
  /** Context data */
  context?: Record<string, unknown>;
  
  /** Resource constraints */
  resourceConstraints?: Record<string, unknown>;
}

/**
 * Options for result processing
 */
export interface ResultProcessingOptions {
  /** Whether to validate results */
  validateResults?: boolean;
  
  /** Whether to transform results */
  transformResults?: boolean;
  
  /** Whether to store results */
  storeResults?: boolean;
  
  /** Storage configuration */
  storageConfig?: Record<string, unknown>;
  
  /** Validation rules */
  validationRules?: ValidationRule[];
}

/**
 * Validation rule for results
 */
export interface ValidationRule {
  /** Rule name */
  name: string;
  
  /** Rule type */
  type: 'required' | 'type' | 'range' | 'pattern' | 'custom';
  
  /** Rule parameters */
  parameters: Record<string, unknown>;
  
  /** Error message if validation fails */
  errorMessage: string;
}

/**
 * Interface for executing plans
 */
export interface PlanExecutor {
  /**
   * Execute a complete plan
   */
  executePlan(
    plan: Plan,
    config?: Partial<PlanExecutionConfig>
  ): Promise<PlanExecutionResult>;
  
  /**
   * Execute a single step
   */
  executeStep(
    step: PlanStep,
    context: ExecutionContext
  ): Promise<StepExecutionResult>;
  
  /**
   * Pause plan execution
   */
  pauseExecution(executionId: string): Promise<void>;
  
  /**
   * Resume plan execution
   */
  resumeExecution(executionId: string): Promise<void>;
  
  /**
   * Cancel plan execution
   */
  cancelExecution(executionId: string): Promise<void>;
  
  /**
   * Get execution status
   */
  getExecutionStatus(executionId: string): Promise<ExecutionState>;
}

/**
 * Interface for executing individual actions
 */
export interface ActionExecutor {
  /**
   * Execute a single action
   */
  executeAction(
    action: PlanAction,
    context: ExecutionContext,
    options?: ActionExecutionOptions
  ): Promise<ActionExecutionResult>;
  
  /**
   * Execute multiple actions concurrently
   */
  executeActionsConcurrently(
    actions: PlanAction[],
    context: ExecutionContext,
    options?: ActionExecutionOptions
  ): Promise<ActionExecutionResult[]>;
  
  /**
   * Execute actions sequentially
   */
  executeActionsSequentially(
    actions: PlanAction[],
    context: ExecutionContext,
    options?: ActionExecutionOptions
  ): Promise<ActionExecutionResult[]>;
}

/**
 * Interface for processing execution results
 */
export interface ExecutionResultProcessor {
  /**
   * Process step execution results
   */
  processStepResult(
    result: StepExecutionResult,
    context: ExecutionContext,
    options?: ResultProcessingOptions
  ): Promise<StepExecutionResult>;
  
  /**
   * Process action execution results
   */
  processActionResult(
    result: ActionExecutionResult,
    context: ExecutionContext,
    options?: ResultProcessingOptions
  ): Promise<ActionExecutionResult>;
  
  /**
   * Aggregate results from multiple actions
   */
  aggregateResults(
    results: ActionExecutionResult[],
    context: ExecutionContext
  ): Promise<StepExecutionResult>;
  
  /**
   * Validate execution results
   */
  validateResults(
    results: ActionExecutionResult[],
    rules: ValidationRule[]
  ): Promise<ValidationResult[]>;
  
  /**
   * Transform results for storage or further processing
   */
  transformResults(
    results: ActionExecutionResult[],
    transformations: Record<string, unknown>
  ): Promise<ActionExecutionResult[]>;
}

/**
 * Validation result for execution results
 */
export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  
  /** Validation score (0-1) */
  score: number;
  
  /** Validation errors */
  errors: string[];
  
  /** Validation warnings */
  warnings: string[];
  
  /** Validated data */
  validatedData?: unknown;
} 