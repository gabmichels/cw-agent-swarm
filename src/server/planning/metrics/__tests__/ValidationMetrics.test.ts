import { describe, it, expect } from 'vitest';
import { ValidationMetricsCalculatorImpl } from '../ValidationMetrics';
import { PlanWithSteps } from '../../../../lib/shared/types/agentTypes';
import { TaskStatus } from '../../../../constants/task';

describe('ValidationMetricsCalculatorImpl', () => {
  it('returns valid for a plan with steps', () => {
    const calculator = new ValidationMetricsCalculatorImpl();
    const plan: PlanWithSteps = {
      goal: 'test',
      steps: [
        { id: '1', description: '', status: TaskStatus.PENDING, params: {} }
      ],
      reasoning: ''
    };
    const metrics = calculator.calculateValidationMetrics(plan);
    expect(metrics.isValid).toBe(true);
    expect(metrics.issues).toEqual([]);
  });
}); 