import { ulid } from 'ulid';

/**
 * Supported external workflow platforms
 */
export type WorkflowPlatform = 'n8n' | 'zapier';

/**
 * Workflow execution status
 */
export type WorkflowExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Workflow parameter types
 */
export type WorkflowParameterType = 'string' | 'number' | 'boolean' | 'object' | 'array';

/**
 * Structured identifier for workflow entities
 */
export interface WorkflowId {
  readonly id: string; // ULID
  readonly prefix: string;
  readonly timestamp: Date;
  toString(): string;
}

/**
 * Workflow parameter definition
 */
export interface WorkflowParameter {
  readonly name: string;
  readonly type: WorkflowParameterType;
  readonly required: boolean;
  readonly description?: string;
  readonly defaultValue?: unknown;
  readonly validation?: {
    readonly min?: number;
    readonly max?: number;
    readonly pattern?: string;
    readonly enum?: readonly unknown[];
  };
}

/**
 * External workflow configuration
 */
export interface ExternalWorkflowConfig {
  readonly id: WorkflowId;
  readonly name: string;
  readonly platform: WorkflowPlatform;
  readonly workflowIdOrUrl: string;
  readonly nlpTriggers: readonly string[];
  readonly description: string;
  readonly parameters: readonly WorkflowParameter[];
  readonly createdAt: Date;
  readonly lastExecuted?: Date;
  readonly executionCount: number;
  readonly isActive: boolean;
  readonly tags: readonly string[];
  readonly estimatedDurationMs: number;
}

/**
 * Workflow execution request
 */
export interface WorkflowExecutionRequest {
  readonly workflowId: string;
  readonly parameters: Record<string, unknown>;
  readonly initiatedBy: {
    readonly type: 'agent' | 'user' | 'system';
    readonly id: string;
    readonly name?: string;
  };
  readonly sessionId?: string;
  readonly priority: 'low' | 'normal' | 'high';
  readonly timeoutMs?: number;
}

/**
 * Workflow execution result
 */
export interface WorkflowExecutionResult {
  readonly executionId: WorkflowId;
  readonly workflowId: string;
  readonly status: WorkflowExecutionStatus;
  readonly startedAt: Date;
  readonly completedAt?: Date;
  readonly durationMs?: number;
  readonly result?: unknown;
  readonly error?: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, unknown>;
  };
  readonly logs: readonly WorkflowExecutionLog[];
  readonly costUsd?: number;
}

/**
 * Workflow execution log entry
 */
export interface WorkflowExecutionLog {
  readonly timestamp: Date;
  readonly level: 'debug' | 'info' | 'warn' | 'error';
  readonly message: string;
  readonly context?: Record<string, unknown>;
}

/**
 * Workflow execution history
 */
export interface WorkflowExecutionHistory {
  readonly workflowId: string;
  readonly executions: readonly WorkflowExecutionResult[];
  readonly totalExecutions: number;
  readonly successRate: number;
  readonly averageDurationMs: number;
  readonly totalCostUsd: number;
}

/**
 * Workflow platform status
 */
export interface WorkflowPlatformStatus {
  readonly platform: WorkflowPlatform;
  readonly isConnected: boolean;
  readonly lastChecked: Date;
  readonly version?: string;
  readonly rateLimits?: {
    readonly requestsPerMinute: number;
    readonly requestsRemaining: number;
    readonly resetAt: Date;
  };
  readonly health: 'healthy' | 'degraded' | 'unhealthy';
  readonly issues: readonly string[];
}

/**
 * Base interface for external workflow services
 */
export interface IExternalWorkflowService {
  readonly platform: WorkflowPlatform;
  
  /**
   * Test connection to the platform
   */
  testConnection(): Promise<boolean>;
  
  /**
   * Get platform status and health information
   */
  getStatus(): Promise<WorkflowPlatformStatus>;
  
  /**
   * Execute a workflow
   */
  executeWorkflow(request: WorkflowExecutionRequest): Promise<WorkflowExecutionResult>;
  
  /**
   * Get workflow execution status
   */
  getExecutionStatus(executionId: string): Promise<WorkflowExecutionResult>;
  
  /**
   * Cancel a running workflow execution
   */
  cancelExecution(executionId: string): Promise<boolean>;
  
  /**
   * Get workflow execution history
   */
  getExecutionHistory(workflowId: string, limit?: number): Promise<WorkflowExecutionHistory>;
  
  /**
   * Validate workflow parameters
   */
  validateParameters(workflowId: string, parameters: Record<string, unknown>): Promise<ValidationResult>;
}

/**
 * Validation result
 */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly ValidationError[];
}

/**
 * Validation error
 */
export interface ValidationError {
  readonly field: string;
  readonly code: string;
  readonly message: string;
  readonly value?: unknown;
}

/**
 * Workflow ID generator utility
 */
export class WorkflowIdGenerator {
  static generate(prefix: string): WorkflowId {
    const timestamp = new Date();
    const id = ulid(timestamp.getTime());
    return {
      id,
      prefix,
      timestamp,
      toString: () => `${prefix}_${id}`
    };
  }
  
  static parse(structuredId: string): WorkflowId {
    const [prefix, id] = structuredId.split('_');
    if (!prefix || !id) {
      throw new Error(`Invalid workflow ID format: ${structuredId}`);
    }
    
    // Extract timestamp from ULID
    const timestamp = new Date(parseInt(id.substring(0, 10), 32));
    
    return {
      id,
      prefix,
      timestamp,
      toString: () => structuredId
    };
  }
} 