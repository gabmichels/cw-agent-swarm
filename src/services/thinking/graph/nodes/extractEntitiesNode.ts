import { ThinkingState, Entity } from '../types';

/**
 * Node for extracting entities from user input
 */
export async function extractEntitiesNode(state: ThinkingState): Promise<ThinkingState> {
  console.log('Stub implementation of extractEntitiesNode');
  // In a real implementation, this would use an LLM to extract entities
  
  // Add placeholder entities to the state
  const entities: Entity[] = [
    { type: 'stub_entity_type', value: 'stub_entity_value', confidence: 0.9 }
  ];
  
  return {
    ...state,
    entities
  };
} 