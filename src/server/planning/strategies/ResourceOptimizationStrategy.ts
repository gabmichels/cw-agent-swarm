export interface ResourceOptimizationStrategy {
  optimize(plan: unknown): unknown;
}

export class DefaultResourceOptimizationStrategy implements ResourceOptimizationStrategy {
  optimize(plan: unknown): unknown {
    // Placeholder implementation
    return plan;
  }
} 