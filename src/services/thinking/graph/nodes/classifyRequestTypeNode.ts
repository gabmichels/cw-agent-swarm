import { ThinkingState } from '../types';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

// Enhanced schema to include tool availability analysis
const requestTypeSchema = z.object({
  type: z.enum(['PURE_LLM_TASK', 'EXTERNAL_TOOL_TASK', 'SCHEDULED_TASK']).describe("Classification of the request type"),
  confidence: z.number().min(0).max(1).describe("Confidence score between 0 and 1"),
  reasoning: z.string().describe("Explanation of why this classification was chosen"),
  requiredTools: z.array(z.string()).describe("List of tools that would be needed for this request"),
  availableTools: z.array(z.string()).describe("List of tools that are currently available to this agent"),
  missingTools: z.array(z.string()).describe("List of required tools that are not available to this agent"),
  delegationSuggested: z.boolean().describe("Whether this task should be delegated due to missing tools"),
  suggestedSchedule: z.object({
    timeExpression: z.string().nullable().optional().describe("Natural language time expression from user (e.g., 'in 2 minutes', 'tomorrow at 3pm', 'next Friday')"),
    recurring: z.boolean().optional().describe("Whether this should be a recurring task"),
    intervalExpression: z.string().optional().describe("Interval expression like '1h', '1d', 'weekly' if recurring")
  }).optional().describe("Scheduling information if this is a scheduled task")
});

/**
 * Dynamically discover available tools from the agent
 */
async function discoverAgentTools(state: ThinkingState): Promise<string[]> {
  try {
    // 🎯 PRIMARY: Try to get tools from the agent instance if available
    if (state.metadata?.agent && typeof state.metadata.agent === 'object') {
      const agent = state.metadata.agent;
      console.log('🔧 Found agent instance in metadata, discovering tools...');
      
      // Try to get tools from the agent's tool manager
      if (typeof agent.getManager === 'function') {
        try {
          const toolManager = agent.getManager('tools');
          if (toolManager && typeof (toolManager as any).getAllTools === 'function') {
            const tools = await (toolManager as any).getAllTools();
            const toolNames = tools.map((tool: any) => tool.name || tool.id || 'unknown_tool');
            console.log(`🎯 Discovered ${toolNames.length} tools from agent tool manager:`, toolNames);
            return toolNames;
          }
        } catch (toolError) {
          console.warn('Failed to get tools from agent tool manager:', toolError);
        }
      }
      
      // Try getAvailableToolNames method if exists
      if (typeof (agent as any).getAvailableToolNames === 'function') {
        try {
          const toolNames = await (agent as any).getAvailableToolNames();
          console.log(`🎯 Discovered ${toolNames.length} tools from agent.getAvailableToolNames():`, toolNames);
          return toolNames;
        } catch (toolError) {
          console.warn('Failed to get tools from agent.getAvailableToolNames():', toolError);
        }
      }
      
      // Try getRegisteredTools method if exists
      if (typeof (agent as any).getRegisteredTools === 'function') {
        try {
          const tools = (agent as any).getRegisteredTools();
          const toolNames = tools.map((tool: any) => typeof tool === 'string' ? tool : tool.name || tool.id || 'unknown_tool');
          console.log(`🎯 Discovered ${toolNames.length} tools from agent.getRegisteredTools():`, toolNames);
          return toolNames;
        } catch (toolError) {
          console.warn('Failed to get tools from agent.getRegisteredTools():', toolError);
        }
      }
    }
    
    // Try to get tools from agent context if available
    if (state.agentPersona?.capabilities) {
      console.log('🔧 Using tools from state.agentPersona.capabilities:', state.agentPersona.capabilities);
      return state.agentPersona.capabilities;
    }
    
    // Try to get from thinking context
    if (state.contextUsed?.tools) {
      const toolNames = state.contextUsed.tools.map((tool: any) => typeof tool === 'string' ? tool : tool.name || 'unknown_tool');
      console.log('🔧 Using tools from state.contextUsed.tools:', toolNames);
      return toolNames;
    }
    
    // Fallback: return common tools (this maintains backward compatibility)
    console.warn('🔧 No agent tools found, using fallback tools');
    return [
      'general_llm_capabilities',
      'text_processing',
      'analysis',
      'reasoning',
      'send_message' // Add send_message as available tool
    ];
  } catch (error) {
    console.warn('Failed to discover agent tools:', error);
    return ['general_llm_capabilities', 'send_message']; // Safe fallback
  }
}

/**
 * Build dynamic tool context based on agent's actual capabilities
 */
