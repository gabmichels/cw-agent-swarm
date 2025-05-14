/**
 * PlanningManager.interface.ts
 * 
 * Interface for the Planning Manager, which handles planning and execution of tasks.
 */

import { BaseManager } from './BaseManager';
import { PlanAndExecuteOptions, PlanAndExecuteResult } from '../../../../lib/shared/types/agentTypes';

/**
 * Interface for the Planning Manager
 */
export interface PlanningManager extends BaseManager {
  /**
   * Plan and execute a task
   * 
   * @param goal The goal to accomplish
   * @param options Options for planning and execution
   * @returns Result of the planning and execution
   */
  planAndExecute(goal: string, options?: PlanAndExecuteOptions): Promise<PlanAndExecuteResult>;
} 