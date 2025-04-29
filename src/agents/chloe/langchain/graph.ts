/**
 * Implementation of simplified LangGraph components for Chloe
 * This provides StateGraph functionality without external dependencies
 */

/**
 * ActionNode - A node in the state graph that performs an action
 */
export class ActionNode<T> {
  name: string;
  action: (state: T) => Promise<T>;
  
  constructor({ name, action }: { 
    name: string; 
    action: (state: T) => Promise<T> 
  }) {
    this.name = name;
    this.action = action;
  }
}

/**
 * StateGraph - A graph that manages state transitions between nodes
 */
export class StateGraph<T> {
  private initialState: T;
  private nodes: Map<string, ActionNode<T>> = new Map();
  private edges: Map<string, string[]> = new Map();
  private conditionalEdges: Map<string, {
    condition: (state: T) => string;
    routes: Record<string, string>;
  }> = new Map();
  
  constructor({ initialState }: { initialState: T }) {
    this.initialState = initialState;
  }
  
  /**
   * Add a node to the graph
   */
  addNode(node: ActionNode<T>): void {
    this.nodes.set(node.name, node);
    // Initialize empty edges array for this node
    if (!this.edges.has(node.name)) {
      this.edges.set(node.name, []);
    }
  }
  
  /**
   * Add an edge between two nodes
   */
  addEdge(from: string, to: string): void {
    const edges = this.edges.get(from) || [];
    edges.push(to);
    this.edges.set(from, edges);
  }
  
  /**
   * Add conditional edges based on a condition function
   */
  addConditionalEdges(
    from: string, 
    condition: (state: T) => string,
    routes: Record<string, string>
  ): void {
    this.conditionalEdges.set(from, { condition, routes });
  }
  
  /**
   * Execute the graph with the given initial state or default
   */
  async invoke(state: T = this.initialState): Promise<T> {
    let currentState = state;
    let currentNodeName = 'start';
    
    // Loop until we reach 'end' or an error occurs
    while (currentNodeName !== 'end') {
      // Get the next node
      const nextNodeName = await this.getNextNode(currentNodeName, currentState);
      
      if (nextNodeName === 'end') {
        return currentState;
      }
      
      // Get the node
      const node = this.nodes.get(nextNodeName);
      if (!node) {
        throw new Error(`Node ${nextNodeName} not found in graph`);
      }
      
      // Execute the node
      currentState = await node.action(currentState);
      
      // Move to the next node
      currentNodeName = nextNodeName;
    }
    
    return currentState;
  }
  
  /**
   * Get the next node name based on edges and conditional edges
   */
  private async getNextNode(currentNodeName: string, state: T): Promise<string> {
    // Check if there are conditional edges
    if (this.conditionalEdges.has(currentNodeName)) {
      const { condition, routes } = this.conditionalEdges.get(currentNodeName)!;
      const route = condition(state);
      return routes[route] || 'end';
    }
    
    // Check if there are regular edges
    const edges = this.edges.get(currentNodeName);
    if (edges && edges.length > 0) {
      return edges[0]; // Always take the first edge for simplicity
    }
    
    // If no edges, end the graph
    return 'end';
  }
} 