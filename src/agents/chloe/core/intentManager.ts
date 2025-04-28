import { ChatOpenAI } from '@langchain/openai';
import { ChloeMemory } from '../memory';
import { TaskLogger } from '../task-logger';
import { SimpleTool } from '../../../lib/shared/types/agent';
import { IntentRouterTool } from '../tools/intentRouter';

export interface IntentManagerOptions {
  agentId: string;
  memory: ChloeMemory;
  model: ChatOpenAI;
  taskLogger: TaskLogger;
  tools: { [key: string]: SimpleTool };
  notifyFunction?: (message: string) => void;
}

/**
 * Manages intent detection and routing for the Chloe agent
 */
export class IntentManager {
  private agentId: string;
  private memory: ChloeMemory;
  private model: ChatOpenAI;
  private taskLogger: TaskLogger;
  private tools: { [key: string]: SimpleTool };
  private intentRouter: IntentRouterTool | null = null;
  private notifyFunction?: (message: string) => void;
  private initialized: boolean = false;

  constructor(options: IntentManagerOptions) {
    this.agentId = options.agentId;
    this.memory = options.memory;
    this.model = options.model;
    this.taskLogger = options.taskLogger;
    this.tools = options.tools;
    this.notifyFunction = options.notifyFunction;
  }

  /**
   * Initialize the intent management system
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing intent management system...');
      
      // Find or create intent router tool
      const existingRouter = this.tools['intent_router'];
      if (existingRouter) {
        // Cast as IntentRouterTool
        this.intentRouter = existingRouter as unknown as IntentRouterTool;
      } else {
        // Create a new intent router
        this.intentRouter = new IntentRouterTool();
      }
      
      this.initialized = true;
      console.log('Intent management system initialized successfully');
    } catch (error) {
      console.error('Error initializing intent management system:', error);
      throw error;
    }
  }

  /**
   * Process a user message to detect and handle intents
   */
  async processIntent(message: string): Promise<{ success: boolean; response?: string }> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!this.intentRouter) {
        throw new Error('Intent router not initialized');
      }
      
      this.taskLogger.logAction('Processing intent', { 
        message: message.substring(0, 100) + (message.length > 100 ? '...' : '')
      });
      
      // Process the intent
      const response = await (this.intentRouter as any)._call(message);
      
      // If there's a specific intent action, log it
      const intentMatch = response.match(/Intent detected: (\w+)/i);
      if (intentMatch && intentMatch[1]) {
        this.taskLogger.logAction('Intent detected', { intent: intentMatch[1] });
      }
      
      return { success: true, response };
    } catch (error) {
      console.error('Error processing intent:', error);
      
      // Log the error
      this.taskLogger.logAction('Error processing intent', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      return { success: false };
    }
  }

  /**
   * Get the top predicted intents for a message without executing actions
   */
  async analyzeIntent(message: string): Promise<any> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!this.intentRouter) {
        throw new Error('Intent router not initialized');
      }
      
      // Get intent predictions
      // This would require a method addition to IntentRouterTool
      // For now, we're simulating with a basic implementation
      
      // Create a prompt for intent analysis
      const prompt = `
You are an intent classifier for a marketing assistant named Chloe.
Analyze this message and determine the likely intent:

Message: ${message}

Output ONLY a JSON object with the following structure:
{
  "detectedIntent": "intent_name",
  "confidence": 0.95,
  "possibleIntents": [
    {"intent": "intent_1", "confidence": 0.95},
    {"intent": "intent_2", "confidence": 0.80}
  ],
  "entities": ["entity1", "entity2"]
}`;
      
      const response = await this.model.invoke(prompt);
      
      try {
        // Try to extract JSON object from the response
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        
        return {
          detectedIntent: "unknown",
          confidence: 0,
          possibleIntents: [],
          entities: []
        };
      } catch (error) {
        console.error('Error parsing intent analysis:', error);
        return {
          detectedIntent: "unknown",
          confidence: 0,
          possibleIntents: [],
          entities: []
        };
      }
    } catch (error) {
      console.error('Error analyzing intent:', error);
      return {
        detectedIntent: "unknown",
        confidence: 0,
        possibleIntents: [],
        entities: []
      };
    }
  }

  /**
   * Check if the intent management system is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
} 