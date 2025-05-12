import { PlanWithSteps, PlanStep } from '../../../lib/shared/types/agentTypes';

export function calculateTotalTime(plan: PlanWithSteps): number {
  return plan.steps.reduce((total: number, step: PlanStep) => {
    const params = (step.params ?? {}) as { estimatedTime?: number };
    const estimatedTime = params.estimatedTime ?? 0;
    return total + estimatedTime;
  }, 0);
}

export function calculateResourceUsage(plan: PlanWithSteps): number {
  return plan.steps.reduce((total: number, step: PlanStep) => {
    if (!step.params) return total;
    const params = step.params as { memoryRequired?: number; cpuRequired?: number };
    const memory = params.memoryRequired ?? 0;
    const cpu = params.cpuRequired ?? 0;
    // Normalize memory to GB
    return total + (memory / (1024 * 1024 * 1024)) + cpu;
  }, 0);
}

export function calculateReliabilityScore(plan: PlanWithSteps): number {
  if (plan.steps.length === 0) return 0;
  return plan.steps.reduce((total: number, step: PlanStep) => {
    if (!step.params) return total + 0.8;
    const params = step.params as { reliability?: number };
    const reliability = params.reliability ?? 0.8;
    return total + reliability;
  }, 0) / plan.steps.length;
} 