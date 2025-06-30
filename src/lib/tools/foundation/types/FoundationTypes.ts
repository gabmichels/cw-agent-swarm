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

// Re-export enums for external use
export { ToolCategory, ToolCapability, ToolStatus };

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
  readonly toolId?: ToolId;
  readonly durationMs?: number;
  readonly startedAt?: Date;
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
  readonly maxExecutionTime?: number;
}

/**
 * Tool parameter schema for validation
 */
export interface ToolParameterSchema {
  readonly type?: 'object' | 'array' | 'string' | 'number' | 'boolean'; // Allow array type at schema root and other basic types
  readonly properties?: {
    readonly [paramName: string]: {
      readonly type: 'string' | 'number' | 'boolean' | 'object' | 'array';
      readonly description?: string;
      readonly default?: unknown;
      readonly minLength?: number;
      readonly maxLength?: number;
      readonly items?: ToolParameterSchema; // Nested schema for array items
      readonly properties?: { // Added to support nested object schemas
        readonly [nestedParamName: string]: ToolParameterSchema; // Nested properties for object types
      };
      readonly additionalProperties?: boolean | ToolParameterSchema; // For object types, allowing extra properties
      readonly validation?: {
        readonly min?: number;
        readonly max?: number;
        readonly pattern?: string;
        readonly enum?: readonly unknown[];
      };
    };
  };
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean | ToolParameterSchema; // For top-level object schemas
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
  readonly parameters?: ToolParameterSchema;
  readonly permissions?: readonly string[];
  readonly requiresWorkspace?: boolean;
  readonly executor: ToolExecutor;
  readonly metadata: {
    readonly version: string;
    readonly author: string;
    readonly provider: string;
    readonly tags?: readonly string[];
    readonly documentation?: string;
    readonly examples?: readonly Record<string, unknown>[];
    readonly timeout?: number;
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
  readonly tags?: readonly string[];
  readonly requiresWorkspace?: boolean;
}

/**
 * Tool discovery criteria for finding tools
 */
export interface ToolDiscoveryCriteria {
  readonly categories?: readonly ToolCategory[];
  readonly capabilities?: readonly ToolCapability[];
  readonly tags?: readonly string[];
  readonly enabled?: boolean;
  readonly enabledOnly?: boolean;
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
  readonly intent?: string;
  readonly maxResults?: number;
  readonly preferredCategories?: readonly ToolCategory[];
}

/**
 * Tool similarity result for finding similar tools
 */
export interface ToolSimilarity {
  readonly tool: UnifiedTool;
  readonly similarityScore: number;
  readonly matchingAttributes: readonly string[];
}

/**
 * Tool recommendation with confidence scoring
 */
export interface ToolRecommendation {
  readonly tool: UnifiedTool;
  readonly recommendationScore: number;
  readonly reasons: readonly string[];
  readonly category: ToolCategory;
}

/**
 * Tool validation result
 */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

/**
 * Tool registration result
 */
export interface ToolRegistrationResult {
  readonly success: boolean;
  readonly toolId: ToolId;
  readonly registeredAt: Date;
  readonly errors?: readonly string[];
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

/**
 * Tool Discovery Method
 */
export type ToolDiscoveryMethod = 'semantic' | 'keyword' | 'category' | 'capability' | 'hybrid';

/**
 * Tool Discovery Criteria - now extends Record<string, unknown> for error handling
 */
export interface ToolDiscoveryCriteria extends Record<string, unknown> {
  readonly category?: ToolCategory;
  readonly capabilities?: readonly ToolCapability[];
  readonly tags?: readonly string[];
  readonly includeDeprecated?: boolean;
  readonly maxResults?: number;
  readonly minRelevanceScore?: number;
}

/**
 * Search Context - now extends Record<string, unknown> for error handling
 */
export interface SearchContext extends Record<string, unknown> {
  readonly userId?: string;
  readonly agentId?: string;
  readonly workspaceId?: string;
  readonly permissions?: readonly string[];
  readonly preferences?: Record<string, unknown>;
  readonly filters?: Record<string, unknown>;
}

/**
 * Tool Health Status
 */
export interface ToolHealthStatus {
  readonly toolId: ToolId;
  readonly isHealthy: boolean;
  readonly status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  readonly lastChecked: Date;
  readonly lastHealthCheck: Date;
  readonly errors?: readonly string[];
  readonly warnings?: readonly string[];
  readonly metrics?: {
    readonly responseTime: number;
    readonly successRate: number;
    readonly errorRate: number;
  };
}

/**
 * Tool Metrics
 */
export interface ToolMetrics {
  readonly toolId: ToolId;
  readonly executionCount: number;
  readonly successCount: number;
  readonly errorCount: number;
  readonly failureCount: number;
  readonly averageExecutionTime: number;
  readonly minExecutionTime: number;
  readonly maxExecutionTime: number;
  readonly totalExecutionTime: number;
  readonly lastExecuted?: Date;
  readonly errorRate: number;
  readonly successRate: number;
}

/**
 * Parameter Validation Error
 */
export interface ParameterValidationError {
  readonly parameter: string;
  readonly error: string;
  readonly expectedType: string;
  readonly actualType: string;
  readonly value?: unknown;
}

/**
 * Parameter Validation Warning
 */
export interface ParameterValidationWarning {
  readonly parameter: string;
  readonly warning: string;
  readonly suggestion?: string;
}

/**
 * Security Issue
 */
export interface SecurityIssue {
  readonly issue: string;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly recommendation: string;
}

/**
 * Performance Issue
 */
export interface PerformanceIssue {
  readonly issue: string;
  readonly impact: 'low' | 'medium' | 'high';
  readonly recommendation: string;
}

/**
 * Resource Requirements
 */
export interface ResourceRequirements {
  readonly memory: number;
  readonly cpu: number;
  readonly network: boolean;
  readonly storage: number;
} 