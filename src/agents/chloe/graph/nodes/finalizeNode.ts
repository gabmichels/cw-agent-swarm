/**
 * Node for finalizing the planning state
 */

import { ChatPromptTemplate } from "@langchain/core/prompts";
import { NodeContext, PlanningState, SubGoal, ExecutionTraceEntry } from "./types";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { TaskLogger } from "../../task-logger";
import { PlanningTask } from "./types";
import { ImportanceLevel, MemorySource } from "../../../../constants/memory";
import { MemoryType } from '../../../../server/memory/config/types';

/**
 * Helper function to count sub-goals by status in a hierarchical structure
 */
function countHierarchicalGoals(subGoals: SubGoal[]): { completed: number; failed: number; total: number } {
  let completed = 0;
  let failed = 0;
  let total = 0;
  
  for (const sg of subGoals) {
    total++;
    
    if (sg.status === 'complete') {
      completed++;
    } else if (sg.status === 'failed') {
      failed++;
    }
    
    // Count nested sub-goals
    if (sg.children && sg.children.length > 0) {
      const childCounts = countHierarchicalGoals(sg.children);
      completed += childCounts.completed;
      failed += childCounts.failed;
      total += childCounts.total;
    }
  }
  
  return { completed, failed, total };
}

/**
 * Helper function to format sub-goals for summary, including hierarchy
 */
function formatHierarchicalSubGoals(subGoals: SubGoal[], indent: string = ""): string {
  return subGoals.map(sg => {
    let output = `${indent}- ${sg.description}: ${sg.status.toUpperCase()}`;
    if (sg.result) {
      output += `\n${indent}  Result: ${sg.result}`;
    }
    
    // Format children if they exist
    if (sg.children && sg.children.length > 0) {
      output += `\n${indent}  Sub-tasks:\n${formatHierarchicalSubGoals(sg.children, indent + "    ")}`;
    }
    
    return output;
  }).join("\n");
}

/**
 * Finalizes the planning state, generating a summary of the completed task
 * 
 * @param state - The current planning state
 * @param context - The node execution context
 * @returns Updated planning state with final result
 */
export async function finalizeNode(
  state: PlanningState,
  context: NodeContext
): Promise<PlanningState> {
  const { model, memory, taskLogger } = context;
  const startTime = new Date();

  try {
    if (!state.task) {
      throw new Error("Task not found in state");
    }

    const { subGoals } = state.task;
    
    // Check if there are any incomplete sub-goals at any level of the hierarchy
    const hasIncompleteSubGoals = (goals: SubGoal[]): boolean => {
      for (const sg of goals) {
        if (sg.status !== "complete" && sg.status !== "failed") {
          return true;
        }
        if (sg.children && sg.children.length > 0 && hasIncompleteSubGoals(sg.children)) {
          return true;
        }
      }
      return false;
    };
    
    if (hasIncompleteSubGoals(subGoals)) {
      throw new Error("Cannot finalize - there are still incomplete sub-goals");
    }
    
    // Count completed vs failed sub-goals, including nested ones
    const { completed, failed, total } = countHierarchicalGoals(subGoals);
    
    taskLogger.logAction("Finalizing task", { 
      completed,
      failed,
      total
    });
    
    // Create a summary prompt that includes hierarchical information
    const summaryPrompt = ChatPromptTemplate.fromTemplate(`
You are Chloe, a sophisticated assistant who has completed a complex hierarchical task.

ORIGINAL GOAL: {goal}

COMPLETED TASK SUMMARY:
- Total Sub-goals: ${total}
- Completed Successfully: ${completed}
- Failed: ${failed}

DETAILED RESULTS:
{subGoalDetails}

Based on the above results, create a comprehensive summary that:
1. Reflects on the original goal and how well it was achieved
2. Highlights key accomplishments and insights
3. Notes any limitations or challenges encountered
4. Organizes information in a clear, structured way
5. Provides actionable next steps if appropriate

Your summary should be detailed yet concise.
`);
    
    // Format the sub-goals with hierarchy for the prompt
    const subGoalDetails = formatHierarchicalSubGoals(subGoals);
    
    // Generate the summary
    const summaryResult = await summaryPrompt.pipe(model).invoke({
      goal: state.goal,
      subGoalDetails
    });
    
    const summary = summaryResult.content;
    
    // Store the completed task in memory for future reference
    await context.memory.addMemory(
      `Completed task: ${state.goal}\n\nSummary: ${summary}`,
      MemoryType.TASK_COMPLETION,
      ImportanceLevel.HIGH,
      MemorySource.SYSTEM,
      `Task completion: ${state.goal}`,
      ['task', 'completion', 'goal_achievement']
    );
    
    // Update the task status to completed
    const updatedTask: PlanningTask = {
      ...state.task,
      status: "complete",
    };
    
    // Add the summary to messages
    const updatedMessages = [
      ...state.messages,
      new HumanMessage({ content: "Task completed. Generating final summary." }),
      new AIMessage({ content: summary })
    ];
    
    // Log success rates
    const successRate = Math.round((completed / total) * 100);
    
    // Calculate the end time and duration
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    // Create execution trace entry
    const traceEntry: ExecutionTraceEntry = {
      step: `Task finalized with ${completed}/${total} sub-goals completed (${successRate}% success rate)`,
      startTime,
      endTime,
      duration,
      status: 'success',
      details: {
        completed,
        failed,
        total,
        successRate,
        summaryLength: summary.length
      }
    };
    
    return {
      ...state,
      task: updatedTask,
      messages: updatedMessages,
      finalResult: summary,
      executionTrace: [...state.executionTrace, traceEntry],
    };
  } catch (error) {
    // Calculate the end time and duration for error case
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    const errorMessage = error instanceof Error ? error.message : `${error}`;
    taskLogger.logAction("Error finalizing task", { error: errorMessage });
    
    // Create error trace entry
    const errorTraceEntry: ExecutionTraceEntry = {
      step: `Error finalizing task: ${errorMessage}`,
      startTime,
      endTime,
      duration,
      status: 'error',
      details: {
        error: errorMessage
      }
    };
    
    return {
      ...state,
      error: `Error finalizing task: ${errorMessage}`,
      executionTrace: [...state.executionTrace, errorTraceEntry],
    };
  }
} 