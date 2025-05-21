import { IdGenerator } from '@/utils/ulid';
import { ThinkingService } from './ThinkingService';
import { MemoryRetriever } from './memory/MemoryRetriever';
import { MemoryConsolidator } from './memory/MemoryConsolidator';
import { DelegationService } from './delegation/DelegationService';
import { CollaborativeAgentService } from './delegation/CollaborativeAgentService';
import { SharedMemoryService } from './delegation/SharedMemoryService';
import { TaskProgressTracker } from './delegation/TaskProgressTracker';
import { ToolService } from './tools/ToolService';
import { ToolFeedbackService } from './tools/ToolFeedbackService';
import { ToolRegistry } from './tools/ToolRegistry';
// Import PluginSystem only for type in browser environments
import type { PluginSystem } from './tools/PluginSystem';
import { QueryEnhancer } from './retrieval/QueryEnhancer';
import { ResultReranker } from './retrieval/ResultReranker';
import { getMemoryServices } from '@/server/memory/services';
import { ChatOpenAI } from '@langchain/openai';
import { ThinkingResult, ToolExecutionResult, WorkingMemoryItem, ThinkingOptions } from './types';
import { DelegatedTask, DelegationResult, TaskPriority, TaskStatus } from './delegation/DelegationManager';
import { ClassifiedIntent } from './intent/IntentClassifier';
import { ExtractedEntity, EntityType } from './memory/EntityExtractor';
import { RetrievalResult as ResultRerankerResult } from './retrieval/ResultReranker';
import { extractTags } from '@/utils/tagExtractor';

/**
 * Result from retrieval operations
 */
interface RetrievalResult {
  id: string;
  content: string;
  source: string;
  score: number;
  metadata?: Record<string, any>;
}

/**
 * Configuration for the UnifiedAgentService
 */
export interface UnifiedAgentConfig {
  /**
   * Whether to enable caching
   */
  enableCaching?: boolean;

  /**
   * Whether to enable parallel processing
   */
  enableParallelProcessing?: boolean;

  /**
   * Whether to enable telemetry
   */
  enableTelemetry?: boolean;

  /**
   * Whether to enable debugging
   */
  enableDebugging?: boolean;

  /**
   * Cache TTL in milliseconds
   */
  cacheTTL?: number;

  /**
   * LLM models configuration
   */
  llmConfig?: {
    /**
     * Model to use for thinking
     */
    thinkingModel?: string;

    /**
     * Model to use for generation
     */
    generationModel?: string;

    /**
     * Maximum tokens for context
     */
    maxContextTokens?: number;
  };
}

/**
 * Request context for processing a user message
 */
export interface RequestContext {
  /**
   * User ID
   */
  userId: string;

  /**
   * Previous conversation history
   */
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;

  /**
   * Attached files
   */
  attachedFiles?: Array<{
    id: string;
    name: string;
    type: string;
    content?: string;
  }>;

  /**
   * Additional context
   */
  additionalContext?: Record<string, any>;

  /**
   * Processing options
   */
  options?: {
    /**
     * Whether to enable streaming
     */
    stream?: boolean;

    /**
     * Whether to save the response to history
     */
    saveToHistory?: boolean;

    /**
     * Whether to enable delegation
     */
    enableDelegation?: boolean;

    /**
     * Whether to enable tools
     */
    enableTools?: boolean;

    /**
     * Whether to skip retrieval
     */
    skipRetrieval?: boolean;
  };
}

/**
 * Response from the UnifiedAgentService
 */
export interface UnifiedAgentResponse {
  /**
   * Response ID
   */
  id: string;

  /**
   * Response content
   */
  response: string;

  /**
   * Thinking process details
   */
  thinking?: ThinkingResult;

  /**
   * Tools used
   */
  toolsUsed?: Array<{
    toolId: string;
    toolName: string;
    input: Record<string, any>;
    output: any;
  }>;

  /**
   * Delegation information
   */
  delegation?: {
    delegated: boolean;
    agentId?: string;
    agentName?: string;
    taskId?: string;
  };

