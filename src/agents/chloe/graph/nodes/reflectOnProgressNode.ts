/**
 * Node for reflecting on the progress of the execution
 */

import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { NodeContext, PlanningState, SubGoal, ExecutionTraceEntry } from "./types";

interface ReflectionResult {
  assessment: string;
  adjustments?: {
    added: SubGoal[];
    modified: SubGoal[];
  };
}

/**
 * Helper function to recursively count sub-goals by status
 */
function countSubGoalsByStatus(subGoals: SubGoal[]): { completed: number; failed: number; pending: number; total: number } {
  let completed = 0;
  let failed = 0;
  let pending = 0;
  
  for (const sg of subGoals) {
    if (sg.status === 'completed') completed++;
    else if (sg.status === 'failed') failed++;
    else pending++; // pending or in_progress
    
    // Count in children if they exist
    if (sg.children && sg.children.length > 0) {
      const childCounts = countSubGoalsByStatus(sg.children);
      completed += childCounts.completed;
      failed += childCounts.failed;
      pending += childCounts.pending;
    }
  }
  
  return { completed, failed, pending, total: completed + failed + pending };
}

/**
 * Helper function to format the sub-goals hierarchy for display in the reflection prompt
 */
function formatSubGoalsHierarchy(subGoals: SubGoal[], indent: string = ""): string {
  return subGoals.map(sg => {
    // Format the current sub-goal
    let output = `${indent}${sg.id}: ${sg.description} [${sg.status.toUpperCase()}]`;
    if (sg.result) {
      output += ` - ${sg.result.substring(0, 100)}${sg.result.length > 100 ? '...' : ''}`;
    }
    
    // Format children if they exist
    if (sg.children && sg.children.length > 0) {
      output += "\n" + formatSubGoalsHierarchy(sg.children, indent + "  ");
    }
    
    return output;
  }).join("\n");
}

/**
 * Reflects on the progress of the planning execution
 * 
 * @param state - The current planning state
 * @param context - The node execution context
 * @returns Updated planning state
 */