async function buildDynamicToolContext(availableTools: string[]): Promise<string> {
  const toolCategories = {
    coda: availableTools.filter(tool => tool.toLowerCase().includes('coda')),
    web: availableTools.filter(tool => tool.toLowerCase().includes('web') || tool.toLowerCase().includes('search')),
    social: availableTools.filter(tool => tool.toLowerCase().includes('twitter') || tool.toLowerCase().includes('instagram') || tool.toLowerCase().includes('social')),
    data: availableTools.filter(tool => tool.toLowerCase().includes('data') || tool.toLowerCase().includes('market') || tool.toLowerCase().includes('crypto')),
    llm: availableTools.filter(tool => tool.toLowerCase().includes('llm') || tool.toLowerCase().includes('text') || tool.toLowerCase().includes('analysis'))
  };
  
  let context = `Available Tools for This Agent:\n`;
  
  if (toolCategories.coda.length > 0) {
    context += `1. CODA TOOLS: ${toolCategories.coda.join(', ')}\n`;
  }
  
  if (toolCategories.web.length > 0) {
    context += `2. WEB TOOLS: ${toolCategories.web.join(', ')}\n`;
  }
  
  if (toolCategories.social.length > 0) {
    context += `3. SOCIAL MEDIA TOOLS: ${toolCategories.social.join(', ')}\n`;
  }
  
  if (toolCategories.data.length > 0) {
    context += `4. DATA TOOLS: ${toolCategories.data.join(', ')}\n`;
  }
  
  if (toolCategories.llm.length > 0) {
    context += `5. LLM CAPABILITIES: ${toolCategories.llm.join(', ')}\n`;
  }
  
  // Add context about missing common tools
  const commonTools = ['coda_create_document', 'web_search', 'twitter_search', 'market_data'];
  const missingCommon = commonTools.filter(tool => !availableTools.some(available => available.includes(tool.split('_')[0])));
  
  if (missingCommon.length > 0) {
    context += `\nNOTE: This agent does NOT have access to: ${missingCommon.join(', ')}\n`;
    context += `Consider delegation for tasks requiring these tools.\n`;
  }
  
  return context;
}

/**
 * Node for classifying request type to enable smart routing
 * Now with dynamic tool discovery and delegation awareness
 */
