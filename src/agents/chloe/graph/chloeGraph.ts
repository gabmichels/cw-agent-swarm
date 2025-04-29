/**
 * Implementation of an advanced LangGraph-style architecture for Chloe's planning system.
 * This is a more sophisticated implementation inspired by LangGraph / LangChain, 
 * but without the external dependencies.
 */

import { ChatOpenAI } from "@langchain/openai";
import { BaseMessage } from "@langchain/core/messages";
import { ChloeMemory } from "../memory";
import { TaskLogger } from "../task-logger";
import { ActionNode, StateGraph } from "../langchain/graph";
import * as fs from 'fs';
import * as path from 'path';
import {
  planTaskNode,
  decideNextStepNode,
  executeStepNode,
  reflectOnProgressNode,
  finalizeNode,
  PlanningState,
  PlanningTask,
  SubGoal,
  NodeContext,
  ExecutionTraceEntry
} from "./nodes";

/**
 * ChloeGraph - A state graph implementation for Chloe's planning and execution system.
 * This provides a more structured way to organize the planning workflow, 
 * with clear state transitions and node functionality.
 */
export interface ChloeGraphOptions {
  model: ChatOpenAI;
  memory: ChloeMemory;
  taskLogger: TaskLogger;
  tools?: Record<string, any>;
  dryRun?: boolean;
}

export class ChloeGraph {
  // Core components
  private model: ChatOpenAI;
  private memory: ChloeMemory;
  private taskLogger: TaskLogger;
  
  // The state graph that defines the planning workflow
  private graph: StateGraph<PlanningState>;
  
  // Tools available to the agent
  private tools: Record<string, any>;
  
  // Flag for dry run mode
  private dryRun: boolean;

  // Directory for execution logs
  private logsDir: string;
  
  /**
   * Create a new ChloeGraph instance
   */
  constructor(options: ChloeGraphOptions) {
    this.model = options.model;
    this.memory = options.memory;
    this.taskLogger = options.taskLogger;
    this.tools = options.tools || {};
    this.dryRun = options.dryRun || false;
    this.logsDir = path.join(process.cwd(), 'logs', 'executions');
    
    if (this.dryRun) {
      this.taskLogger.logAction('ChloeGraph initialized in DRY RUN mode');
    }
    
    // Build the planning graph
    const context: NodeContext = {
      model: this.model,
      memory: this.memory,
      taskLogger: this.taskLogger,
      tools: this.tools,
      dryRun: this.dryRun
    };
    
    this.graph = this.buildGraph(context);
  }
  
  /**
   * Build the core planning graph
   */
  private buildGraph(context: NodeContext): StateGraph<PlanningState> {
    // Create a new state graph with initial state
    const graph = new StateGraph<PlanningState>({
      initialState: {
        goal: '',
        messages: [],
        executionTrace: []
      }
    });
    
    // Create action nodes for each step of the planning process
    const planNode = new ActionNode<PlanningState>({
      name: 'plan_task',
      action: async (state: PlanningState) => planTaskNode(state, context),
      isBlockingOnFailure: true // Planning is critical, so we should block on failure
    });
    
    const decideNextNode = new ActionNode<PlanningState>({
      name: 'decide_next_step',
      action: async (state: PlanningState) => decideNextStepNode(state, context),
      isBlockingOnFailure: true // Decision node is also critical for routing
    });
    
    const executeNode = new ActionNode<PlanningState>({
      name: 'execute_step',
      action: async (state: PlanningState) => executeStepNode(state, context),
      isBlockingOnFailure: false // We can continue to the next step if execution fails
    });
    
    const reflectNode = new ActionNode<PlanningState>({
      name: 'reflect_on_progress',
      action: async (state: PlanningState) => reflectOnProgressNode(state, context),
      isBlockingOnFailure: false // Reflection is optional, we can continue if it fails
    });
    
    const finalizeActionNode = new ActionNode<PlanningState>({
      name: 'finalize',
      action: async (state: PlanningState) => finalizeNode(state, context),
      isBlockingOnFailure: false // Finalization can fail but we still want to return the state
    });
    
    // Add all nodes to the graph
    graph.addNode(planNode);
    graph.addNode(decideNextNode);
    graph.addNode(executeNode);
    graph.addNode(reflectNode);
    graph.addNode(finalizeActionNode);
    
    // Define the edges (transitions) between nodes
    
    // Start -> Plan
    graph.addEdge('start', 'plan_task');
    
    // Plan -> Decide Next
    graph.addEdge('plan_task', 'decide_next_step');
    
    // Decide Next -> various options based on the route field
    graph.addConditionalEdges(
      'decide_next_step',
      (state: PlanningState) => state.route || 'execute',
      {
        execute: 'execute_step',
        reflect: 'reflect_on_progress',
        finalize: 'finalize',
        'request-clarification': 'finalize', // Handle the clarification request by finalizing with questions
        'request-approval': 'finalize' // Handle approval requests by finalizing with approval request
      }
    );
    
    // Execute -> Decide Next (return to decision point)
    graph.addEdge('execute_step', 'decide_next_step');
    
    // Reflect -> Decide Next (return to decision point)
    graph.addEdge('reflect_on_progress', 'decide_next_step');
    
    // Finalize -> End (terminal state)
    graph.addEdge('finalize', 'end');
    
    return graph;
  }
  
