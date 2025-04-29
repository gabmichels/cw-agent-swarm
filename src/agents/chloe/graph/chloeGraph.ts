/**
 * Advanced LangGraph-style implementation for Chloe's planning system
 * Implements a StateGraph-like architecture with dynamic planning and execution
 */

import { ChatOpenAI } from "@langchain/openai";
import { ChloeMemory, ChloeMemoryType } from "../memory";
import { TaskLogger } from "../task-logger";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { StructuredTool } from "@langchain/core/tools";
import { ChatPromptTemplate } from "@langchain/core/prompts";

/**
 * Types for Chloe's planning system
 */

// Define a SubGoal type for task decomposition
export interface SubGoal {
  id: string;
  description: string;
  priority: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  reasoning?: string;
  result?: string;
}

// Define a Task type for planning
export interface PlanningTask {
  goal: string;
  subGoals: SubGoal[];
  currentSubGoalId?: string;
  reasoning: string;
  status: 'planning' | 'executing' | 'completed' | 'failed';
}

// Define state for the planning graph
export interface PlanningState {
  // The original input goal
  goal: string;
  
  // The current task plan
  task?: PlanningTask;
  
  // Conversation history (for LLM context)
  messages: BaseMessage[];
  
  // Execution trace for monitoring
  executionTrace: string[];
  
  // Final execution result
  finalResult?: string;
  
  // Routing information
  route?: string;
  
  // Errors that occurred during execution
  error?: string;
}

/**
 * ChloeGraph - Implementation of Chloe's planning system using a StateGraph-like architecture
 */
export class ChloeGraph {
  private model: ChatOpenAI;
  private memory: ChloeMemory;
  private taskLogger: TaskLogger;
  private tools: Record<string, any>;

  constructor(
    model: ChatOpenAI,
    memory: ChloeMemory,
    taskLogger: TaskLogger,
    tools: Record<string, any> = {}
  ) {
    this.model = model;
    this.memory = memory;
    this.taskLogger = taskLogger;
    this.tools = tools;
  }

  /**
   * Execute the planning and execution graph with a given goal
   */
  public async execute(goal: string, options?: { trace?: boolean }): Promise<PlanningState> {
    try {
      this.taskLogger.logAction("Starting planning execution", { goal });
      
      // Initialize state with the goal
      let state: PlanningState = {
        goal,
        messages: [new HumanMessage({ content: goal })],
        executionTrace: []
      };
      
      // Execute the planning steps in sequence according to the StateGraph architecture
      
      // 1. Plan the task
      state = await this.planTaskNode(state);
      if (state.error) {
        return this.finalizeState(state, options);
      }
      
      // 2. Enter the main execution loop: Decide, Execute, Reflect
      let executionComplete = false;
      while (!executionComplete) {
        // Decide what to do next
        state = await this.decideNextStepNode(state);
        
        // Determine the next route
        const route = this.routeAfterDecision(state);
        state.route = route;
        
        if (route === "execute") {
          // Execute the next step
          state = await this.executeStepNode(state);
          if (state.error) {
            return this.finalizeState(state, options);
          }
          
          // Reflect on progress
          state = await this.reflectOnProgressNode(state);
        } else {
          // Complete or failed, end execution
          executionComplete = true;
        }
      }
      
      return this.finalizeState(state, options);
    } catch (error) {
      this.taskLogger.logAction("Error executing planning graph", { error: String(error) });
      return {
        goal,
        messages: [new HumanMessage({ content: goal })],
        executionTrace: [`Error executing planning graph: ${error}`],
        error: `Error executing planning graph: ${error}`
      };
    }
  }
  
  /**
   * Finalize the state and log completion
   */
  private finalizeState(state: PlanningState, options?: { trace?: boolean }): PlanningState {
    // Log completion
    this.taskLogger.logAction("Completed planning execution", { 
      success: !state.error,
      finalResult: state.finalResult?.substring(0, 100) + "...",
    });
    
    // If tracing is enabled, log the execution trace
    if (options?.trace && state.executionTrace) {
      this.taskLogger.logAction("Execution trace", { 
        trace: state.executionTrace 
      });
    }
    
    return state;
  }

