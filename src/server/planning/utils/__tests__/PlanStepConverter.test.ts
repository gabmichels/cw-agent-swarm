import { describe, it, expect } from 'vitest';
import { convertToNormalizedStep } from '../PlanStepConverter';
import { PlanStep } from '../../../../lib/shared/types/agentTypes';
import { TaskStatus } from '../../../../constants/task';

describe('convertToNormalizedStep', () => {
  it('returns normalized step', () => {
    const step: PlanStep = {
      id: '1',
      description: 'desc',
      status: TaskStatus.PENDING,
      params: { foo: 'bar' }
    };
    const normalized = convertToNormalizedStep(step);
    expect(normalized.id).toBe('1');
    expect(normalized.type).toBe('unknown');
    expect(normalized.params).toEqual({ foo: 'bar' });
  });
}); 