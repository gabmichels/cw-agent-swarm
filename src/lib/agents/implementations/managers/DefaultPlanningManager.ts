/**
 * DefaultPlanningManager.ts - Default implementation of the PlanningManager interface
 * 
 * This file provides a concrete implementation of the PlanningManager interface
 * that can be used by any agent implementation. It includes plan creation,
 * execution, adaptation, and optimization capabilities.
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  PlanningManager, 
  PlanningManagerConfig,
  Plan,
  PlanStep,
  PlanAction,
  PlanCreationOptions,
  PlanCreationResult,
  PlanExecutionResult
} from '../../../../agents/shared/base/managers/PlanningManager.interface';
import { AgentBase } from '../../../../agents/shared/base/AgentBase.interface';
import { AdaptationMetricsCalculatorImpl } from '../../../../server/planning/metrics/AdaptationMetrics';
import { OptimizationMetricsCalculatorImpl } from '../../../../server/planning/metrics/OptimizationMetrics';
import { ValidationMetricsCalculatorImpl } from '../../../../server/planning/metrics/ValidationMetrics';
import { calculateTotalTime, calculateResourceUsage, calculateReliabilityScore } from '../../../../server/planning/utils/PlanMetricsCalculator';
import { DefaultTimeOptimizationStrategy } from '../../../../server/planning/strategies/TimeOptimizationStrategy';
import { DefaultResourceOptimizationStrategy } from '../../../../server/planning/strategies/ResourceOptimizationStrategy';
import { DefaultReliabilityOptimizationStrategy } from '../../../../server/planning/strategies/ReliabilityOptimizationStrategy';
import { DefaultEfficiencyOptimizationStrategy } from '../../../../server/planning/strategies/EfficiencyOptimizationStrategy';
import { DefaultDependencyValidator } from '../../../../server/planning/validators/DependencyValidator';
import { DefaultResourceValidator } from '../../../../server/planning/validators/ResourceValidator';
import { DefaultPlanValidator } from '../../../../server/planning/validators/PlanValidator';
import { AbstractBaseManager } from '../../../../agents/shared/base/managers/BaseManager';
import { createConfigFactory } from '../../../../agents/shared/config';
import { PlanningManagerConfigSchema } from '../../../../agents/shared/planning/config/PlanningManagerConfigSchema';
import { ManagerType } from '../../../../agents/shared/base/managers/ManagerType';
import { ManagerHealth } from '../../../../agents/shared/base/managers/ManagerHealth';

/**
 * Error class for planning-related errors
 */
class PlanningError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown>;

  constructor(message: string, code = 'PLANNING_ERROR', context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'PlanningError';
    this.code = code;
    this.context = context;
  }
}

/**
 * Default implementation of the PlanningManager interface
 */
export class DefaultPlanningManager extends AbstractBaseManager implements PlanningManager {
  private plans: Map<string, Plan> = new Map();
  private planningTimer: NodeJS.Timeout | null = null;
  private adaptationMetrics = new AdaptationMetricsCalculatorImpl(calculateTotalTime);
  private optimizationMetrics = new OptimizationMetricsCalculatorImpl(calculateTotalTime, calculateResourceUsage, calculateReliabilityScore);
  private validationMetrics = new ValidationMetricsCalculatorImpl();
  private timeStrategy = new DefaultTimeOptimizationStrategy();
  private resourceStrategy = new DefaultResourceOptimizationStrategy();
  private reliabilityStrategy = new DefaultReliabilityOptimizationStrategy();
  private efficiencyStrategy = new DefaultEfficiencyOptimizationStrategy();
  private dependencyValidator = new DefaultDependencyValidator();
  private resourceValidator = new DefaultResourceValidator();
  private planValidator = new DefaultPlanValidator();
  private configFactory = createConfigFactory(PlanningManagerConfigSchema);

