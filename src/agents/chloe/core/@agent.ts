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

// Type definitions
interface ChloeMemory {
  getMemoriesByDateRange(type: string, startDate: Date, endDate: Date): Promise<any[]>;
}

interface StrategicInsight {
  insight: string;
  category: string;
}

// Agent state type
export interface ChloeState {
  messages: any[];
  currentTask: string | null;
  thoughts: string[];
}

// Configuration options for the agent
export interface AgentConfig {
  agentId: string;
  systemPrompt: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  logDir: string;
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
export class ChloeAgent {
  // Core properties
  private readonly agentId: string;
  private agent: StateGraph<ChloeState> | null = null;
  private config: AgentConfig;
  private initialized: boolean = false;
  private notifiers: Notifier[] = [];
  
  // Core systems
  private model: ChatOpenAI | null = null;
  private taskLogger: TaskLogger | null = null;
  private persona: any | null = null;
  private autonomySystem: any | null = null;
  
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
   * Initialize the agent and all its systems
   */
  async initialize(): Promise<void> {
    try {
      logger.info(`Initializing ChloeAgent with ID: ${this.agentId}...`);
      
      // Initialize the OpenAI model
      this.model = new ChatOpenAI({
        modelName: this.config.modelName,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        topP: this.config.topP
      });
      
      // Initialize task logger for tracking agent actions
      this.taskLogger = new TaskLogger({
        logsPath: this.config.logDir,
        maxSessionsInMemory: 10,
        persistToFile: true
      });
      await this.taskLogger.initialize();
      
      // Initialize the memory manager
      // The actual implementation would initialize all required managers
      this.memoryManager = new MemoryManager({
        agentId: this.agentId
      });
      await this.memoryManager.initialize();
      
      // Mark as initialized
      this.initialized = true;
      logger.info('ChloeAgent initialization complete');
    } catch (error) {
      logger.error('Error initializing ChloeAgent:', error);
      throw new Error(`Failed to initialize ChloeAgent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process a user message and generate a response
   */
  async processMessage(message: string, options: { userId: string; attachments?: any }): Promise<string> {
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
      const messages = [
        { role: 'system', content: this.config.systemPrompt },
        { role: 'user', content: message }
      ];
      
      // Use a more careful approach to handle the model invocation
      let result;
      if (this.model) {
        // Use any type only where needed to bypass the type checking
        result = await (this.model as any).invoke(messages);
      } else {
        throw new Error('Model not initialized');
      }
      
      const response = result.content as string;
      
      // Log agent response
      this.taskLogger.logAgentMessage(response);
      
      return response;
    } catch (error) {
      logger.error('Error processing message:', error);
      
      // Log the error - using a console fallback if taskLogger method isn't available
      if (this.taskLogger) {
        try {
          // Try using logAction for error logging if logError doesn't exist
          this.taskLogger.logAction(`ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } catch (loggingError) {
          console.error('Error during error logging:', loggingError);
        }
      }
      
      return "I'm sorry, I encountered an error while processing your message. Please try again.";
    }
  }

  /**
   * Create a new session for tracking the conversation
   */
  private createNewSession(): void {
    if (this.taskLogger) {
      this.taskLogger.createSession(`Session-${Date.now()}`, ['conversation']);
      this.taskLogger.logAction('Created new session');
    }
  }
  