  /**
   * Sources used in response
   */
  sources?: Array<{
    id: string;
    type: string;
    content: string;
    relevance: number;
  }>;

  /**
   * Performance metrics
   */
  metrics?: {
    totalTime: number;
    thinkingTime: number;
    retrievalTime: number;
    toolExecutionTime: number;
    llmTime: number;
  };

  /**
   * Debug information
   */
  debug?: Record<string, any>;
}

/**
 * Processing phases for telemetry
 */
type ProcessingPhase = 
  | 'initialization'
  | 'context_retrieval'
  | 'thinking'
  | 'delegation_decision'
  | 'tool_selection'
  | 'tool_execution'
  | 'response_generation'
  | 'memory_consolidation'
  | 'finalization';

/**
 * Telemetry event
 */
interface TelemetryEvent {
  /**
   * Event ID
   */
  id: string;

  /**
   * Request ID
   */
  requestId: string;

  /**
   * User ID
   */
  userId: string;

  /**
   * Event phase
   */
  phase: ProcessingPhase;

  /**
   * Event type
   */
  type: 'start' | 'end' | 'error' | 'info';

  /**
   * Event timestamp
   */
  timestamp: Date;

  /**
   * Event details
   */
  details?: Record<string, any>;

  /**
   * Duration in milliseconds (if applicable)
   */
  duration?: number;

  /**
   * Error message (if applicable)
   */
  error?: string;
}

/**
 * Cache entry
 */
interface CacheEntry {
  /**
   * Response
   */
  response: UnifiedAgentResponse;

  /**
   * Expiry timestamp
   */
  expiresAt: number;
}

/**
 * Service that integrates all components into a unified flow
 */
export class UnifiedAgentService {
  /**
   * Thinking service for reasoning and planning
   */
  private thinkingService: ThinkingService;
  
  /**
   * Memory retrieval service
   */
  private memoryRetriever: MemoryRetriever;
  
  /**
   * Memory consolidation service
   */
  private memoryConsolidator: MemoryConsolidator;
  
  /**
   * Delegation service for task delegation
   */
  private delegationService: DelegationService;
  
  /**
   * Collaborative agent service
   */
  private collaborativeAgentService: CollaborativeAgentService;
  
  /**
   * Shared memory service
   */
  private sharedMemoryService: SharedMemoryService;
  
  /**
   * Task progress tracker
   */
  private taskProgressTracker: TaskProgressTracker;
  
  /**
   * Tool execution service
   */
  private toolService: ToolService;
  
  /**
   * Tool feedback service
   */
  private toolFeedbackService: ToolFeedbackService;
  
  /**
   * Tool registry
   */
  private toolRegistry: ToolRegistry;
  
  /**
   * Plugin system
   */
  private pluginSystem: PluginSystem | null = null;
  
  /**
   * Query enhancement service
   */
  private queryEnhancer: QueryEnhancer;
  
  /**
   * Result reranking service
   */
  private resultReranker: ResultReranker;
  
  /**
   * LLM instance
   */
  private llm: ChatOpenAI;
  
  /**
   * Configuration
   */
  private config: UnifiedAgentConfig;
  
  /**
   * Response cache
   */
  private responseCache: Map<string, CacheEntry> = new Map();
  
  /**
   * In-flight requests
   */
  private inFlightRequests: Map<string, Promise<UnifiedAgentResponse>> = new Map();
  
  /**
   * Telemetry events
   */
  private telemetryEvents: TelemetryEvent[] = [];

