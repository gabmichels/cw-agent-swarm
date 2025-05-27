/**
 * PlanningInterfaces.ts - Core planning interfaces
 * 
 * These interfaces define the contracts for the core planning functionality
 * including plan creation, step generation, and action management.
 */

import { 
  Plan, 
  PlanStep, 
  PlanAction,
  PlanCreationOptions,
  PlanCreationResult 
} from '../../../../../../agents/shared/base/managers/PlanningManager.interface';

/**
 * Configuration for plan creation behavior
 */
export interface PlanCreationConfig {
  /** Maximum number of steps per plan */
  maxStepsPerPlan: number;
  
  /** Maximum number of actions per step */
  maxActionsPerStep: number;
  
  /** Default confidence threshold for plan acceptance */
  confidenceThreshold: number;
  
  /** Whether to enable plan optimization */
  enableOptimization: boolean;
  
  /** Whether to enable plan validation */
  enableValidation: boolean;
  
  /** Timeout for plan creation (ms) */
  creationTimeoutMs: number;
}

/**
 * Options for step generation
 */
export interface StepGenerationOptions {
  /** Context from previous steps */
  previousSteps?: PlanStep[];
  
  /** Available resources */
  availableResources?: Record<string, unknown>;
  
  /** Time constraints */
  timeConstraints?: {
    maxDuration?: number;
    deadline?: Date;
  };
  
  /** Quality requirements */
  qualityRequirements?: {
    minConfidence?: number;
    requireValidation?: boolean;
  };
}

/**
 * Result of step generation
 */
export interface StepGenerationResult {
  /** Generated steps */
  steps: PlanStep[];
  
  /** Overall confidence in the steps */
  confidence: number;
  
  /** Estimated total time */
  estimatedTime?: number;
  
  /** Resource requirements */
  resourceRequirements?: Record<string, unknown>;
  
  /** Validation results if performed */
  validationResults?: ValidationResult[];
}

/**
 * Options for action generation
 */
export interface ActionGenerationOptions {
  /** Available tools */
  availableTools?: string[];
  
  /** Context from the step */
  stepContext?: Record<string, unknown>;
  
  /** Previous action results */
  previousResults?: unknown[];
  
  /** Resource constraints */
  resourceConstraints?: Record<string, unknown>;
}

/**
 * Result of action generation
 */
export interface ActionGenerationResult {
  /** Generated actions */
  actions: PlanAction[];
  
  /** Confidence in the actions */
  confidence: number;
  
  /** Estimated execution time */
  estimatedTime?: number;
  
  /** Required tools */
  requiredTools?: string[];
  
  /** Dependencies between actions */
  dependencies?: ActionDependency[];
}

/**
 * Dependency between actions
 */
export interface ActionDependency {
  /** ID of the action that depends */
  dependentActionId: string;
  
  /** ID of the action being depended on */
  dependsOnActionId: string;
  
  /** Type of dependency */
  type: 'sequential' | 'data' | 'resource';
  
  /** Description of the dependency */
  description?: string;
}

/**
 * Validation result for plans, steps, or actions
 */
export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  
  /** Validation score (0-1) */
  score: number;
  
  /** Issues found during validation */
  issues: ValidationIssue[];
  
  /** Suggestions for improvement */
  suggestions?: string[];
  
  /** Additional validation metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Individual validation issue
 */
export interface ValidationIssue {
  /** Severity of the issue */
  severity: 'error' | 'warning' | 'info';
  
  /** Issue message */
  message: string;
  
  /** Location of the issue */
  location?: {
    stepId?: string;
    actionId?: string;
    field?: string;
    index?: number;
  };
  
  /** Suggested fix */
  suggestedFix?: string;
}

/**
 * Interface for creating plans from goals
 */
export interface PlanCreator {
  /**
   * Create a plan from a goal description
   */
  createPlan(
    goal: string,
    options?: PlanCreationOptions
  ): Promise<PlanCreationResult>;
  
  /**
   * Configure plan creation behavior
   */
  configure(config: Partial<PlanCreationConfig>): void;
  
  /**
   * Get current configuration
   */
  getConfig(): PlanCreationConfig;
}

/**
 * Interface for generating plan steps
 */
export interface StepGenerator {
  /**
   * Generate steps for a plan
   */
  generateSteps(
    goal: string,
    context?: Record<string, unknown>,
    options?: StepGenerationOptions
  ): Promise<StepGenerationResult>;
  
  /**
   * Refine existing steps
   */
  refineSteps(
    steps: PlanStep[],
    feedback?: string,
    options?: StepGenerationOptions
  ): Promise<StepGenerationResult>;
}

/**
 * Interface for generating plan actions
 */
export interface ActionGenerator {
  /**
   * Generate actions for a step
   */
  generateActions(
    step: PlanStep,
    options?: ActionGenerationOptions
  ): Promise<ActionGenerationResult>;
  
  /**
   * Optimize action sequence
   */
  optimizeActions(
    actions: PlanAction[],
    constraints?: Record<string, unknown>
  ): Promise<ActionGenerationResult>;
}

/**
 * Interface for plan validation
 */
export interface PlanValidator {
  /**
   * Validate a complete plan
   */
  validatePlan(plan: Plan): Promise<ValidationResult>;
  
  /**
   * Validate plan steps
   */
  validateSteps(steps: PlanStep[]): Promise<ValidationResult>;
  
  /**
   * Validate plan actions
   */
  validateActions(actions: PlanAction[]): Promise<ValidationResult>;
  
  /**
   * Check for dependency cycles
   */
  checkDependencyCycles(plan: Plan): Promise<boolean>;
}

/**
 * Interface for action validation
 */
export interface ActionValidator {
  /**
   * Validate a single action
   */
  validateAction(action: PlanAction): Promise<ValidationResult>;
  
  /**
   * Validate action parameters
   */
  validateParameters(
    action: PlanAction,
    availableTools?: string[]
  ): Promise<ValidationResult>;
  
  /**
   * Check action preconditions
   */
  checkPreconditions(
    action: PlanAction,
    context?: Record<string, unknown>
  ): Promise<boolean>;
}

/**
 * Configuration for plan optimization
 */
export interface OptimizationConfig {
  /** Optimization objectives */
  objectives: OptimizationObjective[];
  
  /** Maximum optimization iterations */
  maxIterations: number;
  
  /** Convergence threshold */
  convergenceThreshold: number;
  
  /** Whether to preserve plan semantics */
  preserveSemantics: boolean;
}

/**
 * Optimization objective
 */
export interface OptimizationObjective {
  /** Type of optimization */
  type: 'time' | 'resource' | 'reliability' | 'cost';
  
  /** Weight of this objective (0-1) */
  weight: number;
  
  /** Target value if applicable */
  target?: number;
}

/**
 * Result of plan optimization
 */
export interface OptimizationResult {
  /** Optimized plan */
  optimizedPlan: Plan;
  
  /** Improvement metrics */
  improvements: Record<string, number>;
  
  /** Number of iterations performed */
  iterations: number;
  
  /** Whether optimization converged */
  converged: boolean;
  
  /** Optimization metadata */
  metadata: Record<string, unknown>;
}

/**
 * Interface for plan optimization
 */
export interface PlanOptimizer {
  /**
   * Optimize a plan according to objectives
   */
  optimizePlan(
    plan: Plan,
    config?: OptimizationConfig
  ): Promise<OptimizationResult>;
  
  /**
   * Estimate optimization potential
   */
  estimateImprovements(
    plan: Plan,
    objectives: OptimizationObjective[]
  ): Promise<Record<string, number>>;
} 