  /**
   * Stream the execution of the planning graph
   */
  public async *streamExecute(goal: string) {
    try {
      this.taskLogger.logAction("Starting streaming planning execution", { goal });
      
      // Initialize state with the goal
      let state: PlanningState = {
        goal,
        messages: [new HumanMessage({ content: goal })],
        executionTrace: []
      };
      
      // 1. Plan the task
      state = await this.planTaskNode(state);
      yield state;
      
      if (state.error) {
        return;
      }
      
      // 2. Enter the main execution loop: Decide, Execute, Reflect
      let executionComplete = false;
      while (!executionComplete) {
        // Decide what to do next
        state = await this.decideNextStepNode(state);
        
        // Determine the next route
        const route = this.routeAfterDecision(state);
        state.route = route;
        
        yield state;
        
        if (route === "execute") {
          // Execute the next step
          state = await this.executeStepNode(state);
          yield state;
          
          if (state.error) {
            return;
          }
          
          // Reflect on progress
          state = await this.reflectOnProgressNode(state);
          yield state;
        } else {
          // Complete or failed, end execution
          executionComplete = true;
        }
      }
      
      this.taskLogger.logAction("Completed streaming planning execution");
    } catch (error) {
      this.taskLogger.logAction("Error in streaming execution", { error: String(error) });
      throw error;
    }
  }

