import { ThinkingState } from './types';
import {
  retrieveContextNode,
  analyzeIntentNode,
  extractEntitiesNode,
  assessDelegationNode,
  delegateTaskNode,
  planExecutionNode,
  selectToolsNode,
  applyReasoningNode,
  generateResponseNode
} from './nodes';

/**
 * Create initial state for the thinking process
 */
export function createInitialState(userId: string, input: string): ThinkingState {
  return {
    userId,
    input,
    contextMemories: [],
    contextFiles: [],
    entities: [],
    shouldDelegate: false
  };
}

/**
 * Execute the thinking workflow
 * This is a simple sequential implementation instead of using StateGraph
 */
export async function executeThinkingWorkflow(
  userId: string, 
  input: string
): Promise<ThinkingState> {
  try {
    // Create initial state
    let state = createInitialState(userId, input);
    
    // Execute the workflow steps sequentially
    state = await retrieveContextNode(state);
    state = await analyzeIntentNode(state);
    state = await extractEntitiesNode(state);
    state = await assessDelegationNode(state);
    
    // Conditional branch
    if (state.shouldDelegate) {
      state = await delegateTaskNode(state);
    } else {
      state = await planExecutionNode(state);
      state = await selectToolsNode(state);
      state = await applyReasoningNode(state);
    }
    
    // Generate final response
    state = await generateResponseNode(state);
    
    return state;
  } catch (error) {
    console.error('Error executing thinking workflow:', error);
    throw new Error(`Thinking workflow failed: ${error instanceof Error ? error.message : String(error)}`);
  }
} 