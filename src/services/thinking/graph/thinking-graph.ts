import { ThinkingState } from './types';
import { ThinkingOptions } from '../types';
import { retrieveContextNode } from './nodes/retrieveContextNode';
import { analyzeIntentNode } from './nodes/analyzeIntentNode';
import { extractEntitiesNode } from './nodes/extractEntitiesNode';
import { assessDelegationNode } from './nodes/assessDelegationNode';
import { delegateTaskNode } from './nodes/delegateTaskNode';
import { applyReasoningNode } from './nodes/applyReasoningNode';
import { planExecutionNode } from './nodes/planExecutionNode';
import { selectToolsNode } from './nodes/selectToolsNode';
import { generateResponseNode } from './nodes/generateResponseNode';

/**
 * Create and execute the thinking workflow graph
 */
export async function executeThinkingGraph(
  input: string,
  options: ThinkingOptions = {}
): Promise<ThinkingState> {
  console.log('🔄 Starting thinking graph execution');
  
  // Initialize thinking state with runtime properties
  const state = {
    input,
    userId: options.userId || ''
  } as ThinkingState & { 
    startTime: number;
    endTime?: number;
  };
  
  // Add runtime properties not in the interface
  state.startTime = Date.now();
  
  // Execute thinking workflow nodes in sequence with proper error handling
  try {
    console.log('🧠 EXECUTING NODE: retrieveContextNode');
    const stateWithContext = await retrieveContextNode(state);
    
    // Log memory context after retrieval
    if (stateWithContext.formattedMemoryContext) {
      console.log('🧠🧠🧠 MEMORY CONTEXT AFTER RETRIEVAL 🧠🧠🧠');
      console.log(`Memory context length: ${stateWithContext.formattedMemoryContext.length} chars`);
      console.log(stateWithContext.formattedMemoryContext);
      console.log('🧠🧠🧠 END MEMORY CONTEXT 🧠🧠🧠');
    } else {
      console.log('⚠️ No formattedMemoryContext after retrieveContextNode');
    }
    
    console.log('🧠 EXECUTING NODE: analyzeIntentNode');
    const stateWithIntent = await analyzeIntentNode(stateWithContext);
    
    console.log('🧠 EXECUTING NODE: extractEntitiesNode');
    const stateWithEntities = await extractEntitiesNode(stateWithIntent);
    
    console.log('🧠 EXECUTING NODE: assessDelegationNode');
    const stateWithDelegation = await assessDelegationNode(stateWithEntities);
    
    // Check if delegation is recommended
    if (stateWithDelegation.shouldDelegate && stateWithDelegation.delegationTarget) {
      console.log(`🧠 EXECUTING NODE: delegateTaskNode (delegating to ${stateWithDelegation.delegationTarget})`);
      return await delegateTaskNode(stateWithDelegation);
    }
    
    console.log('🧠 EXECUTING NODE: applyReasoningNode');
    const stateWithReasoning = await applyReasoningNode(stateWithDelegation);
    
    console.log('🧠 EXECUTING NODE: planExecutionNode');
    const stateWithPlan = await planExecutionNode(stateWithReasoning);
    
    console.log('🧠 EXECUTING NODE: selectToolsNode');
    const stateWithTools = await selectToolsNode(stateWithPlan);
    
    // Log memory context before response generation
    if (stateWithTools.formattedMemoryContext) {
      console.log('🧠🧠🧠 MEMORY CONTEXT BEFORE RESPONSE GENERATION 🧠🧠🧠');
      console.log(`Memory context length: ${stateWithTools.formattedMemoryContext.length} chars`);
      console.log(stateWithTools.formattedMemoryContext.substring(0, 1000) + (stateWithTools.formattedMemoryContext.length > 1000 ? '...' : ''));
      console.log('🧠🧠🧠 END MEMORY CONTEXT 🧠🧠🧠');
    } else {
      console.log('⚠️ No formattedMemoryContext before generateResponseNode');
    }
    
    console.log('🧠 EXECUTING NODE: generateResponseNode');
    const finalState = await generateResponseNode(stateWithTools);
    
    console.log(`🏁 Thinking graph execution completed in ${Date.now() - state.startTime}ms`);
    return finalState;
  } catch (error) {
    console.error('❌ Error in thinking graph execution:', error);
    
    // Return error state with as much info as possible
    return {
      ...state,
      errors: [{
        nodeName: 'unknown',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        recoveryAttempted: false
      }],
      status: 'failed',
      endTime: Date.now()
    } as ThinkingState;
  }
} 