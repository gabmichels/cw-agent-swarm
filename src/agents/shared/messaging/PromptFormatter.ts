import { SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';

/**
 * Interface for scored memory
 */
export interface ScoredMemory {
  id: string;
  content: string;
  metadata: Record<string, any>;
  relevanceScore: number;
  relevanceType: string;
  recency: number;
}

/**
 * Interface for persona information
 */
export interface PersonaInfo {
  /** Background information about the persona */
  background?: string;
  
  /** Personality traits and characteristics */
  personality?: string;
  
  /** Communication style preferences */
  communicationStyle?: string;
  
  /** Knowledge areas and domains */
  expertise?: string[];
  
  /** Additional preferences or settings */
  preferences?: Record<string, string>;
}

/**
 * Options for formatting system prompts
 */
export interface SystemPromptOptions {
  /** Base system prompt (instructions) */
  basePrompt: string;
  
  /** Persona information to include */
  persona?: PersonaInfo;
  
  /** Whether to include agent capabilities */
  includeCapabilities?: boolean;
  
  /** Additional context relevant to the conversation */
  additionalContext?: string[];
  
  /** Custom formatting template */
  template?: string;
}

/**
 * Options for formatting input prompts
 */
export interface InputPromptOptions {
  /** The user input to process */
  input: string;
  
  /** Conversation history context */
  conversationHistory?: Array<{ role: 'human' | 'assistant' | 'system', content: string }>;
  
  /** Max tokens to consider from history */
  maxHistoryTokens?: number;
  
  /** Max messages to include in history */
  maxHistoryMessages?: number;
  
  /** Whether to include relevant memories */
  includeRelevantMemories?: boolean;
  
  /** Relevant memories to include */
  relevantMemories?: ScoredMemory[];
  
  /** Additional context for this specific input */
  inputContext?: Record<string, unknown>;
}

/**
 * A utility class for formatting prompts with consistent structure
 */
export class PromptFormatter {
  /**
   * Format a system prompt with persona information and context
   * 
   * @param options System prompt options
   * @returns Formatted system prompt as string
   */
  static formatSystemPrompt(options: SystemPromptOptions): string {
    const { 
      basePrompt, 
      persona, 
      includeCapabilities = false,
      additionalContext = []
    } = options;
    
    // Start with the base prompt
    let systemPrompt = basePrompt.trim();
    
    // Add persona information if provided
    if (persona) {
      systemPrompt += '\n\n## PERSONA INFORMATION';
      
      if (persona.background) {
        systemPrompt += `\n\n### BACKGROUND\n${persona.background}`;
      }
      
      if (persona.personality) {
        systemPrompt += `\n\n### PERSONALITY\n${persona.personality}`;
      }
      
      if (persona.communicationStyle) {
        systemPrompt += `\n\n### COMMUNICATION STYLE\n${persona.communicationStyle}`;
      }
      
      if (persona.expertise && persona.expertise.length > 0) {
        systemPrompt += `\n\n### EXPERTISE\n${persona.expertise.join(', ')}`;
      }
      
      if (persona.preferences && Object.keys(persona.preferences).length > 0) {
        systemPrompt += '\n\n### PREFERENCES';
        for (const [key, value] of Object.entries(persona.preferences)) {
          systemPrompt += `\n- ${key}: ${value}`;
        }
      }
    }
    
    // Add additional context if provided
    if (additionalContext.length > 0) {
      systemPrompt += '\n\n## ADDITIONAL CONTEXT';
      for (const context of additionalContext) {
        systemPrompt += `\n\n${context}`;
      }
    }
    
    return systemPrompt;
  }
  
  /**
   * Format relevant memories into a string for inclusion in a prompt
   * 
   * @param memories Array of scored memories
   * @returns Formatted memory string
   */
  static formatRelevantMemories(memories: ScoredMemory[]): string {
    if (!memories || memories.length === 0) {
      return '';
    }
    
    let result = '## RELEVANT MEMORIES\n\n';
    
    // Group memories by relevance type
    const criticalMemories = memories.filter(m => m.relevanceType === 'critical');
    const highMemories = memories.filter(m => m.relevanceType === 'high');
    const mediumMemories = memories.filter(m => m.relevanceType === 'medium');
    
    // Format critical memories first
    if (criticalMemories.length > 0) {
      result += '### CRITICAL INFORMATION\n';
      criticalMemories.forEach(memory => {
        result += `- ${memory.content}\n`;
      });
      result += '\n';
    }
    
    // Format high-relevance memories
    if (highMemories.length > 0) {
      result += '### HIGHLY RELEVANT\n';
      highMemories.forEach(memory => {
        result += `- ${memory.content}\n`;
      });
      result += '\n';
    }
    
    // Format medium-relevance memories
    if (mediumMemories.length > 0) {
      result += '### RELATED CONTEXT\n';
      mediumMemories.forEach(memory => {
        result += `- ${memory.content}\n`;
      });
    }
    
    return result;
  }
  
  /**
   * Create an array of messages for a LangChain chat model
   * 
   * @param systemPrompt The system prompt
   * @param options Input prompt options
   * @returns Array of LangChain message objects
   */
  static createChatMessages(systemPrompt: string, options: InputPromptOptions): Array<SystemMessage | HumanMessage | AIMessage> {
    const { 
      input, 
      conversationHistory = [],
      maxHistoryMessages = 10,
      relevantMemories = []
    } = options;
    
    // Start with the system message
    let enhancedSystemPrompt = systemPrompt;
    
    // Add relevant memories if provided
    if (relevantMemories.length > 0) {
      const memoryText = this.formatRelevantMemories(relevantMemories);
      enhancedSystemPrompt += '\n\n' + memoryText;
    }
    
    const messages: Array<SystemMessage | HumanMessage | AIMessage> = [
      new SystemMessage(enhancedSystemPrompt)
    ];
    
    // Add conversation history, respecting the max history messages limit
    const limitedHistory = conversationHistory.slice(-maxHistoryMessages);
    
    for (const message of limitedHistory) {
      if (message.role === 'human') {
        messages.push(new HumanMessage(message.content));
      } else if (message.role === 'assistant') {
        messages.push(new AIMessage(message.content));
      } else if (message.role === 'system') {
        // Update the system message with additional context
        messages[0] = new SystemMessage(messages[0].content + '\n\n' + message.content);
      }
    }
    
    // Add the current input message
    messages.push(new HumanMessage(input));
    
    return messages;
  }
  
  /**
   * Format a conversation history into a standardized format
   * 
   * @param memories Array of memory objects with content and metadata
   * @returns Formatted conversation history
   */
  static formatConversationHistory(memories: Array<{
    content: string; 
    metadata: { type: string; [key: string]: any };
  }>): Array<{ role: 'human' | 'assistant' | 'system', content: string }> {
    return memories.map(memory => {
      const type = memory.metadata.type as string;
      
      if (type === 'user_input') {
        return { role: 'human', content: memory.content };
      } else if (type === 'agent_response') {
        return { role: 'assistant', content: memory.content };
      } else if (type === 'system_message') {
        return { role: 'system', content: memory.content };
      } else {
        // Default to system message for other types
        return { role: 'system', content: memory.content };
      }
    });
  }
} 