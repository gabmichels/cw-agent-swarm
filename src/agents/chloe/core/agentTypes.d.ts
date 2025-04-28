import { ChloeMemory } from '../memory';
import { TaskLogger } from '../task-logger';
import { ChatOpenAI } from '@langchain/openai';
import { 
  PlanAndExecuteOptions, 
  PlanAndExecuteResult 
} from '../../../lib/shared/types/agentTypes';

/**
 * Type declarations for ChloeAgent class to ensure type safety
 */
export interface ChloeAgent {
  /**
   * Get the Chloe memory instance
   */
  getChloeMemory(): ChloeMemory | null;

  /**
   * Get the model instance
   */
  getModel(): ChatOpenAI | null;

  /**
   * Get the task logger instance
   */
  getTaskLogger(): TaskLogger | null;
  
  /**
   * Plan and execute a task with the given goal and options
   */
  planAndExecute(goal: string, options?: PlanAndExecuteOptions): Promise<PlanAndExecuteResult>;
} 