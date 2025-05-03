/**
 * Helper functions for integrating memory usage tracking with the agent system
 */

import { 
  markMemoriesAsUsed, 
  reinforceMemoriesImportance,
  markMemoryCritical
} from '../../server/qdrant/memory-utils';
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

/**
 * Handle user feedback about a response and reinforce memories if needed
 * Call this when the user explicitly indicates a response was helpful
 * 
 * @param memories Memories that were used in the response
 * @param feedbackType Type of feedback (e.g., "helpful", "accurate", "important")
 * @returns Number of memories reinforced
 */
export async function handleUserFeedback(
  memories: MemoryRecord[] | null | undefined,
  feedbackType: 'helpful' | 'accurate' | 'important' | string = 'helpful'
): Promise<number> {
  if (!memories || memories.length === 0) {
    return 0;
  }
  
  const memoryIds = extractMemoryIds(memories);
  return reinforceMemoriesImportance(memoryIds, `user_feedback_${feedbackType}`);
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
  memories: MemoryRecord[] | null | undefined,
  reason: string = 'agent_decision'
): Promise<number> {
  if (!memories || memories.length === 0) {
    return 0;
  }
  
  const memoryIds = extractMemoryIds(memories);
  
  const results = await Promise.all(
    memoryIds.map(id => markMemoryCritical(id, true))
  );
  
  const successCount = results.filter(Boolean).length;
  console.log(`Marked ${successCount}/${memoryIds.length} memories as critical (${reason})`);
  
  return successCount;
} 