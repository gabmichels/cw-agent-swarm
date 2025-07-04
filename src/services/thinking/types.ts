/**
 * Types for the ThinkingService
 */

/**
 * Agent information for thinking options
 */
export interface IAgentInfo {
  /**
   * Agent name
   */
  name?: string;

  /**
   * Agent description
   */
  description?: string;

  /**
   * Agent system prompt
   */
  systemPrompt?: string;

  /**
   * Agent capabilities
   */
  capabilities?: string[];

  /**
   * Agent personality traits
   */
  traits?: string[];
}

/**
 * Visualization node for tracking thinking process
 */
export interface IVisualizationNode {
  id: string;
  type: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  data: Record<string, unknown>;
  metrics?: {
    startTime?: number;
    endTime?: number;
    duration?: number;
  };
}

/**
 * Visualization object for thinking process
 */
export interface IVisualization {
  nodes: IVisualizationNode[];
  edges: Array<{
    from: string;
    to: string;
    type: string;
  }>;
}

/**
 * Visualizer service interface
 */
export interface IVisualizer {
  addNode(
    visualization: IVisualization,
    type: string,
    title: string,
    data: Record<string, unknown>,
    status: string
  ): void;
}

/**
 * Tool execution result interface
 */
export interface IToolExecutionResult {
  /**
   * Whether the execution was successful
   */
  success: boolean;

  /**
   * Result data
   */
  data: unknown;

  /**
   * Output string representation of the result
   */
  output?: string;

  /**
   * Error message if the execution failed
   */
  error?: string;

  /**
   * Execution time in milliseconds
   */
  executionTime: number;

  /**
   * Metadata about the execution
   */
  metadata?: {
    /**
     * ID of the tool that was executed
     */
    toolId: string;

    /**
     * When the execution started
     */
    startTime: string;

    /**
     * When the execution ended
     */
    endTime: string;

    /**
     * Parameters used in the execution
     */
    parameters: Record<string, unknown>;
  };
}

/**
 * The outcome of analyzing user input through the thinking process
 */
export interface ThinkingResult {
  /**
   * Primary intent and alternatives identified from the user's message
   */
  intent: {
    primary: string;
    confidence: number;
    alternatives?: Array<{ intent: string, confidence: number }>;
    isSummaryRequest?: boolean;
  };

  /**
   * Classification of request type for smart routing
   */
  requestType: {
    type: 'PURE_LLM_TASK' | 'EXTERNAL_TOOL_TASK' | 'SCHEDULED_TASK' | 'WORKFLOW_TASK' | 'APPROVAL_TASK' | 'CROSS_SYSTEM_TASK';
    confidence: number;
    reasoning: string;
    requiredTools?: string[];
    availableTools?: string[];
    missingTools?: string[];
    delegationSuggested?: boolean;
    suggestedSchedule?: {
      timeExpression?: string;
      recurring?: boolean;
      intervalExpression?: string;
    };
  };

  /**
   * Entities extracted from the user's message
   */
  entities: Array<{
    type: string;
    value: string;
    confidence: number;
  }>;

  /**
   * Whether the task should be delegated to another agent
   */
  shouldDelegate: boolean;

  /**
   * Required capabilities for delegation
   */
  requiredCapabilities: string[];

  /**
   * Priority of the task (1-10)
   */
  priority: number;

  /**
   * Whether the task is urgent
   */
  isUrgent: boolean;

  /**
   * Task complexity (1-10)
   */
  complexity: number;

  /**
   * Calculated importance level of this thinking process
   */
  importance?: import('../../constants/memory').ImportanceLevel;

  /**
   * Calculated importance score (0-1) of this thinking process
   */
  importanceScore?: number;

  /**
   * Additional context for the task
   */
  context?: Record<string, unknown>;

  /**
   * Reasoning steps that led to this analysis
   */
  reasoning: string[];

  /**
   * Context used to generate this analysis
   */
  contextUsed: {
    memories: string[];
    files: string[];
    tools: string[];
  };

