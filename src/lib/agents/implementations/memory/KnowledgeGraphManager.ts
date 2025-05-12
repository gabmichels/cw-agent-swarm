/**
 * KnowledgeGraphManager.ts - In-memory knowledge graph implementation
 * 
 * This file provides an in-memory implementation of the KnowledgeGraphManager interface
 * that matches Chloe's approach using Maps and arrays for storage.
 */

import { 
  KnowledgeGraphManager as IKnowledgeGraphManager,
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeNodeType,
  KnowledgeEdgeType
} from '../../shared/memory/types';
import { handleError } from '../../../errors/errorHandler';
import { CustomError } from '../../../errors/CustomError';

/**
 * In-memory knowledge graph implementation
 */
export class KnowledgeGraphManager implements IKnowledgeGraphManager {
  private nodes: Map<string, KnowledgeNode>;
  private edges: KnowledgeEdge[];
  private nodeConnections: Map<string, Set<string>>;
  private initialized: boolean = false;

  constructor() {
    this.nodes = new Map();
    this.edges = [];
    this.nodeConnections = new Map();
  }

  /**
   * Initialize the knowledge graph
   */
  async initialize(): Promise<void> {
    try {
      // Clear any existing data
      this.clear();
      this.initialized = true;
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Add a node to the knowledge graph
   */
  async addNode(node: KnowledgeNode): Promise<void> {
    if (!this.initialized) {
      throw new Error('Knowledge graph not initialized');
    }

    try {
      // Validate node
      if (!node.id || !node.label || !node.type) {
        throw new Error('Invalid node: missing required fields');
      }

      // Check if node already exists
      if (this.nodes.has(node.id)) {
        throw new Error(`Node with ID ${node.id} already exists`);
      }

      // Add node
      this.nodes.set(node.id, node);
      this.nodeConnections.set(node.id, new Set());
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Add an edge to the knowledge graph
   */
  async addEdge(edge: KnowledgeEdge): Promise<void> {
    if (!this.initialized) {
      throw new Error('Knowledge graph not initialized');
    }

    try {
      // Validate edge
      if (!edge.from || !edge.to || !edge.type) {
        throw new Error('Invalid edge: missing required fields');
      }

      // Check if nodes exist
      if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to)) {
        throw new Error('Invalid edge: one or both nodes do not exist');
      }

      // Check if edge already exists
      const existingEdge = this.edges.find(e => 
        e.from === edge.from && e.to === edge.to && e.type === edge.type
      );
      if (existingEdge) {
        throw new Error('Edge already exists');
      }

      // Add edge
      this.edges.push(edge);

      // Update node connections
      const fromConnections = this.nodeConnections.get(edge.from) || new Set();
      const toConnections = this.nodeConnections.get(edge.to) || new Set();
      fromConnections.add(edge.to);
      toConnections.add(edge.from);
      this.nodeConnections.set(edge.from, fromConnections);
      this.nodeConnections.set(edge.to, toConnections);
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get a node by ID
   */
  async getNode(id: string): Promise<KnowledgeNode | null> {
    if (!this.initialized) {
      throw new Error('Knowledge graph not initialized');
    }

    return this.nodes.get(id) || null;
  }

  /**
   * Get edges connected to a node
   */
  async getEdges(
    nodeId: string,
    direction: 'incoming' | 'outgoing' | 'both' = 'both'
  ): Promise<KnowledgeEdge[]> {
    if (!this.initialized) {
      throw new Error('Knowledge graph not initialized');
    }

    try {
      // Get node connections
      const connections = this.nodeConnections.get(nodeId);
      if (!connections) {
        return [];
      }

      // Filter edges based on direction
      return this.edges.filter(edge => {
        if (direction === 'incoming') {
          return edge.to === nodeId;
        }
        if (direction === 'outgoing') {
          return edge.from === nodeId;
        }
        return edge.from === nodeId || edge.to === nodeId;
      });
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Find nodes matching a query
   */
  async findNodes(
    query: string,
    type?: KnowledgeNodeType,
    limit: number = 10
  ): Promise<KnowledgeNode[]> {
    if (!this.initialized) {
      throw new Error('Knowledge graph not initialized');
    }

    try {
      // Convert query to lowercase for case-insensitive search
      const lowerQuery = query.toLowerCase();

      // Filter nodes
      const matches = Array.from(this.nodes.values()).filter(node => {
        // Check type if specified
        if (type && node.type !== type) {
          return false;
        }

        // Check if query matches label or description
        const matchesLabel = node.label.toLowerCase().includes(lowerQuery);
        const matchesDescription = node.description?.toLowerCase().includes(lowerQuery) || false;
        const matchesTags = node.tags?.some(tag => tag.toLowerCase().includes(lowerQuery)) || false;

        return matchesLabel || matchesDescription || matchesTags;
      });

      // Sort by relevance (simple implementation)
      matches.sort((a, b) => {
        const aScore = this.calculateRelevanceScore(a, lowerQuery);
        const bScore = this.calculateRelevanceScore(b, lowerQuery);
        return bScore - aScore;
      });

      return matches.slice(0, limit);
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Find paths between two nodes
   */
  async findPaths(
    fromId: string,
    toId: string,
    maxDepth: number = 3
  ): Promise<KnowledgeEdge[][]> {
    if (!this.initialized) {
      throw new Error('Knowledge graph not initialized');
    }

    try {
      // Check if nodes exist
      if (!this.nodes.has(fromId) || !this.nodes.has(toId)) {
        return [];
      }

      // Use breadth-first search to find paths
      const paths: KnowledgeEdge[][] = [];
      const queue: Array<{ id: string; path: KnowledgeEdge[]; depth: number }> = [
        { id: fromId, path: [], depth: 0 }
      ];
      const visited = new Set<string>([fromId]);

      while (queue.length > 0) {
        const { id, path, depth } = queue.shift()!;

        // Check if we've reached the target
        if (id === toId) {
          paths.push(path);
          continue;
        }

        // Stop if we've reached max depth
        if (depth >= maxDepth) {
          continue;
        }

        // Get connected nodes
        const connections = this.nodeConnections.get(id) || new Set();
        for (const connectedId of Array.from(connections)) {
          if (!visited.has(connectedId)) {
            visited.add(connectedId);

            // Find the edge connecting these nodes
            const edge = this.edges.find(e => 
              (e.from === id && e.to === connectedId) || 
              (e.from === connectedId && e.to === id)
            );

            if (edge) {
              queue.push({
                id: connectedId,
                path: [...path, edge],
                depth: depth + 1
              });
            }
          }
        }
      }

      return paths;
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Update a node
   */
  async updateNode(id: string, updates: Partial<KnowledgeNode>): Promise<void> {
    if (!this.initialized) {
      throw new Error('Knowledge graph not initialized');
    }

    try {
      const node = this.nodes.get(id);
      if (!node) {
        throw new Error(`Node with ID ${id} not found`);
      }

      // Update node
      this.nodes.set(id, { ...node, ...updates });
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Update an edge
   */
  async updateEdge(
    from: string,
    to: string,
    updates: Partial<KnowledgeEdge>
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('Knowledge graph not initialized');
    }

    try {
      const edgeIndex = this.edges.findIndex(e => 
        e.from === from && e.to === to
      );

      if (edgeIndex === -1) {
        throw new Error('Edge not found');
      }

      // Update edge
      this.edges[edgeIndex] = { ...this.edges[edgeIndex], ...updates };
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Delete a node
   */
  async deleteNode(id: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Knowledge graph not initialized');
    }

    try {
      // Check if node exists
      if (!this.nodes.has(id)) {
        throw new Error(`Node with ID ${id} not found`);
      }

      // Remove node
      this.nodes.delete(id);
      this.nodeConnections.delete(id);

      // Remove connected edges
      this.edges = this.edges.filter(edge => 
        edge.from !== id && edge.to !== id
      );

      // Update connections in other nodes
      for (const [nodeId, connections] of Array.from(this.nodeConnections.entries())) {
        connections.delete(id);
        this.nodeConnections.set(nodeId, connections);
      }
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Delete an edge
   */
  async deleteEdge(from: string, to: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Knowledge graph not initialized');
    }

    try {
      // Find edge
      const edgeIndex = this.edges.findIndex(e => 
        e.from === from && e.to === to
      );

      if (edgeIndex === -1) {
        throw new Error('Edge not found');
      }

      // Remove edge
      this.edges.splice(edgeIndex, 1);

      // Update node connections
      const fromConnections = this.nodeConnections.get(from);
      const toConnections = this.nodeConnections.get(to);
      if (fromConnections) fromConnections.delete(to);
      if (toConnections) toConnections.delete(from);
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get graph statistics
   */
  async getStats(): Promise<{
    totalNodes: number;
    totalEdges: number;
    nodeTypes: Record<KnowledgeNodeType, number>;
    edgeTypes: Record<KnowledgeEdgeType, number>;
  }> {
    if (!this.initialized) {
      throw new Error('Knowledge graph not initialized');
    }

    try {
      // Count nodes by type
      const nodeTypes: Record<KnowledgeNodeType, number> = {} as Record<KnowledgeNodeType, number>;
      for (const node of Array.from(this.nodes.values())) {
        nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
      }

      // Count edges by type
      const edgeTypes: Record<KnowledgeEdgeType, number> = {} as Record<KnowledgeEdgeType, number>;
      for (const edge of this.edges) {
        edgeTypes[edge.type] = (edgeTypes[edge.type] || 0) + 1;
      }

      return {
        totalNodes: this.nodes.size,
        totalEdges: this.edges.length,
        nodeTypes,
        edgeTypes
      };
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Build graph from memory entries and tasks
   */
  async buildGraphFromMemory(
    memories: Array<{ id: string; content: string; metadata?: any }> = [],
    tasks: Array<{ id: string; goal: string; subGoals?: any[]; status: string }> = []
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('Knowledge graph not initialized');
    }

    try {
      // Add task nodes
      for (const task of tasks) {
        const taskId = `task-${task.id}`;
        
        await this.addNode({
          id: taskId,
          label: task.goal,
          type: 'task',
          description: `Task: ${task.goal}`,
          metadata: {
            status: task.status,
            originalId: task.id,
            subGoalCount: task.subGoals?.length || 0
          }
        });

        // Add sub-goals if any
        if (task.subGoals?.length) {
          for (let i = 0; i < task.subGoals.length; i++) {
            const subGoal = task.subGoals[i];
            const subGoalId = `subgoal-${task.id}-${i}`;

            await this.addNode({
              id: subGoalId,
              label: subGoal.description || `Sub-goal ${i + 1}`,
              type: 'task',
              description: subGoal.description || `Sub-goal ${i + 1} for task: ${task.goal}`,
              metadata: {
                parentTaskId: task.id,
                index: i
              }
            });

            // Connect sub-goal to parent task
            await this.addEdge({
              from: subGoalId,
              to: taskId,
              type: 'depends_on',
              label: 'Part of task'
            });
          }
        }
      }

      // Add memory nodes
      for (const memory of memories) {
        const memoryId = `memory-${memory.id}`;
        const label = memory.content.substring(0, 30) + (memory.content.length > 30 ? '...' : '');

        await this.addNode({
          id: memoryId,
          label,
          type: 'concept',
          description: memory.content,
          metadata: {
            originalId: memory.id,
            ...memory.metadata
          }
        });

        // Connect memories to related tasks
        for (const task of tasks) {
          const taskId = `task-${task.id}`;
          const taskWords = task.goal.toLowerCase().split(/\s+/).filter(word => word.length > 3);
          const isRelated = taskWords.some(word => memory.content.toLowerCase().includes(word));

          if (isRelated) {
            await this.addEdge({
              from: memoryId,
              to: taskId,
              type: 'related_to',
              label: 'Related to'
            });
          }
        }
      }
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Inject graph context into a planning prompt
   */
  async injectGraphContextIntoPlan(goal: string, maxNodes: number = 5): Promise<string> {
    if (!this.initialized) {
      throw new Error('Knowledge graph not initialized');
    }

    try {
      // Create normalized task ID
      const taskNodeId = `task-${goal.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 30)}`;

      // Find related nodes
      let relatedNodes: KnowledgeNode[] = [];

      // Check if task exists
      const existingNode = await this.getNode(taskNodeId);
      if (existingNode) {
        // Get connected nodes
        const edges = await this.getEdges(taskNodeId);
        const connectedNodeIds = edges.map(edge => 
          edge.from === taskNodeId ? edge.to : edge.from
        );
        const nodes = await Promise.all(
          connectedNodeIds.map(id => this.getNode(id))
        );
        relatedNodes = nodes.filter((node): node is KnowledgeNode => node !== null);
      } else {
        // Search for related nodes
        relatedNodes = await this.findNodes(goal, undefined, maxNodes);
      }

      if (relatedNodes.length === 0) {
        return '';
      }

      // Format context
      const contextParts = [
        '## Related Knowledge from Knowledge Graph',
        ...relatedNodes.map(node => 
          `- ${node.label} (${node.type}): ${node.description || 'No description'}`)
      ];

      return contextParts.join('\n');
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get graph visualization data
   */
  getGraphVisualizationData(): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges
    };
  }

  /**
   * Clear the graph
   */
  clear(): void {
    this.nodes.clear();
    this.edges = [];
    this.nodeConnections.clear();
  }

  /**
   * Shutdown the graph
   */
  async shutdown(): Promise<void> {
    try {
      this.clear();
      this.initialized = false;
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Calculate relevance score for node search
   */
  private calculateRelevanceScore(node: KnowledgeNode, query: string): number {
    let score = 0;

    // Label match (highest weight)
    if (node.label.toLowerCase().includes(query)) {
      score += 3;
    }

    // Description match
    if (node.description?.toLowerCase().includes(query)) {
      score += 2;
    }

    // Tag match
    if (node.tags?.some(tag => tag.toLowerCase().includes(query))) {
      score += 1;
    }

    return score;
  }
} 