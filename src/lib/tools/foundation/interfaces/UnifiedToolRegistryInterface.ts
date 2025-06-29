/**
 * Unified Tool Registry Interface
 * 
 * Comprehensive interface for tool storage, retrieval, and management
 * within the unified foundation system. Provides semantic search,
 * categorization, and performance optimization capabilities.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - Interface-first design
 * - Comprehensive type safety
 * - Performance-conscious operations
 * - Structured error handling
 */

import {
  UnifiedToolDefinition,
  ToolIdentifier,
  ToolId,
  ToolDiscoveryCriteria,
  ToolHealthStatus,
  ToolMetrics,
  ValidationResult
} from '../types/FoundationTypes';
import { ToolCategory, ToolCapability, ToolStatus } from '../enums/ToolEnums';

/**
 * Interface for the unified tool registry
 * 
 * Manages tool registration, storage, and retrieval with ULID-based
 * identifiers and comprehensive search capabilities.
 */
export interface IUnifiedToolRegistry {
  // ==================== Tool Registration ====================

  /**
   * Register a new tool in the registry
   * @param definition Complete tool definition
   * @returns Registration result with assigned tool ID
   * @throws ToolRegistrationError if registration fails
   */
  registerTool(definition: UnifiedToolDefinition): Promise<ToolRegistrationResult>;

  /**
   * Unregister a tool from the registry
   * @param identifier Tool ID or name to unregister
   * @returns True if tool was removed, false if not found
   */
  unregisterTool(identifier: ToolIdentifier): Promise<boolean>;

  /**
   * Update an existing tool in the registry
   * @param identifier Tool ID or name to update
   * @param updates Partial tool definition with updates
   * @returns True if tool was updated, false if not found
   */
  updateTool(identifier: ToolIdentifier, updates: Partial<UnifiedToolDefinition>): Promise<boolean>;

  // ==================== Tool Retrieval ====================

  /**
   * Get a tool by identifier (ID or name)
   * @param identifier Tool ID or name to retrieve
   * @returns Tool if found, null if not found
   */
  getTool(identifier: ToolIdentifier): Promise<UnifiedTool | null>;

  /**
   * Get multiple tools by identifiers
   * @param identifiers Array of tool IDs or names
   * @returns Array of found tools (may be shorter than input if some not found)
   */
  getTools(identifiers: readonly ToolIdentifier[]): Promise<readonly UnifiedTool[]>;

  /**
   * Get all registered tools
   * @param includeDisabled Whether to include disabled tools
   * @returns Array of all registered tools
   */
  getAllTools(includeDisabled?: boolean): Promise<readonly UnifiedTool[]>;

  /**
   * Get all tool names for error messages and suggestions
   * @param includeDisabled Whether to include disabled tools
   * @returns Array of all tool names
   */
  getAllToolNames(includeDisabled?: boolean): Promise<readonly string[]>;

  // ==================== Tool Discovery ====================

  /**
   * Find tools matching specific criteria
   * @param criteria Search criteria for tool discovery
   * @returns Array of matching tools
   */
  findTools(criteria: ToolDiscoveryCriteria): Promise<readonly UnifiedTool[]>;

  /**
   * Find tools by category
   * @param categories Array of categories to search
   * @param enabled Whether to only return enabled tools
   * @returns Array of tools in specified categories
   */
  findToolsByCategory(categories: readonly ToolCategory[], enabled?: boolean): Promise<readonly UnifiedTool[]>;

  /**
   * Find tools by capabilities
   * @param capabilities Array of capabilities to search
   * @param matchAll Whether all capabilities must be present (AND) or any (OR)
   * @param enabled Whether to only return enabled tools
   * @returns Array of tools with specified capabilities
   */
  findToolsByCapabilities(
    capabilities: readonly ToolCapability[],
    matchAll?: boolean,
    enabled?: boolean
  ): Promise<readonly UnifiedTool[]>;

  /**
   * Find tools by provider
   * @param provider Provider name to search
   * @param enabled Whether to only return enabled tools
   * @returns Array of tools from specified provider
   */
  findToolsByProvider(provider: string, enabled?: boolean): Promise<readonly UnifiedTool[]>;

  /**
   * Find tools by tags
   * @param tags Array of tags to search
   * @param matchAll Whether all tags must be present (AND) or any (OR)
   * @param enabled Whether to only return enabled tools
   * @returns Array of tools with specified tags
   */
  findToolsByTags(
    tags: readonly string[],
    matchAll?: boolean,
    enabled?: boolean
  ): Promise<readonly UnifiedTool[]>;

  /**
   * Find similar tools based on name, description, or capabilities
   * @param identifier Reference tool ID or name
   * @param limit Maximum number of similar tools to return
   * @returns Array of similar tools ordered by similarity
   */
  findSimilarTools(identifier: ToolIdentifier, limit?: number): Promise<readonly UnifiedTool[]>;

  // ==================== Tool Status Management ====================

  /**
   * Enable or disable a tool
   * @param identifier Tool ID or name to update
   * @param enabled True to enable, false to disable
   * @returns True if status was changed, false if tool not found
   */
  setToolEnabled(identifier: ToolIdentifier, enabled: boolean): Promise<boolean>;

  /**
   * Update tool status
   * @param identifier Tool ID or name to update
   * @param status New status for the tool
   * @returns True if status was changed, false if tool not found
   */
  setToolStatus(identifier: ToolIdentifier, status: ToolStatus): Promise<boolean>;

  /**
   * Get tools by status
   * @param status Status to filter by
   * @returns Array of tools with specified status
   */
  getToolsByStatus(status: ToolStatus): Promise<readonly UnifiedTool[]>;

  // ==================== Tool Metrics ====================

  /**
   * Record tool execution for metrics
   * @param toolId Tool ID that was executed
   * @param success Whether execution was successful
   * @param executionTimeMs Execution time in milliseconds
   */
  recordExecution(toolId: ToolId, success: boolean, executionTimeMs: number): Promise<void>;

  /**
   * Update tool's last execution time
   * @param toolId Tool ID to update
   * @param timestamp Execution timestamp
   */
  updateLastExecution(toolId: ToolId, timestamp?: string): Promise<void>;

  /**
   * Get execution statistics for all tools
   * @returns System-wide execution statistics
   */
  getExecutionStats(): Promise<ToolExecutionStats>;

  // ==================== Registry Management ====================

  /**
   * Check if a tool exists in the registry
   * @param identifier Tool ID or name to check
   * @returns True if tool exists, false otherwise
   */
  exists(identifier: ToolIdentifier): Promise<boolean>;

  /**
   * Get total number of registered tools
   * @param enabled Whether to count only enabled tools
   * @returns Total number of tools
   */
  getToolCount(enabled?: boolean): Promise<number>;

  /**
   * Get registry health information
   * @returns Registry health status
   */
  getRegistryHealth(): Promise<{
    readonly healthy: boolean;
    readonly totalTools: number;
    readonly enabledTools: number;
    readonly disabledTools: number;
    readonly errorTools: number;
    readonly issues: readonly string[];
  }>;

  /**
   * Clear all tools from the registry (for testing)
   * @returns True if registry was cleared
   */
  clear(): Promise<boolean>;

  /**
   * Initialize the registry
   * @returns True if initialization was successful
   */
  initialize(): Promise<boolean>;

  /**
   * Shutdown the registry gracefully
   * @returns True if shutdown was successful
   */
  shutdown(): Promise<boolean>;
} 