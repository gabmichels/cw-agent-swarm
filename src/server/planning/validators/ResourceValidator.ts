import { PlanWithSteps } from '../../../lib/shared/types/agentTypes';

export interface ResourceValidator {
  validate(plan: PlanWithSteps): boolean;
}

export class DefaultResourceValidator implements ResourceValidator {
  validate(plan: PlanWithSteps): boolean {
    // Placeholder implementation
    return true;
  }
} 