/**
 * Tool Discovery Service Interface
 * 
 * Interface for intelligent tool discovery using semantic search,
 * categorization, and contextual matching. Provides advanced search
 * capabilities for finding the right tools for specific tasks.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - Performance-optimized search algorithms
 * - Comprehensive search criteria support
 * - Structured search results
 * - Contextual relevance scoring
 */

import {
  ToolId,
  ToolIdentifier,
  ExecutionContext,
  UnifiedTool,
  ToolDiscoveryCriteria,
  SearchContext,
  ToolSearchResult,
  ToolSimilarity,
  ToolRecommendation,
  ToolDiscoveryMethod
} from '../types/FoundationTypes';
import { ToolCategory, ToolCapability } from '../enums/ToolEnums';

/**
 * Interface for the tool discovery service
 * 
 * Provides advanced tool discovery capabilities including semantic search,
 * similarity matching, and intelligent recommendations across all systems.
 */
export interface IToolDiscoveryService {
  // ==================== Semantic Search ====================

  /**
   * Search tools using natural language query with LLM integration
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
   * Find tools by intent using semantic analysis
   * @param intent User intent or goal description
   * @param availableCapabilities Capabilities available in current context
   * @param limit Maximum number of results to return
   * @returns Array of tools matching the intent
   */
  findToolsByIntent(
    intent: string,
    availableCapabilities?: readonly ToolCapability[],
    limit?: number
  ): Promise<readonly ToolSearchResult[]>;

  /**
   * Get tool recommendations based on current context
   * @param context Current execution context
   * @param previousTools Previously used tools in current session
   * @param limit Maximum number of recommendations
   * @returns Array of recommended tools with reasoning
   */
  getToolRecommendations(
    context: SearchContext,
    previousTools?: readonly ToolId[],
    limit?: number
  ): Promise<readonly {
    readonly tool: UnifiedTool;
    readonly relevanceScore: number;
    readonly reason: string;
  }[]>;

  // ==================== Similarity and Matching ====================

  /**
   * Find similar tools based on functionality and characteristics
   * @param referenceIdentifier Tool ID or name to find similar tools for
   * @param method Method to use for similarity calculation
   * @param limit Maximum number of similar tools to return
   * @returns Array of similar tools ordered by similarity score
   */
  findSimilarTools(
    referenceIdentifier: ToolIdentifier,
    method?: ToolDiscoveryMethod,
    limit?: number
  ): Promise<readonly {
    readonly tool: UnifiedTool;
    readonly similarityScore: number;
    readonly matchingAttributes: readonly string[];
  }[]>;

  /**
   * Calculate similarity score between two tools
   * @param toolId1 First tool ID
   * @param toolId2 Second tool ID
   * @returns Similarity score between 0 and 1
   */
  calculateToolSimilarity(toolId1: ToolId, toolId2: ToolId): Promise<number>;

  /**
   * Find tools that can substitute for a given tool
   * @param toolIdentifier Tool to find substitutes for
   * @param context Execution context for compatibility checking
   * @param limit Maximum number of substitutes to return
   * @returns Array of substitute tools with compatibility scores
   */
  findToolSubstitutes(
    toolIdentifier: ToolIdentifier,
    context?: ExecutionContext,
    limit?: number
  ): Promise<readonly {
    readonly tool: UnifiedTool;
    readonly compatibilityScore: number;
    readonly differences: readonly string[];
  }[]>;

  // ==================== Capability-Based Discovery ====================

  /**
   * Find tools by required capabilities
   * @param capabilities Array of required capabilities
   * @param matchAll Whether all capabilities must be present (AND) or any (OR)
   * @param context Optional context for filtering
   * @returns Array of tools with matching capabilities
   */
  findToolsByCapabilities(
    capabilities: readonly ToolCapability[],
    matchAll?: boolean,
    context?: SearchContext
  ): Promise<readonly UnifiedTool[]>;

  /**
   * Find tools that complement a given set of tools
   * @param existingTools Array of existing tool IDs
   * @param desiredOutcome Description of desired outcome
   * @param limit Maximum number of complementary tools to return
   * @returns Array of complementary tools with reasoning
   */
  findComplementaryTools(
    existingTools: readonly ToolId[],
    desiredOutcome?: string,
    limit?: number
  ): Promise<readonly {
    readonly tool: UnifiedTool;
    readonly complementScore: number;
    readonly reason: string;
  }[]>;

  /**
   * Get capability coverage analysis for a set of tools
   * @param toolIds Array of tool IDs to analyze
   * @returns Capability coverage analysis
   */
  analyzeCoverageCapabilities(toolIds: readonly ToolId[]): Promise<{
    readonly coveredCapabilities: readonly ToolCapability[];
    readonly missingCapabilities: readonly ToolCapability[];
    readonly redundantCapabilities: readonly ToolCapability[];
    readonly coverageScore: number;
  }>;

  // ==================== Advanced Discovery ====================

