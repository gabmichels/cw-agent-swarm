/**
 * Advanced Search Service
 * 
 * Provides comprehensive advanced search features including:
 * - Fuzzy search with typo tolerance
 * - Enhanced semantic search with better relevance scoring
 * - Intelligent result ranking and re-ranking
 * - Search history and suggestions
 * - Query expansion and auto-completion
 * - Multi-modal search capabilities
 */

import { ulid } from 'ulid';
import { SearchService } from './search-service';
import { EnhancedMemoryService } from '../multi-agent/enhanced-memory-service';
import { PerformanceOptimizer } from '../multi-agent/performance-optimizer';
import { EmbeddingService } from '../client/embedding-service';
import { IMemoryClient } from '../client/types';
import { BaseMemorySchema } from '../../models/base-schema';
import { MemoryType } from '../../config/types';
import { CacheManager } from '../cache/types';

/**
 * Fuzzy search configuration
 */
export interface FuzzySearchConfig {
  readonly maxEditDistance: number;
  readonly minSimilarityThreshold: number;
  readonly enablePhoneticMatching: boolean;
  readonly enableStemming: boolean;
  readonly typoTolerance: 'strict' | 'moderate' | 'lenient';
}

/**
 * Search result with enhanced scoring
 */
export interface AdvancedSearchResult<T extends BaseMemorySchema> {
  readonly id: string;
  readonly content: string;
  readonly metadata: T;
  readonly scores: {
    readonly relevance: number;      // 0-1 semantic relevance
    readonly freshness: number;      // 0-1 based on recency
    readonly popularity: number;     // 0-1 based on access frequency
    readonly quality: number;        // 0-1 content quality score
    readonly composite: number;      // 0-1 final weighted score
  };
  readonly highlights: readonly string[];
  readonly reasoning: string;
  readonly searchType: 'exact' | 'fuzzy' | 'semantic' | 'hybrid';
}

/**
 * Search suggestion
 */
export interface SearchSuggestion {
  readonly query: string;
  readonly type: 'history' | 'completion' | 'correction' | 'expansion';
  readonly confidence: number;
  readonly resultCount?: number;
}

/**
 * Search analytics
 */
export interface SearchAnalytics {
  readonly query: string;
  readonly timestamp: number;
  readonly resultCount: number;
  readonly executionTimeMs: number;
  readonly searchType: string;
  readonly userId?: string;
  readonly agentId?: string;
}

/**
 * Advanced search parameters
 */
export interface AdvancedSearchParams {
  readonly query: string;
  readonly types?: readonly MemoryType[];
  readonly fuzzySearch?: boolean;
  readonly semanticSearch?: boolean;
  readonly enableRanking?: boolean;
  readonly enableSuggestions?: boolean;
  readonly limit?: number;
  readonly offset?: number;
  readonly minScore?: number;
  readonly maxAge?: number; // Max age in milliseconds
  readonly userId?: string;
  readonly agentId?: string;
  readonly filters?: Record<string, any>;
  readonly sortBy?: 'relevance' | 'date' | 'popularity' | 'quality';
  readonly includeAnalytics?: boolean;
}

/**
 * Default fuzzy search configuration
 */
const DEFAULT_FUZZY_CONFIG: FuzzySearchConfig = {
  maxEditDistance: 2,
  minSimilarityThreshold: 0.6,
  enablePhoneticMatching: true,
  enableStemming: true,
  typoTolerance: 'moderate'
};

/**
 * Advanced Search Service
 */
export class AdvancedSearchService {
  private searchHistory: Map<string, SearchAnalytics[]> = new Map();
  private queryFrequency: Map<string, number> = new Map();
  private fuzzyConfig: FuzzySearchConfig;
  
