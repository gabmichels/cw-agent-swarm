/**
 * Planning Manager Interface
 * 
 * This file defines the planning manager interface that provides planning services
 * for agents. It extends the base manager interface with planning-specific functionality.
 */

import type { BaseManager, ManagerConfig } from '../../../../agents/shared/base/managers/BaseManager';
import type { AgentBase } from '../../../../agents/shared/base/AgentBase';

/**
 * Configuration options for planning managers
 */
export interface PlanningManagerConfig extends ManagerConfig {
  /** Whether this manager is enabled */
  enabled: boolean;
  
  /** Whether to enable automatic goal planning */
  enableAutoPlanning?: boolean;
  
  /** Interval for automatic planning in milliseconds */
  planningIntervalMs?: number;
  
  /** Maximum number of concurrent plans */
  maxConcurrentPlans?: number;
  
  /** Minimum confidence threshold for plan execution */
  minConfidenceThreshold?: number;
  
  /** Whether to enable plan adaptation */
  enablePlanAdaptation?: boolean;
  
  /** Maximum number of plan adaptation attempts */
  maxAdaptationAttempts?: number;
  
  /** Whether to enable plan validation */
  enablePlanValidation?: boolean;
  
  /** Whether to enable plan optimization */
  enablePlanOptimization?: boolean;
}

/**
 * Plan structure
 */
export interface Plan {
  /** Unique identifier for this plan */
  id: string;
  
  /** Plan name */
  name: string;
  
  /** Plan description */
  description: string;
  
  /** Plan goals */
  goals: string[];
  
  /** Plan steps */
  steps: PlanStep[];
  
  /** Plan status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'adapted';
  
  /** Plan priority (0-1) */
  priority: number;
  
  /** Plan confidence (0-1) */
  confidence: number;
  
  /** When this plan was created */
  createdAt: Date;
  
  /** When this plan was last updated */
  updatedAt: Date;
  
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Plan step structure
 */
export interface PlanStep {
  /** Unique identifier for this step */
  id: string;
  
  /** Step name */
  name: string;
  
  /** Step description */
  description: string;
  
  /** Step status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  
  /** Step dependencies */
  dependencies: string[];
  
  /** Step actions */
  actions: PlanAction[];
  
  /** Step priority (0-1) */
  priority: number;
  
  /** When this step was created */
  createdAt: Date;
  
  /** When this step was last updated */
  updatedAt: Date;
}

/**
 * Plan action structure
 */
export interface PlanAction {
  /** Unique identifier for this action */
  id: string;
  
  /** Action name */
  name: string;
  
  /** Action description */
  description: string;
  
  /** Action type */
  type: string;
  
  /** Action parameters */
  parameters: Record<string, unknown>;
  
  /** Action status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  
  /** When this action was created */
  createdAt: Date;
  
  /** When this action was last updated */
  updatedAt: Date;
}

/**
 * Options for plan creation
 */
export interface PlanCreationOptions {
  /** Plan name */
  name: string;
  
  /** Plan description */
  description: string;
  
  /** Plan goals */
  goals: string[];
  
  /** Plan priority (0-1) */
  priority?: number;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of plan creation
 */
export interface PlanCreationResult {
  /** Whether the operation was successful */
  success: boolean;
  
  /** Created plan */
  plan?: Plan;
  
  /** Error message if unsuccessful */
  error?: string;
}

/**
 * Result of plan execution
 */
export interface PlanExecutionResult {
  /** Whether the operation was successful */
  success: boolean;
  
  /** Updated plan */
  plan?: Plan;
  
  /** Error message if unsuccessful */
  error?: string;
}

/**
 * Planning manager interface
 */
export interface PlanningManager extends BaseManager {
  /**
   * Create a new plan
   * @param options Plan creation options
   * @returns Promise resolving to the creation result
   */
  createPlan(options: PlanCreationOptions): Promise<PlanCreationResult>;
  
  /**
   * Get a plan by ID
   * @param planId Plan ID
   * @returns Promise resolving to the plan
   */
  getPlan(planId: string): Promise<Plan | null>;
  
  /**
   * Get all plans
   * @returns Promise resolving to all plans
   */
  getAllPlans(): Promise<Plan[]>;
  
  /**
   * Update a plan
   * @param planId Plan ID
   * @param updates Plan updates
   * @returns Promise resolving to the updated plan
   */
  updatePlan(planId: string, updates: Partial<Plan>): Promise<Plan | null>;
  
  /**
   * Delete a plan
   * @param planId Plan ID
   * @returns Promise resolving to whether the deletion was successful
   */
  deletePlan(planId: string): Promise<boolean>;
  
  /**
   * Execute a plan
   * @param planId Plan ID
   * @returns Promise resolving to the execution result
   */
  executePlan(planId: string): Promise<PlanExecutionResult>;
  
  /**
   * Adapt a plan
   * @param planId Plan ID
   * @param reason Adaptation reason
   * @returns Promise resolving to the adapted plan
   */
  adaptPlan(planId: string, reason: string): Promise<Plan | null>;
  
  /**
   * Validate a plan
   * @param planId Plan ID
   * @returns Promise resolving to whether the plan is valid
   */
  validatePlan(planId: string): Promise<boolean>;
  
  /**
   * Optimize a plan
   * @param planId Plan ID
   * @returns Promise resolving to the optimized plan
   */
  optimizePlan(planId: string): Promise<Plan | null>;
}

/**
 * PlanningManager.ts - Bridge export for Planning Manager types
 * 
 * This file re-exports the PlanningManager interface and related types
 * to maintain compatibility across the codebase.
 */

// Re-export everything from the shared implementation
export * from '../../../../agents/shared/base/managers/PlanningManager.interface'; 