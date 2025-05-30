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
} from '../../../../agents/shared/base/managers/KnowledgeManager.interface';
import { AgentBase } from '../../../../agents/shared/base/AgentBase.interface';
import { AbstractBaseManager } from '../../../../agents/shared/base/managers/BaseManager';
import { createConfigFactory } from '../../../../agents/shared/config';
import { KnowledgeManagerConfigSchema } from '../../../../agents/shared/knowledge/config/KnowledgeManagerConfigSchema';
import { ManagerType } from '../../../../agents/shared/base/managers/ManagerType';
import { ManagerHealth } from '../../../../agents/shared/base/managers/ManagerHealth';

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
export class DefaultKnowledgeManager extends AbstractBaseManager implements KnowledgeManager {
  private knowledge: Map<string, KnowledgeEntry> = new Map();
  private gaps: Map<string, KnowledgeGap> = new Map();
  private refreshTimer: NodeJS.Timeout | null = null;
  private configFactory = createConfigFactory(KnowledgeManagerConfigSchema);
  
  /**
   * Type property accessor for compatibility with KnowledgeManager
   * Use managerType from the parent class
   */
  get type(): string {
    return this.managerType;
  }

  /**
   * Create a new DefaultKnowledgeManager instance
   * 
   * @param agent - The agent this manager belongs to
   * @param config - Configuration options
   */
  constructor(agent: AgentBase, config: Partial<KnowledgeManagerConfig> = {}) {
    const managerId = `knowledge-manager-${uuidv4()}`;
    super(
      managerId,
      ManagerType.KNOWLEDGE,
      agent,
      {
        enabled: true,
        enableAutoRefresh: true,
        refreshIntervalMs: 300000,
        maxKnowledgeItems: 1000,
        ...config
      }
    );
  }

  /**
   * Update the manager configuration
   */
  updateConfig<T extends KnowledgeManagerConfig>(config: Partial<T>): T {
    // Validate and merge configuration
    const validatedConfig = this.configFactory.create({
      ...this._config, 
      ...config
    }) as KnowledgeManagerConfig;
    
    this._config = validatedConfig;
    
    // If auto-refresh config changed, update the timer
    if (('enableAutoRefresh' in config || 'refreshIntervalMs' in config) && this._initialized) {
      // Clear existing timer
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
      }
      
      // Setup timer if enabled
      if (validatedConfig.enableAutoRefresh) {
        this.setupAutoRefresh();
      }
    }
    
