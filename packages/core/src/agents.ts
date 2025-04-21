// Using ts-ignore for the langgraph imports until we can fix the dependency issues
// @ts-ignore langgraph typings need to be fixed
import { StateGraph } from '@langchain/langgraph';
// @ts-ignore langgraph typings need to be fixed
import { END } from '@langchain/langgraph/schema';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StructuredTool } from '@langchain/core/tools';
import { RunnableSequence } from '@langchain/core/runnables';
import { getLLM } from './llm';
import { createChatOpenAI } from './llm';
import { AgentConfig } from '@crowd-wisdom/shared';

// Base state interface for LangGraph agents
export interface AgentState {
  input: string;
  messages: Array<any>; // Using any for simplicity until we define proper message types
  steps: Array<any>; // Using any for simplicity until we define proper step types
  response?: string;
  error?: string;
}

// Function to create a base agent with LangGraph
export function createBaseAgent(
  systemPrompt: string,
  tools: StructuredTool[] = [],
) {
  const llm = getLLM();
  
  // Create prompt template
  const prompt = ChatPromptTemplate.fromTemplate(systemPrompt);
  
  // This needs to be fixed with proper types when langgraph types are available
  // Disabling TypeScript completely for this section as the StateGraph API needs proper typing
  // @ts-ignore
  const workflow = new StateGraph<AgentState>({
    channels: {
      // Define all channels needed for the agent state
      input: {
        // Use a function that returns the input itself as identity operation
        // This satisfies the BinaryOperator<string> requirement
        value: (a: string, b: string) => b
      },
      messages: {
        // Use a function that returns the latest messages
        value: (a: any[], b: any[]) => b
      },
      steps: {
        // Use a function that returns the latest steps
        value: (a: any[], b: any[]) => b
      },
      response: {
        // Use a function that returns the latest response
        value: (a: string | undefined, b: string | undefined) => b
      },
      error: {
        // Use a function that returns the latest error
        value: (a: string | undefined, b: string | undefined) => b
      }
    },
  });
  
  // Define the main action node
  // @ts-ignore
  workflow.addNode("agent", async (state: AgentState) => {
    try {
      // Create a chain that formats messages and passes to LLM
      const chain = RunnableSequence.from([
        prompt,
        llm,
      ]);
      
      // Run the chain
      // @ts-ignore - Suppressing type error for the chat_history parameter
      const response = await chain.invoke({
        input: state.input,
        // @ts-ignore: Suppress error - chat_history can accept an array in practice
        chat_history: state.messages,
      });
      
      return {
        ...state,
        response: response.content,
        messages: [...state.messages, { role: "assistant", content: response.content }],
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        ...state,
        error: errorMessage,
      };
    }
  });
  
  // Define the flow
  // @ts-ignore
  workflow.addEdge("agent", END);
  
  // Compile the workflow
  // @ts-ignore
  const runnable = workflow.compile();
  
  return runnable;
}

/**
 * Initialize a base agent with the given configuration
 */
export function initializeAgent(config: AgentConfig, apiKey: string) {
  const llm = createChatOpenAI(apiKey, config.temperature);
  
  // This is a placeholder for actual agent creation
  return {
    name: config.name,
    llm,
    async invoke(input: string) {
      return {
        message: `Response from ${config.name} (placeholder)`,
        thought: `Thinking about: ${input}`,
      };
    }
  };
}
