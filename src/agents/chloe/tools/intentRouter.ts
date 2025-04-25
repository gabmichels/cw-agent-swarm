import * as fs from 'fs';
import * as path from 'path';
import { getLLM } from '../../../lib/core/llm';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { createMarketScanner } from './marketScanner';

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
          description: 'The topic to generate content ideas for'
        }
      }
    );
  }

  async execute(params: Record<string, any>): Promise<any> {
    const topic = params.topic || 'general';
    logThought(`Generating content ideas for topic: ${topic}`);
    
    try {
      // Get a more capable LLM to generate actual content ideas
      const llm = getLLM({
        modelName: 'google/gemini-2.0-flash-001',
        temperature: 0.7, // Higher temperature for more creative ideas
      });
      
      const promptTemplate = `Generate 5 compelling content ideas related to the topic: ${topic}.
      
      For each idea:
      1. Provide a catchy title
      2. Include a brief description (1-2 sentences)
      3. Suggest a content format (blog post, video, infographic, etc.)
      
      Focus on ideas that would be engaging, valuable, and relevant to the audience.
      ONLY return the ideas in JSON format as an array of objects with title, description, and format properties.`;
      
      // If LLM connection fails, fall back to mock data
      try {
        const response = await llm.invoke(promptTemplate);
        
        // Try to parse JSON from the response
        try {
          // Look for JSON in the response
          const jsonMatch = response.content.match(/\[\s*\{[\s\S]*\}\s*\]/);
          if (jsonMatch) {
            const ideas = JSON.parse(jsonMatch[0]);
            return {
              success: true,
              ideas: ideas
            };
          }
        } catch (parseError) {
          console.error("Error parsing ideas JSON:", parseError);
          // Fall back to extracting text if JSON parsing fails
        }
        
        // If JSON parsing failed, try to extract ideas from text
        const ideas = this.extractIdeasFromText(response.content, topic);
        return {
          success: true,
          ideas: ideas
        };
      } catch (error) {
        console.error("Error generating ideas with LLM:", error);
        // Fall back to mock data
      }
    } catch (error) {
      console.error("Error in ProposeContentIdeasTool:", error);
    }
    
    // Fallback mock ideas if LLM fails
    return {
      success: true,
      ideas: [
        {
          title: `The Ultimate Guide to ${topic}`,
          description: `A comprehensive walkthrough of everything people need to know about ${topic}.`,
          format: "Long-form blog post"
        },
        {
          title: `5 Surprising Facts About ${topic} You Never Knew`,
          description: `Uncover lesser-known insights about ${topic} that will fascinate your audience.`,
          format: "List article"
        },
        {
          title: `How ${topic} Is Changing the Future`,
          description: `An analysis of the impact ${topic} is having on industry trends and future developments.`,
          format: "Thought leadership piece"
        },
        {
          title: `${topic} 101: A Beginner's Introduction`,
          description: `A friendly introduction to ${topic} for those just getting started.`,
          format: "Tutorial video"
        },
        {
          title: `The Evolution of ${topic}: Past, Present, and Future`,
          description: `A timeline showcasing how ${topic} has evolved and where it's headed next.`,
          format: "Infographic"
        }
      ]
    };
  }
  
  // Helper method to extract ideas from text if JSON parsing fails
  private extractIdeasFromText(text: string, topic: string): any[] {
    const ideas = [];
    // Try to extract numbered items
    const lines = text.split('\n');
    let currentIdea: any = {};
    
    for (const line of lines) {
      const titleMatch = line.match(/(\d+\.\s*|-)?\s*(?:Title:)?\s*([^:]+)$/i);
      const descMatch = line.match(/(?:Description:)?\s*(.+)$/i);
      const formatMatch = line.match(/(?:Format:)?\s*(.+)$/i);
      
      if (titleMatch && titleMatch[2] && !line.toLowerCase().includes('description:') && !line.toLowerCase().includes('format:')) {
        // If we already have an idea with a title, save it before starting a new one
        if (currentIdea.title) {
          ideas.push(currentIdea);
          currentIdea = {};
        }
        currentIdea.title = titleMatch[2].trim();
      } else if (descMatch && currentIdea.title && !currentIdea.description) {
        currentIdea.description = descMatch[1].trim();
      } else if (formatMatch && currentIdea.title && currentIdea.description && !currentIdea.format) {
        currentIdea.format = formatMatch[1].trim();
        ideas.push(currentIdea);
        currentIdea = {};
      }
    }
    
    // Add the last idea if it has a title
    if (currentIdea.title) {
      ideas.push(currentIdea);
    }
    
    // If we couldn't extract ideas properly, return mock ideas
    if (ideas.length < 3) {
      return [
        {
          title: `The Ultimate Guide to ${topic}`,
          description: `A comprehensive walkthrough of everything people need to know about ${topic}.`,
          format: "Long-form blog post"
        },
        {
          title: `5 Surprising Facts About ${topic} You Never Knew`,
          description: `Uncover lesser-known insights about ${topic} that will fascinate your audience.`,
          format: "List article"
        },
        {
          title: `How ${topic} Is Changing the Future`,
          description: `An analysis of the impact ${topic} is having on industry trends and future developments.`,
          format: "Thought leadership piece"
        }
      ];
    }
    
    return ideas;
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

// Add MarketScanTool class implementation
class MarketScanTool extends BaseTool {
  private scanner: any;

  constructor() {
    super(
      'market_scan',
      'Scan market sources for trends, news, and insights in a specific category',
      {
        category: {
          type: 'string',
          description: 'The category to scan for trends and insights'
        }
      }
    );
    this.scanner = createMarketScanner();
  }

  async execute(params: Record<string, any>): Promise<any> {
    logThought(`Running market scan for category: ${params.category || 'all categories'}`);
    
    try {
      const categories = params.category ? [params.category] : undefined;
      const scanCount = await this.scanner.runMarketScan(categories);
      
      if (scanCount === 0) {
        return {
          success: true,
          message: "No new market signals found or scanner is disabled.",
          scanned: 0,
          display: "No new market signals found or scanner is disabled."
        };
      }
      
      const displayMessage = `Market scan complete! Processed ${scanCount} signals${params.category ? ` in category: ${params.category}` : ''}.\n\nThe signals have been saved to memory and can be retrieved using the search_memory tool.`;
      
      return {
        success: true,
        message: `Market scan complete! Processed ${scanCount} signals${params.category ? ` in category: ${params.category}` : ''}.`,
        scanned: scanCount,
        category: params.category || 'all',
        display: displayMessage
      };
    } catch (error) {
      console.error('Error in market scan:', error);
      logThought(`Error occurred during market scan: ${error}`);
      return {
        success: false,
        message: `Error running market scan: ${error instanceof Error ? error.message : String(error)}`,
        display: `Error running market scan: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

// Add NotifyDiscordTool implementation
class NotifyDiscordTool extends BaseTool {
  constructor() {
    super(
      'notify_discord',
      'Send a notification or message to a Discord channel',
      {
        message: {
          type: 'string',
          description: 'The message to send to Discord'
        },
        type: {
          type: 'string',
          description: 'Type of notification (update, alert, summary)',
          default: 'update'
        },
        mention: {
          type: 'boolean',
          description: 'Whether to mention the user in the message',
          default: false
        }
      }
    );
  }

  async execute(params: Record<string, any>): Promise<any> {
    const message = params.message || '';
    const type = params.type || 'update';
    const mention = params.mention === true;
    
    if (!message) {
      return {
        success: false,
        message: "No message content provided for the Discord notification."
      };
    }
    
    logThought(`Sending Discord notification: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
    
    try {
      // Dynamically import the notifiers to avoid circular dependencies
      const { notifyDiscord } = await import('../notifiers');
      
      await notifyDiscord(message, type as any, mention);
      
      return {
        success: true,
        message: `Successfully sent ${type} notification to Discord`,
        notificationType: type,
        mentioned: mention
      };
    } catch (error) {
      console.error('Error sending Discord notification:', error);
      logThought(`Error occurred while sending Discord notification: ${error}`);
      return {
        success: false,
        message: `Error sending Discord notification: ${error instanceof Error ? error.message : String(error)}`
      };
    }
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
    this.registerTool('market_scan', new MarketScanTool());
    this.registerTool('notify_discord', new NotifyDiscordTool());
    
    // Alias the tools by intent name for easier lookup
    this.registerToolAlias('generate_content_ideas', 'propose_content_ideas');
    this.registerToolAlias('run_market_scan', 'market_scan');
    
    // Initialize the promptTemplate
    this.initializePromptTemplate();
  }
  
  // Add a method to register tool aliases
  private registerToolAlias(intentName: string, actionName: string) {
    if (this.tools[actionName]) {
      this.tools[intentName] = this.tools[actionName];
    }
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
        },
        {
          intent: "run_market_scan",
          patterns: [
            "run market scan for {category}",
            "scan market for {category}",
            "analyze market trends in {category}",
            "collect social media data about {category}",
            "get market insights for {category}",
            "gather market intelligence on {category}",
            "scan social media for {category} trends",
            "look for trends in {category}",
            "update knowledge about {category} market",
            "can you check what social media is saying about {category}",
            "can you bring yourself up to speed with the topic of {category}",
            "what's the latest on {category}",
          ],
          action: "market_scan",
          description: "Scan market sources for trends, news, and insights in a specific category",
          extractParams: true
        },
        {
          intent: "send_discord_notification",
          patterns: [
            "send discord message: {message}",
            "notify on discord: {message}",
            "post to discord channel: {message}",
            "send notification with {message}",
            "send this to discord: {message}",
            "notify team on discord about {message}",
            "post update to discord: {message}",
            "alert team on discord: {message}",
            "send discord alert: {message}"
          ],
          action: "notify_discord",
          description: "Send a notification or message to the configured Discord channel",
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
      
      if (!matchResult.matched) {
        logThought("No matching intent found for this request");
        return {
          success: false,
          message: "I couldn't determine what you want me to do. Could you please rephrase your request?",
          display: "I couldn't determine what you want me to do. Could you please rephrase your request?"
        };
      }
      
      // Try to find tool by intent name first, then by action name
      const toolName = matchResult.intent || matchResult.action;
      if (!toolName || !this.tools[toolName]) {
        // Fall back to action if provided
        if (matchResult.action && this.tools[matchResult.action]) {
          console.log(`Using fallback action '${matchResult.action}' for intent '${matchResult.intent}'`);
        } else {
          logThought(`Intent matched to '${matchResult.intent}', but no tool is registered for it`);
          return {
            success: false,
            message: `I understood you want me to ${matchResult.intent || "do something"}, but I don't have that capability yet.`,
            display: `I understood you want me to ${matchResult.intent || "do something"}, but I don't have that capability yet.`
          };
        }
      }
      
      // Get the tool to execute (either by intent name or action name)
      const tool = this.tools[toolName] || (matchResult.action ? this.tools[matchResult.action] : undefined);
      
      if (!tool) {
        logThought(`No tool found for intent '${matchResult.intent}' or action '${matchResult.action}'`);
        return {
          success: false,
          message: `I understood your request, but couldn't find the right tool to execute it.`,
          display: `I understood your request, but couldn't find the right tool to execute it.`
        };
      }
      
      const toolParams = matchResult.params || {};
      
      logThought(`Executing '${tool.name}' with parameters: ${JSON.stringify(toolParams)}`);
      logger.info(`Executing tool ${tool.name} with params:`, toolParams);
      console.log(`🔧 EXECUTING TOOL: ${tool.name} with params:`, toolParams);
      
      const result = await tool.execute(toolParams);
      
      console.log("✅ INTENT ROUTER COMPLETE:", tool.name);
      logThought(`Completed '${tool.name}' action`);
      
      // Format the result for display
      const displayResult = this.formatResultForDisplay(tool.name, result);
      
      console.log("⭐ Final formatted display result:", displayResult);
      
      return {
        success: true,
        action: tool.name,
        intent: matchResult.intent,
        confidence: matchResult.confidence,
        result,
        display: displayResult
      };
    } catch (error) {
      logger.error('Error executing intent router:', error);
      logThought("Error occurred while processing the intent");
      return {
        success: false,
        message: "I encountered an error while processing your request. Please try again.",
        display: "I encountered an error while processing your request. Please try again."
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
  
  // Format the result for display based on the action type
  private formatResultForDisplay(action: string, result: any): string {
    if (!result.success) {
      return result.message || "Sorry, I couldn't complete that task successfully.";
    }
    
    switch (action) {
      case 'generate_content_ideas': 
        return this.formatContentIdeas(result.ideas);
      case 'reflect_on_performance':
        return result.reflection || "Here's my reflection on our performance.";
      case 'market_scan':
        return result.message || "Market scan completed successfully.";
      case 'notify_discord':
        return result.message || "Discord notification sent successfully.";
      default:
        return JSON.stringify(result, null, 2);
    }
  }
  
  // Format content ideas in a readable way
  private formatContentIdeas(ideas: any[]): string {
    if (!ideas || ideas.length === 0) {
      return "I couldn't generate any content ideas. Please try again with a different topic.";
    }
    
    let formattedResult = "Here are some content ideas I've generated:\n\n";
    
    ideas.forEach((idea, index) => {
      formattedResult += `${index + 1}. **${idea.title || 'Untitled'}**\n`;
      formattedResult += `   ${idea.description || 'No description provided.'}\n`;
      if (idea.format) {
        formattedResult += `   *Suggested format: ${idea.format}*\n`;
      }
      formattedResult += '\n';
    });
    
    return formattedResult;
  }
} 