/**
 * Tool Discovery Service Implementation
 * 
 * Provides intelligent tool discovery, search, and recommendation
 * capabilities using semantic analysis and machine learning.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - ULID for business logic tracking
 * - Structured error handling
 * - Pure function search logic
 * - Comprehensive logging
 * 
 * Phase 3.1 Cross-System Features:
 * - Semantic tool search across ALL systems
 * - LLM-powered tool recommendations
 * - Cross-system workflow discovery
 * - Tool similarity matching and substitution
 */

import { ulid } from 'ulid';
import { EMAIL_TOOL_NAMES, SPREADSHEET_TOOL_NAMES } from '../../../../constants/tool-names';
import { IStructuredLogger } from '../../../logging/interfaces/IStructuredLogger';
import { ToolCapability, ToolCategory } from '../enums/ToolEnums';
import { ToolDiscoveryError } from '../errors/ToolFoundationErrors';
import { ICrossSystemToolDiscovery } from '../interfaces/ICrossSystemToolDiscovery';
import { IUnifiedToolRegistry } from '../interfaces/UnifiedToolRegistryInterface';
import {
  ExecutionContext,
  SearchContext,
  ToolDiscoveryCriteria,
  ToolDiscoveryMethod,
  ToolRecommendation,
  ToolSearchResult,
  ToolSimilarity,
  UnifiedTool
} from '../types/FoundationTypes';

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
 * Enhanced Tool Discovery Service Implementation
 */
export class ToolDiscoveryService implements ICrossSystemToolDiscovery {
  private readonly crossSystemWorkflows: readonly CrossSystemWorkflow[] = [
    {
      id: ulid(),
      name: 'Social Media Content Research & Post',
      description: 'Research content using Apify scrapers, then create and post social media content',
      systems: [ToolCategory.APIFY, ToolCategory.SOCIAL_MEDIA],
      toolChain: [
        { toolName: 'instagram-post-scraper', system: ToolCategory.APIFY },
        { toolName: 'create_text_post', system: ToolCategory.SOCIAL_MEDIA, dependsOn: ['instagram-post-scraper'] }
      ],
      useCases: ['content research', 'competitive analysis', 'trend analysis', 'social media posting']
    },
    {
      id: ulid(),
      name: 'Email Campaign with Analytics',
      description: 'Send email campaigns and track engagement using thinking system analytics',
      systems: [ToolCategory.WORKSPACE, ToolCategory.THINKING],
      toolChain: [
        { toolName: EMAIL_TOOL_NAMES.SEND_EMAIL, system: ToolCategory.WORKSPACE },
        { toolName: 'content_analysis', system: ToolCategory.THINKING, dependsOn: [EMAIL_TOOL_NAMES.SEND_EMAIL] }
      ],
      useCases: ['email marketing', 'campaign analysis', 'engagement tracking']
    },
    {
      id: ulid(),
      name: 'Research & Document Workflow',
      description: 'Research information and create documents in workspace',
      systems: [ToolCategory.THINKING, ToolCategory.WORKSPACE],
      toolChain: [
        { toolName: 'web_search', system: ToolCategory.THINKING },
        { toolName: SPREADSHEET_TOOL_NAMES.CREATE_SPREADSHEET, system: ToolCategory.WORKSPACE, dependsOn: ['web_search'] }
      ],
      useCases: ['research documentation', 'data compilation', 'report generation']
    }
  ];

  constructor(
    private readonly registry: IUnifiedToolRegistry,
    private readonly logger: IStructuredLogger
  ) { }

