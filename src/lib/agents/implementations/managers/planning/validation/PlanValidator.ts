/**
 * PlanValidator.ts - Plan validation component
 * 
 * This component handles comprehensive plan validation including structure validation,
 * feasibility analysis, resource requirement validation, and dependency cycle detection.
 */

import { ulid } from 'ulid';
import { 
  ValidationResult,
  ValidationIssue
} from '../interfaces/PlanningInterfaces';
import {
  PlanValidationOptions,
  DependencyValidationResult,
  ResourceValidationResult,
  FeasibilityValidationResult,
  PlanValidatorConfig
} from '../interfaces/ValidationInterfaces';
import { 
  Plan, 
  PlanStep 
} from '../../../../../../agents/shared/base/managers/PlanningManager.interface';
import { createLogger } from '../../../../../logging/winston-logger';



/**
 * Default configuration for plan validation
 */
const DEFAULT_CONFIG: PlanValidatorConfig = {
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
};

/**
 * Plan validation error
 */
export class PlanValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly planId: string,
    public readonly validationType: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'PlanValidationError';
  }
}

/**
 * Plan validator implementation
 */
export class PlanValidator {
  private readonly logger = createLogger({ moduleId: 'plan-validator' });
  private readonly config: PlanValidatorConfig;
  private validationHistory: Map<string, ValidationResult> = new Map();

  constructor(config: Partial<PlanValidatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (this.config.enableLogging) {
      this.logger.info('PlanValidator initialized', { config: this.config });
    }
  }

  /**
   * Validate a complete plan
   */
  async validatePlan(
    plan: Plan,
    options: Partial<PlanValidationOptions> = {}
  ): Promise<ValidationResult> {
    const validationId = ulid();
    const startTime = Date.now();

    try {
      if (this.config.enableLogging) {
        this.logger.info('Starting plan validation', {
          validationId,
          planId: plan.id,
          planName: plan.name,
          stepCount: plan.steps.length
        });
      }

      const issues: ValidationIssue[] = [];
      let score = 1.0;

      // Structure validation
      if (this.config.enableStructureValidation) {
        const structureResult = await this.validateStructure(plan, options);
        issues.push(...structureResult.issues);
        score = Math.min(score, structureResult.score);
      }

      // Dependency validation
      if (this.config.enableDependencyValidation) {
        const dependencyResult = await this.validateDependencies(plan, options);
        issues.push(...dependencyResult.issues);
        score = Math.min(score, dependencyResult.score);
      }

      // Resource validation
      if (this.config.enableResourceValidation) {
        const resourceResult = await this.validateResources(plan, options);
        issues.push(...resourceResult.issues);
        score = Math.min(score, resourceResult.score);
      }

      // Feasibility analysis
      if (this.config.enableFeasibilityAnalysis) {
        const feasibilityResult = await this.validateFeasibility(plan, options);
        issues.push(...feasibilityResult.issues);
        score = Math.min(score, feasibilityResult.score);
      }

      const validationTime = Date.now() - startTime;
      const result: ValidationResult = {
        isValid: issues.filter(i => i.severity === 'error').length === 0,
        score,
        issues,
        suggestions: issues.map(i => i.suggestedFix).filter(Boolean) as string[],
        metadata: {
          validationId,
          validationTime,
          validationType: 'complete',
          planComplexity: this.calculatePlanComplexity(plan)
        }
      };

      // Store validation history
      this.validationHistory.set(plan.id, result);

      if (this.config.enableLogging) {
        this.logger.info('Plan validation completed', {
          validationId,
          planId: plan.id,
          isValid: result.isValid,
          score: result.score,
          issueCount: issues.length,
          validationTime
        });
      }

      return result;

    } catch (error) {
      const validationTime = Date.now() - startTime;
      
      if (this.config.enableLogging) {
        this.logger.error('Plan validation failed', {
          validationId,
          planId: plan.id,
          error: error instanceof Error ? error.message : String(error),
          validationTime
        });
      }

      throw new PlanValidationError(
        `Plan validation failed: ${error instanceof Error ? error.message : String(error)}`,
        'VALIDATION_FAILED',
        plan.id,
        'complete',
        { validationId, validationTime }
      );
    }
  }

