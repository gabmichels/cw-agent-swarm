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
   * Filter by minimum priority
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
  metadata?: Record<string, unknown>;
  
  /**
   * Limit the number of results
   */
  limit?: number;
  
  /**
   * Skip the first N results
   */
  offset?: number;
  
  /**
   * Sort results by field
   */
  sortBy?: 'priority' | 'createdAt' | 'scheduledTime' | 'lastExecutedAt';
  
  /**
   * Sort direction
   */
  sortDirection?: 'asc' | 'desc';
} 