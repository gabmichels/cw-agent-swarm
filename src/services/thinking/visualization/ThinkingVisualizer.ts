import { ThinkingResult } from '../types';
import { UnifiedAgentResponse } from '../UnifiedAgentService';
import { IdGenerator } from '@/utils/ulid';
import { MemoryService } from '../../../server/memory/services/memory/memory-service';
import { MemoryType } from '../../../server/memory/config';
import { v4 as uuidv4 } from 'uuid';
import { BaseMemorySchema } from '../../../server/memory/models';
import { ImportanceLevel } from '../../../constants/memory';
import { MemoryFilter } from '../../../server/memory/config';
import {
  ThinkingVisualization,
  VisualizationNode,
  VisualizationEdge,
  VisualizationNodeType,
  VisualizationEdgeType,
  VisualizationMetadata
} from './types';

/**
 * Memory schema for visualization storage
 */
interface VisualizationMemorySchema extends BaseMemorySchema {
  metadata: VisualizationMetadata
}

// Collection name for thinking visualizations
const VISUALIZATION_COLLECTION = 'thinking_visualizations';

/**
 * Service for generating and storing visualizations of the thinking process
 */
export class ThinkingVisualizer {
  private memoryService: MemoryService;
  private collection: string;

  /**
   * Create a new ThinkingVisualizer
   * 
   * @param memoryService The memory service to use for storage
   * @param collection Optional custom collection name
   */
  constructor(memoryService: MemoryService, collection: string = VISUALIZATION_COLLECTION) {
    this.memoryService = memoryService;
    this.collection = collection;
  }

