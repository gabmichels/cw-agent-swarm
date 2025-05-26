/**
 * DefaultPlanAdaptationSystem
 * 
 * Implementation of the PlanAdaptationSystem interface that provides
 * dynamic plan adaptation and optimization capabilities.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  PlanAdaptationSystem,
  AdaptationTriggerType,
  AdaptationScope,
  AdaptationStrategyType,
  AdaptationImpact,
  AdaptationOpportunity,
  AdaptationAction,
  AdaptationResult,
  AdaptationStrategyConfig,
  PlanAdaptationStrategy
} from '../interfaces/PlanAdaptation.interface';

/**
 * Error class for plan adaptation system
 */
class PlanAdaptationError extends Error {
  constructor(message: string, public readonly code: string = 'ADAPTATION_ERROR') {
    super(message);
    this.name = 'PlanAdaptationError';
  }
}

/**
 * Default implementation of the PlanAdaptationSystem interface
 */
export class DefaultPlanAdaptationSystem implements PlanAdaptationSystem {
  private initialized = false;
  private strategies = new Map<string, PlanAdaptationStrategy>();
  private opportunities = new Map<string, AdaptationOpportunity>();
  private actions = new Map<string, AdaptationAction[]>();
  private results = new Map<string, AdaptationResult[]>();
  private planCache = new Map<string, Record<string, unknown>>();

  /**
   * Initialize the adaptation system
   */
  async initialize(options?: Record<string, unknown>): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    // Register default strategies if needed
    if (options?.registerDefaultStrategies) {
      await this.registerDefaultStrategies();
    }

