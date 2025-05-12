import { PlanWithSteps } from '../../../lib/shared/types/agentTypes';

export interface PlanValidator {
  validate(plan: PlanWithSteps): boolean;
}

export class DefaultPlanValidator implements PlanValidator {
  validate(plan: PlanWithSteps): boolean {
    // Placeholder implementation
    return true;
  }
} 