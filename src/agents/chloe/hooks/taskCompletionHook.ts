/**
 * Task completion hook for Chloe
 * 
 * This module provides a way to hook into task completion events
 * without modifying core execution logic.
 */

import { PlannedTask } from '../human-collaboration';
import { ExecutionTraceEntry } from '../graph/nodes/types';
import { ChloeMemory } from '../memory';
import { processCompletedTask, isTaskComplete } from '../self-improvement/taskOutcomeIntegration';

// Track which tasks have already been processed to avoid duplicate analysis
const processedTaskIds = new Set<string>();

/**
 * Hook that should be called whenever a task might be complete
 * It will check if the task is actually complete and only then perform analysis
 * 
 * @param task The task to check and potentially process
 * @param executionTrace The execution trace for analysis
 * @param memory The memory system
 * @returns Promise<void>
 */
export async function onTaskStateChange(
  task: PlannedTask,
  executionTrace: ExecutionTraceEntry[],
  memory: ChloeMemory
): Promise<void> {
  if (!task) return;
  
  // Generate a consistent ID for tracking
  const taskId = task.id || task.params?.id || task.goal;
  if (!taskId) return;
  
  // Skip if we've already processed this task
  if (processedTaskIds.has(taskId)) return;
  
  // Check if the task is actually complete
  if (isTaskComplete(task)) {
    try {
      await processCompletedTask(task, executionTrace, memory);
      // Mark as processed
      processedTaskIds.add(taskId);
      
      // Clean up processedTaskIds occasionally to prevent memory leaks
      if (processedTaskIds.size > 100) {
        cleanupProcessedTasks();
      }
    } catch (error) {
      console.error(`Error in task completion hook for task ${taskId}:`, error);
    }
  }
}

/**
 * Clean up the processed tasks tracking set
 * Keeps the 50 most recent entries
 */
function cleanupProcessedTasks(): void {
  if (processedTaskIds.size <= 50) return;
  
  // Convert to array, slice to keep the most recent 50, and convert back to set
  const taskIdsArray = Array.from(processedTaskIds);
  const recentTaskIds = taskIdsArray.slice(taskIdsArray.length - 50);
  processedTaskIds.clear();
  recentTaskIds.forEach(id => processedTaskIds.add(id));
} 