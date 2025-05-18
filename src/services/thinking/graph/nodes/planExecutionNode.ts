import { ThinkingState } from '../types';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from 'langchain/output_parsers';
import { z } from 'zod';

// Define a schema for execution plan output
const planSchema = z.object({
  planSteps: z.array(
    z.string().describe("A single step in the execution plan")
  ).describe("Ordered list of steps to execute the plan"),
  reasoningBehindPlan: z.string().describe("Explanation of why this plan was chosen"),
  estimatedComplexity: z.number().min(1).max(10).describe("Estimated complexity (1-10) of executing this plan"),
  toolsNeeded: z.array(
    z.string().describe("Name of a tool that might be needed")
  ).describe("Tools that might be needed to execute the plan")
});

// Create a structured output parser
const parser = StructuredOutputParser.fromZodSchema(planSchema);

/**
 * Node for planning execution steps
 * Uses an LLM to generate a structured execution plan based on intent and entities
 */
export async function planExecutionNode(state: ThinkingState): Promise<ThinkingState> {
  try {
    if (!state.input || !state.intent) {
      console.warn('Missing input or intent for execution planning');
      return {
        ...state,
        plan: ['Analyze request', 'Generate response'],
        reasoning: [...(state.reasoning || []), 'Limited planning due to missing information']
      };
    }
    
    // Get relevant context for planning
    const intent = state.intent.name;
    const entities = state.entities || [];
    const entitiesText = entities.length > 0
      ? `Entities: ${entities.map(e => `${e.type}:${e.value}`).join(', ')}`
      : 'No entities detected';
    
    const contextMemories = state.contextMemories || [];
    const contextText = contextMemories.length > 0
      ? `Related context:\n${contextMemories.map(m => `- ${m.content}`).join('\n')}`
      : 'No relevant context available.';
    
    // Create an LLM instance
    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      temperature: 0.3,
    });
    
    // Create a prompt template for execution planning
    const systemPrompt = `
You are an expert in planning task execution. Create a detailed, step-by-step plan to accomplish the user's request.
The plan should be practical, efficient, and describe concrete actions to take.

For example, if the user wants information about a topic, include steps for searching, evaluating sources, and synthesizing information.
If they want to perform a task, include all necessary steps to complete it successfully.

${parser.getFormatInstructions()}
    `;
    
    const promptTemplate = ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      ["human", `User request: "${state.input}"\nDetected intent: ${intent}\n${entitiesText}\n\n${contextText}`]
    ]);
    
    // Set up the processing chain
    const chain = promptTemplate.pipe(model).pipe(parser);
    
    // Invoke the chain
    const result = await chain.invoke({});
    
    // Log the planning result
    console.log(`Generated plan with ${result.planSteps.length} steps and complexity ${result.estimatedComplexity}`);
    
    // Add reasoning to the state
    const planningReasoning = `Planning rationale: ${result.reasoningBehindPlan}`;
    const complexityNote = `Plan complexity: ${result.estimatedComplexity}/10`;
    
    // Return updated state with execution plan
    return {
      ...state,
      plan: result.planSteps,
      tools: result.toolsNeeded,
      reasoning: [...(state.reasoning || []), planningReasoning, complexityNote]
    };
  } catch (error) {
    console.error('Error in planExecutionNode:', error);
    // Don't fail the workflow - return a basic fallback plan
    return {
      ...state,
      plan: [
        'Analyze request',
        'Gather relevant information',
        'Generate appropriate response'
      ],
      reasoning: [...(state.reasoning || []), `Error generating plan: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
} 