import { StateGraph, ChloeState, ChannelValue, Task, Memory, Reflection } from '../types/state';
import { Message as ChloeMessage } from '../types/message';
import { ChatOpenAI } from '@langchain/openai';
import { AgentConfig } from '../../../lib/shared';
import { SYSTEM_PROMPTS } from '../../../lib/shared';
import { AutonomySystem, AutonomyDiagnosis } from '../../../lib/shared/types/agent';
import { Notifier } from '../notifiers';
import { TaskLogger } from './taskLogger';
import { Persona } from '../persona';
import { ChloeMemory } from '../memory';
import { IAgent, ChloeMemoryOptions, MemoryEntry } from '../../../lib/shared/types/agentTypes';
import { IManager } from '../../../lib/shared/types/manager'; // Assuming IManager exists

// Import all the managers
import { MemoryManager } from './memoryManager';
import { ToolManager } from './toolManager';
import { PlanningManager, ExecutionResult, PlanWithSteps } from './planningManager';
import { ReflectionManager } from './reflectionManager';
import { ThoughtManager } from './thoughtManager';
import { MarketScannerManager } from './marketScannerManager';
import { KnowledgeGapsManager } from './knowledgeGapsManager';
import { StateManager } from './stateManager';
import { RobustSafeguards } from './robustSafeguards';

// Add these to the existing imports from agentTypes.ts
import {
  PlanAndExecuteOptions,
  PlanAndExecuteResult,
  ScheduledTask,
  MessageOptions,
} from '../../../lib/shared/types/agentTypes';

export interface ChloeAgentOptions {
  config?: Partial<AgentConfig>;
}

/**
 * ChloeAgent class implements a marketing assistant agent using a modular architecture
 */
export class ChloeAgent implements IAgent {
  readonly agentId: string = 'chloe';
  private _initialized: boolean = false;
  private autonomyMode: boolean = false;
  private scheduledTasks: ScheduledTask[] = [];
  
  get initialized(): boolean {
    return this._initialized;
  }
  
  private agent: StateGraph<ChloeState> | null = null;
  private config: AgentConfig;
  private notifiers: Notifier[] = [];
  
  // Core systems
  private model: ChatOpenAI | null = null;
  private taskLogger: TaskLogger;
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
  private stateManager: StateManager;
  private safeguards: RobustSafeguards;
  
