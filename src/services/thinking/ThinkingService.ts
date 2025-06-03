import { IThinkingService } from './IThinkingService';
import { 
  ThinkingResult, 
  ThinkingOptions, 
  WorkingMemoryItem,
  FileReference,
  ConsolidationOptions
} from './types';
import { IdGenerator } from '@/utils/ulid';
import { executeThinkingWorkflow } from './graph';
import { ThinkingState as GraphState } from './graph/types';
import { DelegationService } from './delegation/DelegationService';
import { DelegationFeedback } from './delegation/DelegationManager';
import { CognitiveArtifactService } from './cognitive/CognitiveArtifactService';
import { getMemoryServices } from '../../server/memory/services';
import { ImportanceLevel } from '../../constants/memory';
import { ImportanceCalculatorService } from '../importance/ImportanceCalculatorService';
import { ImportanceCalculationMode } from '../importance/ImportanceCalculatorService';
import { MemoryRetriever } from './memory/MemoryRetriever';
import { MemoryFormatter } from './memory/MemoryFormatter';
import { MemoryRetrievalOptions, MemoryRetrievalLogLevel } from './memory/MemoryRetriever';

/**
 * Implementation of the ThinkingService
 * Uses LangGraph for workflow and LangChain for LLM interactions
 */
export class ThinkingService implements IThinkingService {
  private workingMemoryStore: Record<string, WorkingMemoryItem[]> = {};
  private delegationService: DelegationService;
  private delegatedTasks: Map<string, { taskId: string, agentId: string }> = new Map();
  private cognitiveArtifactService?: CognitiveArtifactService;
  
  constructor(
    private readonly importanceCalculator: ImportanceCalculatorService
  ) {
    this.delegationService = new DelegationService();
    
    // Initialize cognitive artifact service asynchronously
    this.initializeCognitiveService().catch(err => {
      console.error('Error initializing cognitive artifact service:', err);
    });
  }
  
  /**
   * Initialize the cognitive artifact service with memory services
   */
  private async initializeCognitiveService(): Promise<void> {
    try {
      const { memoryService } = await getMemoryServices();
      this.cognitiveArtifactService = new CognitiveArtifactService(memoryService);
    } catch (error) {
      console.error('Failed to initialize cognitive artifact service:', error);
    }
  }
  
