import { PlanWithSteps, PlanStep, ExecutionResult } from './agentTypes';

/**
 * Represents the reason for plan adaptation
 */
export type PlanAdaptationReason = 
  | 'STEP_FAILURE'           // A step in the plan failed
  | 'RESOURCE_CONSTRAINT'    // Resource constraints require plan modification
  | 'NEW_INFORMATION'        // New information requires plan modification
  | 'OPTIMIZATION'           // Plan can be optimized
  | 'DEPENDENCY_CHANGE'      // Dependencies have changed
  | 'TIMEOUT'                // Plan is taking too long
  | 'PRIORITY_CHANGE'        // Priorities have changed
  | 'EXTERNAL_EVENT';        // External event requires plan modification

/**
 * Represents the type of plan adaptation
 */
export type PlanAdaptationType =
  | 'REORDER'               // Reorder steps
  | 'REPLACE'               // Replace steps
  | 'ADD'                   // Add new steps
  | 'REMOVE'                // Remove steps
  | 'MERGE'                 // Merge steps
  | 'SPLIT'                 // Split steps
  | 'OPTIMIZE'              // Optimize step parameters
  | 'RESTRUCTURE';          // Restructure the entire plan

/**
 * Interface for plan adaptation request
 */
export interface PlanAdaptationRequest {
  plan: PlanWithSteps;
  reason: PlanAdaptationReason;
  context: {
    failedStepId?: string;
    resourceConstraints?: {
      timeRemaining?: number;
      memoryAvailable?: number;
      cpuAvailable?: number;
    };
    newInformation?: {
      source: string;
      content: string;
      relevance: number;
    };
    priorityChanges?: {
      newPriorities: string[];
      removedPriorities: string[];
    };
    externalEvents?: Array<{
      type: string;
      description: string;
      impact: 'high' | 'medium' | 'low';
    }>;
  };
  constraints?: {
    maxSteps?: number;
    timeLimit?: number;
    resourceLimit?: number;
    mustIncludeSteps?: string[];
    mustExcludeSteps?: string[];
  };
}

/**
 * Interface for plan adaptation result
 */
export interface PlanAdaptationResult {
  success: boolean;
  adaptedPlan: PlanWithSteps;
  changes: Array<{
    type: PlanAdaptationType;
    description: string;
    affectedSteps: string[];
    reason: string;
  }>;
  metrics: {
    originalStepCount: number;
    newStepCount: number;
    estimatedTimeChange: number;
    confidence: number;
  };
  error?: string;
}

/**
 * Interface for plan optimization request
 */
export interface PlanOptimizationRequest {
  plan: PlanWithSteps;
  optimizationGoals: Array<{
    type: 'TIME' | 'RESOURCE' | 'RELIABILITY' | 'EFFICIENCY';
    priority: number;
    target?: number;
  }>;
  constraints?: {
    maxOptimizationTime?: number;
    minStepReliability?: number;
    resourceLimits?: {
      maxMemory?: number;
      maxCpu?: number;
      maxConcurrentSteps?: number;
    };
  };
}

/**
 * Interface for plan optimization result
 */
export interface PlanOptimizationResult {
  success: boolean;
  optimizedPlan: PlanWithSteps;
  improvements: Array<{
    type: 'TIME' | 'RESOURCE' | 'RELIABILITY' | 'EFFICIENCY';
    before: number;
    after: number;
    improvement: number;
    confidence: number;
  }>;
  metrics: {
    optimizationTime: number;
    stepCount: number;
    estimatedTotalTime: number;
    estimatedResourceUsage: number;
    reliabilityScore: number;
  };
  error?: string;
}

/**
 * Interface for plan validation request
 */
export interface PlanValidationRequest {
  plan: PlanWithSteps;
  validationRules: Array<{
    type: 'DEPENDENCY' | 'RESOURCE' | 'TIMING' | 'LOGIC';
    rule: string;
    severity: 'ERROR' | 'WARNING' | 'INFO';
  }>;
}

/**
 * Interface for plan validation result
 */
export interface PlanValidationResult {
  valid: boolean;
  errors: Array<{
    type: 'DEPENDENCY' | 'RESOURCE' | 'TIMING' | 'LOGIC';
    rule: string;
    severity: 'ERROR' | 'WARNING' | 'INFO';
    message: string;
    affectedSteps: string[];
  }>;
  warnings: Array<{
    type: 'DEPENDENCY' | 'RESOURCE' | 'TIMING' | 'LOGIC';
    rule: string;
    message: string;
    affectedSteps: string[];
  }>;
}

/**
 * Interface for plan adaptation and optimization manager
 */
export interface PlanAdaptationManager {
  // Core methods
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  
  // Plan adaptation
  adaptPlan(request: PlanAdaptationRequest): Promise<PlanAdaptationResult>;
  
  // Plan optimization
  optimizePlan(request: PlanOptimizationRequest): Promise<PlanOptimizationResult>;
  
  // Plan validation
  validatePlan(request: PlanValidationRequest): Promise<PlanValidationResult>;
  
  // Utility methods
  canAdaptPlan(plan: PlanWithSteps, reason: PlanAdaptationReason): Promise<boolean>;
  canOptimizePlan(plan: PlanWithSteps): Promise<boolean>;
  getAdaptationHistory(planId: string): Promise<PlanAdaptationResult[]>;
  getOptimizationHistory(planId: string): Promise<PlanOptimizationResult[]>;
  
  // Metrics and monitoring
  getMetrics(): Promise<{
    totalAdaptations: number;
    successfulAdaptations: number;
    totalOptimizations: number;
    successfulOptimizations: number;
    averageAdaptationTime: number;
    averageOptimizationTime: number;
  }>;
} 