  /**
   * Create a new DefaultPlanningManager instance
   * 
   * @param agent - The agent this manager belongs to
   * @param config - Configuration options
   */
  constructor(agent: AgentBase, config: Partial<PlanningManagerConfig> = {}) {
    const managerId = `planning-manager-${uuidv4()}`;
    super(
      managerId,
      ManagerType.PLANNING,
      agent,
      {
        enabled: true,
        enableAutoPlanning: true,
        planningIntervalMs: 300000,
        maxConcurrentPlans: 5,
        maxAdaptationAttempts: 3,
        ...config
      }
    );
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

    const stats = await this.getStats();
    
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
          metrics: stats
        }
      };
    }

    return {
      status: 'healthy',
      details: {
        lastCheck: new Date(),
        issues: [],
        metrics: stats
      }
    };
  }

  /**
   * Create a new plan
   */
  async createPlan(options: PlanCreationOptions): Promise<PlanCreationResult> {
    if (!this._initialized) {
      throw new PlanningError(
        'Planning manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    try {
      const plan: Plan = {
        id: uuidv4(),
        name: options.name,
        description: options.description,
        goals: options.goals,
        steps: [],
        status: 'pending',
        priority: options.priority ?? 0,
        confidence: 1.0,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: options.metadata || {}
      };

      // Store the plan
      this.plans.set(plan.id, plan);

      return {
        success: true,
        plan
      };
    } catch (error) {
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
    if (!this._initialized) {
      throw new PlanningError(
        'Planning manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    return this.plans.get(planId) ?? null;
  }

  /**
   * Get all plans
   */
  async getAllPlans(): Promise<Plan[]> {
    if (!this._initialized) {
      throw new PlanningError(
        'Planning manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    return Array.from(this.plans.values());
  }

  /**
   * Update an existing plan
   */
  async updatePlan(planId: string, updates: Partial<Plan>): Promise<Plan | null> {
    const plan = this.plans.get(planId);
    if (!plan) {
      return null;
    }

    const updatedPlan: Plan = {
      ...plan,
      ...updates,
      metadata: { ...plan.metadata, ...updates.metadata },
      updatedAt: new Date()
    };

    this.plans.set(planId, updatedPlan);
    return updatedPlan;
  }

  /**
   * Delete a plan
   */
  async deletePlan(planId: string): Promise<boolean> {
    if (!this._initialized) {
      throw new PlanningError(
        'Planning manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    return this.plans.delete(planId);
  }

  /**
   * Execute a plan
   */
  async executePlan(planId: string): Promise<PlanExecutionResult> {
    if (!this._initialized) {
      throw new PlanningError(
        'Planning manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    const plan = this.plans.get(planId);
    if (!plan) {
      return {
        success: false,
        error: 'Plan not found'
      };
    }

    try {
      // Update plan status
      const updatedPlan = await this.updatePlan(planId, {
        status: 'in_progress'
      });

      if (!updatedPlan) {
        return {
          success: false,
          error: 'Failed to update plan status'
        };
      }

      // Execute each step
      for (const step of updatedPlan.steps) {
        if (step.status === 'completed') continue;

        // Update step status
        step.status = 'in_progress';
        step.updatedAt = new Date();

        // Execute each action in the step
        for (const action of step.actions) {
          if (action.status === 'completed') continue;

          // Update action status
          action.status = 'in_progress';
          action.updatedAt = new Date();

          try {
            // Execute the action
            await this.executeAction(action);

            // Update action status
            action.status = 'completed';
            action.updatedAt = new Date();
          } catch (error) {
            action.status = 'failed';
            action.updatedAt = new Date();
            throw error;
          }
        }

        // Update step status
        step.status = 'completed';
        step.updatedAt = new Date();
      }

      // Update plan status
      const finalPlan = await this.updatePlan(planId, {
        status: 'completed'
      });

      return {
        success: true,
        plan: finalPlan ?? undefined
      };
    } catch (error) {
      // Update plan status
      await this.updatePlan(planId, {
        status: 'failed'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error executing plan'
      };
    }
  }

  /**
   * Adapt a plan
   */
  async adaptPlan(planId: string, reason: string): Promise<Plan | null> {
    if (!this._initialized) {
      throw new PlanningError(
        'Planning manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    const plan = this.plans.get(planId);
    if (!plan) {
      return null;
    }

    // Check if we've exceeded adaptation attempts
    const config = this.getConfig<PlanningManagerConfig>();
    const adaptationCount = (plan.metadata.adaptationCount as number) ?? 0;
    if (adaptationCount >= (config.maxAdaptationAttempts ?? 3)) {
      throw new PlanningError(
        'Maximum adaptation attempts exceeded',
        'MAX_ADAPTATIONS_EXCEEDED'
      );
    }

    // Create new steps based on the adaptation reason
    const newSteps = await this.createAdaptedSteps(plan, reason);

    // Update the plan
    return this.updatePlan(planId, {
      steps: newSteps,
      status: 'adapted',
      metadata: {
        ...plan.metadata,
        adaptationCount: adaptationCount + 1,
        lastAdaptationReason: reason,
        lastAdaptationAt: new Date()
      }
    });
  }

  /**
   * Validate a plan
   */
  async validatePlan(planId: string): Promise<boolean> {
    if (!this._initialized) {
      throw new PlanningError(
        'Planning manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    const plan = this.plans.get(planId);
    if (!plan) {
      return false;
    }

    // Check if plan has goals
    if (!plan.goals.length) {
      return false;
    }

    // Check if plan has steps
    if (!plan.steps.length) {
      return false;
    }

    // Check if steps have actions
    for (const step of plan.steps) {
      if (!step.actions.length) {
        return false;
      }
    }

    // Check for circular dependencies
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (stepId: string): boolean => {
      if (recursionStack.has(stepId)) {
        return true;
      }

      if (visited.has(stepId)) {
        return false;
      }

      visited.add(stepId);
      recursionStack.add(stepId);

      const step = plan.steps.find(s => s.id === stepId);
      if (step) {
        for (const depId of step.dependencies) {
          if (hasCycle(depId)) {
            return true;
          }
        }
      }

      recursionStack.delete(stepId);
      return false;
    };

    for (const step of plan.steps) {
      if (hasCycle(step.id)) {
        return false;
      }
    }

    return true;
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
      return null;
    }

    // Sort steps by priority
    const sortedSteps = [...plan.steps].sort((a, b) => b.priority - a.priority);

    // Update the plan with optimized steps
    return this.updatePlan(planId, {
      steps: sortedSteps
    });
  }

  /**
   * Reset the manager state
   */
  async reset(): Promise<boolean> {
    this.plans.clear();
    if (this.planningTimer) {
      clearInterval(this.planningTimer);
      this.planningTimer = null;
    }
    return super.reset();
  }

  /**
   * Shutdown the manager
   */
  async shutdown(): Promise<void> {
    if (this.planningTimer) {
      clearInterval(this.planningTimer);
      this.planningTimer = null;
    }
    await super.shutdown();
  }

  // Private helper methods

  /**
   * Execute an action
   */
  private async executeAction(action: PlanAction): Promise<void> {
    // TODO: Implement action execution based on action type
    // This would typically involve calling the appropriate tool or service
  }

  /**
   * Create adapted steps for a plan
   */
  private async createAdaptedSteps(plan: Plan, reason: string): Promise<PlanStep[]> {
    // TODO: Implement step adaptation logic
    // This would typically involve analyzing the reason and creating new steps
    return plan.steps;
  }

  /**
   * Get planning manager statistics
   */
  private async getStats(): Promise<{
    totalPlans: number;
    activePlans: number;
    completedPlans: number;
    failedPlans: number;
    avgPlanSteps: number;
    avgPlanConfidence: number;
  }> {
    const allPlans = Array.from(this.plans.values());
    const activePlans = allPlans.filter(p => p.status === 'in_progress');
    const completedPlans = allPlans.filter(p => p.status === 'completed');
    const failedPlans = allPlans.filter(p => p.status === 'failed');
    
    const totalSteps = allPlans.reduce((sum, p) => sum + p.steps.length, 0);
    const totalConfidence = allPlans.reduce((sum, p) => sum + p.confidence, 0);
    
    return {
      totalPlans: allPlans.length,
      activePlans: activePlans.length,
      completedPlans: completedPlans.length,
      failedPlans: failedPlans.length,
      avgPlanSteps: allPlans.length > 0 ? totalSteps / allPlans.length : 0,
      avgPlanConfidence: allPlans.length > 0 ? totalConfidence / allPlans.length : 0
    };
  }
} 