  /**
   * Execute a task using the planning graph
   * 
   * @param goal - The goal to achieve
   * @param messages - Optional initial messages for context
   * @returns The final planning state
   */
  async execute(goal: string, messages: BaseMessage[] = []): Promise<PlanningState> {
    this.taskLogger.logAction('Starting planning graph execution', { goal });
    
    try {
      // Set the initial state with the provided goal
      const initialState: PlanningState = {
        goal,
        messages: messages || [],
        executionTrace: []
      };
      
      // Execute the graph from start to end
      const result = await this.graph.invoke(initialState);
      
      this.taskLogger.logAction('Planning graph execution completed', { 
        success: !result.error,
        error: result.error
      });

      // Save execution data to file
      this.saveExecutionData(result);
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : `${error}`;
      this.taskLogger.logAction('Error in planning graph execution', { error: errorMessage });
      
      throw error;
    }
  }

  /**
   * Save execution data to a log file
   * 
   * @param state - The planning state to save
   * @returns The path to the saved file
   */
  saveExecutionData(state: PlanningState): string | null {
    try {
      // Ensure the logs directory exists
      if (!fs.existsSync(this.logsDir)) {
        fs.mkdirSync(this.logsDir, { recursive: true });
      }

      // Create a serializable version of the state
      const serializableState = this.getSerializableState(state);
      
      // Generate a filename with a timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `execution-${timestamp}.json`;
      const filePath = path.join(this.logsDir, fileName);
      
      // Save the file
      fs.writeFileSync(filePath, JSON.stringify(serializableState, null, 2), 'utf-8');
      this.taskLogger.logAction('Saved execution data to file', { filePath });
      
      return filePath;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : `${error}`;
      this.taskLogger.logAction('Error saving execution data', { error: errorMessage });
      return null;
    }
  }

  /**
   * Convert the planning state to a serializable format
   * This handles Date objects and other non-serializable data
   */
  private getSerializableState(state: PlanningState): any {
    // Use a JSON replacer function to handle circular references and Date objects
    const seen = new WeakSet();
    
    // Deep clone the state while handling special cases
    const safeClone = JSON.parse(JSON.stringify(state, (key, value) => {
      // Handle circular references
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      
      // Handle Date objects
      if (value instanceof Date) {
        return value.toISOString();
      }
      
      // Skip methods and functions
      if (typeof value === 'function') {
        return undefined;
      }
      
      return value;
    }));
    
    // Ensure messages are properly formatted
    if (safeClone.messages) {
      safeClone.messages = state.messages.map(msg => ({
        type: msg._getType(),
        content: msg.content
      }));
    }
    
    return safeClone;
  }

  /**
   * Get the execution trace with timing information
   * 
   * @returns Array of execution trace entries with timestamps
   */
  getExecutionTrace(state: PlanningState): ExecutionTraceEntry[] {
    return state.executionTrace;
  }

  /**
   * Get total execution time from the execution trace
   * 
   * @returns Total execution time in milliseconds
   */
  getTotalExecutionTime(state: PlanningState): number {
    const trace = state.executionTrace;
    if (trace.length === 0) return 0;
    
    const firstStart = trace[0].startTime.getTime();
    const lastEnd = trace[trace.length - 1].endTime?.getTime() || Date.now();
    
    return lastEnd - firstStart;
  }
}

/**
 * Helper function to create a new ChloeGraph instance
 */
export function createChloeGraph(options: ChloeGraphOptions): ChloeGraph {
  return new ChloeGraph(options);
}

// Re-export types from nodes
export type { PlanningState, SubGoal, PlanningTask, ExecutionTraceEntry }; 