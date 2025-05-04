import { useState, useCallback } from 'react';
import { MemoryType } from '../server/memory/config';
import { BaseMemorySchema } from '../server/memory/models';

interface DateRange {
  start?: string;
  end?: string;
}

interface FilterOptions {
  types?: MemoryType[];
  dateRange?: DateRange;
  metadata?: Record<string, any>;
  textContains?: string;
}

interface SearchOptions {
  query?: string;
  filter?: any;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

interface HybridSearchOptions extends SearchOptions {
  hybridRatio?: number; // 0.0 to 1.0, where 1.0 is 100% vector search
}

/**
 * Hook for searching and filtering memories
 */
export function useMemorySearch<T extends BaseMemorySchema = BaseMemorySchema>() {
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [searchInfo, setSearchInfo] = useState<any>(null);
  
  /**
   * Build a filter for search queries
   */
  const buildFilter = useCallback((options: FilterOptions) => {
    const filter: any = {};
    
    // Add memory types to filter
    if (options.types && options.types.length > 0) {
      filter.types = options.types;
    }
    
    // Add date range to filter
    if (options.dateRange) {
      filter.dateRange = options.dateRange;
    }
    
    // Add metadata to filter
    if (options.metadata) {
      filter.metadata = options.metadata;
    }
    
    // Add text contains filter
    if (options.textContains) {
      filter.textContains = options.textContains;
    }
    
    return filter;
  }, []);
  
  /**
   * Search for memories using vector search
   */
  const search = useCallback(async (options: SearchOptions) => {
    setLoading(true);
    setError(null);
    
    try {
      // Build query parameters
      const params = new URLSearchParams();
      
      if (options.query) {
        params.append('query', options.query);
      }
      
      if (options.limit) {
        params.append('limit', options.limit.toString());
      }
      
      if (options.offset) {
        params.append('offset', options.offset.toString());
      }
      
      if (options.sortBy) {
        params.append('sortBy', options.sortBy);
        params.append('sortDirection', options.sortDirection || 'desc');
      }
      
      // Send request
      const response = await fetch(`/api/memory/search?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: options.filter ? JSON.stringify({ filter: options.filter }) : undefined
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to search memories');
      }
      
      const data = await response.json();
      setResults(data.results);
      setTotal(data.total);
      setSearchInfo(data.searchInfo);
    } catch (err) {
      console.error('Error searching memories:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setResults([]);
      setTotal(0);
      setSearchInfo(null);
    } finally {
      setLoading(false);
    }
  }, []);
  
  /**
   * Search for memories using hybrid search (vector + keyword)
   */
  const hybridSearch = useCallback(async (options: HybridSearchOptions) => {
    setLoading(true);
    setError(null);
    
    try {
      // Build query parameters
      const params = new URLSearchParams();
      
      if (options.query) {
        params.append('query', options.query);
      }
      
      if (options.limit) {
        params.append('limit', options.limit.toString());
      }
      
      if (options.offset) {
        params.append('offset', options.offset.toString());
      }
      
      if (options.hybridRatio !== undefined) {
        params.append('hybridRatio', options.hybridRatio.toString());
      }
      
      if (options.sortBy) {
        params.append('sortBy', options.sortBy);
        params.append('sortDirection', options.sortDirection || 'desc');
      }
      
      // Send request
      const response = await fetch(`/api/memory/hybrid-search?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: options.filter ? JSON.stringify({ filter: options.filter }) : undefined
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to perform hybrid search');
      }
      
      const data = await response.json();
      setResults(data.results);
      setTotal(data.total);
      setSearchInfo(data.searchInfo);
    } catch (err) {
      console.error('Error performing hybrid search:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setResults([]);
      setTotal(0);
      setSearchInfo(null);
    } finally {
      setLoading(false);
    }
  }, []);
  
  /**
   * Clear search results
   */
  const clearSearch = useCallback(() => {
    setResults([]);
    setTotal(0);
    setSearchInfo(null);
    setError(null);
  }, []);
  
  return {
    results,
    loading,
    error,
    total,
    searchInfo,
    search,
    hybridSearch,
    buildFilter,
    clearSearch
  };
}

export default useMemorySearch; 