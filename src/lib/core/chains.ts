import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { getLLM } from './llm';
import { createChatOpenAI } from './llm';

// Simple QA chain with chat history support
export const createQAChain = (
  systemPrompt: string = 'You are a helpful AI assistant.'
) => {
  const llm = getLLM();
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
    new MessagesPlaceholder('chat_history'),
    ['human', '{input}'],
  ]);

  // Use any to bypass type issues
  return {
    invoke: async (input: any) => {
      const promptValue = await prompt.invoke(input);
      const llmResult = await llm.invoke(promptValue as any);
      const parser = new StringOutputParser();
      return parser.invoke(llmResult as any);
    }
  };
};

// Reflection chain for agent introspection
export const createReflectionChain = () => {
  const llm = getLLM({ temperature: 0.2 });
  const prompt = ChatPromptTemplate.fromTemplate(`
    You are an AI assistant reflecting on your past decisions and actions.
    Please analyze the following conversation history and answer the reflection question.
    
    Conversation History:
    {history}
    
    Reflection Question: {question}
    
    Please provide a thoughtful analysis based on the conversation history.
  `);

  // Use any to bypass type issues
  return {
    invoke: async (input: any) => {
      const promptValue = await prompt.invoke(input);
      const llmResult = await llm.invoke(promptValue as any);
      const parser = new StringOutputParser();
      return parser.invoke(llmResult as any);
    }
  };
};

/**
 * Create a simple chain for generating text
 */
export function createTextGenerationChain(apiKey: string, systemPrompt: string) {
  const llm = createChatOpenAI(apiKey);
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
    ['human', '{input}'],
  ]);
  
  // Use any to bypass type issues
  return {
    invoke: async (input: any) => {
      const promptValue = await prompt.invoke(input);
      const llmResult = await llm.invoke(promptValue as any);
      const parser = new StringOutputParser();
      return parser.invoke(llmResult as any);
    }
  };
} 