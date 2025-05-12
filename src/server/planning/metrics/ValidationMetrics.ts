import { PlanWithSteps } from '../../../lib/shared/types/agentTypes';

export interface PlanValidationMetrics {
  isValid: boolean;
  issues: string[];
}

export interface ValidationMetricsCalculator {
  calculateValidationMetrics(plan: PlanWithSteps): PlanValidationMetrics;
}

export class ValidationMetricsCalculatorImpl implements ValidationMetricsCalculator {
  public calculateValidationMetrics(plan: PlanWithSteps): PlanValidationMetrics {
    // Placeholder logic: always valid, no issues
    return {
      isValid: true,
      issues: []
    };
  }
} 