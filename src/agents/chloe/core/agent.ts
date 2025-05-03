import { StateGraph, ChloeState, ChannelValue, Task, Memory, Reflection } from '../types/state';
import { Message as ChloeMessage } from '../types/message';
import { ChatOpenAI } from '@langchain/openai';
import { AgentConfig } from '../../../lib/shared';
import { SYSTEM_PROMPTS } from '../../../lib/shared';
import { AutonomySystem, AutonomyDiagnosis } from '../../../lib/shared/types/agent';
import { Notifier } from '../notifiers';
import { TaskLogger } from './taskLogger';
import { TaskStatus } from '../../../constants/task';
import { Message } from '../types/message';
import { RobustSafeguards } from './robustSafeguards';
import { 
  IAgent, 
  MessageOptions,
  StrategicInsight,
  PlanAndExecuteOptions,
  PlanAndExecuteResult,
  PlanStep,
  ScheduledTask,
  MemoryEntry as BaseMemoryEntry
} from '../../../lib/shared/types/agentTypes';
import { IManager } from '../../../lib/shared/types/manager'; // Assuming IManager exists
import { createChloeTools } from '../tools';
import { ImportanceLevel, MemorySource, MemoryType, ChloeMemoryType } from '../../../constants/memory';
import { PerformanceReviewType } from '../../../constants/reflection';

// Import all the managers
import { MemoryManager } from './memoryManager';
import { ToolManager } from './toolManager';
import { PlanningManager, ExecutionResult, PlanWithSteps } from './planningManager';
import { ReflectionManager } from './reflectionManager';
import { ThoughtManager } from './thoughtManager';
import { MarketScannerManager } from './marketScannerManager';
import { KnowledgeGapsManager } from './knowledgeGapsManager';
import { StateManager } from './stateManager';
import { ChloeMemory, MemoryEntry } from '../memory';
import { MarkdownWatcher } from '../knowledge/markdownWatcher';

// Import the markdown memory loader
import { loadAllMarkdownAsMemory } from '../knowledge/markdownMemoryLoader';

// Add the import for our markdown memory loader
import { initializeMarkdownMemory } from '../init/markdownLoader';
import { initializeAutonomy } from '../scheduler';
import { ChloeScheduler } from '../scheduler';

export interface ChloeAgentOptions {
  config?: Partial<AgentConfig>;
}

// Fix the ChloeAgent interface to match IAgent interface requirements
export interface ChloeAgent {
  initialize(): Promise<void>;
  getModel(): ChatOpenAI | null;
  getMemory(): ChloeMemory | null; 
  getTaskLogger(): TaskLogger | null;
  notify(message: string): void;
  planAndExecute(goal: string, options?: PlanAndExecuteOptions): Promise<PlanAndExecuteResult>;
  runDailyTasks(): Promise<void>;
  runWeeklyReflection(): Promise<string>; 
  getReflectionManager(): ReflectionManager | null;
  getPlanningManager(): PlanningManager | null;
  getKnowledgeGapsManager(): KnowledgeGapsManager | null;  
  getToolManager(): ToolManager | null;
  getTasksWithTag?(tag: string): Promise<any[]>;
  queueTask?(task: any): Promise<any>;
  scheduleTask?(task: any): void;
  getScheduler(): ChloeScheduler | null;
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
  private autonomySystem: AutonomySystem | null = null;
  private scheduler: ChloeScheduler | null = null;
  
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
  
  // New properties
  private markdownWatcher: MarkdownWatcher | null = null;
  
  // Thought and reflection caches to avoid redundant LLM calls
  private thoughtCache = new Map<string, {
    thought: string;
    timestamp: number;
    expiry: number;
  }>();
  
  private reflectionCache = new Map<string, {
    reflection: string;
    timestamp: number;
    expiry: number;
  }>();
  
  // Cache durations
  private readonly THOUGHT_CACHE_TTL = 60 * 60 * 1000; // 1 hour
  private readonly REFLECTION_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

