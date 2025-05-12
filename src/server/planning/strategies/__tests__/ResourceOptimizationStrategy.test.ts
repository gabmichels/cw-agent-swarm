import { describe, it, expect } from 'vitest';
import { DefaultResourceOptimizationStrategy } from '../ResourceOptimizationStrategy';

describe('DefaultResourceOptimizationStrategy', () => {
  it('returns the plan unchanged', () => {
    const strategy = new DefaultResourceOptimizationStrategy();
    const plan = { foo: 'bar' };
    expect(strategy.optimize(plan)).toEqual(plan);
  });
}); 