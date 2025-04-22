// @ts-nocheck
import { StateGraph, END } from '@langchain/langgraph';
import { RunnableSequence } from '@langchain/core/runnables';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { createBaseAgent, getLLM } from '@crowd-wisdom/core';
import { AgentMemory } from '@crowd-wisdom/memory';
import { SYSTEM_PROMPTS, AgentConfig, Message, Task } from '@crowd-wisdom/shared';
import { chloeTools } from './tools';
import { Notifier } from './notifiers';
import { ChatOpenAI } from '@langchain/openai';
import { TaskLogger } from './task-logger';
import { Persona } from './persona';
import { PersonaLoader } from './persona-loader';
import { ChloeMemory } from './memory';
import { MemoryTagger } from './memory-tagger';

interface ChloeState {
  messages: Message[];
  memory: string[];
  tasks: Task[];
  currentTask?: Task;
  reflections: string[];
  response?: string;
  error?: string;
}

/**
 * ChloeAgent class implements a marketing assistant agent using LangGraph
 */
export class ChloeAgent {
  private agent: any; // StateGraph compiled agent
  private memory: AgentMemory | null = null;
  private chloeMemory: ChloeMemory | null = null;
  private memoryTagger: MemoryTagger | null = null;
  private persona: Persona | null = null;
  private config: AgentConfig;
  private notifiers: Notifier[] = [];
  private model: ChatOpenAI | null = null;
  private initialized: boolean = false;
  private taskLogger: TaskLogger | null = null;
  
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
        modelName: process.env.OPENAI_MODEL_NAME || 'gpt-3.5-turbo',
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

      // Initialize base memory system
      this.memory = new AgentMemory({
        agentId: 'chloe',
        collectionName: 'chloe_memory',
      });
      await this.memory.initialize();
      
      // Initialize Chloe-specific memory system
      this.chloeMemory = new ChloeMemory({
        agentId: 'chloe',
        useExternalMemory: true,
        externalMemory: this.memory
      });
      await this.chloeMemory.initialize();
      
      // Initialize memory tagger
      this.memoryTagger = new MemoryTagger({
        agentMemory: this.memory,
        importanceThreshold: 0.7
      });
      
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

