import { StateGraph } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { AgentConfig, Message, Task } from '../../../lib/shared';
import { SYSTEM_PROMPTS } from '../../../lib/shared';
import { ChloeState, AutonomySystem } from '../../../lib/shared/types/agent';
import { Notifier } from '../notifiers';
import { TaskLogger } from '../task-logger';
import { Persona } from '../persona';
import { ChloeMemory } from '../memory';

// Import all the managers
import { MemoryManager } from './memoryManager';
import { ToolManager } from './toolManager';
import { PlanningManager, ExecutionResult, PlanWithSteps } from './planningManager';
import { ReflectionManager } from './reflectionManager';
import { ThoughtManager } from './thoughtManager';
import { MarketScannerManager } from './marketScannerManager';
import { KnowledgeGapsManager } from './knowledgeGapsManager';

// Add these to the existing imports from agentTypes.ts
import {
  PlanAndExecuteOptions,
  PlanAndExecuteResult,
  ScheduledTask,
  MessageOptions,
} from '../../../lib/shared/types/agentTypes';

export interface ChloeAgentOptions {
  config?: Partial<AgentConfig>;
  useOpenAI?: boolean;
}

/**
 * ChloeAgent class implements a marketing assistant agent using a modular architecture
 */
export class ChloeAgent {
  private agent: StateGraph<ChloeState> | null = null;
  private config: AgentConfig;
  private initialized: boolean = false;
  private notifiers: Notifier[] = [];
  
  // Core systems
  private model: ChatOpenAI | null = null;
  private taskLogger: TaskLogger | null = null;
  private persona: Persona | null = null;
  private autonomySystem: AutonomySystem | null = null;
  
  // Managers
  private memoryManager: MemoryManager | null = null;
  private toolManager: ToolManager | null = null;
  private planningManager: PlanningManager | null = null;
  private reflectionManager: ReflectionManager | null = null;
  private thoughtManager: ThoughtManager | null = null;
  private marketScannerManager: MarketScannerManager | null = null;
  private knowledgeGapsManager: KnowledgeGapsManager | null = null;
  
  constructor(options?: ChloeAgentOptions) {
    // Set default configuration
    this.config = {
      systemPrompt: SYSTEM_PROMPTS.CHLOE,
      model: 'openrouter/anthropic/claude-3-opus:2024-05-01',
      temperature: 0.7,
      maxTokens: 4000,
      ...options?.config,
    };
    
    console.log('ChloeAgent instance created');
  }
  