  /**
   * Analyze user intent from a message
   */
  async analyzeIntent(
    message: string, 
    options?: ThinkingOptions
  ): Promise<ThinkingResult> {
    try {
      // Use the LangGraph workflow to analyze intent
      const userId = options?.userId || 'anonymous';
      const graphResult = await executeThinkingWorkflow({
        userId,
        message,
        options
      });
      
      // Convert the graph result to ThinkingResult format
      return this.convertGraphResultToThinkingResult(graphResult);
    } catch (error) {
      console.error('Error analyzing intent:', error);
      throw new Error(`Failed to analyze intent: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Helper method to convert LangGraph results to ThinkingResult
   */
  private convertGraphResultToThinkingResult(graphResult: GraphState): ThinkingResult {
    // Create context with memory content
    const context: Record<string, any> = {};
    
    // Include formatted memory context if available
    if (graphResult.formattedMemoryContext) {
      context.formattedMemoryContext = graphResult.formattedMemoryContext;
    }
    
    return {
      intent: {
        primary: graphResult.intent?.name || 'unknown',
        confidence: graphResult.intent?.confidence || 0.5,
        alternatives: graphResult.intent?.alternatives?.map(alt => ({
          intent: alt.name,
          confidence: alt.confidence
        })),
        isSummaryRequest: graphResult.intent?.isSummaryRequest || false
      },
      requestType: graphResult.requestType || {
        type: 'PURE_LLM_TASK',
        confidence: 0.5,
        reasoning: 'No classification found, defaulting to pure LLM task',
        requiredTools: []
      },
      entities: graphResult.entities || [],
      shouldDelegate: graphResult.shouldDelegate || false,
      requiredCapabilities: graphResult.delegationTarget ? [graphResult.delegationTarget] : [],
      reasoning: graphResult.reasoning || [],
      contextUsed: {
        memories: (graphResult.contextMemories || []).map(m => m.id),
        files: (graphResult.contextFiles || []).map(f => f.id),
        tools: graphResult.tools || []
      },
      planSteps: graphResult.plan,
      priority: 5, // Default mid-priority
      isUrgent: false, // Default not urgent
      complexity: 3, // Default medium complexity
      context // Add the context with formattedMemoryContext
    };
  }
  
  /**
   * Determine if a request should be delegated to another agent
   */
  async shouldDelegate(
    thinkingResult: ThinkingResult
  ): Promise<{
    delegate: boolean;
    requiredCapabilities?: string[];
    confidence: number;
    reason: string;
  }> {
    // If the thinking result already has delegation information, use it
    if (thinkingResult.shouldDelegate && thinkingResult.requiredCapabilities?.length > 0) {
      // Check if these capabilities are available in the system
      const capabilitiesAvailable = await this.delegationService.hasCapabilities(
        thinkingResult.requiredCapabilities
      );
      
      if (!capabilitiesAvailable) {
        return {
          delegate: false,
          confidence: 0.7,
          reason: 'Required capabilities not available in the system'
        };
      }
      
      return {
        delegate: true,
        requiredCapabilities: thinkingResult.requiredCapabilities,
        confidence: 0.85,
        reason: 'Based on intent analysis and capability availability'
      };
    }
    
    // Basic implementation - can be enhanced with more sophisticated logic
    return {
      delegate: thinkingResult.shouldDelegate,
      confidence: 0.7,
      reason: 'Based on initial analysis',
      requiredCapabilities: thinkingResult.requiredCapabilities
    };
  }
  
  /**
   * Update working memory with new insights from thinking results
   */
  async updateWorkingMemory(
    userId: string,
    thinkingResult: ThinkingResult
  ): Promise<void> {
    // Initialize working memory for this user if it doesn't exist
    if (!this.workingMemoryStore[userId]) {
      this.workingMemoryStore[userId] = [];
    }
    
    // Add extracted entities to working memory
    for (const entity of thinkingResult.entities) {
      await this.storeWorkingMemoryItem(userId, {
        content: entity.value,
        type: 'entity',
        tags: [entity.type],
        addedAt: new Date(),
        priority: entity.confidence * 10, // Scale 0-10
        expiresAt: null,
        confidence: entity.confidence,
        userId
      });
    }
    
    // Store the primary intent
    await this.storeWorkingMemoryItem(userId, {
      content: thinkingResult.intent.primary,
      type: 'goal',
      tags: ['intent', 'current_goal'],
      addedAt: new Date(),
      priority: 10, // Highest priority
      expiresAt: null,
      confidence: thinkingResult.intent.confidence,
      userId
    });
    
    // If there's delegation information, store it in working memory
    if (thinkingResult.shouldDelegate && thinkingResult.requiredCapabilities?.length > 0) {
      await this.storeWorkingMemoryItem(userId, {
        content: `Delegated to ${thinkingResult.requiredCapabilities.join(', ')}`,
        type: 'task',
        tags: ['delegation', 'task_status'],
        addedAt: new Date(),
        priority: 8, // High priority
        expiresAt: null,
        confidence: 1.0,
        userId
      });
    }
  }
  
  /**
   * Create execution plan for handling the user's request
   */
  async createExecutionPlan(
    intent: string,
    entities: Array<{type: string, value: string, confidence: number}>,
    context: any
  ): Promise<{
    steps: string[];
    tools: string[];
    reasoning: string;
  }> {
    // Simple implementation - will be enhanced with LLM reasoning
    return {
      steps: [
        'Analyze user request',
        'Gather relevant context',
        'Generate response'
      ],
      tools: [],
      reasoning: 'Basic plan for handling user request'
    };
  }
  
  /**
   * Process a request through the complete thinking workflow
   * Stores all cognitive artifacts during processing
   */
  async processRequest(
    userId: string,
    message: string,
    options?: ThinkingOptions
  ): Promise<ThinkingResult> {
    console.log(`Retrieving context: ${userId} ${message}`);
    const combinedOptions: ThinkingOptions = {
      userId,
      ...(options || {})
    };

    // Check if visualization is enabled
    const visualization = options?.visualization;

    // First, retrieve memories related to the request
    const { memories, formattedMemoryContext } = await this.processMemoryRetrieval(message, combinedOptions);
    console.log(`Retrieved ${memories.length} memories for context. Context length: ${formattedMemoryContext.length} chars`);
    
    // Add memory context to options for the thinking graph
    const optionsWithMemories: ThinkingOptions = {
      ...combinedOptions,
      workingMemory: memories,
      // Add any other necessary context
    };

    try {
      // Add thinking node to visualization if enabled
      if (visualization) {
        try {
          // Get the visualizer from the visualization object
          const visualizer = options?.visualizer;
          if (visualizer) {
            visualizer.addNode(
              visualization,
              'thinking', // VisualizationNodeType.THINKING
              'Analyzing Request',
              {
                message,
                userId,
                timestamp: Date.now(),
                contextSize: memories.length
              },
              'in_progress'
            );
          }
        } catch (error) {
          console.error('Error adding thinking node to visualization:', error);
        }
      }
      
      // Execute the thinking workflow
      const graphResult = await executeThinkingWorkflow({
        userId,
        message,
        options: optionsWithMemories
      });
      
      // Convert graph results to a structured ThinkingResult
      const thinkingResult = this.convertGraphResultToThinkingResult(graphResult);
      
      // Add formatted memory context to the result
      if (!thinkingResult.context) {
        thinkingResult.context = {};
      }
      thinkingResult.context.formattedMemoryContext = formattedMemoryContext;
      thinkingResult.context.memoryCount = memories.length;
      
      // Add additional context for delegation if needed
      if (thinkingResult.intent?.primary && !thinkingResult.shouldDelegate) {
        const delegationAssessment = await this.shouldDelegate(thinkingResult);
        if (delegationAssessment.delegate) {
          console.log(`Delegation recommended for intent: ${thinkingResult.intent.primary}`);
          thinkingResult.shouldDelegate = true;
          thinkingResult.requiredCapabilities = delegationAssessment.requiredCapabilities || [];
        }
      }
      
      // Update visualization with thinking results if enabled
      if (visualization) {
        try {
          const visualizer = options?.visualizer;
          if (visualizer) {
            // Find the thinking node
            const thinkingNode = visualization.nodes.find(
              (node: { type: string }) => node.type === 'thinking'
            );
            
            if (thinkingNode) {
              // Update thinking node with reasoning
              thinkingNode.status = 'completed';
              thinkingNode.data = {
                ...thinkingNode.data,
                intent: thinkingResult.intent,
                entities: thinkingResult.entities,
                reasoning: thinkingResult.reasoning,
                complexity: thinkingResult.complexity,
                priority: thinkingResult.priority,
                shouldDelegate: thinkingResult.shouldDelegate
              };
              
              // Add end time and duration to metrics
              if (thinkingNode.metrics) {
                thinkingNode.metrics.endTime = Date.now();
                thinkingNode.metrics.duration = 
                  thinkingNode.metrics.endTime - (thinkingNode.metrics.startTime || Date.now());
              }
            }
          }
        } catch (error) {
          console.error('Error updating thinking visualization:', error);
        }
      }
      
      // Store thinking artifacts
      try {
        const { detailedReasoning, storageResult, importance, importanceScore } = await this.storeThinkingArtifacts(userId, message, thinkingResult);
        thinkingResult.reasoning = detailedReasoning;
        thinkingResult.importance = importance;
        thinkingResult.importanceScore = importanceScore;
      } catch (error) {
        console.error('Error storing thinking artifacts:', error);
      }

      // Save important thinking results to working memory
      try {
        await this.updateWorkingMemory(userId, thinkingResult);
      } catch (error) {
        console.error('Error updating working memory:', error);
      }
      
      return thinkingResult;
    } catch (error) {
      console.error('Error in thinking process:', error);
      
      // Update visualization with error if enabled
      if (visualization) {
        try {
          const visualizer = options?.visualizer;
          if (visualizer) {
            // Find the thinking node
            const thinkingNode = visualization.nodes.find(
              (node: { type: string }) => node.type === 'thinking'
            );
            
            if (thinkingNode) {
              // Update with error status
              thinkingNode.status = 'error';
              thinkingNode.data = {
                ...thinkingNode.data,
                error: error instanceof Error ? error.message : String(error)
              };
              
              // Add end time and duration to metrics
              if (thinkingNode.metrics) {
                thinkingNode.metrics.endTime = Date.now();
                thinkingNode.metrics.duration = 
                  thinkingNode.metrics.endTime - (thinkingNode.metrics.startTime || Date.now());
              }
            }
            
            // Add error node
            visualizer.addNode(
              visualization,
              'error', // VisualizationNodeType.ERROR
              'Thinking Error',
              {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
              },
              'error'
            );
          }
        } catch (visualizationError) {
          console.error('Error updating visualization with error:', visualizationError);
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Store all cognitive artifacts from the thinking process
   * Creates thoughts, reasoning, entities, plans, and links them together
   * Returns enriched reasoning to include in the response
   */
  private async storeThinkingArtifacts(
    userId: string,
    message: string,
    thinkingResult: ThinkingResult
  ): Promise<{
    detailedReasoning: string[];
    storageResult: any;
    importance?: import('../../constants/memory').ImportanceLevel;
    importanceScore?: number;
  }> {
    // Skip if cognitive artifact service is not initialized
    if (!this.cognitiveArtifactService) {
      console.warn('Cognitive artifact service not initialized, skipping artifact storage');
      return {
        detailedReasoning: thinkingResult.reasoning || [],
        storageResult: null,
        importance: undefined,
        importanceScore: undefined
      };
    }
    
    try {
      // Determine importance based on complexity and priority
      const importance = await this.calculateImportance(thinkingResult);
      
      // Calculate importance score from level
      const { ImportanceConverter } = await import('../importance/ImportanceConverter');
      const importanceScore = ImportanceConverter.levelToScore(importance);
      
      // Store the complete thinking process with all components
      const storageResult = await this.cognitiveArtifactService.storeThinkingResult(
        {
          intent: thinkingResult.intent,
          entities: thinkingResult.entities,
          reasoning: thinkingResult.reasoning,
          planSteps: thinkingResult.planSteps,
          shouldDelegate: thinkingResult.shouldDelegate
        },
        userId,
        message,
        {
          contextId: userId,
          importance,
          relatedMemories: thinkingResult.contextUsed.memories
        }
      );
      
      console.log('Stored thinking artifacts:', {
        thoughtId: storageResult.thoughtId,
        planId: storageResult.planId,
        entityCount: storageResult.entityIds.length
      });
      
      // Create detailed reasoning for the response (what gets shown to user)
      const detailedReasoning = [
        `Intent Analysis: ${thinkingResult.intent.primary} (confidence: ${(thinkingResult.intent.confidence * 100).toFixed(0)}%)`,
        ...(thinkingResult.intent.alternatives && thinkingResult.intent.alternatives.length > 0 
          ? [`Alternative intents considered: ${thinkingResult.intent.alternatives.map(alt => `${alt.intent} (${(alt.confidence * 100).toFixed(0)}%)`).join(', ')}`]
          : []
        ),
        ...(thinkingResult.entities && thinkingResult.entities.length > 0
          ? [`Entities identified: ${thinkingResult.entities.map(e => `${e.value} (${e.type})`).join(', ')}`]
          : []
        ),
        ...(thinkingResult.reasoning || []),
        ...(thinkingResult.planSteps && thinkingResult.planSteps.length > 0
          ? ['Execution plan:', ...thinkingResult.planSteps.map((step, i) => `${i + 1}. ${step}`)]
          : []
        ),
        ...(thinkingResult.shouldDelegate 
          ? [`Delegation: Task requires specialized capabilities: ${thinkingResult.requiredCapabilities.join(', ')}`]
          : []
        )
      ];
      
      // If delegation is needed, store a reflection about the delegation decision
      if (thinkingResult.shouldDelegate && thinkingResult.requiredCapabilities.length > 0) {
        this.storeReflectionOnDelegation(userId, thinkingResult, storageResult.thoughtId);
      }
      
      return {
        detailedReasoning,
        storageResult,
        importance,
        importanceScore
      };
    } catch (error) {
      console.error('Error storing thinking artifacts:', error);
      return {
        detailedReasoning: thinkingResult.reasoning || [],
        storageResult: null,
        importance: undefined,
        importanceScore: undefined
      };
    }
  }
  
  /**
   * Store a reflection on the delegation decision
   */
  private async storeReflectionOnDelegation(
    userId: string,
    thinkingResult: ThinkingResult,
    relatedThoughtId: string | null
  ): Promise<void> {
    if (!this.cognitiveArtifactService) return;
    
    const delegationContent = `
Delegation Decision Analysis:

This request requires specialized capabilities that I don't fully possess:
${thinkingResult.requiredCapabilities.join(', ')}

Based on my reasoning:
${thinkingResult.reasoning.join('\n')}

I've decided to delegate this task to an agent with the appropriate specialization.
    `.trim();
    
    try {
      await this.cognitiveArtifactService.storeReflection(
        delegationContent,
        {
          reflectionType: 'strategy',
          timeScope: 'immediate',
          importance: ImportanceLevel.MEDIUM,
          relatedTo: relatedThoughtId ? [relatedThoughtId] : [],
          contextId: userId,
          tags: ['delegation', 'decision', 'specialization']
        }
      );
    } catch (error) {
      console.error('Error storing delegation reflection:', error);
    }
  }
  
  /**
   * Calculate importance based on thinking result
   */
  private async calculateImportance(thinkingResult: ThinkingResult): Promise<ImportanceLevel> {
    const result = await this.importanceCalculator.calculateImportance({
      content: thinkingResult.reasoning.join('\n'),  // Join all reasoning steps
      contentType: 'thinking',
      tags: [
        'thinking',
        `complexity:${thinkingResult.complexity}`,
        `priority:${thinkingResult.priority}`
      ],
      source: 'agent',
      userContext: thinkingResult.context ? JSON.stringify(thinkingResult.context) : undefined
    }, ImportanceCalculationMode.HYBRID);
    
    return result.importance_level;
  }
  
  /**
   * Record feedback on a delegated task
   */
  async recordDelegationFeedback(
    requestId: string,
    wasSuccessful: boolean,
    executionTime: number,
    userSatisfaction?: number
  ): Promise<boolean> {
    const delegation = this.delegatedTasks.get(requestId);
    
    if (!delegation) {
      console.error(`No delegation found for request ID ${requestId}`);
      return false;
    }
    
    const feedback: DelegationFeedback = {
      taskId: delegation.taskId,
      agentId: delegation.agentId,
      wasSuccessful,
      executionTime,
      userSatisfaction,
      details: `Feedback recorded for request ${requestId}`
    };
    
    // Record feedback using delegation service
    const result = await this.delegationService.recordFeedback(feedback);
    
    // Remove from tracking if feedback was recorded
    if (result) {
      this.delegatedTasks.delete(requestId);
    }
    
    return result;
  }
  
  /**
   * Get working memory for a user
   */
  async getWorkingMemory(userId: string): Promise<WorkingMemoryItem[]> {
    return this.workingMemoryStore[userId] || [];
  }
  
  /**
   * Store a new item in working memory
   */
  async storeWorkingMemoryItem(
    userId: string, 
    item: Omit<WorkingMemoryItem, 'id'>
  ): Promise<string> {
    if (!this.workingMemoryStore[userId]) {
      this.workingMemoryStore[userId] = [];
    }
    
    // Generate ID for the item
    const id = IdGenerator.generate('wmem').toString();
    
    // Create the full item
    const fullItem: WorkingMemoryItem = {
      ...item,
      id
    };
    
    // Check if a similar item already exists
    const existingIndex = this.workingMemoryStore[userId].findIndex(
      existing => existing.content === item.content && existing.type === item.type
    );
    
    if (existingIndex >= 0) {
      // Update the existing item
      this.workingMemoryStore[userId][existingIndex] = {
        ...this.workingMemoryStore[userId][existingIndex],
        // Update with higher priority or confidence if newer item has higher values
        priority: Math.max(this.workingMemoryStore[userId][existingIndex].priority, item.priority),
        confidence: Math.max(this.workingMemoryStore[userId][existingIndex].confidence, item.confidence),
        // Add any new tags
        tags: Array.from(new Set([...this.workingMemoryStore[userId][existingIndex].tags, ...item.tags])),
        // Update addedAt to current time
        addedAt: new Date()
      };
      return this.workingMemoryStore[userId][existingIndex].id;
    }
    
    // Add the new item
    this.workingMemoryStore[userId].push(fullItem);
    
    // Sort by priority (descending)
    this.workingMemoryStore[userId].sort((a, b) => b.priority - a.priority);
    
    // Limit working memory size (keep top 50 items)
    if (this.workingMemoryStore[userId].length > 50) {
      this.workingMemoryStore[userId] = this.workingMemoryStore[userId].slice(0, 50);
    }
    
    return id;
  }

  /**
   * Process a memory retrieval request as part of the thinking process
   */
  private async processMemoryRetrieval(
    query: string,
    options: ThinkingOptions
  ): Promise<{
    memories: WorkingMemoryItem[];
    formattedMemoryContext: string;
  }> {
    console.log(`[MEMORY-DEBUGGING] Starting memory retrieval for query: "${query}"`);
    
    // Get memory services
    const memoryRetriever = new MemoryRetriever();
    const memoryFormatter = new MemoryFormatter();
    
    // Ensure userId exists
    if (!options.userId) {
      console.error('[MEMORY-DEBUGGING] No userId provided for memory retrieval');
      return { memories: [], formattedMemoryContext: 'No user ID provided.' };
    }
    
    // Configure retrieval options with LESS restrictive filtering
    const retrievalOptions: MemoryRetrievalOptions = {
      query,
      userId: options.userId,
      limit: 15, // Get enough memories for good context
      semanticSearch: true,
      // Pass through message exclusion if provided
      excludeMessageIds: options.excludeMessageIds,
      // Pass summary request flag to force working memory sufficiency
      isSummaryRequest: options.isSummaryRequest,
      importanceWeighting: {
        enabled: true,
        priorityWeight: 1.2,
        confidenceWeight: 1.0,
        useTypeWeights: true,
        importanceScoreWeight: 1.5
      },
      // Add detailed logging for debugging
      logLevel: MemoryRetrievalLogLevel.DEBUG
    };

    console.log(`[MEMORY-DEBUGGING] Retrieval options:`, JSON.stringify(retrievalOptions));
    
    try {
      // Retrieve memories for the query
      const result = await memoryRetriever.retrieveMemories(retrievalOptions);
      const memories = result.memories;
      
      console.log(`[MEMORY-DEBUGGING] Retrieved ${memories.length} memories`);
      
      // Log the first few memories for debugging
      if (memories.length > 0) {
        console.log(`[MEMORY-DEBUGGING] Top memory: ${JSON.stringify({
          id: memories[0].id,
          content: memories[0].content.substring(0, 100) + "...", // First 100 chars
          tags: memories[0].tags,
          relevance: memories[0]._relevanceScore || 0,
          importance: memories[0].metadata?.importance || 'unknown'
        })}`);
      } else {
        console.log(`[MEMORY-DEBUGGING] No memories found for query: "${query}"`);
      }
      
      // Format memories for context
      const formattedMemoryContext = memoryFormatter.formatMemoriesForContext(
        memories,
        { 
          sortBy: 'importance',
          groupByType: true,
          includeDetailedDescriptions: true,
          includeImportance: true,
          maxTokens: 3000
        }
      );
      
      console.log(`[MEMORY-DEBUGGING] Formatted memory context length: ${formattedMemoryContext.length} chars`);
      console.log(`[MEMORY-DEBUGGING] Memory context preview: ${formattedMemoryContext.substring(0, 200)}...`);
      
      return {
        memories,
        formattedMemoryContext
      };
    } catch (error) {
      console.error('[MEMORY-DEBUGGING] Error during memory retrieval:', error);
      return {
        memories: [],
        formattedMemoryContext: `Error retrieving memories: ${error}`
      };
    }
  }
} 