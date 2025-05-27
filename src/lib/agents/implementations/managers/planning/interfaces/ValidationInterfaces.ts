/**
 * ValidationInterfaces.ts - Validation-specific interfaces
 * 
 * This file contains all interfaces and types related to plan and action validation,
 * including validation options, results, constraints, and configuration.
 */

import { ValidationResult, ValidationIssue } from './PlanningInterfaces';

/**
 * Plan validation options
 */
export interface PlanValidationOptions {
  /** Skip certain validation types */
  skipValidation?: {
    structure?: boolean;
    dependencies?: boolean;
    resources?: boolean;
    feasibility?: boolean;
  };
  
  /** Available resources for validation */
  availableResources?: string[];
  
  /** Context for validation */
  context?: Record<string, unknown>;
  
  /** Custom validation rules */
  customRules?: ValidationRule[];
  
  /** Validation timeout (ms) */
  timeoutMs?: number;
}

/**
 * Action validation options
 */
export interface ActionValidationOptions {
  /** Available tools for validation */
  availableTools?: string[];
  
  /** Context for precondition checking */
  context?: Record<string, unknown>;
  
  /** Safety constraints to enforce */
  safetyConstraints?: SafetyConstraint[];
  
  /** Skip certain validation types */
  skipValidation?: {
    parameters?: boolean;
    tools?: boolean;
    preconditions?: boolean;
    safety?: boolean;
  };
  
  /** Validation timeout (ms) */
  timeoutMs?: number;
}

/**
 * Dependency validation result
 */
export interface DependencyValidationResult extends ValidationResult {
  /** Detected circular dependencies */
  circularDependencies: string[];
  
  /** Missing dependencies */
  missingDependencies: string[];
  
  /** Maximum dependency depth */
  dependencyDepth: number;
  
  /** Dependency graph complexity */
  graphComplexity?: number;
}

/**
 * Resource validation result
 */
export interface ResourceValidationResult extends ValidationResult {
  /** Detected resource conflicts */
  resourceConflicts: string[];
  
  /** Unavailable resources */
  unavailableResources: string[];
  
  /** Estimated resource usage */
  estimatedResourceUsage: Record<string, number>;
  
  /** Resource optimization suggestions */
  optimizationSuggestions?: string[];
}

/**
 * Feasibility validation result
 */
export interface FeasibilityValidationResult extends ValidationResult {
  /** Plan complexity score */
  complexity: number;
  
  /** Estimated execution time (ms) */
  estimatedExecutionTime: number;
  
  /** Success probability (0-1) */
  successProbability: number;
  
  /** Identified risk factors */
  riskFactors: string[];
  
  /** Feasibility score (0-1) */
  feasibilityScore?: number;
}

/**
 * Safety constraint definition
 */
export interface SafetyConstraint {
  /** Constraint name */
  name: string;
  
  /** Constraint type */
  type: 'parameter' | 'tool' | 'resource' | 'permission';
  
  /** Constraint rule */
  rule: string;
  
  /** Error message if violated */
  errorMessage: string;
  
  /** Severity of violation */
  severity: 'error' | 'warning';
  
  /** Additional constraint metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Custom validation rule
 */
export interface ValidationRule {
  /** Rule name */
  name: string;
  
  /** Rule type */
  type: 'structure' | 'dependency' | 'resource' | 'feasibility' | 'custom';
  
  /** Rule function */
  validate: (target: unknown, context?: Record<string, unknown>) => ValidationRuleResult;
  
  /** Rule description */
  description?: string;
  
  /** Rule severity */
  severity: 'error' | 'warning' | 'info';
}

/**
 * Validation rule result
 */
export interface ValidationRuleResult {
  /** Whether the rule passed */
  passed: boolean;
  
  /** Error message if failed */
  message?: string;
  
  /** Suggested fix */
  suggestedFix?: string;
  
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Validation configuration
 */
export interface ValidationConfig {
  /** Enable structure validation */
  enableStructureValidation: boolean;
  
  /** Enable dependency validation */
  enableDependencyValidation: boolean;
  
  /** Enable resource validation */
  enableResourceValidation: boolean;
  
  /** Enable feasibility validation */
  enableFeasibilityValidation: boolean;
  
  /** Enable safety validation */
  enableSafetyValidation: boolean;
  
  /** Enable logging */
  enableLogging: boolean;
  
  /** Validation timeout (ms) */
  validationTimeoutMs: number;
  
