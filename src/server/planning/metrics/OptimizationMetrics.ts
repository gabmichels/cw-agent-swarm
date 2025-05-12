import { PlanWithSteps } from '../../../lib/shared/types/agentTypes';

export interface PlanOptimizationMetrics {
  optimizationTime: number;
  stepCount: number;
  estimatedTotalTime: number;
  estimatedResourceUsage: number;
  reliabilityScore: number;
}

export interface OptimizationMetricsCalculator {
  calculateOptimizationMetrics(
    originalPlan: PlanWithSteps,
    optimizedPlan: PlanWithSteps,
    optimizationType: 'TIME' | 'RESOURCE' | 'RELIABILITY' | 'EFFICIENCY'
  ): PlanOptimizationMetrics;
}

export class OptimizationMetricsCalculatorImpl implements OptimizationMetricsCalculator {
  constructor(
    private readonly totalTimeCalculator: (plan: PlanWithSteps) => number,
    private readonly resourceUsageCalculator: (plan: PlanWithSteps) => number,
    private readonly reliabilityScoreCalculator: (plan: PlanWithSteps) => number
  ) {}

  public calculateOptimizationMetrics(
    originalPlan: PlanWithSteps,
    optimizedPlan: PlanWithSteps,
    optimizationType: 'TIME' | 'RESOURCE' | 'RELIABILITY' | 'EFFICIENCY'
  ): PlanOptimizationMetrics {
    return {
      optimizationTime: Date.now(),
      stepCount: optimizedPlan.steps.length,
      estimatedTotalTime: this.totalTimeCalculator(optimizedPlan),
      estimatedResourceUsage: this.resourceUsageCalculator(optimizedPlan),
      reliabilityScore: this.reliabilityScoreCalculator(optimizedPlan)
    };
  }
} 