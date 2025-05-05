/**
 * Helper functions for integrating memory usage tracking with the agent system
 */

import { getMemoryServices } from '../../server/memory/services';
import { MemoryType } from '../../server/memory/config';

/**
 * Extract memory IDs from a list of memory records
 */
function extractMemoryIds(memories: any[]): string[] {
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
  memories: any[] | null | undefined,
  responseQuality?: number
): Promise<number> {
  if (!memories || memories.length === 0) {
    return 0;
  }
  
  const memoryIds = extractMemoryIds(memories);
  
  try {
    const { memoryService } = await getMemoryServices();
    let updateCount = 0;
    
    for (const id of memoryIds) {
      try {
        // Update the memory metadata to mark it as used
        await memoryService.updateMemory({
          id,
          type: MemoryType.MESSAGE, // Assuming most used memories are messages
          metadata: {
            lastUsedAt: new Date().toISOString(),
            usageContext: context,
            usageCount: 1, // This would ideally increment the existing count
            responseQuality: responseQuality || undefined
          }
        });
        updateCount++;
      } catch (error) {
        console.error(`Error marking memory ${id} as used:`, error);
      }
    }
    
    return updateCount;
  } catch (error) {
    console.error('Error in trackUsedMemories:', error);
    return 0;
  }
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
  memories: any[] | null | undefined
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
  memories: any[] | null | undefined,
  responseQuality?: number
): Promise<number> {
  return trackUsedMemories('response generation', memories, responseQuality);
}

/**
 * Handle user feedback about a response and reinforce memories if needed
 * Call this when the user explicitly indicates a response was helpful
 * 
 * @param memories Memories that were used in the response
 * @param feedbackType Type of feedback (e.g., "helpful", "accurate", "important")
 * @returns Number of memories reinforced
 */
export async function handleUserFeedback(
  memories: any[] | null | undefined,
  feedbackType: 'helpful' | 'accurate' | 'important' | string = 'helpful'
): Promise<number> {
  if (!memories || memories.length === 0) {
    return 0;
  }
  
  try {
    const { memoryService } = await getMemoryServices();
    const memoryIds = extractMemoryIds(memories);
    let updateCount = 0;
    
    for (const id of memoryIds) {
      try {
        // Update the memory metadata to reinforce its importance
        await memoryService.updateMemory({
          id,
          type: MemoryType.MESSAGE, // Assuming most memories are messages
          metadata: {
            reinforced: true,
            reinforcedAt: new Date().toISOString(),
            reinforceReason: `user_feedback_${feedbackType}`,
            importance: 'high' // Increase importance based on user feedback
          }
        });
        updateCount++;
      } catch (error) {
        console.error(`Error reinforcing memory ${id}:`, error);
      }
    }
    
    return updateCount;
  } catch (error) {
    console.error('Error in handleUserFeedback:', error);
    return 0;
  }
}

/**
 * Detect if user message contains explicit feedback about helpfulness
 * Used to trigger reinforcement of memories
 * 
 * @param message User message to analyze
 * @returns True if message contains positive feedback
 */
export function detectPositiveFeedback(message: string): boolean {
  if (!message) return false;
  
  const lowercaseMessage = message.toLowerCase();
  
  // Patterns that indicate positive feedback
  const positivePatterns = [
    /that(?:'s| is| was)? (?:very |really |super |extremely )?(?:helpful|useful|good|great|excellent)/i,
    /thank(?:s| you)(?: so much| a lot| very much)?/i,
    /exactly what i (?:needed|wanted|was looking for)/i,
    /that(?:'s| is| was) (?:perfect|spot on|exactly right)/i,
    /good (?:job|work|answer)/i,
    /(?:very|really) (?:informative|interesting|valuable)/i,
    /this (?:helps|helped|is helpful|was helpful)/i,
    /just what i (?:needed|wanted)/i
  ];
  
  // Check if any pattern matches
  return positivePatterns.some(pattern => pattern.test(lowercaseMessage));
}

/**
 * Mark a memory as critical to prevent decay
 * 
 * @param memories Memories to mark as critical
 * @param reason Reason for marking as critical
 * @returns Number of memories successfully marked
 */
export async function markMemoriesAsCritical(
  memories: any[] | null | undefined,
  reason: string = 'agent_decision'
): Promise<number> {
  if (!memories || memories.length === 0) {
    return 0;
  }
  
  try {
    const { memoryService } = await getMemoryServices();
    const memoryIds = extractMemoryIds(memories);
    let updateCount = 0;
    
    for (const id of memoryIds) {
      try {
        // Update the memory metadata to mark it as critical
        await memoryService.updateMemory({
          id,
          type: MemoryType.MESSAGE, // Assuming most memories are messages
          metadata: {
            critical: true,
            criticalReason: reason,
            markedCriticalAt: new Date().toISOString(),
            importance: 'critical' // Set highest importance
          }
        });
        updateCount++;
      } catch (error) {
        console.error(`Error marking memory ${id} as critical:`, error);
      }
    }
    
    console.log(`Marked ${updateCount}/${memoryIds.length} memories as critical (${reason})`);
    return updateCount;
  } catch (error) {
    console.error('Error in markMemoriesAsCritical:', error);
    return 0;
  }
} 