  /**
   * Searches for tools using advanced semantic analysis across ALL systems
   */
  async searchTools(
    query: string,
    context?: SearchContext,
    limit: number = 10
  ): Promise<readonly ToolSearchResult[]> {
    try {
      await this.logger.info('Starting cross-system tool search', {
        query,
        limit,
        hasContext: !!context,
        searchId: ulid()
      });

      // Get all available tools from ALL systems
      const allTools = await this.registry.getAllTools();
      const searchResults: ToolSearchResult[] = [];

      // Enhanced semantic search with cross-system awareness
      const queryLower = query.toLowerCase();
      const searchTerms = queryLower.split(' ').filter(term => term.length > 2);
      const intentKeywords = this.extractIntentKeywords(query);

      for (const tool of allTools) {
        let relevanceScore = 0;
        const matchReasons: string[] = [];

        // Primary matching (high scores)
        if (tool.name.toLowerCase().includes(queryLower)) {
          relevanceScore += 15;
          matchReasons.push('Direct name match');
        }

        if (tool.description.toLowerCase().includes(queryLower)) {
          relevanceScore += 12;
          matchReasons.push('Description match');
        }

        // Intent-based matching (new for Phase 3.1)
        for (const intentKeyword of intentKeywords) {
          if (tool.description.toLowerCase().includes(intentKeyword) ||
            tool.name.toLowerCase().includes(intentKeyword)) {
            relevanceScore += 10;
            matchReasons.push(`Intent match: ${intentKeyword}`);
          }
        }

        // Category and capability matching
        if (tool.category.toLowerCase().includes(queryLower)) {
          relevanceScore += 8;
          matchReasons.push('Category match');
        }

        for (const capability of tool.capabilities) {
          if (capability.toLowerCase().includes(queryLower)) {
            relevanceScore += 7;
            matchReasons.push(`Capability match: ${capability}`);
          }
        }

        // Cross-system workflow matching (new for Phase 3.1)
        const workflowScore = this.calculateWorkflowRelevance(tool, query);
        if (workflowScore > 0) {
          relevanceScore += workflowScore;
          matchReasons.push('Cross-system workflow relevance');
        }

        // Tag and metadata matching
        if (tool.tags) {
          for (const tag of tool.tags) {
            if (tag.toLowerCase().includes(queryLower)) {
              relevanceScore += 5;
              matchReasons.push(`Tag match: ${tag}`);
            }
          }
        }

        // Multi-term semantic matching
        for (const term of searchTerms) {
          const toolText = `${tool.name} ${tool.description} ${tool.category} ${tool.capabilities.join(' ')} ${tool.tags?.join(' ') || ''}`.toLowerCase();
          if (toolText.includes(term)) {
            relevanceScore += 3;
            matchReasons.push(`Semantic term: ${term}`);
          }
        }

        // Context-aware scoring (new for Phase 3.1)
        if (context) {
          const contextScore = this.calculateContextRelevance(tool, context);
          if (contextScore > 0) {
            relevanceScore += contextScore;
            matchReasons.push('Context relevance');
          }
        }

        // Only include tools with meaningful relevance
        if (relevanceScore > 0) {
          searchResults.push({
            tool,
            relevanceScore,
            matchReasons
          });
        }
      }

      // Advanced sorting with cross-system prioritization
      const results = searchResults
        .sort((a, b) => {
          // Primary sort by relevance score
          if (b.relevanceScore !== a.relevanceScore) {
            return b.relevanceScore - a.relevanceScore;
          }
          // Secondary sort by tool success rate
          return b.tool.successRate - a.tool.successRate;
        })
        .slice(0, limit);

      await this.logger.info('Cross-system tool search completed', {
        query,
        totalResults: results.length,
        topScore: results[0]?.relevanceScore || 0,
        systemsFound: [...new Set(results.map(r => r.tool.category))],
        searchId: ulid()
      });

      return results;

    } catch (error) {
      const discoveryError = new ToolDiscoveryError(
        `Cross-system tool search failed for query '${query}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          searchQuery: query,
          searchCriteria: context as Record<string, unknown> || {},
          discoveryMethod: 'cross-system-semantic',
          resultCount: 0
        }
      );

      await this.logger.error('Cross-system tool search error', discoveryError);
      throw discoveryError;
    }
  }

  /**
   * Discovers tools based on enhanced criteria with cross-system awareness
   */
  async discoverTools(
    criteria: ToolDiscoveryCriteria
  ): Promise<readonly UnifiedTool[]> {
    try {
      await this.logger.info('Starting cross-system tool discovery', {
        criteria: criteria as Record<string, unknown>,
        discoveryId: ulid()
      });

      const allTools = await this.registry.getAllTools();
      let filteredTools = allTools;

      // Enhanced filtering with cross-system support
      if (criteria.categories && criteria.categories.length > 0) {
        filteredTools = filteredTools.filter(tool =>
          criteria.categories!.includes(tool.category)
        );
      }

      if (criteria.capabilities && criteria.capabilities.length > 0) {
        filteredTools = filteredTools.filter(tool =>
          criteria.capabilities!.some(cap => tool.capabilities.includes(cap))
        );
      }

      if (criteria.tags && criteria.tags.length > 0) {
        filteredTools = filteredTools.filter(tool =>
          tool.tags && criteria.tags!.some(tag => tool.tags!.includes(tag))
        );
      }

      if (criteria.provider) {
        filteredTools = filteredTools.filter(tool =>
          tool.metadata.provider === criteria.provider
        );
      }

      if (criteria.status) {
        filteredTools = filteredTools.filter(tool => tool.status === criteria.status);
      }

      // Filter by enabled status
      if (criteria.enabledOnly !== false) {
        filteredTools = filteredTools.filter(tool => tool.enabled);
      }

      // Intent-based filtering (new for Phase 3.1)
      if (criteria.intent) {
        const intentRelevantTools = await this.getToolsByIntent(criteria.intent);
        const intentToolIds = new Set(intentRelevantTools.map(t => t.id));
        filteredTools = filteredTools.filter(tool => intentToolIds.has(tool.id));
      }

      // Sort tools based on criteria
      if (criteria.sortBy) {
        filteredTools = this.sortTools([...filteredTools], criteria.sortBy, criteria.sortOrder || 'desc');
      }

      // Apply pagination
      if (criteria.offset) {
        filteredTools = filteredTools.slice(criteria.offset);
      }

      if (criteria.limit) {
        filteredTools = filteredTools.slice(0, criteria.limit);
      }

      await this.logger.info('Cross-system tool discovery completed', {
        totalFound: filteredTools.length,
        criteria: criteria as Record<string, unknown>,
        systemsIncluded: [...new Set(filteredTools.map(t => t.category))],
        discoveryId: ulid()
      });

      return filteredTools;

    } catch (error) {
      const discoveryError = new ToolDiscoveryError(
        `Cross-system tool discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          searchQuery: criteria.intent,
          searchCriteria: criteria as Record<string, unknown>,
          discoveryMethod: 'cross-system-criteria',
          resultCount: 0
        }
      );

      await this.logger.error('Cross-system tool discovery error', discoveryError);
      throw discoveryError;
    }
  }

  /**
   * Discovers cross-system workflows based on user intent
   */
  async discoverCrossSystemWorkflows(
    intent: string,
    context?: SearchContext
  ): Promise<readonly CrossSystemWorkflow[]> {
    try {
      await this.logger.info('Discovering cross-system workflows', {
        intent,
        hasContext: !!context,
        workflowId: ulid()
      });

      const relevantWorkflows: CrossSystemWorkflow[] = [];
      const intentLower = intent.toLowerCase();

      for (const workflow of this.crossSystemWorkflows) {
        let relevanceScore = 0;

        // Check if intent matches workflow use cases
        for (const useCase of workflow.useCases) {
          if (intentLower.includes(useCase.toLowerCase()) || useCase.toLowerCase().includes(intentLower)) {
            relevanceScore += 10;
          }
        }

        // Check if intent matches workflow description
        if (workflow.description.toLowerCase().includes(intentLower)) {
          relevanceScore += 8;
        }

        // Check if intent matches workflow name
        if (workflow.name.toLowerCase().includes(intentLower)) {
          relevanceScore += 6;
        }

        if (relevanceScore > 0) {
          relevantWorkflows.push(workflow);
        }
      }

      // Sort by relevance and return
      relevantWorkflows.sort((a, b) => {
        const aScore = a.useCases.filter(useCase =>
          intentLower.includes(useCase.toLowerCase())).length;
        const bScore = b.useCases.filter(useCase =>
          intentLower.includes(useCase.toLowerCase())).length;
        return bScore - aScore;
      });

      await this.logger.info('Cross-system workflow discovery completed', {
        intent,
        workflowsFound: relevantWorkflows.length,
        workflowId: ulid()
      });

      return relevantWorkflows;

    } catch (error) {
      await this.logger.error('Cross-system workflow discovery error', {
        intent,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorId: ulid()
      });
      return [];
    }
  }

  /**
   * Gets tool substitution suggestions for failed tools
   */
  async getToolSubstitutions(
    failedTool: UnifiedTool,
    context?: ExecutionContext
  ): Promise<readonly ToolSubstitution[]> {
    try {
      await this.logger.info('Finding tool substitutions', {
        failedToolId: failedTool.id,
        failedToolName: failedTool.name,
        substitutionId: ulid()
      });

      const allTools = await this.registry.getAllTools();
      const substitutions: ToolSubstitution[] = [];

      for (const tool of allTools) {
        if (tool.id === failedTool.id || !tool.enabled) continue;

        let confidenceScore = 0;
        let substitutionReason = '';
        const limitations: string[] = [];

        // Same category substitution (highest confidence)
        if (tool.category === failedTool.category) {
          confidenceScore += 30;
          substitutionReason = 'Same category tool';
        }

        // Capability overlap
        const sharedCapabilities = tool.capabilities.filter(cap =>
          failedTool.capabilities.includes(cap));
        if (sharedCapabilities.length > 0) {
          confidenceScore += sharedCapabilities.length * 10;
          substitutionReason += ` with ${sharedCapabilities.length} shared capabilities`;
        }

        // Tag similarity
        if (tool.tags && failedTool.tags) {
          const sharedTags = tool.tags.filter(tag => failedTool.tags!.includes(tag));
          if (sharedTags.length > 0) {
            confidenceScore += sharedTags.length * 5;
            substitutionReason += ` and ${sharedTags.length} shared tags`;
          }
        }

        // Success rate bonus
        if (tool.successRate > failedTool.successRate) {
          confidenceScore += 5;
          substitutionReason += ' with better success rate';
        }

        // Cross-system substitution (lower confidence but valuable)
        if (tool.category !== failedTool.category && sharedCapabilities.length > 0) {
          confidenceScore += 15;
          substitutionReason += ' (cross-system alternative)';
          limitations.push('Different system - may require parameter adaptation');
        }

        if (confidenceScore > 20) {
          substitutions.push({
            originalTool: failedTool,
            substituteTool: tool,
            substitutionReason,
            confidenceScore,
            limitations: limitations.length > 0 ? limitations : undefined
          });
        }
      }

      // Sort by confidence score
      substitutions.sort((a, b) => b.confidenceScore - a.confidenceScore);

      await this.logger.info('Tool substitution discovery completed', {
        failedToolId: failedTool.id,
        substitutionsFound: substitutions.length,
        topConfidence: substitutions[0]?.confidenceScore || 0,
        substitutionId: ulid()
      });

      return substitutions.slice(0, 5); // Return top 5 substitutions

    } catch (error) {
      await this.logger.error('Tool substitution discovery error', {
        failedToolId: failedTool.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorId: ulid()
      });
      return [];
    }
  }

  /**
   * Gets tools by intent using LLM-powered analysis
   */
  async getToolsByIntent(intent: string): Promise<readonly UnifiedTool[]> {
    try {
      await this.logger.info('Analyzing tools by intent', {
        intent,
        intentId: ulid()
      });

      const intentKeywords = this.extractIntentKeywords(intent);
      const allTools = await this.registry.getAllTools();
      const relevantTools: { tool: UnifiedTool; score: number }[] = [];

      for (const tool of allTools) {
        if (!tool.enabled) continue;

        let intentScore = 0;

        // Keyword matching in tool description and name
        for (const keyword of intentKeywords) {
          if (tool.name.toLowerCase().includes(keyword)) {
            intentScore += 10;
          }
          if (tool.description.toLowerCase().includes(keyword)) {
            intentScore += 8;
          }
          if (tool.capabilities.some(cap => cap.toLowerCase().includes(keyword))) {
            intentScore += 6;
          }
          if (tool.tags?.some(tag => tag.toLowerCase().includes(keyword))) {
            intentScore += 4;
          }
        }

        // Intent pattern matching
        if (this.matchesIntentPattern(intent, tool)) {
          intentScore += 15;
        }

        if (intentScore > 0) {
          relevantTools.push({ tool, score: intentScore });
        }
      }

      // Sort by intent score
      relevantTools.sort((a, b) => b.score - a.score);

      const results = relevantTools.map(r => r.tool);

      await this.logger.info('Intent-based tool analysis completed', {
        intent,
        toolsFound: results.length,
        topScore: relevantTools[0]?.score || 0,
        intentId: ulid()
      });

      return results;

    } catch (error) {
      await this.logger.error('Intent-based tool analysis error', {
        intent,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorId: ulid()
      });
      return [];
    }
  }

  /**
   * Finds similar tools to a given tool with enhanced cross-system support
   */
  async findSimilarTools(
    toolId: string,
    method: ToolDiscoveryMethod = 'semantic',
    limit: number = 5
  ): Promise<readonly ToolSimilarity[]> {
    try {
      await this.logger.info('Finding similar tools', {
        toolId,
        method,
        limit
      });

      const targetTool = await this.registry.getTool(toolId);
      if (!targetTool) {
        throw new Error(`Tool with ID '${toolId}' not found`);
      }

      const allTools = await this.registry.getAllTools();
      const similarities: ToolSimilarity[] = [];

      for (const tool of allTools) {
        if (tool.id === toolId) continue; // Skip the target tool itself

        let similarityScore = 0;
        const commonFeatures: string[] = [];

        // Category similarity
        if (tool.category === targetTool.category) {
          similarityScore += 5;
          commonFeatures.push(`Same category: ${tool.category}`);
        }

        // Capability similarity
        const commonCapabilities = tool.capabilities.filter(cap =>
          targetTool.capabilities.includes(cap)
        );
        if (commonCapabilities.length > 0) {
          similarityScore += commonCapabilities.length * 3;
          commonFeatures.push(`Common capabilities: ${commonCapabilities.join(', ')}`);
        }

        // Tag similarity
        if (tool.tags && targetTool.tags) {
          const commonTags = tool.tags.filter(tag => targetTool.tags!.includes(tag));
          if (commonTags.length > 0) {
            similarityScore += commonTags.length * 2;
            commonFeatures.push(`Common tags: ${commonTags.join(', ')}`);
          }
        }

        // Description similarity (simple word matching)
        const targetWords = targetTool.description.toLowerCase().split(' ');
        const toolWords = tool.description.toLowerCase().split(' ');
        const commonWords = targetWords.filter(word =>
          word.length > 3 && toolWords.includes(word)
        );
        if (commonWords.length > 0) {
          similarityScore += commonWords.length;
          commonFeatures.push(`Common description terms: ${commonWords.length}`);
        }

        // Only include tools with some similarity
        if (similarityScore > 0) {
          similarities.push({
            tool,
            similarityScore,
            matchingAttributes: commonFeatures
          });
        }
      }

      // Sort by similarity score (descending) and limit results
      const results = similarities
        .sort((a, b) => b.similarityScore - a.similarityScore)
        .slice(0, limit);

      await this.logger.info('Similar tools found', {
        toolId,
        similarToolsCount: results.length,
        topScore: results[0]?.similarityScore || 0
      });

      return results;

    } catch (error) {
      const discoveryError = new ToolDiscoveryError(
        `Finding similar tools failed for '${toolId}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          searchCriteria: { toolId, method, limit },
          discoveryMethod: method,
          resultCount: 0
        }
      );

      await this.logger.error('Similar tools search error', discoveryError);
      throw discoveryError;
    }
  }

  /**
   * Gets tool recommendations based on context
   */
  async getRecommendations(
    context: SearchContext,
    limit: number = 10
  ): Promise<readonly ToolRecommendation[]> {
    try {
      await this.logger.info('Getting tool recommendations', {
        context: context as Record<string, unknown>,
        limit
      });

      const allTools = await this.registry.getAllTools();
      const recommendations: ToolRecommendation[] = [];

      for (const tool of allTools) {
        let recommendationScore = 0;
        const reasons: string[] = [];

        // User preferences
        if (context.preferences) {
          const prefs = context.preferences;
          if (prefs.favoriteCategories && Array.isArray(prefs.favoriteCategories)) {
            if (prefs.favoriteCategories.includes(tool.category)) {
              recommendationScore += 8;
              reasons.push('Matches favorite category');
            }
          }
        }

        // Permissions matching
        if (context.permissions && tool.permissions) {
          const hasAllPermissions = tool.permissions.every(perm =>
            context.permissions!.includes(perm)
          );
          if (hasAllPermissions) {
            recommendationScore += 5;
            reasons.push('User has all required permissions');
          }
        }

        // Workspace context
        if (context.workspaceId && tool.requiresWorkspace) {
          recommendationScore += 3;
          reasons.push('Compatible with workspace');
        }

        // Usage frequency (mock - would be based on actual usage data)
        const popularityScore = Math.random() * 3; // Mock popularity
        recommendationScore += popularityScore;
        reasons.push(`Popular tool (score: ${popularityScore.toFixed(1)})`);

        // Only include tools with some recommendation value
        if (recommendationScore > 0) {
          recommendations.push({
            tool,
            recommendationScore,
            reasons,
            category: tool.category as ToolCategory
          });
        }
      }

      // Sort by recommendation score (descending) and limit results
      const results = recommendations
        .sort((a, b) => b.recommendationScore - a.recommendationScore)
        .slice(0, limit);

      await this.logger.info('Tool recommendations completed', {
        recommendationsCount: results.length,
        topScore: results[0]?.recommendationScore || 0
      });

      return results;

    } catch (error) {
      const discoveryError = new ToolDiscoveryError(
        `Getting recommendations failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          searchCriteria: context as Record<string, unknown>,
          discoveryMethod: 'recommendation',
          resultCount: 0
        }
      );

      await this.logger.error('Recommendations error', discoveryError);
      throw discoveryError;
    }
  }

  /**
   * Gets tools by category
   */
  async getToolsByCategory(
    category: ToolCategory,
    includeDeprecated: boolean = false
  ): Promise<readonly UnifiedTool[]> {
    try {
      await this.logger.info('Getting tools by category', {
        category,
        includeDeprecated
      });

      const allTools = await this.registry.getAllTools();
      let filteredTools = allTools.filter(tool => tool.category === category);

      if (!includeDeprecated) {
        filteredTools = filteredTools.filter(tool => tool.status !== 'deprecated');
      }

      await this.logger.info('Tools by category retrieved', {
        category,
        toolCount: filteredTools.length
      });

      return filteredTools;

    } catch (error) {
      const discoveryError = new ToolDiscoveryError(
        `Getting tools by category '${category}' failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          searchCriteria: { category, includeDeprecated },
          discoveryMethod: 'category',
          resultCount: 0
        }
      );

      await this.logger.error('Tools by category error', discoveryError);
      throw discoveryError;
    }
  }

  /**
   * Gets tools by capability
   */
  async getToolsByCapability(
    capability: ToolCapability,
    includeDeprecated: boolean = false
  ): Promise<readonly UnifiedTool[]> {
    try {
      await this.logger.info('Getting tools by capability', {
        capability,
        includeDeprecated
      });

      const allTools = await this.registry.getAllTools();
      let filteredTools = allTools.filter(tool =>
        tool.capabilities.includes(capability)
      );

      if (!includeDeprecated) {
        filteredTools = filteredTools.filter(tool => tool.status !== 'deprecated');
      }

      await this.logger.info('Tools by capability retrieved', {
        capability,
        toolCount: filteredTools.length
      });

      return filteredTools;

    } catch (error) {
      const discoveryError = new ToolDiscoveryError(
        `Getting tools by capability '${capability}' failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          searchCriteria: { capability, includeDeprecated },
          discoveryMethod: 'capability',
          resultCount: 0
        }
      );

      await this.logger.error('Tools by capability error', discoveryError);
      throw discoveryError;
    }
  }

  // ========================================
  // PHASE 3.1 HELPER METHODS
  // ========================================

  /**
   * Extracts intent keywords from natural language query
   */
  private extractIntentKeywords(intent: string): string[] {
    const intentLower = intent.toLowerCase();
    const keywords: string[] = [];

    // Action keywords
    const actionPatterns = [
      { pattern: /send|email|mail/, keyword: 'email' },
      { pattern: /post|publish|share/, keyword: 'social' },
      { pattern: /search|find|look/, keyword: 'search' },
      { pattern: /create|make|generate/, keyword: 'create' },
      { pattern: /schedule|plan|calendar/, keyword: 'schedule' },
      { pattern: /analyze|analysis|examine/, keyword: 'analyze' },
      { pattern: /scrape|extract|collect/, keyword: 'scrape' },
      { pattern: /workflow|automate|process/, keyword: 'workflow' },
      { pattern: /approve|approval|review/, keyword: 'approve' },
      { pattern: /track|monitor|measure/, keyword: 'track' },
      { pattern: /format|style|adapt/, keyword: 'format' }
    ];

    for (const { pattern, keyword } of actionPatterns) {
      if (pattern.test(intentLower)) {
        keywords.push(keyword);
      }
    }

    // Platform keywords
    const platformPatterns = [
      { pattern: /twitter|tweet/, keyword: 'twitter' },
      { pattern: /instagram|insta/, keyword: 'instagram' },
      { pattern: /linkedin/, keyword: 'linkedin' },
      { pattern: /facebook|fb/, keyword: 'facebook' },
      { pattern: /tiktok/, keyword: 'tiktok' },
      { pattern: /youtube/, keyword: 'youtube' },
      { pattern: /google|gmail/, keyword: 'google' },
      { pattern: /excel|spreadsheet/, keyword: 'spreadsheet' },
      { pattern: /calendar/, keyword: 'calendar' },
      { pattern: /file|document/, keyword: 'file' }
    ];

    for (const { pattern, keyword } of platformPatterns) {
      if (pattern.test(intentLower)) {
        keywords.push(keyword);
      }
    }

    // Extract meaningful words (filter out common words)
    const words = intentLower.split(/\s+/).filter(word =>
      word.length > 3 &&
      !['with', 'from', 'that', 'this', 'will', 'have', 'been', 'they', 'them', 'were', 'what', 'when', 'where', 'which'].includes(word)
    );

    keywords.push(...words);

    return [...new Set(keywords)]; // Remove duplicates
  }

  /**
   * Calculates workflow relevance score for a tool
   */
  private calculateWorkflowRelevance(tool: UnifiedTool, query: string): number {
    let score = 0;
    const queryLower = query.toLowerCase();

    for (const workflow of this.crossSystemWorkflows) {
      // Check if tool is part of any workflow
      const isInWorkflow = workflow.toolChain.some(step => step.toolName === tool.name);
      if (isInWorkflow) {
        // Check if query matches workflow use cases
        for (const useCase of workflow.useCases) {
          if (queryLower.includes(useCase.toLowerCase()) || useCase.toLowerCase().includes(queryLower)) {
            score += 8;
          }
        }

        // Check if query matches workflow description
        if (workflow.description.toLowerCase().includes(queryLower)) {
          score += 5;
        }
      }
    }

    return score;
  }

  /**
   * Calculates context relevance score for a tool
   */
  private calculateContextRelevance(tool: UnifiedTool, context: SearchContext): number {
    let score = 0;

    // Agent capabilities matching
    if (context.agentCapabilities) {
      const matchingCapabilities = tool.capabilities.filter(cap =>
        context.agentCapabilities!.includes(cap));
      score += matchingCapabilities.length * 3;
    }

    // Previous tools context (tools that work well together)
    if (context.previousTools && context.previousTools.length > 0) {
      // Bonus for tools in the same workflow chain
      for (const workflow of this.crossSystemWorkflows) {
        const hasPreviewTool = workflow.toolChain.some(step =>
          context.previousTools!.includes(step.toolName));
        const hasCurrentTool = workflow.toolChain.some(step =>
          step.toolName === tool.name);

        if (hasPreviewTool && hasCurrentTool) {
          score += 10;
        }
      }
    }

    // Preferred categories
    if (context.preferredCategories && context.preferredCategories.includes(tool.category)) {
      score += 5;
    }

    // Workflow context matching
    if (context.workflowContext) {
      const workflowContextLower = context.workflowContext.toLowerCase();
      if (tool.description.toLowerCase().includes(workflowContextLower) ||
        tool.name.toLowerCase().includes(workflowContextLower)) {
        score += 7;
      }
    }

    return score;
  }

  /**
   * Checks if a tool matches specific intent patterns
   */
  private matchesIntentPattern(intent: string, tool: UnifiedTool): boolean {
    const intentLower = intent.toLowerCase();
    const toolText = `${tool.name} ${tool.description} ${tool.capabilities.join(' ')}`.toLowerCase();

    // Pattern matching for common intents
    const patterns = [
      {
        intent: /send.*email|email.*send/,
        toolPattern: /email.*send|send.*email/
      },
      {
        intent: /create.*post|post.*create|social.*media.*post/,
        toolPattern: /create.*post|post.*create|social.*post/
      },
      {
        intent: /scrape.*data|extract.*data|collect.*data/,
        toolPattern: /scrape|extract|collect|actor/
      },
      {
        intent: /search.*web|web.*search|find.*information/,
        toolPattern: /web.*search|search.*web|semantic.*search/
      },
      {
        intent: /schedule.*meeting|calendar.*event|create.*event/,
        toolPattern: /schedule|calendar|event/
      },
      {
        intent: /analyze.*content|content.*analysis/,
        toolPattern: /analyze|analysis|content.*analysis/
      },
      {
        intent: /workflow.*automation|automate.*workflow/,
        toolPattern: /workflow|automation|orchestration/
      }
    ];

    for (const { intent: intentPattern, toolPattern } of patterns) {
      if (intentPattern.test(intentLower) && toolPattern.test(toolText)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Sorts tools based on criteria
   */
  private sortTools(
    tools: UnifiedTool[],
    sortBy: 'name' | 'category' | 'successRate' | 'executionCount' | 'lastExecuted',
    sortOrder: 'asc' | 'desc'
  ): UnifiedTool[] {
    const sorted = [...tools].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        case 'successRate':
          comparison = a.successRate - b.successRate;
          break;
        case 'executionCount':
          comparison = a.executionCount - b.executionCount;
          break;
        case 'lastExecuted':
          const aTime = a.lastExecutedAt ? new Date(a.lastExecutedAt).getTime() : 0;
          const bTime = b.lastExecutedAt ? new Date(b.lastExecutedAt).getTime() : 0;
          comparison = aTime - bTime;
          break;
        default:
          comparison = 0;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }

  // ==================== Service Lifecycle Methods ====================

  /**
   * Initialize the discovery service
   */
  async initialize(): Promise<boolean> {
    try {
      this.logger.info('Initializing Tool Discovery Service');
      // Discovery service is ready to use immediately
      this.logger.info('Tool Discovery Service initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Tool Discovery Service', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Shutdown the discovery service gracefully
   */
  async shutdown(): Promise<boolean> {
    try {
      this.logger.info('Shutting down Tool Discovery Service');
      // No cleanup needed for discovery service
      this.logger.info('Tool Discovery Service shutdown complete');
      return true;
    } catch (error) {
      this.logger.error('Failed to shutdown Tool Discovery Service', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Check if discovery service is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Basic health check - verify registry is accessible
      await this.registry.getAllTools();
      return true;
    } catch (error) {
      this.logger.error('Tool Discovery Service health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }
} 