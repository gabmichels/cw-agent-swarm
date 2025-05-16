import { ThinkingResult } from '../types';
import { UnifiedAgentResponse } from '../UnifiedAgentService';
import { IdGenerator } from '@/utils/ulid';

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
  ERROR = 'error'
}

/**
 * Edge types in the thinking visualization
 */
export enum VisualizationEdgeType {
  FLOW = 'flow',
  DEPENDENCY = 'dependency',
  ERROR = 'error'
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
 * Service for generating and storing visualizations of the thinking process
 */
export class ThinkingVisualizer {
  /**
   * Store of visualizations by requestId
   */
  private visualizations: Map<string, ThinkingVisualization> = new Map();

  /**
   * Temporary store of in-progress visualizations
   */
  private activeVisualizations: Map<string, ThinkingVisualization> = new Map();

  /**
   * Initializes a new visualization for a request
   * 
   * @param requestId The request ID
   * @param userId The user ID
   * @param message The user message
   * @returns The visualization ID
   */
  initializeVisualization(requestId: string, userId: string, message: string): string {
    const visualization: ThinkingVisualization = {
      id: IdGenerator.generateString('viz'),
      requestId,
      userId,
      message,
      timestamp: Date.now(),
      nodes: [
        {
          id: IdGenerator.generateString('node'),
          type: VisualizationNodeType.START,
          label: 'Start Processing',
          data: {
            message
          },
          metrics: {
            startTime: Date.now()
          },
          status: 'completed'
        }
      ],
      edges: [],
      metrics: {
        totalDuration: 0,
        startTime: Date.now(),
        endTime: 0
      }
    };

    this.activeVisualizations.set(requestId, visualization);
    return visualization.id;
  }

  /**
   * Adds a node to the visualization
   * 
   * @param requestId The request ID
   * @param type The node type
   * @param label The node label
   * @param data Additional data for the node
   * @returns The node ID
   */
  addNode(
    requestId: string,
    type: VisualizationNodeType,
    label: string,
    data: Record<string, any> = {}
  ): string {
    const visualization = this.activeVisualizations.get(requestId);
    if (!visualization) {
      throw new Error(`No active visualization found for request ${requestId}`);
    }

    const nodeId = IdGenerator.generateString('node');
    const node: VisualizationNode = {
      id: nodeId,
      type,
      label,
      data,
      metrics: {
        startTime: Date.now()
      },
      status: 'in_progress'
    };

    visualization.nodes.push(node);

    // If this isn't the first node, add an edge from the previous node
    if (visualization.nodes.length > 1) {
      const previousNode = visualization.nodes[visualization.nodes.length - 2];
      const edge: VisualizationEdge = {
        id: IdGenerator.generateString('edge'),
        type: VisualizationEdgeType.FLOW,
        source: previousNode.id,
        target: nodeId
      };
      visualization.edges.push(edge);
    }

    return nodeId;
  }

  /**
   * Finalizes the visualization with the complete response
   * 
   * @param requestId The request ID
   * @param response The agent response
   */
  finalizeVisualization(requestId: string, response: UnifiedAgentResponse): void {
    const visualization = this.activeVisualizations.get(requestId);
    if (!visualization) {
      throw new Error(`No active visualization found for request ${requestId}`);
    }

    // Add end node
    const endNodeId = this.addNode(
      requestId,
      VisualizationNodeType.END,
      'Processing Complete',
      {
        response: response.response,
        metrics: response.metrics
      }
    );

    // Complete the end node
    const endNode = visualization.nodes.find(n => n.id === endNodeId);
    if (endNode) {
      endNode.status = 'completed';
      endNode.metrics = {
        ...endNode.metrics,
        endTime: Date.now(),
        duration: endNode.metrics?.startTime ? Date.now() - endNode.metrics.startTime : 0
      };
    }

    // Update visualization metrics
    visualization.metrics.endTime = Date.now();
    visualization.metrics.totalDuration = visualization.metrics.endTime - visualization.metrics.startTime;
    
    // Add response information
    visualization.response = response.response;
    visualization.thinking = response.thinking;

    // Move from active to stored visualizations
    this.visualizations.set(requestId, visualization);
    this.activeVisualizations.delete(requestId);
  }

  /**
   * Handles an error in the visualization
   * 
   * @param requestId The request ID
   * @param error The error that occurred
   */
  handleError(requestId: string, error: Error): void {
    const visualization = this.activeVisualizations.get(requestId);
    if (!visualization) {
      // Create a new visualization if none exists
      const viz: ThinkingVisualization = {
        id: IdGenerator.generateString('viz'),
        requestId,
        userId: 'unknown',
        message: 'Unknown message',
        timestamp: Date.now(),
        nodes: [
          {
            id: IdGenerator.generateString('node'),
            type: VisualizationNodeType.START,
            label: 'Start Processing',
            data: {},
            status: 'completed'
          },
          {
            id: IdGenerator.generateString('node'),
            type: VisualizationNodeType.ERROR,
            label: 'Error Occurred',
            data: {
              error: {
                message: error.message,
                stack: error.stack
              }
            },
            status: 'error'
          }
        ],
        edges: [],
        metrics: {
          totalDuration: 0,
          startTime: Date.now(),
          endTime: Date.now()
        }
      };

      // Create edge between nodes
      const startNode = viz.nodes[0];
      const errorNode = viz.nodes[1];
      viz.edges = [
        {
          id: IdGenerator.generateString('edge'),
          type: VisualizationEdgeType.ERROR,
          source: startNode.id,
          target: errorNode.id
        }
      ];

      this.visualizations.set(requestId, viz);
      return;
    }

    // Add error node
    const errorNodeId = this.addNode(
      requestId,
      VisualizationNodeType.ERROR,
      'Error Occurred',
      {
        error: {
          message: error.message,
          stack: error.stack
        }
      }
    );

    // Update the error node status
    const errorNode = visualization.nodes.find(n => n.id === errorNodeId);
    if (errorNode) {
      errorNode.status = 'error';
      errorNode.metrics = {
        ...errorNode.metrics,
        endTime: Date.now(),
        duration: errorNode.metrics?.startTime ? Date.now() - errorNode.metrics.startTime : 0
      };
    }

    // Update visualization metrics
    visualization.metrics.endTime = Date.now();
    visualization.metrics.totalDuration = visualization.metrics.endTime - visualization.metrics.startTime;

    // Move from active to stored visualizations
    this.visualizations.set(requestId, visualization);
    this.activeVisualizations.delete(requestId);
  }

  /**
   * Gets the visualization for a request
   * 
   * @param requestId The request ID
   * @returns The visualization or null if not found
   */
  getVisualization(requestId: string): ThinkingVisualization | null {
    // Check in active visualizations first
    const activeViz = this.activeVisualizations.get(requestId);
    if (activeViz) {
      return activeViz;
    }

    // Then check in stored visualizations
    return this.visualizations.get(requestId) || null;
  }

  /**
   * Gets all visualizations
   * 
   * @returns All visualizations
   */
  getAllVisualizations(): ThinkingVisualization[] {
    return Array.from(this.visualizations.values());
  }
} 