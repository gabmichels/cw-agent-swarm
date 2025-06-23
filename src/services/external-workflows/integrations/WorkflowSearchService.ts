import {
  WorkflowSearchQuery,
  WorkflowSearchResult,
  N8nWorkflowTemplate,
  WorkflowDetails,
  WorkflowCategory,
  WorkflowComplexity,
  WorkflowId,
  WorkflowIdGenerator,
  WorkflowSearchError,
  WorkflowDownloadError
} from '../../../types/workflow';
import { N8nWorkflowApiClient } from './N8nWorkflowApiClient';
import { logger } from '../../../lib/logging';

// === Service Interface ===

export interface IWorkflowSearchService {
  // Search Operations
  searchWorkflows(query: WorkflowSearchQuery): Promise<WorkflowSearchResult>;
  getWorkflowsByCategory(category: WorkflowCategory): Promise<readonly N8nWorkflowTemplate[]>;
  getWorkflowDetails(filename: string): Promise<WorkflowDetails>;
  
  // Browse Operations
  getAllCategories(): Promise<readonly WorkflowCategory[]>;
  getPopularWorkflows(limit?: number): Promise<readonly N8nWorkflowTemplate[]>;
  getRecentWorkflows(limit?: number): Promise<readonly N8nWorkflowTemplate[]>;
  
  // Advanced Discovery
  findSimilarWorkflows(workflowId: WorkflowId): Promise<readonly N8nWorkflowTemplate[]>;
  getWorkflowsByIntegration(service: string): Promise<readonly N8nWorkflowTemplate[]>;
  getWorkflowsByComplexity(complexity: WorkflowComplexity): Promise<readonly N8nWorkflowTemplate[]>;
}

// === Implementation ===

