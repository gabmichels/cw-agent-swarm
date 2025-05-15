/**
 * Helper function to process input using LangChain
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { MemoryEntry } from './base/managers/MemoryManager.interface';

/**
 * Process input using a LangChain model
 * @param model The LangChain model to use
 * @param input The input to process
 * @param conversationHistory Conversation history from memory
 * @returns The model response content
 */
export async function processInputWithLangChain(
  model: ChatOpenAI,
  input: string,
  conversationHistory: MemoryEntry[] = []
): Promise<string> {
  try {
    // Create LangChain message objects
    const messages: BaseMessage[] = [
      new SystemMessage('You are a helpful assistant. Provide concise, accurate, and helpful responses.')
    ];
    
    // Add conversation history
    for (const memory of conversationHistory) {
      const type = memory.metadata.type as string;
      
      if (type === 'user_input') {
        messages.push(new HumanMessage(memory.content));
      } else if (type === 'agent_response') {
        messages.push(new AIMessage(memory.content));
      }
    }
    
    // Add current input
    messages.push(new HumanMessage(input));
    
    // Process with LLM using LangChain message objects
    // The TypeScript typing for model.invoke is incorrect, but this works at runtime
    // @ts-ignore - We need to ignore TypeScript errors here as the LangChain types are not correctly defined
    const response = await model.invoke(messages);
    
    // Return response content
    return response.content.toString();
  } catch (error) {
    console.error('Error processing input with LangChain:', error);
    throw error;
  }
} 