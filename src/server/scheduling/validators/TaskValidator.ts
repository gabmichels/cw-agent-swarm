export interface TaskValidator {
  validate(task: { id: string; name: string; status: string; dependencies?: string[] }): boolean;
}

export class DefaultTaskValidator implements TaskValidator {
  validate(task: { id: string; name: string; status: string; dependencies?: string[] }): boolean {
    if (!task.id || !task.name) return false;
    if (task.dependencies && !Array.isArray(task.dependencies)) return false;
    return true;
  }
} 