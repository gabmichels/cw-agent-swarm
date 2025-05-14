/**
 * DefaultWebSearchService.ts - Implementation of web search service 
 */

import { IdGenerator } from '../../../../utils/ulid';
import { logger } from '../../../../lib/logging';
import { ToolExecutionResult } from '../../../../lib/tools/types';
import { IWebSearchProvider, IWebSearchService, WebSearchOptions, WebSearchResult } from './WebSearch.interface';

/**
 * Implementation of the web search service that manages multiple providers
 */
export class DefaultWebSearchService implements IWebSearchService {
  private providers: Map<string, IWebSearchProvider> = new Map();
  private defaultProvider: string | null = null;

  /**
   * Create a new web search service
   * 
   * @param initialProviders - Optional array of providers to add on initialization
   * @param defaultProviderName - Optional name of the default provider
   */
  constructor(initialProviders: IWebSearchProvider[] = [], defaultProviderName?: string) {
    // Add initial providers
    initialProviders.forEach(provider => {
      this.addProvider(provider);
    });

    // Set default provider if specified and available
    if (defaultProviderName && this.providers.has(defaultProviderName)) {
      this.defaultProvider = defaultProviderName;
    } else if (initialProviders.length > 0) {
      // Use first provider as default if none specified
      this.defaultProvider = initialProviders[0].name;
    }
  }

  /**
   * Add a search provider to the available providers
   * 
   * @param provider - The search provider to add
   */
  addProvider(provider: IWebSearchProvider): void {
    this.providers.set(provider.name, provider);
    
    // Set as default if no default exists
    if (this.defaultProvider === null) {
      this.defaultProvider = provider.name;
    }
    
    logger.info(`Added web search provider: ${provider.name}`);
  }

  /**
   * Get available search providers
   * 
   * @returns Array of available search providers
   */
  getProviders(): IWebSearchProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Search across multiple providers and merge results
   * 
   * @param query - The search query
   * @param options - Search configuration options
   * @returns A standardized tool execution result
   */
  async search(query: string, options?: WebSearchOptions & { providers?: string[] }): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Determine which providers to use
      let providerNames: string[] = [];
      
      if (options?.providers && options.providers.length > 0) {
        // Use specified providers
        providerNames = options.providers.filter(name => this.providers.has(name));
      } else if (this.defaultProvider) {
        // Use default provider
        providerNames = [this.defaultProvider];
      }
      
      // Validate we have providers to search with
      if (providerNames.length === 0) {
        return {
          id: IdGenerator.generate('terr'),
          toolId: 'web_search',
          success: false,
          error: {
            message: 'No valid search providers available',
            code: 'NO_PROVIDERS',
          },
          metrics: {
            startTime,
            endTime: Date.now(),
            durationMs: Date.now() - startTime
          }
        };
      }
      
      // Search with all selected providers in parallel
      const searchPromises = providerNames.map(name => 
        this.searchWithProvider(name, query, options)
      );
      
      const results = await Promise.all(searchPromises);
      
      // Aggregate successful results
      const allResults: WebSearchResult[] = [];
      let successCount = 0;
      let errors: string[] = [];
      
      for (const result of results) {
        if (result.success && result.data) {
          const searchResults = result.data as WebSearchResult[];
          allResults.push(...searchResults);
          successCount++;
        } else if (result.error) {
          errors.push(`${result.toolId}: ${result.error.message}`);
        }
      }
      
      // Sort by order in the results (assuming providers return most relevant first)
      // If we wanted to be more sophisticated, we could implement a ranking algorithm here
      const deduplicated = this.deduplicateResults(allResults);
      
      // Limit results
      const maxResults = options?.maxResults || 10;
      const limitedResults = deduplicated.slice(0, maxResults);
      
      // Return successful result
      return {
        id: IdGenerator.generate('trun'),
        toolId: 'web_search',
        success: successCount > 0,
        data: limitedResults,
        ...(errors.length > 0 && {
          error: {
            message: `Some providers failed: ${errors.join(', ')}`,
            code: 'PARTIAL_FAILURE',
            details: errors
          }
        }),
        metrics: {
          startTime,
          endTime: Date.now(),
          durationMs: Date.now() - startTime
        }
      };
    } catch (error) {
      logger.error('Error in web search:', error);
      return {
        id: IdGenerator.generate('terr'),
        toolId: 'web_search',
        success: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'SEARCH_ERROR',
          details: error
        },
        metrics: {
          startTime,
          endTime: Date.now(),
          durationMs: Date.now() - startTime
        }
      };
    }
  }
  
  /**
   * Search using a specific provider
   * 
   * @param providerName - Name of the provider to use
   * @param query - The search query
   * @param options - Search configuration options
   * @returns A standardized tool execution result
   */
  async searchWithProvider(providerName: string, query: string, options?: WebSearchOptions): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    
    try {
      const provider = this.providers.get(providerName);
      
      if (!provider) {
        return {
          id: IdGenerator.generate('terr'),
          toolId: `web_search_${providerName}`,
          success: false,
          error: {
            message: `Provider "${providerName}" not found`,
            code: 'PROVIDER_NOT_FOUND',
          },
          metrics: {
            startTime,
            endTime: Date.now(),
            durationMs: Date.now() - startTime
          }
        };
      }
      
      // Check if provider is available
      const isAvailable = await provider.isAvailable();
      
      if (!isAvailable) {
        return {
          id: IdGenerator.generate('terr'),
          toolId: `web_search_${providerName}`,
          success: false,
          error: {
            message: `Provider "${providerName}" is not available (missing API keys or configuration)`,
            code: 'PROVIDER_UNAVAILABLE',
          },
          metrics: {
            startTime,
            endTime: Date.now(),
            durationMs: Date.now() - startTime
          }
        };
      }
      
      // Execute search with the provider
      return await provider.search(query, options);
    } catch (error) {
      logger.error(`Error in ${providerName} search:`, error);
      return {
        id: IdGenerator.generate('terr'),
        toolId: `web_search_${providerName}`,
        success: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'PROVIDER_ERROR',
          details: error
        },
        metrics: {
          startTime,
          endTime: Date.now(),
          durationMs: Date.now() - startTime
        }
      };
    }
  }
  
  /**
   * Helper method to deduplicate search results based on URL
   * 
   * @param results - Array of search results to deduplicate
   * @returns Deduplicated array of search results
   * @private
   */
  private deduplicateResults(results: WebSearchResult[]): WebSearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      // Use URL as the key for deduplication
      const key = result.url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  
  /**
   * Set the default provider
   * 
   * @param providerName - Name of provider to set as default
   * @returns Whether the provider was successfully set as default
   */
  setDefaultProvider(providerName: string): boolean {
    if (this.providers.has(providerName)) {
      this.defaultProvider = providerName;
      return true;
    }
    return false;
  }
} 