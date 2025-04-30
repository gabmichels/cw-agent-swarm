/**
 * Node for handling tool failures during task execution
 */

import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { NodeContext, PlanningState, SubGoal, ExecutionTraceEntry } from "./types";
import { PlannedTask } from "../../human-collaboration";
import { MemorySource, ImportanceLevel } from "../../../../constants/memory";

/**
 * Updates a sub-goal by ID in a hierarchical structure
 */
function updateSubGoalById(subGoals: SubGoal[], id: string, update: Partial<SubGoal>): SubGoal[] {
  return subGoals.map(sg => {
    // If this is the sub-goal to update, merge the update
    if (sg.id === id) {
      return { ...sg, ...update };
    }
    
    // If this sub-goal has children, recursively update them
    if (sg.children && sg.children.length > 0) {
      return {
        ...sg,
        children: updateSubGoalById(sg.children, id, update)
      };
    }
    
    // Otherwise, return the sub-goal unchanged
    return sg;
  });
}

/**
 * Handle tool failure by interacting with the user to decide next steps
 * 
 * @param state - The current planning state
 * @param context - The node execution context
 * @returns Updated planning state
 */
export async function handleToolFailureNode(
  state: PlanningState,
  context: NodeContext
): Promise<PlanningState> {
  const { model, memory, taskLogger } = context;
  const startTime = new Date();
  
  try {
    if (!state.task) {
      throw new Error("Task not found in state");
    }
    
    const task = state.task as PlannedTask;
    if (!task.failureDetails || !task.failedTool) {
      throw new Error("No tool failure details found");
    }
    
    // Log action
    taskLogger.logAction("Handling tool failure", {
      toolName: task.failedTool,
      error: task.failureDetails.error,
      subGoalId: task.failureDetails.subGoalId
    });
    
    // Get the last message to see user's response
    const lastMessage = state.messages[state.messages.length - 1];
    let userResponse = "";
    
    if (lastMessage instanceof HumanMessage) {
      userResponse = lastMessage.content.toString().toLowerCase();
    }
    
    // Find the affected sub-goal
    const subGoalId = task.failureDetails.subGoalId;
    let updatedSubGoals = [...task.subGoals];
    
    // Record the failure in memory
    if (memory) {
      await memory.addMemory(
        `Tool failure: ${task.failedTool}\nError: ${task.failureDetails.error}\nSub-goal: ${subGoalId}`,
        'tool_failure',
        ImportanceLevel.HIGH,
        MemorySource.SYSTEM,
        `Tool failure in task: ${task.goal}`,
        ['tool', 'failure', 'error', task.failedTool]
      );
    }
    
    // Analyze user response and determine action
    let responseMessage: AIMessage;
    let route: string | undefined = undefined;
    let updatedTask: PlannedTask = { ...task };
    
    // Option 1: Retry with the same tool
    if (userResponse.includes('retry') || userResponse.includes('1')) {
      // Update the sub-goal to retry
      updatedSubGoals = updateSubGoalById(
        updatedSubGoals,
        subGoalId,
        { status: 'pending' } // Reset to pending so it can be retried
      );
      
      responseMessage = new AIMessage({
        content: `I'll retry the step using the ${task.failedTool} tool. Let me make another attempt.`
      });
      
      // Set the task back to executing status so it will retry
      updatedTask = {
        ...task,
        subGoals: updatedSubGoals,
        status: 'executing',
        blockedReason: undefined, // Clear the blocked reason
        failedTool: undefined, // Clear the failed tool
        failureDetails: undefined // Clear the failure details
      };
      
      // Log the retry
      taskLogger.logAction("Retrying tool execution", {
        toolName: task.failedTool,
        subGoalId
      });
    } 
    // Option 2: Suggest an alternative approach
    else if (userResponse.includes('alternative') || userResponse.includes('2')) {
      // Generate an alternative approach using the LLM
      const alternativePrompt = `
The tool "${task.failedTool}" failed with error: "${task.failureDetails.error}" while trying to complete the sub-goal: "${task.failureDetails.subGoalId}".

Please suggest 1-2 alternative approaches to accomplish this task without using this specific tool. Consider:
1. Alternative tools that could be used
2. Manual steps that could replace the tool
3. A different way to break down the problem

Provide a clear, concise alternative plan.
`;
      
      const alternativeResult = await model.invoke(alternativePrompt);
      const alternativePlan = alternativeResult.content.toString();
      
      // Update the sub-goal with the alternative plan
      updatedSubGoals = updateSubGoalById(
        updatedSubGoals,
        subGoalId,
        { status: 'pending' } // Reset to pending so it can be executed with the new approach
      );
      
      responseMessage = new AIMessage({
        content: `I'll try an alternative approach for this step:\n\n${alternativePlan}`
      });
      
      // Set the task back to executing status with the alternative plan
      updatedTask = {
        ...task,
        subGoals: updatedSubGoals,
        status: 'executing',
        blockedReason: undefined,
        failedTool: undefined,
        failureDetails: undefined,
        metadata: {
          ...task.metadata,
          alternativePlan: {
            subGoalId,
            plan: alternativePlan,
            originalTool: task.failedTool
          }
        }
      };
      
      // Log the alternative approach
      taskLogger.logAction("Using alternative approach", {
        originalTool: task.failedTool,
        subGoalId,
        alternativePlan: alternativePlan.substring(0, 100) + "..."
      });
    } 
    // Option 3: Skip this step and continue
    else if (userResponse.includes('skip') || userResponse.includes('3')) {
      // Mark the sub-goal as skipped
      updatedSubGoals = updateSubGoalById(
        updatedSubGoals,
        subGoalId,
        { 
          status: 'skipped',
          failureReason: `Skipped due to tool failure: ${task.failedTool} - ${task.failureDetails.error}`
        }
      );
      
      responseMessage = new AIMessage({
        content: `I'll skip this step and continue with the remaining parts of the task.`
      });
      
      // Set the task back to executing status but skip this sub-goal
      updatedTask = {
        ...task,
        subGoals: updatedSubGoals,
        status: 'executing',
        blockedReason: undefined,
        failedTool: undefined,
        failureDetails: undefined,
        currentSubGoalId: undefined // Reset current sub-goal to force selection of next one
      };
      
      // Log the skip
      taskLogger.logAction("Skipping failed step", {
        toolName: task.failedTool,
        subGoalId
      });
    } 
    // Option 4: Pause the task for manual resolution
    else if (userResponse.includes('pause') || userResponse.includes('4')) {
      responseMessage = new AIMessage({
        content: `I've paused the task. You can resume it later after addressing the tool issue manually.`
      });
      
      // Update the task status to paused
      updatedTask = {
        ...task,
        status: 'paused',
        blockedReason: `Tool failure - awaiting manual resolution`,
        subGoals: updatedSubGoals
      };
      
      // Log the pause
      taskLogger.logAction("Pausing task for manual resolution", {
        toolName: task.failedTool,
        subGoalId
      });
      
      // Set route to pause
      route = 'pause-task';
    } 
    // Default: Ask for clearer instructions
    else {
      responseMessage = new AIMessage({
        content: `I didn't understand your preference for handling the tool failure. Please choose one of the options:
        
1. Retry with the same tool
2. Suggest an alternative approach
3. Skip this step and continue
4. Pause the task for manual resolution`
      });
      
      // Keep the route as tool-failure to stay in this node
      route = 'tool-failure';
    }
    
    // Calculate end time and duration
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    // Create trace entry
    const traceEntry: ExecutionTraceEntry = {
      step: `Handling tool failure for ${task.failedTool}`,
      startTime,
      endTime,
      duration,
      status: 'info',
      details: {
        toolName: task.failedTool,
        error: task.failureDetails.error,
        userResponse,
        resolution: route || 'continue'
      }
    };
    
    // Return updated state
    return {
      ...state,
      route,
      task: updatedTask,
      messages: [...state.messages, responseMessage],
      executionTrace: [...state.executionTrace, traceEntry]
    };
  } catch (error) {
    // Handle unexpected errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    taskLogger.logAction("Error handling tool failure", { error: errorMessage });
    
    // Calculate error duration
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    const errorTraceEntry: ExecutionTraceEntry = {
      step: `Error handling tool failure: ${errorMessage}`,
      startTime,
      endTime,
      duration,
      status: 'error',
      details: { error: errorMessage }
    };
    
    // Return error state
    return {
      ...state,
      error: `Error handling tool failure: ${errorMessage}`,
      executionTrace: [...state.executionTrace, errorTraceEntry],
    };
  }
} 