// Type definitions for Chloe Agent
import { ChloeMemory } from '../memory';
import { TaskLogger } from '../task-logger';

export interface ChloeAgent {
  initialize(): Promise<void>;
  getModel(): any;
  getMemory(): ChloeMemory | null;
  getTaskLogger(): TaskLogger | null;
  notify(message: string): void;
  planAndExecute(goal: string, options: any): Promise<any>;
  runDailyTasks?: () => Promise<void>;
  runWeeklyReflection?: () => Promise<string>;
  getReflectionManager?: () => any;
  getPlanningManager?: () => any;
  getKnowledgeGapsManager?: () => any;
  getToolManager?: () => any;
  getTasksWithTag?: (tag: string) => Promise<any[]>;
  queueTask?: (task: any) => Promise<any>;
  scheduleTask?: (task: any) => void;
} 