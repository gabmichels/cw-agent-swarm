export interface SchedulerMetrics {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  throughput: number;
  avgCompletionTimeMs: number;
}

export interface SchedulerMetricsCalculator {
  calculateMetrics(tasks: Array<{ status: string; completedAt?: Date; startedAt?: Date }>): SchedulerMetrics;
}

export class SchedulerMetricsCalculatorImpl implements SchedulerMetricsCalculator {
  calculateMetrics(tasks: Array<{ status: string; completedAt?: Date; startedAt?: Date }>): SchedulerMetrics {
    const pending: number = tasks.filter((t) => t.status === 'pending').length;
    const running: number = tasks.filter((t) => t.status === 'running').length;
    const completed: number = tasks.filter((t) => t.status === 'completed').length;
    const failed: number = tasks.filter((t) => t.status === 'failed').length;
    const throughput: number = completed / (tasks.length || 1);
    const completionTimes: number[] = tasks
      .filter((t) => t.status === 'completed' && t.completedAt && t.startedAt)
      .map((t) => (t.completedAt!.getTime() - t.startedAt!.getTime()));
    const avgCompletionTimeMs: number = completionTimes.length > 0 ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length : 0;
    return { pending, running, completed, failed, throughput, avgCompletionTimeMs };
  }
} 