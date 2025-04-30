import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { getLLM } from './llm';
import { config } from "./config";

/**
 * Creates a QA chain with a system prompt.
 * @param systemPrompt - The system prompt to use.
 * @param apiKey - Optional OpenAI API key.
 * @returns A runnable chain.
 */
export function createQAChain(systemPrompt: string, apiKey?: string) {
  const model = getLLM({ apiKey });
  
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    new MessagesPlaceholder("history"),
    ["human", "{input}"]
  ]);

  return prompt.pipe(model).pipe(new StringOutputParser());
}

/**
 * Creates a reflection chain.
 * @param reflectionQuestion - The reflection question to answer.
 * @param apiKey - Optional OpenAI API key.
 * @returns A runnable chain.
 */
export function createReflectionChain(reflectionQuestion: string, apiKey?: string) {
  const model = getLLM({ apiKey });
  
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant that generates insightful reflections."],
    ["human", reflectionQuestion]
  ]);

  return prompt.pipe(model).pipe(new StringOutputParser());
}

/**
 * Creates a text generation chain with a system prompt.
 * @param systemPrompt - The system prompt to use.
 * @param apiKey - Optional OpenAI API key.
 * @returns A runnable chain.
 */
export function createTextGenerationChain(systemPrompt: string, apiKey?: string) {
  const model = getLLM({ apiKey });
  
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    ["human", "{input}"]
  ]);

  return prompt.pipe(model).pipe(new StringOutputParser());
}

export class ConversationalChain {
  private model: ChatOpenAI;
  private prompt: ChatPromptTemplate;

  constructor({
    systemPrompt,
    model,
    temperature,
    maxTokens,
  }: {
    systemPrompt: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }) {
    this.model = new ChatOpenAI({
      modelName: model,
      temperature,
      maxTokens,
    });

    this.prompt = ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      new MessagesPlaceholder("history"),
      ["human", "{input}"]
    ]);
  }

  async run(input: string, history: any[] = []) {
    const chain = this.prompt.pipe(this.model);
    return chain.invoke({ input, history });
  }
} 