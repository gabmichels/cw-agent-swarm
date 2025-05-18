import { ThinkingState, AgentPersona } from './types';
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
import { storeCognitiveArtifactsNode } from './nodes/storeCognitiveArtifactsNode';

/**
 * Create initial state for the thinking process
 */
export function createInitialState(
  userId: string, 
  input: string, 
  agentPersona?: AgentPersona
): ThinkingState {
  return {
    userId,
    input,
    agentPersona,
    contextMemories: [],
    contextFiles: [],
    entities: [],
    shouldDelegate: false
  };
}

/**
 * Execute the thinking workflow
 * This is a simple sequential implementation instead of using StateGraph
 * with cognitive artifact storage after each step
 */
export async function executeThinkingWorkflow(
  options: {
    userId: string;
    message: string;
    options?: {
      agentInfo?: {
        name?: string;
        description?: string;
        systemPrompt?: string;
        capabilities?: string[];
        traits?: string[];
      };
    }
  }
): Promise<ThinkingState> {
  try {
    const userId = options.userId;
    const input = options.message;
    
    // Convert agentInfo to AgentPersona if present
    const agentPersona = options.options?.agentInfo ? {
      name: options.options.agentInfo.name || 'AI Assistant',
      description: options.options.agentInfo.description || 'A helpful AI assistant',
      systemPrompt: options.options.agentInfo.systemPrompt,
      capabilities: options.options.agentInfo.capabilities || [],
      traits: options.options.agentInfo.traits || []
    } : undefined;
    
    // Create initial state
    let state = createInitialState(userId, input, agentPersona);
    
    // Execute the workflow steps sequentially
    state = await retrieveContextNode(state);
    
    // Analyze intent and store as cognitive artifact
    state = await analyzeIntentNode(state);
    state = await storeCognitiveArtifactsNode(state);
    
    // Extract entities and store as cognitive artifacts
    state = await extractEntitiesNode(state);
    state = await storeCognitiveArtifactsNode(state);
    
    // Assess delegation and store reasoning
    state = await assessDelegationNode(state);
    state = await storeCognitiveArtifactsNode(state);
    
    // Conditional branch
    if (state.shouldDelegate) {
      state = await delegateTaskNode(state);
    } else {
      // Create plan and store as cognitive artifact
      state = await planExecutionNode(state);
      state = await storeCognitiveArtifactsNode(state);
      
      // Select tools
      state = await selectToolsNode(state);
      
      // Apply reasoning and store as cognitive artifact
      state = await applyReasoningNode(state);
      state = await storeCognitiveArtifactsNode(state);
    }
    
    // Generate final response
    state = await generateResponseNode(state);
    
    // Store final cognitive artifacts (completion insights)
    state = await storeCognitiveArtifactsNode(state);
    
    return state;
  } catch (error) {
    console.error('Error executing thinking workflow:', error);
    throw new Error(`Thinking workflow failed: ${error instanceof Error ? error.message : String(error)}`);
  }
} 