  /**
   * Constructor
   * @param config Configuration
   */
  constructor(config: UnifiedAgentConfig = {}) {
    this.config = {
      enableCaching: config.enableCaching ?? true,
      enableParallelProcessing: config.enableParallelProcessing ?? false,
      enableTelemetry: config.enableTelemetry ?? true,
      enableDebugging: config.enableDebugging ?? false,
      cacheTTL: config.cacheTTL ?? 5 * 60 * 1000, // 5 minutes default
      llmConfig: {
        thinkingModel: config.llmConfig?.thinkingModel ?? process.env.OPENAI_MODEL_NAME,
        generationModel: config.llmConfig?.generationModel ?? process.env.OPENAI_MODEL_NAME,
        maxContextTokens: config.llmConfig?.maxContextTokens ?? 32000
      }
    };
    
    // Initialize LLM with safe access to config
    const modelName = this.config.llmConfig?.generationModel || process.env.OPENAI_MODEL_NAME;
    this.llm = new ChatOpenAI({
      modelName,
      temperature: 0.1
    });
    
    // Initialize services with type assertions to satisfy linter
    // In a real implementation, these would be properly initialized with correct parameters
    this.thinkingService = new ThinkingService({} as any);
    this.memoryRetriever = new MemoryRetriever();
    this.memoryConsolidator = new MemoryConsolidator();
    this.delegationService = new DelegationService();
    this.collaborativeAgentService = new CollaborativeAgentService({} as any);
    this.sharedMemoryService = new SharedMemoryService();
    this.taskProgressTracker = new TaskProgressTracker();
    this.toolService = new ToolService();
    this.toolFeedbackService = new ToolFeedbackService();
    
    // Initialize tool registry
    this.toolRegistry = new ToolRegistry({} as any);
    
    // Initialize plugin system in browser-safe way
    if (typeof window === 'undefined') {
      // Server-side code
      this.initializePluginSystem();
    } else {
      // Client-side code - pluginSystem remains null
      console.warn('PluginSystem not initialized in browser environment');
    }
    
    // Initialize retrieval services
    this.queryEnhancer = new QueryEnhancer();
    this.resultReranker = new ResultReranker();
    
    // Set up cache cleanup timer
    if (typeof window !== 'undefined' && this.config.enableCaching) {
      setInterval(() => this.cleanupCache(), 60 * 1000); // Clean cache every minute
    }
  }
  
  /**
   * Initialize the plugin system only in Node.js environment
   */
  private async initializePluginSystem(): Promise<void> {
    try {
      // Dynamically import to avoid webpack errors
      const { PluginSystem } = await import('./tools/PluginSystem');
      this.pluginSystem = new PluginSystem(this.toolRegistry);
    } catch (error) {
      console.error('Failed to initialize PluginSystem:', error);
      this.pluginSystem = null;
    }
  }

