/**
 * Visualization types
 * Contains all type definitions for the visualization system
 */
import { ThinkingResult } from '../types';

/**
 * Node types in the thinking visualization
 */
export enum VisualizationNodeType {
  START = 'start',
  CONTEXT_RETRIEVAL = 'context_retrieval',
  THINKING = 'thinking',
  DELEGATION_DECISION = 'delegation_decision',
  TOOL_SELECTION = 'tool_selection',
  TOOL_EXECUTION = 'tool_execution',
  RESPONSE_GENERATION = 'response_generation',
  END = 'end',
  ERROR = 'error',
  REFLECTION = 'reflection',
  PLANNING = 'planning',
  INSIGHT = 'insight',
  DECISION = 'decision'
}

/**
 * Edge types in the thinking visualization
 */
export enum VisualizationEdgeType {
  FLOW = 'flow',
  DEPENDENCY = 'dependency',
  ERROR = 'error',
  INFLUENCE = 'influence',
  CAUSE = 'cause'
}

/**
 * Node in the thinking process visualization
 */
export interface VisualizationNode {
  id: string;
  type: VisualizationNodeType;
  label: string;
  data: Record<string, any>;
  metrics?: {
    startTime?: number;
    endTime?: number;
    duration?: number;
  };
  status: 'pending' | 'in_progress' | 'completed' | 'error';
}

/**
 * Edge in the thinking process visualization
 */
export interface VisualizationEdge {
  id: string;
  type: VisualizationEdgeType;
  source: string;
  target: string;
  label?: string;
}

/**
 * Complete visualization of a thinking process
 */
export interface ThinkingVisualization {
  id: string;
  requestId: string;
  userId: string;
  agentId: string;
  chatId: string;
  messageId?: string;
  message: string;
  timestamp: number;
  nodes: VisualizationNode[];
  edges: VisualizationEdge[];
  metrics: {
    totalDuration: number;
    startTime: number;
    endTime: number;
  };
  response?: string;
  thinking?: ThinkingResult;
}

/**
 * Visualization metadata schema
 */
export interface VisualizationMetadata {
  schemaVersion: string;
  chatId: string;
  messageId?: string | null;
  userId: string;
  agentId: string;
  visualization: ThinkingVisualization;
  timestamp_ms: number;
  source: string;
  importance_score: number;
} 