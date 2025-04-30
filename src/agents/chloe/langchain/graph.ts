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
  isBlockingOnFailure?: boolean;
  
  constructor({ 
    name, 
    action,
    isBlockingOnFailure = false
  }: { 
    name: string; 
    action: (state: T) => Promise<T>;
    isBlockingOnFailure?: boolean;
  }) {
    this.name = name;
    this.action = action;
    this.isBlockingOnFailure = isBlockingOnFailure;
  }
}

/**
 * Sleep utility for delay between retries
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

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
      
      // Execute the node with retry logic
      currentState = await this.executeNodeWithRetry(node, currentState);
      
      // Move to the next node
      currentNodeName = nextNodeName;
    }
    
    return currentState;
  }
  
  /**
   * Execute a node with retry logic
   * @param node The action node to execute
   * @param state The current state
   * @returns Updated state after execution
   */
  private async executeNodeWithRetry(node: ActionNode<T>, state: T): Promise<T> {
    const MAX_RETRIES = 2;
    const BASE_DELAY_MS = 1000; // 1 second base delay
    
    let retries = 0;
    let lastError: Error | null = null;
    
    console.log(`Executing node: ${node.name}`);
    
    // Try to execute the node up to MAX_RETRIES + 1 times (initial try + retries)
    while (retries <= MAX_RETRIES) {
      try {
        // Log the attempt
        if (retries > 0) {
          console.log(`Retry attempt ${retries}/${MAX_RETRIES} for node ${node.name}`);
        }
        
        // Execute the node
        const newState = await node.action(state);
        
        // If execution succeeds, log success and return the new state
        console.log(`Node ${node.name} executed successfully${retries > 0 ? ` after ${retries} retry(ies)` : ''}`);
        return newState;
      } catch (error) {
        // Log the error
        console.error(`Error executing node ${node.name} (attempt ${retries + 1}/${MAX_RETRIES + 1}):`, error);
        
        // Save the error for potential throwing later
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // If this is not the last retry, wait before retrying
        if (retries < MAX_RETRIES) {
          // Use exponential backoff for the delay
          const delayMs = BASE_DELAY_MS * Math.pow(2, retries);
          console.log(`Retrying node ${node.name} in ${delayMs}ms (exponential backoff)...`);
          await sleep(delayMs);
        }
        
        retries++;
      }
    }
    
    // If we reach here, all retries have failed
    console.error(`All retries failed for node ${node.name}`);
    
    // Handle the failure based on whether this is a blocking failure or not
    if (node.isBlockingOnFailure) {
      // For blocking failures, log and throw the error to stop execution
      console.error(`Node ${node.name} is marked as blocking on failure. Stopping execution.`);
      throw lastError || new Error(`Failed to execute node ${node.name} after ${MAX_RETRIES + 1} attempts`);
    } else {
      // For non-blocking failures, update the state to indicate failure but continue
      console.log(`Node ${node.name} is non-blocking. Continuing execution with error state.`);
      
      // This assumes the state has a property like 'error' and 'executionTrace'
      // We use type assertion to avoid TypeScript errors, but ensure your state type has these properties
      const updatedState = { ...state } as any;
      
      // Add the error to the state
      if (typeof updatedState.error === 'undefined') {
        updatedState.error = `Failed to execute node ${node.name}: ${lastError?.message || 'Unknown error'}`;
      }
      
      // Add to execution trace if available
      if (Array.isArray(updatedState.executionTrace)) {
        updatedState.executionTrace.push(`Failed to execute node ${node.name}: ${lastError?.message || 'Unknown error'}`);
      }
      
      // Mark the current task or sub-goal as failed if applicable
      if (updatedState.task && updatedState.task.currentSubGoalId && Array.isArray(updatedState.task.subGoals)) {
        const currentSubGoalId = updatedState.task.currentSubGoalId;
        updatedState.task.subGoals = updatedState.task.subGoals.map((sg: any) => 
          sg.id === currentSubGoalId ? { ...sg, status: 'failed', result: `Failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message || 'Unknown error'}` } : sg
        );
        
        console.log(`Marked sub-goal ${currentSubGoalId} as failed`);
        
        // Clear the current sub-goal ID so we can move to the next one
        updatedState.task.currentSubGoalId = undefined;
      }
      
      // Return the updated state to continue with execution
      return updatedState as T;
    }
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