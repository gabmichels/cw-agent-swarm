import { useState, useEffect, useCallback } from 'react';
import { MemoryType, MemoryErrorCode } from '../server/memory/config';
import { BaseMemorySchema } from '../server/memory/models';

interface UseMemoryOptions {
  /**
   * Whether to include the embedding vector
   */
  includeVector?: boolean;
  
  /**
   * Whether to load version history automatically
   */
  loadHistory?: boolean;
  
  /**
   * Number of history items to retrieve
   */
  historyLimit?: number;
  
  /**
   * Whether to automatically load memories on initialization
   * @default false - Set to false to prevent automatic loading
   */
  autoLoad?: boolean;
}

/**
 * Types for the hook params and returns
 */
export interface MemorySearchParams {
  query: string;
  types?: MemoryType[];
  tags?: string[];
  limit?: number;
  offset?: number;
  hybridRatio?: number; // For hybrid search (0-1): 0 = text only, 1 = vector only
}

export interface MemoryHookState {
  memories: Array<Record<string, unknown>>;
  isLoading: boolean;
  error: Error | null;
  totalCount: number;
}

// Define types for the filter structure
interface FilterCondition {
  key: string;
  match?: {
    value?: unknown;
    in?: unknown[];
  };
  range?: {
    gte?: unknown;
    lte?: unknown;
  };
}

interface MemoryFilter {
  must?: FilterCondition[];
  should?: FilterCondition[];
  must_not?: FilterCondition[];
}

export interface GetMemoriesParams {
  types?: MemoryType[];
  limit?: number;
  offset?: number;
  agentId?: string;
}

/**
 * React hook for accessing the standardized memory system
 * Provides functions for CRUD operations on memories
 * @param initialTypes Optional array of memory types to load on initialization
 * @param options Hook configuration options
 */
export default function useMemory(
  initialTypes?: MemoryType[], 
  options: UseMemoryOptions = { autoLoad: false }
) {
  const [state, setState] = useState<MemoryHookState>({
    memories: [],
    isLoading: false,
    error: null,
    totalCount: 0
  });

  /**
   * Get memories with optional type filtering and agent scoping
   */
  const getMemories = useCallback(async (params: GetMemoriesParams = {}) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Build query parameters
      const queryParams = new URLSearchParams();
      
      if (params.types?.[0]) {
        queryParams.append('type', params.types[0]);
      }
      
      if (params.limit) {
        queryParams.append('limit', params.limit.toString());
      }
      
      if (params.offset) {
        queryParams.append('offset', params.offset.toString());
      }

      if (params.agentId) {
        queryParams.append('agentId', params.agentId);
      }
      
      console.log(`Fetching memories from API with params: ${queryParams.toString()}`);
      
      // Make API request using the App Router implementation
      const response = await fetch(`/api/memory?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch memories: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      setState(prev => ({
        ...prev,
        memories: data.memories || [],
        totalCount: data.total || 0,
        isLoading: false
      }));
      
      return data.memories;
    } catch (error) {
      console.error('Error fetching memories:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error : new Error(String(error)),
        isLoading: false
      }));
      return [];
    }
  }, []);

  /**
   * Get memories for a specific agent
   */
  const getAgentMemories = useCallback(async (agentId: string, params: Omit<GetMemoriesParams, 'agentId'> = {}) => {
    return getMemories({ ...params, agentId });
  }, [getMemories]);

  /**
   * Search memories using the hybrid search API
   */
  const searchMemories = useCallback(async (
    params: MemorySearchParams
  ) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Prepare filter object
      const filter: MemoryFilter = {};
      
      if (params.types && params.types.length > 0) {
        if (!filter.must) filter.must = [];
        filter.must.push({
          key: 'type',
          match: {
            in: params.types
          }
        });
      }
      
      if (params.tags && params.tags.length > 0) {
        if (!filter.must) filter.must = [];
        filter.must.push({
          key: 'metadata.tags',
          match: {
            in: params.tags
          }
        });
      }
      
      // Prepare request body
      const body: {
        query: string;
        limit: number;
        filter?: MemoryFilter;
        hybridRatio?: number;
      } = {
        query: params.query,
        limit: params.limit || 10,
        filter: Object.keys(filter).length > 0 ? filter : undefined
      };
      
      // Add hybridRatio if specified
      if (params.hybridRatio !== undefined) {
        body.hybridRatio = params.hybridRatio;
      }
      
      // Make API request to hybrid search endpoint - Updated for App Router route
      const response = await fetch('/api/memory/hybrid-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Extract memory points from search results
      const searchResults = data.results || [];
      const memories = searchResults.map((result: { point: Record<string, unknown>; score: number }) => ({
        ...result.point,
        score: result.score,
      }));
      
      setState(prev => ({
        ...prev,
        memories,
        totalCount: memories.length,
        isLoading: false
      }));
      
      return memories;
    } catch (error) {
      console.error('Error searching memories:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error : new Error(String(error)),
        isLoading: false
      }));
      return [];
    }
  }, []);

  /**
   * Get a single memory by ID
   */
  const getMemory = useCallback(async (id: string) => {
    try {
      // Updated API route for App Router
      const response = await fetch(`/api/memory/${id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch memory: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error fetching memory ${id}:`, error);
      throw error;
    }
  }, []);

  /**
   * Add a new memory
   */
  const addMemory = useCallback(async (
    params: {
      type: MemoryType;
      content: string;
      metadata?: Record<string, unknown>;
    }
  ) => {
    try {
      // API route remains the same as we're using the base route
      const response = await fetch('/api/memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to add memory: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error adding memory:', error);
      throw error;
    }
  }, []);

  /**
   * Update an existing memory
   */
  const updateMemory = useCallback(async (
    params: {
      id: string;
      type: MemoryType;
      content?: string;
      metadata?: Record<string, unknown>;
    }
  ) => {
    try {
      const { id, ...updateData } = params;
      
      const response = await fetch(`/api/memory/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update memory: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error updating memory ${params.id}:`, error);
      throw error;
    }
  }, []);

  /**
   * Delete a memory
   */
  const deleteMemory = useCallback(async (
    params: {
      id: string;
      type: MemoryType;
    }
  ) => {
    try {
      const { id, type } = params;
      
      const response = await fetch(`/api/memory/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete memory: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error deleting memory ${params.id}:`, error);
      throw error;
    }
  }, []);

  /**
   * Get memory history/versions
   */
  const getMemoryHistory = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/memory/history/${id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch memory history: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.history || [];
    } catch (error) {
      console.error(`Error fetching memory history for ${id}:`, error);
      throw error;
    }
  }, []);

  // Load initial memories if types are provided and autoLoad is enabled
  useEffect(() => {
    if (initialTypes && initialTypes.length > 0 && options.autoLoad) {
      getMemories({ types: initialTypes });
    }
  }, [initialTypes, getMemories, options.autoLoad]);

  return {
    ...state,
    getMemories,
    getAgentMemories,
    searchMemories,
    getMemory,
    addMemory,
    updateMemory,
    deleteMemory,
    getMemoryHistory,
    refresh: () => getMemories({ types: initialTypes })
  };
} 