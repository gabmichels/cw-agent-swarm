import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { ThinkingState } from '../types';

/**
 * Filter memory context to prevent intent contamination
 * This prevents meeting requests from being contaminated by email context and vice versa
 */
function filterMemoryContextByIntent(memoryContext: string, currentIntent: string, currentInput: string): string {
  if (!memoryContext || !currentIntent) {
    return memoryContext;
  }

  // Define intent categories and their keywords
  const intentCategories = {
    scheduling: ['schedule', 'meeting', 'calendar', 'appointment', 'book', 'plan meeting', 'set up meeting'],
    email: ['send email', 'email', 'compose', 'draft', 'message to', 'mail to', 'write email'],
    communication: ['send', 'message', 'contact', 'reach out'],
    search: ['search', 'find', 'look for', 'show me'],
    analysis: ['analyze', 'review', 'check', 'examine']
  };

  // Determine current intent category
  const currentIntentLower = currentIntent.toLowerCase();
  const currentInputLower = currentInput.toLowerCase();

  let currentCategory = 'general';
  for (const [category, keywords] of Object.entries(intentCategories)) {
    if (keywords.some(keyword => currentIntentLower.includes(keyword) || currentInputLower.includes(keyword))) {
      currentCategory = category;
      break;
    }
  }

  // Split memory context into individual messages/entries
  const memoryLines = memoryContext.split('\n');
  const filteredLines: string[] = [];

  for (const line of memoryLines) {
    const lineLower = line.toLowerCase();

    // Always keep structure lines (headers, separators, etc.)
    if (line.startsWith('##') || line.startsWith('###') || line.trim() === '' || line.includes('Message') || line.includes('Previous')) {
      filteredLines.push(line);
      continue;
    }

    // For scheduling requests, filter out email-specific content
    if (currentCategory === 'scheduling') {
      // Exclude messages that are primarily about sending emails
      if (lineLower.includes('send email') ||
        lineLower.includes('email about') ||
        lineLower.includes('compose email') ||
        lineLower.includes('draft email') ||
        (lineLower.includes('bitcoin') && lineLower.includes('gold')) ||
        (lineLower.includes('investment') && lineLower.includes('email'))) {
        console.log('🚫 FILTERING OUT email-related memory for scheduling request:', line.substring(0, 100));
        continue; // Skip this line
      }
    }

    // For email requests, filter out scheduling-specific content  
    if (currentCategory === 'email') {
      // Exclude messages that are primarily about scheduling
      if (lineLower.includes('schedule meeting') ||
        lineLower.includes('book meeting') ||
        lineLower.includes('calendar event') ||
        lineLower.includes('set up meeting')) {
        console.log('🚫 FILTERING OUT scheduling-related memory for email request:', line.substring(0, 100));
        continue; // Skip this line
      }
    }

    // Keep the line if it passes the filters
    filteredLines.push(line);
  }

  const filteredContext = filteredLines.join('\n');

  // Log the filtering results
  if (filteredContext.length !== memoryContext.length) {
    console.log(`📋 MEMORY CONTEXT FILTERED: ${currentCategory} intent`);
    console.log(`Original length: ${memoryContext.length}, Filtered length: ${filteredContext.length}`);
    console.log(`Removed ${memoryContext.length - filteredContext.length} characters of irrelevant context`);
  }

  return filteredContext;
}

/**
 * Node for generating the final response
 * Uses an LLM to create a comprehensive, high-quality response based on the entire thinking process
 */
