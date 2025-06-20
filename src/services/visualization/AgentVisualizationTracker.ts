import { ThinkingVisualizer } from '../thinking/visualization/ThinkingVisualizer';
import { VisualizationNodeType, VisualizationEdgeType } from '../thinking/visualization/types';
import {
  AgentVisualizationContext,
  VisualizationConfig,
  VisualizationError,
  MemoryRetrievalVisualizationData,
  LLMInteractionVisualizationData,
  ToolExecutionVisualizationData,
  TaskCreationVisualizationData
} from '../../types/visualization-integration';
import { ThinkingResult } from '../thinking/types';
import { MemoryEntry } from '../../types';
import { AgentResponse } from '../../agents/shared/base/AgentBase.interface';

/**
 * Service for tracking agent processing with visualization nodes
 * Following architecture guidelines: dependency injection, strict typing, immutable data
 */
export class AgentVisualizationTracker {
  constructor(
    private readonly visualizer: ThinkingVisualizer,
    private readonly config: VisualizationConfig
  ) {}

  /**
   * Creates initial user input visualization node
   * Pure function - no side effects except visualization creation
   */
  async createUserInputNode(context: AgentVisualizationContext): Promise<string> {
    if (!this.config.enabled) {
      return '';
    }

    try {
      const nodeId = this.visualizer.addNode(
        context.visualization,
        VisualizationNodeType.START,
        'User Input Received',
        {
          message: context.userMessage,
          userId: context.userId,
          chatId: context.chatId,
          messageId: context.messageId,
          timestamp: context.startTime
        },
        'completed'
      );

      return nodeId;
    } catch (error) {
      throw new VisualizationError(
        'Failed to create user input visualization node',
        'USER_INPUT_NODE_CREATION_FAILED',
        { context, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Creates thinking process visualization node
   */
  async createThinkingNode(
    context: AgentVisualizationContext,
    thinkingResult: ThinkingResult,
    parentNodeId?: string
  ): Promise<string> {
    if (!this.config.enabled) {
      return '';
    }

    try {
      const nodeId = this.visualizer.addThinkingNode(
        context.visualization,
        'Analyzing Request',
        this.formatThinkingContent(thinkingResult),
        {
          intent: thinkingResult.intent,
          entities: thinkingResult.entities,
          complexity: thinkingResult.complexity,
          priority: thinkingResult.priority,
          requestType: thinkingResult.requestType,
          shouldDelegate: thinkingResult.shouldDelegate,
          requiredCapabilities: thinkingResult.requiredCapabilities,
          reasoning: thinkingResult.reasoning,
          confidence: thinkingResult.intent.confidence,
          ...(this.config.includePerformanceMetrics && {
            processingTime: Date.now() - context.startTime
          })
        }
      );

      // Create edge from parent if specified
      if (parentNodeId) {
        this.visualizer.addEdge(
          context.visualization,
          parentNodeId,
          nodeId,
          VisualizationEdgeType.FLOW
        );
      }

      return nodeId;
    } catch (error) {
      throw new VisualizationError(
        'Failed to create thinking visualization node',
        'THINKING_NODE_CREATION_FAILED',
        { context, thinkingResult, parentNodeId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Creates memory retrieval visualization node
   */
  async createMemoryRetrievalNode(
    context: AgentVisualizationContext,
    query: string,
    retrievedMemories: MemoryEntry[],
    parentNodeId?: string
  ): Promise<string> {
    if (!this.config.enabled || !this.config.trackMemoryRetrieval) {
      return '';
    }

    try {
      const memoryData: MemoryRetrievalVisualizationData = {
        query,
        retrievedCount: retrievedMemories.length,
        memoryTypes: [...new Set(retrievedMemories.map(m => m.type))],
        relevanceScores: retrievedMemories
          .map(m => m.metadata?.relevance || 0)
          .filter(score => score > 0),
        contextWindowUsage: this.calculateContextWindowUsage(retrievedMemories)
      };

      const nodeId = this.visualizer.addContextRetrievalNode(
        context.visualization,
        query,
        retrievedMemories,
        'completed'
      );

      // Update node with detailed memory data
      this.visualizer.updateNode(
        context.visualization,
        nodeId,
        {
          data: {
            ...memoryData,
            memories: this.config.includeContextData 
              ? retrievedMemories.map(m => ({
                  id: m.id,
                  type: m.type,
                  content: m.content.substring(0, 200),
                  timestamp: m.created_at,
                  relevance: m.metadata?.relevance
                }))
              : undefined
          }
        }
      );

      // Create edge from parent
      if (parentNodeId) {
        this.visualizer.addEdge(
          context.visualization,
          parentNodeId,
          nodeId,
          VisualizationEdgeType.FLOW
        );
      }

      return nodeId;
    } catch (error) {
      throw new VisualizationError(
        'Failed to create memory retrieval visualization node',
        'MEMORY_RETRIEVAL_NODE_CREATION_FAILED',
        { context, query, retrievedCount: retrievedMemories.length, parentNodeId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Creates LLM interaction visualization node
   */
  async createLLMInteractionNode(
    context: AgentVisualizationContext,
    llmData: LLMInteractionVisualizationData,
    systemPrompt: string,
    userPrompt: string,
    parentNodeId?: string
  ): Promise<string> {
    if (!this.config.enabled || !this.config.trackLLMInteraction) {
      return '';
    }

    try {
      const nodeId = this.visualizer.addNode(
        context.visualization,
        VisualizationNodeType.RESPONSE_GENERATION,
        'LLM Processing',
        {
          ...llmData,
          systemPromptPreview: systemPrompt.substring(0, 500),
          userPromptPreview: userPrompt.substring(0, 500),
          ...(this.config.includeContextData && {
            fullSystemPrompt: systemPrompt,
            fullUserPrompt: userPrompt
          }),
          tokenEfficiency: llmData.totalTokens > 0 
            ? (llmData.completionTokens / llmData.totalTokens) * 100 
            : 0
        },
        'in_progress'
      );

      // Create edge from parent
      if (parentNodeId) {
        this.visualizer.addEdge(
          context.visualization,
          parentNodeId,
          nodeId,
          VisualizationEdgeType.FLOW
        );
      }

      return nodeId;
    } catch (error) {
      throw new VisualizationError(
        'Failed to create LLM interaction visualization node',
        'LLM_INTERACTION_NODE_CREATION_FAILED',
        { context, llmData, parentNodeId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Updates LLM interaction node with completion data
   */
  async completeLLMInteractionNode(
    context: AgentVisualizationContext,
    nodeId: string,
    response: AgentResponse,
    actualTokenUsage: LLMInteractionVisualizationData
  ): Promise<void> {
    if (!this.config.enabled || !nodeId) {
      return;
    }

    try {
      this.visualizer.updateNode(
        context.visualization,
        nodeId,
        {
          status: 'completed',
          data: {
            ...actualTokenUsage,
            responseLength: response.content.length,
            hasThoughts: !!response.thoughts,
            thoughtsCount: response.thoughts?.length || 0,
            responsePreview: response.content.substring(0, 300),
            ...(this.config.includeContextData && {
              fullResponse: response.content,
              fullThoughts: response.thoughts
            })
          }
        }
      );
    } catch (error) {
      throw new VisualizationError(
        'Failed to update LLM interaction visualization node',
        'LLM_INTERACTION_NODE_UPDATE_FAILED',
        { context, nodeId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Creates tool execution visualization node
   */
  async createToolExecutionNode(
    context: AgentVisualizationContext,
    toolData: ToolExecutionVisualizationData,
    parentNodeId?: string
  ): Promise<string> {
    if (!this.config.enabled || !this.config.trackToolExecution) {
      return '';
    }

    try {
      const nodeId = this.visualizer.addToolExecutionNode(
        context.visualization,
        toolData.toolName,
        toolData.inputParameters,
        undefined, // Result will be updated later
        'in_progress'
      );

      // Update with detailed tool data
      this.visualizer.updateNode(
        context.visualization,
        nodeId,
        {
          data: {
            ...toolData,
            parametersPreview: JSON.stringify(toolData.inputParameters).substring(0, 200),
            ...(this.config.includeContextData && {
              fullParameters: toolData.inputParameters
            })
          }
        }
      );

      // Create edge from parent
      if (parentNodeId) {
        this.visualizer.addEdge(
          context.visualization,
          parentNodeId,
          nodeId,
          VisualizationEdgeType.FLOW
        );
      }

      return nodeId;
    } catch (error) {
      throw new VisualizationError(
        'Failed to create tool execution visualization node',
        'TOOL_EXECUTION_NODE_CREATION_FAILED',
        { context, toolData, parentNodeId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Creates task creation visualization node
   */
  async createTaskCreationNode(
    context: AgentVisualizationContext,
    taskData: TaskCreationVisualizationData,
    parentNodeId?: string
  ): Promise<string> {
    if (!this.config.enabled || !this.config.trackTaskCreation) {
      return '';
    }

    try {
      const nodeId = this.visualizer.addNode(
        context.visualization,
        VisualizationNodeType.PLANNING,
        `Task Created: ${taskData.taskType}`,
        {
          ...taskData,
          scheduledForHuman: taskData.scheduledTime?.toLocaleString(),
          priorityLevel: this.getPriorityLevel(taskData.priority),
          capabilityCount: taskData.requiredCapabilities.length
        },
        'completed'
      );

      // Create edge from parent
      if (parentNodeId) {
        this.visualizer.addEdge(
          context.visualization,
          parentNodeId,
          nodeId,
          VisualizationEdgeType.FLOW
        );
      }

      return nodeId;
    } catch (error) {
      throw new VisualizationError(
        'Failed to create task creation visualization node',
        'TASK_CREATION_NODE_CREATION_FAILED',
        { context, taskData, parentNodeId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Finalizes the visualization with completion data
   */
  async finalizeVisualization(
    context: AgentVisualizationContext,
    finalResponse: AgentResponse,
    processingTimeMs: number
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      // Create a thinking result with the processing metrics for finalization
      const thinkingResult: Partial<ThinkingResult> = {
        reasoning: finalResponse.thoughts || [],
        context: {
          processingTimeMs,
          responseLength: finalResponse.content.length,
          hasThoughts: !!finalResponse.thoughts,
          metadata: finalResponse.metadata
        }
      };

      this.visualizer.finalizeVisualization(
        context.visualization,
        finalResponse.content,
        thinkingResult as ThinkingResult
      );

      // Save the visualization
      await this.visualizer.saveVisualization(context.visualization);
    } catch (error) {
      throw new VisualizationError(
        'Failed to finalize visualization',
        'VISUALIZATION_FINALIZATION_FAILED',
        { context, processingTimeMs, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Pure function to format thinking content for display
   */
  private formatThinkingContent(thinkingResult: ThinkingResult): string {
    const parts: string[] = [];
    
    parts.push(`Intent: ${thinkingResult.intent.primary} (${(thinkingResult.intent.confidence * 100).toFixed(1)}%)`);
    
    if (thinkingResult.entities.length > 0) {
      parts.push(`Entities: ${thinkingResult.entities.map(e => `${e.type}:${e.value}`).join(', ')}`);
    }
    
    if (thinkingResult.requestType) {
      parts.push(`Request Type: ${thinkingResult.requestType.type} (${(thinkingResult.requestType.confidence * 100).toFixed(1)}%)`);
    }
    
    if (thinkingResult.reasoning && thinkingResult.reasoning.length > 0) {
      parts.push(`Reasoning: ${thinkingResult.reasoning.join(' → ')}`);
    }
    
    return parts.join('\n');
  }

  /**
   * Pure function to calculate context window usage
   */
  private calculateContextWindowUsage(memories: MemoryEntry[]): MemoryRetrievalVisualizationData['contextWindowUsage'] {
    const totalChars = memories.reduce((sum, m) => sum + m.content.length, 0);
    const estimatedTokens = Math.ceil(totalChars / 4); // Rough token estimation
    const maxContextTokens = 8000; // Typical context window size
    
    return {
      used: estimatedTokens,
      available: maxContextTokens,
      percentage: Math.min((estimatedTokens / maxContextTokens) * 100, 100)
    };
  }

  /**
   * Pure function to get priority level description
   */
  private getPriorityLevel(priority: number): string {
    if (priority >= 8) return 'Critical';
    if (priority >= 6) return 'High';
    if (priority >= 4) return 'Medium';
    if (priority >= 2) return 'Low';
    return 'Minimal';
  }
} 