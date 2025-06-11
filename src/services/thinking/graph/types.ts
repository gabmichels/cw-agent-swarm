import { WorkingMemoryItem, FileReference } from '../types';

/**
 * Agent interface for tool discovery and capability analysis
 */
export interface IAgent {
  /**
   * Get the agent's unique identifier
   */
  getId(): string;
  
  /**
   * Get the agent's capabilities
   */
  getCapabilities(): Promise<string[]>;
  
  /**
   * Get a manager by type (for tool discovery)
   */
  getManager<T>(managerType: unknown): T | null;
}

/**
 * Entity extracted from user input
 */
export interface Entity {
  type: string;
  value: string;
  confidence: number;
}

/**
 * Intent identified from user input
 */
export interface Intent {
  name: string;
  confidence: number;
  alternatives?: Array<{name: string, confidence: number}>;
  isSummaryRequest?: boolean;
}

/**
 * Step in the execution plan
 */
export interface ExecutionStep {
  description: string;
  tools?: string[];
  isDone?: boolean;
}

/**
 * Reference to a tool that can be used in execution
 */
export interface ToolReference {
  name: string;
  description: string;
  confidence: number;
}

/**
 * Tracks stored cognitive artifacts and their relationships
 */
export interface CognitiveArtifactTracker {
  /**
   * IDs of thought memories
   */
  thoughtIds: string[];
  
  /**
   * IDs of entity memories
   */
  entityIds: string[];
  
  /**
   * ID of the reasoning memory
   */
  reasoningId: string | null;
  
  /**
   * ID of the plan memory
   */
  planId: string | null;
}

/**
 * Error information for workflow nodes
 */
export interface NodeError {
  /**
   * Node name where the error occurred
   */
  nodeName: string;
  
  /**
   * Error message
   */
  message: string;
  
  /**
   * Error stack trace
   */
  stack?: string;
  
  /**
   * Timestamp when the error occurred
   */
  timestamp: string;
  
  /**
   * Whether recovery was attempted
   */
  recoveryAttempted: boolean;
  
  /**
   * Whether recovery was successful
   */
  recoverySuccessful?: boolean;
  
  /**
   * Recovery strategy used
   */
  recoveryStrategy?: string;
}

/**
 * Agent persona information
 */
export interface AgentPersona {
  /**
   * Agent name
   */
  name: string;
  
  /**
   * Agent description/role
   */
  description: string;
  
  /**
   * Agent capabilities
   */
  capabilities?: string[];
  
  /**
   * Agent system prompt
   */
  systemPrompt?: string;
  
  /**
   * Agent personality traits
   */
  traits?: string[];
}

/**
 * Additional metadata for thinking state
 */
export interface ThinkingMetadata {
  /**
   * Agent instance for tool discovery and capability analysis
   */
  agent?: IAgent;
  
  /**
   * Workflow execution context
   */
  executionContext?: {
    startTime: Date;
    nodeHistory: string[];
    retryCount: number;
  };
  
  /**
   * Performance metrics
   */
  performance?: {
    memoryRetrievalTime?: number;
    llmCallTime?: number;
    totalProcessingTime?: number;
  };
  
  /**
   * Debug information
   */
  debug?: {
    enableLogging: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
    traceId?: string;
  };
}

/**
 * State object for the thinking workflow
 */
export interface ThinkingState {
  /**
   * User input
   */
  input: string;
  
  /**
   * User ID
   */
  userId: string;
  
  /**
   * Agent persona information
   */
  agentPersona?: AgentPersona;
  
  /**
   * Memories retrieved for context
   */
  contextMemories?: WorkingMemoryItem[];
  
  /**
   * Files retrieved for context
   */
  contextFiles?: FileReference[];
  
  /**
   * Working memory items
   */
  workingMemory?: WorkingMemoryItem[];
  
  /**
   * Formatted memory context for LLM prompt
   */
  formattedMemoryContext?: string;
  
  /**
   * Intent identified from the input
   */
  intent?: Intent;
  
  /**
   * Request type classification for smart routing
   */
  requestType?: {
    type: 'PURE_LLM_TASK' | 'EXTERNAL_TOOL_TASK' | 'SCHEDULED_TASK';
    confidence: number;
    reasoning: string;
    requiredTools?: string[];
    availableTools?: string[];
    missingTools?: string[];
    delegationSuggested?: boolean;
    suggestedSchedule?: {
      scheduledFor?: Date;
      recurring?: boolean;
      intervalExpression?: string;
    };
  };
  
  /**
   * Entities extracted from the input
   */
  entities?: Entity[];
  
  /**
   * Whether the task should be delegated
   */
  shouldDelegate?: boolean;
  
  /**
   * Reason for delegation decision
   */
  delegationReason?: string;
  
  /**
   * Target for delegation
   */
  delegationTarget?: string;
  
  /**
   * Execution plan
   */
  plan?: string[];
  
  /**
   * Reasoning steps
   */
  reasoning?: string[];
  
  /**
   * Tools selected for use
   */
  tools?: string[];
  
  /**
   * Results from executed tools
   */
  toolResults?: Record<string, unknown>;
  
  /**
   * Final response
   */
  response?: string;
  
  /**
   * Tracking of stored cognitive artifacts
   */
  cognitiveArtifacts?: CognitiveArtifactTracker;
  
  /**
   * Additional metadata with proper typing
   */
  metadata?: ThinkingMetadata;
  
  /**
   * Status of the thinking process
   */
  status?: 'in_progress' | 'completed' | 'failed' | 'delegated';
  
  /**
   * Errors encountered during thinking
   */
  errors?: NodeError[];
  
  /**
   * Fallback response if the workflow fails
   */
  fallbackResponse?: string;
  
  /**
   * Context about what was used in processing
   */
  contextUsed?: {
    memories?: WorkingMemoryItem[];
    files?: FileReference[];
    tools?: ToolReference[];
  };
} 