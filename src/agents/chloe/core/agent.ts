import { StateGraph, ChloeState, ChannelValue, Task, Memory, Reflection } from '../types/state';
import { Message as ChloeMessage } from '../types/message';
import { ChatOpenAI } from '@langchain/openai';
import { AgentConfig } from '../../../lib/shared';
import { SYSTEM_PROMPTS } from '../../../lib/shared';
import { AutonomySystem } from '../../../lib/shared/types/agent';
import { Notifier } from '../notifiers';
import { TaskLogger } from '../task-logger';
import { Persona } from '../persona';
import { ChloeMemory } from '../memory';
import { IAgent } from '../../../lib/shared/types/agentTypes';

// Import all the managers
import { MemoryManager } from './memoryManager';
import { ToolManager } from './toolManager';
import { PlanningManager, ExecutionResult, PlanWithSteps } from './planningManager';
import { ReflectionManager } from './reflectionManager';
import { ThoughtManager } from './thoughtManager';
import { MarketScannerManager } from './marketScannerManager';
import { KnowledgeGapsManager } from './knowledgeGapsManager';
import { StateManager } from './stateManager';

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
export class ChloeAgent implements IAgent {
  // Core properties
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
  private stateManager: StateManager;
  
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
    this.stateManager = new StateManager(this.taskLogger || undefined);
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
        logger: this.taskLogger,
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
        logger: this.taskLogger
      });
      await this.thoughtManager.initialize();
      
      // Initialize market scanner manager
      this.marketScannerManager = new MarketScannerManager({
        agentId: 'chloe',
        memory: chloeMemory,
        model: this.model,
        logger: this.taskLogger,
        notifyFunction: (message: string) => {
          this.notify(message);
          return Promise.resolve();
        }
      });
      await this.marketScannerManager.initialize();
      
      // Initialize knowledge gaps manager
      this.knowledgeGapsManager = new KnowledgeGapsManager({
        agentId: 'chloe',
        memory: chloeMemory,
        model: this.model,
        logger: this.taskLogger,
        notifyFunction: async (message) => {
          this.notify(message);
          return Promise.resolve();
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
        : 'No recent strategic insights found.';
      
      // Format the daily summary
      const dailySummary = `Daily Summary\n\n${memories ? memories.map(memory => 
        `• ${memory.content} [${memory.category}]`).join('\n') : 'No activities recorded.'}\n\n${insightsText}`;
      
      // Send the daily summary to Discord
      await this.notify(dailySummary);
      
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
  getMemoryManager(): MemoryManager | null {
    return this.memoryManager;
  }
  
  /**
   * Get the tool manager
   */
  getToolManager(): ToolManager | null {
    return this.toolManager;
  }
  
  /**
   * Get the planning manager
   */
  getPlanningManager(): PlanningManager | null {
    return this.planningManager;
  }
  
  /**
   * Get the reflection manager
   */
  getReflectionManager(): ReflectionManager | null {
    return this.reflectionManager;
  }
  
  /**
   * Get the knowledge gaps manager
   */
  getKnowledgeGapsManager(): KnowledgeGapsManager | null {
    return this.knowledgeGapsManager;
  }
  
  /**
   * Plan and execute a task
   */
  async planAndExecute(goal: string, options?: PlanAndExecuteOptions): Promise<PlanAndExecuteResult> {
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

  /**
   * Get the autonomy system
   */
  async getAutonomySystem(): Promise<AutonomySystem | null> {
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
          setTaskEnabled: (taskId: string, enabled: boolean) => {
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
          getAutonomyMode: () => this.autonomyMode
        },
        initialize: async () => {
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
        runTask: async (taskName: string) => {
          try {
            switch (taskName) {
              case 'dailyTasks':
                await this.runDailyTasks();
                break;
              case 'weeklyReflection':
                await this.runWeeklyReflection();
                break;
              case 'marketScan':
                await this.marketScannerManager?.scanMarket();
                break;
              case 'knowledgeGaps':
                await this.knowledgeGapsManager?.analyzeGaps();
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
        scheduleTask: async (task: ScheduledTask) => {
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
        cancelTask: async (taskId: string) => {
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
        diagnose: async () => {
          try {
            const memoryStatus = await this.memoryManager?.diagnose();
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
                status: this.planningManager?.isInitialized() ? 'operational' : 'not initialized'
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
   * Run a task by name
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
        await this.marketScannerManager?.scanMarket();
        break;
      case 'knowledgeGaps':
        await this.knowledgeGapsManager?.analyzeGaps();
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
   * Initialize state node handler
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
   * Process state node handler
   */
  private async processState(state: ChloeState): Promise<ChloeState> {
    try {
      // Get relevant context from memory
      const context = await this.memoryManager?.getRelevantMemories(
        state.messages[state.messages.length - 1]?.content || '',
        5
      ) || [];

      // Convert string memories to Memory objects
      const memoryContext: Memory[] = context.map(content => {
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
        return content;
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
   * Plan state node handler
   */
  private async planState(state: ChloeState): Promise<ChloeState> {
    try {
      if (!this.planningManager) {
        throw new Error('Planning manager not initialized');
      }

      const lastMessage = state.messages[state.messages.length - 1];
      if (!lastMessage) {
        throw new Error('No message to plan for');
      }

      // Create checkpoint before planning
      await this.stateManager.createCheckpoint(state, { type: 'pre_planning' });

      const planResult = await this.planningManager.planAndExecuteWithOptions({
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
   * Execute state node handler
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
   * Reflect state node handler
   */
  private async reflectState(state: ChloeState): Promise<ChloeState> {
    try {
      if (!this.reflectionManager) {
        throw new Error('Reflection manager not initialized');
      }

      // Create checkpoint before reflection
      await this.stateManager.createCheckpoint(state, { type: 'pre_reflection' });

      const reflectionContent = await this.reflectionManager.reflect(
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
   * Recovery state node handler
   */
  private async recoverState(state: ChloeState): Promise<ChloeState> {
    try {
      // Log the error
      this.taskLogger?.logAction('Error recovery triggered', {
        error: state.error,
        currentTask: state.currentTask,
        lastMessage: state.messages[state.messages.length - 1]
      });

      // Try to find the last successful checkpoint
      const checkpoints = this.stateManager.getCheckpoints();
      const lastSuccessfulCheckpoint = checkpoints.find(cp => 
        cp.metadata?.type && ['post_planning', 'post_execution', 'post_reflection'].includes(cp.metadata.type)
      );

      if (lastSuccessfulCheckpoint) {
        // Rollback to the last successful state
        await this.stateManager.rollback(lastSuccessfulCheckpoint.id);
        return lastSuccessfulCheckpoint.state;
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
      this.taskLogger?.logAction('Recovery failed', { error });
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
      // Validate task parameters
      if (!task.description) {
        throw new Error('Task description is required');
      }

      // Check resource limits
      if (!await this.checkResourceLimits()) {
        throw new Error('Resource limits exceeded');
      }

      // Execute the task with circuit breaker pattern
      const result = await this.executeWithCircuitBreaker(async () => {
        return await this.planAndExecute(task.description, {
          goalPrompt: task.description,
          maxSteps: 10,
          timeLimit: 300
        });
      });

      return {
        success: result.success,
        message: result.message
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Check system resource limits
   */
  private async checkResourceLimits(): Promise<boolean> {
    try {
      const memoryStatus = await this.memoryManager?.diagnose();
      const activeTasks = this.scheduledTasks.filter(t => t.enabled).length;

      // Define some reasonable limits
      const MAX_MEMORY_MESSAGES = 10000;
      const MAX_ACTIVE_TASKS = 20;

      if ((memoryStatus?.messageCount || 0) > MAX_MEMORY_MESSAGES) {
        throw new Error('Memory message limit exceeded');
      }

      if (activeTasks > MAX_ACTIVE_TASKS) {
        throw new Error('Active tasks limit exceeded');
      }

      return true;
    } catch (error) {
      console.error('Error checking resource limits:', error);
      return false;
    }
  }

  /**
   * Execute a function with circuit breaker pattern
   */
  private async executeWithCircuitBreaker<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    let retries = 0;
    let lastError: Error | null = null;

    while (retries < maxRetries) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retries++;
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
      }
    }

    throw lastError || new Error('Circuit breaker: max retries exceeded');
  }
}