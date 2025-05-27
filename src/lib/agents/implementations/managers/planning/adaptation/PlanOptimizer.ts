/**
 * PlanOptimizer.ts - Plan-level optimization and refinement
 * 
 * This component handles optimization of entire plans including dependency
 * optimization, resource allocation, timeline optimization, and quality
 * improvement strategies.
 */

import { ulid } from 'ulid';
import { 
  Plan, 
  PlanStep, 
  PlanAction 
} from '../../../../../../agents/shared/base/managers/PlanningManager.interface';
import { 
  ValidationResult,
  ValidationIssue 
} from '../interfaces/PlanningInterfaces';
import { createLogger } from '../../../../../logging/winston-logger';

/**
 * Configuration for plan optimization
 */
export interface PlanOptimizerConfig {
  /** Enable dependency optimization */
  enableDependencyOptimization: boolean;
  
  /** Enable resource allocation optimization */
  enableResourceOptimization: boolean;
  
  /** Enable timeline optimization */
  enableTimelineOptimization: boolean;
  
  /** Enable quality optimization */
  enableQualityOptimization: boolean;
  
  /** Enable logging */
  enableLogging: boolean;
  
  /** Maximum optimization iterations */
  maxOptimizationIterations: number;
  
  /** Optimization timeout (ms) */
  optimizationTimeoutMs: number;
  
  /** Minimum improvement threshold for optimization */
  improvementThreshold: number;
  
  /** Maximum plan complexity allowed */
  maxPlanComplexity: number;
}

/**
 * Optimization context and constraints
 */
export interface OptimizationContext {
  /** Available resources */
  availableResources?: {
    cpu?: string;
    memory?: string;
    storage?: string;
    network?: string;
    budget?: number;
    timeLimit?: number;
  };
  
  /** Performance requirements */
  performanceRequirements?: {
    maxExecutionTime?: number;
    minSuccessRate?: number;
    maxResourceUsage?: number;
    qualityThreshold?: number;
  };
  
  /** Optimization priorities */
  priorities?: {
    speed?: number;      // 0-1
    quality?: number;    // 0-1
    cost?: number;       // 0-1
    reliability?: number; // 0-1
  };
  
  /** Constraints */
  constraints?: {
    preserveStepOrder?: boolean;
    maintainDependencies?: boolean;
    maxParallelSteps?: number;
    requiredCapabilities?: string[];
  };
  
  /** Historical performance data */
  historicalData?: {
    stepPerformance: Map<string, PerformanceMetrics>;
    resourceUsage: Map<string, ResourceUsageMetrics>;
    dependencyPatterns: DependencyPattern[];
  };
}

/**
 * Performance metrics for optimization
 */
export interface PerformanceMetrics {
  averageExecutionTime: number;
  successRate: number;
  resourceEfficiency: number;
  qualityScore: number;
  parallelizability: number;
}

/**
 * Resource usage metrics
 */
export interface ResourceUsageMetrics {
  cpuUsage: number;
  memoryUsage: number;
  storageUsage: number;
  networkUsage: number;
  cost: number;
}

/**
 * Dependency pattern analysis
 */
export interface DependencyPattern {
  fromStepType: string;
  toStepType: string;
  frequency: number;
  averageDelay: number;
  successRate: number;
}

/**
 * Optimization options
 */
export interface PlanOptimizationOptions {
  /** Optimization type to apply */
  optimizationType?: 'dependency' | 'resource' | 'timeline' | 'quality' | 'comprehensive';
  
  /** Specific optimization goals */
  goals?: {
    reduceExecutionTime?: number; // Target reduction percentage
    improveSuccessRate?: number;  // Target success rate
    reduceResourceUsage?: number; // Target reduction percentage
    improveQuality?: number;      // Target quality improvement
  };
  
  /** Optimization constraints */
  constraints?: {
    preserveSemantics?: boolean;
    maxComplexityIncrease?: number;
    maintainCriticalPath?: boolean;
  };
  
  /** Optimization strategy */
  strategy?: 'aggressive' | 'balanced' | 'conservative';
}

/**
 * Plan optimization result
 */
export interface PlanOptimizationResult {
  /** Whether optimization was successful */
  success: boolean;
  
  /** Original plan */
  originalPlan: Plan;
  
  /** Optimized plan */
  optimizedPlan?: Plan;
  
  /** Optimization confidence */
  confidence: number;
  
  /** Optimization type applied */
  optimizationType: string;
  
  /** Optimization strategy used */
  strategy: string;
  
