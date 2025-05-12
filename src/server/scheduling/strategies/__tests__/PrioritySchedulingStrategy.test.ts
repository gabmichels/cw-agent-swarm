import { describe, it, expect } from 'vitest';
import { PrioritySchedulingStrategy } from '../PrioritySchedulingStrategy';

describe('PrioritySchedulingStrategy', () => {
  it('selects the highest priority pending task', () => {
    const strategy = new PrioritySchedulingStrategy();
    const tasks = [
      { id: '1', status: 'pending', priority: 0.2 },
      { id: '2', status: 'pending', priority: 0.9 },
      { id: '3', status: 'pending', priority: 0.5 }
    ];
    expect(strategy.selectNextTask(tasks)).toBe('2');
  });
}); 