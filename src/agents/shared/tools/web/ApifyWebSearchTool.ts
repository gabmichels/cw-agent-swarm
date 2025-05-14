/**
 * ApifyWebSearchTool.ts - Web search tool using Apify Google Search Scraper
 */

import { IdGenerator } from '../../../../utils/ulid';
import { logger } from '../../../../lib/logging';
import { Tool, ToolCategory, ToolExecutionResult } from '../../../../lib/tools/types';
import defaultApifyManager from '../integrations/apify';

// Default and maximum search result limits
const DEFAULT_RESULT_LIMIT = 5;
const STANDARD_LIMIT = 25;
const ABSOLUTE_MAXIMUM = 100;

/**
 * Web search tool using Apify's Google Search Scraper
 */
export class ApifyWebSearchTool implements Tool {
  id = 'web_search';
  name = 'Web Search';
  description = 'Search the web for information using Google Search. Default limit: 5 results (use "limit X" for more results, or "approve X for web search" for large requests)';
  category = ToolCategory.WEB;
  enabled = true;
  
  /**
   * Schema for the web search tool parameters
   */
  schema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query'
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return',
        default: DEFAULT_RESULT_LIMIT
      },
      country: {
        type: 'string',
        description: 'Country code for search (e.g., "US", "GB")',
        default: 'US'
      },
      safeSearch: {
        type: 'boolean',
        description: 'Whether to enable safe search',
        default: true
      }
    },
    required: ['query']
  };
  
  /**
   * Execute the web search
   * 
   * @param args Tool arguments including query and options
   * @returns Search results
   */
  async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Extract the query string and convert to string if needed
      let query = '';
      if (typeof args.query === 'string') {
        query = args.query;
      } else if (args.input && typeof args.input === 'string') {
        query = args.input;
      } else if (args.query) {
        query = String(args.query);
      }
      
      if (!query) {
        return {
          id: IdGenerator.generate('terr'),
          toolId: this.id,
          success: false,
          error: {
            message: 'A search query is required',
            code: 'MISSING_QUERY'
          },
          metrics: {
            startTime,
            endTime: Date.now(),
            durationMs: Date.now() - startTime
          }
        };
      }
      
      // Parse for approval pattern - "approve X for web search [query]"
      const approvalMatch = query.match(/approve\s+(\d+)\s+for\s+web\s+search/i);
      if (approvalMatch) {
        return this.handleApprovalRequest(query, approvalMatch, startTime);
      }
      
      // Check if user explicitly requested a certain number of results
      // in formats like "limit 30" or "top 50"
      const maxItemsMatch = query.match(/(?:limit|top)\s+(\d+)/i);
      let maxResults = typeof args.maxResults === 'number' ? args.maxResults : DEFAULT_RESULT_LIMIT;
      
      if (maxItemsMatch && maxItemsMatch[1]) {
        const requestedLimit = parseInt(maxItemsMatch[1], 10);
        
        if (requestedLimit > STANDARD_LIMIT) {
          return {
            id: IdGenerator.generate('terr'),
            toolId: this.id,
            success: false,
            error: {
              message: `I need your permission to fetch ${requestedLimit} search results, which exceeds our default limit of ${STANDARD_LIMIT} to prevent excessive API usage. This may incur higher costs.\n\nTo approve, please reply with: "approve ${requestedLimit} for web search" followed by your query.`,
              code: 'LIMIT_EXCEEDED'
            },
            metrics: {
              startTime,
              endTime: Date.now(),
              durationMs: Date.now() - startTime
            }
          };
        }
        
        maxResults = Math.min(requestedLimit, STANDARD_LIMIT);
      }
      
      // Clean the query by removing meta-commands like limit or top
      const cleanQuery = query.replace(/\b(?:limit|top)\s+\d+\b/gi, '').trim();
      
      // Execute the search with safe limits
      return await this.executeSearch(cleanQuery, maxResults, args, startTime);
    } catch (error) {
      logger.error('Error in web search:', error);
      return {
        id: IdGenerator.generate('terr'),
        toolId: this.id,
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
   * Handle an approval request for exceeding default result limits
   * 
   * @param query The original query string
   * @param approvalMatch The regex match for the approval
   * @param startTime Execution start time
   * @returns Search results with approved higher limits
   * @private
   */
  private async handleApprovalRequest(
    query: string, 
    approvalMatch: RegExpMatchArray, 
    startTime: number
  ): Promise<ToolExecutionResult> {
    try {
      const approvedLimit = parseInt(approvalMatch[1], 10);
      
      // Extract search query with regex - everything after "for web search" 
      const queryMatches = query.match(/for\s+web\s+search\s+(.+)/i) || 
                          query.match(/approve\s+\d+\s+for\s+web\s+search\s+(.+)/i);
      const searchQuery = queryMatches ? queryMatches[1].trim() : "";
      
      if (!searchQuery) {
        return {
          id: IdGenerator.generate('terr'),
          toolId: this.id,
          success: false,
          error: {
            message: "Please include your search query along with your approval.",
            code: 'MISSING_QUERY_IN_APPROVAL'
          },
          metrics: {
            startTime,
            endTime: Date.now(),
            durationMs: Date.now() - startTime
          }
        };
      }
      
      // Apply higher limits with approval - ensuring it doesn't exceed absolute maximum
      const grantedLimit = Math.min(approvedLimit, ABSOLUTE_MAXIMUM);
      
      logger.info(`Running Google search with approved limit: ${grantedLimit}`);
      
      // Execute search with approved limit
      return await this.executeSearch(searchQuery, grantedLimit, { 
        country: 'US', 
        safeSearch: true 
      }, startTime, true);
    } catch (error) {
      logger.error('Error processing approval request:', error);
      return {
        id: IdGenerator.generate('terr'),
        toolId: this.id,
        success: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'APPROVAL_ERROR',
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
   * Execute the actual search with Apify
   * 
   * @param query The search query
   * @param maxResults Maximum number of results to return
   * @param args Other search parameters
   * @param startTime Execution start time
   * @param isApproved Whether this is an approved high-limit search
   * @returns Search results
   * @private
   */
  private async executeSearch(
    query: string, 
    maxResults: number, 
    args: Record<string, unknown>, 
    startTime: number,
    isApproved = false
  ): Promise<ToolExecutionResult> {
    try {
      const country = typeof args.country === 'string' ? args.country : 'US';
      const safeSearch = args.safeSearch !== false;
      
      logger.info(`Executing web search for: "${query}" with limit: ${maxResults}`);
      
      // Use Apify Google Search Scraper
      const result = await defaultApifyManager.runApifyActor({
        actorId: 'apify/google-search-scraper',
        input: {
          queries: [query],
          maxPagesPerQuery: 1,
          resultsPerPage: maxResults,
          countryCode: country,
          saveHtml: false,
          mobileResults: false,
          includeUnfilteredResults: !safeSearch
        },
        label: `Google search: ${query}`,
        dryRun: false
      });
      
      if (!result.success || !result.output) {
        logger.error('Google search failed:', result.error);
        return {
          id: IdGenerator.generate('terr'),
          toolId: this.id,
          success: false,
          error: {
            message: result.error || 'Search failed with no specific error',
            code: 'SEARCH_FAILED'
          },
          metrics: {
            startTime,
            endTime: Date.now(),
            durationMs: Date.now() - startTime
          }
        };
      }
      
      // Format the results
      const formattedResults = this.formatSearchResults(result.output, query, isApproved, maxResults);
      
      return {
        id: IdGenerator.generate('trun'),
        toolId: this.id,
        success: true,
        data: formattedResults,
        metrics: {
          startTime,
          endTime: Date.now(),
          durationMs: Date.now() - startTime
        }
      };
    } catch (error) {
      logger.error('Error in web search execution:', error);
      return {
        id: IdGenerator.generate('terr'),
        toolId: this.id,
        success: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'SEARCH_EXECUTION_ERROR',
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
   * Format the search results into a cleaner structure
   * 
   * @param rawResults Raw output from Apify
   * @param query Original search query
   * @param isApproved Whether this is an approved high-limit search
   * @param limit Result limit that was used
   * @returns Formatted search results
   * @private
   */
  private formatSearchResults(
    rawResults: any, 
    query: string, 
    isApproved = false,
    limit = DEFAULT_RESULT_LIMIT
  ): any {
    try {
      if (!Array.isArray(rawResults) || rawResults.length === 0) {
        return { results: [], query };
      }
      
      // The response structure has search results within each query result
      const searchData = rawResults[0];
      const organicResults = searchData.organicResults || [];
      
      const results = organicResults.map((item: any, index: number) => ({
        title: item.title || 'No title',
        url: item.url || '',
        snippet: item.description || '',
        position: index + 1,
        domain: this.extractDomain(item.url || '')
      }));
      
      return {
        query,
        results,
        totalResults: results.length,
        searchTime: searchData.searchTimeTaken,
        ...(isApproved && { approvedLimit: limit })
      };
    } catch (error) {
      logger.error('Error formatting search results:', error);
      return { 
        results: [], 
        query,
        error: 'Failed to format search results'
      };
    }
  }
  
  /**
   * Extract domain from URL
   * 
   * @param url URL to extract domain from
   * @returns Domain name
   * @private
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }
} 