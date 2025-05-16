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
import { PluginSystem } from './tools/PluginSystem';
import { QueryEnhancer } from './retrieval/QueryEnhancer';
import { ResultReranker } from './retrieval/ResultReranker';
import { getMemoryServices } from '@/server/memory/services';
import { ChatOpenAI } from '@langchain/openai';
import { ThinkingResult } from './types';

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
   * Thinking service
   */
  private thinkingService: ThinkingService;

  /**
   * Memory retriever
   */
  private memoryRetriever: MemoryRetriever;

  /**
   * Memory consolidator
   */
  private memoryConsolidator: MemoryConsolidator;

  /**
   * Delegation service
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
   * Tool service
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
  private pluginSystem: PluginSystem;

  /**
   * Query enhancer
   */
  private queryEnhancer: QueryEnhancer;

  /**
   * Result reranker
   */
  private resultReranker: ResultReranker;

  /**
   * LLM model for generation
   */
  private llm: ChatOpenAI;

  /**
   * Service configuration
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
   * @param config Service configuration
   */
  constructor(config: UnifiedAgentConfig = {}) {
    this.config = {
      enableCaching: true,
      enableParallelProcessing: true,
      enableTelemetry: true,
      enableDebugging: false,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
      llmConfig: {
        thinkingModel: "gpt-4-turbo",
        generationModel: "gpt-3.5-turbo",
        maxContextTokens: 8000
      },
      ...config
    };

    // Initialize LLM
    this.llm = new ChatOpenAI({
      modelName: this.config.llmConfig?.generationModel || "gpt-3.5-turbo",
      temperature: 0.7
    });

    // Initialize services
    this.toolRegistry = new ToolRegistry();
    this.pluginSystem = new PluginSystem(this.toolRegistry);
    this.toolService = new ToolService(this.toolRegistry);
    this.toolFeedbackService = new ToolFeedbackService();
    
    this.taskProgressTracker = new TaskProgressTracker();
    this.delegationService = new DelegationService();
    this.collaborativeAgentService = new CollaborativeAgentService(this.delegationService);
    this.sharedMemoryService = new SharedMemoryService();
    
    this.queryEnhancer = new QueryEnhancer();
    this.resultReranker = new ResultReranker();
    
    this.memoryRetriever = new MemoryRetriever();
    this.memoryConsolidator = new MemoryConsolidator();
    
    this.thinkingService = new ThinkingService({
      llmModelName: this.config.llmConfig?.thinkingModel || "gpt-4-turbo"
    });

    // Schedule cache cleanup
    if (this.config.enableCaching) {
      setInterval(() => this.cleanupCache(), 60000); // Every minute
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
      let relevantMemories: any[] = [];
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
        
        // Retrieve memories
        relevantMemories = await this.memoryRetriever.retrieveMemories(
          context.userId,
          enhancedQuery.expandedQuery || message,
          { limit: 10 }
        );
        
        // Rerank memories if needed
        if (relevantMemories.length > 0) {
          relevantMemories = await this.resultReranker.rerank({
            query: message,
            initialResults: relevantMemories,
            strategy: 'relevance'
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
        chatHistory: context.conversationHistory,
        contextMemories: relevantMemories,
        contextFiles: relevantFiles
      });
      
      metrics.thinkingTime = Date.now() - thinkingStart;
      this.recordTelemetry(requestId, context.userId, 'thinking', 'end', {
        duration: metrics.thinkingTime,
        intent: thinkingResult.intent
      });
      
      // 3. Delegation decision phase
      this.recordTelemetry(requestId, context.userId, 'delegation_decision', 'start');
      
      let delegationInfo = null;
      
      if (context.options?.enableDelegation !== false && thinkingResult.shouldDelegate) {
        const delegationDecision = await this.delegationService.shouldDelegate(
          message,
          thinkingResult
        );
        
        if (delegationDecision.delegate) {
          // Delegate the task
          const delegationResult = await this.delegationService.delegateTask({
            id: IdGenerator.generate('task').toString(),
            userId: context.userId,
            query: message,
            requiredCapabilities: delegationDecision.requiredCapabilities || [],
            context: {
              thinkingResult,
              relevantMemories
            },
            priority: 1,
            complexity: 'medium'
          });
          
          // Register the task for progress tracking
          this.taskProgressTracker.registerTask(delegationResult.task);
          
          delegationInfo = {
            delegated: true,
            agentId: delegationResult.assignedAgent?.id,
            agentName: delegationResult.assignedAgent?.name,
            taskId: delegationResult.task.id
          };
          
          this.recordTelemetry(requestId, context.userId, 'delegation_decision', 'end', {
            delegated: true,
            agentId: delegationResult.assignedAgent?.id
          });
          
          // Return early with delegation information
          const response: UnifiedAgentResponse = {
            id: requestId,
            response: `I've delegated this task to ${delegationResult.assignedAgent?.name || 'a specialized agent'}. You'll be updated on the progress.`,
            thinking: thinkingResult,
            delegation: delegationInfo,
            metrics: {
              ...metrics,
              totalTime: Date.now() - startTime
            }
          };
          
          // Cache the response if enabled
          if (this.config.enableCaching) {
            this.cacheResponse(
              this.generateCacheKey(message, context),
              response
            );
          }
          
          return response;
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
                result: executionResult.data,
                executionTime: executionResult.executionTime,
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
              output: executionResult.data,
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
          conversationHistory: context.conversationHistory
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
        // Convert entities to working memory items
        thinkingResult.entities.map(entity => ({
          id: IdGenerator.generate('memory').toString(),
          content: entity.value,
          type: entity.type,
          confidence: entity.confidence,
          priority: 0.7,
          metadata: {
            source: 'entity_extraction',
            extractedFrom: message
          }
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
        delegation: delegationInfo || undefined,
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
    const completion = await this.llm.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ]);
    
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
    
    for (const [key, entry] of this.responseCache.entries()) {
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
    return this.taskProgressTracker.getTaskProgress(taskId);
  }
} 