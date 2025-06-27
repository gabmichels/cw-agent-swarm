/**
 * Utility functions for handling chat operations
 */

import { MemoryType } from '../../server/memory/config';
import { getMemoryServices } from '../../server/memory/services';
import { MessageMetadata } from '../../types/metadata';

/**
 * Generate a new response for the chat
 * This is a placeholder implementation - in a real system, you would call your 
 * actual chat generation logic that interacts with the LLM
 */
export async function generateResponse(
  conversationHistory: string[],
  avoidContent?: string
): Promise<string> {
  try {
    // In a real implementation, this would:
    // 1. Get the user's recent messages from the conversation history
    // 2. Add system instructions to avoid the flagged content
    // 3. Call the LLM to generate a new response
    // 4. Return the generated response

    // This is just a placeholder
    return "I've generated a new response that avoids the previously flagged content.";
  } catch (error) {
    console.error('Error generating response:', error);
    throw new Error('Failed to generate response');
  }
}

/**
 * Get recent conversation history
 */
export async function getConversationHistory(
  limit: number = 10
): Promise<string[]> {
  try {
    // Get memory services
    const { searchService } = await getMemoryServices();

    // Get recent messages from memory using the search service
    const searchResults = await searchService.search("", {
      types: [MemoryType.MESSAGE],
      limit
    });

    // Sort by timestamp if available (most recent first)
    const sorted = searchResults.sort((a: any, b: any) => {
      const metadataA = a.point.payload?.metadata as MessageMetadata | undefined;
      const metadataB = b.point.payload?.metadata as MessageMetadata | undefined;

      const timeA = metadataA?.timestamp || '';
      const timeB = metadataB?.timestamp || '';

      // If both are strings or both are numbers, use direct comparison
      if (typeof timeA === 'string' && typeof timeB === 'string') {
        return timeB.localeCompare(timeA); // Descending order
      } else if (typeof timeA === 'number' && typeof timeB === 'number') {
        return timeB - timeA; // Descending order
      } else {
        // Convert to date objects for comparison when mixed types
        const dateA = new Date(timeA).getTime();
        const dateB = new Date(timeB).getTime();
        return dateB - dateA; // Descending order
      }
    });

    // Format messages as strings
    return sorted.map((result: any) => {
      const msg = result.point;
      const metadata = msg.payload?.metadata as MessageMetadata | undefined;
      const role = metadata?.role || 'unknown';
      return `${role}: ${msg.payload?.text || ''}`;
    });
  } catch (error) {
    console.error('Error getting conversation history:', error);
    return [];
  }
} 