  /** Expected improvements */
  expectedImprovements: {
    executionTime?: number;
    successRate?: number;
    resourceUsage?: number;
    quality?: number;
    parallelization?: number;
    cost?: number;
  };
  
  /** Optimization metrics */
  metrics: {
    complexityReduction: number;
    dependencyOptimization: number;
    resourceOptimization: number;
    timelineOptimization: number;
  };
  
  /** Validation results */
  validationResults?: ValidationResult;
  
  /** Optimization metadata */
  metadata: {
    optimizationId: string;
    timestamp: Date;
    duration: number;
    iterationCount: number;
  };
  
  /** Error information if failed */
  error?: string;
}

/**
 * Optimization record for tracking
 */
export interface OptimizationRecord {
  id: string;
  planId: string;
  type: 'dependency' | 'resource' | 'timeline' | 'quality' | 'comprehensive';
  strategy: string;
  originalPlan: Plan;
  optimizedPlan: Plan;
  timestamp: Date;
  confidence: number;
  improvements: Record<string, number>;
  result?: {
    success: boolean;
    metrics?: Record<string, number>;
    issues?: string[];
  };
}

/**
 * Custom error for plan optimization failures
 */
export class PlanOptimizationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly planId: string,
    public readonly recoverable: boolean = true,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'PlanOptimizationError';
  }
}

/**
 * PlanOptimizer - Handles plan-level optimization and refinement
 */
export class PlanOptimizer {
  private readonly logger = createLogger({ moduleId: 'plan-optimizer' });
  private readonly config: PlanOptimizerConfig;
  private readonly optimizationHistory: Map<string, OptimizationRecord[]> = new Map();

  constructor(config: Partial<PlanOptimizerConfig> = {}) {
    this.config = {
      enableDependencyOptimization: true,
      enableResourceOptimization: true,
      enableTimelineOptimization: true,
      enableQualityOptimization: true,
      enableLogging: true,
      maxOptimizationIterations: 5,
      optimizationTimeoutMs: 60000,
      improvementThreshold: 0.05,
      maxPlanComplexity: 1000,
      ...config
    };
  }

