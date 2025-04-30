// Memory module exports
// This file exports the Memory class and memory-related functions

export { Memory as AgentMemory } from './src/memory';
export { Memory } from './src/memory';

// Memory system using server-side Qdrant
import { Memory } from './src/memory';
import * as serverQdrant from '../../server/qdrant';

export default Memory;

// Initialize memory system
export async function initMemory(options?: { useOpenAI?: boolean }): Promise<boolean> {
  try {
    console.log('Initializing memory system');
    await serverQdrant.initMemory({
      useOpenAI: options?.useOpenAI || process.env.USE_OPENAI_EMBEDDINGS === 'true'
    });
    return true;
  } catch (error) {
    console.error('Failed to initialize memory:', error);
    return false;
  }
}

// Add a memory
export async function addMemory(
  content: string, 
  metadata: Record<string, any> = {}
): Promise<string | null> {
  try {
    console.log('Adding memory:', content.substring(0, 50) + (content.length > 50 ? '...' : ''));
    return await serverQdrant.addMemory(
      metadata.type || 'thought',
      content,
      metadata
    );
  } catch (error) {
    console.error('Failed to add memory:', error);
    return null;
  }
}

// Search memory
export async function searchMemory(
  query: string,
  options: { limit?: number; filter?: Record<string, any> } = {}
): Promise<any[]> {
  try {
    console.log('Searching memory for:', query);
    return await serverQdrant.searchMemory(
      null,
      query,
      {
        limit: options.limit || 5,
        filter: options.filter
      }
    );
  } catch (error) {
    console.error('Failed to search memory:', error);
    return [];
  }
}

// Get relevant context
export async function getContext(
  query: string,
  limit: number = 5
): Promise<string[]> {
  try {
    console.log('Getting context for:', query);
    const results = await serverQdrant.searchMemory(null, query, { limit });
    
    if (results.length === 0) {
      return [];
    }
    
    return results.map(result => result.text);
  } catch (error) {
    console.error('Failed to get context:', error);
    return [];
  }
} 