/**
 * Node for finalizing the planning state
 */

import { ChatPromptTemplate } from "@langchain/core/prompts";
import { NodeContext, PlanningState } from "./types";
import { AIMessage, HumanMessage } from "@langchain/core/messages";

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

  try {
    if (!state.task) {
      throw new Error("Task not found in state");
    }

    const { subGoals } = state.task;
    
    // Check if there are any incomplete sub-goals
    const incompleteSubGoals = subGoals.filter(sg => 
      sg.status !== "completed" && sg.status !== "failed"
    );
    
    if (incompleteSubGoals.length > 0) {
      throw new Error("Cannot finalize - there are still incomplete sub-goals");
    }
    
    // Count completed vs failed sub-goals
    const completedCount = subGoals.filter(sg => sg.status === "completed").length;
    const failedCount = subGoals.filter(sg => sg.status === "failed").length;
    
    taskLogger.logAction("Finalizing task", { 
      completed: completedCount,
      failed: failedCount,
      total: subGoals.length
    });

    // Create a summary prompt
    const summaryPrompt = ChatPromptTemplate.fromTemplate(`
You are Chloe, a sophisticated assistant who has been working on a task.

MAIN GOAL: {goal}

You have completed this task with the following sub-goals:
{completedSubGoals}

The following sub-goals failed:
{failedSubGoals}

Please provide a comprehensive summary of what was accomplished, what challenges were encountered,
and what the final outcome is. Focus on the main accomplishments rather than the process.

Your summary should be concise but thorough, highlighting the most important aspects of the completed work.
`);

    // Format completed and failed sub-goals for the prompt
    const completedText = subGoals
      .filter(sg => sg.status === "completed")
      .map(sg => `${sg.id}: ${sg.description}\nResult: ${sg.result || "No result provided"}`)
      .join("\n\n");
      
    const failedText = subGoals
      .filter(sg => sg.status === "failed")
      .map(sg => `${sg.id}: ${sg.description}\nReason: ${sg.result || "No reason provided"}`)
      .join("\n\n") || "None";

    // Generate the summary
    const summaryResult = await summaryPrompt.pipe(model).invoke({
      goal: state.goal,
      completedSubGoals: completedText || "None",
      failedSubGoals: failedText
    });

    const finalResult = summaryResult.content;
    
    // Save the final result to memory
    if (memory) {
      await memory.addMemory(
        `Task completion summary: ${finalResult}`,
        'task',
        'high',
        'system',
        state.goal,
        ['task-completion', 'summary']
      );
    }

    // Add the finalization to messages
    const updatedMessages = [
      ...state.messages,
      new HumanMessage({ content: "Please summarize the completed task." }),
      new AIMessage({ content: finalResult })
    ];

    // Update task status to completed
    const updatedTask = {
      ...state.task,
      status: 'completed' as const
    };

    return {
      ...state,
      task: updatedTask,
      messages: updatedMessages,
      finalResult,
      executionTrace: [...state.executionTrace, "Task finalized"],
    };
  } catch (error) {
    taskLogger.logAction("Error finalizing task", { error: String(error) });
    
    return {
      ...state,
      error: `Error finalizing task: ${error}`,
      executionTrace: [...state.executionTrace, `Error finalizing task: ${error}`],
    };
  }
} 