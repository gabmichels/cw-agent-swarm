/**
 * Plan Recovery Interface
 * 
 * This file defines interfaces for robust plan recovery, error classification,
 * and handling mechanisms to enhance planning capabilities.
 */

/**
 * Plan failure severity levels
 */
export enum PlanFailureSeverity {
  CRITICAL = 'critical',     // Completely blocks plan execution, cannot continue
  HIGH = 'high',             // Seriously impacts plan execution, may require significant changes
  MEDIUM = 'medium',         // Impacts execution but can be worked around
  LOW = 'low',               // Minor issue that can be easily resolved
  INFORMATIONAL = 'info'     // Not a failure but worth noting
}

/**
 * Plan failure categories
 */
export enum PlanFailureCategory {
  RESOURCE_UNAVAILABLE = 'resource_unavailable',   // Required resource not available
  TOOL_FAILURE = 'tool_failure',                   // Tool execution failed
  EXTERNAL_API_ERROR = 'external_api_error',       // External API/service error
  PERMISSION_DENIED = 'permission_denied',         // Permission issue
  INVALID_INPUT = 'invalid_input',                 // Invalid input data
  INVALID_STATE = 'invalid_state',                 // System in unexpected state
  TIMEOUT = 'timeout',                             // Operation timed out
  DEPENDENCY_FAILURE = 'dependency_failure',       // Dependent step/plan failed
  LOGICAL_ERROR = 'logical_error',                 // Error in plan logic
  DATA_ERROR = 'data_error',                       // Error in data handling
  ENVIRONMENTAL = 'environmental',                 // Environment-related issue
  UNKNOWN = 'unknown'                              // Unclassified error
}

/**
 * Plan recovery action types
 */
export enum PlanRecoveryActionType {
  RETRY = 'retry',                     // Retry the failed step
  SKIP = 'skip',                       // Skip the failed step
  SUBSTITUTE = 'substitute',           // Substitute with alternative step
  ROLLBACK = 'rollback',               // Rollback to previous state
  REPLAN = 'replan',                   // Create a new plan from current state
  REQUEST_USER_INPUT = 'user_input',   // Request user intervention
  ABORT = 'abort',                     // Abort the plan execution
  PAUSE = 'pause',                     // Pause for later resumption
  ESCALATE = 'escalate',               // Escalate to higher authority
  COMPENSATE = 'compensate'            // Execute compensation actions
}

/**
 * Plan failure information
 */
export interface PlanFailureInfo {
  /** Unique identifier */
  id: string;
  
  /** Plan ID that failed */
  planId: string;
  
  /** Step ID that failed (if applicable) */
  stepId?: string;
  
  /** Tool ID that failed (if applicable) */
  toolId?: string;
  
  /** Error message */
  message: string;
  
  /** Detailed error information */
  details?: Error | Record<string, unknown>;
  
  /** Error stack trace (if available) */
  stackTrace?: string;
  
  /** Original error code (if available) */
  errorCode?: string;
  
  /** Failure category */
  category: PlanFailureCategory;
  
  /** Failure severity */
  severity: PlanFailureSeverity;
  
  /** Timestamp when failure occurred */
  timestamp: Date;
  
  /** Execution context at time of failure */
  context?: Record<string, unknown>;
  
  /** Failure impact assessment */
  impact?: {
    /** Impact on overall plan */
    planImpact: 'blocking' | 'major' | 'minor' | 'none';
    
    /** Affected downstream steps */
    affectedSteps: string[];
    
    /** Affected resources */
    affectedResources: string[];
  };
  
  /** Recovery attempts so far */
  recoveryAttempts: number;
  
  /** Previous recovery actions */
  previousRecoveryActions?: PlanRecoveryAction[];
}

/**
 * Plan recovery action
 */
export interface PlanRecoveryAction {
  /** Action type */
  type: PlanRecoveryActionType;
  
  /** Action description */
  description: string;
  
  /** Action parameters */
  parameters?: Record<string, unknown>;
  
  /** Expected outcome */
  expectedOutcome?: string;
  
  /** Confidence score (0-1) */
  confidence: number;
  
  /** Estimated success probability (0-1) */
  successProbability: number;
  
  /** Estimated effort (1-10 scale) */
  estimatedEffort: number;
  
  /** Required resources */
  requiredResources?: string[];
  
  /** Potential side effects */
  potentialSideEffects?: string[];
  
  /** Fallback action if this fails */
  fallbackAction?: PlanRecoveryActionType;
}

/**
 * Recovery execution result
 */
export interface RecoveryExecutionResult {
  /** Success status */
  success: boolean;
  
  /** Action executed */
  action: PlanRecoveryAction;
  
