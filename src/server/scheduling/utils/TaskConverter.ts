export interface NormalizedTask {
  id: string;
  name: string;
  status: string;
  priority: number;
  scheduledAt?: Date;
}

export function convertToNormalizedTask(task: { id: string; name: string; status: string; priority?: number; scheduledAt?: Date }): NormalizedTask {
  return {
    id: task.id,
    name: task.name,
    status: task.status,
    priority: task.priority ?? 0.5,
    scheduledAt: task.scheduledAt
  };
} 