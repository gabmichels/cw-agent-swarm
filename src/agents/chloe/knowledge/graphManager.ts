/**
 * Knowledge Graph Manager for Chloe
 * Implements storage and retrieval of knowledge nodes and relationships.
 */

export interface KnowledgeNode {
  id: string;
  label: string;
  type: string; // e.g., 'concept', 'tool', 'project', 'task', etc.
  description?: string;
  metadata?: Record<string, any>;
}

export interface KnowledgeEdge {
  from: string;
  to: string;
  type: string; // e.g., 'depends_on', 'part_of', 'caused_by'
  weight?: number;
  label?: string;
}

export class KnowledgeGraphManager {
  private nodes: Map<string, KnowledgeNode>;
  private edges: KnowledgeEdge[];
  private nodeConnections: Map<string, Set<string>>;

  constructor() {
    this.nodes = new Map();
    this.edges = [];
    this.nodeConnections = new Map();
  }

  /**
   * Add a node to the knowledge graph
   * @param node The node to add
   */
  async addNode(node: KnowledgeNode): Promise<void> {
    // Ensure the node has a unique ID
    if (this.nodes.has(node.id)) {
      throw new Error(`Node with ID ${node.id} already exists`);
    }
    
    this.nodes.set(node.id, node);
    this.nodeConnections.set(node.id, new Set());
  }

