import { PlanWithSteps } from '../../../lib/shared/types/agentTypes';

export interface DependencyValidator {
  validate(plan: PlanWithSteps): boolean;
}

export class DefaultDependencyValidator implements DependencyValidator {
  validate(plan: PlanWithSteps): boolean {
    // Placeholder implementation
    return true;
  }
} 