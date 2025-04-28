import { ChatOpenAI } from '@langchain/openai';
import { StateGraph } from '@langchain/langgraph';
import { TaskLogger } from '../task-logger';
import { Notifier } from '../notifiers';
import { MemoryManager } from './memoryManager';
import { ToolManager } from './toolManager';
import { PlanningManager } from './planningManager';
import { ReflectionManager } from './reflectionManager';
import { ThoughtManager } from './thoughtManager';
import { MarketScannerManager } from './marketScannerManager';
import { KnowledgeGapsManager } from './knowledgeGapsManager';
import { logger } from '../../../lib/logging';
import { 
  IAgent, 
  MessageOptions, 
  AutonomySystem,
  MemoryManagerOptions, 
  ToolManagerOptions,
  PlanningManagerOptions,
  ReflectionManagerOptions,
  ThoughtManagerOptions,
  MarketScannerManagerOptions,
  KnowledgeGapsManagerOptions,
  ChloeState,
  PlanAndExecuteOptions,
  PlanAndExecuteResult,
  TaggedMemory
} from '../../../lib/shared/types/agentTypes';
import { AgentConfig } from '../../../lib/shared/types/agent';
import { Persona } from '../persona';
import { ChloeMemory } from '../memory';
import { CognitiveMemory as ICognitiveMemory } from '../memory/cognitive';
import { KnowledgeGraph as IKnowledgeGraph } from '../knowledge/graph';

// Fix the global model declaration
declare global {
  namespace NodeJS {
    interface Global {
      model: ChatOpenAI | undefined;
    }
  }
}

// Type definitions
interface StrategicInsight {
  insight: string;
  category: string;
}

// Agent state type
export interface ChloeAgentState {
  messages: Array<{
    role: string;
    content: string;
    metadata?: Record<string, unknown>;
  }>;
  currentTask: string | null;
  thoughts: string[];
}

// Options for initializing the agent
export interface ChloeAgentOptions {
  config?: Partial<AgentConfig>;
  useOpenAI?: boolean;
}

/**
 * ChloeAgent - A modern marketing assistant agent
 * 
 * This implementation follows best practices:
 * - Strong typing for all properties and methods
 * - Proper error handling and logging
 * - Clear initialization patterns
 * - Modular design with manager components
 * - Asynchronous operations with proper Promise handling
 */
export class ChloeAgent implements IAgent {
  // Core properties
  private readonly agentId: string;
  private agent: StateGraph<ChloeState> | null = null;
  private config: AgentConfig;
  private initialized: boolean = false;
  private notifiers: Notifier[] = [];
  
  // Core systems
  private model: ChatOpenAI | null = null;
  private taskLogger: TaskLogger | null = null;
  private persona: Persona | null = null;
  private autonomySystem: AutonomySystem | null = null;
  
  // Manager systems
  private memoryManager: MemoryManager | null = null;
  private toolManager: ToolManager | null = null;
  private planningManager: PlanningManager | null = null;
  private reflectionManager: ReflectionManager | null = null;
  private thoughtManager: ThoughtManager | null = null;
  private marketScannerManager: MarketScannerManager | null = null;
  private knowledgeGapsManager: KnowledgeGapsManager | null = null;

  /**
   * Create a new Chloe Agent instance
   */
  constructor(options?: ChloeAgentOptions) {
    // Set default configuration
    this.config = {
      agentId: 'chloe-agent',
      systemPrompt: "You are Chloe, an AI Chief Marketing Officer. Help your team with marketing strategy, content, and execution.",
      modelName: 'gpt-4-turbo',
      temperature: 0.7,
      maxTokens: 1000,
      topP: 0.95,
      logDir: './logs/chloe'
    };
    
    // Apply custom configuration if provided
    if (options?.config) {
      this.config = { ...this.config, ...options.config };
    }
    
    this.agentId = this.config.agentId;
  }

