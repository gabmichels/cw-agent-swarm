/**
 * Workflow graph for Chloe's planning and execution
 */

import { StateGraph } from "@langchain/langgraph";
import { PlanningState, NodeContext } from "./nodes/types";
import { planTaskNode } from "./nodes/planTaskNode";
import { decisionNode } from "./nodes/decisionNode";
import { handleToolFailureNode } from "./nodes/handleToolFailureNode";

// Import only the nodes we have files for
import { executeStepNode } from "./nodes/executeStepNode";

/**
 * Creates a simplified workflow graph for planning and execution
 * 
 * @param context The node execution context
 * @returns A workflow state graph
 */
export function createWorkflowGraph(context: NodeContext): StateGraph<PlanningState> {
  // Create the graph with proper state definition
  const graph = new StateGraph<PlanningState>({ channels: {} });

  // Add the execution nodes we have implemented
  graph.addNode("plan-task", async (state: PlanningState) => planTaskNode(state, context));
  graph.addNode("execute-step", async (state: PlanningState) => executeStepNode(state, context));
  graph.addNode("handle-tool-failure", async (state: PlanningState) => handleToolFailureNode(state, context));

  // Add simple flow
  graph.addEdge("plan-task", "execute-step");
  graph.addEdge("execute-step", "handle-tool-failure");
  
  // Set the entry point (using addEdge instead of deprecated setEntryPoint)
  graph.addEdge("__start__", "plan-task");

  return graph;
} 