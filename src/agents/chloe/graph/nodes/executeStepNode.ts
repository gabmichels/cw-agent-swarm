/**
 * Node for executing a specific sub-goal
 */

import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { NodeContext, PlanningState, SubGoal, ExecutionTraceEntry } from "./types";
import { MemoryEntry } from "../../memory";

/**
 * Helper function to get the full path to a sub-goal in the hierarchy
 */
function getSubGoalHierarchyPath(subGoal: SubGoal): string {
  if (!subGoal.parentId || !subGoal.depth) {
    return subGoal.description;
  }
  return `${subGoal.description} (nested level ${subGoal.depth})`;
}

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
 * Helper function to update a sub-goal by ID in a hierarchical structure
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
 * Executes a specific sub-goal in the planning process
 * 
 * @param state - The current planning state
 * @param context - The node execution context
 * @returns Updated planning state
 */
export async function executeStepNode(
  state: PlanningState,
  context: NodeContext
): Promise<PlanningState> {
  const { model, memory, taskLogger, tools, dryRun } = context;
  const startTime = new Date();

  try {
    if (!state.task) {
      throw new Error("Task not found in state");
    }
    
    if (!state.task.currentSubGoalId) {
      throw new Error("No current sub-goal selected for execution");
    }
    
    // Find the current sub-goal in the hierarchical structure
    const currentSubGoal = findSubGoalById(state.task.subGoals, state.task.currentSubGoalId);
    
    if (!currentSubGoal) {
      throw new Error(`Sub-goal with ID ${state.task.currentSubGoalId} not found`);
    }
    
    const subGoalPath = getSubGoalHierarchyPath(currentSubGoal);
    
    // Add dry run indicator to the log if in dry run mode
    if (dryRun) {
      taskLogger.logAction("SIMULATING sub-goal execution", { 
        subGoalId: currentSubGoal.id,
        description: currentSubGoal.description,
        path: subGoalPath,
        dryRun: true
      });
    } else {
      taskLogger.logAction("Executing sub-goal", { 
        subGoalId: currentSubGoal.id,
        description: currentSubGoal.description,
        path: subGoalPath
      });
    }
    
    // Update the sub-goal status to in progress
    let updatedSubGoals = updateSubGoalById(
      state.task.subGoals, 
      currentSubGoal.id, 
      { status: 'in_progress' }
    );
    
    // In dry run mode, simulate the execution instead of actually doing it
    let executionOutput: string;
    
    if (dryRun) {
      executionOutput = `[DRY RUN] Simulated execution of sub-goal: "${currentSubGoal.description}"\n\n` +
        `This is a simulated response for demonstration purposes. In a real execution, ` +
        `I would perform the actual steps needed to complete this sub-goal, possibly using available tools.`;
        
      taskLogger.logAction("SIMULATED execution result", {
        subGoalId: currentSubGoal.id,
        result: executionOutput.substring(0, 100) + "..."
      });
    } else {
      // Get relevant memories to provide context for execution
      const relevantMemories = await memory.getRelevantMemories(
        `${state.goal} - ${currentSubGoal.description}`, 
        3
      );
      
      const memoryContext = relevantMemories.length > 0 
        ? "Relevant information from your memory:\n" + relevantMemories.map(m => `- ${m.content}`).join("\n")
        : "No relevant memories found for this sub-goal.";
      
      // Create execution prompt
      const executionPrompt = ChatPromptTemplate.fromTemplate(`
You are Chloe, a sophisticated marketing assistant executing a specific sub-goal.

MAIN GOAL: {goal}

CURRENT SUB-GOAL: {subGoal}

HIERARCHY POSITION: {hierarchyPosition}

${memoryContext}

${tools && Object.keys(tools).length > 0 ? `
You have access to the following tools:
${Object.keys(tools).map(toolName => `- ${toolName}`).join("\n")}

You can use these tools by mentioning them explicitly in your response.
` : ""}

Focus only on executing this specific sub-goal. Consider:
1. The best approach to accomplish this sub-goal
2. Any relevant information or constraints
3. How this sub-goal contributes to the main goal

Provide a clear, detailed response that accomplishes the sub-goal.
`);
      
      // Build the hierarchy position information
      let hierarchyPosition = "This is a ";
      if (currentSubGoal.depth && currentSubGoal.depth > 0) {
        hierarchyPosition += `level ${currentSubGoal.depth} nested sub-goal`;
        if (currentSubGoal.parentId) {
          const parent = findSubGoalById(state.task.subGoals, currentSubGoal.parentId);
          if (parent) {
            hierarchyPosition += ` under "${parent.description}"`;
          }
        }
      } else {
        hierarchyPosition += "top-level sub-goal";
      }
      
      // Execute the sub-goal
      const executionResult = await executionPrompt.pipe(model).invoke({
        goal: state.goal,
        subGoal: currentSubGoal.description,
        hierarchyPosition
      });
      
      executionOutput = executionResult.content;
      
      // Add to memory (only in real execution mode)
      await memory.addMemory(
        `Completed sub-goal: ${currentSubGoal.description} - ${executionOutput.substring(0, 100)}...`,
        'task',
        'medium',
        'chloe',
        state.goal,
        ['task', 'execution', currentSubGoal.id]
      );
    }
    
    // Update the sub-goal with the result
    updatedSubGoals = updateSubGoalById(
      updatedSubGoals, 
      currentSubGoal.id, 
      { 
        status: 'completed', 
        result: executionOutput.substring(0, 500) // Limit result length for storage
      }
    );
    
    // Update the messages
    const updatedMessages = [
      ...state.messages,
      new HumanMessage({ content: `Execute sub-goal: ${subGoalPath}` }),
      new AIMessage({ content: executionOutput })
    ];
    
    // Calculate end time and duration
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    // Create execution trace entry with timing information
    const traceEntry: ExecutionTraceEntry = {
      step: `Executed sub-goal: ${subGoalPath}`,
      startTime,
      endTime,
      duration,
      status: dryRun ? 'simulated' : 'success',
      details: {
        subGoalId: currentSubGoal.id,
        description: currentSubGoal.description,
        result: executionOutput.substring(0, 100) + "...",
        isDryRun: dryRun
      }
    };
    
    // Check if all nested sub-goals of a parent are complete, and if so, mark the parent as complete
    const updateParentStatus = (subGoals: SubGoal[]): SubGoal[] => {
      return subGoals.map(sg => {
        // Skip if this isn't a parent sub-goal or it's already completed/failed
        if (!sg.children || sg.children.length === 0 || sg.status === 'completed' || sg.status === 'failed') {
          return sg;
        }
        
        // Check if all children are completed or failed
        const allChildrenDone = sg.children.every(child => 
          child.status === 'completed' || child.status === 'failed'
        );
        
        if (allChildrenDone) {
          // Check if any children failed
          const anyChildFailed = sg.children.some(child => child.status === 'failed');
          
          // If any child failed, mark the parent as failed too
          const newStatus = anyChildFailed ? 'failed' : 'completed';
          const result = anyChildFailed 
            ? `Failed: Some nested sub-goals failed` 
            : `Completed all nested sub-goals`;
            
          return {
            ...sg,
            status: newStatus as any,
            result,
            children: updateParentStatus(sg.children)
          };
        }
        
        // Continue checking deeper for other parents that might be complete
        return {
          ...sg,
          children: updateParentStatus(sg.children)
        };
      });
    };
    
    // Update parent statuses if all their children are complete
    updatedSubGoals = updateParentStatus(updatedSubGoals);
    
    return {
      ...state,
      task: {
        ...state.task,
        subGoals: updatedSubGoals,
        currentSubGoalId: undefined, // Clear the current sub-goal ID
      },
      messages: updatedMessages,
      executionTrace: [...state.executionTrace, traceEntry],
    };
  } catch (error) {
    // Calculate end time and duration for error case
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    const errorMessage = error instanceof Error ? error.message : `${error}`;
    taskLogger.logAction("Error executing step", { error: errorMessage });
    
    // Create error trace entry with timing information
    const errorTraceEntry: ExecutionTraceEntry = {
      step: `Error executing step: ${errorMessage}`,
      startTime,
      endTime,
      duration,
      status: 'error',
      details: { error: errorMessage }
    };
    
    // If there's a current sub-goal, mark it as failed
    let updatedSubGoals = state.task?.subGoals || [];
    
    if (state.task?.currentSubGoalId) {
      updatedSubGoals = updateSubGoalById(
        updatedSubGoals,
        state.task.currentSubGoalId,
        { status: 'failed' as const, result: `Failed: ${errorMessage}` }
      );
    }
    
    return {
      ...state,
      task: state.task ? {
        ...state.task,
        subGoals: updatedSubGoals,
        currentSubGoalId: undefined, // Clear the current sub-goal ID
      } : undefined,
      error: `Error executing step: ${errorMessage}`,
      executionTrace: [...state.executionTrace, errorTraceEntry],
    };
  }
} 