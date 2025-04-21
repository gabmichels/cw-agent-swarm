import { RunnableSequence } from '@langchain/core/runnables';
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

  return RunnableSequence.from([
    prompt,
    llm,
    new StringOutputParser(),
  ]);
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

  return RunnableSequence.from([
    prompt,
    llm,
    new StringOutputParser(),
  ]);
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
  
  return prompt.pipe(llm).pipe(new StringOutputParser());
} 