import { describe, it, expect } from 'vitest';
import { DefaultPlanValidator } from '../PlanValidator';
import { PlanWithSteps } from '../../../../lib/shared/types/agentTypes';
import { TaskStatus } from '../../../../constants/task';

describe('DefaultPlanValidator', () => {
  it('returns true for a simple plan', () => {
    const validator = new DefaultPlanValidator();
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