  /**
   * Initialize the agent and all its components
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('Agent already initialized');
      return;
    }

    try {
      console.log('Initializing ChloeAgent...');
      
      // Initialize OpenAI model
      this.model = new ChatOpenAI({
        modelName: process.env.OPENAI_MODEL_NAME || 'gpt-4-turbo',
        temperature: this.config.temperature || 0.7,
        openAIApiKey: process.env.OPENAI_API_KEY,
      });
      
      // Make model available globally for TaskLogger to use
      global.model = this.model;
      
      // Initialize task logger
      this.taskLogger = new TaskLogger({
        logsPath: this.config.logDir,
        persistToFile: true
      });
      await this.taskLogger.initialize();
      
      // Create a new session
      this.createNewSession();
      
      // Initialize persona system
      this.persona = new Persona();
      await this.persona.initialize();
      
      // Initialize memory manager
      const memoryOptions: MemoryManagerOptions = {
        agentId: this.agentId,
        namespace: `chloe-${this.agentId}`,
        workingMemoryCapacity: 100,
        consolidationInterval: 24 * 60 * 60 * 1000, // 24 hours
        useOpenAI: true
      };
      
      this.memoryManager = new MemoryManager(memoryOptions);
      await this.memoryManager.initialize();
      
      // Get the base memory for initializing other managers
      const chloeMemory = this.memoryManager.getChloeMemory();
      if (!chloeMemory) {
        throw new Error('Failed to initialize ChloeMemory');
      }
      
      // Initialize tool manager
      const toolOptions: ToolManagerOptions = {
        agentId: this.agentId,
        model: this.model,
        memory: chloeMemory,
        logger: this.taskLogger
      };
      
      this.toolManager = new ToolManager(toolOptions);
      await this.toolManager.initialize();
      
      // Initialize planning manager
      const planningOptions: PlanningManagerOptions = {
        agentId: this.agentId,
        memory: chloeMemory,
        model: this.model,
        taskLogger: this.taskLogger,
        notifyFunction: async (message: string) => this.notify(message)
      };
      
      this.planningManager = new PlanningManager(planningOptions);
      await this.planningManager.initialize();
      
      // Initialize reflection manager
      const reflectionOptions: ReflectionManagerOptions = {
        agentId: this.agentId,
        memory: chloeMemory,
        model: this.model,
        taskLogger: this.taskLogger,
        notifyFunction: async (message: string) => this.notify(message)
      };
      
      this.reflectionManager = new ReflectionManager(reflectionOptions);
      await this.reflectionManager.initialize();
      
      // Initialize thought manager
      const thoughtOptions: ThoughtManagerOptions = {
        agentId: this.agentId,
        memory: chloeMemory,
        model: this.model,
        taskLogger: this.taskLogger
      };
      
      this.thoughtManager = new ThoughtManager(thoughtOptions);
      await this.thoughtManager.initialize();
      
      // Initialize market scanner manager
      const marketScannerOptions: MarketScannerManagerOptions = {
        agentId: this.agentId,
        memory: chloeMemory,
        model: this.model,
        taskLogger: this.taskLogger,
        notifyFunction: async (message: string) => this.notify(message)
      };
      
      this.marketScannerManager = new MarketScannerManager(marketScannerOptions);
      await this.marketScannerManager.initialize();
      
      // Initialize knowledge gaps manager
      const knowledgeGapsOptions: KnowledgeGapsManagerOptions = {
        agentId: this.agentId,
        memory: chloeMemory,
        openaiApiKey: process.env.OPENAI_API_KEY || '',
        logger: this.taskLogger,
        notifyFunction: async (message: string) => this.notify(message)
      };
      
      this.knowledgeGapsManager = new KnowledgeGapsManager({
        agentId: this.agentId,
        memory: chloeMemory,
        openaiApiKey: process.env.OPENAI_API_KEY || '',
        logger: this.taskLogger,
        notifyFunction: async (message: string) => this.notify(message)
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
   * Process a user message and generate a response
   */
  async processMessage(message: string, options: MessageOptions): Promise<string> {
    try {
      // Ensure the agent is initialized
      if (!this.initialized || !this.model || !this.taskLogger) {
        throw new Error('Agent not properly initialized');
      }
      
      // Create a session for this conversation if needed
      if (!this.taskLogger.getCurrentSession()) {
        this.createNewSession();
      }
      
      // Log user message - fix the parameter order based on the TaskLogger interface
      // The userId was being passed as content, which is incorrect
      this.taskLogger.logUserMessage(message, { userId: options.userId, attachments: options.attachments });
      
      // Process the message with the model
      // In a real implementation, we would:
      // - Check intent for tool handling
      // - Retrieve relevant memories
      // - Generate thoughts
      // - Format a rich context for the model
      
      // Simplified version for this implementation:
      // Create messages for the model in a type-safe way
      const systemMessage = { role: 'system', content: this.config.systemPrompt };
      const userMessage = { role: 'user', content: message };
      
      // Use a more careful approach to handle the model invocation
      let result;
      if (this.model) {
        result = await this.model.invoke(
          `System: ${this.config.systemPrompt}\nUser: ${message}`
        );
      } else {
        throw new Error('Model not initialized');
      }
      
      const response = result.content.toString();
      
      // Log agent response
      this.taskLogger.logAgentMessage(response);
      
      return response;
    } catch (error) {
      console.error('Error processing message:', error);
      return `I'm sorry, I encountered an error while processing your message: ${error}`;
    }
  }

  /**
   * Shutdown the agent and all its components
   */
  async shutdown(): Promise<void> {
    try {
      console.log('Shutting down ChloeAgent...');
      
      // Perform any necessary cleanup with proper error handling
      const shutdownTasks: Promise<void>[] = [];
      
      // Close task logger if it exists
      if (this.taskLogger) {
        shutdownTasks.push(this.taskLogger.close());
      }
      
      // Wait for all shutdown tasks to complete
      await Promise.all(shutdownTasks);
      
      this.initialized = false;
      console.log('ChloeAgent shutdown complete.');
    } catch (error) {
      console.error('Error during shutdown:', error);
      throw error;
    }
  }

