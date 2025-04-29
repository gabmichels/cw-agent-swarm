/**
 * Node for planning the task by decomposing it into sub-goals
 */

import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { NodeContext, PlanningState, PlanningTask, SubGoal, ExecutionTraceEntry } from "./types";

/**
 * Helper function to create a timestamped execution trace entry
 */
function createTraceEntry(
  step: string, 
  status: 'success' | 'error' | 'info' | 'simulated' = 'success',
  details?: any
): ExecutionTraceEntry {
  const startTime = new Date();
  return {
    step,
    startTime,
    endTime: startTime, // For immediate actions, start and end are the same
    duration: 0,
    status,
    details
  };
}

/**
 * Plans a task by decomposing it into sub-goals
 * 
 * @param state - The current planning state
 * @param context - The node execution context
 * @returns Updated planning state
 */
export async function planTaskNode(
  state: PlanningState,
  context: NodeContext
): Promise<PlanningState> {
  const { model, memory, taskLogger } = context;
  const startTime = new Date();

  try {
    taskLogger.logAction("Planning task", { goal: state.goal });
    
    // Retrieve relevant memories to provide context
    const relevantMemories = await memory.getRelevantMemories(state.goal, 5);
    const memoryContext = relevantMemories.length > 0 
      ? "Relevant context from your memory:\n" + relevantMemories.map(m => `- ${m.content}`).join("\n")
      : "No relevant memories found.";
    
    // Create planning prompt - enhanced to support hierarchical planning
    const planningPrompt = ChatPromptTemplate.fromTemplate(`
You are Chloe, a sophisticated marketing assistant. You need to decompose a complex goal into manageable sub-goals.

GOAL: {goal}

${memoryContext}

Break down this goal into 3-5 logical sub-goals that should be completed sequentially. For each sub-goal:
1. Provide a clear description
2. Assign a priority (1-5, where 1 is highest)
3. Include brief reasoning for why this sub-goal is necessary
4. If appropriate, break down complex sub-goals into 2-3 smaller children tasks

Think step by step. Consider dependencies between sub-goals and ensure they flow logically.
Your response should be structured as valid JSON matching this schema:
{
  "reasoning": "Your step-by-step reasoning process for creating this plan",
  "subGoals": [
    {
      "id": "unique_id",
      "description": "Detailed description of what needs to be done",
      "priority": number,
      "reasoning": "Why this sub-goal is important",
      "children": [
        {
          "id": "child_id",
          "description": "Description of child task",
          "priority": number,
          "reasoning": "Why this child task is important"
        }
      ]
    }
  ]
}

Only include the "children" array for sub-goals that should be broken down further.
`);
    
    // Generate plan using LLM
    const planningChainResult = await planningPrompt.pipe(model).invoke({
      goal: state.goal
    });
    
    let planData: { reasoning: string; subGoals: any[] };
    try {
      // Extract the JSON part from the LLM response
      const jsonMatch = planningChainResult.content.match(/```json\n([\s\S]*?)\n```/) || 
                       planningChainResult.content.match(/```\n([\s\S]*?)\n```/) || 
                       planningChainResult.content.match(/\{[\s\S]*\}/);
                       
      const jsonString = jsonMatch ? jsonMatch[0] : planningChainResult.content;
      planData = JSON.parse(jsonString);
    } catch (e) {
      // Fallback if JSON parsing fails
      taskLogger.logAction("Error parsing JSON from LLM response", { error: String(e) });
      
      // Try to create a more basic plan
      planData = {
        reasoning: "Automatically generated plan due to parsing error",
        subGoals: [
          {
            id: "goal_1",
            description: `Complete the goal: ${state.goal}`,
            priority: 1,
            reasoning: "This is the main objective"
          }
        ]
      };
    }
    
    // Process sub-goals recursively to ensure proper hierarchical structure
    const processSubGoals = (subGoals: any[], parentId?: string, depth: number = 0): SubGoal[] => {
      return subGoals.map((sg: any) => {
        // Create the base sub-goal
        const subGoal: SubGoal = {
          id: sg.id || `goal_${Math.random().toString(36).substring(2, 7)}`,
          description: sg.description,
          priority: sg.priority || 3,
          status: 'pending' as const,
          reasoning: sg.reasoning,
          depth,
          parentId
        };
        
        // Process children if they exist
        if (sg.children && Array.isArray(sg.children) && sg.children.length > 0) {
          subGoal.children = processSubGoals(sg.children, subGoal.id, depth + 1);
        }
        
        return subGoal;
      }).sort((a, b) => a.priority - b.priority);
    };
    
    // Create sorted sub-goals with hierarchy
    const subGoals: SubGoal[] = processSubGoals(planData.subGoals);
    
    // Create the planning task
    const planningTask: PlanningTask = {
      goal: state.goal,
      subGoals,
      reasoning: planData.reasoning,
      status: 'planning'
    };
    
    // Log the created plan
    taskLogger.logAction("Created task plan", { 
      subGoals: subGoals.length,
      hasHierarchy: subGoals.some(sg => sg.children && sg.children.length > 0),
      reasoning: planData.reasoning.substring(0, 100) + "..."
    });
    
    // Helper function to format sub-goals in a hierarchical way
    const formatSubGoalsHierarchy = (subGoals: SubGoal[], indent: string = ""): string => {
      return subGoals.map(sg => {
        let output = `${indent}- ${sg.description} (Priority: ${sg.priority})`;
        if (sg.children && sg.children.length > 0) {
          output += "\n" + formatSubGoalsHierarchy(sg.children, indent + "  ");
        }
        return output;
      }).join('\n');
    };
    
    // Create messages for the plan
    const planMessage = new AIMessage({
      content: `I've analyzed your goal and created a plan with ${subGoals.length} main sub-goals:\n\n` +
        formatSubGoalsHierarchy(subGoals)
    });
    
    // Calculate duration and create trace entry
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    const traceEntry: ExecutionTraceEntry = {
      step: "Task planning completed successfully",
      startTime,
      endTime,
      duration,
      status: 'success',
      details: {
        subGoalsCreated: subGoals.length,
        hasNestedSubGoals: subGoals.some(sg => sg.children && sg.children.length > 0)
      }
    };
    
    // Update and return the state
    return {
      ...state,
      task: planningTask,
      messages: [...state.messages, planMessage],
      executionTrace: [...state.executionTrace, traceEntry],
    };
  } catch (error) {
    // Calculate duration for error case
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    const errorMessage = error instanceof Error ? error.message : `${error}`;
    taskLogger.logAction("Error in planning task", { error: errorMessage });
    
    const errorTraceEntry: ExecutionTraceEntry = {
      step: `Error in planning: ${errorMessage}`,
      startTime,
      endTime,
      duration,
      status: 'error',
      details: { error: errorMessage }
    };
    
    return {
      ...state,
      error: `Error planning task: ${errorMessage}`,
      executionTrace: [...state.executionTrace, errorTraceEntry],
    };
  }
} 