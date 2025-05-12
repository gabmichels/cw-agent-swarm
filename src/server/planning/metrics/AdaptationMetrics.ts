import { PlanAdaptationMetrics } from '../../../lib/shared/types/planAdaptation';
import { PlanWithSteps } from '../../../lib/shared/types/agentTypes';

// Define a local enum (or type alias) for PlanAdaptationType (for example, using a union type) so that the linter error is resolved.
export type PlanAdaptationType = 'REORDER' | 'REPLACE' | 'ADD' | 'REMOVE' | 'MERGE' | 'SPLIT' | 'OPTIMIZE' | 'RESTRUCTURE';

export interface AdaptationMetricsCalculator {
  calculateAdaptationMetrics(originalPlan: PlanWithSteps, adaptedPlan: PlanWithSteps): PlanAdaptationMetrics;
}

export class AdaptationMetricsCalculatorImpl implements AdaptationMetricsCalculator {
  constructor(private readonly timeChangeCalculator: (originalPlan: PlanWithSteps, adaptedPlan: PlanWithSteps) => number) {}

  public calculateAdaptationMetrics(originalPlan: PlanWithSteps, adaptedPlan: PlanWithSteps): PlanAdaptationMetrics {
    const timeChange = this.timeChangeCalculator(originalPlan, adaptedPlan);
    const changes = this.detectAdaptationChanges(originalPlan, adaptedPlan);
    return {
      originalStepCount: originalPlan.steps.length,
      newStepCount: adaptedPlan.steps.length,
      estimatedTimeChange: timeChange,
      confidence: this.calculateAdaptationConfidence({ changes })
    };
  }

  private detectAdaptationChanges(originalPlan: PlanWithSteps, adaptedPlan: PlanWithSteps): Array<{ type: PlanAdaptationType; description: string; affectedSteps: string[]; reason: string; }> {
    const changes: Array<{ type: PlanAdaptationType; description: string; affectedSteps: string[]; reason: string; }> = [];
    const timeChange = this.timeChangeCalculator(originalPlan, adaptedPlan);
    if (Math.abs(timeChange) > 0) {
      changes.push({
        type: 'OPTIMIZE',
        description: `Time ${timeChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(timeChange)}ms`,
        affectedSteps: adaptedPlan.steps.map(s => s.id),
        reason: timeChange > 0 ? 'Reliability improvement' : 'Performance optimization'
      });
    }
    // (Additional change detection logic (resource, reliability) omitted for brevity – can be added as needed.)
    return changes;
  }

  private calculateAdaptationConfidence(strategy: { changes: Array<{ type: PlanAdaptationType; description: string; affectedSteps: string[]; reason: string; }> }): number {
    if (strategy.changes.length === 0) return 0.5; // Default confidence for no changes
    const changeWeights = new Map<PlanAdaptationType, number>([
      ['REORDER', 0.8], ['REPLACE', 0.6], ['ADD', 0.7], ['REMOVE', 0.9], ['MERGE', 0.8], ['SPLIT', 0.7], ['OPTIMIZE', 0.9], ['RESTRUCTURE', 0.5]
    ]);
    const totalWeight = strategy.changes.reduce((sum, change) => sum + (changeWeights.get(change.type) || 0.5), 0);
    return Math.min(totalWeight / strategy.changes.length, 1);
  }
} 