import { ThinkingState, Intent } from '../types';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from 'langchain/output_parsers';
import { z } from 'zod';

// Define a schema for structured intent output
const intentSchema = z.object({
  primary: z.object({
    name: z.string().describe("The primary intent of the user's message"),
    confidence: z.number().min(0).max(1).describe("Confidence score between 0 and 1"),
    description: z.string().describe("A brief description of what the user wants")
  }),
  alternatives: z.array(
    z.object({
      name: z.string().describe("Alternative possible intent"),
      confidence: z.number().min(0).max(1).describe("Confidence score between 0 and 1")
    })
  ).describe("Alternative possible intents, ordered by decreasing confidence")
});

// Create a structured output parser
const parser = StructuredOutputParser.fromZodSchema(intentSchema);

/**
 * Node for analyzing user intent from input
 * Uses an LLM to determine the user's primary intent and alternatives
 */
export async function analyzeIntentNode(state: ThinkingState): Promise<ThinkingState> {
  try {
    if (!state.input) {
      console.warn('Missing input for intent analysis');
      return {
        ...state,
        intent: {
          name: 'unknown',
          confidence: 0.1
        }
      };
    }
    
    // Get relevant context for the analysis
    const contextMemories = state.contextMemories || [];
    const contextText = contextMemories.length > 0
      ? `Related context:\n${contextMemories.map(m => `- ${m.content}`).join('\n')}`
      : 'No relevant context available.';
    
    // Create an LLM instance
    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      temperature: 0.2,
    });
    
    // Create a prompt template for intent analysis
    const systemPrompt = `
You are an expert in understanding user intent. Analyze the following message and determine 
the primary intent and possible alternative intents.

${parser.getFormatInstructions()}
    `;
    
    const promptTemplate = ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      ["human", "User message: {input}\n\n{context}"]
    ]);
    
    // Format the messages with user input and context
    const chain = promptTemplate.pipe(model).pipe(parser);
    
    // Invoke the chain
    const parsedOutput = await chain.invoke({
      input: state.input,
      context: contextText
    });
    
    // Convert to Intent format
    const intent: Intent = {
      name: parsedOutput.primary.name,
      confidence: parsedOutput.primary.confidence,
      alternatives: parsedOutput.alternatives
    };
    
    // Add description as a reasoning item if it exists
    const reasoning = [];
    if (parsedOutput.primary.description) {
      reasoning.push(`Intent analysis: ${parsedOutput.primary.description}`);
    }
    
    console.log(`Analyzed intent: ${intent.name} (${intent.confidence.toFixed(2)})`);
    
    // Return updated state with intent
    return {
      ...state,
      intent,
      reasoning: [...(state.reasoning || []), ...reasoning]
    };
  } catch (error) {
    console.error('Error in analyzeIntentNode:', error);
    // Don't fail the workflow - return a fallback intent
    return {
      ...state,
      intent: {
        name: 'error_analyzing_intent',
        confidence: 0.1,
        alternatives: []
      },
      reasoning: [...(state.reasoning || []), `Error analyzing intent: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
} 