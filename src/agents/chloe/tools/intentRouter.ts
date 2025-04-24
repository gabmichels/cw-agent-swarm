import * as fs from 'fs';
import * as path from 'path';
import { getLLM } from '../../../lib/core/llm';
import { ChatPromptTemplate } from '@langchain/core/prompts';

// Define logger inline
const logger = {
  debug: (message: string, ...args: any[]) => console.debug(`[DEBUG] ${message}`, ...args),
  info: (message: string, ...args: any[]) => console.info(`[INFO] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args)
};

// Helper function to expose intent as "thought" - this will be visible in UI
function logThought(message: string): void {
  // This specific format is typically recognized by thought-capturing systems
  console.log(`Chloe thinking: ${message}`);
}

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
    logThought(`Generating content ideas for topic: ${params.topic || 'general'}`);
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
    logThought(`Reflecting on performance for timeframe: ${params.timeframe || 'past week'}`);
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
  private promptTemplate: any;
  
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
    
    // Initialize the promptTemplate
    this.initializePromptTemplate();
  }
  
  private initializePromptTemplate(): void {
    const systemTemplate = `You are an intent classifier for an AI assistant named Chloe.
Your job is to determine if a user input matches one of the available intents, and extract any parameters.

Here are the available intents:
{available_intents}

INSTRUCTIONS:
1. Analyze the input and determine if it matches one of the available intents.
2. Extract any parameters mentioned in the input (like topic, timeframe, etc.).
3. Respond with a JSON object in this format:
{{
  "matched": true/false,
  "intent": "intent_name", // name of the matched intent
  "action": "action_name", // corresponding action to execute
  "confidence": 0.95, // your confidence score between 0 and 1
  "params": {{
    // any extracted parameters
    "paramName": "extractedValue"
  }}
}}

Be flexible with matching - the user doesn't need to use the exact wording from intent patterns.
If no intent clearly matches, set "matched" to false.

USER INPUT: {input}`;

    // Create the prompt template using the fromTemplate method instead of create
    this.promptTemplate = ChatPromptTemplate.fromTemplate(systemTemplate);
  }

  private registerTool(name: string, tool: BaseTool) {
    this.tools[name] = tool;
  }
  
  private async loadActionMap(): Promise<ActionMap> {
    if (this.actionMap) {
      return this.actionMap;
    }
    
    // Define our mock action map
    const mockActionMap: ActionMap = {
      intents: [
        {
          intent: "generate_content_ideas",
          patterns: [
            "suggest content ideas for {topic}",
            "content ideas about {topic}",
            "brainstorm content for {topic}",
            "I need content ideas about {topic}",
            "give me content ideas for {topic}",
            "can you suggest ideas for {topic}",
            "help me with content ideas about {topic}",
            "content suggestions for {topic}"
          ],
          action: "propose_content_ideas",
          description: "Generate content ideas on a specific topic",
          extractParams: true
        },
        {
          intent: "reflect_on_performance",
          patterns: [
            "how did we perform in {timeframe}",
            "reflect on performance for {timeframe}",
            "analyze performance {timeframe}",
            "what was our performance like {timeframe}",
            "performance analysis for {timeframe}",
            "evaluate our performance {timeframe}",
            "performance review for {timeframe}"
          ],
          action: "reflect_on_performance",
          description: "Analyze and reflect on past performance",
          extractParams: true
        }
      ]
    };
    
    try {
      const mapPath = path.resolve(process.cwd(), 'data/intents/action_map.json');
      
      // Fallback to create a mock action map if file doesn't exist
      if (!fs.existsSync(mapPath)) {
        logThought("Creating mock action map for testing");
        this.actionMap = mockActionMap;
        return this.actionMap;
      }
      
      const data = fs.readFileSync(mapPath, 'utf-8');
      this.actionMap = JSON.parse(data) as ActionMap;
      return this.actionMap;
    } catch (error) {
      logger.error('Failed to load action map:', error);
      logThought("Failed to load intent-action map. Creating a default one.");
      
      // Create default action map
      this.actionMap = mockActionMap;
      return this.actionMap;
    }
  }
  
  private async getLLMInstance() {
    if (!this.llm) {
      logThought("Initializing LLM for intent classification");
      // Use Gemini model for intent classification through OpenRouter
      const openRouterApiKey = process.env.OPENROUTER_API_KEY;
      if (!openRouterApiKey) {
        console.error("OpenRouter API key not found! Intent classification will fail.");
        logThought("Failed to initialize LLM: Missing OpenRouter API key");
      }
      
      this.llm = getLLM({
        modelName: 'google/gemini-2.0-flash-001',
        temperature: 0.1,
        apiKey: openRouterApiKey
      });
    }
    return this.llm;
  }
  
  private async matchIntentWithLLM(input: string): Promise<MatchResult> {
    try {
      console.log("🔎 Intent matching for input:", input);
      logThought(`Analyzing intent for: "${input}"`);
      
      const actionMap = await this.loadActionMap();
      console.log("📚 Action map loaded with", actionMap.intents.length, "intents");
      console.log("📋 Available intents:", actionMap.intents.map(i => i.intent).join(", "));
      
      const llm = await this.getLLMInstance();
      console.log("🤖 LLM initialized for intent classification");
      
      // Log the patterns we're matching against for the first few intents
      actionMap.intents.forEach((intent, idx) => {
        if (idx < 2) { // Just log first 2 intents to avoid too much noise
          console.log(`📝 Intent "${intent.intent}" patterns:`, intent.patterns);
        }
      });
      
      // Format the prompt with all the required parameters
      const prompt = await this.promptTemplate.invoke({
        available_intents: JSON.stringify(this.getIntentsInfo(), null, 2),
        input: input,
      });
      
      logThought("Sending intent classification request to LLM");
      console.log("🔮 Sending prompt to LLM for intent classification");
      console.log("📝 Prompt content first 200 chars:", JSON.stringify(prompt).substring(0, 200));
      
      const response = await llm.invoke(prompt);
      console.log("✅ LLM response received, length:", response.content.length);
      
      try {
        // Find the JSON part of the response
        console.log("🔍 Looking for JSON in response");
        console.log("📄 Raw response snippet:", response.content.substring(0, 100) + "...");
        
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.log("❌ No JSON found in response");
          logThought("Failed to extract JSON from LLM response");
          throw new Error('No JSON found in response');
        }
        
        console.log("✅ JSON found in response");
        const jsonText = jsonMatch[0];
        console.log("📊 Extracted JSON:", jsonText);
        
        const result = JSON.parse(jsonText) as MatchResult;
        logger.debug('Intent match result:', result);
        console.log("🎯 Parse successful, match result:", result);
        
        if (result.matched && result.intent) {
          logThought(`✓ Detected intent: ${result.intent} with ${Math.round((result.confidence || 0) * 100)}% confidence`);
          console.log(`🎉 Intent match successful: ${result.intent} with ${Math.round((result.confidence || 0) * 100)}% confidence`);
          
          if (result.params && Object.keys(result.params).length > 0) {
            logThought(`Extracted parameters: ${JSON.stringify(result.params)}`);
            console.log("📦 Parameters extracted:", result.params);
          }
        } else {
          logThought("✗ No intent matched for this input");
          console.log("❌ No intent matched for this input");
        }
        
        return result;
      } catch (parseError) {
        logger.error('Failed to parse LLM response:', parseError);
        logger.debug('Raw LLM response:', response);
        logThought("Failed to parse intent classification response");
        return { matched: false };
      }
    } catch (error) {
      logger.error('Error in intent matching:', error);
      logThought("Error occurred during intent classification");
      return { matched: false };
    }
  }
  
  async execute(params: { input: string; extractParams?: boolean }): Promise<any> {
    const { input, extractParams = true } = params;
    
    console.log("🔍 INTENT ROUTER TRIGGERED with input:", params.input);
    logThought(`IntentRouter triggered: "${input}"`);
    
    logger.info(`Routing intent for input: ${input}`);
    
    try {
      const matchResult = await this.matchIntentWithLLM(input);
      
      console.log("🎯 INTENT MATCH:", JSON.stringify(matchResult, null, 2));
      
      if (!matchResult.matched || !matchResult.action) {
        logThought("No matching intent found for this request");
        return {
          success: false,
          message: "I couldn't determine what you want me to do. Could you please rephrase your request?"
        };
      }
      
      // Check if we have the tool registered
      if (!this.tools[matchResult.action]) {
        logThought(`Intent matched to action '${matchResult.action}', but no tool is registered for it`);
        return {
          success: false,
          message: `I understood you want me to ${matchResult.action}, but I don't have that capability yet.`
        };
      }
      
      // Execute the matched tool with extracted parameters
      const tool = this.tools[matchResult.action];
      const toolParams = matchResult.params || {};
      
      logThought(`Executing '${matchResult.action}' with parameters: ${JSON.stringify(toolParams)}`);
      logger.info(`Executing tool ${matchResult.action} with params:`, toolParams);
      const result = await tool.execute(toolParams);
      
      console.log("✅ INTENT ROUTER COMPLETE:", matchResult.action || "no action");
      logThought(`Completed '${matchResult.action}' action`);
      
      return {
        success: true,
        action: matchResult.action,
        intent: matchResult.intent,
        confidence: matchResult.confidence,
        result
      };
    } catch (error) {
      logger.error('Error executing intent router:', error);
      logThought("Error occurred while processing the intent");
      return {
        success: false,
        message: "I encountered an error while processing your request. Please try again."
      };
    }
  }

  // Add method to get information about the registered intents
  private getIntentsInfo(): any[] {
    // Return array of intent metadata for the LLM prompt
    return Object.values(this.tools).map(tool => ({
      intent: tool.name,
      description: tool.description
    }));
  }
} 