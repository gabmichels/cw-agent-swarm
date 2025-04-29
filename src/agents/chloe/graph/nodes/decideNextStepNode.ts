/**
 * Node for deciding the next step in the execution process
 */

import { AIMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { NodeContext, PlanningState } from "./types";

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
    
    // Find the next pending sub-goal
    const nextSubGoal = state.task.subGoals.find(sg => sg.status === 'pending');
    
    // If there are no more pending sub-goals, check if any failed
    if (!nextSubGoal) {
      const failedSubGoals = state.task.subGoals.filter(sg => sg.status === 'failed');
      
      if (failedSubGoals.length > 0) {
        taskLogger.logAction("Some sub-goals failed", { failedCount: failedSubGoals.length });
        
        return {
          ...state,
          task: {
            ...state.task,
            status: 'completed', // We still consider it completed, but with partial success
          },
          finalResult: `Task completed with ${failedSubGoals.length} failed sub-goals.`,
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
        
        const completedSubGoalText = state.task.subGoals
          .map(sg => `- ${sg.description}\n  Result: ${sg.result || "Completed"}`)
          .join("\n");
        
        const summaryResult = await summaryPrompt.pipe(model).invoke({
          goal: state.goal,
          completedSubGoals: completedSubGoalText
        });
        
        const finalSummary = summaryResult.content;
        
        return {
          ...state,
          task: {
            ...state.task,
            status: 'completed',
          },
          finalResult: finalSummary,
          messages: [...state.messages, new AIMessage({ content: finalSummary })],
          executionTrace: [...state.executionTrace, "Task completed successfully"],
        };
      }
    }
    
    // We have a pending sub-goal, update the state to execute it
    return {
      ...state,
      task: {
        ...state.task,
        status: 'executing',
        currentSubGoalId: nextSubGoal.id
      },
      executionTrace: [...state.executionTrace, `Selected sub-goal: ${nextSubGoal.description}`],
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