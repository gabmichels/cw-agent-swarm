declare module 'node-nlp' {
  export class NlpManager {
    constructor(options?: { languages?: string[]; forceNER?: boolean; });
    
    process(language: string, text: string): Promise<{
      utterance: string;
      locale: string;
      entities?: Array<{
        start: number;
        end: number;
        entity: string;
        sourceText: string;
        accuracy: number;
        resolution?: {
          values?: Array<{
            value: string;
          }>;
        };
      }>;
    }>;
    
    addDocument(language: string, utterance: string, intent: string): void;
    addAnswer(language: string, intent: string, answer: string): void;
    train(): Promise<void>;
    save(): void;
  }
} 