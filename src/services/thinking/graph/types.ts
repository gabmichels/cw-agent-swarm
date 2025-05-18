import { WorkingMemoryItem, FileReference } from '../types';

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
  toolResults?: Record<string, any>;
  
  /**
   * Final response
   */
  response?: string;
  
  /**
   * Tracking of stored cognitive artifacts
   */
  cognitiveArtifacts?: CognitiveArtifactTracker;
  
  /**
   * Errors that occurred during workflow execution
   */
  errors?: NodeError[];
  
  /**
   * Current workflow status
   */
  status?: 'in_progress' | 'completed' | 'failed' | 'recovered';
  
  /**
   * Fallback response if the workflow fails
   */
  fallbackResponse?: string;
} 