export async function reflectOnProgressNode(
  state: PlanningState,
  context: NodeContext
): Promise<PlanningState> {
  const { model, memory, taskLogger, dryRun } = context;
  const startTime = new Date();

  try {
    if (!state.task) {
      throw new Error("Task not found in state");
    }
    
    // Log reflection in dry run mode if enabled
    if (dryRun) {
      taskLogger.logAction("SIMULATING reflection on progress", {
        dryRun: true,
        completedGoals: state.task.subGoals.filter(g => g.status === 'completed').length,
        pendingGoals: state.task.subGoals.filter(g => g.status === 'pending').length,
        failedGoals: state.task.subGoals.filter(g => g.status === 'failed').length
      });
    } else {
      taskLogger.logAction("Reflecting on progress", {
        completedGoals: state.task.subGoals.filter(g => g.status === 'completed').length,
        pendingGoals: state.task.subGoals.filter(g => g.status === 'pending').length,
        failedGoals: state.task.subGoals.filter(g => g.status === 'failed').length
      });
    }
    
    // Count completed, failed, and pending sub-goals
    const completed = state.task.subGoals.filter(g => g.status === 'completed').length;
    const failed = state.task.subGoals.filter(g => g.status === 'failed').length;
    const pending = state.task.subGoals.filter(g => g.status === 'pending').length;
    const total = state.task.subGoals.length;
    
    // Get sub-goal details in a human-readable format
    const subGoalDetails = state.task.subGoals.map(sg => {
      const status = sg.status === 'completed' ? '✅' : 
                    sg.status === 'failed' ? '❌' : 
                    sg.status === 'in_progress' ? '🔄' : '⏳';
      return `${status} ${sg.description}${sg.result ? `: ${sg.result.substring(0, 100)}...` : ''}`;
    }).join('\n');
    
    // In dry run mode, simulate reflection instead of actually running it
    let reflectionResult: ReflectionResult;
    let reflectionText: string;
    
    if (dryRun) {
      // Create a simulated reflection response
      reflectionText = `[DRY RUN] Simulated reflection on progress\n\n` +
        `Current Progress: ${completed} completed, ${failed} failed, ${pending} pending out of ${total} total sub-goals.\n\n` +
        `This is a simulated reflection. In actual execution, I would analyze the progress, identify issues, ` +
        `and suggest adjustments to the plan if needed.`;
        
      reflectionResult = {
        assessment: reflectionText
      };
      
      taskLogger.logAction("SIMULATED reflection result", {
        reflectionLength: reflectionText.length,
        adjustments: false
      });
    } else {
      // Create the reflection prompt
      const reflectionPrompt = ChatPromptTemplate.fromTemplate(`
You are Chloe, a sophisticated marketing assistant reflecting on the progress of task execution.

GOAL: {goal}

CURRENT PROGRESS:
- Completed: {completed} of {total} sub-goals
- Failed: {failed} sub-goals
- Pending: {pending} sub-goals

SUB-GOAL DETAILS:
{subGoalDetails}

Please reflect on the execution progress so far:
1. Assess how well the execution is going
2. Identify any issues or challenges
3. Suggest adjustments to the plan if needed

FORMAT YOUR RESPONSE AS FOLLOWS:
\`\`\`json
{
  "assessment": "Your overall assessment of the execution progress",
  "adjustments": {
    "added": [
      {"description": "New sub-goal to add", "reasoning": "Why this should be added"}
    ],
    "modified": [
      {"id": "existing-id", "description": "Updated sub-goal description", "reasoning": "Why this change is needed"}
    ]
  }
}
\`\`\`

If no adjustments are needed, you can omit the "adjustments" field.
`);

      // Execute the reflection
      const reflectionResponse = await reflectionPrompt.pipe(model).invoke({
        goal: state.goal,
        completed,
        failed,
        pending,
        total,
        subGoalDetails
      });
      
      reflectionText = reflectionResponse.content;
      
      // Try to parse the reflection result from the JSON in the response
      try {
        // Extract JSON from the response if it's wrapped in a code block
        const jsonMatch = reflectionText.match(/```json\n([\s\S]*?)\n```/) || 
                         reflectionText.match(/```\n([\s\S]*?)\n```/);
        
        const jsonStr = jsonMatch ? jsonMatch[1] : reflectionText;
        reflectionResult = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('Error parsing reflection result:', parseError);
        // Fall back to a simple assessment if parsing fails
        reflectionResult = {
          assessment: reflectionText
        };
      }
      
      // Save the reflection to memory
      await memory.addMemory(
        `Reflection on task progress: ${reflectionResult.assessment.substring(0, 200)}...`,
        'reflection',
        'medium',
        'chloe',
        state.goal,
        ['task', 'reflection']
      );
    }
    
    // Update the state with reflection results
    let updatedSubGoals = [...state.task.subGoals];
    
    // Apply any adjustments from the reflection
    if (reflectionResult.adjustments) {
      // Add new sub-goals if specified
      if (reflectionResult.adjustments.added && reflectionResult.adjustments.added.length > 0) {
        for (const newGoal of reflectionResult.adjustments.added) {
          // Create a new sub-goal with a unique ID
          const newSubGoal: SubGoal = {
            id: `sg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            description: newGoal.description,
            status: 'pending',
            depth: 0, // Top-level by default
            reasoning: newGoal.reasoning || 'Added based on reflection',
            priority: 5 // Medium priority (assuming priority scale 1-10)
          };
          
          updatedSubGoals.push(newSubGoal);
        }
      }
      
      // Modify existing sub-goals if specified
      if (reflectionResult.adjustments.modified && reflectionResult.adjustments.modified.length > 0) {
        for (const modGoal of reflectionResult.adjustments.modified) {
          // Find and update the existing sub-goal
          updatedSubGoals = updatedSubGoals.map(sg => 
            sg.id === modGoal.id ? { ...sg, description: modGoal.description } : sg
          );
        }
      }
    }
    
    // Update the messages
    const updatedMessages = [
      ...state.messages,
      new HumanMessage({ content: 'Reflect on execution progress' }),
      new AIMessage({ content: reflectionText })
    ];
    
    // Calculate duration and create trace entry
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    const traceEntry: ExecutionTraceEntry = {
      step: 'Reflected on execution progress',
      startTime,
      endTime,
      duration,
      status: dryRun ? 'simulated' : 'success',
      details: {
        completed,
        failed,
        pending,
        total,
        adjustmentsMade: !!reflectionResult.adjustments,
        newSubGoalsAdded: reflectionResult.adjustments?.added?.length || 0,
        subGoalsModified: reflectionResult.adjustments?.modified?.length || 0,
        assessment: reflectionResult.assessment.substring(0, 150) + "..."
      }
    };
    
    // Store the reflection in the task object
    let updatedTask = {
      ...state.task,
      subGoals: updatedSubGoals
    };
    
    // If the task has a reflections array, append to it, otherwise create it
    if ('reflections' in updatedTask) {
      (updatedTask.reflections as string[]).push(reflectionResult.assessment);
    } else {
      // Just update the task without modifying the structure if reflections aren't supported
      taskLogger.logAction("Reflections array not supported in task object", { taskId: updatedTask.goal });
    }
    
    return {
      ...state,
      task: updatedTask,
      messages: updatedMessages,
      executionTrace: [...state.executionTrace, traceEntry],
    };
  } catch (error) {
    // Calculate duration for error case
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    const errorMessage = error instanceof Error ? error.message : `${error}`;
    context.taskLogger.logAction("Error in reflection node", { error: errorMessage });
    
    // Create error trace entry
    const errorTraceEntry: ExecutionTraceEntry = {
      step: `Error in reflection: ${errorMessage}`,
      startTime,
      endTime,
      duration,
      status: 'error',
      details: { error: errorMessage }
    };
    
    // Return the state unchanged if there's an error during reflection
    return {
      ...state,
      executionTrace: [...state.executionTrace, errorTraceEntry],
    };
  }
}

/**
 * Parses the reflection text into a structured format
 * 
 * @param reflectionText - The raw reflection text
 * @returns Parsed reflection with assessment and adjustments
 */
function parseReflection(reflectionText: string): ReflectionResult {
  const reflection: ReflectionResult = {
    assessment: "",
    adjustments: {
      added: [],
      modified: []
    }
  };

  // Extract assessment
  const assessmentMatch = reflectionText.match(/ASSESSMENT:\s*([\s\S]*?)(?=ADJUSTMENTS:|$)/i);
  if (assessmentMatch && assessmentMatch[1]) {
    reflection.assessment = assessmentMatch[1].trim();
  }

  // Extract adjustments
  const addRegex = /- ADD: (.*?) \| (.*?)(?= \| |$|(?=\n))/g;
  const modifyRegex = /- MODIFY: (.*?) \| (.*?) \| (.*?)(?=\n|$)/g;
  
  let addMatch;
  while ((addMatch = addRegex.exec(reflectionText)) !== null) {
    if (addMatch[1] && addMatch[2]) {
      reflection.adjustments?.added.push({
        id: "", // Will be set by the caller
        description: addMatch[1].trim(),
        priority: reflection.adjustments?.added.length + 1,
        status: "pending" as const,
        reasoning: addMatch[2].trim()
      });
    }
  }

  let modifyMatch;
  while ((modifyMatch = modifyRegex.exec(reflectionText)) !== null) {
    if (modifyMatch[1] && modifyMatch[2] && modifyMatch[3]) {
      reflection.adjustments?.modified.push({
        id: modifyMatch[1].trim(),
        description: modifyMatch[2].trim(),
        priority: 0, // Will be preserved from the original
        status: "pending" as const,
        reasoning: modifyMatch[3].trim()
      });
    }
  }

  return reflection;
} 