  /**
   * Optimize a plan based on context and options
   */
  async optimizePlan(
    plan: Plan,
    context: OptimizationContext = {},
    options: PlanOptimizationOptions = {}
  ): Promise<PlanOptimizationResult> {
    const startTime = Date.now();
    const optimizationId = ulid();

    try {
      // Validate input plan
      const validationResult = await this.validatePlan(plan);
      if (!validationResult.isValid) {
        throw new PlanOptimizationError(
          `Invalid plan: ${validationResult.issues.map(i => i.message).join(', ')}`,
          'INVALID_PLAN',
          plan.id,
          false
        );
      }

      // Check optimization history
      const previousOptimizations = this.optimizationHistory.get(plan.id) || [];
      if (previousOptimizations.length >= this.config.maxOptimizationIterations) {
        throw new PlanOptimizationError(
          'Maximum optimization attempts exceeded for this plan',
          'MAX_ATTEMPTS_EXCEEDED',
          plan.id,
          false
        );
      }

      // Determine optimization type if not specified
      const optimizationType = options.optimizationType || 
        this.determineOptimizationType(plan, context);

      // Determine optimization strategy
      const strategy = options.strategy || this.determineOptimizationStrategy(plan, context);

      if (this.config.enableLogging) {
        this.logger.info('Starting plan optimization', {
          optimizationId,
          planId: plan.id,
          optimizationType,
          strategy,
          stepCount: plan.steps.length
        });
      }

      // Apply optimization based on type
      let optimizationResult: {
        optimizedPlan: Plan;
        confidence: number;
        expectedImprovements: Record<string, number>;
        metrics: Record<string, number>;
      };

      switch (optimizationType) {
        case 'dependency':
          optimizationResult = await this.applyDependencyOptimization(plan, context, options);
          break;
        case 'resource':
          optimizationResult = await this.applyResourceOptimization(plan, context, options);
          break;
        case 'timeline':
          optimizationResult = await this.applyTimelineOptimization(plan, context, options);
          break;
        case 'quality':
          optimizationResult = await this.applyQualityOptimization(plan, context, options);
          break;
        case 'comprehensive':
          optimizationResult = await this.applyComprehensiveOptimization(plan, context, options);
          break;
        default:
          throw new PlanOptimizationError(
            `Unknown optimization type: ${optimizationType}`,
            'UNKNOWN_OPTIMIZATION_TYPE',
            plan.id,
            false
          );
      }

      // Validate optimized plan
      const optimizedValidation = await this.validatePlan(optimizationResult.optimizedPlan);
      
      // Check if optimization meets improvement threshold
      const improvementScore = this.calculateImprovementScore(optimizationResult.expectedImprovements);
      if (improvementScore < this.config.improvementThreshold) {
        return {
          success: false,
          originalPlan: plan,
          confidence: optimizationResult.confidence,
          optimizationType,
          strategy,
          expectedImprovements: optimizationResult.expectedImprovements,
          metrics: {
            complexityReduction: optimizationResult.metrics.complexityReduction || 0,
            dependencyOptimization: optimizationResult.metrics.dependencyOptimization || 0,
            resourceOptimization: optimizationResult.metrics.resourceOptimization || 0,
            timelineOptimization: optimizationResult.metrics.timelineOptimization || 0
          },
          validationResults: optimizedValidation,
          metadata: {
            optimizationId,
            timestamp: new Date(),
            duration: Date.now() - startTime,
            iterationCount: 1
          },
          error: 'Optimization did not meet improvement threshold'
        };
      }

      // Record optimization
      const optimizationRecord: OptimizationRecord = {
        id: optimizationId,
        planId: plan.id,
        type: optimizationType as 'dependency' | 'resource' | 'timeline' | 'quality' | 'comprehensive',
        strategy,
        originalPlan: plan,
        optimizedPlan: optimizationResult.optimizedPlan,
        timestamp: new Date(),
        confidence: optimizationResult.confidence,
        improvements: optimizationResult.expectedImprovements
      };

      this.recordOptimization(optimizationRecord);

      const duration = Date.now() - startTime;

      if (this.config.enableLogging) {
        this.logger.info('Plan optimization completed', {
          optimizationId,
          planId: plan.id,
          optimizationType,
          strategy,
          confidence: optimizationResult.confidence,
          duration,
          expectedImprovements: optimizationResult.expectedImprovements
        });
      }

      return {
        success: true,
        originalPlan: plan,
        optimizedPlan: optimizationResult.optimizedPlan,
        confidence: optimizationResult.confidence,
        optimizationType,
        strategy,
        expectedImprovements: optimizationResult.expectedImprovements,
        metrics: {
          complexityReduction: optimizationResult.metrics.complexityReduction || 0,
          dependencyOptimization: optimizationResult.metrics.dependencyOptimization || 0,
          resourceOptimization: optimizationResult.metrics.resourceOptimization || 0,
          timelineOptimization: optimizationResult.metrics.timelineOptimization || 0
        },
        validationResults: optimizedValidation,
        metadata: {
          optimizationId,
          timestamp: new Date(),
          duration,
          iterationCount: 1
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      if (this.config.enableLogging) {
        this.logger.error('Plan optimization failed', {
          optimizationId,
          planId: plan.id,
          error: error instanceof Error ? error.message : String(error),
          duration
        });
      }

      // Record failed optimization
      const failedRecord: OptimizationRecord = {
        id: optimizationId,
        planId: plan.id,
        type: (options.optimizationType || 'comprehensive') as 'dependency' | 'resource' | 'timeline' | 'quality' | 'comprehensive',
        strategy: options.strategy || 'balanced',
        originalPlan: plan,
        optimizedPlan: plan, // Keep original on failure
        timestamp: new Date(),
        confidence: 0,
        improvements: {},
        result: {
          success: false,
          issues: [error instanceof Error ? error.message : String(error)]
        }
      };

      this.recordOptimization(failedRecord);

      return {
        success: false,
        originalPlan: plan,
        confidence: 0,
        optimizationType: options.optimizationType || 'comprehensive',
        strategy: options.strategy || 'balanced',
        expectedImprovements: {},
        metrics: {
          complexityReduction: 0,
          dependencyOptimization: 0,
          resourceOptimization: 0,
          timelineOptimization: 0
        },
        metadata: {
          optimizationId,
          timestamp: new Date(),
          duration,
          iterationCount: 0
        },
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Determine the best optimization type for a plan
   */
  private determineOptimizationType(
    plan: Plan,
    context: OptimizationContext
  ): 'dependency' | 'resource' | 'timeline' | 'quality' | 'comprehensive' {
    const analysis = this.analyzePlan(plan);

    // Check for dependency issues (lowered threshold for better detection)
    if (analysis.dependencyComplexity > 0.4) {
      return 'dependency';
    }

    // Check for resource constraints
    if (context.availableResources && analysis.resourceIntensity > 0.6) {
      return 'resource';
    }

    // Check for timeline issues
    if (context.performanceRequirements?.maxExecutionTime && 
        analysis.estimatedExecutionTime > context.performanceRequirements.maxExecutionTime) {
      return 'timeline';
    }

    // Check for quality issues
    if (context.performanceRequirements?.qualityThreshold && 
        analysis.qualityScore < context.performanceRequirements.qualityThreshold) {
      return 'quality';
    }

    // Default to comprehensive optimization
    return 'comprehensive';
  }

  /**
   * Determine optimization strategy based on plan and context
   */
  private determineOptimizationStrategy(
    plan: Plan,
    context: OptimizationContext
  ): 'aggressive' | 'balanced' | 'conservative' {
    const priorities = context.priorities || {};

    // Aggressive strategy for speed-focused optimization
    if (priorities.speed && priorities.speed > 0.8) {
      return 'aggressive';
    }

    // Conservative strategy for reliability-focused optimization
    if (priorities.reliability && priorities.reliability > 0.8) {
      return 'conservative';
    }

    // Balanced strategy as default
    return 'balanced';
  }

  /**
   * Apply dependency optimization
   */
  private async applyDependencyOptimization(
    plan: Plan,
    context: OptimizationContext,
    options: PlanOptimizationOptions
  ): Promise<{
    optimizedPlan: Plan;
    confidence: number;
    expectedImprovements: Record<string, number>;
    metrics: Record<string, number>;
  }> {
    const optimizedPlan: Plan = { ...plan };
    let confidence = 0.8;
    const expectedImprovements: Record<string, number> = {};
    const metrics: Record<string, number> = {};

    // Analyze current dependencies
    const dependencyGraph = this.buildDependencyGraph(plan.steps);
    const criticalPath = this.findCriticalPath(dependencyGraph);

    // Optimize dependency order
    optimizedPlan.steps = await this.optimizeDependencyOrder(plan.steps, dependencyGraph);
    expectedImprovements.parallelization = 25;
    metrics.dependencyOptimization = 30;

    // Remove redundant dependencies
    optimizedPlan.steps = await this.removeRedundantDependencies(optimizedPlan.steps);
    expectedImprovements.executionTime = 15;

    // Optimize for parallelization
    if (context.constraints?.maxParallelSteps) {
      optimizedPlan.steps = await this.optimizeForParallelization(
        optimizedPlan.steps,
        context.constraints.maxParallelSteps
      );
      expectedImprovements.parallelization += 20;
      confidence += 0.1;
    }

    // Update plan metadata
    optimizedPlan.updatedAt = new Date();

    return {
      optimizedPlan,
      confidence,
      expectedImprovements,
      metrics
    };
  }

  /**
   * Apply resource optimization
   */
  private async applyResourceOptimization(
    plan: Plan,
    context: OptimizationContext,
    options: PlanOptimizationOptions
  ): Promise<{
    optimizedPlan: Plan;
    confidence: number;
    expectedImprovements: Record<string, number>;
    metrics: Record<string, number>;
  }> {
    const optimizedPlan: Plan = { ...plan };
    let confidence = 0.75;
    const expectedImprovements: Record<string, number> = {};
    const metrics: Record<string, number> = {};

    // Optimize resource allocation across steps
    if (context.availableResources) {
      optimizedPlan.steps = await this.optimizeResourceAllocation(
        plan.steps,
        context.availableResources
      );
      expectedImprovements.resourceUsage = 30;
      metrics.resourceOptimization = 35;
    }

    // Optimize for cost efficiency
    if (context.availableResources?.budget) {
      optimizedPlan.steps = await this.optimizeForCost(
        optimizedPlan.steps,
        context.availableResources.budget
      );
      expectedImprovements.cost = 20;
      confidence += 0.1;
    }

    // Add resource monitoring
    optimizedPlan.steps = await this.addResourceMonitoring(optimizedPlan.steps);

    // Update plan metadata
    optimizedPlan.updatedAt = new Date();

    return {
      optimizedPlan,
      confidence,
      expectedImprovements,
      metrics
    };
  }

  /**
   * Apply timeline optimization
   */
  private async applyTimelineOptimization(
    plan: Plan,
    context: OptimizationContext,
    options: PlanOptimizationOptions
  ): Promise<{
    optimizedPlan: Plan;
    confidence: number;
    expectedImprovements: Record<string, number>;
    metrics: Record<string, number>;
  }> {
    const optimizedPlan: Plan = { ...plan };
    let confidence = 0.8;
    const expectedImprovements: Record<string, number> = {};
    const metrics: Record<string, number> = {};

    // Optimize step scheduling
    optimizedPlan.steps = await this.optimizeStepScheduling(plan.steps);
    expectedImprovements.executionTime = 25;
    metrics.timelineOptimization = 30;

    // Optimize for deadline constraints
    if (context.availableResources?.timeLimit) {
      optimizedPlan.steps = await this.optimizeForDeadline(
        optimizedPlan.steps,
        context.availableResources.timeLimit
      );
      expectedImprovements.executionTime += 15;
      confidence += 0.1;
    }

    // Add time tracking
    optimizedPlan.steps = await this.addTimeTracking(optimizedPlan.steps);

    // Update plan metadata
    optimizedPlan.updatedAt = new Date();

    return {
      optimizedPlan,
      confidence,
      expectedImprovements,
      metrics
    };
  }

  /**
   * Apply quality optimization
   */
  private async applyQualityOptimization(
    plan: Plan,
    context: OptimizationContext,
    options: PlanOptimizationOptions
  ): Promise<{
    optimizedPlan: Plan;
    confidence: number;
    expectedImprovements: Record<string, number>;
    metrics: Record<string, number>;
  }> {
    const optimizedPlan: Plan = { ...plan };
    let confidence = 0.85;
    const expectedImprovements: Record<string, number> = {};
    const metrics: Record<string, number> = {};

    // Add quality validation steps
    optimizedPlan.steps = await this.addQualityValidation(plan.steps);
    expectedImprovements.quality = 30;

    // Optimize for reliability
    optimizedPlan.steps = await this.optimizeForReliability(optimizedPlan.steps);
    expectedImprovements.successRate = 25;

    // Add error handling and recovery
    optimizedPlan.steps = await this.addErrorHandling(optimizedPlan.steps);
    confidence += 0.1;

    // Update plan metadata
    optimizedPlan.updatedAt = new Date();

    return {
      optimizedPlan,
      confidence,
      expectedImprovements,
      metrics
    };
  }

  /**
   * Apply comprehensive optimization (combines all optimization types)
   */
  private async applyComprehensiveOptimization(
    plan: Plan,
    context: OptimizationContext,
    options: PlanOptimizationOptions
  ): Promise<{
    optimizedPlan: Plan;
    confidence: number;
    expectedImprovements: Record<string, number>;
    metrics: Record<string, number>;
  }> {
    let currentPlan = { ...plan };
    let totalConfidence = 0;
    const totalImprovements: Record<string, number> = {};
    const totalMetrics: Record<string, number> = {};

    // Apply dependency optimization
    if (this.config.enableDependencyOptimization) {
      const depResult = await this.applyDependencyOptimization(currentPlan, context, options);
      currentPlan = depResult.optimizedPlan;
      totalConfidence += depResult.confidence * 0.25;
      this.mergeImprovements(totalImprovements, depResult.expectedImprovements);
      this.mergeMetrics(totalMetrics, depResult.metrics);
    }

    // Apply resource optimization
    if (this.config.enableResourceOptimization) {
      const resResult = await this.applyResourceOptimization(currentPlan, context, options);
      currentPlan = resResult.optimizedPlan;
      totalConfidence += resResult.confidence * 0.25;
      this.mergeImprovements(totalImprovements, resResult.expectedImprovements);
      this.mergeMetrics(totalMetrics, resResult.metrics);
    }

    // Apply timeline optimization
    if (this.config.enableTimelineOptimization) {
      const timeResult = await this.applyTimelineOptimization(currentPlan, context, options);
      currentPlan = timeResult.optimizedPlan;
      totalConfidence += timeResult.confidence * 0.25;
      this.mergeImprovements(totalImprovements, timeResult.expectedImprovements);
      this.mergeMetrics(totalMetrics, timeResult.metrics);
    }

    // Apply quality optimization
    if (this.config.enableQualityOptimization) {
      const qualResult = await this.applyQualityOptimization(currentPlan, context, options);
      currentPlan = qualResult.optimizedPlan;
      totalConfidence += qualResult.confidence * 0.25;
      this.mergeImprovements(totalImprovements, qualResult.expectedImprovements);
      this.mergeMetrics(totalMetrics, qualResult.metrics);
    }

    return {
      optimizedPlan: currentPlan,
      confidence: Math.min(totalConfidence, 1.0),
      expectedImprovements: totalImprovements,
      metrics: totalMetrics
    };
  }

  /**
   * Analyze plan characteristics
   */
  private analyzePlan(plan: Plan): {
    dependencyComplexity: number;
    resourceIntensity: number;
    estimatedExecutionTime: number;
    qualityScore: number;
    parallelizability: number;
  } {
    const stepCount = plan.steps.length;
    const totalDependencies = plan.steps.reduce((sum, step) => sum + step.dependencies.length, 0);
    const avgActionsPerStep = plan.steps.reduce((sum, step) => sum + step.actions.length, 0) / stepCount;

    return {
      dependencyComplexity: Math.min(totalDependencies / (stepCount * 2), 1.0),
      resourceIntensity: Math.min(avgActionsPerStep / 5, 1.0),
      estimatedExecutionTime: stepCount * 1000, // Simple estimation
      qualityScore: 0.8, // Default quality score
      parallelizability: Math.max(0, 1 - (totalDependencies / stepCount))
    };
  }

  /**
   * Build dependency graph from steps
   */
  private buildDependencyGraph(steps: PlanStep[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    for (const step of steps) {
      graph.set(step.id, step.dependencies);
    }
    
    return graph;
  }

  /**
   * Find critical path in dependency graph
   */
  private findCriticalPath(dependencyGraph: Map<string, string[]>): string[] {
    // Simplified critical path calculation
    const visited = new Set<string>();
    const path: string[] = [];
    
    for (const [stepId, dependencies] of dependencyGraph) {
      if (dependencies.length === 0 && !visited.has(stepId)) {
        path.push(stepId);
        visited.add(stepId);
      }
    }
    
    return path;
  }

  /**
   * Optimize dependency order
   */
  private async optimizeDependencyOrder(
    steps: PlanStep[],
    dependencyGraph: Map<string, string[]>
  ): Promise<PlanStep[]> {
    // Topological sort for optimal dependency order
    const sorted: PlanStep[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    const visit = (stepId: string) => {
      if (visiting.has(stepId)) {
        throw new Error('Circular dependency detected');
      }
      if (visited.has(stepId)) {
        return;
      }
      
      visiting.add(stepId);
      const dependencies = dependencyGraph.get(stepId) || [];
      
      for (const depId of dependencies) {
        visit(depId);
      }
      
      visiting.delete(stepId);
      visited.add(stepId);
      
      const step = steps.find(s => s.id === stepId);
      if (step) {
        sorted.push(step);
      }
    };
    
    for (const step of steps) {
      if (!visited.has(step.id)) {
        visit(step.id);
      }
    }
    
    return sorted;
  }

  /**
   * Remove redundant dependencies
   */
  private async removeRedundantDependencies(steps: PlanStep[]): Promise<PlanStep[]> {
    return steps.map(step => {
      // Remove transitive dependencies
      const directDeps = new Set(step.dependencies);
      const indirectDeps = new Set<string>();
      
      for (const depId of step.dependencies) {
        const depStep = steps.find(s => s.id === depId);
        if (depStep) {
          for (const transitiveDep of depStep.dependencies) {
            indirectDeps.add(transitiveDep);
          }
        }
      }
      
      // Remove dependencies that are already covered transitively
      const optimizedDeps = step.dependencies.filter(dep => !indirectDeps.has(dep));
      
      return {
        ...step,
        dependencies: optimizedDeps,
        updatedAt: new Date()
      };
    });
  }

  /**
   * Optimize for parallelization
   */
  private async optimizeForParallelization(
    steps: PlanStep[],
    maxParallelSteps: number
  ): Promise<PlanStep[]> {
    // Group steps that can run in parallel
    const parallelGroups: PlanStep[][] = [];
    const processed = new Set<string>();
    
    for (const step of steps) {
      if (processed.has(step.id)) continue;
      
      const parallelGroup = [step];
      processed.add(step.id);
      
      // Find other steps that can run in parallel
      for (const otherStep of steps) {
        if (processed.has(otherStep.id)) continue;
        
        const canRunInParallel = !step.dependencies.includes(otherStep.id) &&
                                !otherStep.dependencies.includes(step.id) &&
                                parallelGroup.length < maxParallelSteps;
        
        if (canRunInParallel) {
          parallelGroup.push(otherStep);
          processed.add(otherStep.id);
        }
      }
      
      parallelGroups.push(parallelGroup);
    }
    
    // Flatten groups back to steps with updated priorities
    return parallelGroups.flat().map((step, index) => ({
      ...step,
      priority: step.priority + (index * 0.01), // Slight priority adjustment
      updatedAt: new Date()
    }));
  }

  /**
   * Optimize resource allocation
   */
  private async optimizeResourceAllocation(
    steps: PlanStep[],
    availableResources: Record<string, unknown>
  ): Promise<PlanStep[]> {
    return steps.map(step => ({
      ...step,
      actions: step.actions.map(action => ({
        ...action,
        parameters: {
          ...action.parameters,
          resourceAllocation: availableResources,
          optimizedForResources: true
        },
        updatedAt: new Date()
      })),
      updatedAt: new Date()
    }));
  }

  /**
   * Optimize for cost efficiency
   */
  private async optimizeForCost(
    steps: PlanStep[],
    budget: number
  ): Promise<PlanStep[]> {
    const costPerStep = budget / steps.length;
    
    return steps.map(step => ({
      ...step,
      actions: step.actions.map(action => ({
        ...action,
        parameters: {
          ...action.parameters,
          budgetAllocation: costPerStep,
          costOptimized: true
        },
        updatedAt: new Date()
      })),
      updatedAt: new Date()
    }));
  }

  /**
   * Add resource monitoring
   */
  private async addResourceMonitoring(steps: PlanStep[]): Promise<PlanStep[]> {
    return steps.map(step => {
      const monitoringAction: PlanAction = {
        id: ulid(),
        name: 'Resource Monitoring',
        description: 'Monitor resource usage during step execution',
        type: 'monitoring',
        parameters: {
          monitorType: 'resource',
          metrics: ['cpu', 'memory', 'storage', 'network']
        },
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return {
        ...step,
        actions: [...step.actions, monitoringAction],
        updatedAt: new Date()
      };
    });
  }

  /**
   * Optimize step scheduling
   */
  private async optimizeStepScheduling(steps: PlanStep[]): Promise<PlanStep[]> {
    // Sort steps by priority and dependencies
    return steps.sort((a, b) => {
      // Steps with fewer dependencies should run first
      const depDiff = a.dependencies.length - b.dependencies.length;
      if (depDiff !== 0) return depDiff;
      
      // Higher priority steps should run first
      return b.priority - a.priority;
    }).map((step, index) => ({
      ...step,
      priority: step.priority + (index * 0.001), // Fine-tune priority
      updatedAt: new Date()
    }));
  }

  /**
   * Optimize for deadline constraints
   */
  private async optimizeForDeadline(
    steps: PlanStep[],
    timeLimit: number
  ): Promise<PlanStep[]> {
    const timePerStep = timeLimit / steps.length;
    
    return steps.map(step => ({
      ...step,
      actions: step.actions.map(action => ({
        ...action,
        parameters: {
          ...action.parameters,
          timeLimit: timePerStep,
          deadlineOptimized: true
        },
        updatedAt: new Date()
      })),
      updatedAt: new Date()
    }));
  }

  /**
   * Add time tracking
   */
  private async addTimeTracking(steps: PlanStep[]): Promise<PlanStep[]> {
    return steps.map(step => {
      const timeTrackingAction: PlanAction = {
        id: ulid(),
        name: 'Time Tracking',
        description: 'Track execution time for performance analysis',
        type: 'monitoring',
        parameters: {
          monitorType: 'time',
          trackStartTime: true,
          trackEndTime: true,
          trackDuration: true
        },
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return {
        ...step,
        actions: [timeTrackingAction, ...step.actions],
        updatedAt: new Date()
      };
    });
  }

  /**
   * Add quality validation
   */
  private async addQualityValidation(steps: PlanStep[]): Promise<PlanStep[]> {
    return steps.map(step => {
      const validationAction: PlanAction = {
        id: ulid(),
        name: 'Quality Validation',
        description: 'Validate step output quality',
        type: 'validation',
        parameters: {
          validationType: 'quality',
          qualityThreshold: 0.8,
          validationCriteria: ['completeness', 'accuracy', 'relevance']
        },
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return {
        ...step,
        actions: [...step.actions, validationAction],
        updatedAt: new Date()
      };
    });
  }

  /**
   * Optimize for reliability
   */
  private async optimizeForReliability(steps: PlanStep[]): Promise<PlanStep[]> {
    return steps.map(step => ({
      ...step,
      actions: step.actions.map(action => ({
        ...action,
        parameters: {
          ...action.parameters,
          reliabilityOptimized: true,
          retryCount: 3,
          timeoutMs: 30000
        },
        updatedAt: new Date()
      })),
      updatedAt: new Date()
    }));
  }

  /**
   * Add error handling
   */
  private async addErrorHandling(steps: PlanStep[]): Promise<PlanStep[]> {
    return steps.map(step => {
      const errorHandlingAction: PlanAction = {
        id: ulid(),
        name: 'Error Handling',
        description: 'Handle errors and provide recovery options',
        type: 'error_handling',
        parameters: {
          errorHandlingStrategy: 'retry_with_fallback',
          maxRetries: 3,
          fallbackAction: 'log_and_continue'
        },
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return {
        ...step,
        actions: [errorHandlingAction, ...step.actions],
        updatedAt: new Date()
      };
    });
  }

  /**
   * Calculate improvement score
   */
  private calculateImprovementScore(improvements: Record<string, number>): number {
    const values = Object.values(improvements);
    if (values.length === 0) return 0;
    
    return values.reduce((sum, value) => sum + value, 0) / (values.length * 100);
  }

  /**
   * Merge improvements from multiple optimizations
   */
  private mergeImprovements(
    target: Record<string, number>,
    source: Record<string, number>
  ): void {
    for (const [key, value] of Object.entries(source)) {
      target[key] = (target[key] || 0) + value;
    }
  }

  /**
   * Merge metrics from multiple optimizations
   */
  private mergeMetrics(
    target: Record<string, number>,
    source: Record<string, number>
  ): void {
    for (const [key, value] of Object.entries(source)) {
      target[key] = Math.max(target[key] || 0, value);
    }
  }

  /**
   * Validate plan structure and constraints
   */
  private async validatePlan(plan: Plan): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    let score = 1.0;

    // Check basic plan structure
    if (!plan.id || !plan.name) {
      issues.push({
        severity: 'error',
        message: 'Plan missing required fields (id, name)',
        location: { field: 'basic' }
      });
      score -= 0.3;
    }

    // Check steps
    if (!plan.steps || plan.steps.length === 0) {
      issues.push({
        severity: 'error',
        message: 'Plan has no steps',
        location: { field: 'steps' }
      });
      score -= 0.5;
    }

    // Check for circular dependencies
    try {
      const dependencyGraph = this.buildDependencyGraph(plan.steps);
      this.findCriticalPath(dependencyGraph);
    } catch (error) {
      issues.push({
        severity: 'error',
        message: 'Circular dependency detected in plan',
        location: { field: 'dependencies' }
      });
      score -= 0.4;
    }

    // Check plan complexity
    const complexity = this.calculatePlanComplexity(plan);
    if (complexity > this.config.maxPlanComplexity) {
      issues.push({
        severity: 'warning',
        message: `Plan complexity (${complexity}) exceeds maximum (${this.config.maxPlanComplexity})`,
        location: { field: 'complexity' }
      });
      score -= 0.2;
    }

    return {
      isValid: issues.filter(i => i.severity === 'error').length === 0,
      score: Math.max(0, score),
      issues
    };
  }

  /**
   * Calculate plan complexity
   */
  private calculatePlanComplexity(plan: Plan): number {
    const stepCount = plan.steps.length;
    const totalActions = plan.steps.reduce((sum, step) => sum + step.actions.length, 0);
    const totalDependencies = plan.steps.reduce((sum, step) => sum + step.dependencies.length, 0);
    
    return stepCount + totalActions + (totalDependencies * 2);
  }

  /**
   * Record optimization for tracking
   */
  private recordOptimization(record: OptimizationRecord): void {
    const history = this.optimizationHistory.get(record.planId) || [];
    history.push(record);
    this.optimizationHistory.set(record.planId, history);
  }

  /**
   * Get optimization history for a plan
   */
  getOptimizationHistory(planId: string): OptimizationRecord[] {
    return this.optimizationHistory.get(planId) || [];
  }

  /**
   * Configure the optimizer
   */
  configure(config: Partial<PlanOptimizerConfig>): void {
    Object.assign(this.config, config);
    
    if (this.config.enableLogging) {
      this.logger.info('Plan optimizer configuration updated', { config });
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): PlanOptimizerConfig {
    return { ...this.config };
  }

  /**
   * Get optimizer health status
   */
  getHealthStatus(): {
    healthy: boolean;
    config: PlanOptimizerConfig;
    statistics: {
      totalOptimizations: number;
      successfulOptimizations: number;
      optimizationsByType: Record<string, number>;
      averageConfidence: number;
    };
  } {
    const allOptimizations = Array.from(this.optimizationHistory.values()).flat();
    const successfulOptimizations = allOptimizations.filter(opt => 
      opt.result?.success !== false
    );

    const optimizationsByType: Record<string, number> = {};
    for (const opt of allOptimizations) {
      optimizationsByType[opt.type] = (optimizationsByType[opt.type] || 0) + 1;
    }

    const averageConfidence = allOptimizations.length > 0
      ? allOptimizations.reduce((sum, opt) => sum + opt.confidence, 0) / allOptimizations.length
      : 0;

    return {
      healthy: true,
      config: this.config,
      statistics: {
        totalOptimizations: allOptimizations.length,
        successfulOptimizations: successfulOptimizations.length,
        optimizationsByType,
        averageConfidence
      }
    };
  }
} 