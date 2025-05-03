/**
 * Helper functions for integrating memory usage tracking with the agent system
 */

import { markMemoriesAsUsed } from '../../server/qdrant/memory-utils';
import { MemoryRecord } from '../../server/qdrant/index';

/**
 * Extract memory IDs from a list of memory records
 */
function extractMemoryIds(memories: MemoryRecord[]): string[] {
  return memories.filter(m => m && m.id).map(m => m.id);
}

/**
 * Track memories that were used to generate a response
 * 
 * @param context Information about where the memories were used
 * @param memories Array of memory records that were used 
 * @param responseQuality Optional quality indicator (1-5) to weight tracking
 * @returns Promise that resolves to the number of successfully tracked memories
 */
export async function trackUsedMemories(
  context: string,
  memories: MemoryRecord[] | null | undefined,
  responseQuality?: number
): Promise<number> {
  if (!memories || memories.length === 0) {
    return 0;
  }
  
  const memoryIds = extractMemoryIds(memories);
  
  // If a response quality is provided, we could use it to weight the tracking
  // (not implemented in this version, but could be added in the future)
  
  return markMemoriesAsUsed(memoryIds, context);
}

/**
 * Integrate with the agent's thought generation to track which memories 
 * were used during thinking and reflections
 * 
 * Usage:
 * ```
 * // Inside the agent's thinking/reflection function:
 * const relevantMemories = await searchMemory(...);
 * const thought = generateThought(relevantMemories, prompt);
 * await trackThoughtMemories(relevantMemories);
 * ```
 */
export async function trackThoughtMemories(
  memories: MemoryRecord[] | null | undefined
): Promise<number> {
  return trackUsedMemories('thought generation', memories);
}

/**
 * Integrate with the agent's response generation to track which memories 
 * were used to create a user response
 * 
 * Usage:
 * ```
 * // Inside the agent's response generation function:
 * const relevantMemories = await searchMemory(query, options);
 * const response = generateResponse(relevantMemories, query);
 * await trackResponseMemories(relevantMemories);
 * ```
 */
export async function trackResponseMemories(
  memories: MemoryRecord[] | null | undefined,
  responseQuality?: number
): Promise<number> {
  return trackUsedMemories('response generation', memories, responseQuality);
} 