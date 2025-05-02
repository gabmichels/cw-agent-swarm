/**
 * Utility functions for handling chat operations
 */

import * as serverQdrant from '../../server/qdrant';

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
    // Get recent messages from memory
    const recentMessages = await serverQdrant.getRecentMemories('message', limit);
    
    // Format messages as strings
    return recentMessages.map(msg => {
      const role = msg.metadata?.role || 'unknown';
      return `${role}: ${msg.text}`;
    });
  } catch (error) {
    console.error('Error getting conversation history:', error);
    return [];
  }
} 