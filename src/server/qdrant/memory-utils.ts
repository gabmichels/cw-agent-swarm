/**
 * Utility functions for memory operations
 */

import { 
  trackMemoryUsage, 
  reinforceMemory, 
  decayMemoryImportance, 
  markMemoryAsCritical,
  MemoryRecord 
} from './index';

/**
 * Track the usage of a memory that was successfully used to answer a query.
 * Call this function when a memory is used in a response to increment its usage count.
 * 
 * @param memoryId The ID of the memory that was used
 * @param context Optional context about how the memory was used
 * @returns Promise resolving to true if the tracking was successful
 */
export async function markMemoryAsUsed(
  memoryId: string, 
  context: string = ''
): Promise<boolean> {
  console.log(`Marking memory ${memoryId} as used${context ? ` (${context})` : ''}`);
  return trackMemoryUsage(memoryId);
}

/**
 * Track the usage of multiple memories that were used to answer a query
 * 
 * @param memoryIds Array of memory IDs that were used
 * @param context Optional context about how the memories were used
 * @returns Promise resolving to the number of successfully tracked memories
 */
export async function markMemoriesAsUsed(
  memoryIds: string[],
  context: string = ''
): Promise<number> {
  if (!memoryIds || memoryIds.length === 0) {
    return 0;
  }
  
  console.log(`Marking ${memoryIds.length} memories as used${context ? ` (${context})` : ''}`);
  
  const results = await Promise.all(
    memoryIds.map(id => trackMemoryUsage(id))
  );
  
  const successCount = results.filter(Boolean).length;
  console.log(`Successfully tracked usage for ${successCount}/${memoryIds.length} memories`);
  
  return successCount;
}

/**
 * Explicitly reinforce a memory as being helpful or important
 * This increases its importance score by 20%
 * 
 * @param memoryId The ID of the memory to reinforce
 * @param reason Optional reason for reinforcement
 * @returns Promise resolving to true if reinforcement was successful
 */
export async function reinforceMemoryImportance(
  memoryId: string,
  reason: string = 'explicit_reinforcement'
): Promise<boolean> {
  console.log(`Reinforcing memory ${memoryId} (${reason})`);
  return reinforceMemory(memoryId, reason);
}

/**
 * Reinforce multiple memories at once
 * 
 * @param memoryIds Array of memory IDs to reinforce
 * @param reason Optional reason for reinforcement
 * @returns Promise resolving to the number of successfully reinforced memories
 */
export async function reinforceMemoriesImportance(
  memoryIds: string[],
  reason: string = 'explicit_reinforcement'
): Promise<number> {
  if (!memoryIds || memoryIds.length === 0) {
    return 0;
  }
  
  console.log(`Reinforcing ${memoryIds.length} memories (${reason})`);
  
  const results = await Promise.all(
    memoryIds.map(id => reinforceMemory(id, reason))
  );
  
  const successCount = results.filter(Boolean).length;
  console.log(`Successfully reinforced ${successCount}/${memoryIds.length} memories`);
  
  return successCount;
}

/**
 * Mark a memory as critical, preventing it from being decayed
 * 
 * @param memoryId The ID of the memory to mark as critical
 * @param isCritical Whether to mark the memory as critical (true) or not (false)
 * @returns Promise resolving to true if marking was successful
 */
export async function markMemoryCritical(
  memoryId: string,
  isCritical: boolean = true
): Promise<boolean> {
  console.log(`Marking memory ${memoryId} as ${isCritical ? 'critical' : 'non-critical'}`);
  return markMemoryAsCritical(memoryId, isCritical);
}

/**
 * Run a decay pass on memory importance scores
 * This should be scheduled to run periodically (e.g., weekly)
 * 
 * @param options Configuration options for the decay process
 * @returns Promise resolving to stats about the decay operation
 */
export async function runMemoryDecay(options: {
  decayPercent?: number;
  olderThan?: number;
  dryRun?: boolean;
  maxMemories?: number;
} = {}): Promise<{
  processed: number;
  decayed: number;
  exempted: number;
  errors: number;
  dryRun: boolean;
}> {
  console.log('Running memory decay process');
  return decayMemoryImportance(options);
} 