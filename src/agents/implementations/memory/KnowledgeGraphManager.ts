import { KnowledgeGraphManager as IKnowledgeGraphManager, KnowledgeNode, KnowledgeEdge, KnowledgeNodeType, KnowledgeEdgeType } from '../../../lib/shared/types/agentTypes';

/**
 * Implementation of the KnowledgeGraphManager interface
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

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
  }

  async addNode(node: KnowledgeNode): Promise<void> {
    if (!node.id || !node.label || !node.type) {
      throw new Error('Invalid node: missing required fields');
    }
    this.nodes.set(node.id, node);
  }

  async addEdge(edge: KnowledgeEdge): Promise<void> {
    if (!edge.from || !edge.to || !edge.type) {
      throw new Error('Invalid edge: missing required fields');
    }

    if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to)) {
      throw new Error('Edge references non-existent nodes');
    }

    this.edges.push(edge);

    // Update node connections
    if (!this.nodeConnections.has(edge.from)) {
      this.nodeConnections.set(edge.from, new Set());
    }
    if (!this.nodeConnections.has(edge.to)) {
      this.nodeConnections.set(edge.to, new Set());
    }

    this.nodeConnections.get(edge.from)!.add(edge.to);
    this.nodeConnections.get(edge.to)!.add(edge.from);
  }

  async getNode(id: string): Promise<KnowledgeNode | null> {
    return this.nodes.get(id) || null;
  }

  async getEdges(
    nodeId: string,
    direction: 'incoming' | 'outgoing' | 'both' = 'both'
  ): Promise<KnowledgeEdge[]> {
    return this.edges.filter(edge => {
      if (direction === 'incoming') {
        return edge.to === nodeId;
      }
      if (direction === 'outgoing') {
        return edge.from === nodeId;
      }
      return edge.from === nodeId || edge.to === nodeId;
    });
  }

  async findNodes(
    query: string,
    type?: KnowledgeNodeType,
    limit: number = 10
  ): Promise<KnowledgeNode[]> {
    const results: KnowledgeNode[] = [];
    const nodeArray = Array.from(this.nodes.values());
    for (const node of nodeArray) {
      if (type && node.type !== type) {
        continue;
      }
      const score = this.calculateRelevanceScore(node, query);
      if (score > 0) {
        results.push(node);
      }
    }
    return results
      .sort((a, b) => this.calculateRelevanceScore(b, query) - this.calculateRelevanceScore(a, query))
      .slice(0, limit);
  }

  async findPaths(
    fromId: string,
    toId: string,
    maxDepth: number = 3
  ): Promise<KnowledgeEdge[][]> {
    const paths: KnowledgeEdge[][] = [];
    const visited = new Set<string>();
    const currentPath: KnowledgeEdge[] = [];

    const dfs = (currentId: string, depth: number) => {
      if (depth > maxDepth || visited.has(currentId)) {
        return;
      }

      visited.add(currentId);

      if (currentId === toId) {
        paths.push([...currentPath]);
        visited.delete(currentId);
        return;
      }

      const connections = this.nodeConnections.get(currentId);
      if (!connections) {
        visited.delete(currentId);
        return;
      }

      const connectionArray = Array.from(connections);
      for (const nextId of connectionArray) {
        const edge = this.edges.find(e => e.from === currentId && e.to === nextId);
        if (edge) {
          currentPath.push(edge);
          dfs(nextId, depth + 1);
          currentPath.pop();
        }
      }

      visited.delete(currentId);
    };

    dfs(fromId, 0);
    return paths;
  }

  async updateNode(id: string, updates: Partial<KnowledgeNode>): Promise<void> {
    const node = this.nodes.get(id);
    if (!node) {
      throw new Error(`Node ${id} not found`);
    }
    this.nodes.set(id, { ...node, ...updates });
  }

  async updateEdge(
    from: string,
    to: string,
    updates: Partial<KnowledgeEdge>
  ): Promise<void> {
    const edgeIndex = this.edges.findIndex(e => e.from === from && e.to === to);
    if (edgeIndex === -1) {
      throw new Error(`Edge from ${from} to ${to} not found`);
    }
    this.edges[edgeIndex] = { ...this.edges[edgeIndex], ...updates };
  }

  async deleteNode(id: string): Promise<void> {
    if (!this.nodes.has(id)) {
      throw new Error(`Node ${id} not found`);
    }

    // Remove all edges connected to this node
    this.edges = this.edges.filter(edge => edge.from !== id && edge.to !== id);

    // Remove node connections
    this.nodeConnections.delete(id);
    const connectionArrays = Array.from(this.nodeConnections.values());
    for (const connections of connectionArrays) {
      connections.delete(id);
    }

    // Remove the node
    this.nodes.delete(id);
  }

  async deleteEdge(from: string, to: string): Promise<void> {
    const edgeIndex = this.edges.findIndex(e => e.from === from && e.to === to);
    if (edgeIndex === -1) {
      throw new Error(`Edge from ${from} to ${to} not found`);
    }

    // Remove edge
    this.edges.splice(edgeIndex, 1);

    // Update node connections
    this.nodeConnections.get(from)?.delete(to);
    this.nodeConnections.get(to)?.delete(from);
  }

  async getStats(): Promise<{
    totalNodes: number;
    totalEdges: number;
    nodeTypes: Record<KnowledgeNodeType, number>;
    edgeTypes: Record<KnowledgeEdgeType, number>;
  }> {
    const nodeTypes = Object.values(KnowledgeNodeType).reduce((acc, type) => {
      acc[type] = 0;
      return acc;
    }, {} as Record<KnowledgeNodeType, number>);

    const edgeTypes = Object.values(KnowledgeEdgeType).reduce((acc, type) => {
      acc[type] = 0;
      return acc;
    }, {} as Record<KnowledgeEdgeType, number>);

    // Count node types
    const nodeArray = Array.from(this.nodes.values());
    for (const node of nodeArray) {
      nodeTypes[node.type] += 1;
    }

    // Count edge types
    for (const edge of this.edges) {
      edgeTypes[edge.type] += 1;
    }

    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.length,
      nodeTypes,
      edgeTypes
    };
  }

  async buildGraphFromMemory(
    memories: Array<{ id: string; content: string; metadata?: any }> = [],
    tasks: Array<{ id: string; goal: string; subGoals?: any[]; status: string }> = []
  ): Promise<void> {
    // Implementation details...
  }

  async injectGraphContextIntoPlan(goal: string, maxNodes: number = 5): Promise<string> {
    // Implementation details...
    return '';
  }

  getGraphVisualizationData(): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges
    };
  }

  clear(): void {
    this.nodes.clear();
    this.edges = [];
    this.nodeConnections.clear();
  }

  async shutdown(): Promise<void> {
    this.clear();
    this.initialized = false;
  }

  private calculateRelevanceScore(node: KnowledgeNode, query: string): number {
    const queryLower = query.toLowerCase();
    const labelLower = node.label.toLowerCase();
    const descriptionLower = (node.description || '').toLowerCase();

    let score = 0;

    // Check label match
    if (labelLower.includes(queryLower)) {
      score += 2;
    }

    // Check description match
    if (descriptionLower.includes(queryLower)) {
      score += 1;
    }

    // Check tag matches
    if (node.tags) {
      for (const tag of node.tags) {
        if (tag.toLowerCase().includes(queryLower)) {
          score += 0.5;
        }
      }
    }

    return score;
  }
} 