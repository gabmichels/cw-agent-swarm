/**
 * Message formatters for agent communication
 */

import { MemoryEntry } from '../base/managers/MemoryManager.interface';

/**
 * Format conversation history from memory entries into a format suitable for LLM
 * 
 * @param memories Array of memory entries representing conversation history
 * @param currentInput Current user input (optional)
 * @param customSystemPrompt Custom system prompt to use (optional, falls back to default)
 * @returns Array of formatted messages for LLM
 */
export function formatConversationToMessages(
  memories: MemoryEntry[],
  currentInput?: string,
  customSystemPrompt?: string
): Array<{ role: string; content: string }> {
  // Use custom system prompt if provided, otherwise fall back to default
  const systemPrompt = customSystemPrompt || 'You are a helpful assistant. Provide concise, accurate, and helpful responses.';
  
  const messages: Array<{ role: string; content: string }> = [
    { 
      role: 'system', 
      content: systemPrompt
    }
  ];
  
  // Add conversation history from memories
  for (const memory of memories) {
    const type = memory.metadata.type as string;
    
    if (type === 'user_input') {
      messages.push({
        role: 'user',
        content: memory.content
      });
    } else if (type === 'agent_response') {
      messages.push({
        role: 'assistant',
        content: memory.content
      });
    }
  }
  
  // Add current input if provided
  if (currentInput) {
    messages.push({
      role: 'user',
      content: currentInput
    });
  }
  
  return messages;
} 