/**
 * Cross-System Tool Discovery Interface
 * 
 * Interface for Phase 3.1 cross-system tool discovery capabilities.
 * Provides semantic search, workflow discovery, and tool substitution
 * across all systems in the unified foundation.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - Interface-first design
 * - Comprehensive type safety
 * - Cross-system compatibility
 * - Structured error handling
 */

import {
  UnifiedTool,
  ToolDiscoveryCriteria,
  SearchContext,
  ToolSearchResult,
  ToolSimilarity,
  ToolRecommendation,
  ToolDiscoveryMethod,
  ExecutionContext
} from '../types/FoundationTypes';
import { ToolCategory, ToolCapability } from '../enums/ToolEnums';

/**
 * Cross-system workflow template for tool chaining
 */
export interface CrossSystemWorkflow {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly systems: readonly ToolCategory[];
  readonly toolChain: readonly {
    readonly toolName: string;
    readonly system: ToolCategory;
    readonly dependsOn?: string[];
    readonly outputMapping?: Record<string, string>;
  }[];
  readonly useCases: readonly string[];
}

/**
 * Tool substitution suggestion for when primary tool fails
 */
export interface ToolSubstitution {
  readonly originalTool: UnifiedTool;
  readonly substituteTool: UnifiedTool;
  readonly substitutionReason: string;
  readonly confidenceScore: number;
  readonly parameterMapping?: Record<string, string>;
  readonly limitations?: readonly string[];
}

/**
 * Interface for cross-system tool discovery service
 */
export interface ICrossSystemToolDiscovery {
  // ==================== Semantic Search ====================

  /**
   * Search tools using natural language query across ALL systems
   * @param query Natural language query describing desired tool functionality
   * @param context Optional search context for better results
   * @param limit Maximum number of results to return
   * @returns Array of search results with relevance scores
   */
  searchTools(
    query: string,
    context?: SearchContext,
    limit?: number
  ): Promise<readonly ToolSearchResult[]>;

  /**
   * Discovers tools based on criteria with cross-system support
   * @param criteria Search criteria for tool discovery
   * @returns Array of matching tools
   */
  discoverTools(
    criteria: ToolDiscoveryCriteria
  ): Promise<readonly UnifiedTool[]>;

  // ==================== Cross-System Features ====================

  /**
   * Discovers cross-system workflows based on user intent
   * @param intent Natural language description of what user wants to accomplish
   * @param context Optional search context for better results
   * @returns Array of relevant cross-system workflows
   */
  discoverCrossSystemWorkflows(
    intent: string,
    context?: SearchContext
  ): Promise<readonly CrossSystemWorkflow[]>;

  /**
   * Gets tool substitution suggestions for failed tools
   * @param failedTool Tool that failed and needs substitution
   * @param context Optional execution context for better matching
   * @returns Array of tool substitution suggestions with confidence scores
   */
  getToolSubstitutions(
    failedTool: UnifiedTool,
    context?: ExecutionContext
  ): Promise<readonly ToolSubstitution[]>;

  /**
   * Gets tools by intent using LLM-powered analysis
   * @param intent Natural language description of user intent
   * @returns Array of tools that match the intent, sorted by relevance
   */
  getToolsByIntent(intent: string): Promise<readonly UnifiedTool[]>;

  // ==================== Similarity and Matching ====================

  /**
   * Find similar tools to a given tool with cross-system support
   * @param toolId Tool ID to find similar tools for
   * @param method Method to use for similarity calculation
   * @param limit Maximum number of similar tools to return
   * @returns Array of similar tools ordered by similarity score
   */
  findSimilarTools(
    toolId: string,
    method?: ToolDiscoveryMethod,
    limit?: number
  ): Promise<readonly ToolSimilarity[]>;

  /**
   * Get tool recommendations based on context
   * @param context Search context for recommendations
   * @param limit Maximum number of recommendations
   * @returns Array of recommended tools with reasoning
   */
  getRecommendations(
    context: SearchContext,
    limit?: number
  ): Promise<readonly ToolRecommendation[]>;

  // ==================== Category and Capability Discovery ====================

  /**
   * Gets tools by category
   * @param category Tool category to filter by
   * @param includeDeprecated Whether to include deprecated tools
   * @returns Array of tools in specified category
   */
  getToolsByCategory(
    category: ToolCategory,
    includeDeprecated?: boolean
  ): Promise<readonly UnifiedTool[]>;

  /**
   * Gets tools by capability
   * @param capability Tool capability to filter by
   * @param includeDeprecated Whether to include deprecated tools
   * @returns Array of tools with specified capability
   */
  getToolsByCapability(
    capability: ToolCapability,
    includeDeprecated?: boolean
  ): Promise<readonly UnifiedTool[]>;
} 