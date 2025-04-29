/**
 * Node for reflecting on the progress of the execution
 */

import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { NodeContext, PlanningState, SubGoal } from "./types";

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
    
    // Count sub-goals by status, including nested ones
    const { completed, failed, pending, total } = countSubGoalsByStatus(subGoals);
    
    taskLogger.logAction("Reflecting on progress", { completed, failed, pending, total });

    // Create a reflection prompt
    const reflectionPrompt = ChatPromptTemplate.fromTemplate(`
You are Chloe, a sophisticated assistant reflecting on the progress of a task.

MAIN GOAL: {goal}

CURRENT PLAN:
{plan}

PROGRESS SUMMARY:
- Completed: ${completed}/${total} sub-goals
- Failed: ${failed}/${total} sub-goals
- Pending: ${pending}/${total} sub-goals

Reflect on the progress so far. Consider:
1. Are we making good progress toward the main goal?
2. Are there any failed sub-goals that need to be addressed?
3. Are there any missing sub-goals that should be added?
4. Are there any sub-goals that should be modified?
5. Should any parent sub-goals have their own nested sub-tasks?

Provide your reflection in the following format:

ASSESSMENT:
[Your overall assessment of the progress]

ADJUSTMENTS:
[If needed, specify any adjustments to the plan in this format]
- ADD: [description of new sub-goal] | [reasoning] | [parent_id (optional, for nested sub-goals)]
- MODIFY: [sub-goal id] | [new description] | [reasoning]
`);

    // Format the plan for the prompt
    const planText = formatSubGoalsHierarchy(subGoals);

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
      
      // Helper function to find a parent sub-goal by ID
      const findParentById = (id: string): SubGoal | undefined => {
        const flatten = (goals: SubGoal[]): SubGoal[] => {
          return goals.reduce((acc, goal) => {
            acc.push(goal);
            if (goal.children) acc.push(...flatten(goal.children));
            return acc;
          }, [] as SubGoal[]);
        };
        
        return flatten(updatedSubGoals).find(sg => sg.id === id);
      };
      
      // Add new sub-goals (either at top level or as children of existing sub-goals)
      if (added.length > 0) {
        for (const newSubGoal of added) {
          // Check if a parent ID is specified
          const parentIdMatch = newSubGoal.reasoning?.match(/parent_id: ([\w-]+)/i);
          const parentId = parentIdMatch ? parentIdMatch[1] : undefined;
          
          // Determine the depth based on parent
          let depth = 0;
          if (parentId) {
            const parent = findParentById(parentId);
            if (parent) {
              depth = (parent.depth || 0) + 1;
            }
          }
          
          // Create the new sub-goal with proper ID and parent reference
          const subGoalToAdd: SubGoal = {
            ...newSubGoal,
            id: `sg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            status: 'pending',
            parentId,
            depth
          };
          
          // If no parent specified, add to top level
          if (!parentId) {
            updatedSubGoals.push(subGoalToAdd);
          } else {
            // Otherwise, add as a child to the specified parent
            updatedSubGoals = updatedSubGoals.map(sg => {
              if (sg.id === parentId) {
                return {
                  ...sg,
                  children: [...(sg.children || []), subGoalToAdd]
                };
              } else if (sg.children && sg.children.length > 0) {
                // Recursively check children
                const updateChildren = (children: SubGoal[]): SubGoal[] => {
                  return children.map(child => {
                    if (child.id === parentId) {
                      return {
                        ...child,
                        children: [...(child.children || []), subGoalToAdd]
                      };
                    } else if (child.children && child.children.length > 0) {
                      return {
                        ...child,
                        children: updateChildren(child.children)
                      };
                    }
                    return child;
                  });
                };
                
                return {
                  ...sg,
                  children: updateChildren(sg.children)
                };
              }
              return sg;
            });
          }
        }
      }
      
      // Modify existing sub-goals
      if (modified.length > 0) {
        for (const modSubGoal of modified) {
          // Helper function to recursively update a sub-goal by ID
          const updateSubGoalById = (goals: SubGoal[], id: string, updates: Partial<SubGoal>): SubGoal[] => {
            return goals.map(sg => {
              if (sg.id === id) {
                return { ...sg, ...updates };
              } else if (sg.children && sg.children.length > 0) {
                return {
                  ...sg,
                  children: updateSubGoalById(sg.children, id, updates)
                };
              }
              return sg;
            });
          };
          
          updatedSubGoals = updateSubGoalById(updatedSubGoals, modSubGoal.id, modSubGoal);
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
      executionTrace: [...state.executionTrace, `Reflected on progress: ${completed}/${total} complete, ${failed}/${total} failed`]
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