  constructor(options?: ChloeAgentOptions) {
    // Initialize task logger first
    this.taskLogger = new TaskLogger();
    
    // Set default configuration
    this.config = {
      systemPrompt: SYSTEM_PROMPTS.CHLOE,
      model: 'gpt-4.1-2025-04-14', // Set a default model
      temperature: 0.7,
      maxTokens: 4000,
      ...(options?.config || {}),
    };
    
    console.log('ChloeAgent instance created');
    
    // Initialize state manager and safeguards
    this.stateManager = new StateManager(this.taskLogger);
    this.safeguards = new RobustSafeguards(this.taskLogger);
    
    // Initialize scheduled tasks
    this.scheduledTasks = [];
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
      await this.taskLogger.initialize();
      
      // Create a new session for this initialization
      this.taskLogger?.createSession('Chloe Agent Session', ['agent-init']);
      this.taskLogger?.logAction('Agent initialized', {
        agentId: this.agentId,
        timestamp: new Date().toISOString()
      });
      
      // Initialize memory manager
      this.memoryManager = new MemoryManager({ agentId: this.agentId });
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
        model: this.model!,
        agentId: this.agentId
      });
      await this.toolManager.initialize();
      
      // Initialize planning manager
      this.planningManager = new PlanningManager({
        agentId: this.agentId,
        memory: chloeMemory,
        model: this.model!,
        taskLogger: this.taskLogger,
        notifyFunction: async (message: string): Promise<void> => {
          this.notify(message);
        }
      });
      await this.planningManager.initialize();
      
      // Initialize reflection manager
      this.reflectionManager = new ReflectionManager({
        agentId: this.agentId,
        memory: chloeMemory,
        model: this.model!,
        logger: this.taskLogger,
        notifyFunction: async (message: string): Promise<void> => {
          this.notify(message);
        }
      });
      await this.reflectionManager.initialize();
      
      // Initialize thought manager
      this.thoughtManager = new ThoughtManager({
        agentId: this.agentId,
        memory: chloeMemory,
        model: this.model!,
        logger: this.taskLogger
      });
      await this.thoughtManager.initialize();
      
      // Initialize market scanner manager
      this.marketScannerManager = new MarketScannerManager({
        agentId: this.agentId,
        memory: chloeMemory,
        model: this.model!,
        logger: this.taskLogger,
        notifyFunction: async (message: string): Promise<void> => {
          this.notify(message);
        }
      });
      await this.marketScannerManager.initialize();
      
      // Initialize knowledge gaps manager
      this.knowledgeGapsManager = new KnowledgeGapsManager({
        agentId: this.agentId,
        memory: chloeMemory,
        model: this.model!,
        logger: this.taskLogger,
        notifyFunction: async (message: string): Promise<void> => {
          this.notify(message);
        }
      });
      await this.knowledgeGapsManager.initialize();
      
      this._initialized = true;
      console.log('ChloeAgent initialization complete.');
    } catch (error) {
      console.error('Error initializing ChloeAgent:', error);
      throw error;
    }
  }
  
  /**
   * Process a message from a user
   * @param message The user's message
   * @param options Additional processing options
   * @returns The agent's response
   */
  async processMessage(message: string, options: MessageOptions = { userId: 'gab' }): Promise<string> {
    // Check if this is a general knowledge question that shouldn't trigger specialized tools
    if (this.isGeneralKnowledgeQuestion(message)) {
      this.taskLogger?.logAction('Handling as general knowledge question', { message });
      
      try {
        // Process directly with the model using the persona's system prompt
        const response = await this.model!.invoke(
          `${this.config.systemPrompt}\n\nUser: ${message}`
        );
        
        return response.content as string;
      } catch (error) {
        console.error('Error processing general knowledge question:', error);
        return "I'm sorry, I encountered an error while processing your question. Could you please try asking in a different way?";
      }
    }
    
    // Continue with normal processing for non-general questions
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Use getters which throw if manager is null
      const thoughtManager = this.getThoughtManager();
      const memoryManager = this.getMemoryManager();
      const taskLogger = this.taskLogger;
      
      if (!thoughtManager || !memoryManager || !taskLogger) {
        throw new Error('Required managers not initialized');
      }
      
      // Log the received message
      taskLogger.logAction('Received message', {
        message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
        userId: options.userId,
        hasAttachments: !!options.attachments
      });
      
      // Log the thought process
      thoughtManager.logThought(`Processing message: ${message.substring(0, 100)}...`);
      
      // First, try to process with intent router
      if (this.toolManager) {
        try {
          // TODO: Define proper params type for processIntent
          const intentResult = await this.toolManager.processIntent(message, {});
          if (intentResult.success && intentResult.response) {
            // Store the user message in memory
            await this.getMemoryManager().addMemory(
              message,
              'message',
              'medium',
              'user',
              `From user: ${options.userId}`
            );
            
            // Store the response in memory
            await this.getMemoryManager().addMemory(
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
      const rawMemoryContext = await this.getMemoryManager().getRelevantMemories(message, 5);
      const memoryContextString = Array.isArray(rawMemoryContext)
        ? rawMemoryContext.map((entry: string | MemoryEntry) => {
            if (typeof entry === 'string') {
              return `- ${entry}`;
            } else if (typeof entry === 'object' && entry && 'content' in entry) {
              // Assuming MemoryEntry structure
              return `- ${entry.content} (Type: ${entry.type}, Importance: ${entry.importance})`;
            } else {
              return '- Invalid memory entry format';
            }
          }).join('\n')
        : 'No relevant memory context found.';

      // Create a context-aware prompt
      const contextPrompt = `You are Chloe, a Chief Marketing Officer AI.

${this.config.systemPrompt}

Here\'s relevant context from your memory that might help with this request:
---
${memoryContextString}
---

User message: ${message}`;
      
      // Generate a response
      const response = await this.model.invoke(contextPrompt);
      const responseText = response.content.toString();
      
      // Store the user message in memory
      await this.getMemoryManager().addMemory(
        message,
        'message',
        'medium',
        'user',
        `From user: ${options.userId}`
      );
      
      // Store the response in memory
      await this.getMemoryManager().addMemory(
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
   * Determines if a query is a general knowledge question that should bypass tool activation
   * @param query The user's query to evaluate
   * @returns True if this is a general knowledge question
   */
  private isGeneralKnowledgeQuestion(query: string): boolean {
    const generalPatterns = [
      /what (are|is) .*(metrics|tracking|measure|measuring|monitor|monitoring)/i,
      /which (metrics|measures|indicators|kpis)/i,
      /(tell me about|describe|explain) .*(metrics|measurements|kpis)/i,
      /how (do|does|are|is) .*(metrics|measure|track|monitor)/i
    ];
    
    return generalPatterns.some(pattern => pattern.test(query));
  }
  
  /**
   * Run daily tasks as part of the autonomy system
   */
  async runDailyTasks(): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Use getters
      const memoryManager = this.getMemoryManager();
      const planningManager = this.getPlanningManager();
      const marketScannerManager = this.getMarketScannerManager();
      const reflectionManager = this.getReflectionManager();
      const taskLogger = this.taskLogger;
      
      if (!memoryManager || !planningManager || !marketScannerManager || !reflectionManager || !taskLogger) {
        throw new Error('Required managers not initialized');
      }
      
      taskLogger.logAction('Starting daily tasks', {
        timestamp: new Date().toISOString()
      });
      
      // First run a market scan to gather fresh data
      await this.getMarketScannerManager().summarizeTrends();
      
      // Run the daily tasks
      await this.getPlanningManager().runDailyTasks();
      
      // Run a daily performance review
      await this.getReflectionManager().runPerformanceReview('daily');
      
      // Send a daily summary to Discord
      await this.sendDailySummaryToDiscord();
      
      taskLogger.logAction('Daily tasks completed', {
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
      
      // Use getter
      const reflectionManager = this.getReflectionManager();
      
      if (!reflectionManager) {
        throw new Error('Reflection manager not initialized');
      }
      
      // Run the weekly reflection
      const reflection = await this.getReflectionManager().runWeeklyReflection();
      
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
      
      // Use getter
      const reflectionManager = this.getReflectionManager();
      
      if (!reflectionManager) {
        throw new Error('Reflection manager not initialized');
      }
      
      // Run the reflection
      return await this.getReflectionManager().reflect(question);
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
      
      // Use getters
      const toolManager = this.getToolManager();
      const memoryManager = this.getMemoryManager();
      const reflectionManager = this.getReflectionManager();
      
      if (!toolManager || !memoryManager || !reflectionManager) {
        throw new Error('Required managers not initialized');
      }
      
      // Get the last day's activities from memory
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const chloeMemory = this.getMemoryManager().getChloeMemory();
      if (!chloeMemory) {
        throw new Error('ChloeMemory not available');
      }
      const memories = await chloeMemory.getMemoriesByDateRange(
        'message',
        oneDayAgo,
        new Date()
      );
      
      // Get recent strategic insights
      const strategicInsights = await memoryManager.getRecentStrategicInsights(3);
      
      // Format the strategic insights
      const insightsText = strategicInsights.length > 0
        ? `\n\nRecent Strategic Insights:\n${strategicInsights.map(insight => 
            `• ${insight.insight} [${insight.category}]`).join('\n')}`
        : 'No recent strategic insights found.';
      
      // Format the daily summary
      const dailySummary = `Daily Summary\\n\\n${memories ? memories.map((memory: MemoryEntry) => 
        `• ${memory.content} [Type: ${memory.type}]`).join('\\n') : 'No activities recorded.'}\\n\\n${insightsText}`;
      
      // Ensure toolManager is available before using it (added getter usage earlier)
      const notifyTool = await toolManager?.getTool('notify_discord');

      // Send the daily summary to Discord
      if (notifyTool && 'execute' in notifyTool && typeof notifyTool.execute === 'function') {
        await notifyTool.execute({ message: dailySummary });
      } else {
        // Fallback or log warning if notify tool is not available/executable
        console.warn('notify_discord tool not available or cannot be executed.');
        // Optionally use the direct notify method as a fallback
        // this.notify(dailySummary);
      }

      return true;
    } catch (error) {
      console.error('Error sending daily summary to Discord:', error);
      return false;
    }
  }
  
  /**
   * Get all registered notifiers
   */
  getNotifiers(): Notifier[] {
    return this.notifiers;
  }
  
  /**
   * Add a notifier for sending notifications
   */
  addNotifier(notifier: Notifier): void {
    this.notifiers.push(notifier);
    console.log(`Added notifier: ${notifier.name}`);
  }
  
  /**
   * Remove a notifier by name
   */
  removeNotifier(notifierName: string): void {
    this.notifiers = this.notifiers.filter(n => n.name !== notifierName);
    console.log(`Removed notifier: ${notifierName}`);
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
  
  /**
   * Check if the agent is initialized
   */
  isInitialized(): boolean {
    return this._initialized;
  }
  
  /**
   * Get the memory manager
   */
  getMemoryManager(): MemoryManager {
    if (!this.memoryManager) throw new Error("MemoryManager not initialized");
    return this.memoryManager;
  }
  
  /**
   * Get the tool manager
   */
  getToolManager(): ToolManager {
    if (!this.toolManager) throw new Error("ToolManager not initialized");
    return this.toolManager;
  }
  
  /**
   * Get the planning manager
   */
  getPlanningManager(): PlanningManager {
    if (!this.planningManager) throw new Error("PlanningManager not initialized");
    return this.planningManager;
  }
  
  /**
   * Get the reflection manager
   */
  getReflectionManager(): ReflectionManager {
    if (!this.reflectionManager) throw new Error("ReflectionManager not initialized");
    return this.reflectionManager;
  }
  
  /**
   * Get the knowledge gaps manager
   */
  getKnowledgeGapsManager(): KnowledgeGapsManager {
    if (!this.knowledgeGapsManager) throw new Error("KnowledgeGapsManager not initialized");
    return this.knowledgeGapsManager;
  }
  
  /**
   * Get the thought manager
   */
  getThoughtManager(): ThoughtManager {
    if (!this.thoughtManager) throw new Error("ThoughtManager not initialized");
    return this.thoughtManager;
  }
  
  /**
   * Get the market scanner manager
   */
  getMarketScannerManager(): MarketScannerManager {
    if (!this.marketScannerManager) throw new Error("MarketScannerManager not initialized");
    return this.marketScannerManager;
  }
  
  /**
   * Get the Chloe memory instance
   */
  getChloeMemory(): ChloeMemory | null {
    return this.memoryManager ? this.memoryManager.getChloeMemory() : null;
  }

  /**
   * Get the model instance
   */
  getModel(): ChatOpenAI | null {
    return this.model;
  }

  /**
   * Get the task logger instance
   */
  getTaskLogger(): TaskLogger | null {
    return this.taskLogger || null;
  }
  
  /**
   * Plan and execute a task
   */
  async planAndExecute(goal: string, options?: PlanAndExecuteOptions): Promise<PlanAndExecuteResult> {
    // Use getter which throws if not initialized
    const planningManager = this.getPlanningManager();
    
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
      
      return await planningManager.planAndExecuteWithOptions(mergedOptions);
    } catch (error) {
      console.error('Error in planAndExecute:', error);
      return {
        success: false,
        message: `Error executing plan: ${error}`,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get the autonomy system
   */
  async getAutonomySystem(): Promise<AutonomySystem | null> {
    if (!this.initialized) {
      await this.initialize();
    }
    if (!this.autonomySystem) {
      // Create a new autonomy system instance
      this.autonomySystem = {
        status: 'active',
        scheduledTasks: [],
        scheduler: {
          runTaskNow: async (taskId: string) => {
            try {
              const task = this.scheduledTasks.find(t => t.id === taskId);
              if (!task) {
                throw new Error(`Task ${taskId} not found`);
              }
              await this.runTask(task.name);
              return true;
            } catch (error) {
              console.error(`Error running task ${taskId}:`, error);
              return false;
            }
          },
          getScheduledTasks: () => this.scheduledTasks,
          setTaskEnabled: (taskId: string, enabled: boolean): boolean => {
            const task = this.scheduledTasks.find(t => t.id === taskId);
            if (!task) {
              return false;
            }
            task.enabled = enabled;
            return true;
          },
          setAutonomyMode: (enabled: boolean) => {
            this.autonomyMode = enabled;
            if (enabled) {
              this.startAutonomousTasks();
            } else {
              this.stopAutonomousTasks();
            }
          },
          getAutonomyMode: (): boolean => this.autonomyMode
        },
        initialize: async (): Promise<boolean> => {
          try {
            await this.initialize();
            return true;
          } catch (error) {
            console.error('Failed to initialize autonomy system:', error);
            return false;
          }
        },
        shutdown: async () => {
          try {
            await this.shutdown();
          } catch (error) {
            console.error('Error during autonomy system shutdown:', error);
          }
        },
        runTask: async (taskName: string): Promise<boolean> => {
          try {
            switch (taskName) {
              case 'dailyTasks':
                await this.runDailyTasks();
                break;
              case 'weeklyReflection':
                await this.runWeeklyReflection();
                break;
              case 'marketScan':
                await this.getMarketScannerManager().scanMarket();
                break;
              case 'knowledgeGaps':
                await this.getKnowledgeGapsManager().analyzeGaps();
                break;
              default:
                throw new Error(`Unknown task: ${taskName}`);
            }
            return true;
          } catch (error) {
            console.error(`Error running task ${taskName}:`, error);
            return false;
          }
        },
        scheduleTask: async (task: ScheduledTask): Promise<boolean> => {
          try {
            this.scheduledTasks.push(task);
            if (task.enabled) {
              this.startTask(task);
            }
            return true;
          } catch (error) {
            console.error(`Error scheduling task ${task.id}:`, error);
            return false;
          }
        },
        cancelTask: async (taskId: string): Promise<boolean> => {
          try {
            const taskIndex = this.scheduledTasks.findIndex(t => t.id === taskId);
            if (taskIndex === -1) {
              return false;
            }
            const task = this.scheduledTasks[taskIndex];
            this.stopTask(task);
            this.scheduledTasks.splice(taskIndex, 1);
            return true;
          } catch (error) {
            console.error(`Error canceling task ${taskId}:`, error);
            return false;
          }
        },
        planAndExecute: async (options: PlanAndExecuteOptions): Promise<PlanAndExecuteResult> => {
          try {
            return await this.planAndExecute(options.goalPrompt, options);
          } catch (error) {
            console.error('Error in planAndExecute:', error);
            return {
              success: false,
              message: `Error executing plan: ${error}`,
              error: error instanceof Error ? error.message : String(error)
            };
          }
        },
        diagnose: async (): Promise<AutonomyDiagnosis> => {
          try {
            const memoryManager = this.getMemoryManager();
            const memoryStatus = await memoryManager.diagnose();
            const planningManager = this.planningManager;
            const activeTasks = this.scheduledTasks.filter(t => t.enabled).length;
            
            return {
              memory: {
                status: memoryStatus?.status || 'unknown',
                messageCount: memoryStatus?.messageCount || 0
              },
              scheduler: {
                status: this.autonomyMode ? 'active' : 'inactive',
                activeTasks
              },
              planning: {
                status: (planningManager && planningManager.isInitialized()) ? 'operational' : 'not initialized'
              }
            };
          } catch (error) {
            console.error('Error diagnosing autonomy system:', error);
            return {
              memory: { status: 'error', messageCount: 0 },
              scheduler: { status: 'error', activeTasks: 0 },
              planning: { status: 'error' }
            };
          }
        }
      };
    }
    
    return this.autonomySystem;
  }

  // Add private helper methods for task management
  private startTask(task: ScheduledTask): void {
    if (task.interval) {
      const interval = setInterval(async () => {
        if (task.enabled) {
          await this.runTask(task.name);
        }
      }, task.interval);
      task.intervalId = interval;
    }
  }

  private stopTask(task: ScheduledTask): void {
    if (task.intervalId) {
      clearInterval(task.intervalId);
      task.intervalId = undefined;
    }
  }

  private startAutonomousTasks(): void {
    this.scheduledTasks.forEach(task => {
      if (task.enabled) {
        this.startTask(task);
      }
    });
  }

  private stopAutonomousTasks(): void {
    this.scheduledTasks.forEach(task => {
      this.stopTask(task);
    });
  }

  /**
   * Summarize a conversation with optional parameters
   */
  async summarizeConversation(options: { maxEntries?: number; maxLength?: number } = {}): Promise<string | null> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!this.taskLogger) {
        throw new Error('Task logger not initialized');
      }
      
      const session = this.taskLogger.getCurrentSession();
      if (!session) {
        return null;
      }
      
      return await this.taskLogger.summarizeConversation(session.id, options);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error summarizing conversation: ${errorMessage}`, { error });
      return null;
    }
  }

  /**
   * Run a task by name (throws if task unknown)
   */
  private async runTask(taskName: string): Promise<void> {
    switch (taskName) {
      case 'dailyTasks':
        await this.runDailyTasks();
        break;
      case 'weeklyReflection':
        await this.runWeeklyReflection();
        break;
      case 'marketScan':
        await this.getMarketScannerManager().scanMarket();
        break;
      case 'knowledgeGaps':
        await this.getKnowledgeGapsManager().analyzeGaps();
        break;
      default:
        throw new Error(`Unknown task: ${taskName}`);
    }
  }

  /**
   * Set up the LangGraph state management system
   */
  private async setupLangGraph(): Promise<StateGraph<ChloeState>> {
    const graph = new StateGraph<ChloeState>({
      channels: {
        messages: 'array' as ChannelValue<ChloeMessage[]>,
        memory: 'array' as ChannelValue<Memory[]>,
        tasks: 'array' as ChannelValue<Task[]>,
        reflections: 'array' as ChannelValue<Reflection[]>,
        response: 'single' as ChannelValue<string>,
        error: 'single' as ChannelValue<string>
      }
    });

    // Add nodes for different states
    graph.addNode('initialize', this.initializeState.bind(this));
    graph.addNode('process', this.processState.bind(this));
    graph.addNode('plan', this.planState.bind(this));
    graph.addNode('execute', this.executeState.bind(this));
    graph.addNode('reflect', this.reflectState.bind(this));
    graph.addNode('recover', this.recoverState.bind(this));

    // Define state transitions
    graph.addEdge('initialize', 'process');
    graph.addEdge('process', 'plan');
    graph.addEdge('plan', 'execute');
    graph.addEdge('execute', 'reflect');
    graph.addEdge('reflect', 'process');
    
    // Add error recovery paths
    graph.addEdge('*', 'recover'); // From any state to recover
    graph.addEdge('recover', 'process'); // After recovery, go back to processing

    return graph;
  }

  /**
   * Initialize state node handler (LangGraph Node)
   */
  private async initializeState(state: ChloeState): Promise<ChloeState> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      const newState = {
        ...state,
        messages: [],
        memory: [],
        tasks: [],
        reflections: []
      };
      
      // Create initial checkpoint
      await this.stateManager.createCheckpoint(newState, { type: 'initialization' });
      
      return newState;
    } catch (error) {
      return {
        ...state,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Process state node handler (LangGraph Node)
   */
  private async processState(state: ChloeState): Promise<ChloeState> {
    try {
      // Get relevant context from memory
      const memoryManager = this.getMemoryManager();
      const context = await memoryManager.getRelevantMemories(
        state.messages[state.messages.length - 1]?.content || '',
        5
      ) || [];

      // Convert string memories to Memory objects
      const memoryContext: Memory[] = context.map((content: any) => {
        if (typeof content === 'string') {
          return {
            id: `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            content,
            type: 'message',
            importance: 'medium',
            source: 'system',
            created: new Date(),
            lastAccessed: new Date(),
            accessCount: 1
          };
        }
        return content as Memory;
      });

      const newState: ChloeState = {
        ...state,
        memory: [...state.memory, ...memoryContext]
      };

      // Create checkpoint before processing
      await this.stateManager.createCheckpoint(newState, { type: 'pre_processing' });

      return newState;
    } catch (error) {
      return {
        ...state,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Plan state node handler (LangGraph Node)
   */
  private async planState(state: ChloeState): Promise<ChloeState> {
    try {
      const planningManager = this.getPlanningManager(); // Use getter

      const lastMessage = state.messages[state.messages.length - 1];
      if (!lastMessage) {
        throw new Error('No message to plan for');
      }

      // Create checkpoint before planning
      await this.stateManager.createCheckpoint(state, { type: 'pre_planning' });

      const planResult = await planningManager.planAndExecuteWithOptions({
        goalPrompt: lastMessage.content,
        autonomyMode: this.autonomyMode
      });

      if (!planResult.success) {
        throw new Error(planResult.error || 'Planning failed');
      }

      const currentTask: Task = {
        id: `task_${Date.now()}`,
        description: lastMessage.content,
        status: 'in_progress',
        priority: 1,
        created_at: new Date(),
        updated_at: new Date()
      };

      const newState: ChloeState = {
        ...state,
        currentTask
      };

      // Create checkpoint after planning
      await this.stateManager.createCheckpoint(newState, { type: 'post_planning' });

      return newState;
    } catch (error) {
      // Try to rollback to pre-planning state
      const checkpoints = this.stateManager.getCheckpoints();
      const prePlanningCheckpoint = checkpoints.find(cp => cp.metadata?.type === 'pre_planning');
      if (prePlanningCheckpoint) {
        await this.stateManager.rollback(prePlanningCheckpoint.id);
      }

      return {
        ...state,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Execute state node handler (LangGraph Node)
   */
  private async executeState(state: ChloeState): Promise<ChloeState> {
    try {
      if (!state.currentTask) {
        throw new Error('No task to execute');
      }

      // Create checkpoint before execution
      await this.stateManager.createCheckpoint(state, { type: 'pre_execution' });

      // Execute the current task
      const result = await this.executeTask(state.currentTask);

      const updatedTask: Task = {
        ...state.currentTask,
        status: result.success ? 'completed' : 'failed',
        updated_at: new Date()
      };

      const newState: ChloeState = {
        ...state,
        tasks: [...state.tasks, updatedTask],
        response: result.message,
        currentTask: undefined
      };

      // Create checkpoint after execution
      await this.stateManager.createCheckpoint(newState, { type: 'post_execution' });

      return newState;
    } catch (error) {
      // Try to rollback to pre-execution state
      const checkpoints = this.stateManager.getCheckpoints();
      const preExecutionCheckpoint = checkpoints.find(cp => cp.metadata?.type === 'pre_execution');
      if (preExecutionCheckpoint) {
        await this.stateManager.rollback(preExecutionCheckpoint.id);
      }

      return {
        ...state,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Reflect state node handler (LangGraph Node)
   */
  private async reflectState(state: ChloeState): Promise<ChloeState> {
    try {
      const reflectionManager = this.getReflectionManager(); // Use getter

      // Create checkpoint before reflection
      await this.stateManager.createCheckpoint(state, { type: 'pre_reflection' });

      const reflectionContent = await reflectionManager.reflect(
        `Review the execution of task: ${state.currentTask?.description}`
      );

      const newReflection: Reflection = {
        id: `reflection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: reflectionContent,
        type: 'improvement',
        timestamp: new Date(),
        metadata: {
          relatedTasks: state.currentTask ? [state.currentTask.id] : undefined
        }
      };

      const newState: ChloeState = {
        ...state,
        reflections: [...state.reflections, newReflection]
      };

      // Create checkpoint after reflection
      await this.stateManager.createCheckpoint(newState, { type: 'post_reflection' });

      return newState;
    } catch (error) {
      // Try to rollback to pre-reflection state
      const checkpoints = this.stateManager.getCheckpoints();
      const preReflectionCheckpoint = checkpoints.find(cp => cp.metadata?.type === 'pre_reflection');
      if (preReflectionCheckpoint) {
        await this.stateManager.rollback(preReflectionCheckpoint.id);
      }

      return {
        ...state,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Recovery state node handler (LangGraph Node)
   */
  private async recoverState(state: ChloeState): Promise<ChloeState> {
    try {
      // Log the error
      if (this.taskLogger) {
        this.taskLogger.logAction('Error recovery triggered', {
          error: state.error,
          currentTask: state.currentTask,
          lastMessage: state.messages[state.messages.length - 1]
        });
      }

      // Try to find the last successful checkpoint
      const checkpoints = this.stateManager.getCheckpoints();
      const lastSuccessfulCheckpoint = checkpoints.find(cp => 
        cp.metadata?.type && ['post_planning', 'post_execution', 'post_reflection'].includes(String(cp.metadata.type))
      );

      if (lastSuccessfulCheckpoint) {
        // Rollback to the last successful state
        await this.stateManager.rollback(lastSuccessfulCheckpoint.id);
        return lastSuccessfulCheckpoint.state as ChloeState;
      }

      // If no successful checkpoint found, clear the error and current task
      return {
        ...state,
        error: undefined,
        currentTask: undefined,
        response: `I encountered an error: ${state.error}. I'll try to handle your request differently.`
      };
    } catch (error) {
      // If recovery itself fails, we're in trouble
      if (this.taskLogger) {
        this.taskLogger.logAction('Recovery failed', { error });
      }
      return {
        ...state,
        error: 'Critical error: Recovery failed'
      };
    }
  }

  /**
   * Execute a task with proper error handling and recovery
   */
  private async executeTask(task: Task): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      // Validate task parameters using safeguards
      if (!task.description) {
        throw new Error('Task description is required');
      }
      
      if (this.safeguards && !this.safeguards.validateTask(task)) {
        throw new Error('Task validation failed');
      }

      // Check resource limits
      if (this.safeguards && !await this.safeguards.checkResourceLimits()) {
        throw new Error('Resource limits exceeded');
      }

      // Register cleanup task before execution
      let cleanupTaskId: string | undefined;
      if (this.safeguards) {
        cleanupTaskId = this.safeguards.registerCleanupTask(
          `Cleanup for task: ${task.id}`,
          ['memory', 'cache'],
          'medium'
        );
      }

      // Execute the task with enhanced circuit breaker pattern
      let result: PlanAndExecuteResult; // Explicit type
      if (this.safeguards) {
        result = await this.safeguards.executeWithCircuitBreaker(
          'task_execution',
          async () => {
            return await this.planAndExecute(task.description, {
              goalPrompt: task.description,
              maxSteps: 10,
              timeLimit: 300
            });
          },
          {
            timeout: 600000, // 10 minutes timeout
            fallback: {
              success: false,
              message: `Task execution timed out: ${task.description}`
            }
          }
        );
      } else {
        // Fall back to original implementation if safeguards not available
        result = await this.executeWithCircuitBreaker(async () => {
          return await this.planAndExecute(task.description, {
            goalPrompt: task.description,
            maxSteps: 10,
            timeLimit: 300
          });
        });
      }

      // Execute cleanup task after completion
      if (this.safeguards && cleanupTaskId) {
        await this.safeguards.executeCleanupTask(cleanupTaskId);
      }

      return {
        success: result.success,
        message: result.message
      };
    } catch (error) {
      if (this.taskLogger) {
        this.taskLogger.logAction('Task execution error', {
          taskId: task.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Execute with circuit breaker pattern
   */
  private async executeWithCircuitBreaker<T>(fn: () => Promise<T>): Promise<T> {
    return this.safeguards.executeWithCircuitBreaker('agent_operation', fn);
  }
}