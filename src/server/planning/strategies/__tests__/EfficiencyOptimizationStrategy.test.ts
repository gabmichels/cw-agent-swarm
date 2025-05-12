import { describe, it, expect } from 'vitest';
import { DefaultEfficiencyOptimizationStrategy } from '../EfficiencyOptimizationStrategy';

describe('DefaultEfficiencyOptimizationStrategy', () => {
  it('returns the plan unchanged', () => {
    const strategy = new DefaultEfficiencyOptimizationStrategy();
    const plan = { foo: 'bar' };
    expect(strategy.optimize(plan)).toEqual(plan);
  });
}); 