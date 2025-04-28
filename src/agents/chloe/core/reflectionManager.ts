import { ChatOpenAI } from '@langchain/openai';
import { ChloeMemory } from '../memory';
import { TaskLogger } from '../task-logger';

export interface ReflectionManagerOptions {
  agentId: string;
  memory: ChloeMemory;
  model: ChatOpenAI;
  taskLogger: TaskLogger;
  notifyFunction?: (message: string) => void;
}

/**
 * Manages reflection, review, and performance evaluation for the Chloe agent
 */
export class ReflectionManager {
  private agentId: string;
  private memory: ChloeMemory;
  private model: ChatOpenAI;
  private taskLogger: TaskLogger;
  private notifyFunction?: (message: string) => void;
  private initialized: boolean = false;

  constructor(options: ReflectionManagerOptions) {
    this.agentId = options.agentId;
    this.memory = options.memory;
    this.model = options.model;
    this.taskLogger = options.taskLogger;
    this.notifyFunction = options.notifyFunction;
  }

  /**
   * Initialize the reflection system
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing reflection system...');
      this.initialized = true;
      console.log('Reflection system initialized successfully');
    } catch (error) {
      console.error('Error initializing reflection system:', error);
      throw error;
    }
  }

  /**
   * Perform a reflection on a specific question
   */
  async reflect(question: string): Promise<string> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      this.taskLogger.logAction('Reflecting on question', { question });
      
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
      
      // Store the reflection in memory
      await this.memory.addMemory(
        `Reflection on "${question}": ${reflection.substring(0, 200)}...`,
        'reflection',
        'medium',
        'chloe'
      );
      
      return reflection;
    } catch (error) {
      console.error('Error during reflection:', error);
      return `Error generating reflection: ${error}`;
    }
  }

  /**
   * Run a weekly reflection exercise
   */
  async runWeeklyReflection(): Promise<string> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      this.taskLogger.logAction('Running weekly reflection');
      
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
        'weekly_reflection',
        'high',
        'chloe'
      );
      
      // Notify about the reflection if notification function is available
      if (this.notifyFunction) {
        this.notifyFunction(`Completed weekly reflection: ${reflection.substring(0, 200)}...`);
      }
      
      return reflection;
    } catch (error) {
      console.error('Error during weekly reflection:', error);
      
      if (this.notifyFunction) {
        this.notifyFunction(`Error in weekly reflection: ${error}`);
      }
      
      return `Error generating weekly reflection: ${error}`;
    }
  }

  /**
   * Run a performance review
   */
  async runPerformanceReview(reviewType: 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<any> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      this.taskLogger.logAction(`Running ${reviewType} performance review`);
      
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
      
      // Store the performance review in memory
      await this.memory.addMemory(
        `${reviewType.charAt(0).toUpperCase() + reviewType.slice(1)} Performance Review: ${review.substring(0, 200)}...`,
        'performance_review',
        'high',
        'chloe'
      );
      
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
      console.error(`Error during ${reviewType} performance review:`, error);
      return {
        error: `Error generating ${reviewType} performance review: ${error}`,
        fullText: `Failed to generate performance review due to an error: ${error}`
      };
    }
  }

  /**
   * Check if the reflection system is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
} 