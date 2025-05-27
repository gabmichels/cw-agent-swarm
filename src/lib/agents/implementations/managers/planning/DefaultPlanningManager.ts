/**
 * DefaultPlanningManager.ts - Refactored planning manager using specialized components
 * 
 * This file provides a clean, component-based implementation of the PlanningManager interface
 * that delegates to specialized components for task creation, execution, creation, adaptation,
 * and validation. This replaces the monolithic 2,008-line implementation.
 */

import { ulid } from 'ulid';
import { 
  PlanningManager, 
  PlanningManagerConfig,
  Plan,
  PlanStep,
  PlanAction,
  PlanCreationOptions,
  PlanCreationResult,
  PlanExecutionResult
} from '../../../../../agents/shared/base/managers/PlanningManager.interface';
import { ManagerConfig } from '../../../../../agents/shared/base/managers/BaseManager';
import { AgentBase } from '../../../../../agents/shared/base/AgentBase.interface';
import { AbstractBaseManager } from '../../../../../agents/shared/base/managers/BaseManager';
import { ManagerType } from '../../../../../agents/shared/base/managers/ManagerType';
import { ManagerHealth } from '../../../../../agents/shared/base/managers/ManagerHealth';
import { createLogger } from '../../../../logging/winston-logger';

// Import specialized components
import { AutoTaskCreator } from './task-creation/AutoTaskCreator';
import { PlanExecutor } from './execution/PlanExecutor';
import { ActionExecutor } from './execution/ActionExecutor';
import { ExecutionResultProcessor } from './execution/ExecutionResultProcessor';
import { PlanCreator } from './creation/PlanCreator';
import { StepGenerator } from './creation/StepGenerator';
import { ActionGenerator } from './creation/ActionGenerator';
import { StepAdapter } from './adaptation/StepAdapter';
import { PlanOptimizer } from './adaptation/PlanOptimizer';
import { PlanValidator } from './validation/PlanValidator';
import { ActionValidator } from './validation/ActionValidator';

// Import interfaces
import { 
  PlanCreationConfig,
  StepGenerationOptions,
  ActionGenerationOptions,
  OptimizationConfig
} from './interfaces/PlanningInterfaces';
import {
  PlanValidationOptions,
  ActionValidationOptions
} from './interfaces/ValidationInterfaces';

/**
 * Configuration for the DefaultPlanningManager
 */
export interface DefaultPlanningManagerConfig extends PlanningManagerConfig {
  /** Enable automatic task creation */
  enableAutoTaskCreation?: boolean;
  
  /** Enable plan optimization */
  enableOptimization?: boolean;
  
  /** Enable plan validation */
  enableValidation?: boolean;
  
  /** Enable step adaptation */
  enableAdaptation?: boolean;
  
  /** Maximum concurrent plan executions */
  maxConcurrentExecutions?: number;
  
  /** Plan creation timeout (ms) */
  planCreationTimeoutMs?: number;
  
  /** Plan execution timeout (ms) */
  planExecutionTimeoutMs?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: DefaultPlanningManagerConfig = {
  enabled: true,
  enableAutoPlanning: true,
  planningIntervalMs: 300000,
  maxConcurrentPlans: 5,
  maxAdaptationAttempts: 3,
  enableAutoTaskCreation: true,
  enableOptimization: true,
  enableValidation: true,
  enableAdaptation: true,
  maxConcurrentExecutions: 3,
  planCreationTimeoutMs: 60000,
  planExecutionTimeoutMs: 300000
};

/**
 * Planning error class
 */
export class PlanningError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly planId?: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'PlanningError';
  }
}

/**
 * Refactored DefaultPlanningManager using specialized components
 */
export class DefaultPlanningManager extends AbstractBaseManager implements PlanningManager {
  private readonly logger = createLogger({ moduleId: 'default-planning-manager' });
  private readonly config: DefaultPlanningManagerConfig;
  
  // Plan storage
  private plans: Map<string, Plan> = new Map();
  private executingPlans: Set<string> = new Set();
  
