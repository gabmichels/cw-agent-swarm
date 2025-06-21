import { ThinkingState, Entity } from '../types';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from 'langchain/output_parsers';
import { z } from 'zod';

// Define a schema for structured entity output
const entityListSchema = z.object({
  entities: z.array(
    z.object({
      type: z.string().describe("Type of entity (e.g., person, location, datetime, product, organization, etc.)"),
      value: z.string().describe("The actual entity value extracted from the text"),
      confidence: z.number().min(0).max(1).describe("Confidence score between 0 and 1"),
      metadata: z.object({
        start: z.number().optional().describe("Start position in text (optional)"),
        end: z.number().optional().describe("End position in text (optional)"),
        context: z.string().optional().describe("Surrounding context for this entity (optional)")
      }).optional()
    })
  ).describe("List of entities extracted from the text")
});

// Create a structured output parser
const parser = StructuredOutputParser.fromZodSchema(entityListSchema);

/**
 * Node for extracting entities from user input
 * Uses an LLM to identify and extract entities with their types and confidence scores
 */
export async function extractEntitiesNode(state: ThinkingState): Promise<ThinkingState> {
  try {
    if (!state.input) {
      console.warn('Missing input for entity extraction');
      return {
        ...state,
        entities: []
      };
    }
    
    // Use intent if available for more targeted extraction
    const intent = state.intent?.name || 'unknown';
    
    // Create an LLM instance
    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL_NAME || 'gpt-3.5-turbo',
      temperature: 0.1, // Lower temperature for more consistent entity extraction
    });
    
    // Create a prompt template for entity extraction
    const systemPrompt = `
You are an expert in extracting structured entities from text. Extract all relevant entities from the user message.
Focus on extracting entities that would be relevant for a request with intent: "${intent}".

Examples of entity types: person, location, datetime, duration, organization, product, service, code, language, amount, etc.
Only extract entities that are clearly present in the text. Do not infer entities that aren't explicitly mentioned.

${parser.getFormatInstructions()}
    `;
    
    const promptTemplate = ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      ["human", "User message: {input}"]
    ]);
    
    // Set up the processing chain
    const chain = promptTemplate.pipe(model).pipe(parser);
    
    // Invoke the chain
    const result = await chain.invoke({
      input: state.input
    });
    
    // Convert to Entity format for the state
    const entities: Entity[] = result.entities.map((entity: any) => ({
      type: entity.type,
      value: entity.value,
      confidence: entity.confidence
    }));
    
    console.log(`Extracted ${entities.length} entities`);
    
    // Return updated state with entities
    return {
      ...state,
      entities
    };
  } catch (error) {
    console.error('Error in extractEntitiesNode:', error);
    // Don't fail the workflow - return empty entities
    return {
      ...state,
      entities: [],
      reasoning: [...(state.reasoning || []), `Error extracting entities: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
} 