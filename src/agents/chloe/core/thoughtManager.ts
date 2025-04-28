import { ChatOpenAI } from '@langchain/openai';
import { ChloeMemory } from '../memory';
import { TaskLogger } from '../task-logger';

export interface ThoughtManagerOptions {
  agentId: string;
  memory: ChloeMemory;
  model: ChatOpenAI;
  taskLogger: TaskLogger;
}

/**
 * Manages thought capture and reasoning trails for the Chloe agent
 */
export class ThoughtManager {
  private agentId: string;
  private memory: ChloeMemory;
  private model: ChatOpenAI;
  private taskLogger: TaskLogger;
  private initialized: boolean = false;

  constructor(options: ThoughtManagerOptions) {
    this.agentId = options.agentId;
    this.memory = options.memory;
    this.model = options.model;
    this.taskLogger = options.taskLogger;
  }

  /**
   * Initialize the thought system
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing thought system...');
      this.initialized = true;
      console.log('Thought system initialized successfully');
    } catch (error) {
      console.error('Error initializing thought system:', error);
      throw error;
    }
  }

  /**
   * Capture an agent thought and add it to memory
   */
  async captureThought(thought: string, category: string = 'general', importance: 'low' | 'medium' | 'high' = 'medium'): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Log the thought
      this.taskLogger.logAction('Captured thought', { 
        thought: thought.substring(0, 100) + (thought.length > 100 ? '...' : ''),
        category,
        importance
      });
      
      // Add to memory
      await this.memory.addMemory(
        thought,
        category,
        importance,
        'chloe'
      );
    } catch (error) {
      console.error('Error capturing thought:', error);
    }
  }

  /**
   * Generate a reasoning trail for a complex decision
   */
  async generateReasoningTrail(question: string, context: string = ''): Promise<string> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Log the reasoning request
      this.taskLogger.logAction('Generating reasoning trail', { question });
      
      // Get relevant context from memory if none provided
      let fullContext = context;
      if (!context) {
        const memoryContext = await this.memory.getRelevantMemories(question, 5);
        fullContext = memoryContext.join('\n');
      }
      
      // Create a prompt for structured reasoning
      const prompt = `As Chloe, the Chief Marketing Officer AI, I need to think through this question step by step:
      
Question: ${question}

Context:
${fullContext}

Let me work through this reasoning carefully:

1. First, let me clarify the key issues and parameters of this question.
2. I'll identify the relevant marketing principles and frameworks that apply here.
3. I'll analyze the available data and context.
4. I'll consider multiple perspectives and possible approaches.
5. I'll evaluate the pros and cons of each approach.
6. Finally, I'll draw a reasoned conclusion.

My detailed reasoning:`;
      
      // Generate the reasoning trail
      const response = await this.model.invoke(prompt);
      const reasoning = response.content.toString();
      
      // Store the reasoning in memory
      await this.memory.addMemory(
        `Reasoning trail for "${question}": ${reasoning.substring(0, 200)}...`,
        'reasoning',
        'medium',
        'chloe'
      );
      
      return reasoning;
    } catch (error) {
      console.error('Error generating reasoning trail:', error);
      return `Error generating reasoning: ${error}`;
    }
  }

  /**
   * Analyze reasoning from previous thoughts
   */
  async analyzeReasoning(topic: string): Promise<string> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Get relevant reasoning and thoughts from memory
      const relevantThoughts = await this.memory.getRelevantMemories(`reasoning thoughts ${topic}`, 10);
      
      if (!relevantThoughts || relevantThoughts.length === 0) {
        return "No relevant reasoning found on this topic.";
      }
      
      // Create a prompt for reasoning analysis
      const prompt = `As Chloe, the Chief Marketing Officer AI, I need to analyze my previous reasoning on the topic of "${topic}". 

Here are my relevant thoughts and reasoning processes:

${relevantThoughts.join('\n\n')}

I'll analyze these reasoning patterns to identify:
1. Consistent patterns in my decision-making
2. Potential biases or blind spots
3. Areas where my reasoning was particularly strong
4. Areas where my reasoning could be improved
5. Key insights about my approach to this topic

My analysis:`;
      
      // Generate the analysis
      const response = await this.model.invoke(prompt);
      const analysis = response.content.toString();
      
      // Store the analysis in memory
      await this.captureThought(
        `Analysis of reasoning on "${topic}": ${analysis}`,
        'meta_reasoning',
        'high'
      );
      
      return analysis;
    } catch (error) {
      console.error('Error analyzing reasoning:', error);
      return `Error analyzing reasoning: ${error}`;
    }
  }

  /**
   * Log a thought with a specific format for easier retrieval
   */
  logThought(message: string): void {
    try {
      if (!this.initialized) {
        this.initialize().catch(console.error);
      }
      
      // Add timestamp
      const timestamp = new Date().toISOString();
      const formattedThought = `[${timestamp}] ${message}`;
      
      // Log to the task logger
      this.taskLogger.logAction('Thought', { thought: message });
      
      // Asynchronously add to memory without waiting
      this.memory.addMemory(
        formattedThought,
        'thought',
        'low',
        'chloe'
      ).catch(error => {
        console.error('Error adding thought to memory:', error);
      });
      
      console.log(`Chloe thought: ${message}`);
    } catch (error) {
      console.error('Error logging thought:', error);
    }
  }

  /**
   * Check if the thought system is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
} 