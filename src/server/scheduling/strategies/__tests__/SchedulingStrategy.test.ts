import { describe, it, expect } from 'vitest';
import { FifoSchedulingStrategy } from '../SchedulingStrategy';

describe('FifoSchedulingStrategy', () => {
  it('selects the first pending task', () => {
    const strategy = new FifoSchedulingStrategy();
    const tasks = [
      { id: '1', status: 'completed' },
      { id: '2', status: 'pending' },
      { id: '3', status: 'pending' }
    ];
    expect(strategy.selectNextTask(tasks)).toBe('2');
  });
}); 