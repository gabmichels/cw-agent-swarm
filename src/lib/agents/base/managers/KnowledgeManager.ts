/**
 * Knowledge Manager Interface
 * 
 * This file defines the knowledge manager interface that provides knowledge management
 * services for agents. It extends the base manager interface with knowledge-specific functionality.
 */

import type { BaseManager, ManagerConfig } from '../../../../agents/shared/base/managers/BaseManager';
import type { AgentBase } from '../../../../agents/shared/base/AgentBase';

/**
 * Configuration options for knowledge managers
 */
export interface KnowledgeManagerConfig extends ManagerConfig {
  /** Whether this manager is enabled */
  enabled: boolean;
  
  /** Knowledge directories to load from */
  knowledgePaths?: string[];
  
  /** Department for domain-specific knowledge */
  department?: string;
  
  /** Whether to enable knowledge graph construction */
  enableKnowledgeGraph?: boolean;
  
  /** Whether to automatically refresh knowledge */
  enableAutoRefresh?: boolean;
  
  /** Refresh interval in milliseconds */
  refreshIntervalMs?: number;
  
  /** Maximum knowledge entries to keep in memory */
  maxKnowledgeEntries?: number;
  
  /** Whether to enable knowledge gap identification */
  enableGapIdentification?: boolean;
  
  /** Whether to allow runtime knowledge updates */
  allowRuntimeUpdates?: boolean;
}

/**
 * Knowledge entry interface
 */
export interface KnowledgeEntry {
  /** Unique ID for this knowledge entry */
  id: string;
  
  /** Human-readable title */
  title: string;
  
  /** Content of the knowledge */
  content: string;
  
  /** Source of the knowledge */
  source: string;
  
  /** Knowledge category/type */
  category?: string;
  
  /** Tags for categorization */
  tags?: string[];
  
  /** Confidence score (0-1) */
  confidence?: number;
  
  /** Timestamp when the knowledge was added */
  timestamp: Date;
  
  /** Whether this knowledge is verified */
  verified?: boolean;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Knowledge search result interface
 */
export interface KnowledgeSearchResult {
  /** The knowledge entry */
  entry: KnowledgeEntry;
  
  /** Relevance score for this search result (0-1) */
  relevance: number;
  
  /** Matching segments within the content */
  matches?: {
    text: string;
    position: number;
  }[];
}

/**
 * Knowledge search options interface
 */
export interface KnowledgeSearchOptions {
  /** Maximum results to return */
  limit?: number;
  
  /** Minimum relevance threshold (0-1) */
  threshold?: number;
  
  /** Knowledge category to filter by */
  category?: string;
  
  /** Tags to filter by */
  tags?: string[];
  
  /** Whether to include metadata in results */
  includeMetadata?: boolean;
  
  /** Whether to include match details */
  includeMatches?: boolean;
}

/**
 * Knowledge gap interface
 */
export interface KnowledgeGap {
  /** Unique ID for this knowledge gap */
  id: string;
  
  /** Human-readable description of the gap */
  description: string;
  
  /** Importance score (0-1) */
  importance: number;
  
  /** Related subjects/topics */
  relatedTopics?: string[];
  
  /** Suggested actions to fill the gap */
  suggestedActions?: string[];
  
  /** Gap detection timestamp */
  detectedAt: Date;
  
  /** Status of the gap */
  status: 'identified' | 'in_progress' | 'filled' | 'ignored';
}

/**
 * Knowledge manager interface
 */
export interface KnowledgeManager extends BaseManager {
  /**
   * Load knowledge from configured sources
   * @returns Promise resolving when knowledge loading is complete
   */
  loadKnowledge(): Promise<void>;
  
  /**
   * Search knowledge with the given query
   * @param query Search query
   * @param options Search options
   * @returns Promise resolving to search results
   */
  searchKnowledge(query: string, options?: KnowledgeSearchOptions): Promise<KnowledgeSearchResult[]>;
  
  /**
   * Add a new knowledge entry
   * @param entry The knowledge entry to add
   * @returns Promise resolving to the added entry
   */
  addKnowledgeEntry(entry: Omit<KnowledgeEntry, 'id' | 'timestamp'>): Promise<KnowledgeEntry>;
  
  /**
   * Get a knowledge entry by ID
   * @param id The entry ID to retrieve
   * @returns Promise resolving to the entry or null if not found
   */
  getKnowledgeEntry(id: string): Promise<KnowledgeEntry | null>;
  
  /**
   * Delete a knowledge entry
   * @param id The entry ID to delete
   * @returns Promise resolving to true if deleted, false if not found
   */
  deleteKnowledgeEntry(id: string): Promise<boolean>;
  
  /**
   * Update a knowledge entry
   * @param id The entry ID to update
   * @param updates The updates to apply
   * @returns Promise resolving to the updated entry
   */
  updateKnowledgeEntry(id: string, updates: Partial<KnowledgeEntry>): Promise<KnowledgeEntry>;
  
  /**
   * Get all knowledge entries matching criteria
   * @param options Filter options
   * @returns Promise resolving to matching entries
   */
  getKnowledgeEntries(options?: {
    category?: string;
    tags?: string[];
    source?: string;
    verified?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<KnowledgeEntry[]>;
  
  /**
   * Identify knowledge gaps
   * @returns Promise resolving to identified gaps
   */
  identifyKnowledgeGaps(): Promise<KnowledgeGap[]>;
  
  /**
   * Fill a knowledge gap
   * @param gapId The gap ID to fill
   * @param content The content to fill the gap with
   * @returns Promise resolving to true if filled successfully
   */
  fillKnowledgeGap(gapId: string, content: string): Promise<boolean>;
  
  /**
   * Get a specific knowledge gap
   * @param id The gap ID to retrieve
   * @returns Promise resolving to the gap or null if not found
   */
  getKnowledgeGap(id: string): Promise<KnowledgeGap | null>;
  
  /**
   * Get all knowledge gaps
   * @param options Filter options
   * @returns Promise resolving to matching gaps
   */
  getKnowledgeGaps(options?: {
    status?: KnowledgeGap['status'];
    minImportance?: number;
    limit?: number;
    offset?: number;
  }): Promise<KnowledgeGap[]>;
  
  /**
   * Find relationships between knowledge entries
   * @param entryId The entry ID to find relationships for
   * @param options Relationship options
   * @returns Promise resolving to related entries
   */
  findRelatedKnowledge(entryId: string, options?: {
    maxResults?: number;
    minRelevance?: number;
  }): Promise<KnowledgeSearchResult[]>;
  
  /**
   * Extract key insights from a set of knowledge entries
   * @param entryIds The entry IDs to analyze
   * @returns Promise resolving to extracted insights
   */
  extractInsights(entryIds: string[]): Promise<string[]>;
  
  /**
   * Get statistics about the knowledge base
   * @returns Promise resolving to knowledge statistics
   */
  getStats(): Promise<{
    totalEntries: number;
    entriesByCategory: Record<string, number>;
    entriesBySource: Record<string, number>;
    verifiedCount: number;
    unverifiedCount: number;
    knowledgeGaps: number;
    lastRefreshTime?: Date;
  }>;
} 