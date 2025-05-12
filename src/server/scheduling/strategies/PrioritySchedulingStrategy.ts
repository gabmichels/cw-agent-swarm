import { SchedulingStrategy } from './SchedulingStrategy';

export class PrioritySchedulingStrategy implements SchedulingStrategy {
  selectNextTask(tasks: Array<{ id: string; status: string; priority?: number; scheduledAt?: Date }>): string | undefined {
    const pending = tasks.filter(t => t.status === 'pending');
    if (pending.length === 0) return undefined;
    pending.sort((a, b) => (b.priority ?? 0.5) - (a.priority ?? 0.5));
    return pending[0].id;
  }
} 