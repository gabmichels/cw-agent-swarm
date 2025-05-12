import { PlanStep } from '../../../lib/shared/types/agentTypes';

export interface NormalizedPlanStep {
  id: string;
  type: string;
  params: Record<string, unknown>;
}

export function convertToNormalizedStep(step: PlanStep): NormalizedPlanStep {
  return {
    id: step.id,
    type: 'unknown',
    params: step.params ?? {}
  };
} 