  // Helper to create cache keys
  private createCacheKey(message: string, context: string = ''): string {
    // Normalize and concatenate with context if provided
    const normalizedMsg = message.trim().toLowerCase();
    if (context) {
      return `${normalizedMsg}:${context}`;
    }
    return normalizedMsg;
  }
  
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
        openAIApiKey: process.env.OPENAI_API_KEY,
      });
      
      // Make model available globally for TaskLogger to use
      global.model = this.model;
      
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
      
      // Initialize markdown memory loader
      try {
        console.log('Initializing markdown memory loader...');
        await initializeMarkdownMemory({ force: false });
        console.log('Markdown memory loader initialized');
      } catch (error) {
        console.warn('Failed to initialize markdown memory loader:', error);
        // Don't throw here - we want to continue even if markdown loading fails
      }
      
      // Get the base memory for initializing other managers
      const chloeMemory = this.memoryManager.getChloeMemory();
      if (!chloeMemory) {
        throw new Error('Failed to initialize ChloeMemory');
      }
      
      // Initialize scheduler with this agent instance
      this.scheduler = new ChloeScheduler(this);
      
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
      
      // Initialize markdown watcher
      try {
        this.markdownWatcher = new MarkdownWatcher({
          memory: this.memoryManager.getChloeMemory()!,
          logFunction: (message, data) => {
            this.taskLogger.logAction(`MarkdownWatcher: ${message}`, data);
          }
        });
        
        // Start watching markdown files
        await this.markdownWatcher.startWatching();
        this.taskLogger.logAction('Started markdown knowledge watcher');
      } catch (watcherError) {
        this.taskLogger.logAction('Error initializing markdown watcher', { error: String(watcherError) });
        // Continue initialization even if watcher fails
      }
      
      // Initialize autonomy system
      try {
        this.autonomySystem = initializeAutonomy(this);
        console.log('Autonomy system initialized successfully');
      } catch (error) {
        console.warn('Error initializing autonomy system:', error);
        // Non-critical error, continue initialization
      }
      
      // Initialize any content loaders (this is essentially a duplicate of what we did above)
      // But we'll keep it in case other loaders are added in the future,
      // and we'll make sure it doesn't duplicate our markdown loading
      // by not calling initializeMarkdownMemory() again
      
      this._initialized = true;
      console.log('ChloeAgent initialized successfully');
      return Promise.resolve();
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
        // Process directly with the model using the config system prompt
        if (!this.model) {
          throw new Error('Model not initialized');
        }
        
        const response = await this.model.invoke(
          `${this.config.systemPrompt}\n\nUser: ${message}`
        );
        
        // Add ReAct pattern implementation before finalizing the response
        const finalResponse = await this.applyReActPattern(response.content as string);
        
        return finalResponse;
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
      const memoryManager = this.getMemoryManager();
      const thoughtManager = this.getThoughtManager();
      const taskLogger = this.taskLogger;
      
      if (!memoryManager || !thoughtManager || !taskLogger) {
        throw new Error('Required managers not initialized');
      }
      
      // Log the received message
      const messageId = `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      taskLogger.logAction('Received message', {
        messageId,
        message: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
        userId: options.userId,
        hasAttachments: !!options.attachments
      });
      
      // Get the ChloeMemory instance
      const chloeMemory = memoryManager.getChloeMemory();
      if (!chloeMemory) {
        throw new Error('ChloeMemory not available');
      }
      
      // NEW: Check if this message is part of an ongoing conversation thread
      const threadAnalysis = await chloeMemory.identifyConversationThread(message);
      
      // Log if this is part of a conversation thread
      if (threadAnalysis.isPartOfThread) {
        taskLogger.logAction('Message is part of conversation thread', {
          threadId: threadAnalysis.threadId,
          threadTopic: threadAnalysis.threadTopic,
          threadImportance: threadAnalysis.threadImportance
        });
      }
      
      // Determine if this appears to be a structured, multi-section document
      const isStructuredSection = this.isStructuredSection(message);
      
      // Detect if this is part of onboarding/setup information that should continue
      const isMultiPartOnboarding = 
        threadAnalysis.isPartOfThread && 
        (message.includes('section') || 
         /part \d+/i.test(message) || 
         /\d+\.\s+[\w\s]+/.test(message) ||
         /onboarding/i.test(message) || 
         /setup/i.test(message));
      
      // Determine the appropriate importance level for this message based on content
      let messageImportance: ImportanceLevel;
      
      // If it's part of a thread, use the thread importance
      if (threadAnalysis.isPartOfThread) {
        messageImportance = threadAnalysis.threadImportance;
      } 
      // Otherwise use the dynamic content-based importance determination
      else {
        const msgTags = (options as any)?.tags || [];
        messageImportance = chloeMemory.determineMemoryImportance(message, {
          category: 'message',
          tags: msgTags
        });
      }
      
      // Store the user message in memory with the determined importance
      await memoryManager.addMemory(
        `USER MESSAGE [${new Date().toISOString()}]: ${message}`,
        ChloeMemoryType.MESSAGE,
        messageImportance,
        MemorySource.USER,
        `From user: ${options.userId}`,
        threadAnalysis.isPartOfThread ? ['thread:' + threadAnalysis.threadId, ...(threadAnalysis.threadTopic?.split(',') || [])] : undefined
      );
      
      // STEP 1: Generate initial thought about what the message is asking
      const initialThought = await this.generateThought(message);
      taskLogger.logAction('Generated initial thought', { 
        messageId, 
        thought: initialThought.substring(0, 100) + (initialThought.length > 100 ? '...' : '')
      });
      
      // Store the thought in memory with link to original message and thread info if applicable
      const thoughtTags = threadAnalysis.isPartOfThread 
        ? ['message_understanding', 'thread:' + threadAnalysis.threadId] 
        : ['message_understanding'];
      
      // Use at least medium importance for thoughts in thread context
      const thoughtImportance = threadAnalysis.isPartOfThread && String(threadAnalysis.threadImportance) === ImportanceLevel.HIGH
        ? 'high'
        : 'medium';
      
      // Add thought to memory - note: only pass 3 args as expected by the method signature
      await thoughtManager.logThought(
        initialThought, 
        'message_understanding',
        undefined
      );
      
      // STEP 2: Determine if reflection is needed and generate if necessary
      const shouldReflect = this.shouldTriggerReflection(message, initialThought);
      let reflection = null;
      
      if (shouldReflect) {
        reflection = await this.generateReflection(message, initialThought);
        taskLogger.logAction('Generated reflection', { 
          messageId, 
          reflection: reflection.substring(0, 100) + (reflection.length > 100 ? '...' : '')
        });
        
        // Store the reflection in memory with thread connection if applicable
        const reflectionTags = threadAnalysis.isPartOfThread 
          ? ['strategic_reflection', 'thread:' + threadAnalysis.threadId] 
          : ['strategic_reflection'];
        
        // Add reflection to memory - note: only pass 3 args as expected by the method signature
        await thoughtManager.logThought(
          reflection,
          'strategic_reflection',
          undefined
        );
      }
      
      // If this is a structured multi-part message, determine if we should prompt for next section
      // rather than giving a full response
      if (isStructuredSection && isMultiPartOnboarding) {
        // Check if this contains section identifiers suggesting more sections to come
        const hasNumericListItems = /\d+\.\s+[\w\s]+/.test(message);
        const mentionsMultipleItems = /sections|parts|multiple|continue/i.test(message);
        const hasSectionHeadings = message.includes('###') || message.includes('##');
        
        // If we detect this is part of a multi-section document
        if (hasNumericListItems || mentionsMultipleItems || hasSectionHeadings) {
          taskLogger.logAction('Detected multi-part structured information', {
            hasNumericListItems,
            mentionsMultipleItems,
            hasSectionHeadings
          });
          
          // Analyze the message to extract section identifiers and find what might be next
          const sectionMatch = message.match(/section (\d+)/i);
          const partMatch = message.match(/part (\d+)/i);
          const listItemMatch = message.match(/(\d+)\.\s+[\w\s]+/);
          
          // Extract current section number
          let currentSection = 1;
          if (sectionMatch) currentSection = parseInt(sectionMatch[1], 10);
          else if (partMatch) currentSection = parseInt(partMatch[1], 10);
          else if (listItemMatch) currentSection = parseInt(listItemMatch[1], 10);
          
          // Look for clues that there are more sections (e.g., numbering indicates more to come)
          // or text explicitly mentions more sections coming
          const moreExpected = 
            currentSection < 5 || // Assuming a reasonable number of total sections
            /continue|next|more|following/i.test(message) ||
            /to be continued/i.test(message);
            
          if (moreExpected) {
            // Generate acknowledgment and prompt for next section rather than detailed response
            taskLogger.logAction('Prompting for next section instead of full response', {
              currentSection,
              threadId: threadAnalysis.threadId
            });
            
            // If this is detected as a section of onboarding or setup information
            // that's likely to continue, provide a brief acknowledgment and prompt
            // for the next section rather than a detailed response.
            
            // Create simple acknowledgment response
            return `Thank you for sharing section ${currentSection} of your information. I've stored this securely in my memory as part of our conversation.
            
