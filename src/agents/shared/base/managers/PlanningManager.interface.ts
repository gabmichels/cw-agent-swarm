/**
 * PlanningManager.interface.ts - Planning Manager Interface
 * 
 * This file defines the planning manager interface that provides planning services
 * for agents. It extends the base manager interface with planning-specific functionality.
 */

import { BaseManager, ManagerConfig } from './BaseManager';

/**
 * Configuration options for planning managers
 */
export interface PlanningManagerConfig extends ManagerConfig {
  /** Whether to enable automatic planning */
  enableAutoPlanning?: boolean;
  
  /** Interval for automatic planning in milliseconds */
  planningIntervalMs?: number;
  
  /** Maximum number of plans that can be active simultaneously */
  maxConcurrentPlans?: number;
  
  /** Maximum number of adaptation attempts for a plan */
  maxAdaptationAttempts?: number;
}

/**
 * Plan step action structure
 */
export interface PlanAction {
  /** Unique identifier for this action */
  id: string;
  
  /** Action name */
  name: string;
  
  /** Action description */
  description: string;
  
  /** The type of action */
  type: string;
  
  /** Parameters for the action */
  parameters: Record<string, unknown>;
  
  /** Expected result of the action */
  expectedResult?: unknown;
  
  /** Actual result of the action (after execution) */
  result?: unknown;
  
  /** Action status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  
  /** When this action was created */
  createdAt: Date;
  
  /** When this action was last updated */
  updatedAt: Date;
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
  
  /** Step priority (0-1) */
  priority: number;
  
  /** Dependencies on other steps */
  dependencies: string[];
  
  /** Actions to perform in this step */
  actions: PlanAction[];
  
  /** Step status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  
  /** When this step was created */
  createdAt: Date;
  
  /** When this step was last updated */
  updatedAt: Date;

  /** Required tools for this step */
  requiredTools?: string[];

  /** Estimated time in minutes */
  estimatedTimeMinutes?: number;
}

/**
 * Plan interface
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
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'adapted' | 'optimized';
  
  /** Plan priority (0-1) */
  priority: number;
  
  /** Confidence in the plan (0-1) */
  confidence: number;
  
  /** When this plan was created */
  createdAt: Date;
  
  /** When this plan was last updated */
  updatedAt: Date;
  
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Options for creating a plan
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
  
  /** Whether to generate steps automatically */
  generateSteps?: boolean;
  
  /** Context for plan generation */
  context?: Record<string, any>;
  
  /** Visualization object for tracking thinking process */
  visualization?: any;
  
  /** Visualizer service for creating visualization nodes */
  visualizer?: any;
}

/**
 * Result of creating a plan
 */
export interface PlanCreationResult {
  /** Whether the operation was successful */
  success: boolean;
  
  /** The created plan (if successful) */
  plan?: Plan;
  
  /** Error message (if unsuccessful) */
  error?: string;
}

/**
 * Result of executing a plan
 */
export interface PlanExecutionResult {
  /** Whether the operation was successful */
  success: boolean;
  
  /** The executed plan (if successful) */
  plan?: Plan;
  
  /** Error message (if unsuccessful) */
  error?: string;
}

/**
 * Planning manager interface
 */
export interface PlanningManager extends BaseManager {
  /**
   * Create a new plan
   * @param options Options for creating the plan
   * @returns Promise resolving to the result of creating the plan
   */
  createPlan(options: PlanCreationOptions): Promise<PlanCreationResult>;
  
  /**
   * Get a plan by ID
   * @param planId The ID of the plan to retrieve
   * @returns Promise resolving to the plan or null if not found
   */
  getPlan(planId: string): Promise<Plan | null>;
  
  /**
   * Get all plans
   * @returns Promise resolving to all plans
   */
  getAllPlans(): Promise<Plan[]>;
  
  /**
   * Update a plan
   * @param planId The ID of the plan to update
   * @param updates The updates to apply
   * @returns Promise resolving to the updated plan or null if not found
   */
  updatePlan(planId: string, updates: Partial<Plan>): Promise<Plan | null>;
  
  /**
   * Delete a plan
   * @param planId The ID of the plan to delete
   * @returns Promise resolving to true if deleted or false if not found
   */
  deletePlan(planId: string): Promise<boolean>;
  
  /**
   * Execute a plan
   * @param planId The ID of the plan to execute
   * @returns Promise resolving to the result of executing the plan
   */
  executePlan(planId: string): Promise<PlanExecutionResult>;
  
  /**
   * Adapt a plan
   * @param planId The ID of the plan to adapt
   * @param reason The reason for adaptation
   * @returns Promise resolving to the adapted plan or null if not found
   */
  adaptPlan(planId: string, reason: string): Promise<Plan | null>;
  
  /**
   * Validate a plan
   * @param planId The ID of the plan to validate
   * @returns Promise resolving to true if valid or false if invalid
   */
  validatePlan(planId: string): Promise<boolean>;
  
  /**
   * Optimize a plan
   * @param planId The ID of the plan to optimize
   * @returns Promise resolving to the optimized plan or null if not found
   */
  optimizePlan(planId: string): Promise<Plan | null>;
} 