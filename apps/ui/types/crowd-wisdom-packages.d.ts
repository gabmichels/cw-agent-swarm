declare module '@crowd-wisdom/agents-chloe' {
  export class ChloeAgent {
    constructor(config?: any);
    initialize(): Promise<boolean>;
    processMessage(message: string): Promise<string>;
    getMemory(): {
      getContext(query: string, limit?: number): Promise<string>;
    };
  }
} 