  /**
   * Create a new session for logging
   */
  private createNewSession(): void {
    if (this.taskLogger) {
      const sessionInfo = this.taskLogger.createSession(`Chloe Session ${new Date().toISOString()}`, ['chloe', 'agent']);
      console.log(`Created new session with ID: ${typeof sessionInfo === 'string' ? sessionInfo : 'unknown'}`);
    } else {
      console.error('Cannot create session: TaskLogger not initialized');
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
    console.log(`[Notification] ${message}`);
    
    for (const notifier of this.notifiers) {
      try {
        if (typeof notifier.send === 'function') {
          void notifier.send(message);
        }
      } catch (error) {
        console.error(`Error in notifier ${notifier.name}:`, error);
      }
    }
  }

  /**
   * Plan and execute a task
   * @param goal The goal to plan for
   * @param options Additional options for planning
   * @returns The result of executing the plan
   */
  async planAndExecute(goal: string, options?: Partial<PlanAndExecuteOptions>): Promise<PlanAndExecuteResult> {
    try {
      if (!this.initialized) {
        throw new Error('Agent not initialized');
      }
      
      const planningManager = this.planningManager;
      if (!planningManager) {
        throw new Error('Planning manager not available');
      }
      
      // Default options for planning
      const defaultOptions: PlanAndExecuteOptions = {
        goalPrompt: goal,
        autonomyMode: false,
        maxSteps: 10,
        timeLimit: 300 // 5 minutes in seconds
      };
      
      // Merge default options with provided options
      const mergedOptions: PlanAndExecuteOptions = {
        ...defaultOptions,
        ...options
      };
      
      // Try to use the planAndExecuteWithOptions method first
      if (typeof planningManager.planAndExecuteWithOptions === 'function') {
        return await planningManager.planAndExecuteWithOptions(mergedOptions);
      }
      
      // Fall back to planAndExecuteTask if it exists
      if (planningManager.planAndExecuteTask) {
        const result = await planningManager.planAndExecuteTask(mergedOptions.goalPrompt);
        return {
          success: result.success,
          message: result.success ? "Plan executed successfully" : "Plan execution failed",
          plan: {
            goal: mergedOptions.goalPrompt,
            steps: result.stepResults?.map((step, index) => ({
              id: String(index),
              description: step.step,
              status: step.success ? 'completed' : 'failed'
            })) || [],
            reasoning: result.output || "Plan execution complete"
          },
          error: result.success ? undefined : "Failed to execute plan"
        };
      }
      
      // If no methods are available, return a default failed result
      return {
        success: false,
        message: "No planning execution methods available",
        error: "No planning execution methods available"
      };
    } catch (error) {
      console.error('Error in planAndExecute:', error);
      return {
        success: false,
        message: `Error executing plan: ${error}`,
        error: error instanceof Error ? error.message : String(error)
      };
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

  /**
   * Get recent memories
   */
  async getRecentMemories(limit: number = 10): Promise<TaggedMemory[]> {
    if (!this.memoryManager) {
      throw new Error('Memory manager not initialized');
    }
    
    try {
      // Try to call the adapter method if it exists
      if (typeof this.memoryManager.getRecentMemoriesAdapter === 'function') {
        return this.memoryManager.getRecentMemoriesAdapter(limit);
      }
      
      // Otherwise return an empty array
      return [];
    } catch (error) {
      console.error('Error getting recent memories:', error);
      return [];
    }
  }
  
  /**
   * Get the cognitive memory system
   */
  getCognitiveMemory(): ICognitiveMemory | null {
    if (!this.memoryManager) {
      return null;
    }
    
    try {
      // Two-step assertion through unknown
      return this.memoryManager.getCognitiveMemory() as unknown as ICognitiveMemory;
    } catch (error) {
      console.error('Error getting cognitive memory:', error);
      return null;
    }
  }
  
  /**
   * Get the knowledge graph
   */
  getKnowledgeGraph(): IKnowledgeGraph | null {
    if (!this.memoryManager) {
      return null;
    }
    
    try {
      // Two-step assertion through unknown
      return this.memoryManager.getKnowledgeGraph() as unknown as IKnowledgeGraph;
    } catch (error) {
      console.error('Error getting knowledge graph:', error);
      return null;
    }
  }
  
  /**
   * Get the autonomy system
   */
  async getAutonomySystem(): Promise<AutonomySystem | null> {
    // If autonomySystem is not initialized but we have planAndExecute method,
    // create an adapter that implements the AutonomySystem interface
    if (!this.autonomySystem && typeof this.planAndExecute === 'function') {
      // Create a minimal implementation of AutonomySystem that delegates to this.planAndExecute
      return {
        status: 'active',
        scheduledTasks: [],
        // Use our planAndExecute method as an adapter
        planAndExecute: async (options: PlanAndExecuteOptions): Promise<PlanAndExecuteResult> => {
          return this.planAndExecute(options.goalPrompt, options);
        },
        // Stub implementations for other required methods
        runTask: async (taskName: string) => {
          console.log(`Running task: ${taskName}`);
          return true;
        },
        scheduleTask: async (task) => {
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
} 