export async function generateResponseNode(state: ThinkingState): Promise<ThinkingState> {
  try {
    if (!state.input) {
      console.warn('Missing input for response generation');
      return {
        ...state,
        response: "I'm sorry, but I don't have enough information to provide a helpful response. Could you please provide more details about what you'd like assistance with?"
      };
    }

    // Get relevant information for response generation
    const intent = state.intent?.name || 'unknown';
    const entities = state.entities || [];
    const entitiesText = entities.length > 0
      ? `Key entities: ${entities.map(e => `${e.value} (${e.type})`).join(', ')}`
      : '';

    // Format the reasoning for context
    const reasoning = state.reasoning || [];
    const reasoningText = reasoning.length > 0
      ? `Based on the following reasoning:\n${reasoning.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
      : 'Without any specific reasoning path';

    // Format plan for context
    const plan = state.plan || [];
    const planText = plan.length > 0
      ? `Following this plan:\n${plan.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
      : '';

    // Get any tool results
    const toolResults = state.toolResults || {};
    const hasToolResults = Object.keys(toolResults).length > 0;

    // Format tool results for context if available
    const toolResultsText = hasToolResults
      ? `Using these tool results:\n${Object.entries(toolResults).map(([tool, result]) =>
        `- ${tool}: ${typeof result === 'object' ? JSON.stringify(result) : result}`
      ).join('\n')}`
      : '';

    // Include memory context if available, but filter for intent relevance
    let memoryContext = state.formattedMemoryContext || '';

    // 🚨 CRITICAL FIX: Filter memory context to prevent intent contamination
    // This prevents scheduling requests from being contaminated by email context and vice versa
    if (memoryContext && intent) {
      memoryContext = filterMemoryContextByIntent(memoryContext, intent, state.input);
    }

    const memoryContextText = memoryContext ? `\nRelevant Memory Context:\n${memoryContext}` : '';

    // 🚨 ENHANCED: Add specific logging for factual information requests
    const isFactualInfoRequest = intent.toLowerCase().includes('personal') ||
      intent.toLowerCase().includes('birthdate') ||
      intent.toLowerCase().includes('birthday') ||
      intent.toLowerCase().includes('address') ||
      intent.toLowerCase().includes('verification') ||
      intent.toLowerCase().includes('price') ||
      intent.toLowerCase().includes('date') ||
      intent.toLowerCase().includes('number') ||
      intent.toLowerCase().includes('statistic') ||
      intent.toLowerCase().includes('fact') ||
      intent.toLowerCase().includes('data') ||
      intent.toLowerCase().includes('when') ||
      intent.toLowerCase().includes('how much') ||
      intent.toLowerCase().includes('what is') ||
      intent.toLowerCase().includes('tell me');

    if (isFactualInfoRequest) {
      console.log('🔍 FACTUAL INFO REQUEST DETECTED');
      console.log('Memory context available:', !!memoryContext);
      console.log('Memory context length:', memoryContext.length);
      console.log('Memory context preview:', memoryContext.substring(0, 200));

      if (!memoryContext || memoryContext.length < 50) {
        console.log('⚠️  WARNING: Very little memory context for factual info request!');
      }
    }

    // Create an LLM instance with lower temperature for more consistent output
    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL_NAME || 'gpt-3.5-turbo',
      temperature: 0.4,
    });

    // Create a prompt template for response generation
    const systemPrompt = `
You are an AI assistant providing helpful, accurate, and thoughtful responses to users.
You have gone through an extensive thinking process to understand the user's request,
and now you need to formulate a clear, concise response.

This response should:
1. Directly address the user's intent
2. Be comprehensive yet concise
3. Be well-structured and easy to understand
4. Provide accurate information
5. Be conversational and engaging

IMPORTANT: Use the provided memory context to remember previous interactions and information shared by the user.
This ensures your response is consistent with what you've already been told and prevents asking for information
that the user has already provided.

🚨 CRITICAL DATA ACCURACY REQUIREMENTS:
- NEVER invent, fabricate, or guess ANY factual information (dates, numbers, names, addresses, prices, statistics, etc.)
- If you don't have specific information in your memory context, explicitly state "I don't have that information"
- ONLY provide factual claims that are explicitly present in your memory context or well-established general knowledge
- Do NOT use partially redacted formats like "19****83" or "***City, State" - this is fabrication
- If memory retrieval fails or context is incomplete, say "I couldn't access the relevant information" rather than guessing
- When asked for specific facts, data, or verification, reference ONLY what appears in the memory context section
- Be precise about what you know vs. what you don't know - uncertainty is better than fabrication

Do not explain your thinking process or reasoning in the response unless explicitly asked.
Focus on delivering value in your answer.
Do not prefix your response with phrases like "Based on my analysis" or "I understand you want to know about..."
Just provide the helpful response directly.
    `;

    // Build the context information for the response generation
    let contextInfo = `
Intent: ${intent}
${entitiesText}

${reasoningText}

${planText}

${toolResultsText}${memoryContextText}
`.trim();

    // Log the context and memories passed to LLM
    console.log('🧠🧠🧠 context and memories passed to LLM 🧠🧠🧠');
    console.log(contextInfo);
    console.log('🧠🧠🧠 end context and memories block 🧠🧠🧠');

    const promptTemplate = ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      ["human", `User request: "${state.input}"\n\n${contextInfo}\n\nGenerate an excellent response to the user that addresses their request.`]
    ]);

    // Create and run the chain
    const chain = promptTemplate.pipe(model);

    // Generate the response
    const result = await chain.invoke({});

    // Extract the content from the response
    const response = result.content.toString();

    console.log('Generated response with length:', response.length);

    // Return updated state with the response
    return {
      ...state,
      response
    };
  } catch (error) {
    console.error('Error in generateResponseNode:', error);
    // Don't fail the workflow - return a fallback response
    return {
      ...state,
      response: `I apologize, but I encountered an issue while generating a response to your query: "${state.input}". Please try again or rephrase your request.`
    };
  }
} 