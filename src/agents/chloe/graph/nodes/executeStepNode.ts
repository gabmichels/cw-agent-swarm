/**
 * Node for executing a specific sub-goal
 */

import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { NodeContext, PlanningState, SubGoal, ExecutionTraceEntry } from "./types";
import { MemoryEntry } from "../../memory";
import { PlannedTask, HumanCollaboration } from "../../human-collaboration";
import { ChloeMemory } from "../../memory";
import { ToolResult } from "../../tools/toolManager";

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
    
    // Check if the task requires approval but hasn't been granted yet
    const currentTask = state.task as PlannedTask;
    if (currentTask.requiresApproval === true && currentTask.approvalGranted !== true) {
      // Add dry run indicator to the log
      taskLogger.logAction("Task execution blocked pending approval", { 
        subGoalId: currentSubGoal.id,
        description: currentSubGoal.description,
        path: subGoalPath,
        requiresApproval: true
      });
      
      // Update the sub-goal with blocked status
      let updatedSubGoals = updateSubGoalById(
        state.task.subGoals, 
        currentSubGoal.id, 
        { status: 'pending' } // Keep it as pending since it hasn't been executed
      );
      
      // Create a message requesting approval with stakeholder-aware tone
      const approvalRequestContent = HumanCollaboration.formatApprovalRequest(
        currentTask,
        currentTask.stakeholderProfile
      );
      
      const approvalRequestMessage = new AIMessage({
        content: approvalRequestContent
      });
      
      // Store the blocked reason in memory
      if (memory) {
        await memory.addMemory(
          `Task execution blocked: ${currentSubGoal.description} - Awaiting approval`,
          'task',
          'high' as any,
          'chloe' as any,
          state.goal,
          ['task', 'approval', 'blocker', currentSubGoal.id]
        );
      }
      
      // Calculate end time and duration
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      // Create execution trace entry with timing information
      const traceEntry: ExecutionTraceEntry = {
        step: `Task blocked: Awaiting approval for ${subGoalPath}`,
        startTime,
        endTime,
        duration,
        status: 'info',
        details: {
          subGoalId: currentSubGoal.id,
          description: currentSubGoal.description,
          blockedReason: "awaiting approval",
          stakeholderProfile: currentTask.stakeholderProfile?.id || 'default'
        }
      };
      
      // Return the updated state, setting route to request approval
      return {
        ...state,
        route: 'request-approval',
        task: {
          ...state.task,
          subGoals: updatedSubGoals,
          blockedReason: "awaiting approval"
        } as PlannedTask,
        messages: [...state.messages, approvalRequestMessage],
        executionTrace: [...state.executionTrace, traceEntry],
      };
    }
    
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
      
      // Generate execution with the LLM
      const executionResult = await executionPrompt.pipe(model).invoke({
        goal: state.goal,
        subGoal: currentSubGoal.description,
        hierarchyPosition
      });
      
      executionOutput = executionResult.content.toString();
      
      // Check for tool invocation in the execution output
      const toolInvocationRegex = /use tool: ([a-zA-Z0-9_]+)([\s\S]*?)parameters:([\s\S]*?)(?=use tool:|$)/gi;
      let match;
      let toolExecutionSucceeded = true;
      let toolExecutionFailure: ToolResult | null = null;
      
      // Handle any tool invocations in the output
      while ((match = toolInvocationRegex.exec(executionOutput)) !== null) {
        const toolName = match[1].trim();
        const parametersText = match[3].trim();
        
        taskLogger.logAction("Tool invocation detected", {
          toolName,
          parametersText: parametersText.substring(0, 100) + (parametersText.length > 100 ? "..." : "")
        });
        
        // Parse parameters - handle different formats
        let parameters: Record<string, any> = {};
        try {
          // Try parsing as JSON
          parameters = JSON.parse(parametersText);
        } catch (parseError) {
          // If not JSON, try parsing as key-value pairs
          parametersText.split('\n').forEach(line => {
            const keyValue = line.split(':');
            if (keyValue.length >= 2) {
              const key = keyValue[0].trim();
              const value = keyValue.slice(1).join(':').trim();
              parameters[key] = value;
            }
          });
        }
        
        // Execute the tool with failure handling
        if (tools && tools[toolName]) {
          try {
            const toolExecutionOptions = {
              allowRetry: true,
              maxRetries: 1,
              fallbackTools: [] as string[],
              logToMemory: true,
              taskId: state.task?.id
            };
            
            // Add appropriate fallback tools based on the tool being used
            if (toolName.includes('search')) {
              toolExecutionOptions.fallbackTools = ['simplifiedSearch', 'memorySearch'];
            } else if (toolName.includes('api')) {
              toolExecutionOptions.fallbackTools = ['webSearch', 'dataRetrieval'];
            } else if (toolName.includes('generate')) {
              toolExecutionOptions.fallbackTools = ['simpleGenerator', 'templateGenerator'];
            }
            
            // Execute the tool with all the error handling built in
            const toolResult = await tools[toolName].executeTool(
              toolName, 
              parameters,
              toolExecutionOptions
            );
            
            // Handle successful execution
            if (toolResult.success) {
              const successMessage = toolResult.fallbackUsed 
                ? `\n\nTool '${toolName}' failed, but fallback tool '${toolResult.fallbackToolName}' succeeded with result:\n${JSON.stringify(toolResult.output, null, 2)}`
                : `\n\nTool '${toolName}' execution result:\n${JSON.stringify(toolResult.output, null, 2)}`;
              
              // Replace the tool invocation with the result
              executionOutput = executionOutput.replace(
                match[0],
                successMessage
              );
            } 
            // Handle tool failure
            else {
              toolExecutionSucceeded = false;
              toolExecutionFailure = toolResult;
              
              // Replace the tool invocation with the error
              executionOutput = executionOutput.replace(
                match[0],
                `\n\nTool '${toolName}' execution failed: ${toolResult.error}\n`
              );
              
              // Break after first failure to handle it properly
              break;
            }
          } catch (toolExecutionError) {
            toolExecutionSucceeded = false;
            
            // Create a generic tool result for the error
            toolExecutionFailure = {
              success: false,
              output: null,
              error: toolExecutionError instanceof Error ? toolExecutionError.message : String(toolExecutionError),
              toolName,
              executionTime: Date.now() - startTime.getTime()
            };
            
            // Replace the tool invocation with the error
            executionOutput = executionOutput.replace(
              match[0],
              `\n\nTool '${toolName}' execution error: ${toolExecutionFailure.error}\n`
            );
            
            // Break after first failure
            break;
          }
        } else {
          // Tool not found in the available tools
          executionOutput = executionOutput.replace(
            match[0],
            `\n\nTool '${toolName}' not found in available tools.\n`
          );
        }
      }
      
      // If a tool execution failed, we need to handle the failure
      if (!toolExecutionSucceeded && toolExecutionFailure) {
        // Log the failure
        taskLogger.logAction("Tool execution failed during step", {
          toolName: toolExecutionFailure.toolName,
          error: toolExecutionFailure.error,
          fallbackAttempted: toolExecutionFailure.fallbackUsed
        });
        
        // Create a message for the user with options
        const failureMessage = new AIMessage({
          content: `While executing the sub-goal "${currentSubGoal.description}", the tool "${toolExecutionFailure.toolName}" failed with error: ${toolExecutionFailure.error}.\n\nHow would you like to proceed?\n\n1. Retry with the same tool\n2. Suggest an alternative approach\n3. Skip this step and continue\n4. Pause the task for manual resolution`
        });
        
        // Update the sub-goal status to indicate failure
        updatedSubGoals = updateSubGoalById(
          updatedSubGoals, 
          currentSubGoal.id, 
          { 
            status: 'failed',
            failureReason: `Tool execution failed: ${toolExecutionFailure.error}`
          }
        );
        
        // Add the failure information to the task
        const taskWithFailure: PlannedTask = {
          ...state.task as PlannedTask,
          subGoals: updatedSubGoals,
          blockedReason: "tool_failure",
          failedTool: toolExecutionFailure.toolName,
          failureDetails: {
            toolName: toolExecutionFailure.toolName,
            error: toolExecutionFailure.error || 'Unknown error',
            parameters: JSON.stringify(toolExecutionFailure),
            subGoalId: currentSubGoal.id
          }
        };
        
        // Create a trace entry for the failure
        const failureTraceEntry: ExecutionTraceEntry = {
          step: `Tool execution failed for sub-goal: ${subGoalPath}`,
          startTime,
          endTime: new Date(),
          duration: new Date().getTime() - startTime.getTime(),
          status: 'error',
          details: {
            toolName: toolExecutionFailure.toolName,
            error: toolExecutionFailure.error,
            subGoalId: currentSubGoal.id
          }
        };
        
        // Return the state with the failure and request for user direction
        return {
          ...state,
          route: 'tool-failure',
          task: taskWithFailure,
          messages: [...state.messages, failureMessage],
          executionTrace: [...state.executionTrace, failureTraceEntry],
          error: `Tool execution failed: ${toolExecutionFailure.error}`
        };
      }
      
      // If we reach here, tool execution succeeded or there were no tools used
      taskLogger.logAction("Step execution result", {
        output: executionOutput.substring(0, 100) + "..."
      });
    }
    
    // Update the sub-goal with the result
    updatedSubGoals = updateSubGoalById(
      updatedSubGoals, 
      currentSubGoal.id, 
      { 
        status: 'complete',
        failureReason: executionOutput.substring(0, 500)
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
        if (!sg.children || sg.children.length === 0 || sg.status === 'complete' || sg.status === 'failed') {
          return sg;
        }
        
        // Check if all children are completed or failed
        const allChildrenDone = sg.children.every(child => 
          child.status === 'complete' || child.status === 'failed'
        );
        
        if (allChildrenDone) {
          // Check if any children failed
          const anyChildFailed = sg.children.some(child => child.status === 'failed');
          
          // If any child failed, mark the parent as failed too
          const newStatus = anyChildFailed ? 'failed' : 'complete';
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
        { 
          status: 'failed' as const, 
          failureReason: `Failed: ${errorMessage}`
        }
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