  /**
   * Validate plan structure
   */
  private async validateStructure(
    plan: Plan,
    options: Partial<PlanValidationOptions>
  ): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    let score = 1.0;

    // Basic plan fields
    if (!plan.id || plan.id.trim().length === 0) {
      issues.push({
        severity: 'error',
        message: 'Plan ID is required',
        location: { field: 'id' },
        suggestedFix: 'Provide a valid plan ID'
      });
      score -= 0.2;
    }

    if (!plan.name || plan.name.trim().length === 0) {
      issues.push({
        severity: 'error',
        message: 'Plan name is required',
        location: { field: 'name' },
        suggestedFix: 'Provide a descriptive plan name'
      });
      score -= 0.2;
    }

    if (!plan.description || plan.description.trim().length === 0) {
      issues.push({
        severity: 'warning',
        message: 'Plan description is missing',
        location: { field: 'description' },
        suggestedFix: 'Add a clear plan description'
      });
      score -= 0.1;
    }

    if (!plan.goals || plan.goals.length === 0) {
      issues.push({
        severity: 'error',
        message: 'Plan must have at least one goal',
        location: { field: 'goals' },
        suggestedFix: 'Add at least one goal to the plan'
      });
      score -= 0.3;
    }

    // Steps validation
    if (!plan.steps || plan.steps.length === 0) {
      issues.push({
        severity: 'error',
        message: 'Plan must have at least one step',
        location: { field: 'steps' },
        suggestedFix: 'Add at least one step to the plan'
      });
      score -= 0.4;
    } else {
      // Check step count limits
      if (plan.steps.length > this.config.maxStepsPerPlan) {
        issues.push({
          severity: 'warning',
          message: `Plan has too many steps (${plan.steps.length} > ${this.config.maxStepsPerPlan})`,
          location: { field: 'steps' },
          suggestedFix: 'Consider breaking the plan into smaller sub-plans'
        });
        score -= 0.1;
      }

      // Validate individual steps
      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i];
        const stepIssues = this.validateStepStructure(step, i);
        issues.push(...stepIssues);
        if (stepIssues.some(issue => issue.severity === 'error')) {
          score -= 0.1;
        }
      }
    }

    // Plan metadata validation
    if (plan.priority < 1 || plan.priority > 10) {
      issues.push({
        severity: 'warning',
        message: 'Plan priority should be between 1 and 10',
        location: { field: 'priority' },
        suggestedFix: 'Set priority to a value between 1 and 10'
      });
      score -= 0.05;
    }

    if (plan.confidence < 0 || plan.confidence > 1) {
      issues.push({
        severity: 'error',
        message: 'Plan confidence must be between 0 and 1',
        location: { field: 'confidence' },
        suggestedFix: 'Set confidence to a value between 0 and 1'
      });
      score -= 0.1;
    }

    return {
      isValid: issues.filter(i => i.severity === 'error').length === 0,
      score: Math.max(score, 0),
      issues,
      suggestions: issues.map(i => i.suggestedFix).filter(Boolean) as string[]
    };
  }

  /**
   * Validate step structure
   */
  private validateStepStructure(step: PlanStep, index: number): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!step.id || step.id.trim().length === 0) {
      issues.push({
        severity: 'error',
        message: `Step ${index + 1} is missing an ID`,
        location: { field: 'steps', index },
        suggestedFix: 'Provide a unique ID for the step'
      });
    }

    if (!step.name || step.name.trim().length === 0) {
      issues.push({
        severity: 'error',
        message: `Step ${index + 1} is missing a name`,
        location: { field: 'steps', index },
        suggestedFix: 'Provide a descriptive name for the step'
      });
    }

    if (!step.actions || step.actions.length === 0) {
      issues.push({
        severity: 'warning',
        message: `Step ${index + 1} has no actions`,
        location: { field: 'steps', index },
        suggestedFix: 'Add at least one action to the step'
      });
    } else if (step.actions.length > this.config.maxActionsPerStep) {
      issues.push({
        severity: 'warning',
        message: `Step ${index + 1} has too many actions (${step.actions.length} > ${this.config.maxActionsPerStep})`,
        location: { field: 'steps', index },
        suggestedFix: 'Consider breaking the step into smaller steps'
      });
    }

    return issues;
  }

  /**
   * Validate plan dependencies
   */
  private async validateDependencies(
    plan: Plan,
    options: Partial<PlanValidationOptions>
  ): Promise<DependencyValidationResult> {
    const issues: ValidationIssue[] = [];
    let score = 1.0;

    try {
      // Build dependency graph
      const dependencyGraph = this.buildDependencyGraph(plan);
      
      // Check for circular dependencies
      const circularDependencies = this.detectCircularDependencies(dependencyGraph);
      if (circularDependencies.length > 0) {
        issues.push({
          severity: 'error',
          message: `Circular dependencies detected: ${circularDependencies.join(', ')}`,
          location: { field: 'dependencies' },
          suggestedFix: 'Remove circular dependencies between steps'
        });
        score -= 0.5;
      }

      // Check for missing dependencies
      const missingDependencies = this.findMissingDependencies(plan);
      if (missingDependencies.length > 0) {
        issues.push({
          severity: 'error',
          message: `Missing step dependencies: ${missingDependencies.join(', ')}`,
          location: { field: 'dependencies' },
          suggestedFix: 'Ensure all referenced dependencies exist in the plan'
        });
        score -= 0.3;
      }

      // Check dependency ordering
      const orderingIssues = this.validateDependencyOrdering(plan);
      issues.push(...orderingIssues);
      if (orderingIssues.some(issue => issue.severity === 'error')) {
        score -= 0.2;
      }

    } catch (error) {
      issues.push({
        severity: 'error',
        message: 'Failed to validate dependencies',
        location: { field: 'dependencies' },
        suggestedFix: 'Check plan structure and dependency definitions'
      });
      score -= 0.4;
    }

    return {
      isValid: issues.filter(i => i.severity === 'error').length === 0,
      score: Math.max(score, 0),
      issues,
      suggestions: issues.map(i => i.suggestedFix).filter(Boolean) as string[],
      circularDependencies: [],
      missingDependencies: [],
      dependencyDepth: this.calculateDependencyDepth(plan)
    };
  }

  /**
   * Build dependency graph from plan
   */
  private buildDependencyGraph(plan: Plan): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    for (const step of plan.steps) {
      graph.set(step.id, step.dependencies || []);
    }
    
    return graph;
  }

  /**
   * Detect circular dependencies using DFS
   */
  private detectCircularDependencies(graph: Map<string, string[]>): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[] = [];

    const dfs = (node: string, path: string[]): boolean => {
      if (recursionStack.has(node)) {
        const cycleStart = path.indexOf(node);
        cycles.push(path.slice(cycleStart).concat(node).join(' -> '));
        return true;
      }

      if (visited.has(node)) {
        return false;
      }

      visited.add(node);
      recursionStack.add(node);

      const dependencies = graph.get(node) || [];
      for (const dep of dependencies) {
        if (dfs(dep, [...path, node])) {
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    };

    const nodeIds = Array.from(graph.keys());
    for (const node of nodeIds) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  /**
   * Find missing dependencies
   */
  private findMissingDependencies(plan: Plan): string[] {
    const stepIds = new Set(plan.steps.map(step => step.id));
    const missingDeps: string[] = [];

    for (const step of plan.steps) {
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          if (!stepIds.has(dep)) {
            missingDeps.push(dep);
          }
        }
      }
    }

    return Array.from(new Set(missingDeps));
  }

  /**
   * Validate dependency ordering
   */
  private validateDependencyOrdering(plan: Plan): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const stepPositions = new Map<string, number>();
    
    plan.steps.forEach((step, index) => {
      stepPositions.set(step.id, index);
    });

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          const depPosition = stepPositions.get(dep);
          if (depPosition !== undefined && depPosition >= i) {
            issues.push({
              severity: 'warning',
              message: `Step ${step.name} depends on ${dep} which appears later in the plan`,
              location: { field: 'steps', index: i },
              suggestedFix: 'Reorder steps to ensure dependencies come before dependent steps'
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Calculate dependency depth
   */
  private calculateDependencyDepth(plan: Plan): number {
    const graph = this.buildDependencyGraph(plan);
    let maxDepth = 0;

    const calculateDepth = (node: string, visited: Set<string>): number => {
      if (visited.has(node)) return 0;
      visited.add(node);

      const dependencies = graph.get(node) || [];
      if (dependencies.length === 0) return 1;

      let maxChildDepth = 0;
      for (const dep of dependencies) {
        maxChildDepth = Math.max(maxChildDepth, calculateDepth(dep, new Set(visited)));
      }

      return maxChildDepth + 1;
    };

    const stepIds = Array.from(graph.keys());
    for (const stepId of stepIds) {
      maxDepth = Math.max(maxDepth, calculateDepth(stepId, new Set()));
    }

    return maxDepth;
  }

  /**
   * Validate resource requirements
   */
  private async validateResources(
    plan: Plan,
    options: Partial<PlanValidationOptions>
  ): Promise<ResourceValidationResult> {
    const issues: ValidationIssue[] = [];
    let score = 1.0;

    // Check for resource conflicts
    const resourceConflicts = this.detectResourceConflicts(plan);
    if (resourceConflicts.length > 0) {
      issues.push({
        severity: 'warning',
        message: `Resource conflicts detected: ${resourceConflicts.join(', ')}`,
        location: { field: 'resources' },
        suggestedFix: 'Resolve resource conflicts by adjusting step scheduling or resource allocation'
      });
      score -= 0.2;
    }

    // Validate resource availability
    const unavailableResources = this.checkResourceAvailability(plan);
    if (unavailableResources.length > 0) {
      issues.push({
        severity: 'error',
        message: `Unavailable resources: ${unavailableResources.join(', ')}`,
        location: { field: 'resources' },
        suggestedFix: 'Ensure all required resources are available or provide alternatives'
      });
      score -= 0.3;
    }

    return {
      isValid: issues.filter(i => i.severity === 'error').length === 0,
      score: Math.max(score, 0),
      issues,
      suggestions: issues.map(i => i.suggestedFix).filter(Boolean) as string[],
      resourceConflicts: resourceConflicts,
      unavailableResources: unavailableResources,
      estimatedResourceUsage: this.estimateResourceUsage(plan)
    };
  }

  /**
   * Detect resource conflicts
   */
  private detectResourceConflicts(plan: Plan): string[] {
    // Simplified resource conflict detection
    // In a real implementation, this would analyze concurrent steps and their resource requirements
    return [];
  }

  /**
   * Check resource availability
   */
  private checkResourceAvailability(plan: Plan): string[] {
    // Simplified resource availability check
    // In a real implementation, this would check against available resources
    return [];
  }

  /**
   * Estimate resource usage
   */
  private estimateResourceUsage(plan: Plan): Record<string, number> {
    // Simplified resource usage estimation
    return {
      cpu: plan.steps.length * 0.1,
      memory: plan.steps.length * 100,
      network: plan.steps.length * 0.05
    };
  }

  /**
   * Validate plan feasibility
   */
  private async validateFeasibility(
    plan: Plan,
    options: Partial<PlanValidationOptions>
  ): Promise<FeasibilityValidationResult> {
    const issues: ValidationIssue[] = [];
    let score = 1.0;

    // Check plan complexity
    const complexity = this.calculatePlanComplexity(plan);
    if (complexity > this.config.maxPlanComplexity) {
      issues.push({
        severity: 'warning',
        message: `Plan complexity (${complexity}) exceeds maximum (${this.config.maxPlanComplexity})`,
        location: { field: 'complexity' },
        suggestedFix: 'Simplify the plan or break it into smaller sub-plans'
      });
      score -= 0.2;
    }

    // Check estimated execution time
    const estimatedTime = this.estimateExecutionTime(plan);
    if (estimatedTime > 24 * 60 * 60 * 1000) { // 24 hours
      issues.push({
        severity: 'warning',
        message: `Estimated execution time (${Math.round(estimatedTime / 3600000)}h) is very long`,
        location: { field: 'executionTime' },
        suggestedFix: 'Consider optimizing the plan or breaking it into phases'
      });
      score -= 0.1;
    }

    // Check success probability
    const successProbability = this.estimateSuccessProbability(plan);
    if (successProbability < 0.5) {
      issues.push({
        severity: 'warning',
        message: `Low success probability (${Math.round(successProbability * 100)}%)`,
        location: { field: 'successProbability' },
        suggestedFix: 'Review plan steps and add error handling or alternative approaches'
      });
      score -= 0.2;
    }

    return {
      isValid: issues.filter(i => i.severity === 'error').length === 0,
      score: Math.max(score, 0),
      issues,
      suggestions: issues.map(i => i.suggestedFix).filter(Boolean) as string[],
      complexity,
      estimatedExecutionTime: estimatedTime,
      successProbability,
      riskFactors: this.identifyRiskFactors(plan)
    };
  }

  /**
   * Calculate plan complexity
   */
  private calculatePlanComplexity(plan: Plan): number {
    let complexity = 0;
    
    // Base complexity from step count
    complexity += plan.steps.length * 0.5;
    
    // Complexity from actions
    const totalActions = plan.steps.reduce((sum, step) => sum + (step.actions?.length || 0), 0);
    complexity += totalActions * 0.3;
    
    // Complexity from dependencies
    const totalDependencies = plan.steps.reduce((sum, step) => sum + (step.dependencies?.length || 0), 0);
    complexity += totalDependencies * 0.2;
    
    return Math.round(complexity * 10) / 10;
  }

  /**
   * Estimate execution time
   */
  private estimateExecutionTime(plan: Plan): number {
    // Simplified estimation: 5 minutes per step + 1 minute per action
    const stepTime = plan.steps.length * 5 * 60 * 1000; // 5 minutes per step
    const actionTime = plan.steps.reduce((sum, step) => sum + (step.actions?.length || 0), 0) * 60 * 1000; // 1 minute per action
    return stepTime + actionTime;
  }

  /**
   * Estimate success probability
   */
  private estimateSuccessProbability(plan: Plan): number {
    // Simplified estimation based on plan confidence and complexity
    const complexity = this.calculatePlanComplexity(plan);
    const complexityFactor = Math.max(0.1, 1 - (complexity / 20));
    return Math.min(0.95, plan.confidence * complexityFactor);
  }

  /**
   * Identify risk factors
   */
  private identifyRiskFactors(plan: Plan): string[] {
    const risks: string[] = [];
    
    if (plan.steps.length > 20) {
      risks.push('High number of steps increases coordination complexity');
    }
    
    const totalActions = plan.steps.reduce((sum, step) => sum + (step.actions?.length || 0), 0);
    if (totalActions > 50) {
      risks.push('High number of actions increases execution risk');
    }
    
    const dependencyDepth = this.calculateDependencyDepth(plan);
    if (dependencyDepth > 5) {
      risks.push('Deep dependency chains increase failure propagation risk');
    }
    
    return risks;
  }

  /**
   * Get validation history for a plan
   */
  getValidationHistory(planId: string): ValidationResult | undefined {
    return this.validationHistory.get(planId);
  }

  /**
   * Clear validation history
   */
  clearValidationHistory(): void {
    this.validationHistory.clear();
  }

  /**
   * Configure validator behavior
   */
  configure(config: Partial<PlanValidatorConfig>): void {
    Object.assign(this.config, config);
    
    if (this.config.enableLogging) {
      this.logger.info('PlanValidator configuration updated', { config: this.config });
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): PlanValidatorConfig {
    return { ...this.config };
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    healthy: boolean;
    validationHistorySize: number;
    config: PlanValidatorConfig;
  } {
    return {
      healthy: true,
      validationHistorySize: this.validationHistory.size,
      config: this.config
    };
  }
} 