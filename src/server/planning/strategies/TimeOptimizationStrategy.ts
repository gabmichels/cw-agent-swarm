export interface TimeOptimizationStrategy {
  optimize(plan: unknown): unknown;
}

export class DefaultTimeOptimizationStrategy implements TimeOptimizationStrategy {
  optimize(plan: unknown): unknown {
    // Placeholder implementation
    return plan;
  }
} 