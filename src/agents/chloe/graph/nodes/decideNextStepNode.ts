/**
 * Node for deciding the next step in the execution process
 */

import { AIMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { NodeContext, PlanningState, SubGoal, ExecutionTraceEntry } from "./types";
import { PlannedTask, HumanCollaboration } from "../../human-collaboration";
import { approvalConfig } from "../../human-collaboration/approval-config";

/**
 * Helper function to find a sub-goal by ID in a hierarchical structure
 */
function findSubGoalById(subGoals: SubGoal[], id: string): SubGoal | undefined {
  // First, check if the sub-goal is at this level
  const subGoal = subGoals.find(sg => sg.id === id);
  if (subGoal) return subGoal;
  
  // If not found, recursively search in children
  for (const sg of subGoals) {
    if (sg.children && sg.children.length > 0) {
      const found = findSubGoalById(sg.children, id);
      if (found) return found;
    }
  }
  
  return undefined;
}

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
  const startTime = new Date();

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
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      const traceEntry: ExecutionTraceEntry = {
        step: "Execution failed due to error",
        startTime,
        endTime,
        duration,
        status: 'error',
        details: { error: state.error }
      };
      
      return {
        ...state,
        task: {
          ...state.task,
          status: 'failed'
        },
        executionTrace: [...state.executionTrace, traceEntry],
      };
    }
    
    // Check if task needs clarification (explicit route)
    if (state.route === 'request-clarification') {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      const traceEntry: ExecutionTraceEntry = {
        step: "Pausing execution pending human clarification",
        startTime,
        endTime,
        duration,
        status: 'info',
        details: {
          clarificationQuestions: state.task.clarificationQuestions || [],
          status: 'awaiting_clarification'
        }
      };
      
      taskLogger.logAction("Pausing for human clarification", {
        questions: state.task.clarificationQuestions,
        taskId: state.task.currentSubGoalId
      });
      
      // Return the state with 'finalize' route but special status
      // This will effectively pause execution and return control to the user
      return {
        ...state,
        route: 'finalize',
        task: {
          ...state.task,
          status: 'awaiting_clarification'
        },
        executionTrace: [...state.executionTrace, traceEntry],
        finalResult: `Task execution is paused pending human clarification. Please respond to the following questions:\n\n${
          state.task.clarificationQuestions?.map((q, i) => `${i + 1}. ${q}`).join('\n\n')
        }`
      };
    }
    
    // Check if task requires approval (explicit route)
    if (state.route === 'request-approval') {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      const task = state.task as PlannedTask;
      
      // Get more detailed information about the approval request
      let approvalReason = "This task requires approval before execution";
      let approvalRule = "Standard approval rule";
      
      // If we have metadata about the approval rule, use it
      if (task.metadata?.approvalRuleName) {
        approvalRule = task.metadata.approvalRuleName as string;
      }
      
      // Get any historical approval information for this task if available
      let approvalHistory = null;
      if (task.id && task.approvalEntryId) {
        approvalHistory = HumanCollaboration.getApprovalHistory(task.id);
      }
      
      // If we have an approval entry and history, extract the reason
      if (approvalHistory && approvalHistory.length > 0) {
        approvalReason = approvalHistory[0].reason;
      }
      
      // Construct a more informative message for the user
      const currentSubGoalId = task.currentSubGoalId;
      const subGoal = currentSubGoalId ? 
        findSubGoalById(task.subGoals, currentSubGoalId) : undefined;
      
      const subGoalDescription = subGoal ? 
        subGoal.description : "the current step";
      
      // Create a detailed approval message
      const approvalMessage = `Task execution is paused pending approval.

**Step requiring approval**: ${subGoalDescription}
**Approval rule**: ${approvalRule}
**Reason for approval**: ${approvalReason}

This task cannot be executed until approved by an authorized user. To approve, respond with your decision.`;
        
      const traceEntry: ExecutionTraceEntry = {
        step: "Pausing execution pending approval",
        startTime,
        endTime,
        duration,
        status: 'info',
        details: {
          status: 'awaiting_approval',
          blockedReason: "awaiting approval",
          approvalRule,
          approvalReason,
          approvalEntryId: task.approvalEntryId,
          subGoalId: task.currentSubGoalId,
          subGoalDescription
        }
      };
      
      taskLogger.logAction("Pausing for approval", {
        taskId: task.currentSubGoalId,
        goal: state.goal,
        approvalRule,
        approvalEntryId: task.approvalEntryId
      });
      
      // Update the task status to awaiting_approval
      return {
        ...state,
        route: 'finalize',
        task: {
          ...state.task,
          status: 'awaiting_approval'
        },
        executionTrace: [...state.executionTrace, traceEntry],
        finalResult: approvalMessage
      };
    }
    
    // Check if task is awaiting clarification (status check)
    if (state.task.status === 'awaiting_clarification') {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      const traceEntry: ExecutionTraceEntry = {
        step: "Task requires clarification before proceeding",
        startTime,
        endTime,
        duration,
        status: 'info',
        details: {
          clarificationQuestions: state.task.clarificationQuestions || []
        }
      };
      
      // If we reach this point, the task is still awaiting clarification
      return {
        ...state,
        route: 'finalize',
        executionTrace: [...state.executionTrace, traceEntry],
        finalResult: `This task requires clarification before it can be executed. Please provide the following information:\n\n${
          state.task.clarificationQuestions?.map((q, i) => `${i + 1}. ${q}`).join('\n\n')
        }`
      };
    }
    
    // Check if the task is awaiting approval (status check)
    if (state.task.status === 'awaiting_approval') {
      const task = state.task as PlannedTask;
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      // Get any historical approval information for this task if available
      let approvalHistory = null;
      let approvalMessage = "This task is awaiting approval before execution can continue.";
      
      if (task.id && task.approvalEntryId) {
        approvalHistory = HumanCollaboration.getApprovalHistory(task.id);
        
        // If we have approval history entries, provide more context
        if (approvalHistory && approvalHistory.length > 0) {
          const entry = approvalHistory[0];
          approvalMessage = `This task is awaiting approval before execution.

**Reason**: ${entry.reason}
**Requested**: ${entry.requestedAt.toLocaleString()}

Please provide your approval decision to continue.`;
        }
      }
      
      const traceEntry: ExecutionTraceEntry = {
        step: "Task awaiting approval",
        startTime,
        endTime,
        duration,
        status: 'info',
        details: {
          status: 'awaiting_approval',
          approvalEntryId: task.approvalEntryId,
          approvalHistory: approvalHistory ? approvalHistory.length : 0
        }
      };
      
      // If we reach this point, the task is still awaiting approval
      return {
        ...state,
        route: 'finalize',
        executionTrace: [...state.executionTrace, traceEntry],
        finalResult: approvalMessage
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
    
    // Count completed, failed, and pending sub-goals for status reporting
    const completed = state.task.subGoals.filter(sg => sg.status === 'complete').length;
    const failed = state.task.subGoals.filter(sg => sg.status === 'failed').length;
    const pending = state.task.subGoals.filter(sg => sg.status === 'pending').length;
    const inProgress = state.task.subGoals.filter(sg => sg.status === 'in_progress').length;
    const total = state.task.subGoals.length;
    
    // Check if all sub-goals are completed or failed
    if (pending === 0 && inProgress === 0) {
      // All sub-goals are done, decide whether to reflect or finalize
      
      // If there are any failed sub-goals, reflect on progress
      if (failed > 0) {
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();
        
        const traceEntry: ExecutionTraceEntry = {
          step: `Decided to reflect on progress (${completed}/${total} completed, ${failed}/${total} failed)`,
          startTime,
          endTime,
          duration,
          status: 'info',
          details: {
            completed,
            failed,
            pending,
            inProgress,
            total
          }
        };
        
        taskLogger.logAction("Deciding to reflect on progress", { 
          completed, 
          failed, 
          total
        });
        
        return {
          ...state,
          route: 'reflect',
          executionTrace: [...state.executionTrace, traceEntry],
        };
      } else {
        // All sub-goals are completed successfully, finalize
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();
        
        const traceEntry: ExecutionTraceEntry = {
          step: "Decided to finalize execution (all sub-goals completed)",
          startTime,
          endTime,
          duration,
          status: 'success',
          details: {
            completed,
            failed,
            pending,
            inProgress,
            total
          }
        };
        
        taskLogger.logAction("Deciding to finalize execution", { 
          completed, 
          total, 
          allCompleted: completed === total
        });
        
        return {
          ...state,
          route: 'finalize',
          executionTrace: [...state.executionTrace, traceEntry],
        };
      }
    }
    
    // If we've already executed 3 sub-goals, reflect on progress
    const executedCount = completed + failed;
    if (executedCount > 0 && executedCount % 3 === 0 && state.executionTrace.some(t => (typeof t === 'string' ? t : t.step).includes('Selected sub-goal'))) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      const traceEntry: ExecutionTraceEntry = {
        step: `Decided to reflect after executing ${executedCount} sub-goals`,
        startTime,
        endTime,
        duration,
        status: 'info',
        details: {
          executedCount,
          completed,
          failed,
          pending,
          total
        }
      };
      
      taskLogger.logAction("Deciding to reflect after executing multiple sub-goals", { 
        executedCount, 
        completed, 
        failed
      });
      
      return {
        ...state,
        route: 'reflect',
        executionTrace: [...state.executionTrace, traceEntry],
      };
    }
    
    // Find the next pending sub-goal to execute
    const nextSubGoal = findNextPendingSubGoal(state.task.subGoals);
    
    // If no pending sub-goals, reflect on progress
    if (!nextSubGoal) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      const traceEntry: ExecutionTraceEntry = {
        step: "Decided to reflect (no pending sub-goals found)",
        startTime,
        endTime,
        duration,
        status: 'info',
        details: {
          completed,
          failed,
          pending,
          inProgress,
          total
        }
      };
      
      taskLogger.logAction("No pending sub-goals found, deciding to reflect", {
        completed, 
        failed, 
        pending, 
        inProgress
      });
      
      return {
        ...state,
        route: 'reflect',
        executionTrace: [...state.executionTrace, traceEntry],
      };
    }
    
    // Get the hierarchical path of the sub-goal
    const getSubGoalPath = (subGoal: SubGoal): string => {
      if (!subGoal.parentId || !subGoal.depth) {
        return subGoal.description;
      }
      return `${subGoal.description} (level ${subGoal.depth})`;
    };
    
    const subGoalPath = getSubGoalPath(nextSubGoal);
    
    // Mark parent sub-goals as in-progress if they're not already
    const markParentInProgress = (subGoals: SubGoal[], childId: string): SubGoal[] => {
      // First check if the sub-goal is a direct child
      for (const subGoal of subGoals) {
        if (subGoal.children && subGoal.children.some(c => c.id === childId)) {
          // If this is a parent and not already in progress, mark it
          if (subGoal.status !== 'in_progress') {
            return subGoals.map(sg => 
              sg.id === subGoal.id 
                ? { ...sg, status: 'in_progress' as const } 
                : sg
            );
          }
          return subGoals;
        }
      }
      
      // If not found at this level, recursively check children
      return subGoals.map(sg => {
        if (sg.children && sg.children.length > 0) {
          return {
            ...sg,
            children: markParentInProgress(sg.children, childId)
          };
        }
        return sg;
      });
    };
    
    // Update sub-goals, potentially marking parents as in-progress
    let updatedSubGoals = state.task.subGoals;
    if (nextSubGoal.parentId) {
      updatedSubGoals = markParentInProgress(updatedSubGoals, nextSubGoal.id);
    }
    
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    const traceEntry: ExecutionTraceEntry = {
      step: `Selected sub-goal: ${subGoalPath}`,
      startTime,
      endTime,
      duration,
      status: 'success',
      details: {
        subGoalId: nextSubGoal.id,
        description: nextSubGoal.description,
        priority: nextSubGoal.priority,
        path: subGoalPath
      }
    };
    
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
      executionTrace: [...state.executionTrace, traceEntry],
    };
  } catch (error) {
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    const errorTraceEntry: ExecutionTraceEntry = {
      step: `Error deciding next step: ${error}`,
      startTime,
      endTime,
      duration,
      status: 'error',
      details: { error: String(error) }
    };
    
    taskLogger.logAction("Error deciding next step", { error: String(error) });
    
    return {
      ...state,
      error: `Error deciding next step: ${error}`,
      executionTrace: [...state.executionTrace, errorTraceEntry],
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
    if (sg.status === 'complete') count++;
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