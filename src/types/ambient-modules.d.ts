/**
 * Ambient module declarations for modules without type definitions
 * Use this file to add quick fixes for "Cannot find module" errors
 */

// Quick fix for discord.js
declare module 'discord.js' {
  export class Client {
    constructor(options: any);
    once(event: string, listener: (...args: any[]) => void): this;
    login(token: string): Promise<string>;
    channels: {
      fetch(id: string): Promise<any>;
    };
    destroy(): Promise<void>;
  }
  
  export class TextChannel {
    send(message: string): Promise<any>;
  }
  
  export enum GatewayIntentBits {
    Guilds,
    GuildMessages
  }
}

// Quick fix for cron
declare module 'cron' {
  export class CronJob {
    constructor(
      cronTime: string,
      onTick: () => void,
      onComplete: null | (() => void),
      start: boolean,
      timezone: string
    );
    start(): void;
    stop(): void;
    running: boolean;
  }
}

// Quick fix for tsup
declare module 'tsup' {
  export function defineConfig(config: any): any;
}

// Quick fix for langgraph
declare module 'langgraph' {
  const content: any;
  export = content;
  export * from 'content';
}

// Quick fix for @langchain/core
declare module '@langchain/core' {
  const content: any;
  export = content;
  export * from 'content';
}

// Quick fix for @langchain/openai
declare module '@langchain/openai' {
  export class ChatOpenAI {
    constructor(options: any);
    invoke(input: string): Promise<{ content: string }>;
  }
}

// Enhanced declaration for @langchain/langgraph
declare module '@langchain/langgraph' {
  interface BinaryOperator<T> {
    (a: T, b: T): T;
  }

  interface ChannelValue<T> {
    value: T | BinaryOperator<T>;
  }

  export class StateGraph<T = any> {
    constructor(options: { 
      channels: Record<string, ChannelValue<any>> 
    });
    
    addNode(name: string, handler: (state: T) => Promise<T>): void;
    addEdge(from: string, to: string | symbol): void;
    compile(): any;
  }
}

// Enhanced declaration for @langchain/langgraph/schema
declare module '@langchain/langgraph/schema' {
  export const END: unique symbol;
}

// Quick fix for @langchain/core
declare module '@langchain/core/prompts' {
  export class ChatPromptTemplate {
    static fromTemplate(template: string): ChatPromptTemplate;
    static fromMessages(messages: any[]): ChatPromptTemplate;
    pipe(next: any): any;
  }
  
  export class MessagesPlaceholder {
    constructor(variableName: string);
  }
}

declare module '@langchain/core/runnables' {
  export class RunnableSequence {
    static from(components: any[]): RunnableSequence;
    invoke(input: {
      input: string;
      chat_history?: any[];
      [key: string]: any;
    }): Promise<any>;
  }
}

declare module '@langchain/core/tools' {
  export class StructuredTool {
    constructor(options: any);
  }
}

declare module '@langchain/core/output_parsers' {
  export class StringOutputParser {
    constructor();
  }
}

