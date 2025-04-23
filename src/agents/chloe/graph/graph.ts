/**
 * A simplified implementation of the LangGraph workflow for Chloe's autonomy loop
 * This version avoids direct dependencies on LangGraph/StateGraph that are causing issues
 */

import { ChloeMemory } from '../memory';
import { TaskLogger } from '../task-logger';

// Types for the graph state
export interface GraphState {
  input: string;
  plan: Array<{
    task: string;
    tool: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
  }>;
  currentTaskIndex: number;
  toolOutputs: Record<string, string>;
  reflections: string[];
  messages: string[];
  finalOutput?: string;
  error?: string;
  humanApproval?: boolean;
  waitingForHuman?: boolean;
}

// Tool mapping
export interface ToolMapping {
  [key: string]: (input: string) => Promise<string>;
}

/**
 * Creates a workflow for Chloe's autonomous planning and execution
 * This is a simplified version that doesn't rely on LangGraph
 */
export class ChloeGraph {
  private model: any;
  private memory: ChloeMemory;
  private taskLogger: TaskLogger;
  private tools: ToolMapping;
  private autonomyMode: boolean = false;
  private requireApproval: boolean = true;
  private currentState: GraphState | null = null;

  constructor(
    model: any,
    memory: ChloeMemory,
    taskLogger: TaskLogger,
    tools: ToolMapping,
    options?: {
      autonomyMode?: boolean;
      requireApproval?: boolean;
    }
  ) {
    this.model = model;
    this.memory = memory;
    this.taskLogger = taskLogger;
    this.tools = tools;
    
    if (options) {
      this.autonomyMode = options.autonomyMode ?? false;
      this.requireApproval = options.requireApproval ?? true;
    }
  }

  /**
   * Create and generate a plan for the given input
   */
  private async createPlan(input: string): Promise<Array<{ task: string; tool: string; status: 'pending' }>> {
    try {
      const prompt = `
        You are Chloe, a sophisticated marketing AI agent. Your task is to create a detailed plan for the following goal:
        
        GOAL: ${input}
        
        Break this down into a sequence of 3-7 distinct tasks. For each task:
        1. Be specific about what needs to be accomplished
        2. Choose a tool from this list that is best suited for the task:
        - search_memory: Find relevant information in your memory
        - summarize_recent_activity: Summarize your recent actions
        - propose_content_ideas: Generate creative content ideas
        - reflect_on_performance: Analyze and reflect on past performance
        - notify_discord: Send a notification to the team on Discord
        
        FORMAT YOUR RESPONSE AS A JSON ARRAY of objects with 'task' and 'tool' fields:
        [
          {"task": "Detailed description of task 1", "tool": "tool_name_from_list"},
          {"task": "Detailed description of task 2", "tool": "tool_name_from_list"},
          ...
        ]
      `;
      
      // Ask the model to generate a plan
      const response = await this.model.invoke(prompt);
      const planText = response.content.toString();
      
      // Try to parse the plan as JSON
      try {
        // Extract JSON if the response includes extra text
        // Use a more compatible approach instead of the 's' flag
        const jsonRegex = /\[\s*\{[^]*\}\s*\]/;
        const jsonMatch = planText.match(jsonRegex);
        const jsonStr = jsonMatch ? jsonMatch[0] : planText;
        
        const plan = JSON.parse(jsonStr);
        
        // Validate and format the plan
        if (Array.isArray(plan) && plan.length > 0) {
          return plan.map(item => ({
            task: item.task || "Undefined task",
            tool: item.tool || "search_memory",
            status: 'pending' as const
          }));
        }
      } catch (error) {
        console.error("Error parsing plan:", error);
      }
      
      // Fallback plan if parsing fails
      return [
        {
          task: "Analyze the requested goal",
          tool: "search_memory",
          status: 'pending' as const
        },
        {
          task: "Generate response to the goal",
          tool: "propose_content_ideas",
          status: 'pending' as const
        }
      ];
    } catch (error) {
      console.error("Error creating plan:", error);
      
      // Return a minimal fallback plan
      return [
        {
          task: "Understand the goal",
          tool: "search_memory",
          status: 'pending' as const
        },
        {
          task: "Create content for the goal",
          tool: "propose_content_ideas",
          status: 'pending' as const
        }
      ];
    }
  }

