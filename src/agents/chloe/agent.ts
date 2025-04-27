// To be declared outside of any imports to avoid conflicts
declare global {
  // eslint-disable-next-line no-var
  var model: any; // Use `any` for compatibility with existing global references
}

import { StateGraph } from '@langchain/langgraph';
import { RunnableSequence } from '@langchain/core/runnables';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { AgentMemory } from '../../lib/memory';
import { SYSTEM_PROMPTS, AgentConfig, Message, Task } from '../../lib/shared';
import { Notifier } from './notifiers';
import { ChatOpenAI } from '@langchain/openai';
import { TaskLogger } from './task-logger';
import { Persona } from './persona';
import { PersonaLoader } from './persona-loader';
import { ChloeMemory } from './memory';
import { MemoryTagger } from './memory-tagger';
import * as serverQdrant from '../../server/qdrant';
import path from 'path';
// Import the planning functionality
import { planTask } from '../../server/agents/planner';
import { executePlan } from '../../server/agents/executor';
import { EnhancedMemory, createEnhancedMemory } from '../../lib/memory/src/enhanced-memory';
// Import createChloeTools directly from the tools/index.ts file
import { createChloeTools } from './tools/index';
import { CognitiveMemory } from '../../lib/memory/src/cognitive-memory';
import { KnowledgeGraph } from '../../lib/memory/src/knowledge-graph';
import { IntentRouterTool } from './tools/intentRouter';
import { FeedbackLoopSystem, createFeedbackLoopSystem } from '../../lib/memory/src/feedback-loop';
import { IntegrationLayer, createIntegrationLayer } from '../../lib/memory/src/integration-layer';
import { SelfImprovementMechanism, createSelfImprovementMechanism } from '../../lib/memory/src/self-improvement';
import { ToolCreationSystem } from './tools/integration';
import { KnowledgeFlaggingService } from '../../lib/knowledge/flagging/KnowledgeFlaggingService';
import { ChloeState, AutonomySystem, TaggedMemory } from '../../lib/shared/types/agent';
// Use an alias for Message to avoid duplicate identifier 
import { Message as SharedMessage } from "../../lib/shared/types";
import { MemoryConfig } from "../../lib/shared/types/agent";

/**
 * Interface for strategic insights
 */
interface StrategicInsight {
  insight: string;
  source: string;
  tags: string[];
  timestamp: string;
  category: string;
}

interface ChloeMemoryConfig extends MemoryConfig {
  agentId?: string;
}

// Define a custom message structure that includes the properties we need
interface EnhancedMessage {
  role: string;
  content: string;
  id?: string; 
  text?: string;
  timestamp?: string; // Add timestamp property
  metadata?: {
    role?: string;
    timestamp?: string; // Add timestamp property to metadata too
    [key: string]: any;
  };
}

// Add interfaces for plan and execution results
interface PlanWithSteps {
  description: string;
  steps: { action: string; description: string }[];
}

interface ExecutionStep {
  step: string;
  success: boolean;
  output: string;
}

interface ExecutionWithSteps {
  success: boolean;
  summary: string;
  steps: ExecutionStep[];
}

// Type for ExecutionResult from executePlan function
interface ExecutionResult {
  success: boolean;
  output: string;
  stepResults: {
    step: string;
    success: boolean;
    output: string;
  }[];
  error?: string;
}

// Add type for search result
interface SearchResult {
  id: string;
  payload: any;
  score: number;
}

// Add module declarations to extend existing types
declare module '../../server/qdrant' {
  export function addToCollection(collection: string, embedding: number[], payload: any): Promise<any>;
  export function search(collection: string, embedding: number[], limit?: number): Promise<SearchResult[]>;
  export function getRecentPoints(collection: string, limit?: number): Promise<SearchResult[]>;
}

/**
 * ChloeAgent class implements a marketing assistant agent using LangGraph
 */
export class ChloeAgent {
  private agent: StateGraph<ChloeState> | null = null; // Properly type the StateGraph
  private memory: AgentMemory | null = null;
  private chloeMemory: ChloeMemory | null = null;
  private memoryTagger: MemoryTagger | null = null;
  private persona: Persona | null = null;
  private config: AgentConfig;
  private notifiers: Notifier[] = [];
  private model: ChatOpenAI | null = null;
  protected initialized: boolean = false;
  private taskLogger: TaskLogger | null = null;
  private _autonomySystem: AutonomySystem | null = null; // Use the defined type
  private enhancedMemory: EnhancedMemory;
  private cognitiveMemory: CognitiveMemory;
  private knowledgeGraph: KnowledgeGraph;
  private feedbackLoop!: FeedbackLoopSystem; // Use definite assignment assertion for fields initialized in initialize()
  private integrationLayer!: IntegrationLayer;
  private selfImprovement!: SelfImprovementMechanism;
  private strategicInsightsCollection: string = 'strategic_insights';
  private toolCreationSystem: ToolCreationSystem | null = null;
  private knowledgeFlaggingService: KnowledgeFlaggingService | null = null;
  
