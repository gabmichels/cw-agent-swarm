import { ThinkingState, AgentPersona, NodeError, IAgent } from './types';
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
import { classifyRequestTypeNode } from './nodes/classifyRequestTypeNode';
import { storeCognitiveArtifactsNode } from './nodes/storeCognitiveArtifactsNode';

/**
 * Workflow execution options with proper typing
 */
export interface WorkflowExecutionOptions {
  userId: string;
  message: string;
  agent?: IAgent;
  options?: {
    agentInfo?: {
      name?: string;
      description?: string;
      systemPrompt?: string;
      capabilities?: string[];
      traits?: string[];
    };
  };
}

/**
 * Create initial state for the thinking process
 */
export function createInitialState(
  userId: string, 
  input: string, 
  agentPersona?: AgentPersona,
  agent?: IAgent
): ThinkingState {
  return {
    userId,
    input,
    agentPersona,
    contextMemories: [],
    contextFiles: [],
    entities: [],
    shouldDelegate: false,
    status: 'in_progress',
    errors: [],
    metadata: agent ? { agent } : undefined
  };
}

/**
 * Records an error that occurred during workflow execution
 */
function recordError(state: ThinkingState, nodeName: string, error: Error): ThinkingState {
  const nodeError: NodeError = {
    nodeName,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    recoveryAttempted: false
  };
  
  return {
    ...state,
    errors: [...(state.errors || []), nodeError]
  };
}

/**
 * Update a node error with recovery information
 */
function updateErrorWithRecovery(
  state: ThinkingState, 
  nodeName: string, 
  recoverySuccessful: boolean, 
  recoveryStrategy: string
): ThinkingState {
  const errors = state.errors || [];
  const updatedErrors = errors.map(error => {
    if (error.nodeName === nodeName && !error.recoveryAttempted) {
      return {
        ...error,
        recoveryAttempted: true,
        recoverySuccessful,
        recoveryStrategy
      };
    }
    return error;
  });
  
  return {
    ...state,
    errors: updatedErrors,
    status: recoverySuccessful ? 'completed' : 'failed'
  };
}

/**
 * Generate a fallback response based on the current state
 */
async function generateFallbackResponse(state: ThinkingState): Promise<string> {
  // Simple fallback response based on what we know
  const errorCount = state.errors?.length || 0;
  
  if (state.intent && errorCount === 1) {
    return `I understand you want me to ${state.intent.name.toLowerCase()}. However, I encountered an issue while processing your request. Could you please provide more details or rephrase your request?`;
  }
  
  return "I apologize, but I encountered an issue while processing your request. Could you please try again or rephrase your request?";
}

/**
 * Execute a node with error handling and recovery
 */
async function executeNodeSafely(
  state: ThinkingState,
  nodeName: string,
  nodeFunction: (state: ThinkingState) => Promise<ThinkingState>,
  recoveryStrategy?: (state: ThinkingState, error: Error) => Promise<ThinkingState>
): Promise<ThinkingState> {
  try {
    return await nodeFunction(state);
  } catch (error) {
    console.error(`Error in ${nodeName}:`, error);
    
    // Record the error
    let updatedState = recordError(state, nodeName, error instanceof Error ? error : new Error(String(error)));
    
    // Attempt recovery if strategy provided
    if (recoveryStrategy && error instanceof Error) {
      try {
        updatedState = await recoveryStrategy(updatedState, error);
        return updateErrorWithRecovery(updatedState, nodeName, true, 'Custom recovery strategy');
      } catch (recoveryError) {
        console.error(`Recovery failed for ${nodeName}:`, recoveryError);
        return updateErrorWithRecovery(updatedState, nodeName, false, 'Failed custom recovery');
      }
    }
    
    return updatedState;
  }
}

/**
 * Execute the thinking workflow
 * This is a simple sequential implementation instead of using StateGraph
 * with cognitive artifact storage after each step
 */