  /**
   * Initializes a new visualization for a request
   * 
   * @param requestId The request ID
   * @param userId The user ID
   * @param agentId The agent ID
   * @param chatId The chat ID
   * @param message The user message
   * @param messageId Optional message ID
   * @returns The visualization ID
   */
  initializeVisualization(
    requestId: string, 
    userId: string, 
    agentId: string,
    chatId: string,
    message: string,
    messageId?: string
  ): ThinkingVisualization {
    const visualization: ThinkingVisualization = {
      id: uuidv4(),
      requestId,
      userId,
      agentId,
      chatId,
      messageId,
      message,
      timestamp: Date.now(),
      nodes: [
        {
          id: uuidv4(),
          type: VisualizationNodeType.START,
          label: 'Start Processing',
          data: {
            message,
            chatId,
            userId,
            agentId,
            requestId
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

    return visualization;
  }

  /**
   * Adds a node to the visualization
   * 
   * @param visualization The visualization to modify
   * @param type The node type
   * @param label The node label
   * @param data Additional data for the node
   * @param status The node status
   * @returns The node ID
   */
  addNode(
    visualization: ThinkingVisualization,
    type: VisualizationNodeType,
    label: string,
    data: Record<string, any> = {},
    status: 'pending' | 'in_progress' | 'completed' | 'error' = 'in_progress'
  ): string {
    const nodeId = uuidv4();
    const node: VisualizationNode = {
      id: nodeId,
      type,
      label,
      data,
      metrics: {
        startTime: Date.now()
      },
      status
    };

    visualization.nodes.push(node);

    // If this isn't the first node, add an edge from the previous node
    if (visualization.nodes.length > 1) {
      const previousNode = visualization.nodes[visualization.nodes.length - 2];
      const edge: VisualizationEdge = {
        id: uuidv4(),
        type: VisualizationEdgeType.FLOW,
        source: previousNode.id,
        target: nodeId
      };
      visualization.edges.push(edge);
    }

    return nodeId;
  }

  /**
   * Updates a node in the visualization
   * 
   * @param visualization The visualization to modify
   * @param nodeId The ID of the node to update
   * @param updates The updates to apply
   * @returns Whether the update was successful
   */
  updateNode(
    visualization: ThinkingVisualization,
    nodeId: string,
    updates: Partial<Pick<VisualizationNode, 'label' | 'data' | 'status'>>
  ): boolean {
    const node = visualization.nodes.find(n => n.id === nodeId);
    if (!node) {
      return false;
    }

    // Apply updates
    if (updates.label) {
      node.label = updates.label;
    }
    if (updates.data) {
      node.data = { ...node.data, ...updates.data };
    }
    if (updates.status) {
      node.status = updates.status;
      
      // If the node is completed or has an error, set the end time
      if (updates.status === 'completed' || updates.status === 'error') {
        node.metrics = {
          ...node.metrics,
          endTime: Date.now(),
          duration: node.metrics?.startTime ? Date.now() - node.metrics.startTime : undefined
        };
      }
    }

    return true;
  }

  /**
   * Adds an edge between two nodes
   * 
   * @param visualization The visualization to modify
   * @param sourceId The source node ID
   * @param targetId The target node ID
   * @param type The edge type
   * @param label Optional edge label
   * @returns The edge ID
   */
  addEdge(
    visualization: ThinkingVisualization,
    sourceId: string,
    targetId: string,
    type: VisualizationEdgeType = VisualizationEdgeType.FLOW,
    label?: string
  ): string {
    const edgeId = uuidv4();
    const edge: VisualizationEdge = {
      id: edgeId,
      type,
      source: sourceId,
      target: targetId,
      label
    };

    visualization.edges.push(edge);
    return edgeId;
  }

  /**
   * Adds a thinking node to the visualization
   * 
   * @param visualization The visualization to modify
   * @param label The thinking label
   * @param content The thinking content
   * @param data Additional data for the node
   * @returns The node ID
   */
  addThinkingNode(
    visualization: ThinkingVisualization,
    label: string,
    content: string,
    data: Record<string, any> = {}
  ): string {
    return this.addNode(
      visualization,
      VisualizationNodeType.THINKING,
      label,
      {
        content,
        ...data
      }
    );
  }

  /**
   * Adds a tool selection node to the visualization
   * 
   * @param visualization The visualization to modify
   * @param toolName The selected tool name
   * @param reasoning The tool selection reasoning
   * @param options The tool options considered
   * @returns The node ID
   */
  addToolSelectionNode(
    visualization: ThinkingVisualization,
    toolName: string,
    reasoning: string,
    options: string[] = []
  ): string {
    return this.addNode(
      visualization,
      VisualizationNodeType.TOOL_SELECTION,
      `Selected Tool: ${toolName}`,
      {
        toolName,
        reasoning,
        options
      }
    );
  }

  /**
   * Adds a tool execution node to the visualization
   * 
   * @param visualization The visualization to modify
   * @param toolName The executed tool name
   * @param params The tool parameters
   * @param result The tool execution result
   * @param status The execution status
   * @returns The node ID
   */
  addToolExecutionNode(
    visualization: ThinkingVisualization,
    toolName: string,
    params: Record<string, any>,
    result?: any,
    status: 'in_progress' | 'completed' | 'error' = 'in_progress'
  ): string {
    return this.addNode(
      visualization,
      VisualizationNodeType.TOOL_EXECUTION,
      `Executing: ${toolName}`,
      {
        toolName,
        params,
        result
      },
      status
    );
  }

  /**
   * Adds a delegation decision node to the visualization
   * 
   * @param visualization The visualization to modify
   * @param decision The delegation decision
   * @param reasoning The decision reasoning
   * @param targetAgent The target agent if delegating
   * @returns The node ID
   */
  addDelegationNode(
    visualization: ThinkingVisualization,
    decision: boolean,
    reasoning: string,
    targetAgent?: string
  ): string {
    return this.addNode(
      visualization,
      VisualizationNodeType.DELEGATION_DECISION,
      decision ? `Delegating to ${targetAgent || 'another agent'}` : 'Handling request directly',
      {
        decision,
        reasoning,
        targetAgent
      }
    );
  }

  /**
   * Adds a context retrieval node to the visualization
   * 
   * @param visualization The visualization to modify
   * @param query The retrieval query
   * @param results The retrieval results
   * @param status The retrieval status
   * @returns The node ID
   */
  addContextRetrievalNode(
    visualization: ThinkingVisualization,
    query: string,
    results?: any[],
    status: 'in_progress' | 'completed' | 'error' = 'in_progress'
  ): string {
    return this.addNode(
      visualization,
      VisualizationNodeType.CONTEXT_RETRIEVAL,
      'Retrieving Context',
      {
        query,
        results,
        resultCount: results?.length || 0
      },
      status
    );
  }

  /**
   * Adds a response generation node to the visualization
   * 
   * @param visualization The visualization to modify
   * @param response The generated response
   * @param status The generation status
   * @returns The node ID
   */
  addResponseNode(
    visualization: ThinkingVisualization,
    response?: string,
    status: 'in_progress' | 'completed' | 'error' = 'in_progress'
  ): string {
    return this.addNode(
      visualization,
      VisualizationNodeType.RESPONSE_GENERATION,
      'Generating Response',
      {
        response
      },
      status
    );
  }

  /**
   * Adds a reflection node to the visualization
   * 
   * @param visualization The visualization to modify
   * @param content The reflection content
   * @param reflectionType The reflection type
   * @returns The node ID
   */
  addReflectionNode(
    visualization: ThinkingVisualization,
    content: string,
    reflectionType: string = 'experience'
  ): string {
    return this.addNode(
      visualization,
      VisualizationNodeType.REFLECTION,
      `Reflection: ${reflectionType}`,
      {
        content,
        reflectionType
      }
    );
  }

  /**
   * Adds a planning node to the visualization
   * 
   * @param visualization The visualization to modify
   * @param goal The plan goal
   * @param steps The plan steps
   * @returns The node ID
   */
  addPlanningNode(
    visualization: ThinkingVisualization,
    goal: string,
    steps: string[]
  ): string {
    return this.addNode(
      visualization,
      VisualizationNodeType.PLANNING,
      `Planning: ${goal}`,
      {
        goal,
        steps,
        stepCount: steps.length
      }
    );
  }

  /**
   * Adds an insight node to the visualization
   * 
   * @param visualization The visualization to modify
   * @param content The insight content
   * @param insightType The insight type
   * @returns The node ID
   */
  addInsightNode(
    visualization: ThinkingVisualization,
    content: string,
    insightType: string = 'pattern'
  ): string {
    return this.addNode(
      visualization,
      VisualizationNodeType.INSIGHT,
      `Insight: ${insightType}`,
      {
        content,
        insightType
      }
    );
  }

  /**
   * Finalizes the visualization with the complete response
   * 
   * @param visualization The visualization to finalize
   * @param response The agent response
   * @param thinking The thinking result
   */
  finalizeVisualization(
    visualization: ThinkingVisualization,
    response: UnifiedAgentResponse | string,
    thinking?: ThinkingResult
  ): void {
    // Add end node
    const endNodeId = this.addNode(
      visualization,
      VisualizationNodeType.END,
      'Processing Complete',
      {
        response: typeof response === 'string' ? response : response.response,
        metrics: typeof response === 'string' ? undefined : response.metrics
      },
      'completed'
    );

    // Update visualization metrics
    visualization.metrics.endTime = Date.now();
    visualization.metrics.totalDuration = visualization.metrics.endTime - visualization.metrics.startTime;
    
    // Add response information
    visualization.response = typeof response === 'string' ? response : response.response;
    visualization.thinking = thinking || (typeof response === 'string' ? undefined : response.thinking);
  }

  /**
   * Handles an error in the visualization
   * 
   * @param visualization The visualization to update
   * @param error The error that occurred
   * @param nodeId Optional ID of the node where the error occurred
   */
  handleError(
    visualization: ThinkingVisualization,
    error: Error,
    nodeId?: string
  ): void {
    if (nodeId) {
      // Update the node with the error
      this.updateNode(visualization, nodeId, {
        status: 'error',
        data: {
          error: error.message,
          stack: error.stack
        }
      });
    } else {
      // Add an error node
      this.addNode(
        visualization,
        VisualizationNodeType.ERROR,
        'Error Occurred',
        {
          error: error.message,
          stack: error.stack
        },
        'error'
      );
    }

    // Update visualization metrics
    visualization.metrics.endTime = Date.now();
    visualization.metrics.totalDuration = visualization.metrics.endTime - visualization.metrics.startTime;
  }

  /**
   * Saves the visualization to the memory service
   * 
   * @param visualization The visualization to save
   * @returns Promise resolving to the saved visualization ID
   */
  async saveVisualization(visualization: ThinkingVisualization): Promise<string | null> {
    try {
      // Create visualization-specific metadata directly without using memory metadata helpers
      const metadata: VisualizationMetadata = {
        schemaVersion: '1.0',
        chatId: visualization.chatId,
        messageId: visualization.messageId || null,
        userId: visualization.userId,
        agentId: visualization.agentId,
        visualization: visualization,
        timestamp_ms: visualization.timestamp,
        source: 'thinking_visualization',
        importance_score: ImportanceLevel.MEDIUM
      };

      // Add to memory store
      const result = await this.memoryService.addMemory({
        id: visualization.id,
        type: MemoryType.INSIGHT,
        content: `Thinking visualization for "${visualization.message}"`,
        metadata
      });

      return result.success ? visualization.id : null;
    } catch (error) {
      console.error('Error saving visualization:', error);
      return null;
    }
  }

  /**
   * Gets visualizations for a chat
   * 
   * @param chatId The chat ID to get visualizations for
   * @param messageId Optional message ID to filter by
   * @returns Promise resolving to an array of visualizations
   */
  async getVisualizations(chatId: string, messageId?: string): Promise<ThinkingVisualization[]> {
    try {
      // Build search filter
      const filter: MemoryFilter = {
        must: [
          { key: 'metadata.chatId', match: { value: chatId } }
        ]
      };
      
      // Add message ID filter if provided
      if (messageId && filter.must) {
        filter.must.push({ 
          key: 'metadata.messageId', 
          match: { value: messageId } 
        });
      }

      // Search for visualizations
      const results = await this.memoryService.searchMemories<VisualizationMemorySchema>({
        type: MemoryType.INSIGHT,
        filter,
        limit: 50
      });

      // Extract and return visualizations
      return results
        .filter(result => result.payload.metadata?.visualization)
        .map(result => result.payload.metadata.visualization)
        .sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Error getting visualizations:', error);
      return [];
    }
  }

  /**
   * Gets a specific visualization by ID
   * 
   * @param id The visualization ID to get
   * @returns Promise resolving to the visualization or null if not found
   */
  async getVisualization(id: string): Promise<ThinkingVisualization | null> {
    try {
      const memory = await this.memoryService.getMemory<VisualizationMemorySchema>({
        id,
        type: MemoryType.INSIGHT
      });

      return memory?.payload.metadata.visualization || null;
    } catch (error) {
      console.error('Error getting visualization:', error);
      return null;
    }
  }
} 