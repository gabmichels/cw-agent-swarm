import { describe, it, expect } from 'vitest';
import { convertToNormalizedTask } from '../TaskConverter';

describe('convertToNormalizedTask', () => {
  it('normalizes a task with default priority', () => {
    const normalized = convertToNormalizedTask({ id: '1', name: 'Test', status: 'pending' });
    expect(normalized.id).toBe('1');
    expect(normalized.name).toBe('Test');
    expect(normalized.status).toBe('pending');
    expect(normalized.priority).toBe(0.5);
    expect(normalized.scheduledAt).toBeUndefined();
  });
  it('normalizes a task with custom priority and scheduledAt', () => {
    const date = new Date();
    const normalized = convertToNormalizedTask({ id: '2', name: 'Test2', status: 'pending', priority: 0.8, scheduledAt: date });
    expect(normalized.priority).toBe(0.8);
    expect(normalized.scheduledAt).toBe(date);
  });
}); 