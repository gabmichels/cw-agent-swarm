export interface SchedulingStrategy {
  selectNextTask(tasks: Array<{ id: string; status: string; priority?: number; scheduledAt?: Date }>): string | undefined;
}

export class FifoSchedulingStrategy implements SchedulingStrategy {
  selectNextTask(tasks: Array<{ id: string; status: string; priority?: number; scheduledAt?: Date }>): string | undefined {
    const pending = tasks.filter(t => t.status === 'pending');
    return pending.length > 0 ? pending[0].id : undefined;
  }
} 