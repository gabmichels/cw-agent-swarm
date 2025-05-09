/**
 * Planning Manager Interface
 * 
 * This file defines the planning manager interface that provides planning capabilities
 * for agents. It extends the base manager interface with planning-specific functionality.
 */

import type { BaseManager } from '../../../../agents/shared/base/managers/BaseManager';

/**
 * Configuration options for planning managers
 */
export interface PlanningManagerConfig {
  /** Whether this manager is enabled */
  enabled: boolean;
  
  /** Default planning model to use */
  defaultModelName?: string;
  
  /** Maximum steps in a plan */
  maxSteps?: number;
  
  /** Whether to validate plans before execution */
  validatePlans?: boolean;
  
  /** Whether to allow plan revisions during execution */
  allowRevisions?: boolean;
  
  /** Default timeout for planning in milliseconds */
  planningTimeoutMs?: number;
  
  /** Whether to use structured planning format */
  useStructuredFormat?: boolean;
  
  /** Whether to save plans to memory */
  savePlansToMemory?: boolean;
}

/**
 * Planning context interface
 */
export interface PlanningContext {
  /** Goal or objective of the plan */
  goal: string;
  
  /** Available information */
  information?: string;
  
  /** Constraints to consider */
  constraints?: string[];
  
  /** Criteria for success */
  successCriteria?: string[];
  
  /** Available tools */
  availableTools?: string[];
  
  /** Maximum steps allowed */
  maxSteps?: number;
  
  /** Deadline for completion */
  deadline?: Date;
  
  /** Priority level */
  priority?: 'low' | 'medium' | 'high' | 'critical';
  
  /** Additional context */
  additionalContext?: Record<string, unknown>;
}

/**
 * Plan step interface
 */
export interface PlanStep {
  /** Step ID */
  id: string;
  
  /** Step number (1-based) */
  stepNumber: number;
  
  /** Step description */
  description: string;
  
  /** Expected outcome */
  expectedOutcome?: string;
  
  /** Tool to use (if any) */
  tool?: string;
  
  /** Tool parameters (if using a tool) */
  parameters?: Record<string, unknown>;
  
  /** Whether this step is complete */
  complete: boolean;
  
  /** Step execution result */
  result?: {
    success: boolean;
    output?: string;
    error?: string;
  };
  
  /** Estimated duration in seconds */
  estimatedDurationSec?: number;
  
  /** Actual duration in seconds */
  actualDurationSec?: number;
  
  /** Additional step metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Plan interface
 */
export interface Plan {
  /** Plan ID */
  id: string;
  
  /** Creation timestamp */
  createdAt: Date;
  
  /** Plan context */
  context: PlanningContext;
  
  /** Plan steps */
  steps: PlanStep[];
  
  /** Current step number (1-based) */
  currentStepNumber: number;
  
  /** Whether the plan is complete */
  complete: boolean;
  
  /** Whether the plan succeeded */
  succeeded?: boolean;
  
  /** Fail reason if plan failed */
  failReason?: string;
  
  /** Plan start time */
  startedAt?: Date;
  
  /** Plan completion time */
  completedAt?: Date;
  
  /** Revision history */
  revisions?: Array<{
    timestamp: Date;
    reason: string;
    previousSteps: PlanStep[];
  }>;
  
  /** Plan execution summary */
  summary?: string;
  
  /** Additional plan metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Plan revision request interface
 */
export interface PlanRevisionRequest {
  /** Plan ID to revise */
  planId: string;
  
  /** Reason for revision */
  reason: string;
  
  /** Step to revise from (inclusive) */
  fromStep: number;
  
  /** Updated context (optional) */
  updatedContext?: Partial<PlanningContext>;
  
  /** New information to consider */
  newInformation?: string;
}

/**
 * Planning manager interface
 */
export interface PlanningManager extends BaseManager {
  /**
   * Create a plan for the given context
   * @param context The planning context
   * @returns Promise resolving to the created plan
   */
  createPlan(context: PlanningContext): Promise<Plan>;
  
  /**
   * Get a plan by ID
   * @param planId The plan ID to retrieve
   * @returns Promise resolving to the plan or null if not found
   */
  getPlan(planId: string): Promise<Plan | null>;
  
  /**
   * Execute a plan
   * @param planId The plan ID to execute
   * @returns Promise resolving to the executed plan
   */
  executePlan(planId: string): Promise<Plan>;
  
  /**
   * Execute the next step of a plan
   * @param planId The plan ID to execute the next step for
   * @returns Promise resolving to the updated plan
   */
  executeNextStep(planId: string): Promise<Plan>;
  
  /**
   * Revise a plan
   * @param revisionRequest The plan revision request
   * @returns Promise resolving to the revised plan
   */
  revisePlan(revisionRequest: PlanRevisionRequest): Promise<Plan>;
  
  /**
   * Abort a plan
   * @param planId The plan ID to abort
   * @param reason The reason for aborting
   * @returns Promise resolving to true if aborted successfully
   */
  abortPlan(planId: string, reason: string): Promise<boolean>;
} 