  constructor(
    private readonly searchService: SearchService,
    private readonly enhancedMemoryService: EnhancedMemoryService,
    private readonly embeddingService: EmbeddingService,
    private readonly memoryClient: IMemoryClient,
    private readonly cacheManager?: CacheManager,
    private readonly performanceOptimizer?: PerformanceOptimizer,
    fuzzyConfig?: Partial<FuzzySearchConfig>
  ) {
    this.fuzzyConfig = { ...DEFAULT_FUZZY_CONFIG, ...fuzzyConfig };
  }

  /**
   * Perform advanced search with multiple search strategies
   */
  async search<T extends BaseMemorySchema>(
    params: AdvancedSearchParams
  ): Promise<{
    results: AdvancedSearchResult<T>[];
    suggestions: SearchSuggestion[];
    analytics: SearchAnalytics;
  }> {
    const startTime = Date.now();
    const searchId = ulid();
    
    try {
      // Normalize and analyze query
      const normalizedQuery = this.normalizeQuery(params.query);
      const queryAnalysis = await this.analyzeQuery(normalizedQuery);
      
      // Generate search suggestions
      const suggestions = params.enableSuggestions ? 
        await this.generateSuggestions(normalizedQuery, params) : [];
      
      // Execute multiple search strategies in parallel
      const searchPromises: Promise<AdvancedSearchResult<T>[]>[] = [];
      
      // 1. Exact match search
      searchPromises.push(this.executeExactSearch<T>(normalizedQuery, params));
      
      // 2. Fuzzy search (if enabled)
      if (params.fuzzySearch !== false) {
        searchPromises.push(this.executeFuzzySearch<T>(normalizedQuery, params));
      }
      
      // 3. Semantic search (if enabled)
      if (params.semanticSearch !== false) {
        searchPromises.push(this.executeSemanticSearch<T>(normalizedQuery, params));
      }
      
      // 4. Hybrid search for comprehensive results
      searchPromises.push(this.executeHybridSearch<T>(normalizedQuery, params));
      
      // Wait for all searches to complete
      const searchResults = await Promise.all(searchPromises);
      
      // Merge and deduplicate results
      const mergedResults = this.mergeSearchResults<T>(searchResults);
      
      // Apply intelligent ranking
      const rankedResults = params.enableRanking !== false ? 
        await this.rankResults<T>(mergedResults, normalizedQuery, params) : 
        mergedResults;
      
      // Apply sorting and pagination
      const finalResults = this.applySortingAndPagination<T>(
        rankedResults, 
        params.sortBy || 'relevance',
        params.limit || 20,
        params.offset || 0
      );
      
      // Record analytics
      const executionTime = Date.now() - startTime;
      const analytics = this.recordAnalytics(params, finalResults.length, executionTime);
      
      return {
        results: finalResults,
        suggestions,
        analytics
      };
    } catch (error) {
      console.error('Advanced search failed:', error);
      
      // Fallback to basic search
      const fallbackResults = await this.fallbackSearch<T>(params);
      const analytics = this.recordAnalytics(params, fallbackResults.length, Date.now() - startTime);
      
      return {
        results: fallbackResults,
        suggestions: [],
        analytics
      };
    }
  }

  /**
   * Get search suggestions based on query
   */
  async getSuggestions(
    partialQuery: string,
    params?: Partial<AdvancedSearchParams>
  ): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = [];
    
    // Query completion suggestions
    const completions = await this.generateQueryCompletions(partialQuery);
    suggestions.push(...completions);
    
    // Historical suggestions
    const historical = this.getHistoricalSuggestions(partialQuery, params?.userId);
    suggestions.push(...historical);
    
    // Typo corrections
    const corrections = this.generateTypoCorrections(partialQuery);
    suggestions.push(...corrections);
    
    // Query expansions
    const expansions = await this.generateQueryExpansions(partialQuery);
    suggestions.push(...expansions);
    
