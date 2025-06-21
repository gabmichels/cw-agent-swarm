import { ThinkingState } from '../types';
import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from 'langchain/output_parsers';
import { z } from 'zod';

// Define the tool interface
interface SelectedTool {
  name: string;
  reason: string;
  confidence: number;
}

// Define a schema for tool selection output
const toolSelectionSchema = z.object({
  selectedTools: z.array(
    z.object({
      name: z.string().describe("Name of the tool"),
      reason: z.string().describe("Reason why this tool is needed"),
      confidence: z.number().min(0).max(1).describe("Confidence that this tool is required (0-1)")
    })
  ).describe("Tools that should be used to execute the plan"),
  rationale: z.string().describe("Overall rationale for the tool selection")
});

// Create a structured output parser
const parser = StructuredOutputParser.fromZodSchema(toolSelectionSchema);

/**
 * Node for selecting tools for execution
 * Uses an LLM to determine which tools are needed based on the plan and intent
 */
export async function selectToolsNode(state: ThinkingState): Promise<ThinkingState> {
  try {
    if (!state.input || !state.plan || state.plan.length === 0) {
      console.warn('Missing input or plan for tool selection');
      return {
        ...state,
        tools: ['basic_response_generator'],
        reasoning: [...(state.reasoning || []), 'Limited tool selection due to missing plan']
      };
    }
    
    // Get relevant information for tool selection
    const intent = state.intent?.name || 'unknown';
    const planSteps = state.plan.join('\n- ');
    
    // Create an LLM instance
    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL_NAME || 'gpt-3.5-turbo',
      temperature: 0.2,
    });
    
    // Create a prompt template for tool selection
    const systemPrompt = `
You are an expert in selecting the right tools for a task. Based on the user's request and execution plan,
determine which tools would be most helpful to complete the task successfully.

Available tools:
- search: Search the web for information
- calculator: Perform numerical calculations
- memory_access: Access and retrieve from the agent's memory
- document_analyzer: Analyze documents and extract information
- code_interpreter: Execute and analyze code
- data_visualizer: Create visualizations of data
- calendar_tools: Access and manage calendar events
- message_composer: Compose formatted messages
- language_translator: Translate between languages
- image_analyzer: Analyze and describe images
- knowledge_graph: Access structured knowledge base

${parser.getFormatInstructions()}
    `;
    
    const promptTemplate = ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      ["human", `User request: "${state.input}"\nIntent: ${intent}\n\nExecution Plan:\n- ${planSteps}`]
    ]);
    
    // Set up the processing chain
    const chain = promptTemplate.pipe(model).pipe(parser);
    
    // Invoke the chain
    const result = await chain.invoke({});
    
    // Extract tool names and log selection
    const toolNames = result.selectedTools.map((tool: SelectedTool) => tool.name);
    console.log(`Selected tools: ${toolNames.join(', ')}`);
    
    // Create reasoning about tool selection
    const toolReasoningItems = result.selectedTools.map(
      (tool: SelectedTool) => `Selected ${tool.name} (${(tool.confidence * 100).toFixed(0)}% confidence): ${tool.reason}`
    );
    
    // Return updated state with selected tools
    return {
      ...state,
      tools: toolNames,
      reasoning: [
        ...(state.reasoning || []),
        `Tool selection rationale: ${result.rationale}`,
        ...toolReasoningItems
      ]
    };
  } catch (error) {
    console.error('Error in selectToolsNode:', error);
    // Don't fail the workflow - return basic tools
    return {
      ...state,
      tools: ['search', 'memory_access', 'basic_response_generator'],
      reasoning: [...(state.reasoning || []), `Error selecting tools: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
} 