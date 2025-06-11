/**
 * LLM Service Adapter for Agent Messaging
 * 
 * Adapts existing LLM infrastructure to work with the agent messaging system.
 * Uses OPENAI_CHEAP_MODEL for cost-effective message generation since the smart
 * thinking has already happened before message generation.
 */

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { AgentLLMService } from './message-generator';
import { CHEAP_LLM_MODEL } from '../../lib/shared/constants';

// ============================================================================
// LLM Service Implementation for Agent Messaging
// ============================================================================

export class OpenAIMessagingLLMService implements AgentLLMService {
  private readonly llm: ChatOpenAI;

  constructor() {
    // Use cheap model for messaging since smart thinking already happened
    const modelName = process.env.OPENAI_CHEAP_MODEL || CHEAP_LLM_MODEL;
    
    this.llm = new ChatOpenAI({
      modelName,
      temperature: 0.3, // Low temperature for consistent, focused messaging
      maxTokens: process.env.OPENAI_MAX_TOKENS || 8000, // Messages should be concise
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 10000 // 10 second timeout - messaging should be fast
    });

    console.log(`Initialized OpenAI messaging LLM with model: ${modelName}`);
  }

  /**
   * Generate response using OpenAI LLM for agent messaging
   */
  async generateResponse(
    systemPrompt: string,
    userMessage: string,
    context?: Record<string, unknown>
  ): Promise<string> {
    try {
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userMessage)
      ];

      // @ts-ignore - LangChain types are not correctly defined for message arrays
      const response = await this.llm.invoke(messages);
      
      // Handle response content - it should be a string or have a toString method
      return response.content.toString();

    } catch (error) {
      console.error('Error generating message with OpenAI LLM:', {
        error: error instanceof Error ? error.message : String(error),
        systemPromptLength: systemPrompt.length,
        userMessageLength: userMessage.length,
        context
      });

      // Return a fallback message instead of throwing
      return "I wanted to update you, but I'm having trouble generating a proper message right now. Please let me know if you need any assistance.";
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an LLM service instance for agent messaging
 */
export function createMessagingLLMService(): AgentLLMService {
  return new OpenAIMessagingLLMService();
} 