    // Sort by confidence and limit
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);
  }

  /**
   * Get search analytics for a user or agent
   */
  getSearchAnalytics(userId?: string, agentId?: string): {
    totalSearches: number;
    avgExecutionTime: number;
    topQueries: Array<{ query: string; count: number }>;
    searchPatterns: Array<{ pattern: string; frequency: number }>;
  } {
    const userKey = userId || agentId || 'global';
    const userHistory = this.searchHistory.get(userKey) || [];
    
    const totalSearches = userHistory.length;
    const avgExecutionTime = userHistory.length > 0 ? 
      userHistory.reduce((sum, entry) => sum + entry.executionTimeMs, 0) / userHistory.length : 0;
    
    // Calculate top queries
    const queryFreq = new Map<string, number>();
    userHistory.forEach(entry => {
      queryFreq.set(entry.query, (queryFreq.get(entry.query) || 0) + 1);
    });
    
    const topQueries = Array.from(queryFreq.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Identify search patterns
    const patterns = this.identifySearchPatterns(userHistory);
    
    return {
      totalSearches,
      avgExecutionTime,
      topQueries,
      searchPatterns: patterns
    };
  }

  // Private methods for search execution

  private async executeExactSearch<T extends BaseMemorySchema>(
    query: string,
    params: AdvancedSearchParams
  ): Promise<AdvancedSearchResult<T>[]> {
    try {
      // Use the existing search service for exact matches
      const results = await this.searchService.search<T>(query, {
        types: params.types as MemoryType[],
        limit: params.limit,
        offset: params.offset,
        minScore: params.minScore || 0.8, // Higher threshold for exact matches
        filter: params.filters
      });
      
      return results.map(result => this.formatSearchResult<T>(
        result,
        query,
        'exact',
        1.0 // High relevance for exact matches
      ));
    } catch (error) {
      console.error('Exact search failed:', error);
      return [];
    }
  }

  private async executeFuzzySearch<T extends BaseMemorySchema>(
    query: string,
    params: AdvancedSearchParams
  ): Promise<AdvancedSearchResult<T>[]> {
    try {
      // Generate fuzzy variations of the query
      const fuzzyQueries = this.generateFuzzyQueries(query);
      const allResults: AdvancedSearchResult<T>[] = [];
      
      for (const fuzzyQuery of fuzzyQueries) {
        const results = await this.searchService.search<T>(fuzzyQuery.query, {
          types: params.types as MemoryType[],
          limit: Math.ceil((params.limit || 20) / fuzzyQueries.length),
          minScore: (params.minScore || 0.6) * fuzzyQuery.confidence,
          filter: params.filters
        });
        
        const formattedResults = results.map(result => this.formatSearchResult<T>(
          result,
          query,
          'fuzzy',
          fuzzyQuery.confidence
        ));
        
        allResults.push(...formattedResults);
      }
      
      return allResults;
    } catch (error) {
      console.error('Fuzzy search failed:', error);
      return [];
    }
  }

  private async executeSemanticSearch<T extends BaseMemorySchema>(
    query: string,
    params: AdvancedSearchParams
  ): Promise<AdvancedSearchResult<T>[]> {
    try {
      // Use enhanced memory service for semantic search
      const searchParams = {
        query,
        type: params.types?.[0] || MemoryType.MESSAGE,
        limit: params.limit,
        offset: params.offset,
        filter: params.filters
      };
      
      const results = await this.enhancedMemoryService.searchMemories<T>(searchParams);
      
      return results.map(result => this.formatSearchResult<T>(
        {
          point: result,
          score: 0.8, // Default semantic score
          type: params.types?.[0] || MemoryType.MESSAGE,
          collection: 'memories'
        },
        query,
        'semantic',
        0.8
      ));
    } catch (error) {
      console.error('Semantic search failed:', error);
      return [];
    }
  }

  private async executeHybridSearch<T extends BaseMemorySchema>(
    query: string,
    params: AdvancedSearchParams
  ): Promise<AdvancedSearchResult<T>[]> {
    try {
      // Use the search service's hybrid search capability
      const results = await this.searchService.hybridSearch<T>(query, {
        types: params.types as MemoryType[],
        limit: params.limit,
        offset: params.offset,
        minScore: params.minScore,
        vectorWeight: 0.7,
        textWeight: 0.3,
        normalizeScores: true,
        filter: params.filters
      });
      
      return results.map(result => this.formatSearchResult<T>(
        result,
        query,
        'hybrid',
        result.score
      ));
    } catch (error) {
      console.error('Hybrid search failed:', error);
      return [];
    }
  }

  private mergeSearchResults<T extends BaseMemorySchema>(
    searchResults: AdvancedSearchResult<T>[][]
  ): AdvancedSearchResult<T>[] {
    const resultMap = new Map<string, AdvancedSearchResult<T>>();
    
    searchResults.forEach(results => {
      results.forEach(result => {
        const existingResult = resultMap.get(result.id);
        
        if (existingResult) {
          // Merge scores by taking the best composite score
          if (result.scores.composite > existingResult.scores.composite) {
            resultMap.set(result.id, result);
          }
        } else {
          resultMap.set(result.id, result);
        }
      });
    });
    
    return Array.from(resultMap.values());
  }

  private async rankResults<T extends BaseMemorySchema>(
    results: AdvancedSearchResult<T>[],
    query: string,
    params: AdvancedSearchParams
  ): Promise<AdvancedSearchResult<T>[]> {
    // Apply intelligent ranking algorithm
    return results.map(result => {
      const enhancedScores = this.calculateEnhancedScores(result, query, params);
      
      return {
        ...result,
        scores: enhancedScores
      };
    }).sort((a, b) => b.scores.composite - a.scores.composite);
  }

  private calculateEnhancedScores<T extends BaseMemorySchema>(
    result: AdvancedSearchResult<T>,
    query: string,
    params: AdvancedSearchParams
  ): AdvancedSearchResult<T>['scores'] {
    // Calculate various scoring factors
    const relevance = result.scores.relevance;
    const freshness = this.calculateFreshnessScore(result.metadata);
    const popularity = this.calculatePopularityScore(result.id);
    const quality = this.calculateQualityScore(result.content, result.metadata);
    
    // Weighted composite score
    const composite = (
      relevance * 0.4 +
      freshness * 0.2 +
      popularity * 0.2 +
      quality * 0.2
    );
    
    return {
      relevance,
      freshness,
      popularity,
      quality,
      composite
    };
  }

  private applySortingAndPagination<T extends BaseMemorySchema>(
    results: AdvancedSearchResult<T>[],
    sortBy: string,
    limit: number,
    offset: number
  ): AdvancedSearchResult<T>[] {
    // Sort results based on criteria
    let sortedResults = [...results];
    
    switch (sortBy) {
      case 'date':
        sortedResults.sort((a, b) => b.scores.freshness - a.scores.freshness);
        break;
      case 'popularity':
        sortedResults.sort((a, b) => b.scores.popularity - a.scores.popularity);
        break;
      case 'quality':
        sortedResults.sort((a, b) => b.scores.quality - a.scores.quality);
        break;
      case 'relevance':
      default:
        sortedResults.sort((a, b) => b.scores.composite - a.scores.composite);
        break;
    }
    
    // Apply pagination
    return sortedResults.slice(offset, offset + limit);
  }

  // Helper methods for various search features

  private normalizeQuery(query: string): string {
    return query.trim().toLowerCase();
  }

  private async analyzeQuery(query: string): Promise<{
    intent: string;
    entities: string[];
    complexity: number;
  }> {
    // Simple query analysis - could be enhanced with NLP
    const words = query.split(/\s+/);
    const complexity = Math.min(words.length / 10, 1);
    
    // Extract potential entities (capitalized words, dates, etc.)
    const entities = words.filter(word => 
      /^[A-Z][a-z]+$/.test(word) || 
      /\d{4}-\d{2}-\d{2}/.test(word) ||
      /\d+/.test(word)
    );
    
    // Determine intent based on keywords
    let intent = 'search';
    if (words.some(w => ['who', 'what', 'when', 'where', 'why', 'how'].includes(w))) {
      intent = 'question';
    } else if (words.some(w => ['find', 'search', 'look', 'get'].includes(w))) {
      intent = 'find';
    } else if (words.some(w => ['list', 'show', 'display'].includes(w))) {
      intent = 'list';
    }
    
    return { intent, entities, complexity };
  }

  private generateFuzzyQueries(query: string): Array<{ query: string; confidence: number }> {
    const fuzzyQueries: Array<{ query: string; confidence: number }> = [];
    const words = query.split(/\s+/);
    
    // Generate variations with common typos
    const commonTypos = new Map([
      ['the', ['teh', 'hte']],
      ['and', ['adn', 'nad']],
      ['you', ['yuo', 'oyu']],
      ['that', ['taht', 'htat']],
      ['with', ['wiht', 'whit']],
      ['have', ['ahve', 'hvae']],
      ['this', ['htis', 'tihs']],
      ['will', ['wlil', 'iwll']],
      ['from', ['form', 'fomr']],
      ['they', ['tehy', 'htey']]
    ]);
    
    // Add original query with highest confidence
    fuzzyQueries.push({ query, confidence: 1.0 });
    
    // Generate single-word typo variations
    words.forEach((word, index) => {
      if (commonTypos.has(word)) {
        commonTypos.get(word)!.forEach(typo => {
          const newWords = [...words];
          newWords[index] = typo;
          fuzzyQueries.push({
            query: newWords.join(' '),
            confidence: 0.8
          });
        });
      }
      
      // Generate edit distance variations for longer words
      if (word.length > 4) {
        const variations = this.generateEditDistanceVariations(word);
        variations.forEach(variation => {
          const newWords = [...words];
          newWords[index] = variation.word;
          fuzzyQueries.push({
            query: newWords.join(' '),
            confidence: variation.confidence
          });
        });
      }
    });
    
    return fuzzyQueries.slice(0, 5); // Limit to top 5 variations
  }

  private generateEditDistanceVariations(word: string): Array<{ word: string; confidence: number }> {
    const variations: Array<{ word: string; confidence: number }> = [];
    
    // Single character substitutions
    for (let i = 0; i < word.length; i++) {
      for (let c = 'a'; c <= 'z'; c = String.fromCharCode(c.charCodeAt(0) + 1)) {
        if (c !== word[i]) {
          const variation = word.substring(0, i) + c + word.substring(i + 1);
          variations.push({ word: variation, confidence: 0.7 });
        }
      }
    }
    
    // Single character deletions
    for (let i = 0; i < word.length; i++) {
      const variation = word.substring(0, i) + word.substring(i + 1);
      variations.push({ word: variation, confidence: 0.6 });
    }
    
    // Single character insertions
    for (let i = 0; i <= word.length; i++) {
      for (let c = 'a'; c <= 'z'; c = String.fromCharCode(c.charCodeAt(0) + 1)) {
        const variation = word.substring(0, i) + c + word.substring(i);
        variations.push({ word: variation, confidence: 0.6 });
      }
    }
    
    return variations.slice(0, 3); // Limit variations per word
  }

  private async generateSuggestions(
    query: string,
    params: AdvancedSearchParams
  ): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = [];
    
    // Add query completions
    const completions = await this.generateQueryCompletions(query);
    suggestions.push(...completions);
    
    // Add historical suggestions
    const historical = this.getHistoricalSuggestions(query, params.userId);
    suggestions.push(...historical);
    
    return suggestions.slice(0, 5);
  }

  private async generateQueryCompletions(partialQuery: string): Promise<SearchSuggestion[]> {
    // Simple completion based on common patterns
    const completions = [
      'how to',
      'what is',
      'when did',
      'where is',
      'why does',
      'who is'
    ];
    
    return completions
      .filter(completion => completion.startsWith(partialQuery.toLowerCase()))
      .map(completion => ({
        query: completion,
        type: 'completion' as const,
        confidence: 0.8
      }));
  }

  private getHistoricalSuggestions(query: string, userId?: string): SearchSuggestion[] {
    const userKey = userId || 'global';
    const history = this.searchHistory.get(userKey) || [];
    
    return history
      .filter(entry => entry.query.toLowerCase().includes(query.toLowerCase()))
      .map(entry => ({
        query: entry.query,
        type: 'history' as const,
        confidence: 0.9,
        resultCount: entry.resultCount
      }))
      .slice(0, 3);
  }

  private generateTypoCorrections(query: string): SearchSuggestion[] {
    // Simple typo correction suggestions
    const corrections: SearchSuggestion[] = [];
    
    // Check for common typos
    const typoMap = new Map([
      ['teh', 'the'],
      ['adn', 'and'],
      ['yuo', 'you'],
      ['recieve', 'receive'],
      ['seperate', 'separate'],
      ['definately', 'definitely']
    ]);
    
    const words = query.split(/\s+/);
    let hasCorrections = false;
    
    const correctedWords = words.map(word => {
      const correction = typoMap.get(word.toLowerCase());
      if (correction) {
        hasCorrections = true;
        return correction;
      }
      return word;
    });
    
    if (hasCorrections) {
      corrections.push({
        query: correctedWords.join(' '),
        type: 'correction',
        confidence: 0.9
      });
    }
    
    return corrections;
  }

  private async generateQueryExpansions(query: string): Promise<SearchSuggestion[]> {
    // Simple query expansion with synonyms
    const expansions: SearchSuggestion[] = [];
    
    const synonymMap = new Map([
      ['search', ['find', 'look', 'discover']],
      ['document', ['file', 'paper', 'text']],
      ['message', ['text', 'communication', 'note']],
      ['task', ['job', 'work', 'assignment']],
      ['agent', ['bot', 'assistant', 'helper']]
    ]);
    
    const words = query.split(/\s+/);
    
    words.forEach(word => {
      const synonyms = synonymMap.get(word.toLowerCase());
      if (synonyms) {
        synonyms.forEach(synonym => {
          const expandedQuery = query.replace(new RegExp(`\\b${word}\\b`, 'gi'), synonym);
          expansions.push({
            query: expandedQuery,
            type: 'expansion',
            confidence: 0.7
          });
        });
      }
    });
    
    return expansions.slice(0, 2);
  }

  private formatSearchResult<T extends BaseMemorySchema>(
    result: any,
    originalQuery: string,
    searchType: 'exact' | 'fuzzy' | 'semantic' | 'hybrid',
    baseRelevance: number
  ): AdvancedSearchResult<T> {
    const content = result.point?.payload?.text || result.point?.payload?.content || '';
    const metadata = result.point?.payload || result.point?.metadata || {};
    
    return {
      id: result.point?.id || ulid(),
      content,
      metadata: metadata as T,
      scores: {
        relevance: baseRelevance,
        freshness: this.calculateFreshnessScore(metadata),
        popularity: this.calculatePopularityScore(result.point?.id || ''),
        quality: this.calculateQualityScore(content, metadata),
        composite: baseRelevance
      },
      highlights: this.extractHighlights(originalQuery, content),
      reasoning: this.generateReasoning(searchType, baseRelevance),
      searchType
    };
  }

  private calculateFreshnessScore(metadata: any): number {
    const timestamp = metadata.timestamp || metadata.createdAt || Date.now();
    const age = Date.now() - new Date(timestamp).getTime();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    return Math.max(0, 1 - (age / maxAge));
  }

  private calculatePopularityScore(id: string): number {
    // Simple popularity based on access frequency
    // In a real implementation, this would track actual access patterns
    return Math.random() * 0.5 + 0.5; // Placeholder
  }

  private calculateQualityScore(content: string, metadata: any): number {
    let score = 0.5; // Base score
    
    // Length factor
    if (content.length > 100) score += 0.2;
    if (content.length > 500) score += 0.1;
    
    // Metadata richness
    if (metadata.title) score += 0.1;
    if (metadata.tags && metadata.tags.length > 0) score += 0.1;
    if (metadata.importance === 'high') score += 0.1;
    
    return Math.min(score, 1.0);
  }

  private extractHighlights(query: string, content: string): string[] {
    const highlights: string[] = [];
    const words = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();
    
    words.forEach(word => {
      const index = contentLower.indexOf(word);
      if (index !== -1) {
        const start = Math.max(0, index - 20);
        const end = Math.min(content.length, index + word.length + 20);
        highlights.push('...' + content.substring(start, end) + '...');
      }
    });
    
    return highlights.slice(0, 3);
  }

  private generateReasoning(searchType: string, relevance: number): string {
    const reasons = [];
    
    switch (searchType) {
      case 'exact':
        reasons.push('Exact match found');
        break;
      case 'fuzzy':
        reasons.push('Fuzzy match with typo tolerance');
        break;
      case 'semantic':
        reasons.push('Semantic similarity detected');
        break;
      case 'hybrid':
        reasons.push('Hybrid search combining multiple strategies');
        break;
    }
    
    if (relevance > 0.8) reasons.push('High relevance score');
    if (relevance > 0.6) reasons.push('Good relevance score');
    
    return reasons.join(', ');
  }

  private recordAnalytics(
    params: AdvancedSearchParams,
    resultCount: number,
    executionTime: number
  ): SearchAnalytics {
    const analytics: SearchAnalytics = {
      query: params.query,
      timestamp: Date.now(),
      resultCount,
      executionTimeMs: executionTime,
      searchType: 'advanced',
      userId: params.userId,
      agentId: params.agentId
    };
    
    // Store analytics
    const userKey = params.userId || params.agentId || 'global';
    const userHistory = this.searchHistory.get(userKey) || [];
    userHistory.push(analytics);
    
    // Keep only last 1000 entries per user
    if (userHistory.length > 1000) {
      userHistory.splice(0, userHistory.length - 1000);
    }
    
    this.searchHistory.set(userKey, userHistory);
    
    // Update query frequency
    this.queryFrequency.set(params.query, (this.queryFrequency.get(params.query) || 0) + 1);
    
    return analytics;
  }

  private identifySearchPatterns(history: SearchAnalytics[]): Array<{ pattern: string; frequency: number }> {
    const patterns = new Map<string, number>();
    
    history.forEach(entry => {
      // Identify time-based patterns
      const hour = new Date(entry.timestamp).getHours();
      const timePattern = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
      patterns.set(`${timePattern}_search`, (patterns.get(`${timePattern}_search`) || 0) + 1);
      
      // Identify query length patterns
      const wordCount = entry.query.split(/\s+/).length;
      const lengthPattern = wordCount <= 2 ? 'short' : wordCount <= 5 ? 'medium' : 'long';
      patterns.set(`${lengthPattern}_query`, (patterns.get(`${lengthPattern}_query`) || 0) + 1);
    });
    
    return Array.from(patterns.entries())
      .map(([pattern, frequency]) => ({ pattern, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);
  }

  private async fallbackSearch<T extends BaseMemorySchema>(
    params: AdvancedSearchParams
  ): Promise<AdvancedSearchResult<T>[]> {
    try {
      // Simple fallback using basic search service
      const results = await this.searchService.search<T>(params.query, {
        types: params.types as MemoryType[],
        limit: params.limit || 10,
        minScore: 0.5
      });
      
      return results.map(result => this.formatSearchResult<T>(
        result,
        params.query,
        'exact',
        result.score
      ));
    } catch (error) {
      console.error('Fallback search failed:', error);
      return [];
    }
  }
}