  /**
   * Initialize the agent with necessary services and resources
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing ChloeAgent...');

      // Initialize OpenAI model
      this.model = new ChatOpenAI({
        modelName: process.env.OPENAI_MODEL_NAME || 'gpt-4.1-2025-04-14',
        temperature: 0.7,
        openAIApiKey: process.env.OPENROUTER_API_KEY,
        configuration: {
          baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
          defaultHeaders: {
            'HTTP-Referer': 'https://crowd-wisdom-agents.vercel.app',
            'X-Title': 'Crowd Wisdom Agents - Chloe',
          },
        }
      });
      
      // Make model available globally for TaskLogger to use
      global.model = this.model;
      
      // Initialize persona system
      this.persona = new Persona();
      await this.persona.initialize();
      
      // Load persona and update system prompt if successful
      try {
        const systemPrompt = await this.persona.loadPersona();
        if (systemPrompt) {
          this.config.systemPrompt = systemPrompt;
          console.log('Updated system prompt from persona files');
        }
      } catch (error) {
        console.warn('Failed to load persona files, using default system prompt', error);
      }

      // Initialize task logger
      this.taskLogger = new TaskLogger({
        logsPath: process.env.TASK_LOGS_PATH,
        persistToFile: true
      });
      await this.taskLogger.initialize();
      
      // Create a new session for this initialization
      this.taskLogger.createSession('Chloe Agent Session', ['agent-init']);
      this.taskLogger.logAction('Agent initialized', {
        agentId: 'chloe',
        timestamp: new Date().toISOString()
      });
      
      // Initialize memory manager
      this.memoryManager = new MemoryManager({
        agentId: 'chloe'
      });
      await this.memoryManager.initialize();
      
      // Get the base memory for initializing other managers
      const chloeMemory = this.memoryManager.getChloeMemory();
      if (!chloeMemory) {
        throw new Error('Failed to initialize ChloeMemory');
      }
      
      // Initialize tool manager
      this.toolManager = new ToolManager({
        logger: this.taskLogger,
        memory: chloeMemory,
        model: this.model,
        agentId: 'chloe'
      });
      await this.toolManager.initialize();
      
      // Initialize planning manager
      this.planningManager = new PlanningManager({
        agentId: 'chloe',
        memory: chloeMemory,
        model: this.model,
        taskLogger: this.taskLogger,
        notifyFunction: (message: string) => {
          this.notify(message);
          return Promise.resolve();
        }
      });
      await this.planningManager.initialize();
      
      // Initialize reflection manager
      this.reflectionManager = new ReflectionManager({
        agentId: 'chloe',
        memory: chloeMemory,
        model: this.model,
        taskLogger: this.taskLogger,
        notifyFunction: (message: string) => {
          this.notify(message);
          return Promise.resolve();
        }
      });
      await this.reflectionManager.initialize();
      
      // Initialize thought manager
      this.thoughtManager = new ThoughtManager({
        agentId: 'chloe',
        memory: chloeMemory,
        model: this.model,
        taskLogger: this.taskLogger
      });
      await this.thoughtManager.initialize();
      
      // Initialize market scanner manager
      this.marketScannerManager = new MarketScannerManager({
        agentId: 'chloe',
        memory: chloeMemory,
        model: this.model,
        taskLogger: this.taskLogger,
        notifyFunction: (message: string) => {
          this.notify(message);
          return Promise.resolve();
        }
      });
      await this.marketScannerManager.initialize();
      
      // Initialize knowledge gaps manager
      this.knowledgeGapsManager = new KnowledgeGapsManager({
        memory: chloeMemory,
        openaiApiKey: process.env.OPENAI_API_KEY || '',
        agentId: 'chloe',
        logger: this.taskLogger,
        notifyFunction: async (message) => {
          this.notify(message);
          return Promise.resolve();
        }
      });
      await this.knowledgeGapsManager.initialize();
      
      this.initialized = true;
      console.log('ChloeAgent initialization complete.');
    } catch (error) {
      console.error('Error initializing ChloeAgent:', error);
      throw error;
    }
  }
  
  /**
   * Process a message and generate a response
   */
  async processMessage(message: string, options: MessageOptions): Promise<string> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!this.thoughtManager || !this.memoryManager || !this.taskLogger) {
        throw new Error('Required managers not initialized');
      }
      
      // Log the received message
      this.taskLogger.logAction('Received message', {
        message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
        userId: options.userId,
        hasAttachments: !!options.attachments
      });
      
      // Log the thought process
      this.thoughtManager.logThought(`Processing message: ${message.substring(0, 100)}...`);
      
      // First, try to process with intent router
      if (this.toolManager) {
        try {
          // Passing an empty object as params for now
          const intentResult = await this.toolManager.processIntent(message, {});
          if (intentResult.success && intentResult.response) {
            // Store the user message in memory
            await this.memoryManager.addMemory(
              message,
              'message',
              'medium',
              'user',
              `From user: ${options.userId}`
            );
            
            // Store the response in memory
            await this.memoryManager.addMemory(
              intentResult.response,
              'message',
              'medium',
              'chloe',
              `Response to: ${message.substring(0, 50)}...`
            );
            
            return intentResult.response;
          }
        } catch (error) {
          console.error('Error processing intent:', error);
        }
      }
      
      // If intent processing failed or not available, use the model directly
      if (!this.model) {
        throw new Error('Model not initialized');
      }
      
      // Get relevant memory context
      const memoryContext = await this.memoryManager.getRelevantMemories(message, 5);
      
      // Create a context-aware prompt
      const contextPrompt = `You are Chloe, a Chief Marketing Officer AI. 

${this.config.systemPrompt}

Here's relevant context from your memory that might help with this request:
${memoryContext.join('\n')}

User message: ${message}`;
      
      // Generate a response
      const response = await this.model.invoke(contextPrompt);
      const responseText = response.content.toString();
      
      // Store the user message in memory
      await this.memoryManager.addMemory(
        message,
        'message',
        'medium',
        'user',
        `From user: ${options.userId}`
      );
      
      // Store the response in memory
      await this.memoryManager.addMemory(
        responseText,
        'message',
        'medium',
        'chloe',
        `Response to: ${message.substring(0, 50)}...`
      );
      
      return responseText;
    } catch (error) {
      console.error('Error processing message:', error);
      return `I'm sorry, I encountered an error while processing your message: ${error}`;
    }
  }
  
  /**
   * Run daily tasks as part of the autonomy system
   */
  async runDailyTasks(): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!this.memoryManager || !this.planningManager || !this.marketScannerManager || !this.reflectionManager || !this.taskLogger) {
        throw new Error('Required managers not initialized');
      }
      
      this.taskLogger.logAction('Starting daily tasks', {
        timestamp: new Date().toISOString()
      });
      
      // First run a market scan to gather fresh data
      await this.marketScannerManager.summarizeTrends();
      
      // Run the daily tasks
      await this.planningManager.runDailyTasks();
      
      // Run a daily performance review
      await this.reflectionManager.runPerformanceReview('daily');
      
      // Send a daily summary to Discord
      await this.sendDailySummaryToDiscord();
      
      this.taskLogger.logAction('Daily tasks completed', {
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error running daily tasks:', error);
      if (this.taskLogger) {
        this.taskLogger.logAction('Daily tasks error', { error });
      }
      this.notify(`Error running daily tasks: ${error}`);
    }
  }
  
  /**
   * Run weekly reflection and reporting
   */
  async runWeeklyReflection(): Promise<string> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!this.reflectionManager) {
        throw new Error('Reflection manager not initialized');
      }
      
      // Run the weekly reflection
      const reflection = await this.reflectionManager.runWeeklyReflection();
      
      // Notify about the reflection
      this.notify('Weekly reflection completed.');
      
      return reflection;
    } catch (error) {
      console.error('Error running weekly reflection:', error);
      return `Error running weekly reflection: ${error}`;
    }
  }
  
  /**
   * Reflect on a specific question
   */
  async reflect(question: string): Promise<string> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!this.reflectionManager) {
        throw new Error('Reflection manager not initialized');
      }
      
      // Run the reflection
      return await this.reflectionManager.reflect(question);
    } catch (error) {
      console.error('Error during reflection:', error);
      return `Error during reflection: ${error}`;
    }
  }
  
  /**
   * Send a daily summary to Discord
   */
  async sendDailySummaryToDiscord(): Promise<boolean> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!this.toolManager || !this.memoryManager || !this.reflectionManager) {
        throw new Error('Required managers not initialized');
      }
      
      // Get the last day's activities from memory
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const memories = await this.memoryManager.getChloeMemory()?.getMemoriesByDateRange(
        'message',
        oneDayAgo,
        new Date()
      );
      
      // Get recent strategic insights
      const strategicInsights = await this.memoryManager.getRecentStrategicInsights(3);
      
      // Format the strategic insights
      const insightsText = strategicInsights.length > 0
        ? `\n\nRecent Strategic Insights:\n${strategicInsights.map(insight => 
            `• ${insight.insight} [${insight.category}]`).join('\n')}`
        : '\n\nNo recent strategic insights.';
      
      // Get a daily review
      const reviewResponse = await this.reflectionManager.runPerformanceReview('daily');
      const reviewText = reviewResponse.fullText || 'No daily review available.';
      
      // Create the message
      const message = `# Chloe CMO - Daily Summary (${new Date().toLocaleDateString()})

## Daily Review
${reviewText.substring(0, 500)}${reviewText.length > 500 ? '...' : ''}

${insightsText}

---
*This is an automated daily summary from Chloe, your AI Chief Marketing Officer.*`;
      
      // Send to Discord using the notify_discord tool
      const discordTool = await this.toolManager.getTool('notify_discord');
      if (discordTool) {
        await discordTool.execute({ message });
        return true;
      } else {
        console.warn('Discord notification tool not available');
        return false;
      }
    } catch (error) {
      console.error('Error sending daily summary to Discord:', error);
      return false;
    }
  }
  
  /**
   * Add a notifier for sending notifications
   */
  addNotifier(notifier: Notifier): void {
    this.notifiers.push(notifier);
    console.log(`Added notifier: ${notifier.name}`);
  }
  
  /**
   * Send a notification to all registered notifiers
   */
  notify(message: string): void {
    // Log the notification
    console.log(`[Notification] ${message}`);
    
    // Send to all notifiers
    for (const notifier of this.notifiers) {
      try {
        // Check which method is available on the notifier
        if (typeof notifier.send === 'function') {
          // Using void to ignore the promise since this is a synchronous method
          void notifier.send(message).catch(err => {
            console.error(`Error in notifier ${notifier.name}:`, err);
          });
        } else {
          console.warn(`Notifier ${notifier.name} has no send method`);
        }
      } catch (error) {
        console.error(`Error in notifier ${notifier.name}:`, error);
      }
    }
  }
  
  /**
   * Shutdown the agent and all its systems
   */
  async shutdown(): Promise<void> {
    try {
      console.log('Shutting down ChloeAgent...');
      
      // Perform any necessary cleanup
      if (this.taskLogger) {
        this.taskLogger.logAction('Agent shutdown');
        await this.taskLogger.close();
      }
      
      console.log('ChloeAgent shutdown complete.');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }
  
  // Getters for accessing components
  
  getChloeMemory(): ChloeMemory | null {
    return this.memoryManager?.getChloeMemory() || null;
  }
  
  getPersona(): Persona | null {
    return this.persona;
  }
  
  getTaskLogger(): TaskLogger | null {
    return this.taskLogger;
  }
  
  getModel(): ChatOpenAI | null {
    return this.model;
  }
  
  isInitialized(): boolean {
    return this.initialized;
  }
  
  // Getters for all managers
  
  getMemoryManager(): MemoryManager | null {
    return this.memoryManager;
  }
  
  getToolManager(): ToolManager | null {
    return this.toolManager;
  }
  
  getPlanningManager(): PlanningManager | null {
    return this.planningManager;
  }
  
  getReflectionManager(): ReflectionManager | null {
    return this.reflectionManager;
  }
  
  getThoughtManager(): ThoughtManager | null {
    return this.thoughtManager;
  }
  
  getMarketScannerManager(): MarketScannerManager | null {
    return this.marketScannerManager;
  }
  
  getKnowledgeGapsManager(): KnowledgeGapsManager | null {
    return this.knowledgeGapsManager;
  }
  
  /**
   * Get the autonomy system
   * Required by scheduler.ts
   */
  async getAutonomySystem(): Promise<AutonomySystem | null> {
    // If autonomySystem is not initialized but we have planAndExecute method,
    // create an adapter that implements the AutonomySystem interface
    if (!this.autonomySystem && typeof this.planAndExecute === 'function') {
      // Create a minimal implementation of AutonomySystem that delegates to this.planAndExecute
      return {
        status: 'active',
        scheduledTasks: [],
        // Use our planAndExecute method
        planAndExecute: async (options: PlanAndExecuteOptions): Promise<PlanAndExecuteResult> => {
          return await this.planAndExecute(options.goalPrompt, options);
        },
        // Stub implementations for other required methods
        runTask: async (taskName: string) => {
          console.log(`Running task: ${taskName}`);
          return true;
        },
        scheduleTask: async (task: ScheduledTask) => {
          console.log(`Scheduling task: ${task.id}`);
          return true;
        },
        initialize: async () => {
          console.log('Initializing autonomy system');
          return true;
        }
      };
    }
    
    return this.autonomySystem;
  }
  
  /**
   * Get the cognitive memory system
   * Required by tasks.ts for memory consolidation
   */
  getCognitiveMemory(): unknown {
    // Pass through to memory manager
    return this.memoryManager?.getCognitiveMemory() || null;
  }
  
  /**
   * Get the knowledge graph
   * Required by tasks.ts for memory consolidation
   */
  getKnowledgeGraph(): unknown {
    // Pass through to memory manager
    return this.memoryManager?.getKnowledgeGraph() || null;
  }
  
  /**
   * Plan and execute a task 
   */
  async planAndExecute(goal: string, options?: Partial<PlanAndExecuteOptions>): Promise<PlanAndExecuteResult> {
    if (!this.planningManager) {
      return {
        success: false,
        message: "Planning manager not available",
        error: "Planning manager not available"
      };
    }
    
    try {
      // Default values for options
      const defaultOptions: PlanAndExecuteOptions = {
        goalPrompt: goal,
        autonomyMode: false,
        maxSteps: 10,
        timeLimit: 300 // 5 minutes in seconds
      };
      
      // Merge with provided options
      const mergedOptions: PlanAndExecuteOptions = {
        ...defaultOptions,
        ...options
      };
      
      return await this.planningManager.planAndExecuteWithOptions(mergedOptions);
    } catch (error) {
      console.error('Error in planAndExecute:', error);
      return {
        success: false,
        message: `Error executing plan: ${error}`,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}