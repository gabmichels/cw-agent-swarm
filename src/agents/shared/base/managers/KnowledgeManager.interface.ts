/**
 * KnowledgeManager.interface.ts - Knowledge Manager Interface
 * 
 * This file defines the knowledge manager interface that provides knowledge management
 * and retrieval for agents. It extends the base manager interface with 
 * knowledge-specific functionality.
 */

import { BaseManager, ManagerConfig } from './BaseManager';

/**
 * Configuration options for knowledge managers
 */
export interface KnowledgeManagerConfig extends ManagerConfig {
  /** Whether to enable automatic knowledge refresh */
  enableAutoRefresh?: boolean;
  
  /** Interval for knowledge refresh in milliseconds */
  refreshIntervalMs?: number;
  
  /** Knowledge source paths */
  knowledgePaths?: string[];
  
  /** Maximum number of knowledge entries to store */
  maxKnowledgeEntries?: number;
  
  /** Whether to allow runtime knowledge updates */
  allowRuntimeUpdates?: boolean;
  
  /** Whether to enable knowledge gap identification */
  enableGapIdentification?: boolean;
  
  /** Default language for knowledge content */
  defaultLanguage?: string;
}

/**
 * Knowledge entry structure
 */
export interface KnowledgeEntry {
  /** Unique identifier for this knowledge entry */
  id: string;
  
  /** Knowledge title */
  title: string;
  
  /** Knowledge content */
  content: string;
  
  /** Knowledge source */
  source: string;
  
  /** Knowledge category */
  category?: string;
  
  /** Knowledge tags */
  tags?: string[];
  
  /** Knowledge confidence score (0-1) */
  confidence?: number;
  
  /** When this knowledge was added or updated */
  timestamp: Date;
  
  /** Whether this knowledge has been verified */
  verified?: boolean;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Knowledge search options
 */
export interface KnowledgeSearchOptions {
  /** Maximum number of results to return */
  limit?: number;
  
  /** Minimum relevance threshold */
  threshold?: number;
  
  /** Filter by category */
  category?: string;
  
  /** Filter by tags */
  tags?: string[];
  
  /** Whether to include metadata in results */
  includeMetadata?: boolean;
  
  /** Whether to include match information in results */
  includeMatches?: boolean;
}

/**
 * Knowledge search result
 */
export interface KnowledgeSearchResult {
  /** The knowledge entry */
  entry: KnowledgeEntry;
  
  /** Relevance score (0-1) */
  relevance: number;
  
  /** Match information (if requested) */
  matches?: Array<{
    /** Matched text snippet */
    text: string;
    
    /** Position in the content */
    position: number;
  }>;
}

/**
 * Knowledge gap structure
 */
export interface KnowledgeGap {
  /** Unique identifier for this knowledge gap */
  id: string;
  
  /** Gap description */
  description: string;
  
  /** Gap domain or category */
  domain: string;
  
  /** Impact level (0-1) */
  importance: number;
  
  /** Gap status */
  status: 'identified' | 'being_addressed' | 'filled' | 'ignored';
  
  /** When this gap was identified */
  identifiedAt: Date;
  
  /** Priority for filling this gap (0-1) */
  priority: number;
  
  /** How this gap was discovered */
  source: string;
  
  /** Plan for addressing this gap */
  resolutionPlan?: string;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Knowledge manager interface
 */
export interface KnowledgeManager extends BaseManager {
  /**
   * Load knowledge from configured sources
   * @returns Promise that resolves when loading is complete
   */
  loadKnowledge(): Promise<void>;
  
  /**
   * Search knowledge
   * @param query Search query
   * @param options Search options
   * @returns Promise resolving to search results
   */
  searchKnowledge(query: string, options?: KnowledgeSearchOptions): Promise<KnowledgeSearchResult[]>;
  
  /**
   * Add a knowledge entry
   * @param entry Knowledge entry to add (without ID and timestamp)
   * @returns Promise resolving to the added entry
   */
  addKnowledgeEntry(entry: Omit<KnowledgeEntry, 'id' | 'timestamp'>): Promise<KnowledgeEntry>;
  
  /**
   * Get a knowledge entry by ID
   * @param id Knowledge entry ID
   * @returns Promise resolving to the entry or null if not found
   */
  getKnowledgeEntry(id: string): Promise<KnowledgeEntry | null>;
  
  /**
   * Update a knowledge entry
   * @param id Knowledge entry ID
   * @param updates Updates to apply
   * @returns Promise resolving to the updated entry
   */
  updateKnowledgeEntry(id: string, updates: Partial<KnowledgeEntry>): Promise<KnowledgeEntry>;
  
  /**
   * Delete a knowledge entry
   * @param id Knowledge entry ID
   * @returns Promise resolving to true if deleted, false if not found
   */
  deleteKnowledgeEntry(id: string): Promise<boolean>;
  
  /**
   * Get knowledge entries with optional filtering
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
   * Get a knowledge gap by ID
   * @param id Knowledge gap ID
   * @returns Promise resolving to the gap or null if not found
   */
  getKnowledgeGap(id: string): Promise<KnowledgeGap | null>;
} 