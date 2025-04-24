import * as fs from 'fs';
import * as path from 'path';
import { getLLM } from '../../../lib/core/llm';

// Define logger inline
const logger = {
  debug: (message: string, ...args: any[]) => console.debug(`[DEBUG] ${message}`, ...args),
  info: (message: string, ...args: any[]) => console.info(`[INFO] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args)
};

// Define BaseTool abstract class
abstract class BaseTool {
  public name: string;
  public description: string;
  public schema: Record<string, any>;

  constructor(
    name: string,
    description: string,
    schema: Record<string, any> = {}
  ) {
    this.name = name;
    this.description = description;
    this.schema = schema;
  }

  abstract execute(params: Record<string, any>): Promise<any>;
}

// Mock tool implementations
class ProposeContentIdeasTool extends BaseTool {
  constructor() {
    super(
      'propose_content_ideas',
      'Generates content ideas based on a topic',
      {
        topic: {
          type: 'string',
          description: 'The topic to generate ideas for'
        }
      }
    );
  }

  async execute(params: Record<string, any>): Promise<any> {
    // Mock implementation
    return {
      success: true,
      ideas: [
        `Idea 1 for ${params.topic || 'general topic'}`,
        `Idea 2 for ${params.topic || 'general topic'}`,
        `Idea 3 for ${params.topic || 'general topic'}`
      ]
    };
  }
}

class ReflectOnPerformanceTool extends BaseTool {
  constructor() {
    super(
      'reflect_on_performance',
      'Reflects on past performance',
      {
        timeframe: {
          type: 'string',
          description: 'Timeframe to reflect on',
          default: 'past week'
        }
      }
    );
  }

  async execute(params: Record<string, any>): Promise<any> {
    // Mock implementation
    return {
      success: true,
      reflection: `Reflection on performance for ${params.timeframe || 'past week'}`
    };
  }
}

interface Pattern {
  intent: string;
  patterns: string[];
  action: string;
  description: string;
  extractParams: boolean;
}

interface ActionMap {
  intents: Pattern[];
}

interface MatchResult {
  matched: boolean;
  intent?: string;
  action?: string;
  params?: Record<string, string>;
  confidence?: number;
}

export class IntentRouterTool extends BaseTool {
  private actionMap: ActionMap | null = null;
  private llm: any = null;
  private tools: Record<string, BaseTool> = {};
  
  constructor() {
    super(
      'intent_router',
      'Maps natural language to executable actions using intent matching',
      {
        input: {
          type: 'string',
          description: 'The natural language input to be mapped to an action'
        },
        extractParams: {
          type: 'boolean',
          description: 'Whether to extract parameters from the input',
          default: true
        }
      }
    );
    
    // Register available tools here
    this.registerTool('propose_content_ideas', new ProposeContentIdeasTool());
    this.registerTool('reflect_on_performance', new ReflectOnPerformanceTool());
  }

  private registerTool(name: string, tool: BaseTool) {
    this.tools[name] = tool;
  }
  
  private async loadActionMap(): Promise<ActionMap> {
    if (this.actionMap) {
      return this.actionMap;
    }
    
    try {
      const mapPath = path.resolve(process.cwd(), 'data/intents/action_map.json');
      const data = fs.readFileSync(mapPath, 'utf-8');
      this.actionMap = JSON.parse(data) as ActionMap;
      return this.actionMap;
    } catch (error) {
      logger.error('Failed to load action map:', error);
      throw new Error('Failed to load intent-action map');
    }
  }
  
  private async getLLMInstance() {
    if (!this.llm) {
      this.llm = getLLM({
        modelName: 'gemini-1.5-flash-preview',
        temperature: 0.1,
      });
    }
    return this.llm;
  }
  
  private async matchIntentWithLLM(input: string): Promise<MatchResult> {
    try {
      const actionMap = await this.loadActionMap();
      const llm = await this.getLLMInstance();
      
      const prompt = `
        You are an intent classifier for a marketing assistant. You need to determine which intent from the list below best matches the user's input.
        
        Available intents:
        ${actionMap.intents.map(intent => `- ${intent.intent}: ${intent.description}
          Example patterns: ${intent.patterns.join(', ')}
        `).join('\n')}
        
        User input: "${input}"
        
        Return a JSON object with the following structure:
        {
          "matched": true/false,
          "intent": "intent_name", // The name of the matched intent, or null if no match
          "action": "action_name", // The action associated with the intent, or null if no match
          "confidence": 0.0-1.0, // How confident you are in this match
          "params": { // Any parameters extracted from the input
            "param1": "value1",
            "param2": "value2"
          }
        }
        
        Only extract parameters that are present in the input and mentioned in the pattern. Parameter names should match those in curly braces in the patterns.
        If a parameter is missing or unclear, don't include it in the params object.
        
        JSON response:
      `;
      
      const response = await llm.invoke(prompt);
      try {
        // Find the JSON part of the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in response');
        }
        
        const result = JSON.parse(jsonMatch[0]) as MatchResult;
        logger.debug('Intent match result:', result);
        return result;
      } catch (parseError) {
        logger.error('Failed to parse LLM response:', parseError);
        logger.debug('Raw LLM response:', response);
        return { matched: false };
      }
    } catch (error) {
      logger.error('Error in intent matching:', error);
      return { matched: false };
    }
  }
  
  async execute(params: { input: string; extractParams?: boolean }): Promise<any> {
    const { input, extractParams = true } = params;
    
    logger.info(`Routing intent for input: ${input}`);
    
    try {
      const matchResult = await this.matchIntentWithLLM(input);
      
      if (!matchResult.matched || !matchResult.action) {
        return {
          success: false,
          message: "I couldn't determine what you want me to do. Could you please rephrase your request?"
        };
      }
      
      // Check if we have the tool registered
      if (!this.tools[matchResult.action]) {
        return {
          success: false,
          message: `I understood you want me to ${matchResult.action}, but I don't have that capability yet.`
        };
      }
      
      // Execute the matched tool with extracted parameters
      const tool = this.tools[matchResult.action];
      const toolParams = matchResult.params || {};
      
      logger.info(`Executing tool ${matchResult.action} with params:`, toolParams);
      const result = await tool.execute(toolParams);
      
      return {
        success: true,
        action: matchResult.action,
        intent: matchResult.intent,
        confidence: matchResult.confidence,
        result
      };
    } catch (error) {
      logger.error('Error executing intent router:', error);
      return {
        success: false,
        message: "I encountered an error while processing your request. Please try again."
      };
    }
  }
} 