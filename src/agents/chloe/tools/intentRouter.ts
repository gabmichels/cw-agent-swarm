import * as fs from 'fs';
import * as path from 'path';
import { getLLM as getLangchainLLM } from '../../../lib/core/llm';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { createMarketScanner } from './marketScanner';
import { EnhancedMemory, createEnhancedMemory } from '../../../lib/memory/src/enhanced-memory';
import { CodaDocumentTool } from './index';
import { logger as appLogger } from '../../../lib/logging';
import { BaseTool } from '../../../lib/shared/types/agentTypes';


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
      const llm = getLangchainLLM({
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

// Add CreateTaskTool class after the NotifyDiscordTool
class CreateTaskTool extends BaseTool {
  private enhancedMemory: EnhancedMemory;

  constructor() {
    super(
      'create_task',
      'Create a new task with a deadline and priority',
      {
        title: {
          type: 'string',
          description: 'The title of the task'
        },
        description: {
          type: 'string', 
          description: 'Detailed description of the task'
        },
        deadline: {
          type: 'string',
          description: 'Optional deadline for the task (ISO string)'
        },
        priority: {
          type: 'string',
          description: 'Priority of the task (high, medium, low)',
          default: 'medium'
        }
      }
    );
    this.enhancedMemory = createEnhancedMemory();
  }

  async execute(params: Record<string, any>): Promise<any> {
    const { title, description, deadline, priority = 'medium' } = params;
    
    if (!title) {
      return {
        success: false,
        message: "A task title is required.",
        display: "A task title is required."
      };
    }
    
    logThought(`Creating task: "${title}" with priority: ${priority}`);
    
    try {
      // Generate a unique task ID
      const taskId = `task_${Date.now()}`;
      
      // Create task metadata
      const taskMetadata = {
        id: taskId,
        title,
        description: description || title,
        priority,
        status: 'pending',
        created: new Date().toISOString(),
        deadline: deadline || null,
        tags: ['task']
      };
      
      // Store in memory
      await this.enhancedMemory.addMemory(
        `Task: ${title}\n\nDescription: ${description || 'No description provided'}`,
        taskMetadata,
        'task'
      );
      
      // Format response for display
      const deadlineText = deadline ? ` with deadline ${new Date(deadline).toDateString()}` : '';
      const displayMessage = `I've created a new ${priority} priority task: "${title}"${deadlineText}`;
      
      return {
        success: true,
        message: `Task created with ID: ${taskId}`,
        id: taskId,
        title,
        priority,
        deadline,
        display: displayMessage
      };
    } catch (error) {
      console.error('Error creating task:', error);
      logThought(`Error occurred while creating task: ${error}`);
      return {
        success: false,
        message: `Error creating task: ${error instanceof Error ? error.message : String(error)}`,
        display: `I wasn't able to create that task. Please try again.`
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
  private enhancedMemory: EnhancedMemory;
  
  constructor() {
    super(
      'intent_router',
      'Routes natural language inputs to the appropriate tool',
      {
        input: {
          type: 'string',
          description: 'The natural language input to route to the appropriate tool'
        },
        extractParams: {
          type: 'boolean',
          description: 'Whether to extract parameters from the input automatically',
          default: true
        }
      }
    );
    
    this.enhancedMemory = createEnhancedMemory();
    console.log('IntentRouterTool constructor running...');
    
    // Initialize with some basic tools
    try {
      // Register core tools 
      this.registerTool('market_scan', new MarketScanTool());
      this.registerTool('propose_content_ideas', new ProposeContentIdeasTool());
      this.registerTool('reflect_on_performance', new ReflectOnPerformanceTool());
      this.registerTool('notify_discord', new NotifyDiscordTool());
      this.registerTool('create_task', new CreateTaskTool());
      
      // Explicitly register the CodaDocumentToolAdapter for document creation
      const codaToolAdapter = new CodaDocumentToolAdapter();
      this.registerTool('coda_document', codaToolAdapter);
      
      // Register tool aliases - these map intent names to the actual action
      this.registerToolAlias('create_document', 'coda_document');
      this.registerToolAlias('make_document', 'coda_document');
      this.registerToolAlias('write_document', 'coda_document');
      
      // Initialize the prompt template
      this.initializePromptTemplate();
      
      console.log('IntentRouterTool initialized successfully with core tools');
    } catch (error) {
      console.error('Error initializing IntentRouterTool:', error);
    }
    
    // Load the action map from the patterns file
    this.loadActionMap().then((actionMap) => {
      this.actionMap = actionMap;
      console.log(`IntentRouterTool loaded ${actionMap.intents.length} intent patterns from file`);
    }).catch((error) => {
      console.error('Error loading action map:', error);
    });
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
        },
        {
          intent: "create_coda_doc",
          patterns: [
            "create a Coda document about {topic}",
            "make a Coda doc about {topic}",
            "create a document in Coda about {topic}",
            "write a Coda document on {topic}",
            "start a new Coda doc for {topic}",
            "generate a Coda document covering {topic}"
          ],
          action: "coda_document",
          description: "Create a new document in Coda workspace",
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
      
      this.llm = getLangchainLLM({
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
        available_intents: JSON.stringify(await this.getIntentsInfo(), null, 2),
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
          logThought(`Intent "${result.intent}" matched with confidence ${result.confidence}`);
          return result;
        }
        
        // If we get here but no match, return default no match result
        return { matched: false };
      } catch (error) {
        console.error('Error parsing intent match result:', error);
        logThought('Failed to parse intent match result');
        return { matched: false };
      }
    } catch (error) {
      console.error('Error in intent matching:', error);
      logThought('Failed to match intent');
      return { matched: false };
    }
  }
  
  private async getIntentsInfo(): Promise<Record<string, string>> {
    const intentsInfo: Record<string, string> = {};
    for (const [name, tool] of Object.entries(this.tools)) {
      intentsInfo[name] = tool.description;
    }
    return intentsInfo;
  }

  /**
   * Execute method required by BaseTool abstract class
   */
  async execute(params: Record<string, any>): Promise<any> {
    const { input, extractParams = true } = params;
    
    console.log("🔍 INTENT ROUTER TRIGGERED with input:", input);
    logThought(`IntentRouter triggered: "${input}"`);
    
    appLogger.info(`Routing intent for input: ${input}`);
    
    try {
      // Get relevant memories that might help with intent understanding
      const relevantMemories = await this.enhancedMemory.getRelevantMemories(input, 3);
      if (relevantMemories.length > 0) {
        logThought(`Found ${relevantMemories.length} memories that might be relevant to this request`);
      }
      
      // Match intent using LLM
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
      let tool: BaseTool | undefined;
      
      // Check if we have a valid tool name
      if (matchResult.intent && typeof matchResult.intent === 'string' && this.tools[matchResult.intent]) {
        tool = this.tools[matchResult.intent];
      } 
      // Fall back to action if provided and valid
      else if (matchResult.action && typeof matchResult.action === 'string' && this.tools[matchResult.action]) {
        tool = this.tools[matchResult.action];
        console.log(`Using fallback action '${matchResult.action}' for intent '${matchResult.intent}'`);
      }
      
      if (!tool) {
        logThought(`Intent matched to '${matchResult.intent}', but no tool is registered for it`);
        return {
          success: false,
          message: `I understood you want me to ${matchResult.intent || "do something"}, but I don't have that capability yet.`,
          display: `I understood you want me to ${matchResult.intent || "do something"}, but I don't have that capability yet.`
        };
      }
      
      // Enhance the extracted parameters with natural language understanding
      const enhancedParams = await this.enhanceParameters(matchResult.params || {}, input, tool.name);
      
      // Add the action from the match result to the parameters
      if (matchResult.action) {
        enhancedParams.action = matchResult.action;
        console.log(`Adding action '${matchResult.action}' to parameters`);
      } else if (matchResult.intent === 'create_coda_doc') {
        // Special case for Coda document creation
        enhancedParams.action = 'create';
        console.log(`Setting default action 'create' for Coda document`);
      }
      
      // Always pass the original input for context
      enhancedParams.input = input;
      
      logThought(`Executing '${tool.name}' with parameters: ${JSON.stringify(enhancedParams)}`);
      appLogger.info(`Executing tool ${tool.name} with params:`, enhancedParams);
      console.log(`🔧 EXECUTING TOOL: ${tool.name} with params:`, enhancedParams);
      
      const result = await tool.execute(enhancedParams);
      
      // Record successful intent match to improve future matching
      if (matchResult.intent && matchResult.confidence && matchResult.confidence > 0.7) {
        await this.enhancedMemory.storeIntentPattern(matchResult.intent, input);
        logThought(`Learned new pattern for intent '${matchResult.intent}'`);
      }
      
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
      appLogger.error('Error executing intent router:', error);
      logThought("Error occurred while processing the intent");
      return {
        success: false,
        message: "I encountered an error while processing your request. Please try again.",
        display: "I encountered an error while processing your request. Please try again."
      };
    }
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
      case 'create_task':
        return result.message || "Task created successfully.";
      case 'coda_document':
        return result.message || "Coda document created successfully.";
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
  
  /**
   * Enhance parameters with natural language understanding
   */
  private async enhanceParameters(
    params: Record<string, any>,
    input: string,
    toolName: string
  ): Promise<Record<string, any>> {
    // Create a copy of the parameters
    const enhancedParams = { ...params };
    
    try {
      // Enhance based on tool type
      switch (toolName) {
        case 'market_scan':
          // No special enhancements needed for market_scan yet
          break;
          
        case 'propose_content_ideas':
          // Make sure we have a topic parameter
          if (!enhancedParams.topic) {
            // Try to extract a topic from the input
            const topicMatch = input.match(/(?:about|for|on|related to)\s+([^,.?!]+)/i);
            if (topicMatch && topicMatch[1]) {
              enhancedParams.topic = topicMatch[1].trim();
              logThought(`Extracted topic: ${enhancedParams.topic}`);
            }
          }
          break;
          
        case 'reflect_on_performance':
          // Try to extract timeframe if not present
          if (!enhancedParams.timeframe) {
            // Look for time indicators
            const timeMatch = input.match(/(?:in|for|during|over the|last|past)\s+([^,.?!]+)/i);
            if (timeMatch && timeMatch[1]) {
              enhancedParams.timeframe = timeMatch[1].trim();
              logThought(`Extracted timeframe: ${enhancedParams.timeframe}`);
            } else {
              // Default to "past week"
              enhancedParams.timeframe = "past week";
            }
          }
          break;
          
        case 'notify_discord':
          // Extract priority for notifications
          if (!enhancedParams.priority) {
            const priority = this.extractPriority(input);
            enhancedParams.priority = priority;
            
            // If high priority, also set the mention flag
            if (priority === 'high') {
              enhancedParams.mention = true;
              logThought(`Detected high priority message, will mention user`);
            }
          }
          break;
      }
      
      // Extract any dates and add as deadline if relevant
      if (['create_task', 'schedule_task'].includes(toolName) && !enhancedParams.deadline) {
        const extractedDate = this.extractDateFromText(input);
        if (extractedDate) {
          enhancedParams.deadline = extractedDate.toISOString();
          logThought(`Extracted deadline: ${extractedDate.toDateString()}`);
        }
      }
      
      // Extract priority for any task-related actions
      if (['create_task', 'schedule_task'].includes(toolName) && !enhancedParams.priority) {
        const priority = this.extractPriority(input);
        enhancedParams.priority = priority;
        logThought(`Extracted priority: ${priority}`);
      }
      
      return enhancedParams;
    } catch (error) {
      console.error('Error enhancing parameters:', error);
      // Return original params if enhancement fails
      return params;
    }
  }

  // Helper methods for enhanceParameters
  private extractPriority(text: string): string {
    if (/\b(urgent|critical|high priority|asap|immediately)\b/i.test(text)) {
      return 'high';
    } else if (/\b(low priority|whenever|no rush|not urgent)\b/i.test(text)) {
      return 'low';
    }
    return 'medium';
  }

  private extractDateFromText(text: string): Date | null {
    // Simple date extraction for common formats like "tomorrow", "next Tuesday", "on May 1st"
    const today = new Date();
    
    // Check for "tomorrow"
    if (/\btomorrow\b/i.test(text)) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }
    
    // Check for "next week"
    if (/\bnext week\b/i.test(text)) {
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      return nextWeek;
    }
    
    // More complex date parsing would go here
    
    return null;
  }
}

/**
 * Adapter class to convert between CodaDocumentTool interface and BaseTool interface
 * This allows us to use the existing CodaDocumentTool with the IntentRouterTool
 */
class CodaDocumentToolAdapter extends BaseTool {
  private codaTool: CodaDocumentTool;

  constructor() {
    super(
      'coda_document',
      'Create, read, or update documents in Coda workspace',
      {
        topic: {
          type: 'string',
          description: 'The topic or title for the document'
        },
        content: {
          type: 'string',
          description: 'The content to include in the document'
        }
      }
    );
    
    // Import the CodaDocumentTool directly to avoid initialization issues
    this.codaTool = new CodaDocumentTool();
    console.log('CodaDocumentToolAdapter initialized');
  }

  async execute(params: Record<string, any>): Promise<any> {
    try {
      console.log('CodaDocumentToolAdapter executing with params:', params);
      
      // Extract the action from params or default to 'create'
      const action = params.action || 'create';
      let input = '';
      
      // If we have the raw input, check if it already has the action formatted
      if (params.input && !params.input.includes('|')) {
        // Extract topic from input if not explicitly provided
        if (!params.topic) {
          if (params.document_name) {
            params.topic = params.document_name;
          } else {
            const topicMatch = params.input.match(/(?:about|for|on|related to)\s+([^,.?!]+)/i);
            if (topicMatch && topicMatch[1]) {
              params.topic = topicMatch[1].trim();
              console.log(`Extracted topic from input: ${params.topic}`);
            } else {
              // Use a generic title based on the input
              params.topic = `Document from ${new Date().toLocaleDateString()}`;
            }
          }
        }
        
        // Use input as content if no specific content is provided
        if (!params.content) {
          params.content = `This document was created based on: "${params.input}"`;
        }
      }
      
      // Format the input for the CodaDocumentTool with the action prefix
      if (params.content) {
        input = `${action}|${params.topic || 'Untitled Document'}|${params.content}`;
      } else if (params.topic) {
        input = `${action}|${params.topic}|This is a document about ${params.topic}`;
      } else if (params.input) {
        // If the input already has the format action|topic|content, use it directly
        if (params.input.includes('|')) {
          input = params.input;
        } else {
          // Otherwise, wrap the raw input with the action
          input = `${action}|Generated Document|${params.input}`;
        }
      } else {
        return {
          success: false,
          message: "Missing required parameters to create a Coda document",
          display: "I need more information to create a Coda document. Please provide a topic."
        };
      }
      
      console.log('Formatted input for CodaDocumentTool:', input);
      
      // Call the _call method of the CodaDocumentTool
      const result = await this.codaTool._call(input);
      console.log('CodaDocumentTool result:', result);
      
      return {
        success: true,
        message: result,
        display: result
      };
    } catch (error) {
      console.error('Error in CodaDocumentToolAdapter:', error);
      return {
        success: false,
        error: `Error creating Coda document: ${error instanceof Error ? error.message : String(error)}`,
        message: `Error creating Coda document: ${error instanceof Error ? error.message : String(error)}`,
        display: `Error creating Coda document: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

/**
 * Get the LLM instance to use for generating content
 */
async function getLLM() {
  try {
    // Fix dynamic import for ChatOpenAI by using a more modern path
    const { ChatOpenAI } = await import('@langchain/openai');
    return new ChatOpenAI({
      modelName: 'gpt-4-0125-preview',
      temperature: 0.7
    });
  } catch (error) {
    console.error('Error getting LLM:', error);
    throw new Error(`Failed to initialize LLM: ${error}`);
  }
}