  /**
   * Node for planning the task by decomposing it into sub-goals
   */
  private async planTaskNode(state: PlanningState): Promise<PlanningState> {
    try {
      this.taskLogger.logAction("Planning task", { goal: state.goal });
      
      // Retrieve relevant memories to provide context
      const relevantMemories = await this.memory.getRelevantMemories(state.goal, 5);
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
      const planningChainResult = await planningPrompt.pipe(this.model).invoke({
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
        this.taskLogger.logAction("Error parsing JSON from LLM response", { error: String(e) });
        
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
      const subGoals = planData.subGoals
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
      this.taskLogger.logAction("Created task plan", { 
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
      this.taskLogger.logAction("Error in planning task", { error: String(error) });
      return {
        ...state,
        error: `Error planning task: ${error}`,
        executionTrace: [...state.executionTrace, `Error in planning: ${error}`],
      };
    }
  }

  /**
   * Node for deciding the next step in the execution process
   */
  private async decideNextStepNode(state: PlanningState): Promise<PlanningState> {
    try {
      if (!state.task) {
        throw new Error("Task not found in state");
      }
      
      this.taskLogger.logAction("Deciding next step", { 
        currentStatus: state.task.status,
        subGoalCount: state.task.subGoals.length
      });
      
      // If there's an error, mark as failed
      if (state.error) {
        return {
          ...state,
          task: {
            ...state.task,
            status: 'failed'
          },
          executionTrace: [...state.executionTrace, "Execution failed due to error"],
        };
      }
      
      // Find the next pending sub-goal
      const nextSubGoal = state.task.subGoals.find(sg => sg.status === 'pending');
      
      // If there are no more pending sub-goals, check if any failed
      if (!nextSubGoal) {
        const failedSubGoals = state.task.subGoals.filter(sg => sg.status === 'failed');
        
        if (failedSubGoals.length > 0) {
          this.taskLogger.logAction("Some sub-goals failed", { failedCount: failedSubGoals.length });
          
          return {
            ...state,
            task: {
              ...state.task,
              status: 'completed', // We still consider it completed, but with partial success
            },
            finalResult: `Task completed with ${failedSubGoals.length} failed sub-goals.`,
            executionTrace: [...state.executionTrace, "Task completed with some failed sub-goals"],
          };
        } else {
          // All sub-goals completed successfully
          this.taskLogger.logAction("All sub-goals completed successfully");
          
          // Generate a final summary
          const summaryPrompt = ChatPromptTemplate.fromTemplate(`
You are Chloe, a sophisticated marketing assistant. You've completed a complex task with multiple sub-goals.

ORIGINAL GOAL: {goal}

COMPLETED SUB-GOALS:
{completedSubGoals}

Based on the completed sub-goals, provide a comprehensive summary of the results.
`);
          
          const completedSubGoalText = state.task.subGoals
            .map(sg => `- ${sg.description}\n  Result: ${sg.result || "Completed"}`)
            .join("\n");
          
          const summaryResult = await summaryPrompt.pipe(this.model).invoke({
            goal: state.goal,
            completedSubGoals: completedSubGoalText
          });
          
          const finalSummary = summaryResult.content;
          
          return {
            ...state,
            task: {
              ...state.task,
              status: 'completed',
            },
            finalResult: finalSummary,
            messages: [...state.messages, new AIMessage({ content: finalSummary })],
            executionTrace: [...state.executionTrace, "Task completed successfully"],
          };
        }
      }
      
      // We have a pending sub-goal, update the state to execute it
      return {
        ...state,
        task: {
          ...state.task,
          status: 'executing',
          currentSubGoalId: nextSubGoal.id
        },
        executionTrace: [...state.executionTrace, `Selected sub-goal: ${nextSubGoal.description}`],
      };
    } catch (error) {
      this.taskLogger.logAction("Error deciding next step", { error: String(error) });
      return {
        ...state,
        error: `Error deciding next step: ${error}`,
        executionTrace: [...state.executionTrace, `Error deciding next step: ${error}`],
      };
    }
  }

  /**
   * Node for executing a specific sub-goal
   */
  private async executeStepNode(state: PlanningState): Promise<PlanningState> {
    try {
      if (!state.task) {
        throw new Error("Task not found in state");
      }
      
      // Get the current sub-goal
      const currentSubGoalId = state.task.currentSubGoalId;
      if (!currentSubGoalId) {
        throw new Error("No current sub-goal ID found");
      }
      
      const subGoalIndex = state.task.subGoals.findIndex(sg => sg.id === currentSubGoalId);
      if (subGoalIndex === -1) {
        throw new Error(`Sub-goal with ID ${currentSubGoalId} not found`);
      }
      
      const subGoal = state.task.subGoals[subGoalIndex];
      this.taskLogger.logAction("Executing sub-goal", { 
        subGoalId: subGoal.id,
        description: subGoal.description
      });
      
      // Update the sub-goal status to in_progress
      const updatedSubGoals = [...state.task.subGoals];
      updatedSubGoals[subGoalIndex] = {
        ...subGoal,
        status: 'in_progress'
      };
      
      // Retrieve additional context from memory if relevant
      const relevantMemories = await this.memory.getRelevantMemories(subGoal.description, 3);
      const memoryContext = relevantMemories.length > 0 
        ? "Relevant memories:\n" + relevantMemories.map(m => `- ${m.content}`).join("\n")
        : "";
      
      // Create execution prompt
      const executionPrompt = ChatPromptTemplate.fromTemplate(`
You are Chloe, a sophisticated marketing assistant. You need to execute the following sub-goal:

SUB-GOAL: {subGoal}

OVERALL GOAL: {goal}

PREVIOUS PROGRESS:
{previousProgress}

${memoryContext}

Execute this sub-goal by providing a detailed and comprehensive response.
Think step by step to ensure you fully address the sub-goal requirements.
Provide concrete, actionable results or recommendations.
`);
      
      // Get previous progress
      const completedSubGoals = state.task.subGoals
        .filter(sg => sg.status === 'completed')
        .map(sg => `- ${sg.description}: ${sg.result || "Completed"}`)
        .join("\n");
      
      const previousProgress = completedSubGoals ? 
        "Previously completed sub-goals:\n" + completedSubGoals : 
        "No sub-goals completed yet.";
      
      // Execute the sub-goal using the LLM
      const executionResult = await executionPrompt.pipe(this.model).invoke({
        subGoal: subGoal.description,
        goal: state.goal,
        previousProgress
      });
      
      // Update the sub-goal with the result
      updatedSubGoals[subGoalIndex] = {
        ...subGoal,
        status: 'completed',
        result: executionResult.content
      };
      
      // Save the result to memory
      await this.memory.addMemory(
        executionResult.content,
        'document' as ChloeMemoryType,
        'medium',
        'chloe',
        `Result for sub-goal: ${subGoal.description}`,
        ['task', 'result', state.goal]
      );
      
      return {
        ...state,
        task: {
          ...state.task,
          subGoals: updatedSubGoals,
        },
        messages: [...state.messages, new AIMessage({ content: executionResult.content })],
        executionTrace: [...state.executionTrace, `Executed sub-goal: ${subGoal.description}`],
      };
    } catch (error) {
      this.taskLogger.logAction("Error executing sub-goal", { error: String(error) });
      
      // If there's no task in the state, just return error
      if (!state.task) {
        return {
          ...state,
          error: `Error executing sub-goal: ${error}`,
          executionTrace: [...state.executionTrace, `Error executing sub-goal: ${error}`],
        };
      }
      
      // If execution fails, mark the current sub-goal as failed
      const currentSubGoalId = state.task.currentSubGoalId;
      if (currentSubGoalId) {
        const subGoalIndex = state.task.subGoals.findIndex(sg => sg.id === currentSubGoalId);
        if (subGoalIndex !== -1) {
          const updatedSubGoals = [...state.task.subGoals];
          updatedSubGoals[subGoalIndex] = {
            ...updatedSubGoals[subGoalIndex],
            status: 'failed',
            result: `Failed: ${error}`
          };
          
          return {
            ...state,
            task: {
              ...state.task,
              subGoals: updatedSubGoals,
            },
            executionTrace: [...state.executionTrace, `Failed to execute sub-goal: ${error}`],
          };
        }
      }
      
      return {
        ...state,
        error: `Error executing sub-goal: ${error}`,
        executionTrace: [...state.executionTrace, `Error executing sub-goal: ${error}`],
      };
    }
  }

  /**
   * Node for reflecting on progress and potentially adjusting the plan
   */
  private async reflectOnProgressNode(state: PlanningState): Promise<PlanningState> {
    try {
      if (!state.task) {
        throw new Error("Task not found in state");
      }
      
      this.taskLogger.logAction("Reflecting on progress");
      
      // Count completed and failed sub-goals
      const completedCount = state.task.subGoals.filter(sg => sg.status === 'completed').length;
      const failedCount = state.task.subGoals.filter(sg => sg.status === 'failed').length;
      const pendingCount = state.task.subGoals.filter(sg => sg.status === 'pending').length;
      
      // Create reflection prompt
      const reflectionPrompt = ChatPromptTemplate.fromTemplate(`
You are Chloe, a sophisticated marketing assistant. You're working on the following goal:

GOAL: {goal}

CURRENT PROGRESS:
- Completed sub-goals: {completedCount}
- Failed sub-goals: {failedCount}
- Pending sub-goals: {pendingCount}

SUB-GOAL DETAILS:
{subGoalDetails}

Reflect on the current progress:
1. Evaluate what's working well and what challenges have been encountered
2. Identify any adjustments needed to the remaining sub-goals
3. Determine if any new sub-goals should be added based on what you've learned so far

Your response should be structured as valid JSON matching this schema:
{
  "reflection": "Your reflective analysis of progress so far",
  "adjustNeeded": boolean,
  "adjustments": [
    {
      "subGoalId": "id of sub-goal to adjust (only for existing ones)",
      "action": "modify", // or "add" for new sub-goals
      "description": "New description if modifying or adding",
      "priority": number,
      "reasoning": "Why this adjustment is necessary"
    }
  ]
}
`);
      
      // Format sub-goal details
      const subGoalDetails = state.task.subGoals.map(sg => 
        `- ID: ${sg.id}\n  Description: ${sg.description}\n  Status: ${sg.status}\n  ${sg.result ? `Result: ${sg.result.substring(0, 100)}...` : ''}`
      ).join("\n\n");
      
      // Generate reflection
      const reflectionResult = await reflectionPrompt.pipe(this.model).invoke({
        goal: state.goal,
        completedCount,
        failedCount,
        pendingCount,
        subGoalDetails
      });
      
      let reflectionData: { reflection: string; adjustNeeded: boolean; adjustments?: any[] };
      try {
        // Extract the JSON part from the LLM response
        const jsonMatch = reflectionResult.content.match(/```json\n([\s\S]*?)\n```/) || 
                         reflectionResult.content.match(/```\n([\s\S]*?)\n```/) || 
                         reflectionResult.content.match(/\{[\s\S]*\}/);
                         
        const jsonString = jsonMatch ? jsonMatch[0] : reflectionResult.content;
        reflectionData = JSON.parse(jsonString);
      } catch (e) {
        // Fallback if JSON parsing fails
        this.taskLogger.logAction("Error parsing JSON from reflection response", { error: String(e) });
        reflectionData = {
          reflection: "Progress is being made on the task.",
          adjustNeeded: false
        };
      }
      
      // Save reflection to memory
      await this.memory.addMemory(
        reflectionData.reflection,
        'thought' as ChloeMemoryType,
        'medium',
        'chloe',
        `Reflection on progress for goal: ${state.goal}`,
        ['reflection', 'task', state.goal]
      );
      
      // If adjustments are needed, update the plan
      if (reflectionData.adjustNeeded && reflectionData.adjustments && reflectionData.adjustments.length > 0) {
        const updatedSubGoals = [...state.task.subGoals];
        
        // Apply the adjustments
        for (const adjustment of reflectionData.adjustments) {
          if (adjustment.action === 'modify' && adjustment.subGoalId) {
            // Modify existing sub-goal
            const index = updatedSubGoals.findIndex(sg => sg.id === adjustment.subGoalId);
            if (index !== -1 && updatedSubGoals[index].status === 'pending') {
              updatedSubGoals[index] = {
                ...updatedSubGoals[index],
                description: adjustment.description || updatedSubGoals[index].description,
                priority: adjustment.priority || updatedSubGoals[index].priority,
                reasoning: adjustment.reasoning || updatedSubGoals[index].reasoning
              };
            }
          } else if (adjustment.action === 'add') {
            // Add new sub-goal
            updatedSubGoals.push({
              id: `goal_${Math.random().toString(36).substring(2, 7)}`,
              description: adjustment.description,
              priority: adjustment.priority || 3,
              status: 'pending',
              reasoning: adjustment.reasoning
            });
          }
        }
        
        // Sort the updated sub-goals by priority
        updatedSubGoals.sort((a, b) => {
          // Completed or failed sub-goals stay in their original position
          if (a.status !== 'pending' && b.status === 'pending') return -1;
          if (a.status === 'pending' && b.status !== 'pending') return 1;
          if (a.status !== 'pending' && b.status !== 'pending') return 0;
          
          // Sort pending sub-goals by priority
          return a.priority - b.priority;
        });
        
        // Create a message about the plan adjustment
        const adjustmentMessage = new AIMessage({
          content: `I've reflected on our progress and made some adjustments to the plan:\n\n` +
            reflectionData.reflection + "\n\n" +
            reflectionData.adjustments.map(adj => 
              adj.action === 'modify' 
                ? `- Modified: ${adj.description} (Reason: ${adj.reasoning})`
                : `- Added: ${adj.description} (Reason: ${adj.reasoning})`
            ).join('\n')
        });
        
        return {
          ...state,
          task: {
            ...state.task,
            subGoals: updatedSubGoals
          },
          messages: [...state.messages, adjustmentMessage],
          executionTrace: [...state.executionTrace, "Adjusted plan based on reflection"],
        };
      }
      
      // No adjustments needed, just add a simple reflection message
      const simpleReflection = reflectionData.reflection.split('\n')[0]; // Just the first line for brevity
      
      return {
        ...state,
        executionTrace: [...state.executionTrace, `Reflection: ${simpleReflection}`],
      };
    } catch (error) {
      this.taskLogger.logAction("Error in reflection", { error: String(error) });
      return {
        ...state,
        executionTrace: [...state.executionTrace, `Error in reflection: ${error}`],
      };
    }
  }

  /**
   * Router function for conditional edges after decision node
   */
  private routeAfterDecision(state: PlanningState): string {
    if (state.error) {
      return "failed";
    }
    
    if (state.task?.status === 'executing') {
      return "execute";
    }
    
    return "complete";
  }
}

/**
 * Helper function to create a ChloeGraph instance
 */
export function createChloeGraph(
  model: ChatOpenAI,
  memory: ChloeMemory,
  taskLogger: TaskLogger,
  tools: Record<string, any> = {}
): ChloeGraph {
  return new ChloeGraph(model, memory, taskLogger, tools);
} 