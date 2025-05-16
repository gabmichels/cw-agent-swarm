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

/**
 * Implementation of the ThinkingService
 * Uses LangGraph for workflow and LangChain for LLM interactions
 */
export class ThinkingService implements IThinkingService {
  private workingMemoryStore: Record<string, WorkingMemoryItem[]> = {};
  private delegationService: DelegationService;
  private delegatedTasks: Map<string, { taskId: string, agentId: string }> = new Map();
  
  constructor() {
    this.delegationService = new DelegationService();
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
      const graphResult = await executeThinkingWorkflow(userId, message);
      
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
    return {
      intent: {
        primary: graphResult.intent?.name || 'unknown',
        confidence: graphResult.intent?.confidence || 0.5,
        alternatives: graphResult.intent?.alternatives?.map(alt => ({
          intent: alt.name,
          confidence: alt.confidence
        }))
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
      complexity: 3 // Default medium complexity
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
   * Process a user request through the complete thinking workflow
   */
  async processRequest(
    userId: string,
    message: string,
    options?: ThinkingOptions
  ): Promise<ThinkingResult> {
    try {
      // Extract agent persona from options if available
      const agentPersona = options?.agentInfo ? {
        name: options.agentInfo.name || 'AI Assistant',
        description: options.agentInfo.description || 'A helpful AI assistant',
        systemPrompt: options.agentInfo.systemPrompt,
        capabilities: options.agentInfo.capabilities || [],
        traits: options.agentInfo.traits || []
      } : undefined;
      
      // Use the LangGraph workflow for complete thinking process
      const graphResult = await executeThinkingWorkflow(userId, message, agentPersona);
      
      // Convert the graph result to ThinkingResult format
      const thinkingResult = this.convertGraphResultToThinkingResult(graphResult);
      
      // Update working memory with the results
      await this.updateWorkingMemory(userId, thinkingResult);
      
      // If task was delegated, store the delegation information for future feedback
      if (graphResult.response && graphResult.response.includes('Task delegated to a specialized agent')) {
        // Extract taskId from response (assuming it's in the format)
        const match = graphResult.response.match(/Task delegated to a specialized agent \(([^)]+)\)/);
        if (match && match[1]) {
          const agentId = match[1];
          const requestId = IdGenerator.generate('req').toString();
          
          // Store delegation for future feedback
          this.delegatedTasks.set(requestId, {
            taskId: graphResult.response.split('Task delegated')[1].trim(),
            agentId
          });
        }
      }
      
      return thinkingResult;
    } catch (error) {
      console.error('Error in thinking process:', error);
      throw new Error(`Thinking process failed: ${error instanceof Error ? error.message : String(error)}`);
    }
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
} 