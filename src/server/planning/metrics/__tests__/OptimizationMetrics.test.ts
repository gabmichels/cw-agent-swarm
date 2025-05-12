import { OptimizationMetricsCalculatorImpl } from '../OptimizationMetrics';
import { PlanWithSteps } from '../../../../lib/shared/types/agentTypes';
import { TaskStatus } from '../../../../constants/task';

describe('OptimizationMetricsCalculatorImpl', () => {
  const totalTime = (plan: PlanWithSteps) => plan.steps.length * 100;
  const resourceUsage = (plan: PlanWithSteps) => plan.steps.length * 2;
  const reliabilityScore = (plan: PlanWithSteps) => 0.9;
  const calculator = new OptimizationMetricsCalculatorImpl(totalTime, resourceUsage, reliabilityScore);

  it('calculates optimization metrics', () => {
    const plan: PlanWithSteps = {
      goal: 'test',
      steps: [
        { id: '1', description: '', status: TaskStatus.PENDING, params: {} },
        { id: '2', description: '', status: TaskStatus.PENDING, params: {} }
      ],
      reasoning: ''
    };
    const metrics = calculator.calculateOptimizationMetrics(plan, plan, 'TIME');
    expect(metrics.estimatedTotalTime).toBe(200);
    expect(metrics.estimatedResourceUsage).toBe(4);
    expect(metrics.reliabilityScore).toBe(0.9);
    expect(metrics.stepCount).toBe(2);
  });
}); 