  // Specialized components
  private autoTaskCreator!: AutoTaskCreator;
  private planExecutor!: PlanExecutor;
  private actionExecutor!: ActionExecutor;
  private executionResultProcessor!: ExecutionResultProcessor;
  private planCreator!: PlanCreator;
  private stepGenerator!: StepGenerator;
  private actionGenerator!: ActionGenerator;
  private stepAdapter!: StepAdapter;
  private planOptimizer!: PlanOptimizer;
  private planValidator!: PlanValidator;
  private actionValidator!: ActionValidator;

  constructor(agent: AgentBase, config: Partial<DefaultPlanningManagerConfig> = {}) {
    const managerId = `planning-manager-${ulid()}`;
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    
    super(managerId, ManagerType.PLANNING, agent, mergedConfig);
    
    this.config = mergedConfig;
    
    // Initialize specialized components
    this.initializeComponents();
    
    this.logger.info('DefaultPlanningManager initialized', {
      managerId,
      config: this.config
    });
  }

  /**
   * Initialize all specialized components
   */
  private initializeComponents(): void {
    try {
      // Task creation components
      this.autoTaskCreator = new AutoTaskCreator({
        confidenceThreshold: 0.7
      });

      // Execution components
      this.actionExecutor = new ActionExecutor({
        defaultMaxRetries: 3
      });

      this.planExecutor = new PlanExecutor({
        enableLogging: true,
        maxExecutionTimeMs: this.config.planExecutionTimeoutMs || 300000
      }, this.actionExecutor);

      this.executionResultProcessor = new ExecutionResultProcessor({
        enableLogging: true,
        enableCaching: true,
        cacheTtlMs: 300000
      });

      // Creation components
      this.stepGenerator = new StepGenerator();
      this.actionGenerator = new ActionGenerator();
      
      this.planCreator = new PlanCreator({
        maxStepsPerPlan: this.config.maxConcurrentPlans || 5,
        maxActionsPerStep: 10,
        confidenceThreshold: 0.7,
        enableOptimization: this.config.enableOptimization || true,
        enableValidation: this.config.enableValidation || true,
        creationTimeoutMs: this.config.planCreationTimeoutMs || 60000
      }, this.stepGenerator);

      // Adaptation components
      this.stepAdapter = new StepAdapter({
        enableLogging: true,
        confidenceThreshold: 0.7
      });

      this.planOptimizer = new PlanOptimizer({
        enableLogging: true,
        maxOptimizationIterations: 5,
        improvementThreshold: 0.01
      });

      // Validation components
      this.planValidator = new PlanValidator({
        enableStructureValidation: true,
        enableDependencyValidation: true,
        enableResourceValidation: true,
        enableFeasibilityValidation: true,
        enableSafetyValidation: true,
        enableLogging: true,
        validationTimeoutMs: 30000,
        confidenceThreshold: 0.7,
        maxComplexity: 10,
        enableFeasibilityAnalysis: true,
        maxStepsPerPlan: 50,
        maxActionsPerStep: 20,
        maxPlanComplexity: 10
      });

      this.actionValidator = new ActionValidator({
        enableParameterValidation: true,
        enableToolAvailabilityCheck: true,
        enablePreconditionCheck: true,
        enableSafetyValidation: true,
        enableLogging: true,
        validationTimeoutMs: 10000,
        confidenceThreshold: 0.7,
        maxParametersPerAction: 20
      });

      this.logger.info('All specialized components initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize specialized components', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new PlanningError(
        'Failed to initialize planning components',
        'COMPONENT_INITIALIZATION_FAILED',
        undefined,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Get manager health status
   */
  async getHealth(): Promise<ManagerHealth> {
    if (!this._initialized) {
      return {
        status: 'degraded',
        details: {
          lastCheck: new Date(),
          issues: [{
            severity: 'high',
            message: 'Planning manager not initialized',
            detectedAt: new Date()
          }],
          metrics: {}
        }
      };
    }

    if (!this.isEnabled()) {
      return {
        status: 'unhealthy',
        details: {
          lastCheck: new Date(),
          issues: [{
            severity: 'critical',
            message: 'Planning manager is disabled',
            detectedAt: new Date()
          }],
          metrics: {}
        }
      };
    }

    // Check component health
    const componentHealth = [
      this.planCreator.getHealthStatus(),
      this.planExecutor.getHealthStatus(),
      this.planValidator.getHealthStatus(),
      this.actionValidator.getHealthStatus(),
      this.planOptimizer.getHealthStatus(),
      this.stepAdapter.getHealthStatus()
    ];

    const unhealthyComponents = componentHealth.filter(health => !health.healthy);
    
    if (unhealthyComponents.length > 0) {
      return {
        status: 'degraded',
        details: {
          lastCheck: new Date(),
          issues: [{
            severity: 'medium',
            message: `${unhealthyComponents.length} components are unhealthy`,
            detectedAt: new Date()
          }],
          metrics: {
            totalPlans: this.plans.size,
            executingPlans: this.executingPlans.size,
            unhealthyComponents: unhealthyComponents.length
          }
        }
      };
    }

    return {
      status: 'healthy',
      details: {
        lastCheck: new Date(),
        issues: [],
        metrics: {
          totalPlans: this.plans.size,
          executingPlans: this.executingPlans.size,
          healthyComponents: componentHealth.length
        }
      }
    };
  }

  /**
   * Create a new plan using the PlanCreator component
   */
  async createPlan(options: PlanCreationOptions): Promise<PlanCreationResult> {
    if (!this._initialized) {
      throw new PlanningError(
        'Planning manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    try {
      this.logger.info('Creating plan', {
        name: options.name,
        description: options.description?.substring(0, 100) + '...',
        goals: options.goals
      });

      // Use PlanCreator component to create the plan
      const result = await this.planCreator.createPlan(
        options.description,
        {
          name: options.name,
          goals: options.goals,
          priority: options.priority,
          metadata: options.metadata,
          context: options.context
        }
      );

      if (result.success && result.plan) {
        // Store the plan
        this.plans.set(result.plan.id, result.plan);
        
        this.logger.info('Plan created successfully', {
          planId: result.plan.id,
          stepCount: result.plan.steps.length,
          confidence: result.plan.confidence
        });

        return result;
      } else {
        throw new PlanningError(
          result.error || 'Plan creation failed',
          'PLAN_CREATION_FAILED'
        );
      }

    } catch (error) {
      this.logger.error('Plan creation failed', {
        error: error instanceof Error ? error.message : String(error),
        options: {
          name: options.name,
          description: options.description?.substring(0, 100) + '...'
        }
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create plan'
      };
    }
  }

  /**
   * Get a plan by ID
   */
  async getPlan(planId: string): Promise<Plan | null> {
    return this.plans.get(planId) || null;
  }

  /**
   * Get all plans
   */
  async getAllPlans(): Promise<Plan[]> {
    return Array.from(this.plans.values());
  }

  /**
   * Update a plan
   */
  async updatePlan(planId: string, updates: Partial<Plan>): Promise<Plan | null> {
    const plan = this.plans.get(planId);
    if (!plan) {
      return null;
    }

    const updatedPlan = {
      ...plan,
      ...updates,
      updatedAt: new Date()
    };

    this.plans.set(planId, updatedPlan);
    
    this.logger.info('Plan updated', { planId, updates: Object.keys(updates) });
    
    return updatedPlan;
  }

  /**
   * Delete a plan
   */
  async deletePlan(planId: string): Promise<boolean> {
    const deleted = this.plans.delete(planId);
    this.executingPlans.delete(planId);
    
    if (deleted) {
      this.logger.info('Plan deleted', { planId });
    }
    
    return deleted;
  }

  /**
   * Execute a plan using the PlanExecutor component
   */
  async executePlan(planId: string): Promise<PlanExecutionResult> {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new PlanningError(
        'Plan not found',
        'PLAN_NOT_FOUND',
        planId
      );
    }

    if (this.executingPlans.has(planId)) {
      throw new PlanningError(
        'Plan is already executing',
        'PLAN_ALREADY_EXECUTING',
        planId
      );
    }

    try {
      this.executingPlans.add(planId);
      
      this.logger.info('Starting plan execution', {
        planId,
        stepCount: plan.steps.length
      });

      // Use PlanExecutor component to execute the plan
      const result = await this.planExecutor.executePlan(plan);

      // Update plan status based on execution result
      const updatedPlan = {
        ...plan,
        status: result.success ? 'completed' as const : 'failed' as const,
        updatedAt: new Date()
      };
      this.plans.set(planId, updatedPlan);

      this.logger.info('Plan execution completed', {
        planId,
        success: result.success
      });

      return result;

    } catch (error) {
      this.logger.error('Plan execution failed', {
        planId,
        error: error instanceof Error ? error.message : String(error)
      });

      // Update plan status to failed
      const updatedPlan = {
        ...plan,
        status: 'failed' as const,
        updatedAt: new Date()
      };
      this.plans.set(planId, updatedPlan);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Plan execution failed'
      };

    } finally {
      this.executingPlans.delete(planId);
    }
  }

  /**
   * Adapt a plan using the StepAdapter component
   */
  async adaptPlan(planId: string, reason: string): Promise<Plan | null> {
    const plan = this.plans.get(planId);
    if (!plan) {
      return null;
    }

    try {
      this.logger.info('Adapting plan', { planId, reason });

      // Use StepAdapter to adapt each step
      const adaptedSteps: PlanStep[] = [];
      
      for (const step of plan.steps) {
        const adaptationResult = await this.stepAdapter.adaptStep(
          step,
          {
            userFeedback: reason
          },
          {
            reason
          }
        );

        if (adaptationResult.success && adaptationResult.adaptedStep) {
          adaptedSteps.push(adaptationResult.adaptedStep);
        } else {
          // Keep original step if adaptation fails
          adaptedSteps.push(step);
        }
      }

      // Create updated plan
      const adaptedPlan = {
        ...plan,
        steps: adaptedSteps,
        updatedAt: new Date()
      };

      this.plans.set(planId, adaptedPlan);
      
      this.logger.info('Plan adapted successfully', {
        planId,
        originalSteps: plan.steps.length,
        adaptedSteps: adaptedSteps.length
      });

      return adaptedPlan;

    } catch (error) {
      this.logger.error('Plan adaptation failed', {
        planId,
        reason,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return null;
    }
  }

  /**
   * Validate a plan using the PlanValidator component
   */
  async validatePlan(planId: string): Promise<boolean> {
    const plan = this.plans.get(planId);
    if (!plan) {
      return false;
    }

    try {
      const validationResult = await this.planValidator.validatePlan(plan);
      
      this.logger.info('Plan validation completed', {
        planId,
        isValid: validationResult.isValid,
        score: validationResult.score,
        issueCount: validationResult.issues.length
      });

      return validationResult.isValid;

    } catch (error) {
      this.logger.error('Plan validation failed', {
        planId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return false;
    }
  }

  /**
   * Optimize a plan
   */
  async optimizePlan(planId: string): Promise<Plan | null> {
    if (!this._initialized) {
      throw new PlanningError(
        'Planning manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    const plan = this.plans.get(planId);
    if (!plan) {
      this.logger.warn('Plan not found for optimization', { planId });
      return null;
    }

    try {
      this.logger.info('Optimizing plan', { planId });

      // Use PlanOptimizer to optimize the plan
      const optimizationResult = await this.planOptimizer.optimizePlan(plan, {
        // OptimizationContext - using available resources and constraints
        availableResources: {
          timeLimit: this.config.planExecutionTimeoutMs || 300000
        },
        constraints: {
          preserveStepOrder: false,
          maintainDependencies: true,
          maxParallelSteps: this.config.maxConcurrentExecutions || 3
        }
      }, {
        // PlanOptimizationOptions - specify what type of optimization to apply
        optimizationType: 'comprehensive',
        strategy: 'balanced'
      });

      if (optimizationResult && optimizationResult.optimizedPlan) {
        const optimizedPlan = optimizationResult.optimizedPlan;
        
        // Update the plan in storage
        optimizedPlan.status = 'optimized';
        optimizedPlan.updatedAt = new Date();
        this.plans.set(planId, optimizedPlan);

        this.logger.info('Plan optimized successfully', { 
          planId,
          originalSteps: plan.steps.length,
          optimizedSteps: optimizedPlan.steps.length
        });

        return optimizedPlan;
      } else {
        this.logger.warn('Plan optimization returned null or no optimized plan', { planId });
        return null;
      }

    } catch (error) {
      this.logger.error('Failed to optimize plan', {
        planId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new PlanningError(
        `Failed to optimize plan: ${error instanceof Error ? error.message : String(error)}`,
        'OPTIMIZATION_FAILED',
        planId,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Plan and execute a goal - compatibility method for tests and DefaultAgent
   */
  async planAndExecute(goal: string, options: Record<string, unknown> = {}): Promise<{
    success: boolean;
    message: string;
    plan?: Plan;
    error?: string;
  }> {
    if (!this._initialized) {
      throw new PlanningError(
        'Planning manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    try {
      this.logger.info('Planning and executing goal', { goal, options });

      // Create a plan from the goal
      const planCreationResult = await this.createPlan({
        name: `Goal: ${goal}`,
        description: goal,
        goals: [goal],
        priority: 0.8,
        generateSteps: true,
        context: options,
        metadata: { 
          source: 'planAndExecute',
          originalGoal: goal,
          options 
        }
      });

      if (!planCreationResult.success || !planCreationResult.plan) {
        return {
          success: false,
          message: planCreationResult.error || 'Failed to create plan',
          error: planCreationResult.error
        };
      }

      const plan = planCreationResult.plan;

      // Execute the plan
      const executionResult = await this.executePlan(plan.id);

      if (executionResult.success) {
        return {
          success: true,
          message: 'Goal planned and executed successfully',
          plan: executionResult.plan || plan
        };
      } else {
        return {
          success: false,
          message: executionResult.error || 'Plan execution failed',
          plan: executionResult.plan || plan,
          error: executionResult.error
        };
      }

    } catch (error) {
      this.logger.error('Failed to plan and execute goal', {
        goal,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        success: false,
        message: `Failed to plan and execute goal: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get plan progress - compatibility method for tests
   */
  async getPlanProgress(planId: string): Promise<{
    planId: string;
    status: string;
    completedSteps: number;
    totalSteps: number;
    percentage: number;
    currentStep?: string;
  } | null> {
    if (!this._initialized) {
      throw new PlanningError(
        'Planning manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    const plan = this.plans.get(planId);
    if (!plan) {
      this.logger.warn('Plan not found for progress check', { planId });
      return null;
    }

    try {
      const totalSteps = plan.steps.length;
      const completedSteps = plan.steps.filter(step => step.status === 'completed').length;
      const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
      
      // Find current step (first in_progress or pending step)
      const currentStep = plan.steps.find(step => 
        step.status === 'in_progress' || step.status === 'pending'
      );

      return {
        planId,
        status: plan.status,
        completedSteps,
        totalSteps,
        percentage,
        currentStep: currentStep?.name || currentStep?.description
      };

    } catch (error) {
      this.logger.error('Failed to get plan progress', {
        planId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new PlanningError(
        `Failed to get plan progress: ${error instanceof Error ? error.message : String(error)}`,
        'PROGRESS_CHECK_FAILED',
        planId,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Reset the planning manager
   */
  async reset(): Promise<boolean> {
    try {
      this.plans.clear();
      this.executingPlans.clear();
      
      this.logger.info('Planning manager reset successfully');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to reset planning manager', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      return false;
    }
  }

  /**
   * Shutdown the planning manager
   */
  async shutdown(): Promise<void> {
    try {
      // Cancel any executing plans
      this.executingPlans.clear();
      
      // Clear plans
      this.plans.clear();
      
      this.logger.info('Planning manager shutdown completed');
      
    } catch (error) {
      this.logger.error('Error during planning manager shutdown', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get planning statistics
   */
  async getStats(): Promise<{
    totalPlans: number;
    activePlans: number;
    completedPlans: number;
    failedPlans: number;
    executingPlans: number;
  }> {
    const plans = Array.from(this.plans.values());
    
    return {
      totalPlans: plans.length,
      activePlans: plans.filter(p => p.status === 'pending' || p.status === 'in_progress').length,
      completedPlans: plans.filter(p => p.status === 'completed').length,
      failedPlans: plans.filter(p => p.status === 'failed').length,
      executingPlans: this.executingPlans.size
    };
  }

  /**
   * Get current configuration
   */
  getConfig<T extends ManagerConfig>(): T {
    return { ...this.config } as T;
  }

  /**
   * Configure the planning manager
   */
  configure(config: Partial<DefaultPlanningManagerConfig>): void {
    Object.assign(this.config, config);
    
    this.logger.info('Planning manager configuration updated', { config });
  }
} 