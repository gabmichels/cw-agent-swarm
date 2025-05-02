/**
 * Integration module for task outcome analysis
 * This provides a way to hook the TaskOutcomeAnalyzer into the execution system
 * without extensive modifications to the core code
 */

import { PlannedTask } from '../human-collaboration';
import { SubGoal, ExecutionTraceEntry } from '../graph/nodes/types';
import { ChloeMemory } from '../memory';
import { analyzeTaskOutcome, TaskOutcomeAnalysis } from './taskOutcomeAnalyzer';
import { extractLessons, getRelevantLessons } from './lessonExtractor';

/**
 * Extended task type with outcome fields for internal use
 */
export interface TaskWithOutcome extends PlannedTask {
  outcomeScore?: number;
  outcomeStatus?: string;
  outcomePatterns?: string[];
}

/**
 * Function to analyze a task after execution
 * This can be called from any point in the system where a task is completed
 * 
 * @param task The task that was executed
 * @param executionTrace The trace of the execution steps
 * @param memory The memory system for storing analysis results
 * @returns Promise<TaskOutcomeAnalysis> The analysis results
 */
export async function analyzeCompletedTask(
  task: PlannedTask,
  executionTrace: ExecutionTraceEntry[],
  memory: ChloeMemory
): Promise<TaskOutcomeAnalysis> {
  try {
    // Use the TaskOutcomeAnalyzer to analyze the task
    const outcome = await analyzeTaskOutcome(task, executionTrace, memory);
    
    // Store the outcome in the task object for future reference
    const taskWithOutcome = task as TaskWithOutcome;
    taskWithOutcome.outcomeScore = outcome.score;
    taskWithOutcome.outcomeStatus = outcome.status;
    taskWithOutcome.outcomePatterns = outcome.patterns;
    
    // Log the analysis
    console.log(`Task '${task.goal}' completed with outcome: ${outcome.status}, score: ${outcome.score}/100`);
    
    return outcome;
  } catch (error) {
    console.error('Error analyzing completed task:', error);
    throw error;
  }
}

/**
 * Check if a task is complete based on its sub-goals
 * 
 * @param task The task to check
 * @returns boolean True if the task is complete
 */
export function isTaskComplete(task: PlannedTask): boolean {
  if (!task.subGoals || task.subGoals.length === 0) {
    return task.status === 'complete';
  }
  
  // Check if all required top-level subgoals are complete
  return task.subGoals.every(sg => 
    sg.status === 'complete' || sg.status === 'failed' || sg.status === 'skipped'
  );
}

/**
 * Process a task after it has been fully executed
 * This consolidates outcome analysis and lesson extraction
 * 
 * @param task The executed task
 * @param executionTrace The execution trace
 * @param memory The memory system
 * @returns Promise<void>
 */
export async function processCompletedTask(
  task: PlannedTask,
  executionTrace: ExecutionTraceEntry[],
  memory: ChloeMemory
): Promise<void> {
  try {
    // Only proceed if the task is actually complete
    if (!isTaskComplete(task)) {
      return;
    }
    
    // Step 1: Analyze the task outcome
    await analyzeCompletedTask(task, executionTrace, memory);
    
    // Step 2: Periodically extract lessons from past outcomes
    // Only do this occasionally to avoid excessive processing
    const shouldExtractLessons = Math.random() < 0.2; // 20% chance
    if (shouldExtractLessons) {
      const lessons = await extractLessons(memory);
      console.log(`Extracted ${lessons.length} lessons from past outcomes`);
    }
  } catch (error) {
    console.error('Error processing completed task:', error);
    // Don't throw the error to avoid disrupting the main execution flow
  }
}

/**
 * Get relevant lessons for a new task
 * This can be called during planning to help improve task execution
 * 
 * @param taskDescription Description of the task
 * @param taskType Optional task type
 * @param memory Memory system
 * @param contextTags Optional tags to prioritize memory matches
 * @returns Promise<string[]> Array of relevant lessons
 */
export async function getLessonsForTask(
  taskDescription: string,
  taskType: string | undefined,
  memory: ChloeMemory,
  contextTags?: string[]
): Promise<string[]> {
  try {
    return await getRelevantLessons(taskDescription, taskType, memory, 3, contextTags);
  } catch (error) {
    console.error('Error retrieving lessons for task:', error);
    return [];
  }
} 