export async function classifyRequestTypeNode(state: ThinkingState): Promise<ThinkingState> {
  try {
    if (!state.input || !state.intent) {
      console.warn('Missing input or intent for request type classification');
      return {
        ...state,
        requestType: {
          type: 'PURE_LLM_TASK',
          confidence: 0.5,
          reasoning: 'Missing input or intent, defaulting to pure LLM task',
          requiredTools: [],
          availableTools: [],
          missingTools: [],
          delegationSuggested: false
        }
      };
    }

    // 🎯 KEY: Dynamic tool discovery
    const availableTools = await discoverAgentTools(state);
    console.log(`🔧 Discovered ${availableTools.length} available tools for agent:`, availableTools);

    // Create an LLM instance (use cheap model for classification)
    const model = new ChatOpenAI({
      modelName: 'gpt-3.5-turbo',
      temperature: 0.1,
      maxTokens: 600, // Increased for richer analysis
    });

    // 🚀 Build dynamic tool context
    const dynamicToolContext = await buildDynamicToolContext(availableTools);

    // Enhanced system message with delegation awareness
    const systemMessage = `You are an expert at classifying user requests and analyzing tool requirements.

Analyze the user's request and classify it into one of three categories:

1. **PURE_LLM_TASK**: Can be fulfilled using LLM knowledge and reasoning alone
2. **EXTERNAL_TOOL_TASK**: Requires external tools, APIs, or real-time data  
3. **SCHEDULED_TASK**: Should be scheduled for future execution

CRITICAL SCHEDULING DETECTION:
- If the request contains time expressions like "in X minutes", "in X hours", "tomorrow", "next week", "schedule", "remind me", "send later", etc. → SCHEDULED_TASK
- If the request asks to "schedule a message", "send a message in X time", "deliver automatically" → SCHEDULED_TASK  
- If the request mentions specific timing for execution → SCHEDULED_TASK

EXAMPLES OF SCHEDULED_TASK:
- "Please schedule a message to be sent in 2 minutes"
- "Send me a reminder in 1 hour"
- "Schedule a tweet for tomorrow"
- "Deliver this message automatically in 30 minutes"

IMPORTANT: Pay attention to the available tools for this specific agent. If the user requests functionality that requires tools this agent doesn't have, suggest delegation.

For tool analysis:
- List ALL tools that would be needed for the request
- Compare against available tools
- Identify any missing tools
- Suggest delegation if critical tools are missing

Consider delegation when:
- User requests Coda documents but agent has no Coda tools
- User wants real-time data but agent has no web/API tools  
- User needs social media data but agent has no social tools

Please respond with a valid JSON object in this exact format:
{
  "type": "PURE_LLM_TASK" or "EXTERNAL_TOOL_TASK" or "SCHEDULED_TASK",
  "confidence": number between 0 and 1,
  "reasoning": "Explanation including tool availability analysis",
  "requiredTools": ["array", "of", "needed", "tools"],
  "availableTools": ["array", "of", "available", "tools"], 
  "missingTools": ["array", "of", "missing", "tools"],
  "delegationSuggested": true or false,
  "suggestedSchedule": {
    "timeExpression": "string like 1h, 1d, weekly (optional)",
    "recurring": true or false (optional), 
    "intervalExpression": "string like 1h, 1d, weekly (optional)"
  }
}`;

    const userMessage = `User Request: ${state.input}

Detected Intent: ${state.intent.name}
Intent Confidence: ${state.intent.confidence}

${dynamicToolContext}

Please classify this request, analyze tool requirements, and determine if delegation is needed.`;

    // Call the model
    const fullPrompt = `${systemMessage}\n${userMessage}`;
    const response = await model.invoke(fullPrompt);

    // Parse response
    const content = typeof response.content === 'string' ? response.content : String(response.content);
    
    let parsedOutput;
    try {
      parsedOutput = JSON.parse(content);
    } catch (jsonError) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedOutput = JSON.parse(jsonMatch[0]);
        } catch (extractError) {
          throw new Error(`Failed to parse JSON response: ${content}`);
        }
      } else {
        throw new Error(`No JSON found in response: ${content}`);
      }
    }

    // Validate and enhance the output
    const validatedOutput = requestTypeSchema.parse(parsedOutput);

    // 🎯 Enhanced request type with delegation info
    const requestType = {
      type: validatedOutput.type,
      confidence: validatedOutput.confidence,
      reasoning: validatedOutput.reasoning,
      requiredTools: validatedOutput.requiredTools || [],
      availableTools: validatedOutput.availableTools || availableTools,
      missingTools: validatedOutput.missingTools || [],
      delegationSuggested: validatedOutput.delegationSuggested || false,
      suggestedSchedule: validatedOutput.suggestedSchedule ? {
        timeExpression: validatedOutput.suggestedSchedule.timeExpression,
        recurring: validatedOutput.suggestedSchedule.recurring,
        intervalExpression: validatedOutput.suggestedSchedule.intervalExpression
      } : undefined
    };

    console.log(`🧠 Enhanced Classification: ${requestType.type} (confidence: ${requestType.confidence.toFixed(2)})`);
    console.log(`🔧 Required tools: ${requestType.requiredTools.join(', ')}`);
    console.log(`✅ Available tools: ${requestType.availableTools.length}`);
    console.log(`❌ Missing tools: ${requestType.missingTools.join(', ')}`);
    console.log(`🤝 Delegation suggested: ${requestType.delegationSuggested}`);

    // Enhanced reasoning chain
    const classificationReasoning = [
      `Request Type: ${requestType.type} (confidence: ${requestType.confidence.toFixed(2)})`,
      `Reasoning: ${requestType.reasoning}`,
      `Agent has ${requestType.availableTools.length} available tools`
    ];

    if (requestType.requiredTools.length > 0) {
      classificationReasoning.push(`Required tools: ${requestType.requiredTools.join(', ')}`);
    }

    if (requestType.missingTools.length > 0) {
      classificationReasoning.push(`⚠️ Missing tools: ${requestType.missingTools.join(', ')}`);
    }

    if (requestType.delegationSuggested) {
      classificationReasoning.push(`🤝 Delegation recommended due to missing capabilities`);
    }

    return {
      ...state,
      requestType,
      reasoning: [...(state.reasoning || []), ...classificationReasoning]
    };

  } catch (error) {
    console.error('Error in enhanced classifyRequestTypeNode:', error);
    
    // Enhanced fallback with tool info
    const availableTools = await discoverAgentTools(state).catch(() => ['general_llm_capabilities']);
    
    return {
      ...state,
      requestType: {
        type: 'PURE_LLM_TASK',
        confidence: 0.3,
        reasoning: `Enhanced classification failed: ${error instanceof Error ? error.message : String(error)}. Defaulting to pure LLM task.`,
        requiredTools: [],
        availableTools,
        missingTools: [],
        delegationSuggested: false
      },
      reasoning: [...(state.reasoning || []), `Error in enhanced classification: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
} 