/**
 * MarketSource.interface.ts - Interfaces for different market source types
 * 
 * This file defines interfaces for the different types of market sources
 * that can be used to gather market signals.
 */

import { MarketSource } from '../MarketScanner.interface';

/**
 * Interface for RSS feed sources
 */
export interface RssSource extends MarketSource {
  type: 'rss';
  itemLimit?: number; // Maximum items to process from feed
  parseFullContent?: boolean; // Whether to parse full content or just summary
}

/**
 * Interface for Reddit sources
 */
export interface RedditSource extends MarketSource {
  type: 'reddit';
  sort?: 'hot' | 'new' | 'top' | 'rising';
  timeFrame?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
  itemLimit?: number;
  includeComments?: boolean;
}

/**
 * Interface for Twitter/X sources
 */
export interface TwitterSource extends MarketSource {
  type: 'twitter';
  queryType?: 'search' | 'user' | 'list' | 'trending';
  includePoll?: boolean;
  includeMedia?: boolean;
  itemLimit?: number;
  minEngagement?: number; // Minimum likes/retweets/etc.
}

/**
 * Interface for source manager
 */
export interface ISourceManager {
  /**
   * Load sources from configuration
   */
  loadSources(): Promise<MarketSource[]>;
  
  /**
   * Add a new source
   * 
   * @param source Source to add
   */
  addSource(source: MarketSource): Promise<void>;
  
  /**
   * Remove a source
   * 
   * @param sourceId ID of source to remove
   */
  removeSource(sourceId: string): Promise<boolean>;
  
  /**
   * Update a source
   * 
   * @param sourceId ID of source to update
   * @param updates Updates to apply
   */
  updateSource(sourceId: string, updates: Partial<MarketSource>): Promise<MarketSource>;
  
  /**
   * Get sources by category
   * 
   * @param category Category to filter by
   */
  getSourcesByCategory(category: string): Promise<MarketSource[]>;
  
  /**
   * Get sources that are due for refresh
   */
  getDueSources(): Promise<MarketSource[]>;
  
  /**
   * Update source timestamp after processing
   * 
   * @param sourceId ID of source to update
   */
  updateSourceTimestamp(sourceId: string): Promise<void>;
} 