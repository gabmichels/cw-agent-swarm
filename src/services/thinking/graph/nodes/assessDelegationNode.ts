import { ThinkingState } from '../types';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from 'langchain/output_parsers';
import { z } from 'zod';

// Define a schema for delegation decision output
const delegationSchema = z.object({
  shouldDelegate: z.boolean().describe("Whether the task should be delegated to another agent"),
  confidence: z.number().min(0).max(1).describe("Confidence in the delegation decision (0-1)"),
  reason: z.string().describe("Reasoning for the delegation decision"),
  specialistAgentType: z.string().optional().describe("Type of specialist agent needed, if delegation is recommended")
});

// Create a structured output parser
const parser = StructuredOutputParser.fromZodSchema(delegationSchema);

/**
 * Node for assessing whether a task should be delegated
 * Uses agent capabilities and task requirements to make delegation decisions
 */
export async function assessDelegationNode(state: ThinkingState): Promise<ThinkingState> {
  try {
    if (!state.input || !state.intent) {
      console.warn('Missing input or intent for delegation assessment');
      return {
        ...state,
        shouldDelegate: false,
        delegationReason: 'Insufficient information to make delegation decision'
      };
    }
    
    // Get agent capabilities from persona if available
    const agentCapabilities = state.agentPersona?.capabilities || ['general_assistance', 'conversation'];
    const capabilitiesText = agentCapabilities.join(', ');
    
    // Get intent and entities for context
    const intent = state.intent.name;
    const entities = state.entities || [];
    const entitiesText = entities.length > 0
      ? `Entities: ${entities.map(e => `${e.type}:${e.value}`).join(', ')}`
      : 'No entities detected';
    
    // Create an LLM instance
    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL_NAME || 'gpt-3.5-turbo',
      temperature: 0.2,
    });
    
    // Create a prompt template for delegation assessment
    const systemPrompt = `
You are an AI agent coordination expert. Your task is to determine whether the current request should be handled by this agent or delegated to a specialist agent.

This agent has the following capabilities: ${capabilitiesText}

Consider:
1. Whether the request is within the agent's capabilities
2. If specialized knowledge or skills are required
3. The complexity and domain-specificity of the request
4. Whether a specialist would provide significantly better results

Available specialist agent types: 
- code_assistant: For programming, coding, debugging tasks
- data_analyst: For data analysis, statistics, and visualization
- creative_writer: For creative writing, storytelling, content creation
- research_agent: For in-depth research on specific topics
- math_solver: For mathematical problems and equations
- legal_assistant: For legal questions and document analysis
- finance_expert: For financial analysis and advice

${parser.getFormatInstructions()}
    `;
    
    const promptTemplate = ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      ["human", `User request: "${state.input}"\nDetected intent: ${intent}\n${entitiesText}`]
    ]);
    
    // Set up the processing chain
    const chain = promptTemplate.pipe(model).pipe(parser);
    
    // Invoke the chain
    const result = await chain.invoke({});
    
    // Log the decision
    console.log(`Delegation decision: ${result.shouldDelegate ? 'Delegate' : 'Handle'} (${result.confidence.toFixed(2)} confidence)`);
    
    // Update state with delegation decision
    return {
      ...state,
      shouldDelegate: result.shouldDelegate,
      delegationReason: result.reason,
      delegationTarget: result.specialistAgentType,
      reasoning: [...(state.reasoning || []), `Delegation assessment: ${result.reason}`]
    };
  } catch (error) {
    console.error('Error in assessDelegationNode:', error);
    // Don't fail the workflow - default to not delegating
    return {
      ...state,
      shouldDelegate: false,
      delegationReason: `Error in delegation assessment: ${error instanceof Error ? error.message : String(error)}`,
      reasoning: [...(state.reasoning || []), `Error in delegation assessment: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
} 