  /**
   * Add an edge between two nodes
   * @param edge The edge to add
   */
  async addEdge(edge: KnowledgeEdge): Promise<void> {
    // Ensure both nodes exist
    if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to)) {
      throw new Error(`Cannot add edge: one or both nodes do not exist`);
    }
    
    this.edges.push(edge);
    
    // Update the connection maps
    const fromConnections = this.nodeConnections.get(edge.from);
    fromConnections?.add(edge.to);
    
    // For bidirectional queries
    const toConnections = this.nodeConnections.get(edge.to);
    toConnections?.add(edge.from);
  }

  /**
   * Retrieve a node by its ID
   * @param id The ID of the node to retrieve
   * @returns The node or null if not found
   */
  async getNodeById(id: string): Promise<KnowledgeNode | null> {
    return this.nodes.get(id) || null;
  }

  /**
   * Query for nodes related to a specific node
   * @param nodeId The ID of the node to find relationships for
   * @param typeFilter Optional filter for relationship type
   * @returns Array of related nodes
   */
  async queryRelatedNodes(nodeId: string, typeFilter?: string): Promise<KnowledgeNode[]> {
    if (!this.nodes.has(nodeId)) {
      return [];
    }
    
    // Find all edges connected to this node
    const relatedEdges = this.edges.filter(edge => {
      // If there's a type filter, apply it
      if (typeFilter && edge.type !== typeFilter) {
        return false;
      }
      
      return edge.from === nodeId || edge.to === nodeId;
    });
    
    // Map to connected nodes
    const relatedNodeIds = new Set(
      relatedEdges.map(edge => edge.from === nodeId ? edge.to : edge.from)
    );
    
    // Return the actual node objects
    return Array.from(relatedNodeIds)
      .map(id => this.nodes.get(id))
      .filter((node): node is KnowledgeNode => node !== undefined);
  }

  /**
   * Find a path between two nodes using a breadth-first search
   * @param fromId Starting node ID
   * @param toId Target node ID
   * @returns Array of edges forming the path, or empty array if no path found
   */
  async findPath(fromId: string, toId: string): Promise<KnowledgeEdge[]> {
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) {
      return [];
    }
    
    // Simple BFS implementation
    const visited = new Set<string>([fromId]);
    const queue: Array<{id: string, path: KnowledgeEdge[]}> = [{id: fromId, path: []}];
    
    while (queue.length > 0) {
      const { id, path } = queue.shift()!;
      
      // Get all connected nodes
      const connections = this.nodeConnections.get(id) || new Set();
      const connectionArray = Array.from(connections);
      
      for (const connectedId of connectionArray) {
        if (connectedId === toId) {
          // Found the target, determine the last edge
          const lastEdge = this.edges.find(edge => 
            (edge.from === id && edge.to === connectedId) || 
            (edge.from === connectedId && edge.to === id)
          );
          
          if (lastEdge) {
            return [...path, lastEdge];
          }
        }
        
        if (!visited.has(connectedId)) {
          visited.add(connectedId);
          
          // Find the edge connecting these nodes
          const connectingEdge = this.edges.find(edge => 
            (edge.from === id && edge.to === connectedId) || 
            (edge.from === connectedId && edge.to === id)
          );
          
          if (connectingEdge) {
            queue.push({
              id: connectedId,
              path: [...path, connectingEdge]
            });
          }
        }
      }
    }
    
    return []; // No path found
  }

  /**
   * Build graph from Chloe's memories and tasks
   * @param memories Array of memory items
   * @param tasks Array of tasks
   */
  async buildGraphFromMemory(
    memories: Array<{ id: string; content: string; metadata?: any }> = [],
    tasks: Array<{ id: string; goal: string; subGoals?: any[]; status: string }> = []
  ): Promise<void> {
    // First, add all tasks as nodes
    for (const task of tasks) {
      const taskId = `task-${task.id}`;
      
      try {
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
        
        // If the task has sub-goals, add them as nodes and connect them to the task
        if (task.subGoals && task.subGoals.length > 0) {
          for (let i = 0; i < task.subGoals.length; i++) {
            const subGoal = task.subGoals[i];
            const subGoalId = `subgoal-${task.id}-${i}`;
            
            await this.addNode({
              id: subGoalId,
              label: subGoal.description || `Sub-goal ${i+1}`,
              type: 'sub_goal',
              description: subGoal.reasoning || '',
              metadata: {
                priority: subGoal.priority || 3,
                parentTaskId: task.id
              }
            });
            
            // Connect sub-goal to its parent task
            await this.addEdge({
              from: subGoalId,
              to: taskId,
              type: 'part_of',
              label: 'Part of'
            });
          }
        }
      } catch (error) {
        // Skip if node already exists or other error
        console.error(`Error adding task node ${taskId}:`, error);
      }
    }
    
    // Then, add relevant memories as concept nodes
    for (const memory of memories) {
      const memoryId = `memory-${memory.id}`;
      
      try {
        // Create a shorter label from the content (first 30 chars)
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
        
        // Connect this memory to related tasks (simplified approach)
        // In a real implementation, you'd use semantic similarity
        for (const task of tasks) {
          const taskId = `task-${task.id}`;
          
          // Simple heuristic - check if memory content contains words from task goal
          const taskWords = task.goal.toLowerCase().split(/\s+/).filter(word => word.length > 3);
          const isRelated = taskWords.some(word => memory.content.toLowerCase().includes(word));
          
          if (isRelated) {
            try {
              await this.addEdge({
                from: memoryId,
                to: taskId,
                type: 'related_to',
                label: 'Related to'
              });
            } catch (error) {
              // Skip if edge creation fails
              console.error(`Error connecting memory to task:`, error);
            }
          }
        }
      } catch (error) {
        // Skip if node already exists or other error
        console.error(`Error adding memory node ${memoryId}:`, error);
      }
    }
  }

  /**
   * Helper to inject graph context into a planning prompt
   * @param goal The planning goal or topic
   * @param maxNodes Maximum number of related nodes to include
   * @returns Formatted string with graph context
   */
  async injectGraphContextIntoPlan(goal: string, maxNodes: number = 5): Promise<string> {
    // Create a normalized ID based on the goal
    const taskNodeId = `task-${goal.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 30)}`;
    
    // Find related nodes
    let relatedNodes: KnowledgeNode[] = [];
    
    // First check if this exact task exists
    const existingNode = await this.getNodeById(taskNodeId);
    if (existingNode) {
      // Find nodes connected to this one
      relatedNodes = await this.queryRelatedNodes(taskNodeId);
    } else {
      // Otherwise, search through all nodes for potential matches
      // In a real implementation, you would use semantic search here
      const allNodes = Array.from(this.nodes.values());
      
      // Simple keyword matching (would be replaced by vector similarity in production)
      const goalWords = goal.toLowerCase().split(/\s+/).filter(word => word.length > 3);
      relatedNodes = allNodes.filter(node => {
        const nodeContent = `${node.label} ${node.description || ''}`.toLowerCase();
        return goalWords.some(word => nodeContent.includes(word));
      }).slice(0, maxNodes);
    }
    
    // If no related nodes, return empty string
    if (relatedNodes.length === 0) {
      return "";
    }
    
    // Format the context string
    const contextParts = [
      "## Related Knowledge from Knowledge Graph",
      ...relatedNodes.map(node => 
        `- ${node.label} (${node.type}): ${node.description || 'No description'}`)
    ];
    
    return contextParts.join('\n');
  }

  /**
   * Helper: Generate a graph visualization format
   * Useful for debugging or displaying the graph
   */
  getGraphVisualizationData() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges
    };
  }

  /**
   * Helper: Clear the entire graph
   */
  clear() {
    this.nodes.clear();
    this.edges = [];
    this.nodeConnections.clear();
  }

  /**
   * Get all nodes in the knowledge graph
   * @returns Array of all KnowledgeNode objects
   */
  async getAllNodes(): Promise<KnowledgeNode[]> {
    return Array.from(this.nodes.values());
  }
  
  /**
   * Get all edges in the knowledge graph
   * @returns Array of all KnowledgeEdge objects
   */
  async getAllEdges(): Promise<KnowledgeEdge[]> {
    return [...this.edges];
  }
  
  /**
   * Remove a node from the knowledge graph
   * This also removes all edges connected to this node
   * @param id The ID of the node to remove
   */
  async removeNode(id: string): Promise<boolean> {
    if (!this.nodes.has(id)) {
      return false;
    }
    
    // Remove the node
    this.nodes.delete(id);
    
    // Remove all edges connected to this node
    this.edges = this.edges.filter(edge => edge.from !== id && edge.to !== id);
    
    // Remove from connection maps
    this.nodeConnections.delete(id);
    
    // Update other nodes' connections - fix for Map iteration
    const connectionEntries = Array.from(this.nodeConnections.entries());
    for (const [_, connections] of connectionEntries) {
      connections.delete(id);
    }
    
    return true;
  }
}