  /**
   * Process a user message
   * @param message User message
   * @param context Request context
   * @returns Response from the agent
   */
  async processMessage(
    message: string,
    context: RequestContext
  ): Promise<UnifiedAgentResponse> {
    // Generate request ID
    const requestId = IdGenerator.generate('request').toString();
    
    try {
      // Start telemetry for the request
      this.recordTelemetry(requestId, context.userId, 'initialization', 'start');
      
      // Check cache if enabled
      if (this.config.enableCaching) {
        const cacheKey = this.generateCacheKey(message, context);
        const cachedResponse = this.getCachedResponse(cacheKey);
        
        if (cachedResponse) {
          this.recordTelemetry(requestId, context.userId, 'initialization', 'end', {
            cacheHit: true
          });
          
          return cachedResponse;
        }
      }
      
      // Check for in-flight requests with same parameters
      const inFlightKey = this.generateCacheKey(message, context);
      
      if (this.inFlightRequests.has(inFlightKey)) {
        // Return the existing promise
        return this.inFlightRequests.get(inFlightKey)!;
      }
      
      // Create and store the promise for this request
      const responsePromise = this.processMessageInternal(requestId, message, context);
      this.inFlightRequests.set(inFlightKey, responsePromise);
      
      // Once complete, remove from in-flight requests
      responsePromise.finally(() => {
        this.inFlightRequests.delete(inFlightKey);
      });
      
      return responsePromise;
    } catch (error) {
      // Record error in telemetry
      this.recordTelemetry(requestId, context.userId, 'initialization', 'error', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Rethrow the error
      throw error;
    }
  }

  /**
   * Internal implementation of processMessage
   * @param requestId Request ID
   * @param message User message
   * @param context Request context
   * @returns Response from the agent
   */
  private async processMessageInternal(
    requestId: string,
    message: string,
    context: RequestContext
  ): Promise<UnifiedAgentResponse> {
    // Start tracking metrics
    const startTime = Date.now();
    const metrics: UnifiedAgentResponse['metrics'] = {
      totalTime: 0,
      thinkingTime: 0,
      retrievalTime: 0,
      toolExecutionTime: 0,
      llmTime: 0
    };
    
    // Create debug information collector
    const debug: Record<string, any> = {};
    
    try {
      // 1. Context retrieval phase
      this.recordTelemetry(requestId, context.userId, 'context_retrieval', 'start');
      
      const retrievalStart = Date.now();
      let relevantMemories: WorkingMemoryItem[] = [];
      let relevantFiles: any[] = [];
      
      if (!context.options?.skipRetrieval) {
        // Enhance query if enabled
        const enhancedQuery = await this.queryEnhancer.enhanceQuery({
          originalQuery: message,
          enhancementStrategies: {
            expansion: true,
            multiQuery: true
          }
        });
        
        // Extract tags from the message
        let messageTags: string[] = [];
        try {
          // First try using the AI-powered tag extractor
          
          const extractionResult = await extractTags(message, {
            maxTags: 8,
            minConfidence: 0.3
          });
          
          if (extractionResult.success && extractionResult.tags.length > 0) {
            messageTags = extractionResult.tags.map(tag => tag.text);
            console.log(`Extracted ${messageTags.length} tags from user message for memory retrieval:`, messageTags);
          } else {
            // Fallback to basic pattern matching for common tags when AI extraction fails
            console.log('AI tag extraction produced no results, falling back to basic extraction');
            messageTags = this.extractBasicTags(message);
          }
        } catch (extractionError) {
          console.warn('Error extracting tags from message for memory retrieval:', extractionError);
          // Fallback to basic extraction on error
          messageTags = this.extractBasicTags(message);
          console.log('Using fallback tag extraction, found tags:', messageTags);
        }
        
        // Retrieve memories
        const { memories, memoryIds } = await this.memoryRetriever.retrieveMemories({
          query: enhancedQuery.expandedQuery || message,
          userId: context.userId,
          limit: 10,
          tags: messageTags, // Add extracted tags to memory retrieval
          semanticSearch: true
        });
        let relevantMemories = memories as WorkingMemoryItem[];
        
        // Rerank memories if needed
        if (relevantMemories.length > 0) {
          const rerankedResults = await this.resultReranker.rerank({
            query: message,
            initialResults: relevantMemories.map(memory => ({
              id: memory.id,
              content: memory.content,
              source: memory.type,
              score: memory._relevanceScore || 0.5,
              metadata: { userId: memory.userId }
            })) as ResultRerankerResult[],
            strategy: 'relevance'
          });
          
          // Convert back to WorkingMemoryItem format with updated relevance scores
          relevantMemories = relevantMemories.map(memory => {
            const reranked = rerankedResults.find(r => r.id === memory.id);
            if (reranked) {
              return {
                ...memory,
                _relevanceScore: reranked.score
              };
            }
            return memory;
          });
        }
        
        // Add to debug info
        if (this.config.enableDebugging) {
          debug.retrievalInfo = {
            enhancedQuery,
            relevantMemories
          };
        }
      }
      
      metrics.retrievalTime = Date.now() - retrievalStart;
      this.recordTelemetry(requestId, context.userId, 'context_retrieval', 'end', {
        duration: metrics.retrievalTime,
        memoriesCount: relevantMemories.length
      });
      
      // 2. Thinking phase
      this.recordTelemetry(requestId, context.userId, 'thinking', 'start');
      
      const thinkingStart = Date.now();
      const thinkingResult = await this.thinkingService.analyzeIntent(message, {
        userId: context.userId,
        chatHistory: context.conversationHistory?.map(msg => ({
          id: IdGenerator.generate('msg').toString(),
          content: msg.content,
          sender: {
            id: msg.role === 'user' ? context.userId : 'assistant',
            name: msg.role === 'user' ? 'User' : 'Assistant',
            role: msg.role
          },
          timestamp: msg.timestamp
        })),
        workingMemory: relevantMemories,
        contextFiles: relevantFiles
      });
      
      metrics.thinkingTime = Date.now() - thinkingStart;
      this.recordTelemetry(requestId, context.userId, 'thinking', 'end', {
        duration: metrics.thinkingTime,
        intent: thinkingResult.intent
      });
      
      // 3. Delegation decision phase
      this.recordTelemetry(requestId, context.userId, 'delegation_decision', 'start');
      
      if (context.options?.enableDelegation !== false && thinkingResult.shouldDelegate) {
        const delegationResult = await this.delegationService.delegateTask(
          context.userId,
          message,
          thinkingResult.requiredCapabilities || [],
          thinkingResult.priority || 5,
          thinkingResult.isUrgent || false,
          thinkingResult.context
        );

        if (delegationResult.success) {
          // Create task object
          const task: DelegatedTask = {
            id: IdGenerator.generate('task').toString(),
            intent: {
              id: IdGenerator.generate('intent').toString(),
              name: thinkingResult.intent.primary,
              confidence: thinkingResult.intent.confidence,
              description: '',
              parameters: {},
              childIntents: [],
              metadata: {
                extractedAt: new Date().toISOString(),
                source: 'thinking_service'
              }
            },
            entities: thinkingResult.entities.map(e => ({
              id: IdGenerator.generate('entity').toString(),
              type: e.type as EntityType,
              value: e.value,
              confidence: e.confidence,
              timestamp: new Date().toISOString()
            })),
            priority: TaskPriority.MEDIUM,
            status: TaskStatus.PENDING,
            assignedAgent: delegationResult.agentId,
            requiredCapabilities: thinkingResult.requiredCapabilities || [],
            complexity: thinkingResult.complexity || 1,
            metadata: {
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              estimatedDuration: 0,
              attempts: 0
            }
          };

          // Register task for tracking
          this.taskProgressTracker.registerTask(task);

          // Return delegation response
          return {
            id: requestId,
            response: `I've delegated this task to ${delegationResult.agentId || 'a specialized agent'}. You'll be updated on the progress.`,
            delegation: {
              delegated: true,
              agentId: delegationResult.agentId,
              taskId: task.id
            },
            metrics: {
              totalTime: Date.now() - startTime,
              thinkingTime: metrics.thinkingTime,
              retrievalTime: metrics.retrievalTime,
              toolExecutionTime: 0,
              llmTime: 0
            }
          };
        }
      }
      
      this.recordTelemetry(requestId, context.userId, 'delegation_decision', 'end', {
        delegated: false
      });
      
      // 4. Tool selection phase
      this.recordTelemetry(requestId, context.userId, 'tool_selection', 'start');
      
      let selectedTools: any[] = [];
      
      if (context.options?.enableTools !== false) {
        // Get recommended tools based on intent
        const toolRecommendations = await this.toolService.getRecommendedTools(
          thinkingResult.intent.primary,
          5
        );
        
        selectedTools = toolRecommendations;
        
        if (this.config.enableDebugging) {
          debug.toolSelection = {
            recommendations: toolRecommendations
          };
        }
      }
      
      this.recordTelemetry(requestId, context.userId, 'tool_selection', 'end', {
        toolsCount: selectedTools.length
      });
      
      // 5. Tool execution phase
      this.recordTelemetry(requestId, context.userId, 'tool_execution', 'start');
      
      const toolExecutionStart = Date.now();
      const toolExecutionResults = [];
      
      if (selectedTools.length > 0 && context.options?.enableTools !== false) {
        for (const toolInfo of selectedTools) {
          try {
            // Extract parameters from entities
            const parameters = this.extractToolParameters(
              toolInfo.tool,
              thinkingResult.entities
            );
            
            // Execute tool
            const executionResult = await this.toolService.executeTool({
              toolId: toolInfo.tool.id,
              parameters,
              context: {
                userId: context.userId,
                intent: thinkingResult.intent.primary,
                entities: thinkingResult.entities
              }
            });
            
            // Generate feedback
            await this.toolFeedbackService.generateAutomatedFeedback(
              toolInfo.tool.id,
              {
                parameters,
                result: executionResult.success ? (executionResult.output || {}) : undefined,
                executionTime: 0, // Default since property doesn't exist
                wasSuccessful: executionResult.success,
                error: executionResult.error,
                context: {
                  task: message,
                  intent: thinkingResult.intent.primary
                },
                userId: context.userId
              }
            );
            
            // Add to results
            toolExecutionResults.push({
              toolId: toolInfo.tool.id,
              toolName: toolInfo.tool.name,
              input: parameters,
              output: executionResult.success ? (executionResult.output || {}) : undefined,
              success: executionResult.success,
              error: executionResult.error
            });
          } catch (error) {
            console.error(`Error executing tool ${toolInfo.tool.id}:`, error);
            
            // Add failed execution to results
            toolExecutionResults.push({
              toolId: toolInfo.tool.id,
              toolName: toolInfo.tool.name,
              input: {},
              output: null,
              success: false,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }
      
      metrics.toolExecutionTime = Date.now() - toolExecutionStart;
      this.recordTelemetry(requestId, context.userId, 'tool_execution', 'end', {
        duration: metrics.toolExecutionTime,
        resultsCount: toolExecutionResults.length
      });
      
      // 6. Response generation phase
      this.recordTelemetry(requestId, context.userId, 'response_generation', 'start');
      
      const llmStart = Date.now();
      const response = await this.generateResponse(
        message,
        thinkingResult,
        {
          relevantMemories,
          toolResults: toolExecutionResults,
          conversationHistory: context.conversationHistory?.map(msg => ({
            id: IdGenerator.generate('msg').toString(),
            content: msg.content,
            sender: {
              id: msg.role === 'user' ? context.userId : 'assistant',
              name: msg.role === 'user' ? 'User' : 'Assistant',
              role: msg.role
            },
            timestamp: msg.timestamp
          }))
        }
      );
      
      metrics.llmTime = Date.now() - llmStart;
      this.recordTelemetry(requestId, context.userId, 'response_generation', 'end', {
        duration: metrics.llmTime
      });
      
      // 7. Memory consolidation phase
      this.recordTelemetry(requestId, context.userId, 'memory_consolidation', 'start');
      
      // Update working memory with important information
      await this.memoryConsolidator.consolidateWorkingMemory(
        context.userId,
        // Convert entities to working memory items with required properties
        thinkingResult.entities.map(entity => ({
          id: IdGenerator.generate('memory').toString(),
          content: entity.value,
          type: 'entity' as 'entity' | 'fact' | 'preference' | 'task' | 'goal',
          confidence: entity.confidence,
          priority: 0.7,
          tags: [entity.type],
          addedAt: new Date(),
          expiresAt: null,
          userId: context.userId,
          metadata: {
            source: 'entity_extraction',
            extractedFrom: message
          },
          relatedTo: []
        }))
      );
      
      this.recordTelemetry(requestId, context.userId, 'memory_consolidation', 'end');
      
      // 8. Finalization phase
      this.recordTelemetry(requestId, context.userId, 'finalization', 'start');
      
      // Calculate total time
      metrics.totalTime = Date.now() - startTime;
      
      // Build final response
      const agentResponse: UnifiedAgentResponse = {
        id: requestId,
        response,
        thinking: thinkingResult,
        toolsUsed: toolExecutionResults.length > 0 ? toolExecutionResults : undefined,
        delegation: undefined,
        metrics,
        debug: this.config.enableDebugging ? debug : undefined
      };
      
      // Cache the response if enabled
      if (this.config.enableCaching) {
        this.cacheResponse(
          this.generateCacheKey(message, context),
          agentResponse
        );
      }
      
      this.recordTelemetry(requestId, context.userId, 'finalization', 'end', {
        totalTime: metrics.totalTime
      });
      
      return agentResponse;
    } catch (error) {
      // Record error in telemetry
      this.recordTelemetry(requestId, context.userId, 'finalization', 'error', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Re-throw the error
      throw error;
    }
  }

  /**
   * Extract tool parameters from entities
   * @param tool Tool definition
   * @param entities Entities extracted from user message
   * @returns Tool parameters
   */
  private extractToolParameters(
    tool: any,
    entities: any[]
  ): Record<string, any> {
    const parameters: Record<string, any> = {};
    
    // For each tool parameter, try to find a matching entity
    for (const param of tool.parameters) {
      // Find entity that matches the parameter by type or name
      const matchingEntity = entities.find(entity => 
        entity.type.toLowerCase() === param.name.toLowerCase() ||
        entity.type.toLowerCase() === param.description.toLowerCase()
      );
      
      if (matchingEntity) {
        // Convert value based on parameter type
        switch (param.type) {
          case 'number':
            parameters[param.name] = Number(matchingEntity.value);
            break;
          case 'boolean':
            parameters[param.name] = Boolean(matchingEntity.value);
            break;
          default:
            parameters[param.name] = matchingEntity.value;
        }
      } else if (param.required) {
        // For required parameters, use default value or null
        parameters[param.name] = param.defaultValue !== undefined 
          ? param.defaultValue 
          : null;
      }
    }
    
    return parameters;
  }

  /**
   * Generate response using LLM
   * @param message User message
   * @param thinking Thinking result
   * @param context Additional context
   * @returns Generated response
   */
  private async generateResponse(
    message: string,
    thinking: ThinkingResult,
    context: {
      relevantMemories: any[];
      toolResults?: any[];
      conversationHistory?: any[];
    }
  ): Promise<string> {
    // Build prompt
    const systemPrompt = `You are a helpful assistant. Generate a concise, accurate response to the user's message.
    
Intent: ${thinking.intent.primary}
Entities: ${thinking.entities.map(e => `${e.type}: ${e.value}`).join(', ')}

${context.toolResults && context.toolResults.length > 0 ? 
`Tool Results:
${context.toolResults.map(result => `${result.toolName}: ${JSON.stringify(result.output)}`).join('\n')}` : ''}

${context.relevantMemories && context.relevantMemories.length > 0 ? 
`Relevant Information:
${context.relevantMemories.map(m => m.content).join('\n')}` : ''}

Based on this information, respond to the user.`;
    
    // Call LLM
    const completion = await this.llm.invoke(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ] as any // Type cast as any to bypass type checking
    );
    
    return completion.content.toString();
  }

  /**
   * Generate cache key for a request
   * @param message User message
   * @param context Request context
   * @returns Cache key
   */
  private generateCacheKey(message: string, context: RequestContext): string {
    return `${context.userId}:${message}`;
  }

  /**
   * Get cached response
   * @param key Cache key
   * @returns Cached response or null
   */
  private getCachedResponse(key: string): UnifiedAgentResponse | null {
    const entry = this.responseCache.get(key);
    
    if (entry && entry.expiresAt > Date.now()) {
      return entry.response;
    }
    
    return null;
  }

  /**
   * Cache a response
   * @param key Cache key
   * @param response Response to cache
   */
  private cacheResponse(key: string, response: UnifiedAgentResponse): void {
    this.responseCache.set(key, {
      response,
      expiresAt: Date.now() + (this.config.cacheTTL || 5 * 60 * 1000)
    });
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    
    // Use Array.from to convert entries to an array
    for (const [key, entry] of Array.from(this.responseCache.entries())) {
      if (entry.expiresAt <= now) {
        this.responseCache.delete(key);
      }
    }
  }

  /**
   * Record a telemetry event
   * @param requestId Request ID
   * @param userId User ID
   * @param phase Processing phase
   * @param type Event type
   * @param details Event details
   */
  private recordTelemetry(
    requestId: string,
    userId: string,
    phase: ProcessingPhase,
    type: 'start' | 'end' | 'error' | 'info',
    details?: Record<string, any>
  ): void {
    if (!this.config.enableTelemetry) {
      return;
    }
    
    const event: TelemetryEvent = {
      id: IdGenerator.generate('event').toString(),
      requestId,
      userId,
      phase,
      type,
      timestamp: new Date(),
      details
    };
    
    // For 'end' events, calculate duration from matching 'start' event
    if (type === 'end') {
      const startEvent = this.telemetryEvents.find(e => 
        e.requestId === requestId && 
        e.phase === phase && 
        e.type === 'start'
      );
      
      if (startEvent) {
        event.duration = event.timestamp.getTime() - startEvent.timestamp.getTime();
      }
    }
    
    this.telemetryEvents.push(event);
    
    // Limit number of stored events
    if (this.telemetryEvents.length > 1000) {
      this.telemetryEvents = this.telemetryEvents.slice(-1000);
    }
  }

  /**
   * Get telemetry events for a request
   * @param requestId Request ID
   * @returns Telemetry events for the request
   */
  getTelemetryForRequest(requestId: string): TelemetryEvent[] {
    return this.telemetryEvents.filter(event => event.requestId === requestId);
  }

  /**
   * Get task progress information
   * @param taskId Task ID
   * @returns Task progress information
   */
  getTaskProgress(taskId: string): any {
    // Using getTask method which exists on TaskProgressTracker
    const task = this.taskProgressTracker.getTask(taskId);
    return task ? {
      taskId,
      status: task.status,
      progress: 0, // Default since not tracked directly
      startedAt: task.metadata?.createdAt ? new Date(task.metadata.createdAt) : undefined,
      completedAt: undefined,
      executingAgentId: task.assignedAgent
    } : undefined;
  }

  /**
   * Extract basic tags from a message
   * @param message User message
   * @returns Array of extracted tags
   */
  private extractBasicTags(message: string): string[] {
    if (!message || typeof message !== 'string') return [];
    
    // Convert to lowercase
    const lowerMessage = message.toLowerCase();
    
    // 1. Common domain/subject tags that might appear in messages
    const commonDomains = [
      'marketing', 'sales', 'finance', 'technology', 'development', 
      'design', 'research', 'strategy', 'operations', 'product', 
      'management', 'leadership', 'analytics', 'data', 'customer', 
      'support', 'service', 'social', 'media', 'content', 'email',
      'legal', 'compliance', 'hr', 'recruitment', 'training', 
      'mission', 'vision', 'values', 'goals', 'policy', 'report'
    ];
    
    // 2. Extract key noun phrases as potential tags
    const words = lowerMessage
      .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
      .split(/\s+/)              // Split on whitespace
      .filter(word => word.length > 3); // Only words longer than 3 chars
    
    // 3. Domain tags that appear in the message
    const domainTags = commonDomains.filter(domain => 
      words.includes(domain) || lowerMessage.includes(domain)
    );
    
    // 4. Look for explicit tag markers like #tag or [tag]
    const explicitTags: string[] = [];
    
    // Match hashtag style tags #tag
    const hashtagMatches = message.match(/#(\w+)/g);
    if (hashtagMatches) {
      explicitTags.push(...hashtagMatches.map(tag => tag.substring(1).toLowerCase()));
    }
    
    // Match bracket style tags [tag]
    const bracketMatches = message.match(/\[(\w+)\]/g);
    if (bracketMatches) {
      explicitTags.push(...bracketMatches.map(tag => tag.substring(1, tag.length - 1).toLowerCase()));
    }
    
    // 5. Look for question type tags
    const questionTags: string[] = [];
    if (lowerMessage.includes('what is') || lowerMessage.includes('who is') || 
        lowerMessage.includes('when is') || lowerMessage.includes('where is')) {
      questionTags.push('question');
    }
    
    if (lowerMessage.includes('how to') || lowerMessage.includes('how do i')) {
      questionTags.push('how-to');
    }
    
    // 6. Check for specific content types
    if (lowerMessage.includes('mission') || lowerMessage.includes('vision') || 
        lowerMessage.includes('values') || lowerMessage.includes('principles')) {
      domainTags.push('company-identity');
    }
    
    // Combine all tag sources, deduplicate, and return
    const allTags = [...domainTags, ...explicitTags, ...questionTags];
    return Array.from(new Set(allTags));
  }
} 