  /** Confidence threshold */
  confidenceThreshold: number;
  
  /** Maximum complexity allowed */
  maxComplexity: number;
}

/**
 * Plan validator configuration
 */
export interface PlanValidatorConfig extends ValidationConfig {
  /** Enable feasibility analysis */
  enableFeasibilityAnalysis: boolean;
  
  /** Maximum steps per plan */
  maxStepsPerPlan: number;
  
  /** Maximum actions per step */
  maxActionsPerStep: number;
  
  /** Maximum plan complexity allowed */
  maxPlanComplexity: number;
}

/**
 * Action validator configuration
 */
export interface ActionValidatorConfig extends ValidationConfig {
  /** Enable parameter validation */
  enableParameterValidation: boolean;
  
  /** Enable tool availability checking */
  enableToolAvailabilityCheck: boolean;
  
  /** Enable precondition checking */
  enablePreconditionCheck: boolean;
  
  /** Maximum parameter count per action */
  maxParametersPerAction: number;
}

/**
 * Validation history entry
 */
export interface ValidationHistoryEntry {
  /** Validation ID */
  validationId: string;
  
  /** Target ID (plan or action) */
  targetId: string;
  
  /** Target type */
  targetType: 'plan' | 'action';
  
  /** Validation timestamp */
  timestamp: Date;
  
  /** Validation result */
  result: ValidationResult;
  
  /** Validation options used */
  options?: PlanValidationOptions | ActionValidationOptions;
  
  /** Validation duration (ms) */
  duration: number;
}

/**
 * Validation metrics
 */
export interface ValidationMetrics {
  /** Total validations performed */
  totalValidations: number;
  
  /** Successful validations */
  successfulValidations: number;
  
  /** Failed validations */
  failedValidations: number;
  
  /** Average validation time (ms) */
  averageValidationTime: number;
  
  /** Most common issues */
  commonIssues: Array<{
    message: string;
    count: number;
    severity: 'error' | 'warning' | 'info';
  }>;
  
  /** Validation success rate */
  successRate: number;
}

/**
 * Validation report
 */
export interface ValidationReport {
  /** Report ID */
  reportId: string;
  
  /** Report timestamp */
  timestamp: Date;
  
  /** Validation metrics */
  metrics: ValidationMetrics;
  
  /** Recent validation history */
  recentValidations: ValidationHistoryEntry[];
  
  /** Validation trends */
  trends: {
    successRateOverTime: Array<{ timestamp: Date; rate: number }>;
    averageTimeOverTime: Array<{ timestamp: Date; time: number }>;
    issueFrequency: Array<{ issue: string; frequency: number }>;
  };
  
  /** Recommendations */
  recommendations: string[];
}

/**
 * Validation health status
 */
export interface ValidationHealthStatus {
  /** Overall health status */
  healthy: boolean;
  
  /** Health score (0-1) */
  healthScore: number;
  
  /** Active validators count */
  activeValidators: number;
  
  /** Validation history size */
  validationHistorySize: number;
  
  /** Safety constraints count */
  safetyConstraintsCount: number;
  
  /** Current configuration */
  config: ValidationConfig;
  
  /** Health issues */
  issues: string[];
  
  /** Last health check timestamp */
  lastHealthCheck: Date;
}

/**
 * Validation event
 */
export interface ValidationEvent {
  /** Event ID */
  eventId: string;
  
  /** Event type */
  type: 'validation_started' | 'validation_completed' | 'validation_failed' | 'constraint_violated';
  
  /** Event timestamp */
  timestamp: Date;
  
  /** Target ID */
  targetId: string;
  
  /** Target type */
  targetType: 'plan' | 'action';
  
  /** Event data */
  data: Record<string, unknown>;
  
  /** Event severity */
  severity: 'info' | 'warning' | 'error';
}

/**
 * Validation listener
 */
export interface ValidationListener {
  /** Handle validation event */
  onValidationEvent(event: ValidationEvent): void | Promise<void>;
}

/**
 * Validation context
 */
export interface ValidationContext {
  /** Validation session ID */
  sessionId: string;
  
  /** Validation timestamp */
  timestamp: Date;
  
  /** Validator instance ID */
  validatorId: string;
  
  /** Validation options */
  options: PlanValidationOptions | ActionValidationOptions;
  
  /** Context data */
  data: Record<string, unknown>;
  
  /** Parent validation context (for nested validations) */
  parent?: ValidationContext;
} 