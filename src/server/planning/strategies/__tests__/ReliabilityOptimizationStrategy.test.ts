import { describe, it, expect } from 'vitest';
import { DefaultReliabilityOptimizationStrategy } from '../ReliabilityOptimizationStrategy';

describe('DefaultReliabilityOptimizationStrategy', () => {
  it('returns the plan unchanged', () => {
    const strategy = new DefaultReliabilityOptimizationStrategy();
    const plan = { foo: 'bar' };
    expect(strategy.optimize(plan)).toEqual(plan);
  });
}); 