  /**
   * Execute a single task using the appropriate tool
   */
  private async executeTask(state: GraphState): Promise<GraphState> {
    const currentTask = state.plan[state.currentTaskIndex];
    
    // Mark task as in progress
    currentTask.status = 'in_progress';
    
    try {
      // Check if we have this tool
      if (!this.tools[currentTask.tool]) {
        const errorMsg = `Tool "${currentTask.tool}" not found`;
        console.error(errorMsg);
        currentTask.status = 'failed';
        
        return {
          ...state,
          toolOutputs: {
            ...state.toolOutputs,
            [currentTask.task]: `ERROR: ${errorMsg}`
          },
          messages: [...state.messages, errorMsg]
        };
      }
      
      // Execute the tool
      console.log(`Executing tool "${currentTask.tool}" for task: ${currentTask.task}`);
      const result = await this.tools[currentTask.tool](currentTask.task);
      
      // Update task status
      currentTask.status = 'completed';
      
      // Store the result
      const updatedOutputs = {
        ...state.toolOutputs,
        [currentTask.task]: result
      };
      
      // Log the completion
      const message = `Completed task "${currentTask.task}" with tool "${currentTask.tool}"`;
      
      return {
        ...state,
        plan: [...state.plan], // Clone to ensure it's a new array
        toolOutputs: updatedOutputs,
        messages: [...state.messages, message]
      };
    } catch (error) {
      console.error("Error in executor:", error);
      currentTask.status = 'failed';
      
      return {
        ...state,
        plan: [...state.plan], // Clone to ensure it's a new array
        toolOutputs: {
          ...state.toolOutputs,
          [currentTask.task]: `ERROR: ${error instanceof Error ? error.message : String(error)}`
        },
        messages: [...state.messages, `Failed to execute task: ${error instanceof Error ? error.message : String(error)}`],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Generate a reflection for the completed task
   */
  private async generateReflection(state: GraphState): Promise<string> {
    const currentTask = state.plan[state.currentTaskIndex];
    const result = state.toolOutputs[currentTask.task] || "No result produced";
    
    const prompt = `
      You are analyzing the result of a completed task in an autonomous workflow.
      
      TASK: ${currentTask.task}
      TOOL USED: ${currentTask.tool}
      RESULT: ${result}
      
      Based on this outcome, provide a brief reflection (1-2 sentences) on:
      1. Was the task completed successfully?
      2. What was learned or accomplished?
      3. What should be considered for future similar tasks?
      
      Keep your reflection concise and insightful.
    `;
    
    try {
      const response = await this.model.invoke(prompt);
      return response.content.toString();
    } catch (error) {
      console.error("Error generating reflection:", error);
      return "Unable to generate reflection due to an error.";
    }
  }

  /**
   * Generate a summary for the completed plan
   */
  private async generateSummary(state: GraphState): Promise<string> {
    // Create a summary of the plan with status
    const planSummary = state.plan.map((task, index) => {
      const output = state.toolOutputs[task.task] || "No output";
      const outputSummary = output.length > 100 ? `${output.substring(0, 100)}...` : output;
      return `${index + 1}. ${task.task} (${task.status})\n   Tool: ${task.tool}\n   Result: ${outputSummary}`;
    }).join("\n\n");
    
    // Join reflections
    const reflectionsText = state.reflections.length > 0
      ? state.reflections.join("\n\n")
      : "No reflections recorded.";
    
    const prompt = `
      You are Chloe, a sophisticated marketing AI agent. You have completed a series of tasks for the following goal:
      
      GOAL: ${state.input}
      
      PLAN AND OUTCOMES:
      ${planSummary}
      
      REFLECTIONS:
      ${reflectionsText}
      
      Provide a concise summary of what was accomplished and any key insights.
      Keep your response under 200 words and focus on the most important results and next steps.
    `;
    
    try {
      const response = await this.model.invoke(prompt);
      return response.content.toString();
    } catch (error) {
      console.error("Error generating summary:", error);
      return "Unable to generate a complete summary due to an error.";
    }
  }

  /**
   * Set human approval for a waiting task
   */
  public setHumanApproval(approved: boolean): void {
    if (this.currentState && this.currentState.waitingForHuman) {
      this.currentState = {
        ...this.currentState,
        humanApproval: approved,
        waitingForHuman: false
      };
    }
  }

  /**
   * Execute the workflow with a given input
   */
  public async execute(input: string): Promise<GraphState> {
    try {
      // Initialize the state
      this.currentState = {
        input,
        plan: [],
        currentTaskIndex: 0,
        toolOutputs: {},
        reflections: [],
        messages: [],
        waitingForHuman: false
      };
      
      // Generate a plan
      this.currentState.plan = await this.createPlan(input);
      this.currentState.messages.push(`Created plan with ${this.currentState.plan.length} tasks`);
      
      // Execute each task in the plan
      while (this.currentState.currentTaskIndex < this.currentState.plan.length) {
        const currentTask = this.currentState.plan[this.currentState.currentTaskIndex];
        
        // Check if approval is needed
        if (this.requireApproval && !this.autonomyMode) {
          this.currentState = {
            ...this.currentState,
            waitingForHuman: true,
            messages: [...this.currentState.messages, `Waiting for approval on task: ${currentTask.task}`]
          };
          
          console.log("Waiting for human approval...");
          console.log(`Task: ${currentTask.task}`);
          console.log(`Tool: ${currentTask.tool}`);
          
          // In autonomous mode, auto-approve
          if (this.autonomyMode) {
            this.currentState = {
              ...this.currentState,
              humanApproval: true,
              waitingForHuman: false,
              messages: [...this.currentState.messages, "Auto-approved (autonomy mode)"]
            };
          } else {
            // In real implementation, we'd wait for setHumanApproval to be called
            // For now, we'll auto-approve to simulate
            this.currentState = {
              ...this.currentState,
              humanApproval: true,
              waitingForHuman: false,
              messages: [...this.currentState.messages, "[SIMULATED] Task approved by human"]
            };
          }
          
          // If rejected, stop execution
          if (this.currentState.humanApproval === false) {
            this.currentState = {
              ...this.currentState,
              messages: [...this.currentState.messages, "Task rejected by human, stopping execution"]
            };
            break;
          }
        }
        
        // Execute the task
        this.currentState = await this.executeTask(this.currentState);
        
        // Generate reflection
        const reflection = await this.generateReflection(this.currentState);
        
        // Add reflection to memory
        try {
          await this.memory.addMemory(
            reflection,
            'reflection',
            'medium',
            'chloe',
            `Task: ${currentTask.task}`,
            ['reflection', currentTask.tool]
          );
        } catch (error) {
          console.error("Error adding reflection to memory:", error);
        }
        
        // Log the reflection
        this.taskLogger.logAction("Task reflection", {
          task: currentTask.task,
          tool: currentTask.tool,
          reflection
        });
        
        // Add reflection to state
        this.currentState = {
          ...this.currentState,
          reflections: [...this.currentState.reflections, reflection],
          currentTaskIndex: this.currentState.currentTaskIndex + 1,
          messages: [...this.currentState.messages, `Reflection: ${reflection}`]
        };
      }
      
      // Generate the summary
      const summary = await this.generateSummary(this.currentState);
      
      // Add summary to memory
      try {
        await this.memory.addMemory(
          summary,
          'execution_summary',
          'high',
          'chloe',
          `Goal: ${input}`,
          ['summary', 'execution']
        );
      } catch (error) {
        console.error("Error adding summary to memory:", error);
      }
      
      // Log the summary
      this.taskLogger.logAction("Execution summary", {
        goal: input,
        summary
      });
      
      // Update state with final summary
      this.currentState = {
        ...this.currentState,
        finalOutput: summary,
        messages: [...this.currentState.messages, `Final summary: ${summary}`]
      };
      
      return this.currentState;
    } catch (error) {
      console.error("Error in execute:", error);
      
      // Create error state
      return {
        input,
        plan: [],
        currentTaskIndex: 0,
        toolOutputs: {},
        reflections: [],
        messages: [`Error executing workflow: ${error instanceof Error ? error.message : String(error)}`],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
} 