import { ThinkingState } from '../types';

/**
 * Node for selecting tools for execution
 */
export async function selectToolsNode(state: ThinkingState): Promise<ThinkingState> {
  console.log('Stub implementation of selectToolsNode');
  // In a real implementation, this would select appropriate tools
  
  const tools = ['search', 'calculator', 'memory_access'];
  
  return {
    ...state,
    tools
  };
} 