  /**
   * Planned steps for executing the user's request
   */
  planSteps?: string[];
}

/**
 * Options for the thinking process
 */
export interface ThinkingOptions {
  /**
   * User ID for context retrieval
   */
  userId?: string;

  /**
   * Message IDs to exclude from memory retrieval (e.g., current message being responded to)
   */
  excludeMessageIds?: string[];

  /**
   * Flag indicating if this is a summary request (for expanded conversation history and working memory preference)
   */
  isSummaryRequest?: boolean;

  /**
   * Chat history to include
   */
  chatHistory?: Array<{
    id: string;
    content: string;
    sender: {
      id: string;
      name: string;
      role: 'user' | 'assistant' | 'system';
    };
    timestamp: Date;
  }>;

  /**
   * Working memory items to include
   */
  workingMemory?: WorkingMemoryItem[];

  /**
   * Context files to consider
   */
  contextFiles?: FileReference[];

  /**
   * Whether to include debugging information
   */
  debug?: boolean;

  /**
   * Agent information for persona-based responses
   */
  agentInfo?: IAgentInfo;

  /**
   * Visualization object for tracking thinking process
   */
  visualization?: IVisualization;

  /**
   * Visualizer service for creating visualization nodes
   */
  visualizer?: IVisualizer;

  /**
   * Agent instance for tool discovery and capability analysis
   */
  agent?: import('./graph/types').IAgent;
}

/**
 * An item stored in working memory
 */
export interface WorkingMemoryItem {
  /**
   * Unique identifier for the item
   */
  id: string;

  /**
   * The content of the memory item
   */
  content: string;

  /**
   * Type of memory item
   */
  type: 'entity' | 'fact' | 'preference' | 'task' | 'goal' | 'message';

  /**
   * Tags for better retrieval
   */
  tags: string[];

  /**
   * When the item was added to working memory
   */
  addedAt: Date;

  /**
   * Priority of the item (higher = more important)
   */
  priority: number;

  /**
   * Expiration time (null = no expiration)
   */
  expiresAt: Date | null;

  /**
   * Related entities or context
   */
  relatedTo?: string[];

  /**
   * Confidence in this memory
   */
  confidence: number;

  /**
   * User ID this memory belongs to
   */
  userId: string;

  /**
   * Original relevance score from retrieval (for internal use)
   */
  _relevanceScore?: number;

  /**
   * Additional metadata about the memory
   */
  metadata?: {
    importance_score?: number;
    message_type?: string;
    contentSummary?: string;
    [key: string]: unknown;
  };
}

/**
 * Reference to a file in the system
 */
export interface FileReference {
  /**
   * Unique identifier for the file
   */
  id: string;

  /**
   * File name
   */
  name: string;

  /**
   * File type
   */
  type: string;

  /**
   * Path to the file
   */
  path: string;

  /**
   * File metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Options for memory consolidation
 */
export interface ConsolidationOptions {
  /**
   * Minimum confidence for retention
   */
  minConfidence?: number;

  /**
   * Maximum items to retain
   */
  maxItems?: number;

  /**
   * Whether to generate insights from consolidated memories
   */
  generateInsights?: boolean;
}

import { TaskStatus } from '@/constants/task';

export interface ToolExecutionResult {
  /**
   * Whether the execution was successful
   */
  success: boolean;

  /**
   * Result data
   */
  data: unknown;

  /**
   * Output string representation of the result
   */
  output?: string;

  /**
   * Error message if the execution failed
   */
  error?: string;

  /**
   * Execution time in milliseconds
   */
  executionTime: number;

  /**
   * Metadata about the execution
   */
  metadata?: {
    /**
     * ID of the tool that was executed
     */
    toolId: string;

    /**
     * When the execution started
     */
    startTime: string;

    /**
     * When the execution ended
     */
    endTime: string;

    /**
     * Parameters used in the execution
     */
    parameters: Record<string, unknown>;
  };
} 