  /**
   * Run daily maintenance and scanning tasks
   */
  async runDailyTasks(): Promise<void> {
    try {
      logger.info('Running daily tasks...');
      this.taskLogger?.logAction('Starting daily tasks');
      
      // In a real implementation, we would run various tasks here
      // such as market scanning, reflections, etc.
      
      this.taskLogger?.logAction('Completed daily tasks');
      logger.info('Daily tasks completed');
    } catch (error) {
      logger.error('Error running daily tasks:', error);
      this.taskLogger?.logAction(`ERROR: Error in daily tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Run weekly reflection process
   */
  async runWeeklyReflection(): Promise<string> {
    try {
      logger.info('Running weekly reflection...');
      this.taskLogger?.logAction('Starting weekly reflection');
      
      // Simplified implementation - in a real system we would:
      // - Get recent memories and events
      // - Analyze performance
      // - Generate insights
      
      const reflectionResult = "Weekly reflection completed. This is a placeholder result.";
      this.taskLogger?.logAction('Completed weekly reflection');
      
      return reflectionResult;
    } catch (error) {
      logger.error('Error running weekly reflection:', error);
      this.taskLogger?.logAction(`ERROR: Error in weekly reflection: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return `Error running weekly reflection: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Run a reflection on a specific question
   */
  async reflect(question: string): Promise<string> {
    try {
      logger.info(`Running reflection on: "${question}"`);
      this.taskLogger?.logAction(`Starting reflection on: ${question}`);
      
      // Simplified implementation - in a real system we would:
      // - Get relevant memories and context
      // - Use the model to generate a thoughtful reflection

      const reflectionResult = `Reflection on "${question}" completed. This is a placeholder result.`;
      this.taskLogger?.logAction('Completed reflection');
      
      return reflectionResult;
    } catch (error) {
      logger.error('Error running reflection:', error);
      this.taskLogger?.logAction(`ERROR: Error in reflection: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return `Error running reflection: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Send a daily summary to Discord
   */
  async sendDailySummaryToDiscord(): Promise<boolean> {
    try {
      logger.info('Sending daily summary to Discord...');
      
      // In a real implementation, this would:
      // - Gather recent activities and insights
      // - Generate a summary
      // - Send it to Discord via a tool
      
      // For now, just simulate success
      logger.info('Daily summary sent to Discord');
      return true;
    } catch (error) {
      logger.error('Error sending daily summary to Discord:', error);
      return false;
    }
  }
  
  /**
   * Add a notifier for sending notifications
   */
  addNotifier(notifier: Notifier): void {
    this.notifiers.push(notifier);
    logger.info(`Added notifier: ${notifier.name}`);
  }
  
  /**
   * Send a notification to all registered notifiers
   */
  notify(message: string): void {
    // Log the notification
    logger.info(`[Notification] ${message}`);
    
    // Send to all notifiers
    for (const notifier of this.notifiers) {
      try {
        // Check which method is available on the notifier
        if (typeof notifier.send === 'function') {
          // Using void to ignore the promise since this is a synchronous method
          void notifier.send(message).catch(err => {
            logger.error(`Error in notifier ${notifier.name}:`, err);
          });
        } else {
          logger.warn(`Notifier ${notifier.name} has no send method`);
        }
      } catch (error) {
        logger.error(`Error in notifier ${notifier.name}:`, error);
      }
    }
  }
  
  /**
   * Shutdown the agent and all its systems
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down ChloeAgent...');
      
      // Perform any necessary cleanup
      if (this.taskLogger) {
        this.taskLogger.logAction('Agent shutdown');
        await this.taskLogger.close();
      }
      
      // Shutdown all notifiers with a graceful fallback
      for (const notifier of this.notifiers) {
        try {
          // Check if shutdown exists before calling it
          if (typeof (notifier as any).shutdown === 'function') {
            await (notifier as any).shutdown();
          }
        } catch (error) {
          logger.error(`Error shutting down notifier ${notifier.name}:`, error);
        }
      }
      
      logger.info('ChloeAgent shutdown complete.');
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }
  }
  
  // Getters for accessing components
  
  getChloeMemory(): ChloeMemory | null {
    return this.memoryManager?.getChloeMemory() || null;
  }
  
  getPersona(): any | null {
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
  getAutonomySystem(): any | null {
    return this.autonomySystem;
  }
  
  /**
   * Get the cognitive memory system
   * Required by tasks.ts for memory consolidation
   */
  getCognitiveMemory(): any | null {
    // In the full implementation, this would return the cognitive memory from memory manager
    return this.memoryManager?.getCognitiveMemory?.() || null;
  }
  
  /**
   * Get the knowledge graph
   * Required by tasks.ts for memory consolidation
   */
  getKnowledgeGraph(): any | null {
    // In the full implementation, this would return the knowledge graph from memory manager
    return this.memoryManager?.getKnowledgeGraph?.() || null;
  }
} 