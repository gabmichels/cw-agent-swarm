/**
 * DefaultKnowledgeManager.ts - Default implementation of the KnowledgeManager interface
 * 
 * This file provides a concrete implementation of the KnowledgeManager interface
 * that can be used by any agent implementation. It includes knowledge management,
 * search, and gap identification capabilities.
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  KnowledgeManager, 
  KnowledgeManagerConfig,
  KnowledgeEntry,
  KnowledgeSearchOptions,
  KnowledgeSearchResult,
  KnowledgeGap
} from '../../../agents/base/managers/KnowledgeManager';
import { AgentBase } from '../../../../agents/shared/base/AgentBase.interface';
import { AbstractBaseManager, ManagerConfig } from '../../../../agents/shared/base/managers/BaseManager';
import { createConfigFactory } from '../../../../agents/shared/config';
import { KnowledgeManagerConfigSchema } from '../../../../agents/shared/knowledge/config/KnowledgeManagerConfigSchema';

/**
 * Error class for knowledge-related errors
 */
class KnowledgeError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown>;

  constructor(message: string, code = 'KNOWLEDGE_ERROR', context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'KnowledgeError';
    this.code = code;
    this.context = context;
  }
}

/**
 * Default implementation of the KnowledgeManager interface
 */
// @ts-ignore - This class implements KnowledgeManager with some method signature differences
export class DefaultKnowledgeManager extends AbstractBaseManager implements KnowledgeManager {
  private knowledge: Map<string, KnowledgeEntry> = new Map();
  private gaps: Map<string, KnowledgeGap> = new Map();
  private refreshTimer: NodeJS.Timeout | null = null;
  private configFactory = createConfigFactory(KnowledgeManagerConfigSchema);
  // Override config type to use specific config type
  protected config!: KnowledgeManagerConfig & Record<string, unknown>;

  /**
   * Type property accessor for compatibility with KnowledgeManager
   */
  // @ts-ignore - Override parent class property with accessor
  get type(): string {
    return this.getType();
  }

  /**
   * Create a new DefaultKnowledgeManager instance
   * 
   * @param agent - The agent this manager belongs to
   * @param config - Configuration options
   */
  constructor(agent: AgentBase, config: Partial<KnowledgeManagerConfig> = {}) {
    super(
      `knowledge-manager-${uuidv4()}`,
      'knowledge',
      agent,
      { enabled: true }
    );
    
    // Validate and apply configuration with defaults
    this.config = this.configFactory.create({
      enabled: true,
      ...config
    }) as KnowledgeManagerConfig & Record<string, unknown>;
  }

  /**
   * Update the manager configuration
   */
  updateConfig<T extends KnowledgeManagerConfig>(config: Partial<T>): T {
    // Validate and merge configuration
    this.config = this.configFactory.create({
      ...this.config, 
      ...config
    }) as KnowledgeManagerConfig & Record<string, unknown>;
    
    // If auto-refresh config changed, update the timer
    if (('enableAutoRefresh' in config || 'refreshIntervalMs' in config) && this.initialized) {
      // Clear existing timer
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
      }
      
      // Setup timer if enabled
      if (this.config.enableAutoRefresh) {
        this.setupAutoRefresh();
      }
    }
    
