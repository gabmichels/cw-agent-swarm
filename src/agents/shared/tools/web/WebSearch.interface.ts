/**
 * WebSearch.interface.ts - Interface definitions for web search capabilities
 */

import { ToolExecutionResult } from '../../../../lib/tools/types';

/**
 * Web search options to configure search behavior
 */
export interface WebSearchOptions {
  /** Maximum number of results to return */
  maxResults?: number;
  
  /** Specific sources to include in search */
  sources?: string[];
  
  /** Whether to skip actual API calls for testing */
  dryRun?: boolean;
  
  /** Result filtering options */
  filters?: {
    /** Minimum date constraint (ISO string) */
    fromDate?: string;
    
    /** Maximum date constraint (ISO string) */
    toDate?: string;
    
    /** Specific domains to include (e.g., '.edu', '.gov') */
    domains?: string[];
    
    /** Safe search setting */
    safeSearch?: 'off' | 'moderate' | 'strict';
    
    /** Content type filters */
    contentType?: ('news' | 'images' | 'videos' | 'blogs')[];
  };
}

/**
 * Search result format for standardized results
 */
export interface WebSearchResult {
  /** Unique identifier for the result */
  id: string;
  
  /** Title of the search result */
  title: string;
  
  /** URL of the search result */
  url: string;
  
  /** Brief description/snippet from the content */
  snippet: string;
  
  /** Source of the result (e.g., 'web', 'news', 'youtube') */
  source: string;
  
  /** Publication or last updated date (ISO string) */
  date?: string;
  
  /** Author or publisher of the content */
  author?: string;
  
  /** Any additional metadata specific to the result */
  metadata?: Record<string, any>;
}

/**
 * Interface that defines the capabilities of a web search provider
 */
export interface IWebSearchProvider {
  /**
   * Provider name (e.g., 'google', 'bing', 'brave')
   */
  readonly name: string;
  
  /**
   * Search the web with the given query
   * 
   * @param query - The search query
   * @param options - Search configuration options
   * @returns A standardized tool execution result with array of search results as data
   */
  search(query: string, options?: WebSearchOptions): Promise<ToolExecutionResult>;
  
  /**
   * Check if this provider is available (has valid API keys, etc.)
   * 
   * @returns Whether the provider is available
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Interface for the web search service that manages multiple providers
 */
export interface IWebSearchService {
  /**
   * Add a search provider to the available providers
   * 
   * @param provider - The search provider to add
   */
  addProvider(provider: IWebSearchProvider): void;
  
  /**
   * Get available search providers
   * 
   * @returns Array of available search providers
   */
  getProviders(): IWebSearchProvider[];
  
  /**
   * Search across multiple providers and merge results
   * 
   * @param query - The search query
   * @param options - Search configuration options
   * @returns A standardized tool execution result with array of search results as data
   */
  search(query: string, options?: WebSearchOptions & { providers?: string[] }): Promise<ToolExecutionResult>;
  
  /**
   * Search using a specific provider
   * 
   * @param providerName - Name of the provider to use
   * @param query - The search query
   * @param options - Search configuration options
   * @returns A standardized tool execution result with array of search results as data
   */
  searchWithProvider(providerName: string, query: string, options?: WebSearchOptions): Promise<ToolExecutionResult>;
} 