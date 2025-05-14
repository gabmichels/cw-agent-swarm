import { describe, it, expect } from 'vitest';
import { AdaptationMetricsCalculatorImpl } from '../AdaptationMetrics';
import { PlanWithSteps } from '../../../../lib/shared/types/agentTypes';
import { TaskStatus } from '../../../../constants/task';

describe('AdaptationMetricsCalculatorImpl', () => {
  const timeChangeCalculator = (original: PlanWithSteps, adapted: PlanWithSteps) => {
    const origTime = original.steps.reduce((sum, s) => sum + ((s.params as { estimatedTime?: number })?.estimatedTime ?? 0), 0);
    const newTime = adapted.steps.reduce((sum, s) => sum + ((s.params as { estimatedTime?: number })?.estimatedTime ?? 0), 0);
    return newTime - origTime;
  };
  const calculator = new AdaptationMetricsCalculatorImpl(timeChangeCalculator);

  it('calculates adaptation metrics with time change', () => {
    const original: PlanWithSteps = {
      goal: 'test',
      steps: [
        { id: '1', description: '', status: TaskStatus.PENDING, params: { estimatedTime: 100 } },
        { id: '2', description: '', status: TaskStatus.PENDING, params: { estimatedTime: 200 } }
      ],
      reasoning: ''
    };
    const adapted: PlanWithSteps = {
      goal: 'test',
      steps: [
        { id: '1', description: '', status: TaskStatus.PENDING, params: { estimatedTime: 150 } },
        { id: '2', description: '', status: TaskStatus.PENDING, params: { estimatedTime: 250 } }
      ],
      reasoning: ''
    };
    const metrics = calculator.calculateAdaptationMetrics(original, adapted);
    expect(metrics.estimatedTimeChange).toBe(100);
    expect(metrics.originalStepCount).toBe(2);
    expect(metrics.newStepCount).toBe(2);
    expect(metrics.confidence).toBeGreaterThan(0);
  });
}); 