      this.initialized = true;
      console.log('ChloeAgent initialized successfully');
    } catch (error) {
      console.error('Error initializing ChloeAgent:', error);
      throw error;
    }
  }
  
  // Add a custom method to log thought that will be captured by the proxy
  private logThought(message: string): void {
    // Use the specific pattern that captureThoughts is looking for
    console.log(`Chloe thinking: ${message}`);
  }

  // Process a user message
  async processMessage(message: string): Promise<string> {
    console.log('!!!!!!!!!!!!!! UNMISTAKABLE MARKER - THIS IS THE EDITED AGENT FILE !!!!!!!!!!!!!!');
    console.log('!!!!!!!!!!!!!! MESSAGE WAS: ' + message + ' !!!!!!!!!!!!!!');
    
    if (!this.initialized) {
      throw new Error('Agent not initialized');
    }

    console.log('ChloeAgent.processMessage called with message:', message);

    try {
      // Log user message
      if (this.taskLogger) {
        this.taskLogger.logUserMessage(message, {
          timestamp: new Date().toISOString()
        });
      }

      // Tag memory if available
      if (this.memoryTagger && this.chloeMemory) {
        try {
          const tag = await this.memoryTagger.tagMemory(message);
          
          // Log memory tagging
          if (this.taskLogger) {
            this.taskLogger.logAction(`Tagged memory with importance: ${tag.importance}`, {
              tag,
              timestamp: new Date().toISOString()
            });
          }
          
          // Add to memory if important enough
          if (['medium', 'high'].includes(tag.importance)) {
            await this.chloeMemory.addMemory(message, tag);
            
            // Log memory addition
            if (this.taskLogger) {
              this.taskLogger.logAction(`Added to memory with importance: ${tag.importance}`, {
                memory: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
                importance: tag.importance,
                timestamp: new Date().toISOString()
              });
            }
          }
        } catch (error) {
          console.error('Error tagging memory:', error);
          
          // Log tagging error
          if (this.taskLogger) {
            this.taskLogger.logAction(`Memory tagging error: ${error instanceof Error ? error.message : String(error)}`, {
              error: true,
              timestamp: new Date().toISOString()
            });
          }
        }
      }

      // Get relevant memories
      let memories: string[] = [];
      if (this.chloeMemory) {
        try {
          memories = await this.chloeMemory.getRelevantMemories(message, 5);
          
          // Log memory retrieval
          if (this.taskLogger && memories.length > 0) {
            this.taskLogger.logMemoryRetrieval(`Retrieved ${memories.length} relevant memories`, {
              count: memories.length,
              samples: memories.slice(0, 2).map(m => m.substring(0, 50) + '...'),
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('Error retrieving memories:', error);
          
          // Log memory retrieval error
          if (this.taskLogger) {
            this.taskLogger.logAction(`Memory retrieval error: ${error instanceof Error ? error.message : String(error)}`, {
              error: true,
              timestamp: new Date().toISOString()
            });
          }
        }
      }

      // Get system prompt
      const systemPrompt = this.persona ? await this.persona.getSystemPrompt() : 'You are a helpful assistant.';

      // Truncate system prompt for logging
      const truncatedPrompt = systemPrompt.length > 300 
        ? systemPrompt.substring(0, 300) + '...' 
        : systemPrompt;
      
      console.log(`System prompt (truncated): ${truncatedPrompt}`);
      
      // Log the system prompt
      if (this.taskLogger) {
        this.taskLogger.logAction(`Using system prompt`, {
          promptPreview: truncatedPrompt,
          timestamp: new Date().toISOString()
        });
      }

      // Prepare messages for LLM
      const messages: Message[] = [
        {
          role: 'system',
          content: systemPrompt
        }
      ];

      // Always include core persona components
      if (this.persona) {
        try {
          console.log('Retrieving persona components for LLM context');
          // Get essential persona components
          const background = this.persona.getComponent('background');
          const goals = this.persona.getComponent('goals');
          const personality = this.persona.getComponent('personality');
          const manifesto = this.persona.getComponent('manifesto');

          console.log('Persona components retrieved:', {
            hasBackground: !!background,
            hasGoals: !!goals,
            hasPersonality: !!personality,
            hasManifesto: !!manifesto
          });

          // Create structured persona context
          let personaContext = "## CORE AGENT CONTEXT - ALWAYS CONSIDER THIS INFORMATION\n\n";
          
          if (background) {
            personaContext += "### Background\n" + background + "\n\n";
          }
          
          if (goals) {
            personaContext += "### Goals\n" + goals + "\n\n";
          }
          
          if (personality) {
            personaContext += "### Personality\n" + personality + "\n\n";
          }
          
          if (manifesto) {
            personaContext += "### Principles\n" + manifesto + "\n\n";
          }
          
          personaContext += "ALWAYS maintain consistency with the above context in all responses.";
          
          console.log('Created persona context (truncated):', personaContext.substring(0, 200) + '...');
          
          // Add persona context as a system message
          messages.push({
            role: 'system',
            content: personaContext
          });
          
          // Log the inclusion of persona context
          if (this.taskLogger) {
            this.taskLogger.logAction(`Including persona context in message`, {
              componentsIncluded: [
                background ? 'background' : null,
                goals ? 'goals' : null,
                personality ? 'personality' : null,
                manifesto ? 'manifesto' : null
              ].filter(Boolean),
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('Error including persona components:', error);
          
          if (this.taskLogger) {
            this.taskLogger.logAction(`Error including persona components: ${error instanceof Error ? error.message : String(error)}`, {
              error: true,
              timestamp: new Date().toISOString()
            });
          }
        }
      }

      // Add memory context if available
      if (memories.length > 0) {
        console.log(`Adding ${memories.length} relevant memories to messages`);
        const memoryText = "### Relevant Previous Interactions\n" + 
                          memories.join("\n\n");
        
        messages.push({
          role: 'system',
          content: memoryText
        });
      }
      
      // Add user message
      messages.push({
        role: 'user',
        content: message
      });

      // Show messages being sent to LLM (truncated for readability)
      const messagesToLog = messages.map(m => ({
        role: m.role,
        content: m.content.length > 100 ? m.content.substring(0, 100) + '...' : m.content
      }));
      
      console.log('FINAL MESSAGE ARRAY STRUCTURE:');
      console.log(`Total messages: ${messages.length}`);
      messages.forEach((msg, idx) => {
        console.log(`Message[${idx}] - Role: ${msg.role}, Content length: ${msg.content.length} chars`);
      });
      
      // Use our custom method to log thoughts that will be captured
      this.logThought(`Preparing request to the LLM with ${messages.length} components:`);

      // Log first few messages with our custom method
      for (let i = 0; i < Math.min(messages.length, 3); i++) {
        const msg = messages[i];
        const truncContent = msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content;
        this.logThought(`Message[${i}] - Role: ${msg.role}, Content: ${truncContent}`);
      }
      
      if (messages.length > 3) {
        this.logThought(`... and ${messages.length - 3} more message components`);
      }
      
      this.logThought(`Request components prepared, sending to LLM now`);
      
      // Log the messages being sent
      if (this.taskLogger) {
        this.taskLogger.logAction(`Sending message to LLM`, {
          messageCount: messages.length,
          preview: messagesToLog,
          timestamp: new Date().toISOString()
        });
      }

      // Generate response
      console.log('DIRECT DEBUG - FINAL MESSAGES', JSON.stringify(messages, null, 2));
      console.log('DIRECT DEBUG - TOTAL TOKEN COUNT (estimate):', JSON.stringify(messages).length / 4);
      const response = await this.model!.invoke(messages);
      const agentResponse = response.content;
      
      console.log('Received response from LLM:', 
                  agentResponse.length > 100 
                  ? agentResponse.substring(0, 100) + '...' 
                  : agentResponse);
      
      // Store in memory if available
      if (this.memoryTagger && this.chloeMemory) {
        try {
          const tag = await this.memoryTagger.tagMemory(agentResponse);
          
          // Only store in memory if important enough
          if (['medium', 'high'].includes(tag.importance)) {
            await this.chloeMemory.addMemory(`Chloe: ${agentResponse}`, tag);
            
            // Log memory addition
            if (this.taskLogger) {
              this.taskLogger.logAction(`Added response to memory with importance: ${tag.importance}`, {
                importance: tag.importance,
                timestamp: new Date().toISOString()
              });
            }
          }
        } catch (error) {
          console.error('Error storing agent response in memory:', error);
          
          // Log memory storage error
          if (this.taskLogger) {
            this.taskLogger.logAction(`Memory storage error: ${error instanceof Error ? error.message : String(error)}`, {
              error: true,
              timestamp: new Date().toISOString()
            });
          }
        }
      }

      // Log agent response
      if (this.taskLogger) {
        this.taskLogger.logAgentMessage(agentResponse, {
          timestamp: new Date().toISOString()
        });
      }
      
      console.log('Agent response:', agentResponse);
      
      return agentResponse;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error processing message:', errorMessage);
      
      // Log processing error
      if (this.taskLogger) {
        this.taskLogger.logAction(`Error processing message: ${errorMessage}`, {
          error: true,
          timestamp: new Date().toISOString()
        });
      }
      
      return `I'm sorry, I encountered an error while processing your message. (${errorMessage})`;
    }
  }
  
  // Run daily tasks
  async runDailyTasks(): Promise<void> {
    try {
      // Log start of daily tasks
      if (this.taskLogger) {
        this.taskLogger.createSession('Daily Tasks', ['scheduled', 'maintenance']);
        this.taskLogger.logAction('Starting daily tasks', {
          timestamp: new Date().toISOString()
        });
      }
      
      // Get high importance memories first
      if (this.chloeMemory) {
        const highImportanceMemories = this.chloeMemory.getHighImportanceMemories();
        
        if (highImportanceMemories.length > 0) {
          // Log retrieving high importance memories
          if (this.taskLogger) {
            this.taskLogger.logAction(`Retrieved ${highImportanceMemories.length} high importance memories`, {
              count: highImportanceMemories.length,
              timestamp: new Date().toISOString()
            });
          }
          
          // Process high importance memories
          // In a real implementation, you'd do something with these memories
          console.log(`Found ${highImportanceMemories.length} high importance memories to review`);
        }
      }
      
      // Implement daily tasks here
      console.log('Running daily tasks...');
      
      // Example: Daily reflection
      await this.reflect('What have I learned today?');
      
      // Notify about completion
      this.notify('Daily tasks completed successfully.');
      
      // Log completion
      if (this.taskLogger) {
        this.taskLogger.logAction('Daily tasks completed', {
          success: true,
          timestamp: new Date().toISOString()
        });
        this.taskLogger.endSession();
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error running daily tasks:', errorMessage);
      
      // Log the error
      if (this.taskLogger) {
        this.taskLogger.logAction(`Error in daily tasks: ${errorMessage}`, {
          error: true,
          timestamp: new Date().toISOString()
        });
        this.taskLogger.endSession();
      }
      
      this.notify('Error running daily tasks: ' + errorMessage);
    }
  }
  
  // Run initial setup tasks
  async runInitialTasks(): Promise<void> {
    try {
      // Log start of initial tasks
      if (this.taskLogger) {
        this.taskLogger.createSession('Initial Setup', ['initialization', 'setup']);
        this.taskLogger.logAction('Starting initial tasks', {
          timestamp: new Date().toISOString()
        });
      }
      
      console.log('Running initial tasks...');
      
      // Example: Self-introduction
      const initMemory = 'I have been initialized and am ready to assist.';
      
      // Store in memory systems
      await this.memory.addMemory(initMemory, { type: 'system' });
      
      // Also add to Chloe's memory system with high importance
      if (this.chloeMemory) {
        await this.chloeMemory.addMemory(
          initMemory,
          'system',
          'high',
          'system'
        );
      }
      
      // Log memory creation
      if (this.taskLogger) {
        this.taskLogger.logAction('Created initial memory entry', {
          memoryType: 'system',
          importance: 'high',
          timestamp: new Date().toISOString()
        });
      }
      
      // Store persona information in memory if available
      if (this.persona) {
        const manifesto = this.persona.getComponent('manifesto');
        const background = this.persona.getComponent('background');
        
        if (manifesto && this.chloeMemory) {
          await this.chloeMemory.addMemory(
            manifesto,
            'persona_manifesto',
            'high',
            'system'
          );
          
          // Log storing manifesto
          if (this.taskLogger) {
            this.taskLogger.logAction('Stored persona manifesto in memory', {
              memoryType: 'persona_manifesto',
              importance: 'high',
              timestamp: new Date().toISOString()
            });
          }
        }
        
        if (background && this.chloeMemory) {
          await this.chloeMemory.addMemory(
            background,
            'persona_background',
            'high',
            'system'
          );
          
          // Log storing background
          if (this.taskLogger) {
            this.taskLogger.logAction('Stored persona background in memory', {
              memoryType: 'persona_background',
              importance: 'high',
              timestamp: new Date().toISOString()
            });
          }
        }
      }
      
      this.notify('Chloe agent is now online and ready.');
      
      // Log completion
      if (this.taskLogger) {
        this.taskLogger.logAction('Initial tasks completed', {
          success: true,
          timestamp: new Date().toISOString()
        });
        this.taskLogger.endSession();
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error running initial tasks:', errorMessage);
      
      // Log the error
      if (this.taskLogger) {
        this.taskLogger.logAction(`Error in initial tasks: ${errorMessage}`, {
          error: true,
          timestamp: new Date().toISOString()
        });
        this.taskLogger.endSession();
      }
    }
  }
  
  // Perform reflection
  async reflect(question: string): Promise<string> {
    try {
      // Log reflection start
      if (this.taskLogger) {
        this.taskLogger.logAction(`Starting reflection: ${question}`, {
          reflectionQuestion: question,
          timestamp: new Date().toISOString()
        });
      }
      
      // This would use a reflection chain in a real implementation
      const reflection = `Reflection on "${question}": I need to implement this functionality.`;
      
      // Store reflection in both memory systems
      await this.memory.addMemory(reflection, { type: 'reflection' });
      
      if (this.chloeMemory) {
        await this.chloeMemory.addMemory(
          reflection,
          'reflection',
          'medium', // Default importance for reflections
          'chloe'
        );
      }
      
      // Log the reflection result
      if (this.taskLogger) {
        this.taskLogger.logReflection(reflection, {
          question,
          timestamp: new Date().toISOString()
        });
      }
      
      return reflection;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error during reflection:', errorMessage);
      
      // Log the error
      if (this.taskLogger) {
        this.taskLogger.logAction(`Error during reflection: ${errorMessage}`, {
          reflectionQuestion: question,
          error: true,
          timestamp: new Date().toISOString()
        });
      }
      
      return 'Failed to complete reflection.';
    }
  }
  
  // Add a notifier
  addNotifier(notifier: Notifier): void {
    this.notifiers.push(notifier);
    
    // Log notifier addition
    if (this.taskLogger) {
      this.taskLogger.logAction(`Added notifier: ${notifier.name}`, {
        notifierType: notifier.constructor.name,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // Send notification through all notifiers
  notify(message: string): void {
    // Log notification
    if (this.taskLogger) {
      this.taskLogger.logAction(`Sending notification: ${message}`, {
        notifiersCount: this.notifiers.length,
        timestamp: new Date().toISOString()
      });
    }
    
    for (const notifier of this.notifiers) {
      notifier.send(message).catch(err => {
        console.error(`Notification error (${notifier.name}):`, err);
        
        // Log notification error
        if (this.taskLogger) {
          this.taskLogger.logAction(`Notification error with ${notifier.name}: ${err.message}`, {
            error: true,
            notifierName: notifier.name,
            timestamp: new Date().toISOString()
          });
        }
      });
    }
  }
  
  // Graceful shutdown
  async shutdown(): Promise<void> {
    console.log('Shutting down ChloeAgent...');
    
    // Log shutdown
    if (this.taskLogger) {
      this.taskLogger.logAction('Agent shutting down', {
        timestamp: new Date().toISOString()
      });
      this.taskLogger.endSession();
    }
    
    // Cleanup code would go here
  }
  
  // Memory access methods
  getMemory(): AgentMemory {
    if (!this.memory) {
      throw new Error('Memory system not initialized');
    }
    return this.memory;
  }
  
  // Get Chloe-specific memory system
  getChloeMemory(): ChloeMemory {
    if (!this.chloeMemory) {
      throw new Error('Chloe memory system not initialized');
    }
    return this.chloeMemory;
  }
  
  // Get persona
  getPersona(): Persona {
    if (!this.persona) {
      throw new Error('Persona system not initialized');
    }
    return this.persona;
  }
  
  // Task logger access method
  getTaskLogger(): TaskLogger {
    if (!this.taskLogger) {
      throw new Error('Task logger not initialized');
    }
    return this.taskLogger;
  }
  
  /**
   * Generate a summary of the current conversation
   */
  async summarizeConversation(options?: { maxEntries?: number, maxLength?: number }): Promise<string> {
    if (!this.taskLogger) {
      throw new Error('Task logger not initialized');
    }
    
    try {
      // Use the task logger to generate the summary
      const summary = await this.taskLogger.summarizeConversation(
        undefined, // Use current session
        options
      );
      
      // Log that we generated a summary
      this.taskLogger.logAction('Generated conversation summary via agent', {
        length: summary.length,
        timestamp: new Date().toISOString()
      });
      
      return summary;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error generating conversation summary:', errorMessage);
      
      // Log the error
      if (this.taskLogger) {
        this.taskLogger.logAction(`Error in agent summarizeConversation: ${errorMessage}`, {
          error: true,
          timestamp: new Date().toISOString()
        });
      }
      
      return 'Failed to generate conversation summary.';
    }
  }
} 