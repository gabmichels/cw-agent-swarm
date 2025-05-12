import { describe, it, expect } from 'vitest';
import { DefaultTimeOptimizationStrategy } from '../TimeOptimizationStrategy';

describe('DefaultTimeOptimizationStrategy', () => {
  it('returns the plan unchanged', () => {
    const strategy = new DefaultTimeOptimizationStrategy();
    const plan = { foo: 'bar' };
    expect(strategy.optimize(plan)).toEqual(plan);
  });
}); 