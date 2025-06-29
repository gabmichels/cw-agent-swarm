/**
 * Foundation Types - Core Type Definitions
 * 
 * Comprehensive type definitions for the Unified Tool Foundation system.
 * These types provide the foundation for all tool operations while maintaining
 * strict type safety and supporting the architectural principles defined in
 * @IMPLEMENTATION_GUIDELINES.md
 */

import { ulid } from 'ulid';
import { ToolCategory, ToolCapability, ToolStatus } from '../enums/ToolEnums';

/**
 * ULID-based tool identifier for business logic
 */
export type ToolId = string; // ULID format: 01ARZ3NDEKTSV4RRFFQ69G5FAV

/**
 * Tool identifier can be ULID, constant name, or legacy string
 */
export type ToolIdentifier = ToolId | string;

/**
 * Generic tool parameters - flexible for different tool types
 */
export type ToolParameters = Record<string, unknown>;

/**
 * Tool execution result with consistent structure
 */
export interface ToolResult {
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: string;
  readonly metadata?: {
    readonly executionTimeMs: number;
    readonly toolId: ToolId;
    readonly toolName: string;
    readonly timestamp: string;
    readonly context?: Record<string, unknown>;
  };
}

/**
 * Execution context provides environment and permissions
 */
export interface ExecutionContext {
  readonly agentId?: string;
  readonly userId?: string;
  readonly workspaceId?: string;
  readonly sessionId?: string;
  readonly permissions?: readonly string[];
  readonly capabilities?: readonly ToolCapability[];
  readonly metadata?: Record<string, unknown>;
  readonly traceId?: string; // For request tracing
}

/**
 * Tool parameter schema for validation
 */
export interface ToolParameterSchema {
  readonly [paramName: string]: {
    readonly type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    readonly required: boolean;
    readonly description?: string;
    readonly default?: unknown;
    readonly validation?: {
      readonly min?: number;
      readonly max?: number;
      readonly pattern?: string;
      readonly enum?: readonly unknown[];
    };
  };
}

/**
 * Tool executor function signature
 */
export type ToolExecutor = (
  params: ToolParameters,
  context: ExecutionContext
) => Promise<ToolResult>;

/**
 * Comprehensive tool definition for unified foundation
 */
export interface UnifiedToolDefinition {
  readonly id: ToolId; // ULID
  readonly name: string; // From constants (no string literals)
  readonly displayName: string;
  readonly description: string;
  readonly category: ToolCategory;
  readonly capabilities: readonly ToolCapability[];
  readonly parameters: ToolParameterSchema;
  readonly executor: ToolExecutor;
  readonly metadata: {
    readonly version: string;
    readonly author: string;
    readonly provider: string;
    readonly tags?: readonly string[];
    readonly documentation?: string;
    readonly examples?: readonly Record<string, unknown>[];
  };
  readonly enabled: boolean;
  readonly status: ToolStatus;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

/**
 * Unified tool representation (registered tool)
 */
export interface UnifiedTool extends UnifiedToolDefinition {
  readonly registeredAt: string;
  readonly lastExecutedAt?: string;
  readonly executionCount: number;
  readonly successRate: number;
  readonly averageExecutionTime: number;
}

/**
 * Tool discovery criteria for finding tools
 */
export interface ToolDiscoveryCriteria {
  readonly categories?: readonly ToolCategory[];
  readonly capabilities?: readonly ToolCapability[];
  readonly tags?: readonly string[];
  readonly enabled?: boolean;
  readonly status?: ToolStatus;
  readonly provider?: string;
  readonly limit?: number;
  readonly offset?: number;
  readonly sortBy?: 'name' | 'category' | 'successRate' | 'executionCount' | 'lastExecuted';
  readonly sortOrder?: 'asc' | 'desc';
  readonly intent?: string; // Natural language intent for semantic search
}

/**
 * Search context for semantic tool search
 */
export interface SearchContext {
  readonly agentCapabilities?: readonly ToolCapability[];
  readonly previousTools?: readonly ToolId[];
  readonly userPreferences?: Record<string, unknown>;
  readonly workflowContext?: string;
}

/**
 * Tool health status information
 */
export interface ToolHealthStatus {
  readonly toolId: ToolId;
  readonly status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  readonly lastHealthCheck: string;
  readonly responseTime?: number;
  readonly errorRate?: number;
  readonly availability?: number;
  readonly issues?: readonly string[];
}

/**
 * Tool execution metrics
 */
export interface ToolMetrics {
  readonly toolId: ToolId;
  readonly executionCount: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly successRate: number;
  readonly averageExecutionTime: number;
  readonly minExecutionTime: number;
  readonly maxExecutionTime: number;
  readonly lastExecutedAt?: string;
  readonly totalExecutionTime: number;
  readonly errorTypes?: Record<string, number>;
}

/**
 * Tool validation result
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors?: readonly string[];
  readonly warnings?: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

/**
 * Tool registration result
 */
export interface ToolRegistrationResult {
  readonly success: boolean;
  readonly toolId?: ToolId;
  readonly error?: string;
  readonly warnings?: readonly string[];
}

/**
 * Tool search result with relevance scoring
 */
export interface ToolSearchResult {
  readonly tool: UnifiedTool;
  readonly relevanceScore: number;
  readonly matchReasons: readonly string[];
}

/**
 * Tool execution statistics
 */
export interface ToolExecutionStats {
  readonly totalTools: number;
  readonly enabledTools: number;
  readonly totalExecutions: number;
  readonly successfulExecutions: number;
  readonly failedExecutions: number;
  readonly averageExecutionTime: number;
  readonly topTools: readonly {
    readonly toolId: ToolId;
    readonly name: string;
    readonly executionCount: number;
  }[];
}

/**
 * Tool capability matrix for cross-system compatibility
 */
export interface ToolCapabilityMatrix {
  readonly [capability: string]: {
    readonly tools: readonly ToolId[];
    readonly providers: readonly string[];
    readonly complexity: 'low' | 'medium' | 'high';
  };
} 