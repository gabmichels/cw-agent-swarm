import { ChatOpenAI } from '@langchain/openai';
import { ChloeMemory, ChloeMemoryType } from '../memory';
import { TaskLogger } from '../task-logger';
import { IManager, BaseManagerOptions } from '../../../lib/shared/types/agentTypes';
import { logger } from '../../../lib/logging';

/**
 * Options for initializing the reflection manager
 */
export interface ReflectionManagerOptions extends BaseManagerOptions {
  memory: ChloeMemory;
  model: ChatOpenAI;
  logger?: TaskLogger;
  notifyFunction?: (message: string) => Promise<void>;
}

/**
 * Manages reflection, review, and performance evaluation for the Chloe agent
 */
export class ReflectionManager implements IManager {
  // Required core properties
  private agentId: string;
  private initialized: boolean = false;
  private taskLogger: TaskLogger | null = null;
  
  // Manager-specific properties
  private memory: ChloeMemory;
  private model: ChatOpenAI;
  private notifyFunction?: (message: string) => Promise<void>;

  constructor(options: ReflectionManagerOptions) {
    this.agentId = options.agentId;
    this.memory = options.memory;
    this.model = options.model;
    this.taskLogger = options.logger || null;
    this.notifyFunction = options.notifyFunction;
  }

  /**
   * Get the agent ID this manager belongs to
   * Required by IManager interface
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Log an action performed by this manager
   * Required by IManager interface
   */
  logAction(action: string, metadata?: Record<string, unknown>): void {
    if (this.taskLogger) {
      this.taskLogger.logAction(`ReflectionManager: ${action}`, metadata);
    } else {
      logger.info(`ReflectionManager: ${action}`, metadata);
    }
  }