  /**
   * Discover tools using multiple criteria with scoring
   * @param criteria Complex discovery criteria
   * @param scoringWeights Weights for different scoring factors
   * @returns Array of tools with composite scores
   */
  discoverToolsAdvanced(
    criteria: ToolDiscoveryCriteria,
    scoringWeights?: {
      readonly relevance?: number;
      readonly performance?: number;
      readonly reliability?: number;
      readonly recency?: number;
    }
  ): Promise<readonly {
    readonly tool: UnifiedTool;
    readonly compositeScore: number;
    readonly scoreBreakdown: {
      readonly relevance: number;
      readonly performance: number;
      readonly reliability: number;
      readonly recency: number;
    };
  }[]>;

  /**
   * Find tools by workflow or use case
   * @param workflow Description of workflow or use case
   * @param context Execution context
   * @param limit Maximum number of tools to return
   * @returns Array of tools suitable for the workflow
   */
  findToolsForWorkflow(
    workflow: string,
    context?: SearchContext,
    limit?: number
  ): Promise<readonly {
    readonly tool: UnifiedTool;
    readonly workflowFit: number;
    readonly suggestedOrder: number;
    readonly dependencies: readonly ToolId[];
  }[]>;

  // ==================== Discovery Analytics ====================

  /**
   * Get discovery performance metrics
   * @returns Discovery service performance metrics
   */
  getDiscoveryMetrics(): Promise<{
    readonly totalSearches: number;
    readonly averageSearchTime: number;
    readonly cacheHitRate: number;
    readonly popularQueries: readonly {
      readonly query: string;
      readonly count: number;
    }[];
    readonly topDiscoveredTools: readonly {
      readonly toolId: ToolId;
      readonly discoveryCount: number;
    }[];
  }>;

  /**
   * Get tool discovery statistics
   * @param toolId Tool ID to get discovery stats for
   * @returns Discovery statistics for the tool
   */
  getToolDiscoveryStats(toolId: ToolId): Promise<{
    readonly discoveryCount: number;
    readonly averageRelevanceScore: number;
    readonly commonSearchTerms: readonly string[];
    readonly frequentlyPairedWith: readonly ToolId[];
  }>;

  // ==================== Configuration and Optimization ====================

  /**
   * Configure semantic search settings
   * @param settings Search configuration settings
   */
  configureSemanticSearch(settings: {
    readonly enableLLMIntegration?: boolean;
    readonly similarityThreshold?: number;
    readonly maxCacheSize?: number;
    readonly cacheExpirationMs?: number;
  }): void;

  /**
   * Update tool similarity index for better performance
   * @returns True if index update was successful
   */
  updateSimilarityIndex(): Promise<boolean>;

  /**
   * Clear discovery cache
   * @returns True if cache was cleared
   */
  clearCache(): Promise<boolean>;

  /**
   * Initialize the discovery service
   * @returns True if initialization was successful
   */
  initialize(): Promise<boolean>;

  /**
   * Shutdown the discovery service gracefully
   * @returns True if shutdown was successful
   */
  shutdown(): Promise<boolean>;

  // ==================== Health and Status ====================

  /**
   * Check if discovery service is healthy
   * @returns True if service is healthy
   */
  isHealthy(): Promise<boolean>;

  /**
   * Get discovery service health status
   * @returns Detailed health information
   */
  getHealthStatus(): Promise<{
    readonly healthy: boolean;
    readonly indexSize: number;
    readonly cacheSize: number;
    readonly averageSearchTime: number;
    readonly searchSuccessRate: number;
    readonly issues: readonly string[];
  }>;

  /**
   * Discovers tools based on criteria
   */
  discoverTools(
    criteria: ToolDiscoveryCriteria
  ): Promise<readonly UnifiedTool[]>;

  /**
   * Gets tool recommendations based on context
   */
  getRecommendations(
    context: SearchContext,
    limit?: number
  ): Promise<readonly ToolRecommendation[]>;

  /**
   * Gets tools by category
   */
  getToolsByCategory(
    category: ToolCategory,
    includeDeprecated?: boolean
  ): Promise<readonly UnifiedTool[]>;

  /**
   * Gets tools by capability
   */
  getToolsByCapability(
    capability: ToolCapability,
    includeDeprecated?: boolean
  ): Promise<readonly UnifiedTool[]>;

  // ==================== PHASE 3.1 CROSS-SYSTEM FEATURES ====================

  /**
   * Discovers cross-system workflows based on user intent
   * @param intent Natural language description of what user wants to accomplish
   * @param context Optional search context for better results
   * @returns Array of relevant cross-system workflows
   */
  discoverCrossSystemWorkflows(
    intent: string,
    context?: SearchContext
  ): Promise<readonly {
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
  }[]>;

  /**
   * Gets tool substitution suggestions for failed tools
   * @param failedTool Tool that failed and needs substitution
   * @param context Optional execution context for better matching
   * @returns Array of tool substitution suggestions with confidence scores
   */
  getToolSubstitutions(
    failedTool: UnifiedTool,
    context?: ExecutionContext
  ): Promise<readonly {
    readonly originalTool: UnifiedTool;
    readonly substituteTool: UnifiedTool;
    readonly substitutionReason: string;
    readonly confidenceScore: number;
    readonly parameterMapping?: Record<string, string>;
    readonly limitations?: readonly string[];
  }[]>;

  /**
   * Gets tools by intent using LLM-powered analysis
   * @param intent Natural language description of user intent
   * @returns Array of tools that match the intent, sorted by relevance
   */
  getToolsByIntent(intent: string): Promise<readonly UnifiedTool[]>;
} 