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
} 