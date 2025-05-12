import { describe, it, expect } from 'vitest';
import { DefaultResourceValidator } from '../ResourceValidator';
import { PlanWithSteps } from '../../../../lib/shared/types/agentTypes';
import { TaskStatus } from '../../../../constants/task';

describe('DefaultResourceValidator', () => {
  it('returns true for a simple plan', () => {
    const validator = new DefaultResourceValidator();
    const plan: PlanWithSteps = {
      goal: 'test',
      steps: [
        { id: '1', description: '', status: TaskStatus.PENDING, params: {} }
      ],
      reasoning: ''
    };
    expect(validator.validate(plan)).toBe(true);
  });
}); 