export async function executeThinkingWorkflow(
  options: WorkflowExecutionOptions
): Promise<ThinkingState> {
  try {
    const userId = options.userId;
    const input = options.message;
    const agent = options.agent;
    
    // Convert agentInfo to AgentPersona if present
    const agentPersona = options.options?.agentInfo ? {
      name: options.options.agentInfo.name || 'AI Assistant',
      description: options.options.agentInfo.description || 'A helpful AI assistant',
      systemPrompt: options.options.agentInfo.systemPrompt,
      capabilities: options.options.agentInfo.capabilities || [],
      traits: options.options.agentInfo.traits || []
    } : undefined;
    
    // Create initial state with agent instance
    let state = createInitialState(userId, input, agentPersona, agent);
    
    // Execute the workflow steps sequentially with error handling
    
    // Retrieve context - Critical node, cannot proceed without context
    state = await executeNodeSafely(state, 'retrieveContextNode', retrieveContextNode, 
      async (failedState) => {
        // Recovery: Continue with empty context if retrieval fails
        return {
          ...failedState,
          contextMemories: [],
          contextFiles: []
        };
      }
    );
    
    // If we've had critical errors so far, generate fallback response and exit
    if (state.errors?.some(e => !e.recoverySuccessful) && state.status === 'failed') {
      state.fallbackResponse = await generateFallbackResponse(state);
      return state;
    }
    
    // Analyze intent
    state = await executeNodeSafely(state, 'analyzeIntentNode', analyzeIntentNode,
      async (failedState) => {
        // Recovery: Set a generic intent if analysis fails
        return {
          ...failedState,
          intent: {
            name: 'get_information',
            confidence: 0.5
          }
        };
      }
    );
    
    // Classify request type for smart routing (NEW)
    state = await executeNodeSafely(state, 'classifyRequestTypeNode', classifyRequestTypeNode,
      async (failedState) => {
        // Recovery: Default to pure LLM task if classification fails
        return {
          ...failedState,
          requestType: {
            type: 'PURE_LLM_TASK',
            confidence: 0.5,
            reasoning: 'Classification failed, defaulting to pure LLM task',
            requiredTools: [],
            suggestedSchedule: undefined
          }
        };
      }
    );
    
    // Store artifacts after intent analysis and request classification
    state = await executeNodeSafely(state, 'storeCognitiveArtifactsNode_1', 
      (s) => storeCognitiveArtifactsNode(s),
      async (failedState) => {
        // Recovery: Continue without storing artifacts
        console.warn('Failed to store artifacts after intent analysis, continuing workflow');
        return failedState;
      }
    );
    
    // Extract entities
    state = await executeNodeSafely(state, 'extractEntitiesNode', extractEntitiesNode,
      async (failedState) => {
        // Recovery: Continue with empty entities
        return {
          ...failedState,
          entities: []
        };
      }
    );
    
    // Store artifacts after entity extraction
    state = await executeNodeSafely(state, 'storeCognitiveArtifactsNode_2', 
      (s) => storeCognitiveArtifactsNode(s),
      async (failedState) => {
        // Recovery: Continue without storing artifacts
        console.warn('Failed to store artifacts after entity extraction, continuing workflow');
        return failedState;
      }
    );
    
    // Assess delegation
    state = await executeNodeSafely(state, 'assessDelegationNode', assessDelegationNode,
      async (failedState) => {
        // Recovery: Don't delegate on error
        return {
          ...failedState,
          shouldDelegate: false,
          delegationReason: 'Delegation assessment failed, proceeding with direct processing'
        };
      }
    );
    
    // Store artifacts after delegation assessment
    state = await executeNodeSafely(state, 'storeCognitiveArtifactsNode_3', 
      (s) => storeCognitiveArtifactsNode(s),
      async (failedState) => {
        // Recovery: Continue without storing artifacts
        console.warn('Failed to store artifacts after delegation assessment, continuing workflow');
        return failedState;
      }
    );
    
    // Conditional branch with error handling for both paths
    if (state.shouldDelegate) {
      state = await executeNodeSafely(state, 'delegateTaskNode', delegateTaskNode,
        async (failedState) => {
          // Recovery: If delegation fails, fall back to direct processing
          console.warn('Delegation failed, falling back to direct processing');
          
          // First try to create a plan
          let recoveryState = failedState;
          recoveryState.shouldDelegate = false;
          
          try {
            recoveryState = await planExecutionNode(recoveryState);
            recoveryState = await storeCognitiveArtifactsNode(recoveryState);
            recoveryState = await selectToolsNode(recoveryState);
            recoveryState = await applyReasoningNode(recoveryState);
            recoveryState = await storeCognitiveArtifactsNode(recoveryState);
          } catch (planningError) {
            // If planning also fails, set up for simple response
            recoveryState.plan = ['Respond directly to user'];
            recoveryState.reasoning = ['Simplified reasoning due to processing errors'];
          }
          
          return recoveryState;
        }
      );
    } else {
      // Execute direct processing path
      
      // Create plan
      state = await executeNodeSafely(state, 'planExecutionNode', planExecutionNode,
        async (failedState) => {
          // Recovery: Create a minimal plan
          return {
            ...failedState,
            plan: ['Understand user request', 'Provide direct response']
          };
        }
      );
      
      // Store artifacts after planning
      state = await executeNodeSafely(state, 'storeCognitiveArtifactsNode_4', 
        (s) => storeCognitiveArtifactsNode(s),
        async (failedState) => {
          // Recovery: Continue without storing artifacts
          console.warn('Failed to store artifacts after planning, continuing workflow');
          return failedState;
        }
      );
      
      // Select tools
      state = await executeNodeSafely(state, 'selectToolsNode', selectToolsNode,
        async (failedState) => {
          // Recovery: Proceed with no tools
          return {
            ...failedState,
            tools: []
          };
        }
      );
      
      // Apply reasoning
      state = await executeNodeSafely(state, 'applyReasoningNode', applyReasoningNode,
        async (failedState) => {
          // Recovery: Create minimal reasoning
          return {
            ...failedState,
            reasoning: ['Direct response based on available information']
          };
        }
      );
      
      // Store artifacts after reasoning
      state = await executeNodeSafely(state, 'storeCognitiveArtifactsNode_5', 
        (s) => storeCognitiveArtifactsNode(s),
        async (failedState) => {
          // Recovery: Continue without storing artifacts
          console.warn('Failed to store artifacts after reasoning, continuing workflow');
          return failedState;
        }
      );
    }
    
    // Generate final response - Critical node, generate fallback if this fails
    state = await executeNodeSafely(state, 'generateResponseNode', generateResponseNode,
      async (failedState) => {
        // Recovery: Generate a simple response based on what we know
        const fallbackResponse = await generateFallbackResponse(failedState);
        return {
          ...failedState,
          response: fallbackResponse
        };
      }
    );
    
    // Store final cognitive artifacts (completion insights)
    state = await executeNodeSafely(state, 'storeCognitiveArtifactsNode_final', 
      (s) => storeCognitiveArtifactsNode(s),
      async (failedState) => {
        // Recovery: Continue without storing final artifacts
        console.warn('Failed to store final artifacts, workflow still completed');
        return failedState;
      }
    );
    
    // Mark workflow as completed if we reached this point
    state.status = 'completed';
    
    return state;
  } catch (error) {
    console.error('Unhandled error in thinking workflow:', error);
    
    // Create a minimal state with error information
    const state: ThinkingState = createInitialState(options.userId, options.message);
    state.status = 'failed';
    state.errors = [{
      nodeName: 'executeThinkingWorkflow',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      recoveryAttempted: false
    }];
    
    // Generate fallback response
    state.fallbackResponse = "I apologize, but I encountered an unexpected error. Please try again later.";
    
    return state;
  }
} 