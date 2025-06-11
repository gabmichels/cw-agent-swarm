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
 * Interface for agent context (matching thinking state pattern)
 */
export interface AgentContext {
  agentPersona?: {
    capabilities?: string[];
  };
  contextUsed?: {
    tools?: Array<string | { name: string; [key: string]: any }>;
  };
  availableTools?: string[];
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
  
  /** Agent context for dynamic tool discovery */
  agentContext?: AgentContext;
  
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
 * Dynamically discover available tools from the agent context
 * (Matches the pattern from classifyRequestTypeNode.ts)
 */
async function discoverAgentTools(agentContext?: AgentContext): Promise<string[]> {
  try {
    // Try to get tools from agent context if available
    if (agentContext?.agentPersona?.capabilities) {
      return agentContext.agentPersona.capabilities;
    }
    
    // Try to get from explicit availableTools
    if (agentContext?.availableTools) {
      return agentContext.availableTools;
    }
    
    // Try to get from thinking context
    if (agentContext?.contextUsed?.tools) {
      return agentContext.contextUsed.tools.map((tool: any) => 
        typeof tool === 'string' ? tool : tool.name || 'unknown_tool'
      );
    }
    
    // Fallback: return common tools (this maintains backward compatibility)
    return [
      'general_llm_capabilities',
      'text_processing',
      'analysis',
      'reasoning',
      'send_message' // Add send_message as available tool
    ];
  } catch (error) {
    console.warn('Failed to discover agent tools in PromptFormatter:', error);
    return ['general_llm_capabilities', 'send_message']; // Safe fallback
  }
}

/**
 * Build dynamic capabilities context based on agent's actual tools
 * (Adapted from classifyRequestTypeNode.ts buildDynamicToolContext)
 */
async function buildDynamicCapabilitiesContext(availableTools: string[]): Promise<string> {
  // Categorize tools by functionality
  const toolCategories = {
    messaging: availableTools.filter(tool => 
      tool.toLowerCase().includes('send_message') || 
      tool.toLowerCase().includes('message') || 
      tool.toLowerCase().includes('chat') ||
      tool.toLowerCase().includes('schedule')
    ),
    coda: availableTools.filter(tool => tool.toLowerCase().includes('coda')),
    web: availableTools.filter(tool => 
      tool.toLowerCase().includes('web') || 
      tool.toLowerCase().includes('search') ||
      tool.toLowerCase().includes('browse')
    ),
    social: availableTools.filter(tool => 
      tool.toLowerCase().includes('twitter') || 
      tool.toLowerCase().includes('instagram') || 
      tool.toLowerCase().includes('social')
    ),
    data: availableTools.filter(tool => 
      tool.toLowerCase().includes('data') || 
      tool.toLowerCase().includes('market') || 
      tool.toLowerCase().includes('crypto') ||
      tool.toLowerCase().includes('api')
    ),
    llm: availableTools.filter(tool => 
      tool.toLowerCase().includes('llm') || 
      tool.toLowerCase().includes('text') || 
      tool.toLowerCase().includes('analysis') ||
      tool.toLowerCase().includes('reasoning')
    )
  };
  
  let context = `## AVAILABLE CAPABILITIES\n`;
  context += `Based on your currently registered tools, you can:\n\n`;
  
  // Messaging & Scheduling capabilities
  if (toolCategories.messaging.length > 0) {
    context += `### MESSAGE SCHEDULING & DELIVERY\n`;
    context += `✅ **Available Tools**: ${toolCategories.messaging.join(', ')}\n`;
    context += `- Send messages to specific chat IDs with scheduling capabilities\n`;
    context += `- Schedule messages to be delivered at specific times\n`;
    context += `- Create and manage scheduled tasks for future execution\n`;
    context += `- Deliver automated reminders and notifications\n\n`;
  }
  
  // Coda capabilities
  if (toolCategories.coda.length > 0) {
    context += `### DOCUMENT & DATA MANAGEMENT\n`;
    context += `✅ **Available Tools**: ${toolCategories.coda.join(', ')}\n`;
    context += `- Create and manage Coda documents\n`;
    context += `- Update tables and databases\n`;
    context += `- Manage structured data workflows\n\n`;
  }
  
  // Web capabilities
  if (toolCategories.web.length > 0) {
    context += `### WEB & SEARCH CAPABILITIES\n`;
    context += `✅ **Available Tools**: ${toolCategories.web.join(', ')}\n`;
    context += `- Search the web for real-time information\n`;
    context += `- Browse websites and extract data\n`;
    context += `- Access current information and news\n\n`;
  }
  
  // Social media capabilities
  if (toolCategories.social.length > 0) {
    context += `### SOCIAL MEDIA INTEGRATION\n`;
    context += `✅ **Available Tools**: ${toolCategories.social.join(', ')}\n`;
    context += `- Search and analyze social media content\n`;
    context += `- Post to social media platforms\n`;
    context += `- Monitor social media trends\n\n`;
  }
  
  // Data & API capabilities
  if (toolCategories.data.length > 0) {
    context += `### DATA & API ACCESS\n`;
    context += `✅ **Available Tools**: ${toolCategories.data.join(', ')}\n`;
    context += `- Access real-time market data\n`;
    context += `- Fetch information from external APIs\n`;
    context += `- Process and analyze live data\n\n`;
  }
  
  // Core LLM capabilities
  if (toolCategories.llm.length > 0) {
    context += `### CORE REASONING CAPABILITIES\n`;
    context += `✅ **Available Tools**: ${toolCategories.llm.join(', ')}\n`;
    context += `- Advanced text processing and analysis\n`;
    context += `- Complex reasoning and problem-solving\n`;
    context += `- Context-aware conversation management\n\n`;
  }
  
  // Add critical instruction for the LLM
  context += `**🎯 IMPORTANT OPERATIONAL NOTES**:\n`;
  context += `- When users request functionality covered by your available tools, you CAN fulfill these requests\n`;
  context += `- The system will automatically execute the appropriate tools on your behalf\n`;
  context += `- You should respond confidently about your capabilities listed above\n`;
  context += `- For scheduling requests, use natural language time expressions (e.g., "in 10 minutes", "tomorrow at 3pm")\n`;
  
  // Identify missing common tools for transparency
  const commonTools = ['coda_create_document', 'web_search', 'twitter_search', 'send_message', 'market_data'];
  const missingCommon = commonTools.filter(tool => 
    !availableTools.some(available => available.toLowerCase().includes(tool.split('_')[0]))
  );
  
  if (missingCommon.length > 0) {
    context += `\n**⚠️ NOT AVAILABLE**: This agent does not have access to: ${missingCommon.join(', ')}\n`;
    context += `For requests requiring these capabilities, you should explain the limitation.\n`;
  }
  
  return context;
}

/**
 * A utility class for formatting prompts with consistent structure
 */
export class PromptFormatter {
  /**
   * Format a system prompt with persona information and dynamic capabilities
   * 
   * @param options System prompt options
   * @returns Formatted system prompt as string
   */
  static async formatSystemPrompt(options: SystemPromptOptions): Promise<string> {
    const { 
      basePrompt, 
      persona, 
      includeCapabilities = false,
      agentContext,
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
    
    // Add dynamic capabilities information if requested
    if (includeCapabilities) {
      // 🎯 Dynamic tool discovery (matches classifyRequestTypeNode pattern)
      const availableTools = await discoverAgentTools(agentContext);
      console.log(`🔧 PromptFormatter discovered ${availableTools.length} available tools:`, availableTools);
      
      // Build dynamic capabilities context
      const capabilitiesContext = await buildDynamicCapabilitiesContext(availableTools);
      systemPrompt += '\n\n' + capabilitiesContext;
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
   * Legacy synchronous version for backward compatibility
   * @deprecated Use the async version for dynamic tool discovery
   */
  static formatSystemPromptSync(options: SystemPromptOptions): string {
    console.warn('PromptFormatter.formatSystemPrompt is now async. Consider updating your code.');
    
    const { 
      basePrompt, 
      persona, 
      includeCapabilities = false,
      additionalContext = []
    } = options;
    
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
    
    // Add basic capabilities (fallback for sync version)
    if (includeCapabilities) {
      systemPrompt += '\n\n## AVAILABLE CAPABILITIES';
      systemPrompt += '\n\n### CORE CAPABILITIES';
      systemPrompt += '\n- Text processing and analysis';
      systemPrompt += '\n- Reasoning and problem-solving';
      systemPrompt += '\n- Context-aware conversation';
      systemPrompt += '\n\n**Note**: For full dynamic capability detection, use the async version.';
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