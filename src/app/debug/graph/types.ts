/**
 * Types for the debug/graph page
 */

export interface SubGoal {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  reasoning?: string;
  result?: string;
  timestamp?: string;
}

export interface PlanningTask {
  goal: string;
  subGoals: SubGoal[];
  reasoning: string;
  status: 'planning' | 'executing' | 'completed' | 'failed';
}

export interface ExecutionTrace {
  step: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  status: 'success' | 'error' | 'info' | 'simulated';
  details?: any;
}

export interface PlanningState {
  goal: string;
  task?: PlanningTask;
  executionTrace: ExecutionTrace[];
  finalResult?: string;
  error?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type?: string;
  description?: string;
  metadata?: any;
  tags?: string[];
}

export interface GraphEdge {
  id?: string;
  from: string;
  to: string;
  type?: string;
  label?: string;
  strength?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface TraceToKnowledgeMapping {
  traceStepId: string;
  relevantNodeIds: string[];
  relevantEdgeIds: string[];
  confidenceScore: number;
  explanation?: string;
} 