  /** Result message */
  message: string;
  
  /** Execution duration in milliseconds */
  durationMs: number;
  
  /** New plan/step state after recovery */
  newState?: 'resumed' | 'modified' | 'aborted' | 'paused' | 'escalated';
  
  /** New plan ID (if replanned) */
  newPlanId?: string;
  
  /** New step ID (if step replaced) */
  newStepId?: string;
  
  /** Error if failed */
  error?: Error | string;
  
  /** Output data (if any) */
  output?: Record<string, unknown>;
}

/**
 * Plan recovery policy
 */
export interface PlanRecoveryPolicy {
  /** Policy ID */
  id: string;
  
  /** Policy name */
  name: string;
  
  /** Policy description */
  description: string;
  
  /** Target plan types this policy applies to */
  targetPlanTypes?: string[];
  
  /** Target categories this policy applies to */
  targetCategories?: PlanFailureCategory[];
  
  /** Target severity levels this policy applies to */
  targetSeverities?: PlanFailureSeverity[];
  
  /** Maximum recovery attempts */
  maxRecoveryAttempts: number;
  
  /** Whether to escalate after max attempts */
  escalateAfterMaxAttempts: boolean;
  
  /** Recovery action sequence */
  actionSequence: Array<{
    /** Action type */
    type: PlanRecoveryActionType;
    
    /** When to apply this action */
    applyWhen: {
      /** Attempt number to apply at (0 for any) */
      attemptNumber?: number;
      
      /** Categories to apply for (empty for any) */
      categories?: PlanFailureCategory[];
      
      /** Severities to apply for (empty for any) */
      severities?: PlanFailureSeverity[];
      
      /** Custom condition (parsed expression) */
      condition?: string;
    };
    
    /** Action parameters */
    parameters?: Record<string, unknown>;
  }>;
  
  /** Timeout for recovery attempts in milliseconds */
  recoveryTimeoutMs?: number;
  
  /** Action to take if recovery fails */
  fallbackAction: PlanRecoveryActionType;
  
  /** Additional policy options */
  options?: Record<string, unknown>;
}

/**
 * Template for standard error response
 */
export interface StandardErrorResponse {
  /** Error code - unique identifier for this type of error */
  code: string;
  
  /** Human-readable error message */
  message: string;
  
  /** Failure category */
  category: PlanFailureCategory;
  
  /** Failure severity */
  severity: PlanFailureSeverity;
  
  /** Timestamp when error occurred */
  timestamp: Date;
  
  /** Additional error details */
  details?: Record<string, unknown>;
  
  /** Suggested recovery actions */
  suggestedActions?: PlanRecoveryActionType[];
  
  /** Resource identifiers related to error */
  resources?: string[];
  
  /** Request ID or correlation ID for tracking */
  requestId?: string;
  
  /** Documentation links */
  documentation?: string;
  
  /** Error source (e.g., component name) */
  source?: string;
}

/**
 * Recovery strategy interface
 */
export interface RecoveryStrategy {
  /** Strategy ID */
  id: string;
  
  /** Strategy name */
  name: string;
  
  /** Strategy description */
  description: string;
  
  /** Categories this strategy handles */
  handleCategories: PlanFailureCategory[];
  
  /** Plan types this strategy handles */
  handlePlanTypes?: string[];
  
  /**
   * Assess whether this strategy can handle a failure
   * 
   * @param failure Failure information
   * @returns Promise resolving to assessment result
   */
  canHandle(failure: PlanFailureInfo): Promise<{
    canHandle: boolean;
    confidence: number;
    reason: string;
  }>;
  
  /**
   * Generate recovery actions for a failure
   * 
   * @param failure Failure information
   * @param context Additional context
   * @returns Promise resolving to recommended recovery actions
   */
  generateRecoveryActions(
    failure: PlanFailureInfo,
    context?: Record<string, unknown>
  ): Promise<PlanRecoveryAction[]>;
  
  /**
   * Execute a recovery action
   * 
   * @param failure Failure information
   * @param action Recovery action to execute
   * @param context Additional context
   * @returns Promise resolving to execution result
   */
  executeRecoveryAction(
    failure: PlanFailureInfo,
    action: PlanRecoveryAction,
    context?: Record<string, unknown>
  ): Promise<RecoveryExecutionResult>;
}

/**
 * Plan recovery system interface
 */
export interface PlanRecoverySystem {
  /**
   * Initialize the recovery system
   * 
   * @param options Configuration options
   * @returns Promise resolving to initialization success
   */
  initialize(options?: Record<string, unknown>): Promise<boolean>;
  
