/**
 * Decision node to determine the next step in the planning process
 */

import { PlanningState, SubGoal } from "./types";

/**
 * Decision node to determine the next step in the planning process
 */
export async function decisionNode(
  state: PlanningState
): Promise<string> {
  // Handle error conditions first
  if (state.error) {
    return 'handle-error';
  }
  
  // Handle special routing if it's set
  if (state.route === 'request-clarification') {
    return 'wait-for-clarification';
  }
  
  if (state.route === 'request-approval') {
    return 'wait-for-approval';
  }
  
  // New: Handle tool failure routing
  if (state.route === 'tool-failure') {
    return 'handle-tool-failure';
  }
  
  // If there is no task or the task has no sub-goals, we need to plan
  if (!state.task || !state.task.subGoals || state.task.subGoals.length === 0) {
    return 'plan-task';
  }
  
  // If the task is in planning status, we need to select a sub-goal
  if (state.task.status === 'planning') {
    return 'select-sub-goal';
  }
  
  // Check if we have a current sub-goal
  if (!state.task.currentSubGoalId) {
    return 'select-sub-goal';
  }
  
  // Check if we've completed all sub-goals
  const allCompleted = state.task.subGoals.every(
    (sg: SubGoal) => sg.status === 'complete' || sg.status === 'failed' || sg.status === 'skipped'
  );
  
  if (allCompleted) {
    return 'complete-task';
  }
  
  // Execute the current sub-goal
  return 'execute-step';
} 