export class WorkflowSearchService implements IWorkflowSearchService {
  private readonly logger = logger;
  private readonly searchCache = new Map<string, { result: WorkflowSearchResult; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  constructor(
    private readonly apiClient: N8nWorkflowApiClient
  ) {}
  
  // === Search Operations ===
  
  async searchWorkflows(query: WorkflowSearchQuery): Promise<WorkflowSearchResult> {
    this.logger.debug('Searching workflows', { query });
    
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(query);
      const cached = this.searchCache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
        this.logger.debug('Returning cached search results');
        return cached.result;
      }
      
      // Perform search
      const startTime = Date.now();
      const result = await this.apiClient.searchWorkflows(query);
      const searchTime = Date.now() - startTime;
      
      // Update search time in result
      const enhancedResult: WorkflowSearchResult = {
        ...result,
        searchTime
      };
      
      // Cache the result
      this.searchCache.set(cacheKey, {
        result: enhancedResult,
        timestamp: Date.now()
      });
      
      this.logger.info('Workflow search completed', {
        query: query.q,
        totalResults: result.total,
        searchTime,
        resultCount: result.workflows.length
      });
      
      return enhancedResult;
      
    } catch (error) {
      this.logger.error('Failed to search workflows', {
        query,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new WorkflowSearchError(
        'Failed to search workflows',
        { query, originalError: error }
      );
    }
  }
  
  async getWorkflowsByCategory(category: WorkflowCategory): Promise<readonly N8nWorkflowTemplate[]> {
    this.logger.debug('Fetching workflows by category', { category });
    
    try {
      const workflows = await this.apiClient.getWorkflowsByCategory(category);
      
      this.logger.info('Category workflows retrieved', {
        category,
        count: workflows.length
      });
      
      return workflows;
      
    } catch (error) {
      this.logger.error('Failed to get workflows by category', { 
        category, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new WorkflowSearchError(
        `Failed to get workflows for category: ${category}`,
        { category, originalError: error }
      );
    }
  }
  
  async getWorkflowDetails(filename: string): Promise<WorkflowDetails> {
    this.logger.debug('Fetching workflow details', { filename });
    
    try {
      const details = await this.apiClient.getWorkflowDetails(filename);
      
      this.logger.debug('Workflow details retrieved', {
        filename,
        name: details.name
      });
      
      return details;
      
    } catch (error) {
      this.logger.error('Failed to get workflow details', { 
        filename, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new WorkflowSearchError(
        `Failed to get details for workflow: ${filename}`,
        { filename, originalError: error }
      );
    }
  }
  
  // === Browse Operations ===
  
  async getAllCategories(): Promise<readonly WorkflowCategory[]> {
    this.logger.debug('Fetching all categories');
    
    try {
      const categories = await this.apiClient.getAllCategories();
      
      this.logger.debug('Categories retrieved', { count: categories.length });
      
      return categories;
      
    } catch (error) {
      this.logger.error('Failed to get categories', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new WorkflowSearchError(
        'Failed to get workflow categories',
        { originalError: error }
      );
    }
  }
  
  async getPopularWorkflows(limit = 20): Promise<readonly N8nWorkflowTemplate[]> {
    this.logger.debug('Fetching popular workflows', { limit });
    
    try {
      const workflows = await this.apiClient.getPopularWorkflows(limit);
      
      this.logger.info('Popular workflows retrieved', {
        count: workflows.length,
        limit
      });
      
      return workflows;
      
    } catch (error) {
      this.logger.error('Failed to get popular workflows', { 
        limit, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new WorkflowSearchError(
        'Failed to get popular workflows',
        { limit, originalError: error }
      );
    }
  }
  
  async getRecentWorkflows(limit = 20): Promise<readonly N8nWorkflowTemplate[]> {
    this.logger.debug('Fetching recent workflows', { limit });
    
    try {
      const workflows = await this.apiClient.getRecentWorkflows(limit);
      
      this.logger.info('Recent workflows retrieved', {
        count: workflows.length,
        limit
      });
      
      return workflows;
      
    } catch (error) {
      this.logger.error('Failed to get recent workflows', { 
        limit, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new WorkflowSearchError(
        'Failed to get recent workflows',
        { limit, originalError: error }
      );
    }
  }
  
  // === Advanced Discovery ===
  
  async findSimilarWorkflows(workflowId: WorkflowId): Promise<readonly N8nWorkflowTemplate[]> {
    this.logger.debug('Finding similar workflows', { workflowId: workflowId.toString() });
    
    try {
      const workflows = await this.apiClient.findSimilarWorkflows(workflowId);
      
      this.logger.info('Similar workflows retrieved', {
        workflowId: workflowId.toString(),
        count: workflows.length
      });
      
      return workflows;
      
    } catch (error) {
      this.logger.error('Failed to find similar workflows', { 
        workflowId: workflowId.toString(), 
        error: error instanceof Error ? error.message : String(error)
      });
      throw new WorkflowSearchError(
        `Failed to find similar workflows for: ${workflowId.toString()}`,
        { workflowId: workflowId.toString(), originalError: error }
      );
    }
  }
  
  async getWorkflowsByIntegration(service: string): Promise<readonly N8nWorkflowTemplate[]> {
    this.logger.debug('Fetching workflows by integration', { service });
    
    try {
      const workflows = await this.apiClient.getWorkflowsByIntegration(service);
      
      this.logger.info('Integration workflows retrieved', {
        service,
        count: workflows.length
      });
      
      return workflows;
      
    } catch (error) {
      this.logger.error('Failed to get workflows by integration', { 
        service, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new WorkflowSearchError(
        `Failed to get workflows for integration: ${service}`,
        { service, originalError: error }
      );
    }
  }
  
  async getWorkflowsByComplexity(complexity: WorkflowComplexity): Promise<readonly N8nWorkflowTemplate[]> {
    this.logger.debug('Fetching workflows by complexity', { complexity });
    
    try {
      const workflows = await this.apiClient.getWorkflowsByComplexity(complexity);
      
      this.logger.info('Complexity workflows retrieved', {
        complexity,
        count: workflows.length
      });
      
      return workflows;
      
    } catch (error) {
      this.logger.error('Failed to get workflows by complexity', { 
        complexity, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new WorkflowSearchError(
        `Failed to get workflows for complexity: ${complexity}`,
        { complexity, originalError: error }
      );
    }
  }
  
  // === Helper Methods ===
  
  /**
   * Performs a comprehensive search across multiple dimensions
   */
  async performAdvancedSearch(
    searchTerm: string,
    filters?: {
      categories?: readonly WorkflowCategory[];
      integrations?: readonly string[];
      complexities?: readonly WorkflowComplexity[];
      minNodes?: number;
      maxNodes?: number;
    }
  ): Promise<WorkflowSearchResult> {
    this.logger.debug('Performing advanced search', { searchTerm, filters });
    
    const query: WorkflowSearchQuery = {
      q: searchTerm,
      limit: 50,
      sortBy: 'popularity',
      sortOrder: 'desc',
      ...filters
    };
    
    // If multiple categories specified, perform multiple searches and merge
    if (filters?.categories && filters.categories.length > 1) {
      const searches = filters.categories.map(category =>
        this.searchWorkflows({ ...query, category })
      );
      
      const results = await Promise.all(searches);
      
      // Merge results and deduplicate
      const allWorkflows = results.flatMap(result => result.workflows);
      const uniqueWorkflows = this.deduplicateWorkflows(allWorkflows);
      
      return {
        workflows: uniqueWorkflows,
        total: uniqueWorkflows.length,
        categories: results.flatMap(r => r.categories),
        integrations: results.flatMap(r => r.integrations),
        searchTime: Math.max(...results.map(r => r.searchTime)),
        suggestions: results.flatMap(r => r.suggestions),
        filters: results[0]?.filters || {
          availableCategories: [],
          availableTriggers: [],
          availableComplexities: [],
          nodeCountRange: { min: 0, max: 100 }
        }
      };
    }
    
    return this.searchWorkflows(query);
  }
  
  /**
   * Gets trending workflows based on recent activity
   */
  async getTrendingWorkflows(limit = 10): Promise<readonly N8nWorkflowTemplate[]> {
    this.logger.debug('Fetching trending workflows', { limit });
    
    try {
      // Use search with recent sorting to get trending workflows
      const result = await this.searchWorkflows({
        limit,
        sortBy: 'recent',
        sortOrder: 'desc',
        active: true
      });
      
      this.logger.info('Trending workflows retrieved', { count: result.workflows.length });
      
      return result.workflows;
      
    } catch (error) {
      this.logger.error('Failed to get trending workflows', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw new WorkflowSearchError(
        'Failed to get trending workflows',
        { originalError: error }
      );
    }
  }
  
  /**
   * Clears the search cache
   */
  clearCache(): void {
    this.logger.debug('Clearing search cache');
    this.searchCache.clear();
  }
  
  /**
   * Gets cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.searchCache.size,
      hitRate: 0 // TODO: Implement hit rate tracking
    };
  }
  
  // === Private Helper Methods ===
  
  private generateCacheKey(query: WorkflowSearchQuery): string {
    // Create deterministic cache key from query parameters
    const keyParts = [
      query.q || '',
      query.category || '',
      query.trigger || '',
      query.complexity || '',
      [...(query.integrations || [])].sort().join(','),
      query.minNodes?.toString() || '',
      query.maxNodes?.toString() || '',
      query.active?.toString() || '',
      query.limit?.toString() || '',
      query.offset?.toString() || '',
      query.sortBy || '',
      query.sortOrder || ''
    ];
    
    return keyParts.join('|');
  }
  
  private deduplicateWorkflows(workflows: readonly N8nWorkflowTemplate[]): readonly N8nWorkflowTemplate[] {
    const seen = new Set<string>();
    const unique: N8nWorkflowTemplate[] = [];
    
    for (const workflow of workflows) {
      const key = workflow.filename; // Use filename as unique identifier
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(workflow);
      }
    }
    
    return unique;
  }
} 