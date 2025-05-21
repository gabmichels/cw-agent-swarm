/**
 * Visualization system type definitions
 * Contains interfaces and types for the thinking visualization system
 */

/**
 * Visualization context interface
 * Used to pass visualization context between components
 */
export interface VisualizationContext {
  /**
   * The request ID
   */
  requestId: string;
  
  /**
   * The chat ID
   */
  chatId: string;
  
  /**
   * The message ID (optional)
   */
  messageId?: string;
  
  /**
   * The user ID
   */
  userId: string;
  
  /**
   * The agent ID
   */
  agentId: string;
  
  /**
   * The current node ID
   */
  currentNodeId?: string;
  
  /**
   * The parent node ID
   */
  parentNodeId?: string;
}

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
  DECISION = 'decision',
  MEMORY_RETRIEVAL = 'memory_retrieval'
}

/**
 * Edge types in the thinking visualization
 */
export enum VisualizationEdgeType {
  FLOW = 'flow',
  DEPENDENCY = 'dependency',
  ERROR = 'error',
  INFLUENCE = 'influence',
  CAUSE = 'cause',
  NEXT = 'next',
  CHILD = 'child'
}

/**
 * Node in the thinking process visualization
 */
export interface VisualizationNode {
  id: string;
  type: VisualizationNodeType | string;
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
  type: VisualizationEdgeType | string;
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
  thinking?: any;
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

/**
 * Visualization service interface
 */
export interface VisualizationService {
  /**
   * Create a new visualization
   */
  createVisualization(context: VisualizationContext): ThinkingVisualization;
  
  /**
   * Add a node to a visualization
   */
  addNode(
    visualization: ThinkingVisualization,
    type: VisualizationNodeType | string,
    label: string,
    data: Record<string, any>,
    status: 'pending' | 'in_progress' | 'completed' | 'error'
  ): string;
  
  /**
   * Update a node in a visualization
   */
  updateNode(
    visualization: ThinkingVisualization,
    nodeId: string,
    updates: Partial<{
      label: string;
      data: Record<string, any>;
      status: 'pending' | 'in_progress' | 'completed' | 'error';
    }>
  ): void;
  
  /**
   * Add an edge between nodes
   */
  addEdge(
    visualization: ThinkingVisualization,
    sourceNodeId: string,
    targetNodeId: string,
    type: VisualizationEdgeType | string,
    label?: string
  ): string;
  
  /**
   * Finalize a visualization with response
   */
  finalizeVisualization(
    visualization: ThinkingVisualization,
    response: { id: string; response: string }
  ): void;
  
  /**
   * Store a visualization
   */
  storeVisualization(visualization: ThinkingVisualization): Promise<void>;
} 