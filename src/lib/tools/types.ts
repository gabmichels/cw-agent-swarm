/**
 * Common types for tools system
 */

import { StructuredId } from '../../utils/ulid';

/**
 * Base tool interface representing a callable function
 */
export interface Tool {
  /**
   * Unique identifier for the tool
   */
  id: string;
  
  /**
   * Display name of the tool
   */
  name: string;
  
  /**
   * Description of what the tool does
   */
  description: string;
  
  /**
   * Tool category for grouping and filtering
   */
  category: ToolCategory;
  
  /**
   * The actual function to execute
   * @param args Arguments for the tool execution
   * @returns Result of the tool execution
   */
  execute: (args: Record<string, unknown>) => Promise<ToolExecutionResult>;
  
  /**
   * Whether the tool is currently enabled
   */
  enabled: boolean;
  
  /**
   * Schema defining expected input parameters
   */
  schema?: Record<string, unknown>;
  
  /**
   * Optional metadata for additional tool information
   */
  metadata?: Record<string, unknown>;
}

/**
 * Categories for tools
 */
export enum ToolCategory {
  SYSTEM = 'system',
  FILE = 'file',
  WEB = 'web',
  DATA = 'data',
  COMMUNICATION = 'communication',
  UTILITY = 'utility',
  CUSTOM = 'custom'
}

/**
 * Represents the outcome of a tool execution
 */
export interface ToolExecutionResult {
  /**
   * Unique ID for this execution result
   */
  id: StructuredId;
  
  /**
   * ID of the tool that was executed
   */
  toolId: string;
  
  /**
   * Whether the execution was successful
   */
  success: boolean;
  
  /**
   * Result data if successful
   */
  data?: unknown;
  
  /**
   * Error information if unsuccessful
   */
  error?: {
    message: string;
    code: string;
    details?: unknown;
  };
  
  /**
   * Execution metrics
   */
  metrics: {
    startTime: number;
    endTime: number;
    durationMs: number;
  };
}

/**
 * Options for tool execution
 */
export interface ToolExecutionOptions {
  /**
   * Maximum time to wait for execution (ms)
   */
  timeout?: number;
  
  /**
   * Whether to retry on failure
   */
  retry?: {
    maxAttempts: number;
    delayMs: number;
  };
  
  /**
   * Context to pass to the tool
   */
  context?: Record<string, unknown>;
}

/**
 * Strategy for handling tool fallbacks
 */
export enum FallbackStrategy {
  /**
   * Try next tool in sequence
   */
  SEQUENTIAL = 'sequential',
  
  /**
   * Try similar tools based on function
   */
  SIMILARITY = 'similarity',
  
  /**
   * Try tools based on past performance
   */
  PERFORMANCE = 'performance',
  
  /**
   * No fallback
   */
  NONE = 'none'
} 