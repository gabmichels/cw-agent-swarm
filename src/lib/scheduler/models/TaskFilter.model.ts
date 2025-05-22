/**
 * TaskFilter.model.ts - Task Filter Model
 * 
 * This file defines the filter model for querying tasks.
 */

import { TaskStatus, TaskScheduleType } from './Task.model';

/**
 * Filter criteria for querying tasks
 */
export interface TaskFilter {
  /**
   * Filter by task IDs
   */
  ids?: string[];
  
  /**
   * Filter by task name
   */
  name?: string;
  
  /**
   * Filter by task name containing substring
   */
  nameContains?: string;
  
  /**
   * Filter by task status
   */
  status?: TaskStatus | TaskStatus[];
  
  /**
   * Filter by schedule type
   */
  scheduleType?: TaskScheduleType | TaskScheduleType[];
  
  /**
   * Filter by priority level
   */
  priority?: number;
  
  /**
   * Filter by minimum priority level
   */
  minPriority?: number;
  
  /**
   * Filter by maximum priority
   */
  maxPriority?: number;
  
  /**
   * Filter by tags (all specified tags must be present)
   */
  tags?: string[];
  
  /**
   * Filter by any of the specified tags (at least one must be present)
   */
  anyTags?: string[];
  
  /**
   * Filter by creation date range
   */
  createdBetween?: {
    start: Date;
    end: Date;
  };
  
  /**
   * Filter by scheduled date range
   */
  scheduledBetween?: {
    start: Date;
    end: Date;
  };
  
  /**
   * Filter by last execution date range
   */
  lastExecutedBetween?: {
    start: Date;
    end: Date;
  };
  
  /**
   * Filter tasks that are overdue (scheduled time is in the past)
   */
  isOverdue?: boolean;
  
  /**
   * Filter tasks that are due now (scheduled time <= current time)
   */
  isDueNow?: boolean;
  
  /**
   * Filter by custom metadata field values
   */
  metadata?: {
    /**
     * Filter by agent ID in metadata
     */
    agentId?: {
      /**
       * The agent ID to filter by
       */
      id?: string;
      
      /**
       * The agent namespace to filter by
       */
      namespace?: string;
      
      /**
       * The agent type to filter by
       */
      type?: string;
    };
    
    /**
     * Filter by any other metadata fields
     */
    [key: string]: unknown;
  };
  
  /**
   * Filter by tasks created after a specific time
   */
  createdAfter?: Date;
  
  /**
   * Filter by tasks created before a specific time
   */
  createdBefore?: Date;
  
  /**
   * Filter by tasks scheduled after a specific time
   */
  scheduledAfter?: Date;
  
  /**
   * Filter by tasks scheduled before a specific time
   */
  scheduledBefore?: Date;
  
  /**
   * Limit the number of results
   */
  limit?: number;
  
  /**
   * Skip the first N results
   */
  offset?: number;
  
  /**
   * Optional sorting criteria
   */
  sortBy?: string;
  
  /**
   * Sort direction
   */
  sortDirection?: 'asc' | 'desc';
} 