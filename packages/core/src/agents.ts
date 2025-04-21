import { StateGraph, END } from 'langgraph';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StructuredTool } from '@langchain/core/tools';
import { RunnableSequence } from '@langchain/core/runnables';
import { getLLM } from './llm';

// Base state interface for LangGraph agents
export interface AgentState {
  input: string;
  messages: Array<any>;
  steps: Array<any>;
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
  
  // Define the agent state graph
  const workflow = new StateGraph<AgentState>({
    channels: {
      input: {
        value: "",
      },
      messages: {
        value: [],
      },
      steps: {
        value: [],
      },
      response: {
        value: undefined,
      },
      error: {
        value: undefined,
      }
    },
  });
  
  // Define the main action node
  workflow.addNode("agent", async (state) => {
    try {
      // Create a chain that formats messages and passes to LLM
      const chain = RunnableSequence.from([
        prompt,
        llm,
      ]);
      
      // Run the chain
      const response = await chain.invoke({
        input: state.input,
        chat_history: state.messages,
      });
      
      return {
        ...state,
        response: response.content,
        messages: [...state.messages, { role: "assistant", content: response.content }],
      };
    } catch (error) {
      return {
        ...state,
        error: error.message,
      };
    }
  });
  
  // Define the flow
  workflow.addEdge("agent", END);
  
  // Compile the workflow
  const runnable = workflow.compile();
  
  return runnable;
} 