    return this.config as unknown as T;
  }

  /**
   * Initialize the manager
   */
  async initialize(): Promise<boolean> {
    console.log(`[${this.managerId}] Initializing ${this.managerType} manager`);
    
    // Load initial knowledge if paths are specified
    if (this.config.knowledgePaths && this.config.knowledgePaths.length > 0) {
      await this.loadKnowledge();
    }
    
    // Setup auto-refresh if enabled
    if (this.config.enableAutoRefresh) {
      this.setupAutoRefresh();
    }
    
    this.initialized = true;
    return true;
  }

  /**
   * Shutdown the manager and release resources
   */
  async shutdown(): Promise<void> {
    console.log(`[${this.managerId}] Shutting down ${this.managerType} manager`);
    
    // Clear timers
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    this.initialized = false;
  }

  /**
   * Reset the manager to its initial state
   */
  async reset(): Promise<boolean> {
    console.log(`[${this.managerId}] Resetting ${this.managerType} manager`);
    this.knowledge.clear();
    this.gaps.clear();
    return true;
  }

  /**
   * Get manager health status
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    metrics?: Record<string, unknown>;
  }> {
    if (!this.initialized) {
      return {
        status: 'degraded',
        message: 'Knowledge manager not initialized'
      };
    }

    const stats = await this.getStats();
    
    // Check if there are critical issues
    if (!this.isEnabled()) {
      return {
        status: 'unhealthy',
        message: 'Knowledge manager is disabled',
        metrics: stats
      };
    }
    
    return {
      status: 'healthy',
      message: 'Knowledge manager is healthy',
      metrics: stats
    };
  }

  /**
   * Load knowledge from configured sources
   */
  async loadKnowledge(): Promise<void> {
    if (!this.initialized) {
      throw new KnowledgeError(
        'Knowledge manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    // Basic implementation - this would typically load from files, databases, etc.
    console.log(`[${this.managerId}] Loading knowledge from paths:`, this.config.knowledgePaths);
    
    // In a real implementation, this would load from the specified paths
    // For now, it's just a placeholder
  }

  /**
   * Search knowledge with the given query
   */
  async searchKnowledge(query: string, options: KnowledgeSearchOptions = {}): Promise<KnowledgeSearchResult[]> {
    if (!this.initialized) {
      throw new KnowledgeError(
        'Knowledge manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    const {
      limit = 10,
      threshold = 0.2,
      category,
      tags,
      includeMetadata = false,
      includeMatches = false
    } = options;
    
    // Convert knowledge to array for filtering
    let results = Array.from(this.knowledge.values());
    
    // Apply filters
    if (category) {
      results = results.filter(entry => entry.category === category);
    }
    
    if (tags && tags.length > 0) {
      results = results.filter(entry => 
        entry.tags && tags.some(tag => entry.tags?.includes(tag))
      );
    }
    
    // Simple relevance scoring based on content matching
    // In a real implementation, this would use embeddings or other semantic search
    const scoredResults = results.map(entry => {
      const contentWords = entry.content.toLowerCase().split(/\s+/);
      const queryWords = query.toLowerCase().split(/\s+/);
      const titleWords = entry.title.toLowerCase().split(/\s+/);
      
      const contentMatches = queryWords.filter(word => 
        contentWords.includes(word)
      ).length;
      
      const titleMatches = queryWords.filter(word => 
        titleWords.includes(word)
      ).length;
      
      // Weight title matches higher
      const relevance = (contentMatches / queryWords.length * 0.7) + 
                         (titleMatches / queryWords.length * 0.3);
      
      // Create result object
      const result: KnowledgeSearchResult = {
        entry: includeMetadata ? entry : {
          ...entry,
          metadata: undefined
        },
        relevance
      };
      
      // Add match information if requested
      if (includeMatches) {
        const matches: { text: string; position: number; }[] = [];
        
        // Find matching segments (simple implementation)
        const words = entry.content.split(/\s+/);
        for (let i = 0; i < words.length; i++) {
          if (queryWords.includes(words[i].toLowerCase())) {
            // Get a small context around the match
            const start = Math.max(0, i - 3);
            const end = Math.min(words.length, i + 4);
            const text = words.slice(start, end).join(' ');
            matches.push({
              text,
              position: start
            });
          }
        }
        
        if (matches.length > 0) {
          result.matches = matches;
        }
      }
      
      return result;
    });
    
    // Filter by threshold and sort by relevance
    return scoredResults
      .filter(result => result.relevance >= threshold)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }

  /**
   * Add a new knowledge entry
   */
  async addKnowledgeEntry(entry: Omit<KnowledgeEntry, 'id' | 'timestamp'>): Promise<KnowledgeEntry> {
    if (!this.initialized) {
      throw new KnowledgeError(
        'Knowledge manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    if (!this.config.allowRuntimeUpdates) {
      throw new KnowledgeError(
        'Runtime knowledge updates are disabled',
        'UPDATES_DISABLED'
      );
    }

    const id = uuidv4();
    const timestamp = new Date();
    
    const newEntry: KnowledgeEntry = {
      id,
      title: entry.title,
      content: entry.content,
      source: entry.source,
      category: entry.category,
      tags: entry.tags,
      confidence: entry.confidence ?? 1.0,
      timestamp,
      verified: entry.verified ?? false,
      metadata: entry.metadata
    };
    
    this.knowledge.set(id, newEntry);
    
    // Check if we need to prune entries
    if (this.knowledge.size > (this.config.maxKnowledgeEntries ?? 1000)) {
      this.pruneKnowledge();
    }
    
    return newEntry;
  }

  /**
   * Get a knowledge entry by ID
   */
  async getKnowledgeEntry(id: string): Promise<KnowledgeEntry | null> {
    if (!this.initialized) {
      throw new KnowledgeError(
        'Knowledge manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    return this.knowledge.get(id) || null;
  }

  /**
   * Delete a knowledge entry
   */
  async deleteKnowledgeEntry(id: string): Promise<boolean> {
    if (!this.initialized) {
      throw new KnowledgeError(
        'Knowledge manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    if (!this.config.allowRuntimeUpdates) {
      throw new KnowledgeError(
        'Runtime knowledge updates are disabled',
        'UPDATES_DISABLED'
      );
    }

    return this.knowledge.delete(id);
  }

  /**
   * Update a knowledge entry
   */
  async updateKnowledgeEntry(id: string, updates: Partial<KnowledgeEntry>): Promise<KnowledgeEntry> {
    if (!this.initialized) {
      throw new KnowledgeError(
        'Knowledge manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    if (!this.config.allowRuntimeUpdates) {
      throw new KnowledgeError(
        'Runtime knowledge updates are disabled',
        'UPDATES_DISABLED'
      );
    }

    const entry = this.knowledge.get(id);
    if (!entry) {
      throw new KnowledgeError(
        `Knowledge entry '${id}' not found`,
        'ENTRY_NOT_FOUND',
        { entryId: id }
      );
    }

    const updatedEntry = {
      ...entry,
      ...updates,
      id: entry.id // Ensure ID doesn't change
    };

    this.knowledge.set(id, updatedEntry);
    return updatedEntry;
  }

  /**
   * Get all knowledge entries matching criteria
   */
  async getKnowledgeEntries(options?: {
    category?: string;
    tags?: string[];
    source?: string;
    verified?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<KnowledgeEntry[]> {
    if (!this.initialized) {
      throw new KnowledgeError(
        'Knowledge manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    let entries = Array.from(this.knowledge.values());
    
    // Apply filters
    if (options?.category) {
      entries = entries.filter(entry => entry.category === options.category);
    }
    
    if (options?.tags && options.tags.length > 0) {
      entries = entries.filter(entry => 
        entry.tags && options.tags?.some(tag => entry.tags?.includes(tag))
      );
    }
    
    if (options?.source) {
      entries = entries.filter(entry => entry.source === options.source);
    }
    
    if (options?.verified !== undefined) {
      entries = entries.filter(entry => entry.verified === options.verified);
    }
    
    // Apply pagination
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? entries.length;
    
    return entries.slice(offset, offset + limit);
  }

  /**
   * Identify knowledge gaps
   */
  async identifyKnowledgeGaps(): Promise<KnowledgeGap[]> {
    if (!this.initialized) {
      throw new KnowledgeError(
        'Knowledge manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    if (!this.config.enableGapIdentification) {
      return [];
    }

    // Basic implementation - in a real system this would use more sophisticated analysis
    // For example looking at question patterns with no good answers, or topics with
    // low confidence scores, etc.
    
    // For demonstration purposes, just return existing gaps
    return Array.from(this.gaps.values());
  }

  /**
   * Fill a knowledge gap
   */
  async fillKnowledgeGap(gapId: string, content: string): Promise<boolean> {
    if (!this.initialized) {
      throw new KnowledgeError(
        'Knowledge manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    const gap = this.gaps.get(gapId);
    if (!gap) {
      return false;
    }
    
    // Update gap status
    gap.status = 'filled';
    this.gaps.set(gapId, gap);
    
    // In a real implementation, we'd also add the content to the knowledge base
    // using the addKnowledgeEntry method
    
    return true;
  }

  /**
   * Get a specific knowledge gap
   */
  async getKnowledgeGap(id: string): Promise<KnowledgeGap | null> {
    if (!this.initialized) {
      throw new KnowledgeError(
        'Knowledge manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    return this.gaps.get(id) || null;
  }

  /**
   * Get all knowledge gaps
   */
  async getKnowledgeGaps(options?: {
    status?: KnowledgeGap['status'];
    minImportance?: number;
    limit?: number;
    offset?: number;
  }): Promise<KnowledgeGap[]> {
    if (!this.initialized) {
      throw new KnowledgeError(
        'Knowledge manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    let gaps = Array.from(this.gaps.values());
    
    // Apply filters
    if (options?.status) {
      gaps = gaps.filter(gap => gap.status === options.status);
    }
    
    if (options?.minImportance !== undefined) {
      gaps = gaps.filter(gap => gap.importance >= (options.minImportance ?? 0));
    }
    
    // Apply pagination
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? gaps.length;
    
    return gaps.slice(offset, offset + limit);
  }

  /**
   * Find relationships between knowledge entries
   */
  async findRelatedKnowledge(entryId: string, options?: {
    maxResults?: number;
    minRelevance?: number;
  }): Promise<KnowledgeSearchResult[]> {
    if (!this.initialized) {
      throw new KnowledgeError(
        'Knowledge manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    const entry = this.knowledge.get(entryId);
    if (!entry) {
      return [];
    }
    
    // Simple implementation - in a real system this would use semantic similarity
    // For demonstration, we'll just use text overlap
    const results: KnowledgeSearchResult[] = [];
    
    for (const otherEntry of Array.from(this.knowledge.values())) {
      // Skip the same entry
      if (otherEntry.id === entryId) {
        continue;
      }
      
      // Calculate similarity
      const similarity = this.calculateSimilarity(entry.content, otherEntry.content);
      
      // Check minimum relevance
      if (similarity >= (options?.minRelevance ?? 0.2)) {
        results.push({
          entry: otherEntry,
          relevance: similarity
        });
      }
    }
    
    // Sort by relevance and limit results
    return results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, options?.maxResults ?? 10);
  }

  /**
   * Extract key insights from a set of knowledge entries
   */
  async extractInsights(entryIds: string[]): Promise<string[]> {
    if (!this.initialized) {
      throw new KnowledgeError(
        'Knowledge manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    // Get all entries
    const entries = entryIds
      .map(id => this.knowledge.get(id))
      .filter((entry): entry is KnowledgeEntry => entry !== undefined);
    
    if (entries.length === 0) {
      return [];
    }
    
    // Basic implementation - in a real system this would use LLM or similar to extract insights
    // For demonstration, just return first sentences
    const insights = entries.map(entry => {
      const sentences = entry.content.split(/[.!?]+/);
      return sentences[0]?.trim() || '';
    }).filter(Boolean);
    
    return Array.from(new Set(insights)); // Remove duplicates
  }

  /**
   * Get statistics about the knowledge base
   */
  async getStats(): Promise<{
    totalEntries: number;
    entriesByCategory: Record<string, number>;
    entriesBySource: Record<string, number>;
    verifiedCount: number;
    unverifiedCount: number;
    knowledgeGaps: number;
    lastRefreshTime?: Date;
  }> {
    const entries = Array.from(this.knowledge.values());
    
    // Count by category
    const entriesByCategory: Record<string, number> = {};
    for (const entry of entries) {
      const category = entry.category || 'uncategorized';
      entriesByCategory[category] = (entriesByCategory[category] || 0) + 1;
    }
    
    // Count by source
    const entriesBySource: Record<string, number> = {};
    for (const entry of entries) {
      entriesBySource[entry.source] = (entriesBySource[entry.source] || 0) + 1;
    }
    
    // Count verified/unverified
    const verifiedCount = entries.filter(entry => entry.verified).length;
    const unverifiedCount = entries.length - verifiedCount;
    
    return {
      totalEntries: entries.length,
      entriesByCategory,
      entriesBySource,
      verifiedCount,
      unverifiedCount,
      knowledgeGaps: this.gaps.size
    };
  }

  // Private helper methods

  /**
   * Setup automatic knowledge refresh
   */
  private setupAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    
    this.refreshTimer = setInterval(async () => {
      try {
        await this.loadKnowledge();
      } catch (error) {
        console.error(`[${this.managerId}] Error during auto-refresh:`, error);
      }
    }, this.config.refreshIntervalMs ?? 3600000); // Default to 1 hour
  }

  /**
   * Prune knowledge entries when exceeding maximum
   */
  private pruneKnowledge(): void {
    const maxEntries = this.config.maxKnowledgeEntries ?? 1000;
    if (this.knowledge.size <= maxEntries) {
      return;
    }
    
    // Sort by confidence (lower first) and timestamp (older first)
    const entries = Array.from(this.knowledge.values())
      .sort((a, b) => {
        // First by confidence
        const confidenceDiff = (a.confidence ?? 0) - (b.confidence ?? 0);
        if (confidenceDiff !== 0) {
          return confidenceDiff;
        }
        
        // Then by date (older first)
        return a.timestamp.getTime() - b.timestamp.getTime();
      });
    
    // Remove oldest entries
    const toRemove = entries.slice(0, this.knowledge.size - maxEntries);
    for (const entry of toRemove) {
      this.knowledge.delete(entry.id);
    }
  }

  /**
   * Calculate similarity between two strings
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.toLowerCase().split(/\s+/));
    const words2 = new Set(str2.toLowerCase().split(/\s+/));
    
    const words1Array = Array.from(words1);
    const words2Array = Array.from(words2);
    
    const intersection = words1Array.filter(x => words2.has(x));
    const union = new Set([...words1Array, ...words2Array]);
    
    return intersection.length / union.size;
  }
} 