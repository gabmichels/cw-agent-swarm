import { describe, it, expect } from 'vitest';
import { analyzeResourceProfile } from '../ResourceAnalyzer';
import { PlanStep } from '../../../../lib/shared/types/agentTypes';
import { TaskStatus } from '../../../../constants/task';

describe('analyzeResourceProfile', () => {
  it('returns expected resource profile', () => {
    const step: PlanStep = {
      id: '1',
      description: '',
      status: TaskStatus.PENDING,
      params: { memoryRequired: 1024 * 1024, cpuRequired: 0.5 }
    };
    const profile = analyzeResourceProfile(step);
    expect(profile.memory).toBeGreaterThan(0);
    expect(profile.cpu).toBe(0.1);
    expect(profile.io).toBe(0.05);
    expect(profile.concurrency).toBe(1);
  });
}); 