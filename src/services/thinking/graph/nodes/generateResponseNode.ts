import { ThinkingState } from '../types';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';

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
      ? `Based on the following reasoning:\n${reasoning.map((r, i) => `${i+1}. ${r}`).join('\n')}`
      : 'Without any specific reasoning path';
    
    // Format plan for context
    const plan = state.plan || [];
    const planText = plan.length > 0
      ? `Following this plan:\n${plan.map((p, i) => `${i+1}. ${p}`).join('\n')}`
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
    
    // Create an LLM instance with lower temperature for more consistent output
    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
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

${toolResultsText}
`.trim();
    
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