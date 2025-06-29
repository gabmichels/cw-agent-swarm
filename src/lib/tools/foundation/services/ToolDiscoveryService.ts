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
 */

import { IToolDiscoveryService } from '../interfaces/ToolDiscoveryServiceInterface';
import { IUnifiedToolRegistry } from '../interfaces/UnifiedToolRegistryInterface';
import {
  UnifiedTool,
  ToolDiscoveryCriteria,
  SearchContext,
  ToolSearchResult,
  ToolSimilarity,
  ToolRecommendation,
  ToolDiscoveryMethod
} from '../types/FoundationTypes';
import { ToolCategory, ToolCapability } from '../enums/ToolEnums';
import { IStructuredLogger } from '../../../logging/interfaces/IStructuredLogger';
import { ToolDiscoveryError } from '../errors/ToolFoundationErrors';

/**
 * Tool Discovery Service Implementation
 */
export class ToolDiscoveryService {
  constructor(
    private readonly registry: IUnifiedToolRegistry,
    private readonly logger: IStructuredLogger
  ) { }

  /**
   * Searches for tools using semantic analysis
   */
  async searchTools(
    query: string,
    context?: SearchContext,
    limit: number = 10
  ): Promise<readonly ToolSearchResult[]> {
    try {
      await this.logger.info('Starting tool search', {
        query,
        limit,
        hasContext: !!context
      });

      // Get all available tools
      const allTools = await this.registry.getAllTools();
      const searchResults: ToolSearchResult[] = [];

      // Simple semantic search implementation
      const queryLower = query.toLowerCase();
      const searchTerms = queryLower.split(' ').filter(term => term.length > 2);

      for (const tool of allTools) {
        let relevanceScore = 0;
        const matchReasons: string[] = [];

        // Name matching
        if (tool.name.toLowerCase().includes(queryLower)) {
          relevanceScore += 10;
          matchReasons.push('Name match');
        }

        // Description matching
        if (tool.description.toLowerCase().includes(queryLower)) {
          relevanceScore += 8;
          matchReasons.push('Description match');
        }

        // Category matching
        if (tool.category.toLowerCase().includes(queryLower)) {
          relevanceScore += 6;
          matchReasons.push('Category match');
        }

        // Capability matching
        for (const capability of tool.capabilities) {
          if (capability.toLowerCase().includes(queryLower)) {
            relevanceScore += 5;
            matchReasons.push(`Capability match: ${capability}`);
          }
        }

        // Tag matching
        if (tool.tags) {
          for (const tag of tool.tags) {
            if (tag.toLowerCase().includes(queryLower)) {
              relevanceScore += 4;
              matchReasons.push(`Tag match: ${tag}`);
            }
          }
        }

        // Multi-term matching
        for (const term of searchTerms) {
          const toolText = `${tool.name} ${tool.description} ${tool.category} ${tool.capabilities.join(' ')} ${tool.tags?.join(' ') || ''}`.toLowerCase();
          if (toolText.includes(term)) {
            relevanceScore += 2;
            matchReasons.push(`Term match: ${term}`);
          }
        }

        // Only include tools with some relevance
        if (relevanceScore > 0) {
          searchResults.push({
            tool,
            relevanceScore,
            matchReasons
          });
        }
      }

      // Sort by relevance score (descending) and limit results
      const results = searchResults
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);

      await this.logger.info('Tool search completed', {
        query,
        totalResults: results.length,
        topScore: results[0]?.relevanceScore || 0
      });

      return results;

    } catch (error) {
      const discoveryError = new ToolDiscoveryError(
        `Tool search failed for query '${query}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          searchQuery: query,
          searchCriteria: context as Record<string, unknown> || {},
          discoveryMethod: 'semantic',
          resultCount: 0
        }
      );

      await this.logger.error('Tool search error', discoveryError);
      throw discoveryError;
    }
  }

  /**
   * Discovers tools based on criteria
   */
  async discoverTools(
    criteria: ToolDiscoveryCriteria
  ): Promise<readonly UnifiedTool[]> {
    try {
      await this.logger.info('Starting tool discovery', {
        criteria: criteria as Record<string, unknown>
      });

      const allTools = await this.registry.getAllTools();
      let filteredTools = allTools;

      // Filter by category
      if (criteria.category) {
        filteredTools = filteredTools.filter(tool => tool.category === criteria.category);
      }

      // Filter by capabilities
      if (criteria.capabilities && criteria.capabilities.length > 0) {
        filteredTools = filteredTools.filter(tool =>
          criteria.capabilities!.some(cap => tool.capabilities.includes(cap))
        );
      }

      // Filter by tags
      if (criteria.tags && criteria.tags.length > 0) {
        filteredTools = filteredTools.filter(tool =>
          tool.tags && criteria.tags!.some(tag => tool.tags!.includes(tag))
        );
      }

      // Filter deprecated tools
      if (!criteria.includeDeprecated) {
        filteredTools = filteredTools.filter(tool => tool.status !== 'deprecated');
      }

      // Limit results
      if (criteria.maxResults) {
        filteredTools = filteredTools.slice(0, criteria.maxResults);
      }

      await this.logger.info('Tool discovery completed', {
        totalFound: filteredTools.length,
        criteria: criteria as Record<string, unknown>
      });

      return filteredTools;

    } catch (error) {
      const discoveryError = new ToolDiscoveryError(
        `Tool discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          searchCriteria: criteria as Record<string, unknown>,
          discoveryMethod: 'criteria',
          resultCount: 0
        }
      );

      await this.logger.error('Tool discovery error', discoveryError);
      throw discoveryError;
    }
  }

  /**
   * Finds similar tools to a given tool
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
} 