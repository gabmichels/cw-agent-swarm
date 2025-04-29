/**
 * Node for planning the task by decomposing it into sub-goals
 */

import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { NodeContext, PlanningState, PlanningTask, SubGoal } from "./types";

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

  try {
    taskLogger.logAction("Planning task", { goal: state.goal });
    
    // Retrieve relevant memories to provide context
    const relevantMemories = await memory.getRelevantMemories(state.goal, 5);
    const memoryContext = relevantMemories.length > 0 
      ? "Relevant context from your memory:\n" + relevantMemories.map(m => `- ${m.content}`).join("\n")
      : "No relevant memories found.";
    
    // Create planning prompt
    const planningPrompt = ChatPromptTemplate.fromTemplate(`
You are Chloe, a sophisticated marketing assistant. You need to decompose a complex goal into manageable sub-goals.

GOAL: {goal}

${memoryContext}

Break down this goal into 3-5 logical sub-goals that should be completed sequentially. For each sub-goal:
1. Provide a clear description
2. Assign a priority (1-5, where 1 is highest)
3. Include brief reasoning for why this sub-goal is necessary

Think step by step. Consider dependencies between sub-goals and ensure they flow logically.
Your response should be structured as valid JSON matching this schema:
{
  "reasoning": "Your step-by-step reasoning process for creating this plan",
  "subGoals": [
    {
      "id": "unique_id",
      "description": "Detailed description of what needs to be done",
      "priority": number,
      "reasoning": "Why this sub-goal is important"
    }
  ]
}
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
    
    // Create sorted sub-goals based on priority
    const subGoals: SubGoal[] = planData.subGoals
      .map((sg: any) => ({
        id: sg.id || `goal_${Math.random().toString(36).substring(2, 7)}`,
        description: sg.description,
        priority: sg.priority || 3,
        status: 'pending' as const,
        reasoning: sg.reasoning
      }))
      .sort((a, b) => a.priority - b.priority);
    
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
      reasoning: planData.reasoning.substring(0, 100) + "..."
    });
    
    // Create messages for the plan
    const planMessage = new AIMessage({
      content: `I've analyzed your goal and created a plan with ${subGoals.length} sub-goals:\n\n` +
        subGoals.map(sg => `- ${sg.description} (Priority: ${sg.priority})`).join('\n')
    });
    
    // Update and return the state
    return {
      ...state,
      task: planningTask,
      messages: [...state.messages, planMessage],
      executionTrace: [...state.executionTrace, "Task planning completed successfully"],
    };
  } catch (error) {
    taskLogger.logAction("Error in planning task", { error: String(error) });
    return {
      ...state,
      error: `Error planning task: ${error}`,
      executionTrace: [...state.executionTrace, `Error in planning: ${error}`],
    };
  }
} 