  /**
   * Register a recovery strategy
   * 
   * @param strategy Recovery strategy
   * @returns Promise resolving to success
   */
  registerRecoveryStrategy(strategy: RecoveryStrategy): Promise<boolean>;
  
  /**
   * Register a recovery policy
   * 
   * @param policy Recovery policy
   * @returns Promise resolving to success
   */
  registerRecoveryPolicy(policy: PlanRecoveryPolicy): Promise<boolean>;
  
  /**
   * Get a recovery policy by ID
   * 
   * @param policyId Policy ID
   * @returns Promise resolving to recovery policy
   */
  getRecoveryPolicy(policyId: string): Promise<PlanRecoveryPolicy | null>;
  
  /**
   * Get all recovery policies
   * 
   * @returns Promise resolving to array of recovery policies
   */
  getAllRecoveryPolicies(): Promise<PlanRecoveryPolicy[]>;
  
  /**
   * Update a recovery policy
   * 
   * @param policyId Policy ID
   * @param updates Updates to apply
   * @returns Promise resolving to success
   */
  updateRecoveryPolicy(
    policyId: string,
    updates: Partial<Omit<PlanRecoveryPolicy, 'id'>>
  ): Promise<boolean>;
  
  /**
   * Delete a recovery policy
   * 
   * @param policyId Policy ID
   * @returns Promise resolving to success
   */
  deleteRecoveryPolicy(policyId: string): Promise<boolean>;
  
  /**
   * Record a plan failure
   * 
   * @param failure Failure information
   * @returns Promise resolving to created failure record ID
   */
  recordFailure(failure: Omit<PlanFailureInfo, 'id' | 'recoveryAttempts' | 'previousRecoveryActions'>): Promise<string>;
  
  /**
   * Classify a failure
   * 
   * @param error Error object or message
   * @param context Additional context
   * @returns Promise resolving to classification result
   */
  classifyFailure(
    error: Error | string,
    context?: Record<string, unknown>
  ): Promise<{
    category: PlanFailureCategory;
    severity: PlanFailureSeverity;
    confidence: number;
    analysis: string;
  }>;
  
  /**
   * Generate a standardized error response
   * 
   * @param error Error object or message
   * @param options Additional options
   * @returns Promise resolving to standardized error response
   */
  generateStandardErrorResponse(
    error: Error | string,
    options?: {
      requestId?: string;
      resources?: string[];
      source?: string;
    }
  ): Promise<StandardErrorResponse>;
  
  /**
   * Get recovery actions for a failure
   * 
   * @param failureId Failure ID
   * @param context Additional context
   * @returns Promise resolving to recovery actions
   */
  getRecoveryActions(
    failureId: string,
    context?: Record<string, unknown>
  ): Promise<PlanRecoveryAction[]>;
  
  /**
   * Execute a recovery action
   * 
   * @param failureId Failure ID
   * @param actionType Recovery action type
   * @param parameters Action parameters
   * @returns Promise resolving to execution result
   */
  executeRecovery(
    failureId: string,
    actionType: PlanRecoveryActionType,
    parameters?: Record<string, unknown>
  ): Promise<RecoveryExecutionResult>;
  
  /**
   * Execute automatic recovery
   * 
   * @param failureId Failure ID
   * @param policyId Policy ID to use (optional)
   * @returns Promise resolving to execution result
   */
  executeAutomaticRecovery(
    failureId: string,
    policyId?: string
  ): Promise<RecoveryExecutionResult>;
  
  /**
   * Get recovery history for a plan
   * 
   * @param planId Plan ID
   * @returns Promise resolving to recovery history
   */
  getRecoveryHistory(planId: string): Promise<Array<{
    failure: PlanFailureInfo;
    recoveryActions: Array<{
      action: PlanRecoveryAction;
      result: RecoveryExecutionResult;
      timestamp: Date;
    }>;
  }>>;
  
  /**
   * Get failure statistics
   * 
   * @param timeRange Optional time range
   * @returns Promise resolving to failure statistics
   */
  getFailureStatistics(timeRange?: { start: Date; end: Date }): Promise<{
    totalFailures: number;
    failuresByCategory: Record<PlanFailureCategory, number>;
    failuresBySeverity: Record<PlanFailureSeverity, number>;
    recoverySuccessRate: number;
    averageRecoveryAttempts: number;
    mostCommonFailures: Array<{
      category: PlanFailureCategory;
      count: number;
      recoverySuccessRate: number;
    }>;
    mostEffectiveRecoveryActions: Array<{
      actionType: PlanRecoveryActionType;
      successRate: number;
      usageCount: number;
    }>;
  }>;
  
  /**
   * Shutdown the recovery system
   * 
   * @returns Promise resolving to success
   */
  shutdown(): Promise<boolean>;
} 