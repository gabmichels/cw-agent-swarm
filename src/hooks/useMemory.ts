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
}

/**
 * Hook for managing a single memory item
 * 
 * @param memoryId ID of the memory to fetch and manage
 * @param options Hook options
 */
export function useMemory<T extends BaseMemorySchema = BaseMemorySchema>(
  memoryId: string | null,
  options: UseMemoryOptions = {}
) {
  const [memory, setMemory] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [history, setHistory] = useState<T[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<Error | null>(null);
  
  const { 
    includeVector = false,
    loadHistory = false,
    historyLimit = 10
  } = options;
  
  // Fetch memory function
  const fetchMemory = useCallback(async () => {
    if (!memoryId) {
      setMemory(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/memory/${memoryId}?includeVector=${includeVector}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch memory');
      }
      
      const data = await response.json();
      setMemory(data.memory);
    } catch (err) {
      console.error('Error fetching memory:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setMemory(null);
    } finally {
      setLoading(false);
    }
  }, [memoryId, includeVector]);
  
  // Fetch history function
  const fetchHistory = useCallback(async () => {
    if (!memoryId) {
      setHistory([]);
      return;
    }
    
    setHistoryLoading(true);
    setHistoryError(null);
    
    try {
      const response = await fetch(`/api/memory/history/${memoryId}?limit=${historyLimit}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch memory history');
      }
      
      const data = await response.json();
      setHistory(data.history);
    } catch (err) {
      console.error('Error fetching memory history:', err);
      setHistoryError(err instanceof Error ? err : new Error(String(err)));
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [memoryId, historyLimit]);
  
  // Update memory function
  const updateMemory = useCallback(async (updates: Partial<T>) => {
    if (!memoryId) {
      return null;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/memory/${memoryId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update memory');
      }
      
      const data = await response.json();
      setMemory(data.memory);
      
      // Refresh history if it was loaded and we've made a change
      if (loadHistory) {
        fetchHistory();
      }
      
      return data.memory;
    } catch (err) {
      console.error('Error updating memory:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    } finally {
      setLoading(false);
    }
  }, [memoryId, fetchHistory, loadHistory]);
  
  // Delete memory function
  const deleteMemory = useCallback(async (options: { soft?: boolean } = {}) => {
    if (!memoryId) {
      return false;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const { soft = false } = options;
      const response = await fetch(`/api/memory/${memoryId}?soft=${soft}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete memory');
      }
      
      setMemory(null);
      setHistory([]);
      return true;
    } catch (err) {
      console.error('Error deleting memory:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally {
      setLoading(false);
    }
  }, [memoryId]);
  
  // Flag memory importance
  const flagImportance = useCallback(async (importance: string) => {
    return updateMemory({ 
      metadata: { 
        ...memory?.metadata, 
        importance 
      }
    } as Partial<T>);
  }, [memory, updateMemory]);
  
  // Add tag to memory
  const addTag = useCallback(async (tag: string) => {
    const currentTags = memory?.metadata?.tags || [];
    
    // Don't add duplicate tags
    if (currentTags.includes(tag)) {
      return memory;
    }
    
    return updateMemory({
      metadata: {
        ...memory?.metadata,
        tags: [...currentTags, tag]
      }
    } as Partial<T>);
  }, [memory, updateMemory]);
  
  // Remove tag from memory
  const removeTag = useCallback(async (tag: string) => {
    const currentTags = memory?.metadata?.tags || [];
    
    return updateMemory({
      metadata: {
        ...memory?.metadata,
        tags: currentTags.filter(t => t !== tag)
      }
    } as Partial<T>);
  }, [memory, updateMemory]);
  
  // Initial memory fetch
  useEffect(() => {
    fetchMemory();
  }, [fetchMemory]);
  
  // Fetch history if requested
  useEffect(() => {
    if (loadHistory && memoryId) {
      fetchHistory();
    }
  }, [loadHistory, memoryId, fetchHistory]);
  
  return {
    memory,
    loading,
    error,
    history,
    historyLoading,
    historyError,
    fetchMemory,
    fetchHistory,
    updateMemory,
    deleteMemory,
    flagImportance,
    addTag,
    removeTag
  };
}

export default useMemory; 