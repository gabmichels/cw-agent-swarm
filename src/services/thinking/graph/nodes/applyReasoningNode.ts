import { ThinkingState } from '../types';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from 'langchain/output_parsers';
import { z } from 'zod';

// Define a schema for reasoning output
const reasoningSchema = z.object({
  reasoningChain: z.array(
    z.string().describe("A single step in the reasoning chain")
  ).describe("Step-by-step reasoning chain leading to the conclusion"),
  confidenceLevel: z.number().min(0).max(1).describe("Overall confidence in this reasoning (0-1)"),
  assumptions: z.array(
    z.string().describe("An assumption made during reasoning")
  ).describe("Key assumptions made during the reasoning process"),
  uncertainties: z.array(
    z.string().describe("An uncertainty or limitation in the reasoning")
  ).describe("Areas of uncertainty or limitations in the reasoning"),
  conclusion: z.string().describe("The final conclusion of the reasoning process")
});

// Create a structured output parser
const parser = StructuredOutputParser.fromZodSchema(reasoningSchema);

/**
 * Node for applying reasoning to the request
 * Uses an LLM to generate structured reasoning steps for how to approach the user's request
 */
export async function applyReasoningNode(state: ThinkingState): Promise<ThinkingState> {
  try {
    if (!state.input || !state.plan || state.plan.length === 0) {
      console.warn('Missing input or plan for reasoning generation');
      return {
        ...state,
        reasoning: [
          'Limited reasoning due to missing information',
          'Proceeding with basic response generation'
        ]
      };
    }
    
    // Get relevant information for reasoning
    const intent = state.intent?.name || 'unknown';
    const intent_confidence = state.intent?.confidence || 0.5;
    const entities = state.entities || [];
    const entitiesText = entities.length > 0
      ? `Entities: ${entities.map(e => `${e.type}:${e.value}`).join(', ')}`
      : 'No entities detected';
    
    const planSteps = state.plan.join('\n- ');
    const tools = state.tools?.join(', ') || 'No tools selected';
    
    // Create an LLM instance
    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      temperature: 0.3,
    });
    
    // Create a prompt template for reasoning chain generation
    const systemPrompt = `
You are an expert in analytical thinking and reasoning. Develop a clear, step-by-step reasoning chain
for how to approach the user's request.

Your reasoning should be thorough, logical, and consider all relevant information.
Make explicit any assumptions you're making, and note any areas of uncertainty.

${parser.getFormatInstructions()}
    `;
    
    const promptTemplate = ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      ["human", `User request: "${state.input}"
Intent: ${intent} (${(intent_confidence * 100).toFixed(0)}% confidence)
${entitiesText}

Execution Plan:
- ${planSteps}

Selected Tools: ${tools}

Context: Generate a reasoning chain that explains how to best handle this request.`]
    ]);
    
    // Set up the processing chain
    const chain = promptTemplate.pipe(model).pipe(parser);
    
    // Invoke the chain
    const result = await chain.invoke({});
    
    // Log the reasoning result
    console.log(`Generated reasoning chain with ${result.reasoningChain.length} steps and ${(result.confidenceLevel * 100).toFixed(0)}% confidence`);
    
    // Combine current reasoning (if any) with the new reasoning chain
    const currentReasoning = state.reasoning || [];
    const newReasoning = [
      ...result.reasoningChain,
      `Conclusion: ${result.conclusion}`
    ];
    
    // Add assumptions and uncertainties if present
    if (result.assumptions && result.assumptions.length > 0) {
      newReasoning.push('Key assumptions:');
      result.assumptions.forEach((assumption: string) => 
        newReasoning.push(`- ${assumption}`)
      );
    }
    
    if (result.uncertainties && result.uncertainties.length > 0) {
      newReasoning.push('Uncertainties:');
      result.uncertainties.forEach((uncertainty: string) => 
        newReasoning.push(`- ${uncertainty}`)
      );
    }
    
    // Return updated state with reasoning chain
    return {
      ...state,
      reasoning: [...currentReasoning, ...newReasoning]
    };
  } catch (error) {
    console.error('Error in applyReasoningNode:', error);
    // Don't fail the workflow - return basic reasoning
    return {
      ...state,
      reasoning: [
        ...(state.reasoning || []),
        'Unable to generate detailed reasoning due to an error.',
        'Proceeding with standard approach based on intent analysis.',
        `Error details: ${error instanceof Error ? error.message : String(error)}`
      ]
    };
  }
} 