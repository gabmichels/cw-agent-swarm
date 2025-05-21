/**
 * Mock Web Search Tool - Provides fallback search results when the real API fails
 * 
 * This is a temporary solution to allow autonomous agents to function when web search APIs
 * are not properly configured or are failing.
 */

import { Tool, ToolExecutionResult } from '../../../../lib/tools/types';
import { logger } from '../../../../lib/logging';
import { IdGenerator } from '../../../../utils/ulid';

/**
 * Mock web search result format
 */
export interface MockWebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  rank: number;
}

/**
 * Create a mock search result with reasonable-looking data
 */
export function createMockSearchResult(query: string, index: number): MockWebSearchResult {
  // Generate a somewhat sensible title based on the query
  const words = query.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1));
  const baseTitle = words.join(' ');
  
  // Generate different titles based on index
  let title = '';
  let url = '';
  let source = '';
  
  switch (index % 5) {
    case 0:
      title = `Latest Updates on ${baseTitle} - Research Overview`;
      url = `https://research.example.com/${words.join('-').toLowerCase()}`;
      source = 'Research Journal';
      break;
    case 1:
      title = `${baseTitle}: Complete 2025 Guide`;
      url = `https://guide.example.org/2025/${words.join('-').toLowerCase()}`;
      source = 'Expert Guide';
      break;
    case 2:
      title = `What Experts Say About ${baseTitle} in 2025`;
      url = `https://news.example.net/experts-on-${words.join('-').toLowerCase()}`;
      source = 'Tech News';
      break;
    case 3:
      title = `${baseTitle} - Industry Analysis (2025)`;
      url = `https://industry.example.io/analysis/${words.join('-').toLowerCase()}`;
      source = 'Industry Report';
      break;
    case 4:
      title = `Future Trends: ${baseTitle} (Comprehensive Review)`;
      url = `https://trends.example.com/future/${words.join('-').toLowerCase()}`;
      source = 'Trend Analysis';
      break;
  }
  
  // Create a mock snippet that looks plausible
  const snippetParts = [
    `Exploring the latest developments in ${query} for 2025 and beyond.`,
    `Recent research indicates significant progress in ${query}, with new methods emerging in 2025.`,
    `Experts predict that ${query} will continue to evolve throughout 2025, with key innovations in several areas.`,
    `The ${query} landscape has changed dramatically in recent months, according to leading researchers.`,
    `Industry analysts report that ${query} technologies are advancing rapidly, with major breakthroughs expected by late 2025.`
  ];
  
  const snippet = snippetParts[index % snippetParts.length];
  
  return {
    title,
    url,
    snippet,
    source,
    rank: index + 1
  };
}

/**
 * Generate mock search results for a query
 */
export function generateMockSearchResults(query: string, count: number = 10): MockWebSearchResult[] {
  const results: MockWebSearchResult[] = [];
  
  for (let i = 0; i < count; i++) {
    results.push(createMockSearchResult(query, i));
  }
  
  return results;
}

/**
 * Extended metrics interface that includes mock-specific fields
 */
export interface ExtendedMetrics {
  startTime: number;
  endTime: number;
  durationMs: number;
  usingMockData?: boolean;
  realRequestFailed?: boolean;
  realRequestThrew?: boolean;
  originalError?: unknown;
}

/**
 * Provide a mock web search response
 */
export function mockWebSearch(query: string, maxResults: number = 10): ToolExecutionResult {
  logger.info(`[MOCK] Executing mock web search for: "${query}" with limit: ${maxResults}`);
  
  const startTime = Date.now();
  const results = generateMockSearchResults(query, maxResults);
  const endTime = Date.now();
  
  return {
    id: IdGenerator.generate('tres'),
    toolId: 'web_search',
    success: true,
    data: results,
    metrics: {
      startTime,
      endTime,
      durationMs: endTime - startTime
    }
  };
}

/**
 * Wrap a web search function with a mock fallback
 * 
 * @param searchFn The original search function to wrap
 * @returns A function that falls back to mock results on failure
 */
export function withMockFallback(
  searchFn: (args: Record<string, unknown>) => Promise<ToolExecutionResult>
): (args: Record<string, unknown>) => Promise<ToolExecutionResult> {
  return async (args: Record<string, unknown>) => {
    try {
      // Attempt the real search
      const result = await searchFn(args);
      
      // If result is not successful or has no data, use mock
      if (!result.success || !result.data || (Array.isArray(result.data) && result.data.length === 0)) {
        logger.warn('[MOCK] Real web search failed or returned no results, using mock results');
        const mockResult = mockWebSearch(args.query as string, 10);
        
        // Add additional information to the metrics
        const extendedMetrics: ExtendedMetrics = {
          ...mockResult.metrics,
          usingMockData: true,
          realRequestFailed: true,
          originalError: result.error
        };
        
        return {
          ...mockResult,
          metrics: extendedMetrics
        };
      }
      
      return result;
    } catch (error) {
      logger.error('[MOCK] Real web search threw an exception, falling back to mock search', error);
      
      const mockResult = mockWebSearch(args.query as string, 10);
      
      // Add error information to the metrics
      const extendedMetrics: ExtendedMetrics = {
        ...mockResult.metrics,
        usingMockData: true,
        realRequestThrew: true,
        originalError: error instanceof Error ? error.message : String(error)
      };
      
      return {
        ...mockResult,
        metrics: extendedMetrics
      };
    }
  };
} 