    return validatedConfig as T;
  }

  /**
   * Initialize the manager
   */
  async initialize(): Promise<boolean> {
    const initialized = await super.initialize();
    if (!initialized) {
      return false;
    }

    // Setup auto-refresh if enabled
    const config = this.getConfig<KnowledgeManagerConfig>();
    if (config.enableAutoRefresh) {
      this.setupAutoRefresh();
    }

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
    
    await super.shutdown();
  }

  /**
   * Reset the manager to its initial state
   */
  async reset(): Promise<boolean> {
    console.log(`[${this.managerId}] Resetting ${this.managerType} manager`);
    this.knowledge.clear();
    this.gaps.clear();
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    return super.reset();
  }

  /**
   * Get manager health status
   */
  async getHealth(): Promise<ManagerHealth> {
    if (!this._initialized) {
      return {
        status: 'degraded',
        details: {
          lastCheck: new Date(),
          issues: [{
            severity: 'high',
            message: 'Knowledge manager not initialized',
            detectedAt: new Date()
          }],
          metrics: {}
        }
      };
    }

    const stats = await this.getStats();
    
    if (!this.isEnabled()) {
      return {
        status: 'unhealthy',
        details: {
          lastCheck: new Date(),
          issues: [{
            severity: 'critical',
            message: 'Knowledge manager is disabled',
            detectedAt: new Date()
          }],
          metrics: stats
        }
      };
    }

    return {
      status: 'healthy',
      details: {
        lastCheck: new Date(),
        issues: [],
        metrics: stats
      }
    };
  }

  /**
   * Load knowledge from configured sources
   */
  async loadKnowledge(): Promise<void> {
    if (!this._initialized) {
      throw new KnowledgeError(
        'Knowledge manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    const config = this.getConfig<KnowledgeManagerConfig>();
    console.log(`[${this.managerId}] Loading knowledge from paths:`, config.knowledgePaths);
    
    // In a real implementation, this would load from the specified paths
    // For now, it's just a placeholder
  }

  /**
   * Search knowledge with the given query
   */
  async searchKnowledge(query: string, options: KnowledgeSearchOptions = {}): Promise<KnowledgeSearchResult[]> {
    if (!this._initialized) {
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
    if (!this._initialized) {
      throw new KnowledgeError(
        'Knowledge manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    if (!this._config.allowRuntimeUpdates) {
      throw new KnowledgeError(
        'Runtime knowledge updates are disabled',
        'UPDATES_DISABLED'
      );
    }

    const config = this.getConfig<KnowledgeManagerConfig>();
    const maxEntries = config.maxKnowledgeEntries ?? 1000;
    
    // Check if we need to prune entries
    if (this.knowledge.size > maxEntries) {
      this.pruneKnowledge();
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
    
    return newEntry;
  }

  /**
   * Get a knowledge entry by ID
   */
  async getKnowledgeEntry(id: string): Promise<KnowledgeEntry | null> {
    if (!this._initialized) {
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
    if (!this._initialized) {
      throw new KnowledgeError(
        'Knowledge manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    if (!this._config.allowRuntimeUpdates) {
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
    if (!this._initialized) {
      throw new KnowledgeError(
        'Knowledge manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    if (!this._config.allowRuntimeUpdates) {
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
    if (!this._initialized) {
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
    if (!this._initialized) {
      throw new KnowledgeError(
        'Knowledge manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    if (!this._config.enableGapIdentification) {
      return [];
    }

    // Basic implementation - in a real system this would use more sophisticated analysis
    // For example looking at question patterns with no good answers, or topics with
    // low confidence scores, etc.
    
    // For demonstration purposes, just return existing gaps
    return Array.from(this.gaps.values());
  }

  /**
   * Get a knowledge gap by ID
   */
  async getKnowledgeGap(id: string): Promise<KnowledgeGap | null> {
    if (!this._initialized) {
      throw new KnowledgeError(
        'Knowledge manager not initialized',
        'NOT_INITIALIZED'
      );
    }

    return this.gaps.get(id) || null;
  }

  /**
   * Check if the manager is initialized
   */
  public isInitialized(): boolean {
    return this._initialized;
  }

  // Private helper methods

  /**
   * Setup automatic knowledge refresh
   */
  private setupAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    
    const config = this.getConfig<KnowledgeManagerConfig>();
    this.refreshTimer = setInterval(async () => {
      try {
        await this.loadKnowledge();
      } catch (error) {
        console.error(`[${this.managerId}] Error during auto-refresh:`, error);
      }
    }, config.refreshIntervalMs ?? 300000);
  }

  /**
   * Prune knowledge entries to stay within limits
   */
  private pruneKnowledge(): void {
    const config = this.getConfig<KnowledgeManagerConfig>();
    const maxEntries = config.maxKnowledgeEntries ?? 1000;
    
    if (this.knowledge.size <= maxEntries) {
      return;
    }

    // Sort entries by timestamp (most recent first)
    const entries = Array.from(this.knowledge.entries())
      .sort(([, a], [, b]) => b.timestamp.getTime() - a.timestamp.getTime());

    // Keep only the most recent entries up to maxEntries
    const entriesToKeep = entries.slice(0, maxEntries);
    
    // Clear and rebuild the map
    this.knowledge.clear();
    for (const [id, entry] of entriesToKeep) {
      this.knowledge.set(id, entry);
    }
  }

  /**
   * Get knowledge manager statistics
   */
  private async getStats(): Promise<{
    totalItems: number;
    itemsByType: Record<string, number>;
    avgConfidence: number;
    lastRefreshAt?: Date;
  }> {
    const items = Array.from(this.knowledge.values());
    const itemsByType = items.reduce((acc, item) => {
      const type = typeof item;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalItems: items.length,
      itemsByType,
      avgConfidence: 1.0, // TODO: Implement confidence tracking
      lastRefreshAt: new Date()
    };
  }
} 