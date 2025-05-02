/**
 * Shared types for the services directory
 */

// Import the types from the app directory to ensure consistency
import { 
  ExecutionTrace as AppExecutionTrace,
  GraphNode as AppGraphNode,
  GraphEdge as AppGraphEdge,
  TraceToKnowledgeMapping as AppTraceToKnowledgeMapping
} from '../app/debug/graph/types';

// Re-export the types to be used in the services
export type ExecutionTrace = AppExecutionTrace;
export type GraphNode = AppGraphNode;
export type GraphEdge = AppGraphEdge;
export type TraceToKnowledgeMapping = AppTraceToKnowledgeMapping; 