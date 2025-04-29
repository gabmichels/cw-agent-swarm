/**
 * Node for reflecting on the progress of task execution
 */

import { ChatPromptTemplate } from "@langchain/core/prompts";
import { NodeContext, PlanningState, SubGoal } from "./types";
import { AIMessage, HumanMessage } from "@langchain/core/messages";

interface ReflectionResult {
  assessment: string;
  adjustments?: {
    added: SubGoal[];
    modified: SubGoal[];
  };
}

/**
 * Reflects on the current progress of the planning execution
 * 
 * @param state - The current planning state
 * @param context - The node execution context
 * @returns Updated planning state
 */
export async function reflectOnProgressNode(
  state: PlanningState,
  context: NodeContext
): Promise<PlanningState> {
  const { model, memory, taskLogger } = context;

  try {
    if (!state.task) {
      throw new Error("Task not found in state");
    }

    const { subGoals } = state.task;
    
    // Count sub-goals by status
    const completed = subGoals.filter(sg => sg.status === "completed").length;
    const failed = subGoals.filter(sg => sg.status === "failed").length;
    const pending = subGoals.filter(sg => sg.status === "pending" || sg.status === "in_progress").length;
    
    taskLogger.logAction("Reflecting on progress", { completed, failed, pending });

    // Create a reflection prompt
    const reflectionPrompt = ChatPromptTemplate.fromTemplate(`
You are Chloe, a sophisticated assistant reflecting on the progress of a task.

MAIN GOAL: {goal}

CURRENT PLAN:
{plan}

Reflect on the progress so far. Consider:
1. Are we making good progress toward the main goal?
2. Are there any failed sub-goals that need to be addressed?
3. Are there any missing sub-goals that should be added?
4. Are there any sub-goals that should be modified?

Provide your reflection in the following format:

ASSESSMENT:
[Your overall assessment of the progress]

ADJUSTMENTS:
[If needed, specify any adjustments to the plan in this format]
- ADD: [description of new sub-goal] | [reasoning]
- MODIFY: [sub-goal id] | [new description] | [reasoning]
`);

    // Format the plan for the prompt
    const planText = subGoals.map(sg => {
      return `${sg.id}: ${sg.description} [${sg.status.toUpperCase()}]${sg.result ? ` - ${sg.result.substring(0, 100)}...` : ''}`;
    }).join("\n");

    // Generate the reflection
    const reflectionResult = await reflectionPrompt.pipe(model).invoke({
      goal: state.goal,
      plan: planText
    });

    const reflectionText = reflectionResult.content;
    
    // Parse the reflection
    const parsedReflection = parseReflection(reflectionText);
    
    // Save reflection to memory if available
    if (memory) {
      await memory.addMemory(
        `Reflection on task progress: ${parsedReflection.assessment}`,
        'reflection',
        'medium',
        'system',
        state.goal,
        ['reflection', 'task-progress']
      );
    }

    // Apply adjustments if any
    let updatedSubGoals = [...subGoals];
    
    if (parsedReflection.adjustments) {
      const { added, modified } = parsedReflection.adjustments;
      
      // Add new sub-goals
      if (added.length > 0) {
        for (const newSubGoal of added) {
          updatedSubGoals.push({
            ...newSubGoal,
            id: `sg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            status: 'pending'
          });
        }
      }
      
      // Modify existing sub-goals
      if (modified.length > 0) {
        for (const modSubGoal of modified) {
          updatedSubGoals = updatedSubGoals.map(sg => 
            sg.id === modSubGoal.id ? { ...sg, ...modSubGoal } : sg
          );
        }
      }
    }

    // Add the reflection to messages
    const updatedMessages = [
      ...state.messages,
      new HumanMessage({ content: "Reflecting on current progress." }),
      new AIMessage({ content: reflectionText })
    ];

    return {
      ...state,
      task: {
        ...state.task,
        subGoals: updatedSubGoals,
      },
      messages: updatedMessages,
      executionTrace: [...state.executionTrace, "Reflected on progress"]
    };
  } catch (error) {
    taskLogger.logAction("Error reflecting on progress", { error: String(error) });
    
    return {
      ...state,
      error: `Error reflecting on progress: ${error}`,
      executionTrace: [...state.executionTrace, `Error reflecting on progress: ${error}`],
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
  const addRegex = /- ADD: (.*?) \| (.*?)(?=\n|$)/g;
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