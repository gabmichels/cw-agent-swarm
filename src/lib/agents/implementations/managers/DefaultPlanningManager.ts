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
  protected initialized = false;
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
  
  // Override config type to use specific config type
  protected config!: PlanningManagerConfig;

  /**
   * Type property accessor for compatibility with PlanningManager
   * Use _managerType from the parent class instead of calling getType(),
   * which was causing infinite recursion
   */
  get type(): string {
    return this._managerType;
  }

  /**
   * Create a new DefaultPlanningManager instance
   * 
   * @param agent - The agent this manager belongs to
   * @param config - Configuration options
   */
  constructor(agent: AgentBase, config: Partial<PlanningManagerConfig> = {}) {
    super(
      `planning-manager-${uuidv4()}`,
      ManagerType.PLANNING,
      agent,
      { enabled: true }
    );

    // Validate and apply configuration with defaults
    this.config = this.configFactory.create({
      enabled: true,
      ...config
    }) as PlanningManagerConfig;
    
    this.plans = new Map();
    this.planningTimer = null;
  }

  /**
   * Get the unique ID of this manager
   */
  getId(): string {
    return this.managerId;
  }

  /**
   * Get the manager type
   */
  getType(): string {
    return this.managerType;
  }

  /**
   * Get the manager configuration
   */
  getConfig<T extends PlanningManagerConfig>(): T {
    return this.config as T;
  }

  /**
   * Update the manager configuration
   */
  updateConfig<T extends PlanningManagerConfig>(config: Partial<T>): T {
    // Validate and merge configuration
    this.config = this.configFactory.create({
      ...this.config, 
      ...config
    }) as PlanningManagerConfig;
    
    // If auto-planning config changed, update the timer
    if (('enableAutoPlanning' in config || 'planningIntervalMs' in config) && this.initialized) {
      // Clear existing timer
      if (this.planningTimer) {
        clearInterval(this.planningTimer);
        this.planningTimer = null;
      }
      
      // Setup timer if enabled
      if (this.config.enableAutoPlanning) {
        this.setupAutoPlanning();
      }
    }
    
    return this.config as T;
  }

  /**
   * Get the associated agent instance
   */
  getAgent(): AgentBase {
    return this.agent;
  }

  /**
   * Initialize the manager
   */
  async initialize(): Promise<boolean> {
    console.log(`[${this.managerId}] Initializing ${this.type} manager`);
    
    // Setup auto-planning if enabled
    if (this.config.enableAutoPlanning) {
      this.setupAutoPlanning();
    }
    
    this.initialized = true;
    return true;
  }

  /**
   * Shutdown the manager and release resources
   */
  async shutdown(): Promise<void> {
    console.log(`[${this.managerId}] Shutting down ${this.type} manager`);
    
    // Clear timers
    if (this.planningTimer) {
      clearInterval(this.planningTimer);
      this.planningTimer = null;
    }
    
    this.initialized = false;
  }

  /**
   * Check if the manager is currently enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable or disable the manager
   */
  setEnabled(enabled: boolean): boolean {
    this.config.enabled = enabled;
    return this.config.enabled;
  }

  /**
   * Reset the manager to its initial state
   */
  async reset(): Promise<boolean> {
    console.log(`[${this.managerId}] Resetting ${this.type} manager`);
    this.plans.clear();
    return true;
  }

  /**
   * Get manager health status
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    metrics?: Record<string, unknown>;
  }> {
    if (!this.initialized) {
      return {
        status: 'degraded',
        message: 'Planning manager not initialized'
      };
    }

    const stats = await this.getStats();
    
    // Check if there are critical issues
    if (!this.isEnabled()) {
      return {
        status: 'unhealthy',
        message: 'Planning manager is disabled',
        metrics: stats
      };
    }
    
    // Degraded if too many concurrent plans
    if (stats.activePlans > (this.config.maxConcurrentPlans as number ?? 5)) {
      return {
        status: 'degraded',
        message: 'Too many concurrent plans',
        metrics: stats
      };
    }
    
    return {
      status: 'healthy',
      message: 'Planning manager is healthy',
      metrics: stats
    };
  }

  /**
   * Create a new plan
   */
  async createPlan(options: PlanCreationOptions): Promise<PlanCreationResult> {
    if (!this.initialized) {
      throw new PlanningError(
        'Planning manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    try {
      const planId = uuidv4();
      const timestamp = new Date();
      
      const plan: Plan = {
        id: planId,
        name: options.name,
        description: options.description,
        goals: options.goals,
        steps: [],
        status: 'pending',
        priority: options.priority ?? 0.5,
        confidence: 0.5, // Initial confidence
        createdAt: timestamp,
        updatedAt: timestamp,
        metadata: options.metadata ?? {}
      };
      
      this.plans.set(planId, plan);
      
      return {
        success: true,
        plan
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating plan'
      };
    }
  }

  /**
   * Get a plan by ID
   */
  async getPlan(planId: string): Promise<Plan | null> {
    if (!this.initialized) {
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
    if (!this.initialized) {
      throw new PlanningError(
        'Planning manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    return Array.from(this.plans.values());
  }

  /**
   * Update a plan
   */
  async updatePlan(planId: string, updates: Partial<Plan>): Promise<Plan | null> {
    if (!this.initialized) {
      throw new PlanningError(
        'Planning manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    const plan = this.plans.get(planId);
    if (!plan) {
      return null;
    }

    const updatedPlan: Plan = {
      ...plan,
      ...updates,
      updatedAt: new Date()
    };

    this.plans.set(planId, updatedPlan);
    return updatedPlan;
  }

  /**
   * Delete a plan
   */
  async deletePlan(planId: string): Promise<boolean> {
    if (!this.initialized) {
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
    if (!this.initialized) {
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
    if (!this.initialized) {
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
    const adaptationCount = (plan.metadata.adaptationCount as number) ?? 0;
    if (adaptationCount >= (this.config.maxAdaptationAttempts as number ?? 3)) {
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
    if (!this.initialized) {
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
    if (!this.initialized) {
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

  // Private helper methods

  /**
   * Setup automatic planning
   */
  private setupAutoPlanning(): void {
    if (this.planningTimer) {
      clearInterval(this.planningTimer);
    }
    
    this.planningTimer = setInterval(async () => {
      try {
        await this.autoPlan();
      } catch (error) {
        console.error(`[${this.managerId}] Error during auto-planning:`, error);
      }
    }, this.config.planningIntervalMs as number ?? 300000);
  }

  /**
   * Perform automatic planning
   */
  private async autoPlan(): Promise<void> {
    const activePlans = Array.from(this.plans.values())
      .filter(p => p.status === 'in_progress');
    
    if (activePlans.length >= (this.config.maxConcurrentPlans as number ?? 5)) {
      return;
    }

    // TODO: Implement automatic plan creation based on agent goals
  }

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

  public isInitialized(): boolean { return this.initialized; }
} 