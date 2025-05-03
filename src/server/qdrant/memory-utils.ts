/**
 * Utility functions for memory operations
 */

import { trackMemoryUsage } from './index';

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