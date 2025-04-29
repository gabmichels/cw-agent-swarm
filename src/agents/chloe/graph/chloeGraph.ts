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
import {
  planTaskNode,
  decideNextStepNode,
  executeStepNode,
  reflectOnProgressNode,
  finalizeNode,
  PlanningState,
  PlanningTask,
  SubGoal,
  NodeContext
} from "./nodes";

/**
 * ChloeGraph - A state graph implementation for Chloe's planning and execution system.
 * This provides a more structured way to organize the planning workflow, 
 * with clear state transitions and node functionality.
 */
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
  
  /**
   * Initialize the ChloeGraph with required components
   */
  constructor({
    model,
    memory,
    taskLogger,
    tools = {},
    dryRun = false
  }: {
    model: ChatOpenAI;
    memory: ChloeMemory;
    taskLogger: TaskLogger;
    tools?: Record<string, any>;
    dryRun?: boolean;
  }) {
    this.model = model;
    this.memory = memory;
    this.taskLogger = taskLogger;
    this.tools = tools;
    this.dryRun = dryRun;
    
    if (dryRun) {
      this.taskLogger.logAction('ChloeGraph initialized in DRY RUN mode');
    }
    
    // Create the node context that will be passed to each node
    const nodeContext: NodeContext = {
      model: this.model,
      memory: this.memory,
      taskLogger: this.taskLogger,
      tools: this.tools,
      dryRun: this.dryRun
    };
    
    // Initialize the state graph
    this.graph = this.buildGraph(nodeContext);
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
        finalize: 'finalize'
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
      
      return result;
    } catch (error) {
      this.taskLogger.logAction('Error in planning graph execution', { 
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }
}

/**
 * Helper function to create a new ChloeGraph instance
 */
export function createChloeGraph({
  model,
  memory,
  taskLogger,
  tools = {},
  dryRun = false
}: {
  model: ChatOpenAI;
  memory: ChloeMemory;
  taskLogger: TaskLogger;
  tools?: Record<string, any>;
  dryRun?: boolean;
}): ChloeGraph {
  return new ChloeGraph({
    model,
    memory,
    taskLogger,
    tools,
    dryRun
  });
}

// Re-export types from nodes
export type { PlanningState, SubGoal, PlanningTask }; 