// Example test implementation
export async function runKnowledgeGraphExample() {
  const graph = new KnowledgeGraphManager();
  
  // Add nodes
  await graph.addNode({
    id: "task-1",
    label: "Complete Project Plan",
    type: "task",
    description: "Create a comprehensive project plan for Q3"
  });
  
  await graph.addNode({
    id: "task-2",
    label: "Research Competitors",
    type: "task",
    description: "Analyze top 3 competitors in the market"
  });
  
  await graph.addNode({
    id: "project-1",
    label: "Market Expansion",
    type: "project",
    description: "Q3 initiative to expand into new markets"
  });
  
  // Add edges
  await graph.addEdge({
    from: "task-1",
    to: "project-1",
    type: "part_of",
    label: "Is part of"
  });
  
  await graph.addEdge({
    from: "task-2",
    to: "task-1",
    type: "depends_on",
    label: "Depends on",
    weight: 0.8
  });
  
  // Query example
  const relatedToTask1 = await graph.queryRelatedNodes("task-1");
  console.log("Nodes related to 'Complete Project Plan':", relatedToTask1);
  
  // Path finding example
  const path = await graph.findPath("task-2", "project-1");
  console.log("Path from 'Research Competitors' to 'Market Expansion':", path);
  
  // Test building graph from memories and tasks
  await graph.buildGraphFromMemory(
    [
      {
        id: "mem-1",
        content: "The Q3 marketing campaign should focus on social media engagement"
      },
      {
        id: "mem-2",
        content: "Competitor analysis shows weak presence in mobile markets"
      }
    ],
    [
      {
        id: "task-101",
        goal: "Develop social media strategy for Q3",
        status: "completed",
        subGoals: [
          { description: "Research platforms", priority: 1, reasoning: "Need to identify which platforms to focus on" },
          { description: "Create content calendar", priority: 2, reasoning: "Plan content distribution" }
        ]
      }
    ]
  );
  
  // Get context for a new planning task
  const planContext = await graph.injectGraphContextIntoPlan("social media marketing plan");
  console.log("Planning Context:", planContext);
  
  return {
    graph,
    results: {
      relatedToTask1,
      path,
      planContext
    }
  };
} 