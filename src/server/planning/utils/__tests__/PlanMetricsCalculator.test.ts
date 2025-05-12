import { describe, it, expect } from 'vitest';
import { calculateTotalTime, calculateResourceUsage, calculateReliabilityScore } from '../PlanMetricsCalculator';
import { PlanWithSteps } from '../../../../lib/shared/types/agentTypes';
import { TaskStatus } from '../../../../constants/task';

describe('PlanMetricsCalculator', () => {
  const plan: PlanWithSteps = {
    goal: 'test',
    steps: [
      { id: '1', description: '', status: TaskStatus.PENDING, params: { estimatedTime: 100, memoryRequired: 1024 * 1024 * 1024, cpuRequired: 1, reliability: 0.9 } },
      { id: '2', description: '', status: TaskStatus.PENDING, params: { estimatedTime: 200, memoryRequired: 1024 * 1024 * 1024, cpuRequired: 1, reliability: 0.8 } }
    ],
    reasoning: ''
  };

  it('calculates total time', () => {
    expect(calculateTotalTime(plan)).toBe(300);
  });

  it('calculates resource usage', () => {
    expect(calculateResourceUsage(plan)).toBeCloseTo(2 + 2); // 2GB + 2 CPU
  });

  it('calculates reliability score', () => {
    expect(calculateReliabilityScore(plan)).toBeCloseTo(0.85);
  });
}); 