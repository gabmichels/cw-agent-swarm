/**
 * Node for executing a single sub-goal step in the planning process
 */

import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { NodeContext, PlanningState, SubGoal } from "./types";
import { MemoryEntry } from "../../memory";

/**
 * Executes a single sub-goal step in the planning process
 * 
 * @param state - The current planning state
 * @param context - The node execution context
 * @returns Updated planning state
 */
export async function executeStepNode(
  state: PlanningState,
  context: NodeContext
): Promise<PlanningState> {
  const { model, memory, taskLogger, tools } = context;

  try {
    if (!state.task) {
      throw new Error("Task not found in state");
    }

    const currentSubGoalId = state.task.currentSubGoalId;
    if (!currentSubGoalId) {
      throw new Error("No current sub-goal ID found in state");
    }

    const subGoal = state.task.subGoals.find(sg => sg.id === currentSubGoalId);
    if (!subGoal) {
      throw new Error(`Sub-goal with ID ${currentSubGoalId} not found`);
    }

    taskLogger.logAction("Executing sub-goal", { 
      subGoalId: subGoal.id, 
      description: subGoal.description 
    });

    // Retrieve relevant memories for this sub-goal
    let relevantContent = "";
    if (memory) {
      const memories = await memory.getRelevantMemories(subGoal.description, 3);
      if (memories.length > 0) {
        relevantContent = memories.map((m: MemoryEntry) => m.content).join("\n\n");
        taskLogger.logAction("Retrieved relevant memories", { count: memories.length });
      }
    }

    // Create the execution prompt
    const executePrompt = ChatPromptTemplate.fromTemplate(`
You are Chloe, a sophisticated marketing assistant executing a specific sub-goal as part of a larger task.

MAIN GOAL: {goal}

CURRENT SUB-GOAL: {subGoal}

{memory}

Execute this sub-goal step by step. Be thorough but concise.
If you need to use tools, explain what tool you would use and why.
{toolsPrompt}

Provide your solution to accomplish this sub-goal.
`);

    // Build the tools prompt if tools are available
    let toolsPrompt = "";
    if (tools && tools.length > 0) {
      toolsPrompt = "Available tools:\n" + tools.map((tool: { name: string; description: string }) => 
        `- ${tool.name}: ${tool.description}`
      ).join("\n");
    }

    // Generate a solution
    const executeResult = await executePrompt.pipe(model).invoke({
      goal: state.goal,
      subGoal: subGoal.description,
      memory: relevantContent ? `RELEVANT INFORMATION:\n${relevantContent}` : "",
      toolsPrompt
    });

    const solution = executeResult.content;

    // Update the sub-goal with the result
    const updatedSubGoals = state.task.subGoals.map(sg => 
      sg.id === subGoal.id 
        ? { ...sg, status: 'completed' as const, result: solution } 
        : sg
    );

    // Add the result to messages
    const updatedMessages = [
      ...state.messages,
      new HumanMessage({ content: `Sub-goal: ${subGoal.description}` }),
      new AIMessage({ content: solution })
    ];

    return {
      ...state,
      task: {
        ...state.task,
        subGoals: updatedSubGoals,
        currentSubGoalId: undefined, // Clear the current sub-goal ID
      },
      messages: updatedMessages,
      executionTrace: [...state.executionTrace, `Executed sub-goal: ${subGoal.description}`],
    };
  } catch (error) {
    taskLogger.logAction("Error executing step", { error: String(error) });
    
    // If there's a current sub-goal, mark it as failed
    let updatedSubGoals = state.task?.subGoals || [];
    
    if (state.task?.currentSubGoalId) {
      updatedSubGoals = updatedSubGoals.map(sg => 
        sg.id === state.task?.currentSubGoalId 
          ? { ...sg, status: 'failed' as const, result: `Failed: ${error}` } 
          : sg
      );
    }
    
    return {
      ...state,
      task: state.task ? {
        ...state.task,
        subGoals: updatedSubGoals,
        currentSubGoalId: undefined, // Clear the current sub-goal ID
      } : undefined,
      error: `Error executing step: ${error}`,
      executionTrace: [...state.executionTrace, `Error executing step: ${error}`],
    };
  }
} 