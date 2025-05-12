import { describe, it, expect } from 'vitest';
import { SchedulerMetricsCalculatorImpl } from '../SchedulerMetrics';

describe('SchedulerMetricsCalculatorImpl', () => {
  it('calculates metrics correctly', () => {
    const now = new Date();
    const tasks = [
      { status: 'pending' },
      { status: 'running' },
      { status: 'completed', startedAt: new Date(now.getTime() - 1000), completedAt: now },
      { status: 'failed' }
    ];
    const calculator = new SchedulerMetricsCalculatorImpl();
    const metrics = calculator.calculateMetrics(tasks);
    expect(metrics.pending).toBe(1);
    expect(metrics.running).toBe(1);
    expect(metrics.completed).toBe(1);
    expect(metrics.failed).toBe(1);
    expect(metrics.throughput).toBeCloseTo(0.25);
    expect(metrics.avgCompletionTimeMs).toBeCloseTo(1000);
  });
}); 