  constructor(config?: Partial<AgentConfig>) {
    // Set default configuration
    this.config = {
      systemPrompt: SYSTEM_PROMPTS.CHLOE,
      model: 'openrouter/anthropic/claude-3-opus:2024-05-01',
      temperature: 0.7,
      maxTokens: 4000,
      ...config,
    };
    
    console.log('ChloeAgent instance created');
    
    // Initialize enhanced memory
    this.enhancedMemory = createEnhancedMemory('chloe');
    this.cognitiveMemory = new CognitiveMemory({ 
      namespace: 'chloe',
      workingMemoryCapacity: 9, // Slightly higher than average
      consolidationInterval: 12  // Consolidate twice daily
    });
    this.knowledgeGraph = new KnowledgeGraph('chloe');
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

      // Initialize base memory system with OpenAI embeddings if configured
      const useOpenAI = process.env.USE_OPENAI_EMBEDDINGS === 'true';
      
      this.memory = new AgentMemory({
        namespace: 'chloe',
        config: {
          defaultNamespace: 'chloe',
          embeddingModel: 'text-embedding-3-small'
        }
      });
      
      await this.memory.initialize();
      
      // Initialize Chloe-specific memory system
      this.chloeMemory = new ChloeMemory({
        agentId: 'chloe',
        useExternalMemory: true,
        externalMemory: this.memory,
        useOpenAI: useOpenAI
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

      // Initialize enhanced memory systems
      try {
        await this.enhancedMemory.initialize();
        await this.cognitiveMemory.initialize();
        await this.knowledgeGraph.initialize();
        console.log('Enhanced memory systems initialized successfully');
        
        // Initialize feedback loop system
        this.feedbackLoop = createFeedbackLoopSystem(this.enhancedMemory);
        await this.feedbackLoop.initialize();
        console.log('Feedback loop system initialized successfully');
        
        // Initialize integration layer
        this.integrationLayer = createIntegrationLayer(this.enhancedMemory, this.feedbackLoop);
        await this.integrationLayer.initialize();
        console.log('Integration layer initialized successfully');
        
        // Initialize self-improvement mechanism
        this.selfImprovement = createSelfImprovementMechanism(
          this.feedbackLoop,
          this.enhancedMemory,
          this.integrationLayer,
          {
            reviewSchedule: {
              daily: true,
              weekly: true,
              monthly: true
            }
          }
        );
        await this.selfImprovement.initialize();
        console.log('Self-improvement mechanism initialized successfully');
      } catch (error) {
        console.error('Failed to initialize advanced cognitive systems:', error);
      }

      // Initialize strategic insights collection - use 'document' as the collection type
      try {
        await serverQdrant.resetCollection('document');
        console.log('Strategic insights collection initialized');
      } catch (error) {
        // Collection might already exist
        console.log('Strategic insights collection may already exist:', error);
      }

      // Initialize tool creation system
      try {
        this.toolCreationSystem = new ToolCreationSystem(this);
        await this.toolCreationSystem.initialize();
        console.log('Tool creation system initialized successfully');
        
        // Start periodic tool creation every 24 hours
        this.toolCreationSystem.schedulePeriodicToolCreation(24);
      } catch (error) {
        console.error('Error initializing tool creation system:', error);
      }

      // Initialize Knowledge Flagging Service with proper type handling
      // Use type assertion to handle the KnowledgeGraph type mismatch
      this.knowledgeFlaggingService = new KnowledgeFlaggingService(
        this.knowledgeGraph as any
      );
      await this.knowledgeFlaggingService.load(); // Load existing flagged items
      console.log('Knowledge Flagging Service initialized successfully');

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

  // Add this method to integrate with intent router
  private async processIntentWithRouter(message: string): Promise<{ success: boolean; response?: string }> {
    try {
      // Get relevant memories to provide context
      const relevantMemories = await this.cognitiveMemory.getRelevantMemories(message, 3);
      
      // Use working memory items as additional context
      const workingMemItems = this.cognitiveMemory.getWorkingMemory();
      
      // Log working memory contents for debugging
      this.logThought(`Working memory contains ${workingMemItems.length} items`);
      
      // For important messages, store in episodic memory
      await this.cognitiveMemory.addEpisodicMemory(
        message,
        { source: 'user', category: 'message', created: new Date().toISOString() }
      );
      
      // Process with intent router
      const intentRouter = new IntentRouterTool();
      const result = await intentRouter.execute({ input: message });
      
      // If successful, store result in knowledge graph
      if (result.success && result.intent) {
        try {
          // Create nodes and edges in knowledge graph
          const messageNodeId = await this.knowledgeGraph.addNode(
            message.substring(0, 100), // Use truncated message as label
            'event',
            { type: 'user_message', full_content: message }
          );
          
          const intentNodeId = await this.knowledgeGraph.addNode(
            result.intent,
            'concept',
            { type: 'intent' }
          );
          
          // Connect message to intent
          await this.knowledgeGraph.addEdge(
            messageNodeId,
            intentNodeId,
            'causes',
            result.confidence || 0.7
          );
          
          this.logThought(`Added knowledge graph connections for intent: ${result.intent}`);
        } catch (error) {
          console.error('Error adding to knowledge graph:', error);
        }
      }
      
      // Use display property if available, otherwise fall back to original response formatting
      const response = result.display || (result.success 
        ? (typeof result.result === 'string' 
            ? result.result 
            : JSON.stringify(result.result, null, 2))
        : result.message || "I couldn't process that request.");
        
      return { 
        success: result.success, 
        response 
      };
    } catch (error) {
      console.error('Error in intent router:', error);
      return { 
        success: false, 
        response: "I encountered an error processing your request. Please try again." 
      };
    }
  }

  // Process a user message
  async processMessage(message: string, options: { userId: any; attachments?: any; }): Promise<string> {
    console.log('!!!!!!!!!!!!!! UNMISTAKABLE MARKER - THIS IS THE EDITED AGENT FILE !!!!!!!!!!!!!!');
    console.log('!!!!!!!!!!!!!! MESSAGE WAS: ' + message + ' !!!!!!!!!!!!!!');
    
    const { userId, attachments } = options;

    if (!this.initialized) {
      throw new Error('Agent not initialized');
    }

    console.log('ChloeAgent.processMessage called with message:', message);

    // Try to handle the message with intent routing first
    try {
      const intentResult = await this.processIntentWithRouter(message);
      if (intentResult.success && intentResult.response) {
        // If intent routing was successful, return the response
        return intentResult.response;
      }
      // Otherwise, continue with normal processing
      this.logThought(`Processing with standard LLM pipeline`);
    } catch (error) {
      console.error('Error in intent routing:', error);
      // Continue with normal processing if intent routing fails
    }

    // Check for special commands related to conversation history
    const lowerMessage = message.toLowerCase().trim();
    if (lowerMessage === "what did we talk about earlier today?" || 
        lowerMessage === "what did we talk about today?" ||
        lowerMessage === "summarize our conversations today") {
      try {
        // Get today's messages
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today
        
        const summary = await serverQdrant.summarizeChat({ since: today });
        return summary;
      } catch (error) {
        console.error("Error summarizing today's conversations:", error);
        return "I'm having trouble retrieving our conversation history right now.";
      }
    }
    
    if (lowerMessage === "can you summarize our chat so far?" || 
        lowerMessage === "summarize our chat" || 
        lowerMessage === "summarize our conversation so far") {
      try {
        // Get last 24 hours of conversations
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const summary = await serverQdrant.summarizeChat({ since: yesterday });
        return summary;
      } catch (error) {
        console.error("Error summarizing recent conversations:", error);
        return "I'm having trouble summarizing our recent conversations right now.";
      }
    }

    try {
      // Log user message
      if (this.taskLogger) {
        this.taskLogger.logUserMessage(message, {
          timestamp: new Date().toISOString()
        });
      }

      // Tag memory if available
      if (this.memoryTagger) {
        try {
          const tag = await this.memoryTagger.tagMemory(message);
          
          // Log memory tagging
          if (this.taskLogger) {
            this.taskLogger.logAction(`Tagged memory with importance: ${tag.importance}`, {
              tag,
              timestamp: new Date().toISOString()
            });
          }
          
          // For the importance check, convert to string if it's a number
          if (typeof tag.importance === 'number') {
            // Convert numeric importance to string representation
            const importanceStr = tag.importance < 0.3 ? 'low' : 
                                   tag.importance < 0.7 ? 'medium' : 'high';
            if (['medium', 'high'].includes(importanceStr)) {
              // Use enhanced memory instead
              await this.enhancedMemory.addMemory(
                message, 
                {
                  category: tag.category,
                  importance: importanceStr, // Use string representation
                  source: 'user',
                  tags: tag.tags
                },
                'message'
              );
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

      // Get relevant memories from long-term memory
      let memories: string[] = [];
      try {
        memories = await this.enhancedMemory.getRelevantMemories(message, 5);
        
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

      // Get recent chat messages for immediate context
      let recentChatContext = "";
      try {
        // Get both time-based and count-based contexts
        
        // 1. Get messages from the last 3 hours (time-based context)
        const threeHoursAgo = new Date();
        threeHoursAgo.setHours(threeHoursAgo.getHours() - 3);
        const recentTimeBasedMessages = await serverQdrant.getRecentChatMessages({
          since: threeHoursAgo,
          limit: 5,
          roles: ['user', 'assistant'] // Only include actual conversation
        });
        
        // 2. Get the last 30 messages regardless of time (count-based context)
        const lastMessages = await serverQdrant.getRecentChatMessages({
          limit: 30,
          roles: ['user', 'assistant']
        });
        
        // 3. Combine and deduplicate messages
        const allMessages = [...recentTimeBasedMessages].map(msg => msg as unknown as EnhancedMessage);
        const existingIds = new Set(allMessages.map(msg => msg.id || ''));
        
        // Add messages from count-based context that aren't already included
        for (const msg of lastMessages.map(m => m as unknown as EnhancedMessage)) {
          if (!existingIds.has(msg.id || '')) {
            allMessages.push(msg);
            existingIds.add(msg.id || '');
          }
        }
        
        // Sort by timestamp (newest first) and limit to 30 most recent
        const sortedMessages = allMessages
          .sort((a, b) => {
            // Safely handle timestamp which might be undefined
            const timestampA = a.timestamp || a.metadata?.timestamp || new Date().toISOString();
            const timestampB = b.timestamp || b.metadata?.timestamp || new Date().toISOString();
            return new Date(timestampB).getTime() - new Date(timestampA).getTime();
          })
          .slice(0, 30);
        
        if (sortedMessages.length > 0) {
          recentChatContext = "### Recent Conversation\n" + 
            sortedMessages.map(msg => {
              const messageWithMeta = msg as unknown as EnhancedMessage;
              const role = messageWithMeta.metadata?.role || messageWithMeta.role || "unknown";
              return `${role.toUpperCase()}: ${messageWithMeta.text || messageWithMeta.content}`;
            }).join("\n\n");
            
          console.log(`Added ${sortedMessages.length} recent messages to context`);
        }
      } catch (error) {
        console.error('Error retrieving recent chat context:', error);
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
      const messages: SharedMessage[] = [
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
          // Use 'manifesto' instead of 'goals' if not available in the persona components
          const goalComponent = this.persona.getComponent('manifesto'); 
          const personality = this.persona.getComponent('personality');
          const manifesto = this.persona.getComponent('manifesto');

          console.log('Persona components retrieved:', {
            hasBackground: !!background,
            hasGoals: !!goalComponent,
            hasPersonality: !!personality,
            hasManifesto: !!manifesto
          });

          // Create structured persona context
          let personaContext = "## CORE AGENT CONTEXT - ALWAYS CONSIDER THIS INFORMATION\n\n";
          
          if (background) {
            personaContext += "### Background\n" + background + "\n\n";
          }
          
          if (goalComponent) {
            personaContext += "### Goals\n" + goalComponent + "\n\n";
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
                goalComponent ? 'manifesto' : null,
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

      // Add recent chat context right after persona info for maximum relevance
      if (recentChatContext) {
        messages.push({
          role: 'system',
          content: recentChatContext
        });
      }

      // Add long-term memory context if available
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
      const stringifiedMessages = JSON.stringify(messages);
      const response = await this.model!.invoke(stringifiedMessages as any);
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
          if (typeof tag.importance === 'number') {
            // Convert numeric importance to string representation
            const importanceStr = tag.importance < 0.3 ? 'low' : 
                                   tag.importance < 0.7 ? 'medium' : 'high';
            if (['medium', 'high'].includes(importanceStr)) {
              await this.chloeMemory.addMemory(`Chloe: ${agentResponse}`, JSON.stringify(tag));
              
              // Log memory addition
              if (this.taskLogger) {
                this.taskLogger.logAction(`Added response to memory with importance: ${importanceStr}`, {
                  importance: importanceStr,
                  timestamp: new Date().toISOString()
                });
              }
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
      
      // Store message in episodic memory with emotional context
      await this.cognitiveMemory.addEpisodicMemory(
        message,
        { 
          source: 'user', 
          category: 'message', 
          importance: this.cognitiveMemory.extractPriority(message) === 'high' ? 'high' : 'medium'
        }
      );
      
      // --- **NEW: Asynchronous Knowledge Flagging** --- 
      if (this.knowledgeFlaggingService) {
        const conversationText = `User: ${message}\nAgent: ${agentResponse}`;
        const flaggingContext = `User ID: ${userId}, Timestamp: ${new Date().toISOString()}`;
        
        // Run flagging in the background (don't await the promise directly here 
        // to avoid blocking the chat response)
        this.knowledgeFlaggingService.flagFromConversation(conversationText, flaggingContext)
          .then(flaggingResult => {
            if (flaggingResult.success && flaggingResult.itemId) {
              console.log(`Successfully flagged potential knowledge from conversation. Item ID: ${flaggingResult.itemId}`);
              // Optional: Log success to task logger
              if (this.taskLogger) {
                  this.taskLogger.logAction('Flagged potential knowledge', {
                    itemId: flaggingResult.itemId,
                    confidence: 'N/A', // Confidence is within the flagged item itself
                    timestamp: new Date().toISOString()
                  });
              }
            } else if (!flaggingResult.success && flaggingResult.error !== 'No relevant knowledge was extracted from the conversation') {
              // Log error only if it's not the expected "nothing found" case
              console.warn('Failed to flag knowledge from conversation:', flaggingResult.error);
               if (this.taskLogger) {
                  this.taskLogger.logAction('Knowledge flagging failed', {
                    error: flaggingResult.error,
                    timestamp: new Date().toISOString()
                  });
              }
            }
          })
          .catch(flaggingError => {
            console.error('Error during asynchronous knowledge flagging:', flaggingError);
             if (this.taskLogger) {
                this.taskLogger.logAction('Knowledge flagging system error', {
                  error: flaggingError instanceof Error ? flaggingError.message : String(flaggingError),
                  timestamp: new Date().toISOString()
                });
            }
          });
      } else {
        console.warn('Knowledge Flagging Service not initialized, skipping flagging.');
      }
      // --- **END: Asynchronous Knowledge Flagging** --- 

      console.log('Agent response prepared:', agentResponse.substring(0, 50) + '...');
      
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
      // Create a new session for the daily tasks
      if (this.taskLogger) {
        this.taskLogger.createSession('Daily Tasks', ['scheduled', 'maintenance', 'planning']);
        this.taskLogger.logAction('Starting daily tasks routine', {
          timestamp: new Date().toISOString()
        });
      }
      
      // Try to send a notification that daily tasks are starting
      try {
        const { notifyDiscord } = require('./notifiers');
        await notifyDiscord('Starting daily tasks routine', 'update');
        
        // Also send as DM if configured
        if (process.env.DISCORD_USER_ID) {
          const { sendDiscordDm } = require('./notifiers');
          await sendDiscordDm('Starting your daily tasks routine', 'update');
        }
      } catch (error) {
        console.error('Error sending start notification:', error);
      }
      
      // Step 1: Review high importance memories
      if (this.taskLogger) {
        this.taskLogger.logAction('Starting memory review', {
          timestamp: new Date().toISOString()
        });
      }
      
      let highImportanceMemories: string[] = [];
      if (this.chloeMemory) {
        try {
          const memories = await this.chloeMemory.getHighImportanceMemories();
          highImportanceMemories = memories.map(m => m.content);
        
          this.logThought(`Found ${highImportanceMemories.length} high importance memories to review`);
          
          if (this.taskLogger) {
            this.taskLogger.logAction(`Retrieved ${highImportanceMemories.length} high importance memories`, {
              count: highImportanceMemories.length,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('Error retrieving high importance memories:', error);
          this.logThought(`Error retrieving high importance memories: ${error}`);
        }
      }
      
      // Step 2: Generate a daily plan using LangGraph planner
      this.logThought("Creating a daily plan for the CMO function");
      if (this.taskLogger) {
        this.taskLogger.logAction('Starting daily planning', {
          timestamp: new Date().toISOString()
        });
      }
      
      // Default set of tasks to plan
      const planningPrompt = `As Chloe, the Chief Marketing Officer, create a plan for today's work. 
      Consider the following activities:
      1. Review the content calendar
      2. Check social media performance
      3. Analyze recent marketing campaigns
      4. Plan upcoming content
      5. Research industry trends`;
      
      try {
        const planResult = await planTask(planningPrompt);
        
        if (this.taskLogger) {
          // Extract step information from the plan result
          const planStepCount = Array.isArray(planResult.plan) ? planResult.plan.length : 0;
          const planSummary = "Daily marketing tasks plan";
          
          this.taskLogger.logAction('Generated daily plan', {
            planStepCount,
            planSummary,
            timestamp: new Date().toISOString()
          });
        }
        
        // Create proper plan structure from string array
        const planContent: PlanWithSteps = {
          description: "Daily marketing tasks plan",
          steps: Array.isArray(planResult.plan) 
            ? planResult.plan.map((step: string) => {
                const [action, ...descParts] = step.split(":");
                return {
                  action: action.trim(),
                  description: descParts.join(":").trim()
                };
              })
            : []
        };
        
        this.logThought(`Successfully created a daily plan with ${planContent.steps.length} steps:`);
        this.logThought(`Plan description: ${planContent.description}`);
        
        // Send plan summary to Discord
        try {
          const { notifyDiscord, sendDiscordDm } = require('./notifiers');
          
          const planSummary = `
## Daily Marketing Plan
          
${planContent.description}

### Tasks (${planContent.steps.length})
${planContent.steps.map((step, idx) => `${idx+1}. ${step.action}: ${step.description}`).join('\n')}
          `;
          
          await notifyDiscord(planSummary, 'summary');
          
          // Also send as DM if configured
          if (process.env.DISCORD_USER_ID) {
            await sendDiscordDm(planSummary, 'summary');
          }
          
          this.logThought("Sent daily plan summary to Discord");
        } catch (error) {
          console.error('Error sending plan to Discord:', error);
        }
        
        // Log each step of the plan
        planContent.steps.forEach((step: { action: string; description: string }, index: number) => {
          this.logThought(`Step ${index + 1}: ${step.action} - ${step.description}`);
          
          if (this.taskLogger) {
            this.taskLogger.logAction(`Plan step ${index + 1}`, {
              action: step.action,
              description: step.description,
              timestamp: new Date().toISOString()
            });
          }
        });
        
        // Step 3: Execute the plan using LangGraph executor
        this.logThought("Beginning execution of the daily plan");
        if (this.taskLogger) {
          this.taskLogger.logAction('Starting plan execution', {
            timestamp: new Date().toISOString()
          });
        }
        
        // Execute plan with the correct parameter types
        const executionResult = await executePlan(
          planContent.steps.map(step => `${step.action}: ${step.description}`), 
          "Context: Execute the daily marketing plan for Chloe CMO agent", 
          { 
            memory: this.chloeMemory || undefined 
          }
        );
        
        // Send execution results to Discord
        try {
          const { notifyDiscord, sendDiscordDm } = require('./notifiers');
          
          const executionSummary = `
## Daily Plan Execution Results

${executionResult.output}

### Steps Completed: ${executionResult.stepResults.filter(s => s.success).length}/${executionResult.stepResults.length}
          `;
          
          await notifyDiscord(executionSummary, 'update');
          
          // Also send as DM if configured
          if (process.env.DISCORD_USER_ID) {
            await sendDiscordDm(executionSummary, 'update');
          }
          
          this.logThought("Sent execution results to Discord");
        } catch (error) {
          console.error('Error sending execution results to Discord:', error);
        }
        
        // Log the execution results
        this.logThought(`Plan execution completed with ${executionResult.stepResults.length} steps executed`);
        
        if (this.taskLogger) {
          this.taskLogger.logAction('Plan execution completed', {
            stepsExecuted: executionResult.stepResults.length,
            success: executionResult.success,
            output: executionResult.output.substring(0, 200) + (executionResult.output.length > 200 ? '...' : ''),
            timestamp: new Date().toISOString()
          });
          
          // Log each step's execution result
          executionResult.stepResults.forEach((step, index) => {
            this.taskLogger?.logAction(`Executed step ${index + 1}`, {
              action: step.step,
              result: step.output.substring(0, 200) + (step.output.length > 200 ? '...' : ''),
              success: step.success,
              timestamp: new Date().toISOString()
            });
          });
        }
        
        // Step 4: Daily reflection on what was accomplished
        this.logThought("Performing daily reflection");
        const reflection = await this.reflect('What were the key accomplishments from today\'s plan execution?');
        
        // Send daily reflection to Discord
        try {
          const { notifyDiscord, sendDiscordDm } = require('./notifiers');
          await notifyDiscord(`## Daily Reflection\n\n${reflection}`, 'update');
          
          // Also send as DM if configured
          if (process.env.DISCORD_USER_ID) {
            await sendDiscordDm(`## Daily Reflection\n\n${reflection}`, 'update');
          }
          
          this.logThought("Sent daily reflection to Discord");
        } catch (error) {
          console.error('Error sending reflection to Discord:', error);
        }
        
        // Save a summary of the day's work to memory
        if (this.chloeMemory) {
          const daySummary = `Daily work summary: ${executionResult.output}`;
          await this.chloeMemory.addMemory(
            daySummary,
            'daily_summary',
            'high',
            'system'
          );
          
          this.logThought("Saved daily work summary to memory");
        }
        
        // Send daily task summary to Discord
        await this.sendDailySummaryToDiscord();
      } catch (error) {
        console.error('Error in daily planning or execution:', error);
        this.logThought(`Error in daily tasks: ${error}`);
        
        if (this.taskLogger) {
          this.taskLogger.logAction(`Error in daily planning/execution: ${error instanceof Error ? error.message : String(error)}`, {
            error: true,
            timestamp: new Date().toISOString()
          });
        }
        
        // Send error notification to Discord
        try {
          const { notifyDiscord, sendDiscordDm } = require('./notifiers');
          await notifyDiscord(`Error in daily tasks: ${error instanceof Error ? error.message : String(error)}`, 'alert', true);
          
          // Also send as DM if configured
          if (process.env.DISCORD_USER_ID) {
            await sendDiscordDm(`Error in daily tasks: ${error instanceof Error ? error.message : String(error)}`, 'alert');
          }
        } catch (notifyError) {
          console.error('Error sending error notification:', notifyError);
        }
      }
      
      // New: Run trend summarization weekly (on Mondays)
      const today = new Date();
      if (today.getDay() === 1) { // Monday
        try {
          this.logThought("It's Monday, running weekly trend summarization");
          const trendResult = await this.summarizeTrends();
          
          if (trendResult.success) {
            this.logThought("Successfully summarized weekly trends");
            
            if (this.taskLogger) {
              this.taskLogger.logAction('Completed weekly trend summarization', {
                success: true,
                timestamp: new Date().toISOString()
              });
            }
          } else {
            this.logThought(`Failed to summarize trends: ${trendResult.error}`);
            
            if (this.taskLogger) {
              this.taskLogger.logAction('Failed weekly trend summarization', {
                error: trendResult.error,
                timestamp: new Date().toISOString()
              });
            }
          }
        } catch (error) {
          console.error('Error in weekly trend summarization:', error);
          this.logThought(`Error in weekly trend summarization: ${error}`);
        }
      }
      
      // Notify about completion
      this.notify('Daily tasks completed');
      
      // End the session
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
      
      // Try to send error notification to Discord
      try {
        const { notifyDiscord } = require('./notifiers');
        await notifyDiscord(`Fatal error in daily tasks: ${errorMessage}`, 'alert', true);
      } catch (notifyError) {
        console.error('Error sending error notification to Discord:', notifyError);
      }
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
      if (this.memory) {
        await this.memory.addMemory(initMemory, { type: 'system' });
      }
      
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
    console.log(`Agent reflecting on: ${question}`);
    
    try {
      // Use persona for reflection if available
      let systemPrompt = "You are Chloe, a marketing AI assistant. Reflect on the following question based on your knowledge and experience.";
      
      if (this.persona) {
        const manifesto = this.persona.getComponent('manifesto');
        if (manifesto) {
          systemPrompt = `${manifesto}\n\nReflect on the following question based on your knowledge and experience as Chloe.`;
        }
      }
      
      // Get a model for reflection
      let model = this.model;
      if (!model) {
        model = new ChatOpenAI({
          modelName: process.env.OPENAI_MODEL_NAME || "gpt-4.1-2024-04-14",
          temperature: 0.7,
        });
      }
      
      // Use string prompt instead of array for type compatibility
      const promptText = `${systemPrompt}\n\nQuestion: ${question}`;
      const reflection = await model.invoke(promptText);
      
      const reflectionText = reflection.content.toString();
      
      // Save reflection in memory using string content
      if (this.memory) {
        await this.memory.addMemory(reflectionText, { type: 'reflection' });
      }
      
      if (this.chloeMemory) {
        await this.chloeMemory.addMemory(
          reflectionText,
          'reflection',
          'medium',
          'system'
        );
      }
      
      return reflectionText;
    } catch (error) {
      console.error('Error during reflection:', error);
      return `Error during reflection: ${error instanceof Error ? error.message : String(error)}`;
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

  /**
   * Perform weekly reflection with enhanced market awareness
   */
  async runWeeklyReflection(): Promise<string> {
    try {
      // Log reflection start
      if (this.taskLogger) {
        this.taskLogger.createSession('Weekly Reflection', ['reflection', 'weekly', 'analysis']);
        this.taskLogger.logAction('Starting weekly reflection process', {
          timestamp: new Date().toISOString()
        });
      }

      console.log('Running weekly reflection process...');
      this.logThought("Beginning weekly reflection to analyze performance and identify insights");
      
      // Calculate date range for the past week
      const today = new Date();
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      // Fetch relevant data from memory for the past week
      let memories: any[] = [];
      let tasks: any[] = [];
      
      // Get tasks and thoughts from memory
      if (this.chloeMemory) {
        try {
          // Fetch task memories
          const taskMemories = await this.chloeMemory.getMemoriesByDateRange(
            'task',
            oneWeekAgo,
            today,
            30 // Limit to reasonable number
          );
          
          // Fetch thought memories
          const thoughtMemories = await this.chloeMemory.getMemoriesByDateRange(
            'thought',
            oneWeekAgo,
            today,
            30
          );
          
          memories = [...thoughtMemories];
          tasks = [...taskMemories];
          
          if (this.taskLogger) {
            this.taskLogger.logAction(`Retrieved ${taskMemories.length} tasks and ${thoughtMemories.length} thoughts for reflection`, {
              dateRange: `${oneWeekAgo.toISOString()} to ${today.toISOString()}`,
              timestamp: new Date().toISOString()
            });
          }
          
          this.logThought(`Found ${taskMemories.length} tasks and ${thoughtMemories.length} thoughts from the past week to analyze`);
        } catch (error) {
          console.error('Error retrieving memories for weekly reflection:', error);
          this.logThought(`Error retrieving memories for reflection: ${error}`);
          
          if (this.taskLogger) {
            this.taskLogger.logAction(`Error retrieving memories: ${error instanceof Error ? error.message : String(error)}`, {
              error: true,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
      
      // Get recent strategic insights
      let strategicInsights: StrategicInsight[] = [];
      try {
        strategicInsights = await this.getRecentStrategicInsights(10);
        this.logThought(`Retrieved ${strategicInsights.length} recent strategic insights for reflection`);
        
        if (this.taskLogger) {
          this.taskLogger.logAction(`Retrieved ${strategicInsights.length} strategic insights for reflection`, {
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Error retrieving strategic insights for reflection:', error);
        this.logThought(`Error retrieving strategic insights: ${error}`);
      }
      
      // Prepare prompt for reflection
      const reflectionPrompt = `
      # Weekly Reflection (${oneWeekAgo.toLocaleDateString()} to ${today.toLocaleDateString()})
      
      As Chloe, the Chief Marketing Officer, reflect on your performance and activities over the past week.
      
      ## Tasks Completed (${tasks.length})
      ${tasks.map(t => `- ${t.content}`).join('\n')}
      
      ## Thoughts and Insights (${memories.length})
      ${memories.map(m => `- ${m.content}`).join('\n')}
      
      ## Market Observations This Week (${strategicInsights.length})
      ${strategicInsights.map(si => `- ${si.category}: ${si.insight.substring(0, 150)}...`).join('\n')}
      
      Please provide a thoughtful reflection that covers:
      1. Key accomplishments and successes this week
      2. Challenges faced and how they were handled
      3. Insights gained about marketing strategies or processes
      4. Areas for improvement in the coming week
      5. Priorities for next week
      
      Additionally, include a detailed "Market Observations This Week" section that:
      1. Summarizes key trends spotted
      2. Reflects on whether you leveraged these trends properly
      3. Suggests new areas to watch
      
      Format your response as a well-structured reflection that could be shared with the team.
      `;
      
      this.logThought("Generating weekly reflection with market awareness");
      
      // Generate reflection using LLM
      const messages = [
        { role: 'system', content: 'You are Chloe, the Chief Marketing Officer AI assistant. Create a thoughtful weekly reflection that includes market trend awareness.' },
        { role: 'user', content: reflectionPrompt }
      ];
      
      const response = await this.model!.invoke(messages as any);
      const reflection = response.content;
      
      // Store reflection in memory
      if (this.chloeMemory) {
        try {
          await this.chloeMemory.addMemory(
            reflection,
            'weekly_reflection',
            'high',
            'chloe'
          );
          
          this.logThought("Stored weekly reflection in memory with high importance");
          
          if (this.taskLogger) {
            this.taskLogger.logAction('Stored weekly reflection in memory', {
              importance: 'high',
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('Error storing weekly reflection in memory:', error);
          
          if (this.taskLogger) {
            this.taskLogger.logAction(`Error storing reflection: ${error instanceof Error ? error.message : String(error)}`, {
              error: true,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
      
      // Log the reflection
      if (this.taskLogger) {
        this.taskLogger.logReflection(reflection, {
          type: 'weekly',
          timestamp: new Date().toISOString()
        });
        this.taskLogger.logAction('Weekly reflection completed', {
          success: true,
          timestamp: new Date().toISOString()
        });
        this.taskLogger.endSession();
      }
      
      // Send reflection to Discord if available
      try {
        // Import at usage to avoid circular dependencies
        const { notifyDiscord } = require('./notifiers');
        
        // Format a condensed version for Discord
        const discordSummary = `
## Weekly Reflection (${oneWeekAgo.toLocaleDateString()} to ${today.toLocaleDateString()})

${reflection.substring(0, 1500)}${reflection.length > 1500 ? '...' : ''}
        `;
        
        await notifyDiscord(discordSummary, 'summary');
        this.logThought("Sent weekly reflection summary to Discord");
      } catch (error) {
        console.error('Error sending reflection to Discord:', error);
      }
      
      console.log('Weekly reflection completed');
      return reflection;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error during weekly reflection:', errorMessage);
      
      // Log the error
      if (this.taskLogger) {
        this.taskLogger.logAction(`Error during weekly reflection: ${errorMessage}`, {
          error: true,
          timestamp: new Date().toISOString()
        });
        this.taskLogger.endSession();
      }
      
      return `Failed to complete weekly reflection: ${errorMessage}`;
    }
  }

  /**
   * Send a daily summary of tasks and accomplishments to Discord
   */
  async sendDailySummaryToDiscord(): Promise<boolean> {
    try {
      console.log('Preparing daily summary for Discord...');
      
      // Get today's date
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today
      
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999); // End of today
      
      // Fetch today's tasks
      let todaysTasks: any[] = [];
      if (this.chloeMemory) {
        try {
          todaysTasks = await this.chloeMemory.getMemoriesByDateRange(
            'task',
            today,
            endOfDay,
            20 // Reasonable limit
          );
          
          this.logThought(`Found ${todaysTasks.length} tasks completed today`);
        } catch (error) {
          console.error('Error retrieving daily tasks:', error);
        }
      }
      
      // Get execution trace from task logger if available
      let executionSummary = '';
      if (this.taskLogger) {
        try {
          // Safe access with optional chaining and type assertion
          const logger = this.taskLogger as any;
          // This would get the summary of today's task execution
          executionSummary = await logger.summarizeExecutionTraces?.(today) || '';
        } catch (error) {
          console.error('Error getting execution summary:', error);
        }
      }
      
      // Format the daily summary
      const summary = `
## Daily Summary for ${today.toLocaleDateString()}

### Tasks Completed (${todaysTasks.length})
${todaysTasks.length > 0 
  ? todaysTasks.map(t => `- ${t.content.substring(0, 100)}${t.content.length > 100 ? '...' : ''}`).join('\n')
  : '- No tasks recorded today'}

${executionSummary ? `### Execution Summary\n${executionSummary}` : ''}

### Status
Successfully completed daily operations.
      `;
      
      // Send to Discord
      try {
        // Import at usage to avoid circular dependencies
        const { notifyDiscord } = require('./notifiers');
        await notifyDiscord(summary, 'summary');
        console.log('Daily summary sent to Discord');
        return true;
      } catch (error) {
        console.error('Error sending daily summary to Discord:', error);
        return false;
      }
    } catch (error) {
      console.error('Error preparing daily summary:', error);
      return false;
    }
  }

  /**
   * Get the model instance
   */
  getModel(): ChatOpenAI | null {
    return this.model;
  }
  
  /**
   * Check if the agent is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the agent's autonomy system
   * Used by scheduler API endpoints
   */
  async getAutonomySystem(): Promise<AutonomySystem | null> {
    if (!this._autonomySystem) {
      try {
        // Restore the original implementation
        const { initializeChloeAutonomy } = await import('./autonomy');
        const result = await initializeChloeAutonomy(this);
        if (result.status === 'success' && result.autonomySystem) {
          this._autonomySystem = result.autonomySystem;
        } else {
          console.error('Failed to initialize autonomy system:', result.message);
        }
      } catch (error) {
        console.error('Error initializing autonomy system:', error);
        return null;
      }
    }
    return this._autonomySystem;
  }

  // Add new method to access cognitive memory
  getCognitiveMemory(): CognitiveMemory {
    return this.cognitiveMemory;
  }

  // Add new method to access knowledge graph
  getKnowledgeGraph(): KnowledgeGraph {
    if (!this.knowledgeGraph) {
      throw new Error('Knowledge Graph not initialized');
    }
    return this.knowledgeGraph;
  }

  /**
   * Get the feedback loop system
   */
  getFeedbackLoop(): FeedbackLoopSystem {
    return this.feedbackLoop;
  }

  /**
   * Get the integration layer
   */
  getIntegrationLayer(): IntegrationLayer {
    return this.integrationLayer;
  }

  /**
   * Get the self-improvement mechanism
   */
  getSelfImprovement(): SelfImprovementMechanism {
    return this.selfImprovement;
  }
  
  /**
   * Run a performance review manually
   */
  async runPerformanceReview(reviewType: 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      this.logThought(`Running ${reviewType} performance review...`);
      
      const metrics = await this.selfImprovement.runPerformanceReview(reviewType);
      
      this.logThought(`Performance review complete: Success Rate: ${Math.round(metrics.intentSuccessRate * 100)}%`);
      
      // Notify about the performance review
      this.notify(`${reviewType.charAt(0).toUpperCase() + reviewType.slice(1)} performance review completed. Success Rate: ${Math.round(metrics.intentSuccessRate * 100)}%, Task Completion: ${Math.round(metrics.taskCompletionRate * 100)}%`);
      
      return {
        success: true,
        metrics
      };
    } catch (error: unknown) {
      console.error(`Error running ${reviewType} performance review:`, error);
      return {
        success: false,
        error: `Failed to run performance review: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  // Get enhanced memory
  getEnhancedMemory(): EnhancedMemory {
    return this.enhancedMemory;
  }

  /**
   * Summarizes trends from market scanner results
   * Collects weekly data, groups by theme, and stores strategic insights
   */
  async summarizeTrends(): Promise<{ success: boolean; summary?: string; error?: string }> {
    try {
      if (!this.initialized) {
        throw new Error('Agent not initialized');
      }

      this.logThought("Starting trend summarization from market scanner results");
      
      if (this.taskLogger) {
        this.taskLogger.createSession('Trend Summarization', ['market-scanner', 'trends', 'analysis']);
        this.taskLogger.logAction('Starting trend summarization process', {
          timestamp: new Date().toISOString()
        });
      }

      // Calculate date range for the past week
      const today = new Date();
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      // Try to get memories related to market scanning using type assertion
      let marketScannerMemories: any[] = [];
      if (this.chloeMemory) {
        try {
          // Use type assertion to avoid type errors
          const memory = this.chloeMemory as any;
          
          // Get all memories related to market scanning
          marketScannerMemories = await memory.getMemoriesByTags(
            ['market_scanner', 'rss', 'reddit', 'twitter', 'trends', 'news'],
            30, // Reasonable limit
            oneWeekAgo,
            new Date()
          );
          
          if (marketScannerMemories.length === 0) {
            // Fallback to get any external content memories
            marketScannerMemories = await memory.getMemoriesByCategory(
              'external_content',
              30,
              oneWeekAgo,
              new Date()
            );
          }
        } catch (memoryError) {
          console.error('Error retrieving market scanner memories:', memoryError);
        }
      }
      
      // If we don't have enough data, return early
      if (marketScannerMemories.length < 3) {
        const errorMessage = 'Not enough market scanner data to generate trends';
        console.warn(errorMessage);
        
        if (this.taskLogger) {
          this.taskLogger.logAction(errorMessage, {
            warning: true,
            count: marketScannerMemories.length,
            timestamp: new Date().toISOString()
          });
          this.taskLogger.endSession();
        }
        
        return { 
          success: false, 
          error: errorMessage 
        };
      }
      
      // Prepare the prompt for trend summarization
      const trendPrompt = `
      # Market Trend Analysis

      As Chloe, the Chief Marketing Officer, analyze the following market scanner results from the past week (${oneWeekAgo.toLocaleDateString()} to ${today.toLocaleDateString()}) and identify key trends and strategic insights.

      ## Market Scanner Results
      ${marketScannerMemories.map(m => `- ${m.content}`).join('\n')}

      ## Your Task
      1. Identify 3-5 major themes or trends from these results
      2. For each theme/trend:
         a. Write a concise name/title for the trend
         b. Summarize the key observations and evidence
         c. Provide strategic implications for marketing
         d. Suggest potential actions to leverage this trend
      3. Provide relevant tags for each trend

      Format each trend as:
      
      ### [Trend Name]
      
      **Observations**: [Summary of observations and evidence]
      
      **Strategic Implications**: [How this affects marketing strategy]
      
      **Potential Actions**: [Ideas to leverage this trend]
      
      **Tags**: [comma-separated list of relevant tags]
      `;
      
      this.logThought("Generating trend summary using LLM");
      
      // Generate trend summary using LLM
      const messages = [
        { role: 'system', content: 'You are Chloe, the Chief Marketing Officer AI assistant. Create insightful trend summaries from market scanner data.' },
        { role: 'user', content: trendPrompt }
      ];
      
      const response = await this.model!.invoke(messages as any);
      const trendSummary = response.content;
      
      // Parse the response to extract individual trends
      const trends = this.parseTrendSummary(trendSummary);
      
      // Store each trend as a strategic insight
      for (const trend of trends) {
        await this.addStrategicInsight(
          trend.insight,
          trend.tags,
          trend.category,
          'market_scanner'
        );
        
        this.logThought(`Stored strategic insight: ${trend.category}`);
      }
      
      // Log the trend summary
      if (this.taskLogger) {
        this.taskLogger.logAction('Generated trend summary', {
          trendCount: trends.length,
          timestamp: new Date().toISOString()
        });
        
        // Log trends if we have a task logger
        if (this.taskLogger && trends.length > 0) {
          // Log each trend with null check for taskLogger
          trends.forEach((trend, index) => {
            if (this.taskLogger) {
              this.taskLogger.logAction(`Trend ${index + 1}: ${trend.category}`, {
                tags: trend.tags.join(', '),
                timestamp: new Date().toISOString()
              });
            }
          });
        }
        
        this.taskLogger.endSession();
      }
      
      // Send trend summary to Discord if available
      try {
        const { notifyDiscord } = require('./notifiers');
        
        // Format a condensed version for Discord
        const discordSummary = `
## Weekly Market Trends Summary (${oneWeekAgo.toLocaleDateString()} to ${today.toLocaleDateString()})

${trendSummary.substring(0, 1900)}${trendSummary.length > 1900 ? '...' : ''}
        `;
        
        await notifyDiscord(discordSummary, 'summary');
        this.logThought("Sent trend summary to Discord");
      } catch (error) {
        console.error('Error sending trend summary to Discord:', error);
      }
      
      return {
        success: true,
        summary: trendSummary
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error summarizing trends:', errorMessage);
      
      // Log the error
      if (this.taskLogger) {
        this.taskLogger.logAction(`Error summarizing trends: ${errorMessage}`, {
          error: true,
          timestamp: new Date().toISOString()
        });
        this.taskLogger.endSession();
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Parse the trend summary to extract individual trends
   */
  private parseTrendSummary(summary: string): Array<{
    insight: string;
    tags: string[];
    category: string;
  }> {
    const trends: Array<{
      insight: string;
      tags: string[];
      category: string;
    }> = [];
    
    try {
      // Split by trend sections (marked by ### or similar)
      const trendSections = summary.split(/###\s+/);
      
      // Skip the first element if it's empty or doesn't contain a trend
      const startIndex = trendSections[0].trim().length === 0 || !trendSections[0].includes("Trend") ? 1 : 0;
      
      for (let i = startIndex; i < trendSections.length; i++) {
        const section = trendSections[i].trim();
        if (!section) continue;
        
        // Extract trend title/category
        const categoryMatch = section.match(/^([^\n]+)/);
        const category = categoryMatch ? categoryMatch[1].trim() : `Trend ${i}`;
        
        // Extract tags
        const tagsMatch = section.match(/\*\*Tags\*\*:\s*([^\n]+)/);
        const tagsString = tagsMatch ? tagsMatch[1].trim() : '';
        const tags = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        
        // Use the entire section as the insight
        const insight = section;
        
        trends.push({
          insight,
          tags: tags.length > 0 ? tags : ['trend', 'market_analysis'],
          category
        });
      }
    } catch (error) {
      console.error('Error parsing trend summary:', error);
    }
    
    // If parsing failed, create at least one trend with the entire summary
    if (trends.length === 0) {
      trends.push({
        insight: summary,
        tags: ['trend', 'market_analysis'],
        category: 'Market Trends Summary'
      });
    }
    
    return trends;
  }

  /**
   * Add a strategic insight to memory
   */
  async addStrategicInsight(insight: string, tags: string[], category: string = 'general', source: string = 'system'): Promise<boolean> {
    try {
      if (!this.initialized) {
        throw new Error('Agent not initialized');
      }
      
      // Get time for embedding requests
      const startTime = Date.now();
      
      // Create a strategic insight object
      const strategicInsight: StrategicInsight = {
        insight,
        source: source as any, // Use type assertion to handle string type
        tags,
        timestamp: new Date().toISOString(),
        category
      };
      
      // Get embeddings for the insight
      const embeddingResponse = await serverQdrant.getEmbedding(insight);
      
      if (!embeddingResponse || !embeddingResponse.embedding) {
        throw new Error('Failed to generate embedding for strategic insight');
      }
      
      // Add to strategic insights collection with type assertion
      const qdrant = serverQdrant as any;
      await qdrant.addToCollection(
        this.strategicInsightsCollection,
        embeddingResponse.embedding,
        strategicInsight
      );
      
      this.logThought(`Added strategic insight to ${this.strategicInsightsCollection}: ${category}`);
      
      // Also add to regular memory with appropriate tags
      if (this.chloeMemory) {
        // Use type assertion to work around type constraints
        const addMemory = this.chloeMemory.addMemory as any;
        
        await addMemory.call(
          this.chloeMemory,
          `Strategic Insight - ${category}: ${insight.substring(0, 200)}${insight.length > 200 ? '...' : ''}`,
          'strategic_insight',
          'high',
          source,
          undefined,
          [...tags, 'strategic_insight']
        );
      }
      
      return true;
    } catch (error) {
      console.error('Error adding strategic insight:', error);
      return false;
    }
  }

  /**
   * Search for strategic insights based on a query
   */
  async searchStrategicInsights(query: string, options?: { limit?: number; tags?: string[] }): Promise<StrategicInsight[]> {
    try {
      if (!this.initialized) {
        throw new Error('Agent not initialized');
      }
      
      const limit = options?.limit || 5;
      
      // Get embedding for the query
      const embeddingResponse = await serverQdrant.getEmbedding(query);
      
      if (!embeddingResponse || !embeddingResponse.embedding) {
        throw new Error('Failed to generate embedding for query');
      }
      
      // Search the strategic insights collection with type assertion
      const qdrant = serverQdrant as any;
      const searchResults = await qdrant.search(
        this.strategicInsightsCollection,
        embeddingResponse.embedding,
        limit
      );
      
      // Use proper type for results
      let results: any[] = searchResults;
      if (options?.tags && options.tags.length > 0) {
        results = results.filter((result: any) => {
          const insight = result.payload as StrategicInsight;
          return options.tags!.some(tag => insight.tags.includes(tag));
        });
      }
      
      // Extract the insights from the search results
      return results.map((result: any) => result.payload as StrategicInsight);
    } catch (error) {
      console.error('Error searching strategic insights:', error);
      return [];
    }
  }

  /**
   * Get the most recent strategic insights
   */
  async getRecentStrategicInsights(limit: number = 5): Promise<StrategicInsight[]> {
    try {
      if (!this.initialized) {
        throw new Error('Agent not initialized');
      }
      
      // Retrieve recent insights from the collection with type assertion
      const qdrant = serverQdrant as any;
      const recentInsights = await qdrant.getRecentPoints(
        this.strategicInsightsCollection,
        limit
      );
      
      return recentInsights.map((result: any) => result.payload as StrategicInsight);
    } catch (error) {
      console.error('Error getting recent strategic insights:', error);
      return [];
    }
  }

  /**
   * Get the tool creation system
   */
  getToolCreationSystem(): ToolCreationSystem {
    if (!this.toolCreationSystem) {
      throw new Error('Tool creation system not initialized');
    }
    return this.toolCreationSystem;
  }
  
  /**
   * Create a new tool from description
   */
  async createTool(description: string): Promise<any> {
    if (!this.toolCreationSystem) {
      throw new Error('Tool creation system not initialized');
    }
    
    try {
      return await this.toolCreationSystem.createToolFromDescription(description);
    } catch (error) {
      console.error('Error creating tool:', error);
      throw error;
    }
  }
  
  /**
   * Find tools for a specific task
   */
  async findToolsForTask(task: string): Promise<any[]> {
    if (!this.toolCreationSystem) {
      throw new Error('Tool creation system not initialized');
    }
    
    try {
      return await this.toolCreationSystem.getToolsForTask(task);
    } catch (error) {
      console.error('Error finding tools for task:', error);
      return [];
    }
  }
} 