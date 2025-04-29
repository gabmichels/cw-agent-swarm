/**
 * Node for deciding the next step in the execution process
 */

import { AIMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { NodeContext, PlanningState, SubGoal } from "./types";

/**
 * Decides the next step in the execution process
 * 
 * @param state - The current planning state
 * @param context - The node execution context
 * @returns Updated planning state
 */
export async function decideNextStepNode(
  state: PlanningState,
  context: NodeContext
): Promise<PlanningState> {
  const { model, taskLogger } = context;

  try {
    if (!state.task) {
      throw new Error("Task not found in state");
    }
    
    taskLogger.logAction("Deciding next step", { 
      currentStatus: state.task.status,
      subGoalCount: state.task.subGoals.length
    });
    
    // If there's an error, mark as failed
    if (state.error) {
      return {
        ...state,
        task: {
          ...state.task,
          status: 'failed'
        },
        executionTrace: [...state.executionTrace, "Execution failed due to error"],
      };
    }
    
    // Helper function to find the next available sub-goal in hierarchical structure
    const findNextPendingSubGoal = (subGoals: SubGoal[]): SubGoal | undefined => {
      // First, search for a pending sub-goal at the current level
      const pendingSubGoal = subGoals.find(sg => sg.status === 'pending');
      if (pendingSubGoal) return pendingSubGoal;
      
      // If no pending sub-goals at this level, check if there are any in-progress ones with pending children
      for (const subGoal of subGoals) {
        if (subGoal.status === 'in_progress' && subGoal.children && subGoal.children.length > 0) {
          const pendingChild = findNextPendingSubGoal(subGoal.children);
          if (pendingChild) return pendingChild;
        }
      }
      
      // No pending sub-goals found in this branch
      return undefined;
    };
    
    // Find the next pending sub-goal
    const nextSubGoal = findNextPendingSubGoal(state.task.subGoals);
    
    // Mark parent goals as in_progress if we're executing a child goal
    const markParentAsInProgress = (subGoals: SubGoal[], parentId: string): SubGoal[] => {
      return subGoals.map(sg => {
        if (sg.id === parentId) {
          // Mark this parent as in_progress
          const updatedSubGoal = { ...sg, status: 'in_progress' as const };
          
          // If this parent has a parent too, recursively mark that parent as in_progress
          if (sg.parentId) {
            return {
              ...updatedSubGoal,
              children: sg.children ? markParentAsInProgress(sg.children, sg.parentId) : undefined
            };
          }
          
          return updatedSubGoal;
        }
        
        // If this sub-goal has children, check them too
        if (sg.children && sg.children.length > 0) {
          return {
            ...sg,
            children: markParentAsInProgress(sg.children, parentId)
          };
        }
        
        // Otherwise, return the sub-goal unchanged
        return sg;
      });
    };
    
    // If there are no more pending sub-goals, check if any failed
    if (!nextSubGoal) {
      const hasFailed = hasFailedSubGoals(state.task.subGoals);
      
      if (hasFailed) {
        taskLogger.logAction("Some sub-goals failed", { 
          failedCount: countFailedSubGoals(state.task.subGoals)
        });
        
        return {
          ...state,
          task: {
            ...state.task,
            status: 'completed', // We still consider it completed, but with partial success
          },
          finalResult: `Task completed with ${countFailedSubGoals(state.task.subGoals)} failed sub-goals.`,
          executionTrace: [...state.executionTrace, "Task completed with some failed sub-goals"],
        };
      } else {
        // All sub-goals completed successfully
        taskLogger.logAction("All sub-goals completed successfully");
        
        // Generate a final summary
        const summaryPrompt = ChatPromptTemplate.fromTemplate(`
You are Chloe, a sophisticated marketing assistant. You've completed a complex task with multiple sub-goals.

ORIGINAL GOAL: {goal}

COMPLETED SUB-GOALS:
{completedSubGoals}

Based on the completed sub-goals, provide a comprehensive summary of the results.
`);
        
        // Helper function to format completed sub-goals with hierarchical structure
        const formatCompletedSubGoalsHierarchy = (subGoals: SubGoal[], indent: string = ""): string => {
          return subGoals.map(sg => {
            let output = `${indent}- ${sg.description}\n  ${indent}Result: ${sg.result || "Completed"}`;
            if (sg.children && sg.children.length > 0) {
              output += "\n" + formatCompletedSubGoalsHierarchy(sg.children, indent + "  ");
            }
            return output;
          }).join("\n");
        };
        
        const completedSubGoalText = formatCompletedSubGoalsHierarchy(state.task.subGoals);
        
        const summaryResult = await summaryPrompt.pipe(model).invoke({
          goal: state.goal,
          completedSubGoals: completedSubGoalText
        });
        
        const finalSummary = summaryResult.content;
        
        taskLogger.logAction("Generated final summary");
        
        return {
          ...state,
          task: {
            ...state.task,
            status: 'completed'
          },
          finalResult: finalSummary,
          route: 'finalize',
          executionTrace: [...state.executionTrace, "Task completed successfully, generating final summary"],
        };
      }
    }
    
    // Decide whether to execute the next sub-goal or reflect on progress
    
    // Count completed sub-goals (including nested ones)
    const completedCount = countCompletedSubGoals(state.task.subGoals);
    const totalCount = countTotalSubGoals(state.task.subGoals);
    
    // Determine if we should reflect after completing some sub-goals (every 25%)
    const shouldReflect = completedCount > 0 && 
                         completedCount % Math.max(1, Math.ceil(totalCount * 0.25)) === 0 &&
                         nextSubGoal.depth === 0; // Only reflect after completing top-level goals
    
    if (shouldReflect) {
      taskLogger.logAction("Deciding to reflect on progress", { 
        completed: completedCount, 
        total: totalCount
      });
      
      return {
        ...state,
        route: 'reflect',
        executionTrace: [...state.executionTrace, "Deciding to reflect on progress"],
      };
    }
    
    // Otherwise, execute the next sub-goal
    // If the next sub-goal has a parent, update the parent's status to in_progress
    let updatedSubGoals = state.task.subGoals;
    if (nextSubGoal.parentId) {
      updatedSubGoals = markParentAsInProgress(state.task.subGoals, nextSubGoal.parentId);
    }
    
    const subGoalPath = getSubGoalPath(nextSubGoal);
    taskLogger.logAction("Deciding to execute next sub-goal", { 
      subGoalId: nextSubGoal.id,
      description: nextSubGoal.description,
      path: subGoalPath
    });
    
    return {
      ...state,
      task: {
        ...state.task,
        subGoals: updatedSubGoals,
        currentSubGoalId: nextSubGoal.id,
        status: 'executing'
      },
      route: 'execute',
      executionTrace: [...state.executionTrace, `Selected sub-goal: ${subGoalPath}`],
    };
  } catch (error) {
    taskLogger.logAction("Error deciding next step", { error: String(error) });
    return {
      ...state,
      error: `Error deciding next step: ${error}`,
      executionTrace: [...state.executionTrace, `Error deciding next step: ${error}`],
    };
  }
}

/**
 * Recursively check if there are any failed sub-goals
 */
function hasFailedSubGoals(subGoals: SubGoal[]): boolean {
  for (const sg of subGoals) {
    if (sg.status === 'failed') return true;
    if (sg.children && sg.children.length > 0 && hasFailedSubGoals(sg.children)) return true;
  }
  return false;
}

/**
 * Count the total number of failed sub-goals
 */
function countFailedSubGoals(subGoals: SubGoal[]): number {
  let count = 0;
  for (const sg of subGoals) {
    if (sg.status === 'failed') count++;
    if (sg.children && sg.children.length > 0) {
      count += countFailedSubGoals(sg.children);
    }
  }
  return count;
}

/**
 * Count the total number of completed sub-goals
 */
function countCompletedSubGoals(subGoals: SubGoal[]): number {
  let count = 0;
  for (const sg of subGoals) {
    if (sg.status === 'completed') count++;
    if (sg.children && sg.children.length > 0) {
      count += countCompletedSubGoals(sg.children);
    }
  }
  return count;
}

/**
 * Count the total number of sub-goals (including nested ones)
 */
function countTotalSubGoals(subGoals: SubGoal[]): number {
  let count = subGoals.length;
  for (const sg of subGoals) {
    if (sg.children && sg.children.length > 0) {
      count += countTotalSubGoals(sg.children);
    }
  }
  return count;
}

/**
 * Get the hierarchical path of a sub-goal for display
 */
function getSubGoalPath(subGoal: SubGoal): string {
  if (!subGoal.parentId || !subGoal.depth) {
    return subGoal.description;
  }
  return `${subGoal.description} (level ${subGoal.depth})`;
} 