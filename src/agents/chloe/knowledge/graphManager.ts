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
  
  return {
    graph,
    results: {
      relatedToTask1,
      path
    }
  };
} 