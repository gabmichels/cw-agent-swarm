// @ts-ignore langgraph typings need to be fixed
import { StateGraph } from '@langchain/langgraph';
// @ts-ignore langgraph typings need to be fixed
import { END } from '@langchain/langgraph/schema';
// @ts-ignore missing type declarations
import { RunnableSequence } from '@langchain/core/runnables';
// @ts-ignore missing type declarations
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { createBaseAgent, getLLM } from '@crowd-wisdom/core';
import { AgentMemory } from '@crowd-wisdom/memory';
import { SYSTEM_PROMPTS, AgentConfig, Message, Task } from '@crowd-wisdom/shared';
import { chloeTools } from './tools';
import { Notifier } from './notifiers';

interface ChloeState {
  messages: Message[];
  memory: string[];
  tasks: Task[];
  currentTask?: Task;
  reflections: string[];
  response?: string;
  error?: string;
}

export class ChloeAgent {
  private agent: any; // StateGraph compiled agent
  private memory: AgentMemory;
  private config: AgentConfig;
  private notifiers: Notifier[] = [];
  
  constructor(config?: Partial<AgentConfig>) {
    // Set default configuration
    this.config = {
      name: 'Chloe',
      description: 'An autonomous agent assistant',
      systemPrompt: SYSTEM_PROMPTS.CHLOE,
      capabilities: ['memory', 'web_search', 'task_management', 'reflection'],
      model: 'openrouter/anthropic/claude-3-opus:2024-05-01',
      temperature: 0.7,
      maxTokens: 4000,
      verbose: false, // Setting a default value for verbose
      ...config,
    };
    
    // Initialize memory
    this.memory = new AgentMemory({
      collectionName: 'chloe_memory',
    });
  }
  
  // Initialize the agent
  async initialize(): Promise<boolean> {
    try {
      // Initialize memory
      await this.memory.initialize();
      
      // Initialize the core agent with LangGraph
      // @ts-ignore StateGraph initialization needs fixing
      const workflow = new StateGraph<ChloeState>({
        channels: {
          messages: {
            value: [],
          },
          memory: {
            value: [],
          },
          tasks: {
            value: [],
          },
          currentTask: {
            value: undefined,
          },
          reflections: {
            value: [],
          },
          response: {
            value: undefined,
          },
          error: {
            value: undefined,
          },
        },
      });
      
      // Create tools
      const tools = chloeTools(this);
      
      // Add nodes to workflow
      // @ts-ignore fixing type mismatch
      workflow.addNode('agent_executor', async (state: ChloeState) => {
        try {
          // Simplified agent executor that processes the current state
          // This would be more complex in a real implementation
          const systemPrompt = ChatPromptTemplate.fromTemplate(this.config.systemPrompt);
          const llm = getLLM({
            modelName: this.config.model,
            temperature: this.config.temperature,
            maxTokens: this.config.maxTokens
          });
          
          const executor = RunnableSequence.from([
            systemPrompt,
            llm
          ]);
          
          // Process the input with the LLM
          const result = await executor.invoke({
            input: state.messages[state.messages.length - 1]?.content || '',
            chat_history: state.messages.slice(0, -1) || []
          });
          
          return {
            ...state,
            response: result.content || "I'm Chloe, and I'm ready to assist!",
          };
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            ...state,
            error: errorMessage,
          };
        }
      });
      
      // Add edges
      // @ts-ignore edge connection needs fixing
      workflow.addEdge('agent_executor', END);
      
      // Compile the workflow
      // @ts-ignore compile method needs fixing
      this.agent = workflow.compile();
      
      // Add initial memory entries
      await this.memory.addMemory(
        'I am Chloe, an autonomous agent assistant. I was initialized on ' + 
        new Date().toISOString()
      );
      
      return true;
    } catch (error: unknown) {
      console.error('Error initializing Chloe agent:', error);
      return false;
    }
  }
  
  // Process a user message
  async processMessage(message: string): Promise<string> {
    try {
      // Get relevant memories for context
      const context = await this.memory.getContext(message);
      
      // Prepare state with just the current message
      const initialState: ChloeState = {
        messages: [{ role: 'user', content: message }],
        memory: context ? [context] : [],
        tasks: [],
        reflections: [],
      };
      
      // Run the agent
      const result = await this.agent.invoke(initialState);
      
      // Store the interaction in memory
      if (result.response) {
        await this.memory.addMemory(
          `User said: ${message}\nI responded: ${result.response}`,
          { type: 'conversation' }
        );
      }
      
      return result.response || 'I encountered an issue processing your request.';
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error processing message:', errorMessage);
      return 'I encountered an error and was unable to process your message.';
    }
  }
  
  // Run daily tasks
  async runDailyTasks(): Promise<void> {
    try {
      // Implement daily tasks here
      console.log('Running daily tasks...');
      
      // Example: Daily reflection
      await this.reflect('What have I learned today?');
      
      // Notify about completion
      this.notify('Daily tasks completed successfully.');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error running daily tasks:', errorMessage);
      this.notify('Error running daily tasks: ' + errorMessage);
    }
  }
  
  // Run initial setup tasks
  async runInitialTasks(): Promise<void> {
    try {
      console.log('Running initial tasks...');
      
      // Example: Self-introduction
      await this.memory.addMemory(
        'I have been initialized and am ready to assist.',
        { type: 'system' }
      );
      
      this.notify('Chloe agent is now online and ready.');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error running initial tasks:', errorMessage);
    }
  }
  
  // Perform reflection
  async reflect(question: string): Promise<string> {
    try {
      // This would use a reflection chain in a real implementation
      const reflection = `Reflection on "${question}": I need to implement this functionality.`;
      
      // Store reflection in memory
      await this.memory.addMemory(reflection, { type: 'reflection' });
      
      return reflection;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error during reflection:', errorMessage);
      return 'Failed to complete reflection.';
    }
  }
  
  // Add a notifier
  addNotifier(notifier: Notifier): void {
    this.notifiers.push(notifier);
  }
  
  // Send notification through all notifiers
  notify(message: string): void {
    for (const notifier of this.notifiers) {
      notifier.send(message).catch(err => {
        console.error(`Notification error (${notifier.name}):`, err);
      });
    }
  }
  
  // Graceful shutdown
  async shutdown(): Promise<void> {
    console.log('Shutting down Chloe agent...');
    
    // Perform any cleanup needed
    await this.memory.addMemory(
      'I am shutting down now. Shutdown initiated at ' + new Date().toISOString(),
      { type: 'system' }
    );
    
    // Notify about shutdown
    this.notify('Chloe agent is shutting down.');
  }
  
  // Memory access methods
  getMemory(): AgentMemory {
    return this.memory;
  }
} 