import { ThinkingResult } from '../types';
import { UnifiedAgentResponse } from '../UnifiedAgentService';
import { v4 as uuidv4 } from 'uuid';
import {
  ThinkingVisualization,
  VisualizationNode,
  VisualizationEdge,
  VisualizationNodeType,
  VisualizationEdgeType,
  VisualizationMetadata
} from './types';
// Add visualization storage
import { VisualizationStorageService, createVisualizationStorageService, VISUALIZATION_COLLECTION } from './visualization-storage';

/**
 * Thinking visualization service
 * 
 * This service provides visualization capabilities for agent thinking processes.
 * It uses a dedicated database for visualizations through the VisualizationStorageService.
 */

/**
 * Service for generating and storing visualizations of the thinking process
 */
export class ThinkingVisualizer {
  private collection: string;
  private storageService: VisualizationStorageService | null = null;
  private storageInitialized = false;
  
  // Cache for visualizations during processing (before they are saved)
  private visualizationsCache: Map<string, ThinkingVisualization> = new Map();

  /**
   * Create a new ThinkingVisualizer
   * 
   * @param collection Optional custom collection name
   */
  constructor(collection: string = VISUALIZATION_COLLECTION) {
    this.collection = collection;
  }

  /**
   * Initialize the storage service
   */
  private async initializeStorage(): Promise<VisualizationStorageService | null> {
    if (this.storageService && this.storageInitialized) {
      return this.storageService;
    }

    try {
      console.log('Initializing visualization storage service...');
      this.storageService = await createVisualizationStorageService();
      this.storageInitialized = true;
      console.log('Visualization storage service initialized successfully');
      return this.storageService;
    } catch (error) {
      console.error('Failed to initialize visualization storage, falling back to in-memory storage:', error);
      this.storageInitialized = false;
      return null;
    }
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
   * Saves the visualization to storage
   * 
   * @param visualization The visualization to save
   * @returns Promise resolving to the saved visualization ID
   */
  async saveVisualization(visualization: ThinkingVisualization): Promise<string | null> {
    try {
      console.log(`Saving visualization with ID ${visualization.id}`);
      
      // First add to cache for quick access during processing
      this.visualizationsCache.set(visualization.id, visualization);
      
      // Save to database if available
      try {
        const storage = await this.initializeStorage();
        if (storage) {
          const savedId = await storage.saveVisualization(visualization);
          console.log(`Saved visualization to database: ${visualization.id}`);
          return savedId || visualization.id;
        }
      } catch (dbError) {
        console.error('Error saving visualization to database, using cache only:', dbError);
        // Continue with in-memory cache only
      }
      
      // Return the visualization ID if we only have it in cache
      return visualization.id;
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
      console.log(`Retrieving visualizations for chat ${chatId}`);
      
      try {
        // Try to get from database
        const storage = await this.initializeStorage();
        if (storage) {
          const dbVisualizations = await storage.getVisualizations(chatId, messageId);
          if (dbVisualizations && dbVisualizations.length > 0) {
            console.log(`Retrieved ${dbVisualizations.length} visualizations from database`);
            
            // Update cache with database results
            for (const viz of dbVisualizations) {
              this.visualizationsCache.set(viz.id, viz);
            }
            
            return dbVisualizations;
          }
        }
      } catch (dbError) {
        console.error('Error getting visualizations from database, falling back to cache:', dbError);
        // Fall back to cache
      }
      
      // Get cached visualizations (only those that match the criteria)
      console.log('Getting visualizations from cache');
      const cachedVisualizations = Array.from(this.visualizationsCache.values())
        .filter(viz => viz.chatId === chatId && (!messageId || viz.messageId === messageId));
      
      // If empty, return a mock visualization
      if (cachedVisualizations.length === 0) {
        console.log('No visualizations found, returning mock data');
        return [this.createMockVisualization(chatId, messageId)];
      }
      
      // Sort by timestamp (newest first)
      return cachedVisualizations.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Error getting visualizations:', error);
      return [this.createMockVisualization(chatId, messageId)];
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
      console.log(`Retrieving visualization with ID ${id}`);
      
      // First check cache for fast retrieval
      const cachedVisualization = this.visualizationsCache.get(id);
      if (cachedVisualization) {
        console.log(`Retrieved visualization from cache: ${id}`);
        return cachedVisualization;
      }
      
      try {
        // Try to get from database
        const storage = await this.initializeStorage();
        if (storage) {
          const visualization = await storage.getVisualization(id);
          if (visualization) {
            console.log(`Retrieved visualization from database: ${id}`);
            
            // Update cache
            this.visualizationsCache.set(id, visualization);
            
            return visualization;
          }
        }
      } catch (dbError) {
        console.error('Error getting visualization from database:', dbError);
      }
      
      // Return mock if not found anywhere
      console.log('Visualization not found, returning mock data');
      return this.createMockVisualization(undefined, undefined, id);
    } catch (error) {
      console.error('Error getting visualization:', error);
      return null;
    }
  }
  
  /**
   * Creates a mock visualization for demonstration purposes
   * 
   * @param chatId Optional chat ID
   * @param messageId Optional message ID
   * @param visualizationId Optional visualization ID
   * @returns A mock visualization
   */
  private createMockVisualization(
    chatId?: string, 
    messageId?: string,
    visualizationId?: string
  ): ThinkingVisualization {
    return {
      id: visualizationId || `vis-${uuidv4()}`,
      requestId: messageId || `req-${uuidv4()}`,
      userId: 'user-1',
      agentId: 'agent-default',
      chatId: chatId || `chat-${uuidv4()}`,
      messageId: messageId,
      message: 'Example visualization request',
      timestamp: Date.now(),
      nodes: [
        {
          id: 'node-1',
          type: VisualizationNodeType.START,
          label: 'Request Received',
          status: 'completed',
          data: { message: 'Sample user query' },
          metrics: { startTime: Date.now() - 5000, endTime: Date.now() - 4900, duration: 100 }
        },
        {
          id: 'node-2',
          type: VisualizationNodeType.THINKING,
          label: 'Thinking Process',
          status: 'completed',
          data: { content: 'Processing the user request...' },
          metrics: { startTime: Date.now() - 4800, endTime: Date.now() - 3800, duration: 1000 }
        },
        {
          id: 'node-3',
          type: VisualizationNodeType.RESPONSE_GENERATION,
          label: 'Response Generated',
          status: 'completed',
          data: { content: 'Here is your response.' },
          metrics: { startTime: Date.now() - 3700, endTime: Date.now() - 3000, duration: 700 }
        }
      ],
      edges: [
        { id: 'edge-1', source: 'node-1', target: 'node-2', type: VisualizationEdgeType.FLOW },
        { id: 'edge-2', source: 'node-2', target: 'node-3', type: VisualizationEdgeType.FLOW }
      ],
      metrics: {
        totalDuration: 1800,
        startTime: Date.now() - 5000,
        endTime: Date.now() - 3000
      }
    };
  }
} 