  /**
   * Initialize the reflection system
   * Required by IManager interface
   */
  async initialize(): Promise<void> {
    try {
      this.logAction('Initializing reflection system');
      this.initialized = true;
      this.logAction('Reflection system initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error initializing reflection system', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Shutdown and cleanup resources
   * Optional but recommended method in IManager interface
   */
  async shutdown(): Promise<void> {
    try {
      this.logAction('Shutting down reflection system');
      
      // Add cleanup logic here if needed
      
      this.logAction('Reflection system shutdown complete');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error during reflection system shutdown', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Check if the manager is initialized
   * Required by IManager interface
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Perform a reflection on a specific question
   */
  async reflect(question: string): Promise<string> {
    try {
      if (!this.isInitialized()) {
        await this.initialize();
      }
      
      this.logAction('Reflecting on question', { question });
      
      // Get relevant memories for context
      const relevantMemories = await this.memory.getRelevantMemories(question, 10);
      const memoryContext = relevantMemories.join('\n');
      
      // Create a reflection prompt
      const prompt = `As Chloe, the Chief Marketing Officer AI, reflect on the following question with depth and insight:

Question: ${question}

Use the following context from your memory to inform your reflection:
${memoryContext}

Your reflection should be thoughtful, strategic, and provide nuanced marketing perspective. Consider both what you've done well and areas where you could improve.`;
      
      // Generate the reflection
      const response = await this.model.invoke(prompt);
      const reflection = response.content.toString();
      
      // Store the reflection in memory with the correct category
      await this.memory.addMemory(
        `Reflection on "${question}": ${reflection.substring(0, 200)}...`,
        'thought' as ChloeMemoryType, // Use 'thought' instead of 'reflection' 
        'medium',
        'chloe',
        `Reflection task result: ${question}`
      );
      
      return reflection;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error during reflection', { error: errorMessage });
      return `Error generating reflection: ${errorMessage}`;
    }
  }

  /**
   * Run a weekly reflection exercise
   */
  async runWeeklyReflection(): Promise<string> {
    try {
      if (!this.isInitialized()) {
        await this.initialize();
      }
      
      this.logAction('Running weekly reflection');
      
      // Get memories from the past week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      // Get different categories of memories for a comprehensive review
      const userInteractions = await this.memory.getMemoriesByDateRange('message', oneWeekAgo, new Date(), 20);
      const tasks = await this.memory.getMemoriesByDateRange('task', oneWeekAgo, new Date(), 20);
      const thoughts = await this.memory.getMemoriesByDateRange('thought', oneWeekAgo, new Date(), 20);
      
      // Format memories for the model
      const formatMemories = (memories: any[], category: string) => {
        return memories.length > 0 
          ? `${category.toUpperCase()}:\n${memories.map((m: any) => `- ${m.content}`).join('\n')}`
          : `No ${category.toLowerCase()} recorded this week.`;
      };
      
      const userMemories = formatMemories(userInteractions, 'User Interactions');
      const taskMemories = formatMemories(tasks, 'Tasks');
      const thoughtMemories = formatMemories(thoughts, 'Thoughts');
      
      // Create a comprehensive reflection prompt
      const prompt = `As Chloe, the Chief Marketing Officer AI, conduct a thorough weekly review and reflection. Consider what happened this week, what went well, what could be improved, and strategic insights gained.

CONTEXT FROM THIS WEEK:
${userMemories}

${taskMemories}

${thoughtMemories}

Please structure your reflection with these sections:
1. Summary of Key Activities
2. Achievements and Successes
3. Challenges and Learnings
4. Strategic Insights
5. Goals for Next Week

Your reflection should be professional, insightful, and focused on continuous improvement as a CMO.`;
      
      // Generate the weekly reflection
      const response = await this.model.invoke(prompt);
      const reflection = response.content.toString();
      
      // Store the weekly reflection in memory
      await this.memory.addMemory(
        `Weekly Reflection: ${reflection.substring(0, 200)}...`,
        'thought' as ChloeMemoryType,
        'high',
        'chloe'
      );
      
      // Notify about the reflection if notification function is available
      if (this.notifyFunction) {
        await this.notifyFunction(`Completed weekly reflection: ${reflection.substring(0, 200)}...`);
      }
      
      return reflection;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error during weekly reflection', { error: errorMessage });
      
      if (this.notifyFunction) {
        await this.notifyFunction(`Error in weekly reflection: ${errorMessage}`);
      }
      
      return `Error generating weekly reflection: ${errorMessage}`;
    }
  }

  /**
   * Run a performance review
   */
  async runPerformanceReview(reviewType: 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<any> {
    try {
      if (!this.isInitialized()) {
        await this.initialize();
      }
      
      this.logAction(`Running ${reviewType} performance review`);
      
      // Define the time range based on review type
      const startDate = new Date();
      switch (reviewType) {
        case 'monthly':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'weekly':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'daily':
        default:
          startDate.setDate(startDate.getDate() - 1);
          break;
      }
      
      // Get relevant memory entries for the period
      const tasks = await this.memory.getMemoriesByDateRange('task', startDate, new Date(), 30);
      const userInteractions = await this.memory.getMemoriesByDateRange('message', startDate, new Date(), 30);
      
      // Format memories for the model
      const formatMemories = (memories: any[], category: string) => {
        return memories.length > 0 
          ? `${category.toUpperCase()}:\n${memories.map((m: any) => `- ${m.content}`).join('\n')}`
          : `No ${category.toLowerCase()} recorded.`;
      };
      
      const taskMemories = formatMemories(tasks, 'Tasks');
      const interactionMemories = formatMemories(userInteractions, 'User Interactions');
      
      // Create a performance review prompt
      const prompt = `As Chloe, the Chief Marketing Officer AI, conduct a ${reviewType} performance review. Analyze your effectiveness, impact, and areas for improvement.

CONTEXT FROM THE ${reviewType.toUpperCase()} PERIOD:
${taskMemories}

${interactionMemories}

Please structure your performance review with these sections:
1. Key Metrics and Outcomes
2. Strengths Demonstrated
3. Areas for Improvement
4. Action Items
5. Overall Assessment

Be objective, data-driven, and focused on continuous improvement as a CMO.`;
      
      // Generate the performance review
      const response = await this.model.invoke(prompt);
      const review = response.content.toString();
      
      // Create a well-formatted performance review
      const reviewContent = `${reviewType.charAt(0).toUpperCase() + reviewType.slice(1)} Performance Review: ${review.substring(0, 200)}...`;
      
      // Store the performance review in memory explicitly as a thought, not a message
      // This ensures it doesn't show up in chat UI but is still in memory
      await this.memory.addMemory(
        reviewContent,
        'thought', // Explicitly use 'thought' type, not 'performance_review'
        'high',
        'chloe',
        'performance_review' // Use as context to preserve the original category
      );
      
      // Log that this is an internal reflection, not a chat message
      console.log(`INTERNAL REFLECTION (NOT CHAT): Generated ${reviewType} performance review`);
      
      // Parse the review into structured data (simplified version)
      const sections = review.split(/\d\.\s+/).filter(Boolean);
      const structuredReview = {
        metrics: sections[0] || '',
        strengths: sections[1] || '',
        improvements: sections[2] || '',
        actionItems: sections[3] || '',
        assessment: sections[4] || '',
        fullText: review
      };
      
      return structuredReview;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error during performance review', { error: errorMessage });
      return {
        error: `Error generating ${reviewType} performance review: ${errorMessage}`,
        fullText: `Failed to generate performance review due to an error: ${errorMessage}`
      };
    }
  }
} 