    this.initialized = true;
    return true;
  }

  /**
   * Register default adaptation strategies
   */
  private async registerDefaultStrategies(): Promise<void> {
    // Implementation will be added later
  }

  /**
   * Register an adaptation strategy
   */
  async registerStrategy(strategy: PlanAdaptationStrategy): Promise<boolean> {
    if (!this.initialized) {
      throw new PlanAdaptationError('Adaptation system not initialized', 'NOT_INITIALIZED');
    }

    this.strategies.set(strategy.config.id, strategy);
    return true;
  }

  /**
   * Unregister an adaptation strategy
   */
  async unregisterStrategy(strategyId: string): Promise<boolean> {
    if (!this.initialized) {
      throw new PlanAdaptationError('Adaptation system not initialized', 'NOT_INITIALIZED');
    }

    return this.strategies.delete(strategyId);
  }

  /**
   * Get all registered strategies
   */
  async getRegisteredStrategies(): Promise<PlanAdaptationStrategy[]> {
    if (!this.initialized) {
      throw new PlanAdaptationError('Adaptation system not initialized', 'NOT_INITIALIZED');
    }

    return Array.from(this.strategies.values());
  }

  /**
   * Enable a strategy
   */
  async enableStrategy(strategyId: string): Promise<boolean> {
    if (!this.initialized) {
      throw new PlanAdaptationError('Adaptation system not initialized', 'NOT_INITIALIZED');
    }

    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      return false;
    }

    strategy.config.enabled = true;
    return true;
  }

  /**
   * Disable a strategy
   */
  async disableStrategy(strategyId: string): Promise<boolean> {
    if (!this.initialized) {
      throw new PlanAdaptationError('Adaptation system not initialized', 'NOT_INITIALIZED');
    }

    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      return false;
    }

    strategy.config.enabled = false;
    return true;
  }

  /**
   * Detect adaptation opportunities
   */
  async detectOpportunities(
    planId: string,
    trigger?: {
      type: AdaptationTriggerType;
      source: string;
      description: string;
      context?: Record<string, unknown>;
    }
  ): Promise<AdaptationOpportunity[]> {
    if (!this.initialized) {
      throw new PlanAdaptationError('Adaptation system not initialized', 'NOT_INITIALIZED');
    }

    // Validate plan ID
    if (!planId?.trim()) {
      throw new PlanAdaptationError('Plan ID is required', 'INVALID_INPUT');
    }

    // Get or create the plan
    let plan = this.planCache.get(planId);
    if (!plan) {
      // In a real implementation, this would load the plan from storage
      // For now, create a basic plan structure
      plan = { id: planId, steps: [], metadata: {} };
      this.planCache.set(planId, plan);
    }

    // If a specific trigger is provided, create a single opportunity
    if (trigger) {
      const opportunity = this.createOpportunity(planId, trigger);
      this.opportunities.set(opportunity.id, opportunity);
      return [opportunity];
    }

    // Otherwise, analyze the plan to detect opportunities
    // This is a placeholder implementation that would be replaced with actual analysis
    const detectedOpportunities: AdaptationOpportunity[] = [];
    
    // Example: Detect potential efficiency optimization
    const efficiencyOpportunity = this.createOpportunity(
      planId,
      {
        type: AdaptationTriggerType.EFFICIENCY_OPTIMIZATION,
        source: 'adaptation-system',
        description: 'Potential efficiency improvements detected'
      }
    );
    detectedOpportunities.push(efficiencyOpportunity);
    
    // Store all detected opportunities
    for (const opportunity of detectedOpportunities) {
      this.opportunities.set(opportunity.id, opportunity);
    }
    
    return detectedOpportunities;
  }

  /**
   * Create an adaptation opportunity
   */
  private createOpportunity(
    planId: string,
    trigger: {
      type: AdaptationTriggerType;
      source: string;
      description: string;
      context?: Record<string, unknown>;
    }
  ): AdaptationOpportunity {
    const id = uuidv4();
    const now = new Date();
    
    // Determine applicable strategies based on trigger type
    const applicableStrategies = this.getApplicableStrategyTypes(trigger.type);
    
    // Create the opportunity
    const opportunity: AdaptationOpportunity = {
      id,
      planId,
      trigger: {
        ...trigger,
        timestamp: now
      },
      scope: AdaptationScope.FULL_PLAN, // Default to full plan scope
      priorityScore: this.calculatePriorityScore(trigger.type),
      applicableStrategies,
      discoveredAt: now,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) // Expires in 24 hours
    };
    
    return opportunity;
  }

  /**
   * Get applicable strategy types for a trigger type
   */
  private getApplicableStrategyTypes(triggerType: AdaptationTriggerType): AdaptationStrategyType[] {
    switch (triggerType) {
      case AdaptationTriggerType.EFFICIENCY_OPTIMIZATION:
        return [
          AdaptationStrategyType.CONSOLIDATION,
          AdaptationStrategyType.PARALLELIZATION,
          AdaptationStrategyType.ELIMINATION
        ];
      case AdaptationTriggerType.RESOURCE_CONSTRAINT:
        return [
          AdaptationStrategyType.SUBSTITUTION,
          AdaptationStrategyType.PARAMETERIZATION,
          AdaptationStrategyType.ELIMINATION
        ];
      case AdaptationTriggerType.ERROR_RECOVERY:
        return [
          AdaptationStrategyType.SUBSTITUTION,
          AdaptationStrategyType.ELIMINATION,
          AdaptationStrategyType.DELEGATION
        ];
      default:
        return Object.values(AdaptationStrategyType);
    }
  }

  /**
   * Calculate priority score for a trigger type
   */
  private calculatePriorityScore(triggerType: AdaptationTriggerType): number {
    switch (triggerType) {
      case AdaptationTriggerType.ERROR_RECOVERY:
        return 90; // High priority
      case AdaptationTriggerType.RESOURCE_CONSTRAINT:
        return 80;
      case AdaptationTriggerType.GOAL_CHANGE:
        return 70;
      case AdaptationTriggerType.USER_FEEDBACK:
        return 60;
      case AdaptationTriggerType.ENVIRONMENTAL_CHANGE:
        return 50;
      case AdaptationTriggerType.RISK_MITIGATION:
        return 40;
      case AdaptationTriggerType.EFFICIENCY_OPTIMIZATION:
        return 30;
      case AdaptationTriggerType.OPPORTUNITY:
        return 20;
      case AdaptationTriggerType.PERIODIC:
        return 10; // Low priority
      default:
        return 50; // Medium priority
    }
  }

  /**
   * Generate adaptation actions for an opportunity
   */
  async generateActions(opportunityId: string): Promise<AdaptationAction[]> {
    if (!this.initialized) {
      throw new PlanAdaptationError('Adaptation system not initialized', 'NOT_INITIALIZED');
    }

    const opportunity = this.opportunities.get(opportunityId);
    if (!opportunity) {
      throw new PlanAdaptationError(`Opportunity not found: ${opportunityId}`, 'NOT_FOUND');
    }

    // Check if opportunity has expired
    if (opportunity.expiresAt && opportunity.expiresAt < new Date()) {
      throw new PlanAdaptationError(`Opportunity has expired: ${opportunityId}`, 'EXPIRED');
    }

    const actions: AdaptationAction[] = [];

    // Generate actions for each applicable strategy
    for (const strategyType of opportunity.applicableStrategies) {
      // Find enabled strategies of this type
      const enabledStrategies = Array.from(this.strategies.values())
        .filter(s => s.config.enabled && s.config.type === strategyType);

      for (const strategy of enabledStrategies) {
        const action: AdaptationAction = {
          strategyType,
          description: this.generateActionDescription(strategyType, opportunity),
          targetSteps: this.getTargetSteps(opportunity, strategyType),
          details: this.generateActionDetails(strategyType, opportunity),
          expectedImpact: this.estimateActionImpact(strategyType, opportunity)
        };

        actions.push(action);
      }
    }

    // Store actions for this opportunity
    this.actions.set(opportunityId, actions);

    return actions;
  }

  /**
   * Generate action description based on strategy type and opportunity
   */
  private generateActionDescription(
    strategyType: AdaptationStrategyType,
    opportunity: AdaptationOpportunity
  ): string {
    const triggerDesc = opportunity.trigger.description;
    
    switch (strategyType) {
      case AdaptationStrategyType.SUBSTITUTION:
        return `Replace inefficient steps to address: ${triggerDesc}`;
      case AdaptationStrategyType.ELIMINATION:
        return `Remove unnecessary steps to address: ${triggerDesc}`;
      case AdaptationStrategyType.INSERTION:
        return `Add missing steps to address: ${triggerDesc}`;
      case AdaptationStrategyType.REORDERING:
        return `Reorder steps for better efficiency to address: ${triggerDesc}`;
      case AdaptationStrategyType.PARAMETERIZATION:
        return `Adjust parameters to address: ${triggerDesc}`;
      case AdaptationStrategyType.DECOMPOSITION:
        return `Break down complex steps to address: ${triggerDesc}`;
      case AdaptationStrategyType.CONSOLIDATION:
        return `Combine related steps to address: ${triggerDesc}`;
      case AdaptationStrategyType.PARALLELIZATION:
        return `Execute steps in parallel to address: ${triggerDesc}`;
      case AdaptationStrategyType.SERIALIZATION:
        return `Execute steps sequentially to address: ${triggerDesc}`;
      case AdaptationStrategyType.DELEGATION:
        return `Delegate steps to specialized systems to address: ${triggerDesc}`;
      default:
        return `Apply ${strategyType} strategy to address: ${triggerDesc}`;
    }
  }

  /**
   * Get target steps for adaptation based on opportunity and strategy
   */
  private getTargetSteps(
    opportunity: AdaptationOpportunity,
    strategyType: AdaptationStrategyType
  ): string[] {
    // For now, return empty array - in a real implementation,
    // this would analyze the plan to identify specific steps to target
    return [];
  }

  /**
   * Generate action details based on strategy type and opportunity
   */
  private generateActionDetails(
    strategyType: AdaptationStrategyType,
    opportunity: AdaptationOpportunity
  ): AdaptationAction['details'] {
    // Generate basic details structure based on strategy type
    const details: AdaptationAction['details'] = {};

    switch (strategyType) {
      case AdaptationStrategyType.ELIMINATION:
        details.stepsToRemove = []; // Would be populated based on analysis
        break;
      case AdaptationStrategyType.INSERTION:
        details.stepsToAdd = []; // Would be populated based on analysis
        break;
      case AdaptationStrategyType.SUBSTITUTION:
        details.replacements = []; // Would be populated based on analysis
        break;
      case AdaptationStrategyType.REORDERING:
        details.newStepOrder = []; // Would be populated based on analysis
        break;
      case AdaptationStrategyType.PARAMETERIZATION:
        details.parameterChanges = []; // Would be populated based on analysis
        break;
      case AdaptationStrategyType.DECOMPOSITION:
        details.decomposition = []; // Would be populated based on analysis
        break;
    }

    return details;
  }

  /**
   * Estimate action impact
   */
  private estimateActionImpact(
    strategyType: AdaptationStrategyType,
    opportunity: AdaptationOpportunity
  ): AdaptationImpact {
    // Base impact estimates based on strategy type
    let timeImpact = 0;
    let resourceImpact = 0;
    let reliabilityImpact = 0;
    let qualityImpact = 0;
    let overallBenefit = 0;

    switch (strategyType) {
      case AdaptationStrategyType.ELIMINATION:
        timeImpact = -15; // Faster execution
        resourceImpact = -20; // Less resource usage
        reliabilityImpact = 5; // Slightly more reliable
        qualityImpact = -5; // Might reduce quality
        overallBenefit = 15;
        break;
      
      case AdaptationStrategyType.PARALLELIZATION:
        timeImpact = -25; // Much faster execution
        resourceImpact = 10; // More resource usage
        reliabilityImpact = -5; // Slightly less reliable
        qualityImpact = 0; // No quality change
        overallBenefit = 20;
        break;
      
      case AdaptationStrategyType.CONSOLIDATION:
        timeImpact = -10; // Faster execution
        resourceImpact = -15; // Less resource usage
        reliabilityImpact = 10; // More reliable
        qualityImpact = 5; // Better quality
        overallBenefit = 25;
        break;
      
      case AdaptationStrategyType.SUBSTITUTION:
        timeImpact = -5; // Slightly faster
        resourceImpact = 0; // No change
        reliabilityImpact = 15; // More reliable
        qualityImpact = 10; // Better quality
        overallBenefit = 20;
        break;
      
      case AdaptationStrategyType.INSERTION:
        timeImpact = 10; // Slower execution
        resourceImpact = 15; // More resource usage
        reliabilityImpact = 20; // Much more reliable
        qualityImpact = 15; // Better quality
        overallBenefit = 10;
        break;
      
      case AdaptationStrategyType.REORDERING:
        timeImpact = -8; // Faster execution
        resourceImpact = 0; // No change
        reliabilityImpact = 5; // Slightly more reliable
        qualityImpact = 0; // No quality change
        overallBenefit = 12;
        break;
      
      case AdaptationStrategyType.PARAMETERIZATION:
        timeImpact = -3; // Slightly faster
        resourceImpact = -5; // Slightly less resource usage
        reliabilityImpact = 8; // More reliable
        qualityImpact = 12; // Better quality
        overallBenefit = 18;
        break;
      
      case AdaptationStrategyType.DECOMPOSITION:
        timeImpact = 5; // Slightly slower
        resourceImpact = 5; // Slightly more resource usage
        reliabilityImpact = 15; // More reliable
        qualityImpact = 20; // Much better quality
        overallBenefit = 15;
        break;
      
      case AdaptationStrategyType.DELEGATION:
        timeImpact = -20; // Much faster
        resourceImpact = -10; // Less resource usage
        reliabilityImpact = -10; // Less reliable (external dependency)
        qualityImpact = 5; // Slightly better quality
        overallBenefit = 10;
        break;
      
      case AdaptationStrategyType.SERIALIZATION:
        timeImpact = 15; // Slower execution
        resourceImpact = -10; // Less resource usage
        reliabilityImpact = 20; // Much more reliable
        qualityImpact = 5; // Slightly better quality
        overallBenefit = 5;
        break;
      
      default:
        timeImpact = 0;
        resourceImpact = 0;
        reliabilityImpact = 0;
        qualityImpact = 0;
        overallBenefit = 0;
    }

    // Adjust based on trigger type priority
    const priorityMultiplier = opportunity.priorityScore / 100;
    overallBenefit = Math.round(overallBenefit * priorityMultiplier);

    return {
      timeImpactPercent: timeImpact,
      resourceImpactPercent: resourceImpact,
      reliabilityImpactPercent: reliabilityImpact,
      qualityImpactPercent: qualityImpact,
      overallBenefitScore: Math.max(-100, Math.min(100, overallBenefit)),
      affectedSteps: opportunity.targetSteps || [],
      introducedRisks: this.identifyRisks(strategyType, opportunity),
      requiredResources: this.estimateRequiredResources(strategyType)
    };
  }

  /**
   * Identify risks introduced by a strategy
   */
  private identifyRisks(
    strategyType: AdaptationStrategyType,
    opportunity: AdaptationOpportunity
  ): AdaptationImpact['introducedRisks'] {
    const risks: NonNullable<AdaptationImpact['introducedRisks']> = [];

    switch (strategyType) {
      case AdaptationStrategyType.PARALLELIZATION:
        risks.push({
          description: 'Potential race conditions or resource conflicts',
          severity: 'medium',
          mitigationStrategy: 'Implement proper synchronization and resource locking'
        });
        break;
      
      case AdaptationStrategyType.ELIMINATION:
        risks.push({
          description: 'Removing steps might skip important validations',
          severity: 'high',
          mitigationStrategy: 'Ensure eliminated steps are truly redundant'
        });
        break;
      
      case AdaptationStrategyType.DELEGATION:
        risks.push({
          description: 'External system dependency and potential failures',
          severity: 'medium',
          mitigationStrategy: 'Implement fallback mechanisms and monitoring'
        });
        break;
      
      case AdaptationStrategyType.SUBSTITUTION:
        risks.push({
          description: 'Replacement steps might have different behavior',
          severity: 'low',
          mitigationStrategy: 'Thorough testing of replacement steps'
        });
        break;
    }

    return risks.length > 0 ? risks : undefined;
  }

  /**
   * Estimate required resources for a strategy
   */
  private estimateRequiredResources(
    strategyType: AdaptationStrategyType
  ): Record<string, number> {
    switch (strategyType) {
      case AdaptationStrategyType.PARALLELIZATION:
        return { cpu: 1.5, memory: 1.3 };
      
      case AdaptationStrategyType.INSERTION:
        return { cpu: 1.2, memory: 1.1 };
      
      case AdaptationStrategyType.DECOMPOSITION:
        return { cpu: 1.1, memory: 1.2 };
      
      case AdaptationStrategyType.ELIMINATION:
        return { cpu: 0.8, memory: 0.9 };
      
      case AdaptationStrategyType.CONSOLIDATION:
        return { cpu: 0.9, memory: 0.8 };
      
      default:
        return { cpu: 1.0, memory: 1.0 };
    }
  }

  /**
   * Evaluate an adaptation action
   */
  async evaluateAction(
    action: AdaptationAction,
    planId: string
  ): Promise<AdaptationImpact> {
    if (!this.initialized) {
      throw new PlanAdaptationError('Adaptation system not initialized', 'NOT_INITIALIZED');
    }

    // Get the plan from cache or load it
    let plan = this.planCache.get(planId);
    if (!plan) {
      // In a real implementation, this would load the plan from storage
      plan = { id: planId, steps: [], metadata: {} };
      this.planCache.set(planId, plan);
    }

    // Start with the expected impact from the action
    const baseImpact = action.expectedImpact;
    
    // Adjust impact based on plan-specific factors
    const adjustedImpact: AdaptationImpact = {
      ...baseImpact,
      timeImpactPercent: this.adjustTimeImpact(baseImpact.timeImpactPercent, plan, action),
      resourceImpactPercent: this.adjustResourceImpact(baseImpact.resourceImpactPercent, plan, action),
      reliabilityImpactPercent: this.adjustReliabilityImpact(baseImpact.reliabilityImpactPercent, plan, action),
      qualityImpactPercent: this.adjustQualityImpact(baseImpact.qualityImpactPercent, plan, action),
      overallBenefitScore: 0, // Will be recalculated
      affectedSteps: this.identifyAffectedSteps(plan, action)
    };

    // Recalculate overall benefit score
    adjustedImpact.overallBenefitScore = this.calculateOverallBenefit(adjustedImpact);

    return adjustedImpact;
  }

  /**
   * Adjust time impact based on plan characteristics
   */
  private adjustTimeImpact(
    baseTimeImpact: number,
    plan: Record<string, unknown>,
    action: AdaptationAction
  ): number {
    // In a real implementation, this would analyze plan complexity,
    // step dependencies, and current execution patterns
    let adjustment = 0;
    
    // Example adjustments based on plan size
    const planSteps = (plan.steps as unknown[]) || [];
    if (planSteps.length > 20) {
      // Large plans benefit more from optimization
      adjustment = baseTimeImpact < 0 ? -2 : 1;
    } else if (planSteps.length < 5) {
      // Small plans have less optimization potential
      adjustment = baseTimeImpact < 0 ? 1 : -1;
    }

    return Math.max(-100, Math.min(100, baseTimeImpact + adjustment));
  }

  /**
   * Adjust resource impact based on plan characteristics
   */
  private adjustResourceImpact(
    baseResourceImpact: number,
    plan: Record<string, unknown>,
    action: AdaptationAction
  ): number {
    // Similar logic to time impact but for resources
    let adjustment = 0;
    
    // Example: if plan already uses many resources, optimization is more valuable
    const planComplexity = this.estimatePlanComplexity(plan);
    if (planComplexity > 0.7) {
      adjustment = baseResourceImpact < 0 ? -3 : 2;
    }

    return Math.max(-100, Math.min(100, baseResourceImpact + adjustment));
  }

  /**
   * Adjust reliability impact based on plan characteristics
   */
  private adjustReliabilityImpact(
    baseReliabilityImpact: number,
    plan: Record<string, unknown>,
    action: AdaptationAction
  ): number {
    // Plans with many dependencies benefit more from reliability improvements
    let adjustment = 0;
    
    if (action.targetSteps.length > 3) {
      // Actions affecting many steps have higher reliability impact
      adjustment = baseReliabilityImpact > 0 ? 2 : -1;
    }

    return Math.max(-100, Math.min(100, baseReliabilityImpact + adjustment));
  }

  /**
   * Adjust quality impact based on plan characteristics
   */
  private adjustQualityImpact(
    baseQualityImpact: number,
    plan: Record<string, unknown>,
    action: AdaptationAction
  ): number {
    // Quality improvements are more valuable for complex plans
    let adjustment = 0;
    
    const planComplexity = this.estimatePlanComplexity(plan);
    if (planComplexity > 0.5 && baseQualityImpact > 0) {
      adjustment = 3;
    }

    return Math.max(-100, Math.min(100, baseQualityImpact + adjustment));
  }

  /**
   * Identify steps that will be affected by the action
   */
  private identifyAffectedSteps(
    plan: Record<string, unknown>,
    action: AdaptationAction
  ): string[] {
    // Start with explicitly targeted steps
    const affectedSteps = new Set(action.targetSteps);

    // Add steps from action details
    if (action.details.stepsToRemove) {
      action.details.stepsToRemove.forEach(stepId => affectedSteps.add(stepId));
    }
    
    if (action.details.replacements) {
      action.details.replacements.forEach(replacement => 
        affectedSteps.add(replacement.originalStepId)
      );
    }
    
    if (action.details.parameterChanges) {
      action.details.parameterChanges.forEach(change => 
        affectedSteps.add(change.stepId)
      );
    }

    // Add other affected steps based on strategy type
    if (action.details.consolidation) {
      action.details.consolidation.stepIds.forEach(stepId => affectedSteps.add(stepId));
    }
    
    if (action.details.parallelization) {
      action.details.parallelization.stepIds.forEach(stepId => affectedSteps.add(stepId));
    }

    return Array.from(affectedSteps);
  }

  /**
   * Calculate overall benefit score from individual impact metrics
   */
  private calculateOverallBenefit(impact: AdaptationImpact): number {
    // Weighted calculation of overall benefit
    const timeWeight = 0.3;
    const resourceWeight = 0.25;
    const reliabilityWeight = 0.25;
    const qualityWeight = 0.2;

    const overallBenefit = 
      (impact.timeImpactPercent * timeWeight) +
      (impact.resourceImpactPercent * resourceWeight) +
      (impact.reliabilityImpactPercent * reliabilityWeight) +
      (impact.qualityImpactPercent * qualityWeight);

    return Math.max(-100, Math.min(100, Math.round(overallBenefit)));
  }

  /**
   * Estimate plan complexity (0-1 scale)
   */
  private estimatePlanComplexity(plan: Record<string, unknown>): number {
    const steps = (plan.steps as unknown[]) || [];
    const stepCount = steps.length;
    
    // Simple complexity estimation based on step count
    // In a real implementation, this would consider dependencies, 
    // step types, resource requirements, etc.
    if (stepCount <= 3) return 0.2;
    if (stepCount <= 7) return 0.4;
    if (stepCount <= 15) return 0.6;
    if (stepCount <= 25) return 0.8;
    return 1.0;
  }

  /**
   * Apply an adaptation action
   */
  async applyAdaptation(
    opportunityId: string,
    action: AdaptationAction
  ): Promise<AdaptationResult> {
    if (!this.initialized) {
      throw new PlanAdaptationError('Adaptation system not initialized', 'NOT_INITIALIZED');
    }

    const startTime = Date.now();
    const logs: AdaptationResult['logs'] = [];
    let success = false;
    let error: Error | string | undefined;
    let modifiedSteps: string[] = [];

    // Add a small delay to ensure measurable duration
    await new Promise(resolve => setTimeout(resolve, 5));

    const opportunity = this.opportunities.get(opportunityId);
    if (!opportunity) {
      error = `Opportunity not found: ${opportunityId}`;
      success = false;

      logs.push({
        level: 'error',
        message: error,
        timestamp: new Date()
      });

      const result: AdaptationResult = {
        success,
        originalPlanId: 'unknown',
        modifiedPlanId: 'unknown',
        opportunity: {
          id: opportunityId,
          planId: 'unknown',
          trigger: {
            type: AdaptationTriggerType.ERROR_RECOVERY,
            source: 'system',
            description: 'Opportunity not found',
            timestamp: new Date()
          },
          scope: AdaptationScope.FULL_PLAN,
          priorityScore: 0,
          applicableStrategies: [],
          discoveredAt: new Date(),
          expiresAt: new Date()
        },
        action,
        timestamp: new Date(),
        durationMs: Date.now() - startTime,
        modifiedSteps: [],
        logs,
        error
      };

      return result;
    }

    try {
      logs.push({
        level: 'info',
        message: `Starting adaptation: ${action.description}`,
        timestamp: new Date()
      });

      // Get the plan
      let plan = this.planCache.get(opportunity.planId);
      if (!plan) {
        plan = { id: opportunity.planId, steps: [], metadata: {} };
        this.planCache.set(opportunity.planId, plan);
      }

      // Apply the adaptation based on strategy type
      const modifiedPlan = await this.executeAdaptationStrategy(plan, action, logs);
      
      // Update plan cache with modified plan
      const modifiedPlanId = `${opportunity.planId}_adapted_${uuidv4()}`;
      this.planCache.set(modifiedPlanId, modifiedPlan);

      // Identify modified steps
      modifiedSteps = this.identifyModifiedSteps(plan, modifiedPlan, action);

      logs.push({
        level: 'info',
        message: `Adaptation completed successfully. Modified ${modifiedSteps.length} steps.`,
        timestamp: new Date()
      });

      success = true;

      // Create the result
      const result: AdaptationResult = {
        success,
        originalPlanId: opportunity.planId,
        modifiedPlanId,
        opportunity,
        action,
        timestamp: new Date(),
        durationMs: Date.now() - startTime,
        modifiedSteps,
        logs,
        error,
        measuredImpact: await this.measureActualImpact(plan, modifiedPlan, action)
      };

      // Store the result
      const planResults = this.results.get(opportunity.planId) || [];
      planResults.push(result);
      this.results.set(opportunity.planId, planResults);

      return result;

    } catch (err) {
      error = err instanceof Error ? err : String(err);
      success = false;

      logs.push({
        level: 'error',
        message: `Adaptation failed: ${error}`,
        timestamp: new Date()
      });

      const result: AdaptationResult = {
        success,
        originalPlanId: opportunity.planId,
        modifiedPlanId: opportunity.planId, // No modification on failure
        opportunity,
        action,
        timestamp: new Date(),
        durationMs: Date.now() - startTime,
        modifiedSteps: [],
        logs,
        error
      };

      // Store the failed result
      const planResults = this.results.get(opportunity.planId) || [];
      planResults.push(result);
      this.results.set(opportunity.planId, planResults);

      return result;
    }
  }

  /**
   * Execute the adaptation strategy on the plan
   */
  private async executeAdaptationStrategy(
    plan: Record<string, unknown>,
    action: AdaptationAction,
    logs: AdaptationResult['logs']
  ): Promise<Record<string, unknown>> {
    // Create a deep copy of the plan for modification
    const modifiedPlan = JSON.parse(JSON.stringify(plan));
    
    logs.push({
      level: 'info',
      message: `Executing ${action.strategyType} strategy`,
      timestamp: new Date()
    });

    // Apply strategy-specific modifications
    switch (action.strategyType) {
      case AdaptationStrategyType.ELIMINATION:
        this.applyElimination(modifiedPlan, action, logs);
        break;
      
      case AdaptationStrategyType.INSERTION:
        this.applyInsertion(modifiedPlan, action, logs);
        break;
      
      case AdaptationStrategyType.SUBSTITUTION:
        this.applySubstitution(modifiedPlan, action, logs);
        break;
      
      case AdaptationStrategyType.REORDERING:
        this.applyReordering(modifiedPlan, action, logs);
        break;
      
      case AdaptationStrategyType.PARAMETERIZATION:
        this.applyParameterization(modifiedPlan, action, logs);
        break;
      
      case AdaptationStrategyType.CONSOLIDATION:
        this.applyConsolidation(modifiedPlan, action, logs);
        break;
      
      case AdaptationStrategyType.PARALLELIZATION:
        this.applyParallelization(modifiedPlan, action, logs);
        break;
      
      default:
        logs.push({
          level: 'warning',
          message: `Strategy ${action.strategyType} not fully implemented, applying basic modifications`,
          timestamp: new Date()
        });
    }

    return modifiedPlan;
  }

  /**
   * Apply elimination strategy
   */
  private applyElimination(
    plan: Record<string, unknown>,
    action: AdaptationAction,
    logs: AdaptationResult['logs']
  ): void {
    if (action.details.stepsToRemove) {
      const steps = (plan.steps as unknown[]) || [];
      const stepsToRemove = new Set(action.details.stepsToRemove);
      
      plan.steps = steps.filter((step: any) => !stepsToRemove.has(step.id));
      
      logs.push({
        level: 'info',
        message: `Removed ${action.details.stepsToRemove.length} steps`,
        timestamp: new Date()
      });
    }
  }

  /**
   * Apply insertion strategy
   */
  private applyInsertion(
    plan: Record<string, unknown>,
    action: AdaptationAction,
    logs: AdaptationResult['logs']
  ): void {
    if (action.details.stepsToAdd) {
      logs.push({
        level: 'info',
        message: `Adding ${action.details.stepsToAdd.length} new steps`,
        timestamp: new Date()
      });
      // Implementation would insert steps at specified positions
    }
  }

  /**
   * Apply substitution strategy
   */
  private applySubstitution(
    plan: Record<string, unknown>,
    action: AdaptationAction,
    logs: AdaptationResult['logs']
  ): void {
    if (action.details.replacements) {
      logs.push({
        level: 'info',
        message: `Replacing ${action.details.replacements.length} steps`,
        timestamp: new Date()
      });
      // Implementation would replace specified steps
    }
  }

  /**
   * Apply reordering strategy
   */
  private applyReordering(
    plan: Record<string, unknown>,
    action: AdaptationAction,
    logs: AdaptationResult['logs']
  ): void {
    if (action.details.newStepOrder) {
      logs.push({
        level: 'info',
        message: `Reordering steps according to new sequence`,
        timestamp: new Date()
      });
      // Implementation would reorder steps
    }
  }

  /**
   * Apply parameterization strategy
   */
  private applyParameterization(
    plan: Record<string, unknown>,
    action: AdaptationAction,
    logs: AdaptationResult['logs']
  ): void {
    if (action.details.parameterChanges) {
      logs.push({
        level: 'info',
        message: `Updating parameters for ${action.details.parameterChanges.length} steps`,
        timestamp: new Date()
      });
      // Implementation would update step parameters
    }
  }

  /**
   * Apply consolidation strategy
   */
  private applyConsolidation(
    plan: Record<string, unknown>,
    action: AdaptationAction,
    logs: AdaptationResult['logs']
  ): void {
    if (action.details.consolidation) {
      logs.push({
        level: 'info',
        message: `Consolidating ${action.details.consolidation.stepIds.length} steps`,
        timestamp: new Date()
      });
      // Implementation would consolidate steps
    }
  }

  /**
   * Apply parallelization strategy
   */
  private applyParallelization(
    plan: Record<string, unknown>,
    action: AdaptationAction,
    logs: AdaptationResult['logs']
  ): void {
    if (action.details.parallelization) {
      logs.push({
        level: 'info',
        message: `Parallelizing ${action.details.parallelization.stepIds.length} steps`,
        timestamp: new Date()
      });
      // Implementation would set up parallel execution
    }
  }

  /**
   * Identify which steps were modified
   */
  private identifyModifiedSteps(
    originalPlan: Record<string, unknown>,
    modifiedPlan: Record<string, unknown>,
    action: AdaptationAction
  ): string[] {
    // For now, return the target steps from the action
    // In a real implementation, this would compare the plans
    return action.targetSteps;
  }

  /**
   * Measure actual impact after adaptation
   */
  private async measureActualImpact(
    originalPlan: Record<string, unknown>,
    modifiedPlan: Record<string, unknown>,
    action: AdaptationAction
  ): Promise<Partial<AdaptationImpact>> {
    // In a real implementation, this would analyze the actual changes
    // and measure performance differences
    return {
      affectedSteps: action.targetSteps,
      overallBenefitScore: action.expectedImpact.overallBenefitScore * 0.9 // Slightly less than expected
    };
  }

  /**
   * Get adaptation history for a plan
   */
  async getAdaptationHistory(planId: string): Promise<AdaptationResult[]> {
    if (!this.initialized) {
      throw new PlanAdaptationError('Adaptation system not initialized', 'NOT_INITIALIZED');
    }

    if (!planId?.trim()) {
      throw new PlanAdaptationError('Plan ID is required', 'INVALID_INPUT');
    }

    // Get results for this plan, sorted by timestamp (newest first)
    const planResults = this.results.get(planId.trim()) || [];
    return planResults.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Trigger adaptation process
   */
  async triggerAdaptation(
    planId: string,
    trigger: {
      type: AdaptationTriggerType;
      source: string;
      description: string;
      context?: Record<string, unknown>;
    },
    options?: {
      autoApply?: boolean;
      preferredStrategies?: AdaptationStrategyType[];
      scope?: AdaptationScope;
      targetSteps?: string[];
    }
  ): Promise<{
    opportunities: AdaptationOpportunity[];
    actions: AdaptationAction[];
    appliedAdaptation?: AdaptationResult;
  }> {
    if (!this.initialized) {
      throw new PlanAdaptationError('Adaptation system not initialized', 'NOT_INITIALIZED');
    }

    if (!planId?.trim()) {
      throw new PlanAdaptationError('Plan ID is required', 'INVALID_INPUT');
    }

    // Step 1: Detect opportunities
    const opportunities = await this.detectOpportunities(planId.trim(), trigger);
    
    if (opportunities.length === 0) {
      return {
        opportunities: [],
        actions: [],
        appliedAdaptation: undefined
      };
    }

    // Step 2: Generate actions for all opportunities
    const allActions: AdaptationAction[] = [];
    
    for (const opportunity of opportunities) {
      try {
        const actions = await this.generateActions(opportunity.id);
        
        // Filter actions based on preferred strategies if specified
        let filteredActions = actions;
        if (options?.preferredStrategies && options.preferredStrategies.length > 0) {
          filteredActions = actions.filter(action => 
            options.preferredStrategies!.includes(action.strategyType)
          );
        }
        
        allActions.push(...filteredActions);
      } catch (error) {
        console.warn(`Failed to generate actions for opportunity ${opportunity.id}:`, error);
      }
    }

    // Step 3: Auto-apply best adaptation if requested
    let appliedAdaptation: AdaptationResult | undefined;
    
    if (options?.autoApply && allActions.length > 0) {
      try {
        // Find the best action based on overall benefit score
        const bestAction = allActions.reduce((best, current) => 
          current.expectedImpact.overallBenefitScore > best.expectedImpact.overallBenefitScore 
            ? current 
            : best
        );

        // Find the opportunity for the best action
        const bestOpportunity = opportunities.find(opp => 
          allActions.some(action => 
            action === bestAction && this.actions.get(opp.id)?.includes(action)
          )
        );

        if (bestOpportunity) {
          appliedAdaptation = await this.applyAdaptation(bestOpportunity.id, bestAction);
        }
      } catch (error) {
        console.warn('Failed to auto-apply adaptation:', error);
      }
    }

    return {
      opportunities,
      actions: allActions,
      appliedAdaptation
    };
  }

  /**
   * Get adaptation statistics
   */
  async getAdaptationStatistics(timeRange?: { start: Date; end: Date }): Promise<{
    totalOpportunities: number;
    totalActions: number;
    totalApplications: number;
    successRate: number;
    opportunitiesByTrigger: Record<AdaptationTriggerType, number>;
    actionsByStrategy: Record<AdaptationStrategyType, number>;
    averageImpact: {
      timeImpactPercent: number;
      resourceImpactPercent: number;
      reliabilityImpactPercent: number;
      qualityImpactPercent: number;
      overallBenefitScore: number;
    };
    mostEffectiveStrategies: Array<{
      type: AdaptationStrategyType;
      averageBenefitScore: number;
      usageCount: number;
    }>;
  }> {
    if (!this.initialized) {
      throw new PlanAdaptationError('Adaptation system not initialized', 'NOT_INITIALIZED');
    }

    // Collect all results across all plans
    const allResults: AdaptationResult[] = [];
    for (const planResults of Array.from(this.results.values())) {
      allResults.push(...planResults);
    }

    // Filter by time range if specified
    const filteredResults = timeRange 
      ? allResults.filter(result => 
          result.timestamp >= timeRange.start && result.timestamp <= timeRange.end
        )
      : allResults;

    // Collect all opportunities
    const allOpportunities = Array.from(this.opportunities.values());
    const filteredOpportunities = timeRange
      ? allOpportunities.filter(opp => 
          opp.discoveredAt >= timeRange.start && opp.discoveredAt <= timeRange.end
        )
      : allOpportunities;

    // Collect all actions
    const allActions: AdaptationAction[] = [];
    for (const actionList of Array.from(this.actions.values())) {
      allActions.push(...actionList);
    }

    // Calculate basic statistics
    const totalOpportunities = filteredOpportunities.length;
    const totalActions = allActions.length;
    const totalApplications = filteredResults.length;
    const successfulApplications = filteredResults.filter(r => r.success).length;
    const successRate = totalApplications > 0 ? successfulApplications / totalApplications : 0;

    // Calculate opportunities by trigger type
    const opportunitiesByTrigger: Record<AdaptationTriggerType, number> = {} as any;
    for (const triggerType of Object.values(AdaptationTriggerType)) {
      opportunitiesByTrigger[triggerType] = 0;
    }
    
    filteredOpportunities.forEach(opp => {
      opportunitiesByTrigger[opp.trigger.type]++;
    });

    // Calculate actions by strategy type
    const actionsByStrategy: Record<AdaptationStrategyType, number> = {} as any;
    for (const strategyType of Object.values(AdaptationStrategyType)) {
      actionsByStrategy[strategyType] = 0;
    }
    
    allActions.forEach(action => {
      actionsByStrategy[action.strategyType]++;
    });

    // Calculate average impact from successful applications
    const successfulResults = filteredResults.filter(r => r.success && r.measuredImpact);
    const averageImpact = this.calculateAverageImpact(successfulResults);

    // Calculate most effective strategies
    const mostEffectiveStrategies = this.calculateMostEffectiveStrategies(filteredResults);

    return {
      totalOpportunities,
      totalActions,
      totalApplications,
      successRate,
      opportunitiesByTrigger,
      actionsByStrategy,
      averageImpact,
      mostEffectiveStrategies
    };
  }

  /**
   * Calculate average impact from successful results
   */
  private calculateAverageImpact(successfulResults: AdaptationResult[]): {
    timeImpactPercent: number;
    resourceImpactPercent: number;
    reliabilityImpactPercent: number;
    qualityImpactPercent: number;
    overallBenefitScore: number;
  } {
    if (successfulResults.length === 0) {
      return {
        timeImpactPercent: 0,
        resourceImpactPercent: 0,
        reliabilityImpactPercent: 0,
        qualityImpactPercent: 0,
        overallBenefitScore: 0
      };
    }

    const totals = successfulResults.reduce((acc, result) => {
      const impact = result.measuredImpact || result.action.expectedImpact;
      return {
        timeImpactPercent: acc.timeImpactPercent + (impact.timeImpactPercent || 0),
        resourceImpactPercent: acc.resourceImpactPercent + (impact.resourceImpactPercent || 0),
        reliabilityImpactPercent: acc.reliabilityImpactPercent + (impact.reliabilityImpactPercent || 0),
        qualityImpactPercent: acc.qualityImpactPercent + (impact.qualityImpactPercent || 0),
        overallBenefitScore: acc.overallBenefitScore + (impact.overallBenefitScore || 0)
      };
    }, {
      timeImpactPercent: 0,
      resourceImpactPercent: 0,
      reliabilityImpactPercent: 0,
      qualityImpactPercent: 0,
      overallBenefitScore: 0
    });

    const count = successfulResults.length;
    return {
      timeImpactPercent: Math.round((totals.timeImpactPercent / count) * 100) / 100,
      resourceImpactPercent: Math.round((totals.resourceImpactPercent / count) * 100) / 100,
      reliabilityImpactPercent: Math.round((totals.reliabilityImpactPercent / count) * 100) / 100,
      qualityImpactPercent: Math.round((totals.qualityImpactPercent / count) * 100) / 100,
      overallBenefitScore: Math.round((totals.overallBenefitScore / count) * 100) / 100
    };
  }

  /**
   * Calculate most effective strategies based on results
   */
  private calculateMostEffectiveStrategies(results: AdaptationResult[]): Array<{
    type: AdaptationStrategyType;
    averageBenefitScore: number;
    usageCount: number;
  }> {
    const strategyStats = new Map<AdaptationStrategyType, {
      totalBenefit: number;
      count: number;
    }>();

    // Collect statistics for each strategy type
    results.forEach(result => {
      if (result.success) {
        const strategyType = result.action.strategyType;
        const benefit = result.measuredImpact?.overallBenefitScore || 
                       result.action.expectedImpact.overallBenefitScore;
        
        const existing = strategyStats.get(strategyType) || { totalBenefit: 0, count: 0 };
        strategyStats.set(strategyType, {
          totalBenefit: existing.totalBenefit + benefit,
          count: existing.count + 1
        });
      }
    });

    // Convert to array and calculate averages
    const strategies = Array.from(strategyStats.entries()).map(([type, stats]) => ({
      type,
      averageBenefitScore: Math.round((stats.totalBenefit / stats.count) * 100) / 100,
      usageCount: stats.count
    }));

    // Sort by average benefit score (descending)
    return strategies.sort((a, b) => b.averageBenefitScore - a.averageBenefitScore);
  }

  /**
   * Shutdown the adaptation system
   */
  async shutdown(): Promise<boolean> {
    if (!this.initialized) {
      return true;
    }

    this.initialized = false;
    this.strategies.clear();
    this.opportunities.clear();
    this.actions.clear();
    this.results.clear();
    this.planCache.clear();
    
    return true;
  }
} 