Please continue with the next section whenever you're ready, and I'll maintain the context between all parts. Once you've shared all the information you need to, let me know, and I'll provide a comprehensive response.`;
          }
        }
      }
      
      // STEP 3: Get relevant memory context using enhanced retrieval with reranking
      // If this is part of a thread, include thread-related memories
      const memorySearchOptions: {
        types?: string[];
        debug?: boolean;
        returnScores?: boolean;
        requireConfidence?: boolean;
        validateContent?: boolean;
        confidenceThreshold?: number;
      } = {
        debug: false,
        returnScores: true,
        requireConfidence: false,
        validateContent: true,
        confidenceThreshold: 70
      };
      
      // For thread-connected messages, prioritize thread-relevant memories
      if (threadAnalysis.isPartOfThread && threadAnalysis.relatedMemories.length > 0) {
        // Use memories from the thread analysis
        taskLogger.logAction('Using thread-connected memories', {
          threadId: threadAnalysis.threadId,
          memoryCount: threadAnalysis.relatedMemories.length
        });
      }
      
      // Determine if this is a company information query that needs specialized treatment
      const isCompanyInfoQuery = this.isCompanyInformationQuery(message);
      const isSpecificBrandQuery = message.toLowerCase().includes('brand') && 
        (message.toLowerCase().includes('identity') || 
         message.toLowerCase().includes('value') || 
         message.toLowerCase().includes('personality'));
      
      // For company information queries, use specific memory types and require confidence
      if (isCompanyInfoQuery) {
        memorySearchOptions.types = [
          ChloeMemoryType.STRATEGY, 
          ChloeMemoryType.PERSONA, 
          ChloeMemoryType.VISION
        ];
        memorySearchOptions.requireConfidence = true;
        
        taskLogger.logAction('Detected company information query', { 
          messageId,
          isSpecificBrandQuery
        });
      }
      
      // Enhance memory retrieval by including thread keywords as context tags
      const contextTags = threadAnalysis.isPartOfThread 
        ? threadAnalysis.threadTopic?.split(',').map(tag => tag.trim()) 
        : undefined;
      
      // Get memories with all the options we've configured
      const memories = await chloeMemory.getBestMemories(
        message,  // The query
        7,        // Number of results to return
        {
          types: memorySearchOptions.types,
          expandQuery: true,
          considerImportance: true,
          requireKeywords: isCompanyInfoQuery // Require keywords for more precision on company info
        }
      );
      
      // Create a memoryResult object compatible with the rest of the code
      const memoryResult = {
        entries: memories,
        hasConfidence: memories.length > 0,
        confidenceScore: memories.length > 0 ? 0.8 : 0.0,
        contentValid: true
      };
      
      // If we have thread-related memories, include them in the context
      if (threadAnalysis.isPartOfThread && threadAnalysis.relatedMemories.length > 0) {
        // Create a combined set of memory entries, prioritizing thread memories
        const combinedMemories = [
          ...threadAnalysis.relatedMemories.slice(0, 2), // Top thread memories
          ...memoryResult.entries,                       // Results from best memory search
        ];
        
        // Deduplicate using Set approach by ID
        const dedupedMemories: MemoryEntry[] = [];
        const seenIds = new Set<string>();
        
        for (const memory of combinedMemories) {
          if (!seenIds.has(memory.id)) {
            seenIds.add(memory.id);
            dedupedMemories.push(memory);
          }
        }
        
        // Replace the memory entries with our enhanced list
        memoryResult.entries = dedupedMemories.slice(0, 7); // Limit to a reasonable number
      }
      
      // Format memories into a context string
      const memoryContextString = Array.isArray(memoryResult.entries)
        ? memoryResult.entries.map((entry: MemoryEntry) => {
            if (typeof entry === 'object' && entry && 'content' in entry) {
              const score = entry.metadata?.rerankScore ? ` [relevance: ${entry.metadata.rerankScore}]` : '';
              const type = entry.type || entry.category || (entry.metadata?.type) || 'unknown';
              return `- [${type}]${score}: ${entry.content}`;
            }
            return '';
          }).join('\n')
        : '';
      
      // STEP 4: Build comprehensive prompt incorporating thoughts and reflections
      const promptWithReasoning = this.buildPromptFromMessageContext(
        message, 
        initialThought, 
        reflection, 
        memoryContextString,
        false
      );
      
      taskLogger.logAction('Built prompt with reasoning', {
        messageId,
        promptLength: promptWithReasoning.length,
        needsKnowledgeClarification: false
      });
      
      // If model is not initialized, throw an error
      if (!this.model) {
        throw new Error('Model not initialized');
      }
      
      // STEP 5: Generate a response with the enhanced prompt
      const response = await this.model.invoke(promptWithReasoning);
      const responseText = response.content.toString();
      
      // STEP 6: Store the reasoning trail and response in memory
      // Using standardized format for debugging and analytics
      const reasoningTrail = {
        messageId,
        message,
        initialThought,
        reflection: reflection || "No reflection was needed for this message.",
        hasConfidentMemories: memoryResult.hasConfidence,
        responseGenerated: responseText.substring(0, 100) + (responseText.length > 100 ? '...' : ''),
        timestamp: new Date().toISOString()
      };
      
      taskLogger.logAction('Completed reasoning trail', { reasoningTrail });
      
      // Store the complete reasoning trace for debugging/analytics
      await memoryManager.addMemory(
        `REASONING TRAIL [${new Date().toISOString()}]: ${JSON.stringify(reasoningTrail)}`,
        ChloeMemoryType.THOUGHT,
        ImportanceLevel.LOW,
        MemorySource.AGENT,
        'reasoning_trace'
      );
      
      // Store the response in memory with standardized format
      // "MESSAGE [timestamp]: content"
      await memoryManager.addMemory(
        `MESSAGE [${new Date().toISOString()}]: ${responseText}`,
        ChloeMemoryType.MESSAGE,
        ImportanceLevel.MEDIUM,
        MemorySource.AGENT,
        `Response to: ${message.substring(0, 50)}...`
      );
      
      // Add ReAct pattern implementation before finalizing the response
      const finalResponse = await this.applyReActPattern(responseText);
      
      return finalResponse;
    } catch (error) {
      console.error('Error processing message:', error);
      return `I'm sorry, I encountered an error while processing your message: ${error}`;
    }
  }
  
  /**
   * Generate an initial thought about what the message is asking
   * @param message The user's message
   * @returns A thought about the message
   */
  private async generateThought(message: string): Promise<string> {
    // Create a cache key
    const cacheKey = this.createCacheKey(message);
    
    // Check cache first
    const cachedThought = this.thoughtCache.get(cacheKey);
    if (cachedThought && cachedThought.expiry > Date.now()) {
      this.taskLogger?.logAction('Using cached thought', { 
        cacheAge: Math.round((Date.now() - cachedThought.timestamp) / 1000) + 's',
        message: message.substring(0, 50) + (message.length > 50 ? '...' : '')
      });
      return cachedThought.thought;
    }
    
    try {
      // Create a prompt for thought generation
      const prompt = `Consider this user message and think about what they are asking and your best approach to help them.
User message: "${message}"

Think step by step about:
1. What is the user really asking for?
2. What type of request is this (information, task, conversation, etc.)?
3. What information or approach would be most helpful?
4. Are there any ambiguities I should clarify?

Thought:`;
      
      if (!this.model) {
        throw new Error('Model not initialized for thought generation');
      }
      
      const thoughtResponse = await this.model.invoke(prompt);
      
      // Extract the thought
      const thought = thoughtResponse.content as string;
      
      // Cache the thought
      this.thoughtCache.set(cacheKey, {
        thought,
        timestamp: Date.now(),
        expiry: Date.now() + this.THOUGHT_CACHE_TTL
      });
      
      return thought;
    } catch (error) {
      console.error('Error generating thought:', error);
      return `I need to understand what the user is asking about: "${message.substring(0, 100)}..."`;
    }
  }
  
  /**
   * Determine if a reflection should be triggered based on the message and initial thought
   * @param message The user's message
   * @param initialThought The initial thought about the message
   * @returns True if reflection should be triggered
   */
  private shouldTriggerReflection(message: string, initialThought: string): boolean {
    // Skip reflection for simple, straightforward questions
    if (message.length < 25 && 
        (message.endsWith('?') || 
         message.toLowerCase().startsWith('what') || 
         message.toLowerCase().startsWith('who') || 
         message.toLowerCase().startsWith('when') || 
         message.toLowerCase().startsWith('where'))) {
      return false;
    }
    
    // Skip if it's a general knowledge question (already checked earlier)
    if (this.isGeneralKnowledgeQuestion(message)) {
      return false;
    }
    
    // Skip for simple greetings or acknowledgments
    if (/^(hi|hello|thanks|thank you|ok|yes|no|maybe|sure|great)$/i.test(message.trim())) {
      return false;
    }
    
    // For more complex messages, check for criteria that suggest reflection would be valuable
    const isComplexRequest = message.length > 100 || message.split(' ').length > 15;
    const mightBeMultistep = message.includes('and') || message.includes('then') || message.includes('after');
    const mightRequireStrategy = 
      initialThought.includes('strategy') || 
      initialThought.includes('plan') || 
      initialThought.includes('approach') ||
      message.includes('strategy') || 
      message.includes('plan');
    
    // Only trigger reflection if it's likely to add value
    return isComplexRequest || mightBeMultistep || mightRequireStrategy;
  }
  
  /**
   * Generate a deeper reflection on complex or strategic messages
   * @param message The user's message
   * @param initialThought The initial thought about the message
   * @returns A reflection on the message
   */
  private async generateReflection(message: string, initialThought: string): Promise<string> {
    // Create cache key that combines message and thought
    const cacheKey = this.createCacheKey(message, initialThought.substring(0, 100)); // Use first 100 chars of thought as context
    
    // Check cache first
    const cachedReflection = this.reflectionCache.get(cacheKey);
    if (cachedReflection && cachedReflection.expiry > Date.now()) {
      this.taskLogger?.logAction('Using cached reflection', { 
        cacheAge: Math.round((Date.now() - cachedReflection.timestamp) / 1000) + 's',
        message: message.substring(0, 50) + (message.length > 50 ? '...' : '')
      });
      return cachedReflection.reflection;
    }
    
    try {
      const prompt = `Given this user message:
"${message}"

And your initial thought about it:
${initialThought}

Take a moment to reflect more deeply. Consider:
1. What broader context or information might be relevant here?
2. Are there strategic considerations I should keep in mind?
3. What's the user's likely goal beyond just this immediate question?
4. Are there any potential misunderstandings or assumptions I should be careful about?

Strategic reflection:`;
      
      if (!this.model) {
        throw new Error('Model not initialized for reflection generation');
      }
      
      const reflectionResponse = await this.model.invoke(prompt);
      
      // Extract reflection
      const reflection = reflectionResponse.content as string;
      
      // Cache the reflection
      this.reflectionCache.set(cacheKey, {
        reflection,
        timestamp: Date.now(),
        expiry: Date.now() + this.REFLECTION_CACHE_TTL
      });
      
      return reflection;
    } catch (error) {
      console.error('Error generating reflection:', error);
      return `I should consider the broader context of the user's request about "${message.substring(0, 50)}..."`;
    }
  }
  
  /**
   * Build a comprehensive prompt incorporating thoughts and reflections
   * @param message The user's message
   * @param initialThought The initial thought about the message
   * @param reflection The reflection on the message (if any)
   * @param memoryContextString Relevant memory context
   * @param needsKnowledgeClarification Whether we need to inform the model we lack knowledge
   * @returns A comprehensive prompt
   */
  private buildPromptFromMessageContext(
    message: string, 
    initialThought: string, 
    reflection: string | null, 
    memoryContextString: string,
    needsKnowledgeClarification: boolean = false
  ): string {
    // Create a context-aware prompt
    let contextPrompt = `You are Chloe, a Chief Marketing Officer AI.

${this.config.systemPrompt}

Here's relevant context from your memory that might help with this request:
---
${memoryContextString}
---

BRAND IDENTITY REMINDER: Always carefully consider Claro's brand identity information when responding. This identity information is stored in your memory with CRITICAL importance and should be incorporated into all responses. If you're unsure, say you don't have complete information rather than inventing brand details.

IMPORTANT: Pay special attention to any items marked with HIGH or CRITICAL importance. These contain essential information that should be prioritized and remembered in your responses.

## YOUR REASONING PROCESS

Initial thought about the user's message:
${initialThought}

${reflection ? `Deeper reflection on strategic implications:
${reflection}

` : ''}
Based on this careful analysis, formulate a thoughtful, actionable response that directly addresses the user's needs while considering the strategic marketing context.

IMPORTANT: When users ask you to create Coda documents, act as if you have the ability to create them directly.
Generate a detailed response as if you have created the document they requested, including a fictional document ID and link.

User message: ${message}

${needsKnowledgeClarification ? `
I don't have enough information about Claro's brand identity. I should ask for clarification.

` : ''}`;

    return contextPrompt;
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
   * Determines if a query is asking about company information
   * @param query The user's query to evaluate
   * @returns True if this is a company information query
   */
  private isCompanyInformationQuery(query: string): boolean {
    const companyInfoPatterns = [
      /what (is|are) .*(our|claro'?s|the company'?s) (mission|vision|values|purpose|brand|identity)/i,
      /tell me about .*(our|claro'?s|the company'?s) (mission|vision|values|purpose|brand|identity)/i,
      /describe .*(our|claro'?s|the company'?s) (mission|vision|values|purpose|brand|identity)/i,
      /(mission|vision) statement/i,
      /company (mission|vision|values|purpose|brand|identity)/i,
      /brand (identity|values|personality|tone|voice)/i,
      /what.+company.+(stand|aim).+for/i,
      /what.+we.+(stand|aim).+for/i,
      // Add more patterns to better detect brand identity questions
      /(already|previously) provided .*(brand|identity|information)/i,
      /make (information|it|data|brand) (stick|persist|remember)/i,
      /brand information/i,
      /target audience/i,
      /unique value proposition/i,
      /brand (personality|story|guidelines)/i,
      /visual (identity|style)/i,
      /verbal (identity|style)/i,
      /tone of voice/i,
      /company (information|details)/i,
      /claro('s)? (information|details)/i
    ];
    
    return companyInfoPatterns.some(pattern => pattern.test(query));
  }
  
  /**
   * Run daily tasks as part of the autonomy system
   */
  async runDailyTasks(): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Use getters with null checks
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
      
      // Each variable has been checked for null above, so we can safely use them
      await marketScannerManager.summarizeTrends();
      await planningManager.runDailyTasks();
      await reflectionManager.runPerformanceReview(PerformanceReviewType.DAILY);
      
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
      
      const reflectionManager = this.getReflectionManager();
      
      if (!reflectionManager) {
        throw new Error('Reflection manager not initialized');
      }
      
      // We've checked that reflectionManager is not null
      const reflection = await reflectionManager.runWeeklyReflection();
      
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
      
      const reflectionManager = this.getReflectionManager();
      
      if (!reflectionManager) {
        throw new Error('Reflection manager not initialized');
      }
      
      // reflectionManager is not null at this point
      return await reflectionManager.reflect(question);
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
      
      const toolManager = this.getToolManager();
      const memoryManager = this.getMemoryManager();
      const reflectionManager = this.getReflectionManager();
      
      if (!toolManager || !memoryManager || !reflectionManager) {
        throw new Error('Required managers not initialized');
      }
      
      // From here on, all managers are guaranteed to be non-null
      
      // Get the last day's activities from memory
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const chloeMemory = memoryManager.getChloeMemory();
      if (!chloeMemory) {
        throw new Error('ChloeMemory not available');
      }
      const memories = await chloeMemory.getMemoriesByDateRange(
        MemoryType.MESSAGE,
        oneDayAgo,
        new Date()
      );
      
      // Get recent strategic insights
      const strategicInsights = await memoryManager.getRecentStrategicInsights(3);
      
      // Format the strategic insights
      const insightsText = strategicInsights.length > 0
        ? `\n\nRecent Strategic Insights:\n${strategicInsights.map((insight: StrategicInsight) => 
            `• ${insight.insight} [${insight.category}]`).join('\n')}`
        : 'No recent strategic insights found.';
      
      // Format the daily summary
      const dailySummary = `Daily Summary\\n\\n${memories ? memories.map((memory: MemoryEntry) => 
        `• ${memory.content} [Type: ${memory.type}]`).join('\\n') : 'No activities recorded.'}\\n\\n${insightsText}`;
      
      // Get the notify tool 
      const notifyTool = await toolManager.getTool('notify_discord');

      // Send the daily summary to Discord
      if (notifyTool && 'execute' in notifyTool && typeof notifyTool.execute === 'function') {
        await notifyTool.execute({ message: dailySummary });
      } else {
        console.warn('notify_discord tool not available or cannot be executed.');
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
      
      // Stop the markdown watcher if it's running
      if (this.markdownWatcher) {
        try {
          await this.markdownWatcher.stopWatching();
          this.taskLogger.logAction('Stopped markdown knowledge watcher');
        } catch (error) {
          this.taskLogger.logAction('Error stopping markdown watcher', { error: String(error) });
        }
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
    return this.memoryManager || null;
  }
  
  /**
   * Get the tool manager
   */
  getToolManager(): ToolManager | null {
    return this.toolManager || null;
  }
  
  /**
   * Get the planning manager
   */
  getPlanningManager(): PlanningManager | null {
    return this.planningManager || null;
  }
  
  /**
   * Get the reflection manager
   */
  getReflectionManager(): ReflectionManager | null {
    return this.reflectionManager || null;
  }
  
  /**
   * Get the knowledge gaps manager
   */
  getKnowledgeGapsManager(): KnowledgeGapsManager | null {
    return this.knowledgeGapsManager || null;
  }
  
  /**
   * Get the thought manager
   */
  getThoughtManager(): ThoughtManager | null {
    return this.thoughtManager || null;
  }
  
  /**
   * Get the market scanner manager
   */
  getMarketScannerManager(): MarketScannerManager | null {
    return this.marketScannerManager || null;
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
    try {
      // Import the ChloeGraph and createChloeGraph functions from the graph module
      const { createChloeGraph } = await import('../graph');
      
      // Get required dependencies
      const model = this.getModel();
      const memory = this.getChloeMemory();
      const taskLogger = this.getTaskLogger();
      
      if (!model || !memory || !taskLogger) {
        throw new Error('Required dependencies not available');
      }
      
      // Log dry run mode if enabled
      const isDryRun = options?.dryRun === true;
      if (isDryRun) {
        taskLogger.logAction('Starting planning in DRY RUN mode', { goal });
        console.log('🔍 DRY RUN MODE: Plan will be created but actions will be simulated');
      }
      
      // Create tool instances with proper typing
      const chloeTools = createChloeTools(memory, model);
      
      // Import StructuredTool
      const { StructuredTool } = await import('@langchain/core/tools');
      const { z } = await import('zod');
      
      // Convert SimpleTool to StructuredTool
      const structuredTools: Record<string, any> = {};
      
      // Map of tool names to schemas
      const toolSchemas: Record<string, any> = {
        'searchMemory': z.object({ query: z.string() }),
        'summarizeRecentActivity': z.object({ timeframe: z.string() }),
        'proposeContentIdeas': z.object({ topic: z.string() }),
        'reflectOnPerformance': z.object({ subject: z.string() }),
        'notifyDiscord': z.object({ message: z.string() }),
        'marketScan': z.object({ industry: z.string() }),
        'intentRouter': z.object({ message: z.string() }),
        'codaDocument': z.object({ title: z.string() })
      };
      
      // Convert each tool
      for (const [name, tool] of Object.entries(chloeTools)) {
        if (tool && typeof tool._call === 'function') {
          const internalName = name.toLowerCase();
          const schema = toolSchemas[name] || z.object({ input: z.string() });
          
          structuredTools[internalName] = new StructuredTool({
            name: internalName,
            description: tool.description || `Tool for ${name}`,
            schema: schema,
            func: async (input: any) => {
              // In dry run mode, simulate tool execution instead of actually running it
              if (isDryRun) {
                const inputStr = typeof input === 'string' ? input : 
                  Object.values(input)[0] as string;
                
                // Log the simulated action
                taskLogger.logAction('SIMULATED TOOL EXECUTION', { 
                  tool: internalName, 
                  input: inputStr.substring(0, 100) + (inputStr.length > 100 ? '...' : '')
                });
                
                // Return a simulated response
                return `[DRY RUN] Simulated execution of ${internalName} tool with input: ${
                  inputStr.substring(0, 50)}${inputStr.length > 50 ? '...' : ''}`;
              }
              
              // Normal execution - call the original tool method with the appropriate parameter
              const inputStr = typeof input === 'string' ? input : 
                Object.values(input)[0] as string;
              return await tool._call(inputStr);
            }
          });
        }
      }
      
      // Create a ChloeGraph instance
      const graph = createChloeGraph({
        model,
        memory,
        taskLogger,
        tools: structuredTools,
        dryRun: isDryRun
      });
      
      // Execute the graph
      const result = await graph.execute(goal);
      
      // Helper function to recursively convert sub-goals to plan steps with hierarchy
      const convertSubGoalsToPlanSteps = (subGoals: any[]): any[] => {
        return subGoals.map(sg => {
          // Convert the current sub-goal to a plan step
          const planStep: any = {
            id: sg.id,
            description: sg.description,
            status: sg.status === 'completed' ? 'completed' : 
                   sg.status === 'failed' ? 'failed' : 
                   sg.status === 'in_progress' ? 'in_progress' : 'pending',
            parentId: sg.parentId,
            depth: sg.depth
          };
          
          // Add result if available
          if (sg.result) {
            planStep.result = {
              success: sg.status === 'completed',
              response: sg.result
            };
          }
          
          // Convert children if they exist
          if (sg.children && sg.children.length > 0) {
            planStep.children = convertSubGoalsToPlanSteps(sg.children);
          }
          
          return planStep;
        });
      };
      
      // Convert to the expected PlanAndExecuteResult format
      return {
        success: !result.error,
        message: result.finalResult || result.error || 'Task execution complete',
        plan: {
          goal: goal,
          steps: result.task?.subGoals ? convertSubGoalsToPlanSteps(result.task.subGoals) : [],
          reasoning: result.task?.reasoning || "Planning execution completed"
        },
        error: result.error
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

  /**
   * Plan and execute a task using the advanced LangGraph planning system
   */
  async planAndExecuteWithGraph(goal: string, options?: { trace?: boolean }): Promise<PlanAndExecuteResult> {
    // Simply call the planAndExecute method as we've migrated to the new implementation
    return this.planAndExecute(goal, { 
      goalPrompt: goal,
      ...(options?.trace ? { trace: options.trace } : {})
    });
  }

  /**
   * Get the autonomy system
   */
  async getAutonomySystem(): Promise<AutonomySystem | null> {
    // This is a simplified implementation to satisfy the interface
    return null;
  }

  /**
   * Summarize a conversation with optional parameters
   */
  async summarizeConversation(options: { maxEntries?: number; maxLength?: number } = {}): Promise<string | null> {
    // This is a simplified implementation to satisfy the interface
    return null;
  }

  /**
   * Applies the ReAct (Reasoning and Acting) pattern to process the response
   * This ensures tools are explicitly invoked before being mentioned in responses
   */
  private async applyReActPattern(initialResponse: string): Promise<string> {
    // Check if the response mentions creating or using tools without explicit invocation
    const toolActionPatterns = [
      { 
        pattern: /I('ve| have) created a (Coda|coda) document/i, 
        tool: 'codaDocument',
        action: 'create' 
      },
      { 
        pattern: /view (in|on) (Coda|coda)/i, 
        tool: 'codaDocument',
        action: 'create' 
      },
      { 
        pattern: /document ID: ([a-zA-Z0-9_-]+)/i, 
        tool: 'codaDocument',
        action: 'create' 
      },
      // Add more patterns for other tool actions that might be hallucinated
    ];

    // Check if any tool action patterns match the response
    let needsReActProcessing = false;
    let matchedPattern = null;
    
    for (const pattern of toolActionPatterns) {
      if (pattern.pattern.test(initialResponse)) {
        needsReActProcessing = true;
        matchedPattern = pattern;
        break;
      }
    }

    // If no patterns match, return the original response
    if (!needsReActProcessing) {
      return initialResponse;
    }

    // Log that we're applying ReAct processing
    if (matchedPattern) {
      console.log(`ReAct: Detected potential tool hallucination: ${matchedPattern.tool} - ${matchedPattern.action}`);
    } else {
      console.log(`ReAct: Detected potential tool hallucination but couldn't identify specific pattern`);
    }

    // Apply the ReAct pattern - make the agent think step by step
    const reactPrompt = `
    I notice you mentioned using a tool or creating a resource in your response, but you didn't explicitly invoke the tool first. 

    Let's think step by step:
    1. What tool do you need to use? (e.g., codaDocument, webSearch, etc.)
    2. What parameters does the tool need?
    3. Invoke the tool explicitly using the format: 
       Thought: I need to [reason for using tool]
       Action: [tool_name]
       Action Input: [parameters in JSON format]
    4. Wait for the tool result before mentioning it in your response.

    Original response:
    ${initialResponse}

    Please revise your response to either:
    a) Remove claims about actions you haven't taken yet, or
    b) Explicitly state that you can perform these actions if requested

    Revised response:
    `;

    // Check if model is null before invoking
    if (!this.model) {
      console.warn('ReAct: Model is not available, returning original response');
      return initialResponse;
    }
    
    // Get the revised response
    const modelResponse = await this.model.invoke(reactPrompt);
    
    // Handle different response formats from the model
    let revisedResponse = '';
    if (typeof modelResponse === 'string') {
      revisedResponse = modelResponse;
    } else if (modelResponse && typeof modelResponse === 'object' && 'content' in modelResponse) {
      revisedResponse = modelResponse.content as string;
    } else {
      // If we can't get a valid response, return the original to avoid errors
      console.warn('ReAct: Unexpected response format from model, returning original');
      return initialResponse;
    }
    
    // Clean up any remaining ReAct format elements
    const cleanedResponse = revisedResponse
      .replace(/^Thought:.*$/gm, '')
      .replace(/^Action:.*$/gm, '')
      .replace(/^Action Input:.*$/gm, '')
      .replace(/^Observation:.*$/gm, '')
      .trim();

    return cleanedResponse;
  }

  /**
   * Detects if a message appears to be a structured section (like onboarding info)
   * that's likely part of a multi-section document
   * @param message The message to analyze
   * @returns True if this appears to be a structured section
   */
  private isStructuredSection(message: string): boolean {
    // Check for structural indicators
    const hasMarkdownHeadings = message.includes('#') && Boolean(message.match(/##+\s/));
    const hasNumberedSections = Boolean(message.match(/\d+\.\s+[\w\s]+/));
    const hasStructuredKeywords = /section|part|continue|overview|details|setup|onboarding/i.test(message);
    const hasBulletPoints = Boolean(message.match(/[•\-\*]\s+[\w\s]+/));
    
    // Check for formatting that suggests a document section
    const hasNeatFormatting = 
      message.includes('\n\n') && // Multiple paragraph breaks
      message.length > 300;      // Reasonably substantive content
    
    return (hasMarkdownHeadings || hasNumberedSections || hasBulletPoints) && 
           (hasStructuredKeywords || hasNeatFormatting);
  }

  /**
   * Force reload all markdown files into memory
   * This is useful when files have been updated and we want to refresh our knowledge
   * @returns A promise resolving to a summary of what was loaded
   */
  async reloadMarkdownFiles(): Promise<{ 
    success: boolean; 
    message: string;
    stats?: {
      filesProcessed: number;
      entriesAdded: number;
      filesSkipped: number;
      duplicatesSkipped: number;
    }
  }> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      this.taskLogger?.logAction('Forcing reload of all markdown files', {
        timestamp: new Date().toISOString()
      });
      
      // Import the loader dynamically to avoid circular dependencies
      const { loadAllMarkdownAsMemory } = await import('../knowledge/markdownMemoryLoader');
      
      // Force reload all markdown files
      const stats = await loadAllMarkdownAsMemory(['docs/', 'knowledge/'], {
        force: true, // Force reload all files
        checkForDuplicates: false // Skip duplicate checking since we're forcing reload
      });
      
      this.taskLogger?.logAction('Markdown files reloaded successfully', {
        filesProcessed: stats.filesProcessed,
        entriesAdded: stats.entriesAdded,
        filesSkipped: stats.filesSkipped
      });
      
      return {
        success: true,
        message: `Successfully reloaded markdown files: Processed ${stats.filesProcessed}, Added ${stats.entriesAdded} entries, Skipped ${stats.filesSkipped} files`,
        stats
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.taskLogger?.logAction('Error reloading markdown files', { error: errorMessage });
      
      return {
        success: false,
        message: `Error reloading markdown files: ${errorMessage}`
      };
    }
  }

  /**
   * Gets the scheduler for this agent
   * @returns The ChloeScheduler instance or null if not available
   */
  getScheduler(): ChloeScheduler | null {
    return this.scheduler;
  }

  /**
   * Analyze causal relationships within a specific timeframe
   * Used to identify and establish cause-effect relationships between events in memory
   * 
   * @param options Configuration options for the analysis
   * @returns Summary of identified causal relationships
   */
  async analyzeCausalRelationships(options: {
    timeframe?: { start: Date; end: Date };
    maxRelationships?: number;
    minConfidence?: number;
    focusArea?: string;
  } = {}): Promise<{
    relationships: Array<{
      cause: { id: string; content: string };
      effect: { id: string; content: string };
      description: string;
      confidence: number;
      relationshipType: string;
      reflectionId?: string;
    }>;
    summary: string;
  }> {
    const reflectionManager = this.getReflectionManager();
    
    if (!reflectionManager) {
      return {
        relationships: [],
        summary: "Causal analysis unavailable: reflection manager not initialized."
      };
    }
    
    try {
      // Delegate to the reflection manager's causal analysis
      return await reflectionManager.analyzeCausalRelationships(options);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error analyzing causal relationships:", errorMessage);
      
      return {
        relationships: [],
        summary: `Error analyzing causal relationships: ${errorMessage}`
      };
    }
  }

  /**
   * Trace a causal chain starting from a specific memory
   * 
   * @param memoryId ID of the memory to trace from
   * @param options Configuration options for the trace
   * @returns Visualization and analysis of the causal chain
   */
  async traceCausalChain(memoryId: string, options: {
    maxDepth?: number;
    direction?: 'forward' | 'backward' | 'both';
    analyze?: boolean;
  } = {}): Promise<{
    origin: { id: string; content: string } | null;
    chain: string;
    analysis: string;
  }> {
    const reflectionManager = this.getReflectionManager();
    
    if (!reflectionManager) {
      return {
        origin: null,
        chain: "Causal chain tracing unavailable: reflection manager not initialized.",
        analysis: "Analysis unavailable: reflection manager not initialized."
      };
    }
    
    try {
      // Delegate to the reflection manager's causal chain tracing
      return await reflectionManager.traceCausalChain(memoryId, options);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error tracing causal chain:", errorMessage);
      
      return {
        origin: null,
        chain: `Error tracing causal chain: ${errorMessage}`,
        analysis: "Analysis unavailable due to error in causal chain tracing."
      };
    }
  }

  /**
   * Run an enhanced weekly reflection that includes causal relationship analysis
   */
  async runEnhancedWeeklyReflection(): Promise<string> {
    const reflectionManager = this.getReflectionManager();
    
    if (!reflectionManager) {
      return "Enhanced weekly reflection unavailable: reflection manager not initialized.";
    }
    
    try {
      // Check if the enhanced reflection method is available
      if (typeof reflectionManager.runEnhancedWeeklyReflection === 'function') {
        return await reflectionManager.runEnhancedWeeklyReflection();
      } else {
        // Fallback to standard reflection
        return await this.runWeeklyReflection();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error running enhanced weekly reflection:", errorMessage);
      return `Error generating enhanced weekly reflection: ${errorMessage}`;
    }
  }
}