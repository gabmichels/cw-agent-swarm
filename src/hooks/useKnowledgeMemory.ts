import { useState, useCallback, useEffect } from 'react';
import { MemoryType } from '../server/memory/config';
import useMemory, { MemorySearchParams } from './useMemory';

/**
 * Importance levels for knowledge items
 */
export enum KnowledgeImportance {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Knowledge item interface
 */
export interface KnowledgeItem {
  id: string;
  content: string; 
  type: string;
  timestamp: Date;
  source?: string;
  importance?: KnowledgeImportance;
  tags?: string[];
  flagged?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Parameters for useKnowledgeMemory hook
 */
interface UseKnowledgeMemoryParams {
  types?: MemoryType[];
  tags?: string[];
  limit?: number;
  onlyFlagged?: boolean;
}

// Define memory item type interface
interface MemoryItem {
  id: string;
  payload: {
    text: string;
    type?: string;
    timestamp?: string;
    metadata?: {
      source?: string;
      importance?: string;
      tags?: string[];
      flagged?: boolean;
      [key: string]: any;
    };
  };
}

/**
 * Hook for knowledge memory operations
 */
export default function useKnowledgeMemory({
  types = [MemoryType.MESSAGE], // Will be replaced with appropriate types
  tags = [],
  limit = 50,
  onlyFlagged = false
}: UseKnowledgeMemoryParams = {}) {
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  
  // Use the base memory hook
  const { 
    getMemories, 
    searchMemories, 
    getMemory, 
    addMemory, 
    updateMemory, 
    deleteMemory 
  } = useMemory(types);
  
  /**
   * Load knowledge items
   */
  const loadKnowledgeItems = useCallback(async (
    options: {
      offset?: number;
      searchQuery?: string;
    } = {}
  ) => {
    setIsLoading(true);
    setError(null);
    
    try {
      let items;
      const { offset = 0, searchQuery = '' } = options;
      
      if (searchQuery) {
        // Use hybrid search when we have a query
        const searchParams: MemorySearchParams = {
          query: searchQuery,
          types,
          limit,
          offset,
          hybridRatio: 0.7 // Balanced hybrid search
        };
        
        // Add tag filter if specified
        if (tags.length > 0) {
          searchParams.tags = tags;
        }
        
        items = await searchMemories(searchParams);
      } else {
        // Get memories without search
        items = await getMemories({
          types,
          limit,
          offset
        });
      }
      
      // Convert to KnowledgeItem format
      const knowledgeData = items.map((item: MemoryItem) => ({
        id: item.id,
        content: item.payload.text,
        type: item.payload.type || '',
        timestamp: new Date(item.payload.timestamp || Date.now()),
        source: item.payload.metadata?.source || '',
        importance: item.payload.metadata?.importance || KnowledgeImportance.MEDIUM,
        tags: item.payload.metadata?.tags || [],
        flagged: item.payload.metadata?.flagged || false,
        metadata: item.payload.metadata || {}
      }));
      
      // Filter for flagged items if needed
      const filteredItems = onlyFlagged
        ? knowledgeData.filter((item: KnowledgeItem) => item.flagged)
        : knowledgeData;
      
      setKnowledgeItems(filteredItems);
      setTotalCount(filteredItems.length);
    } catch (error) {
      console.error('Error loading knowledge items:', error);
      setError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsLoading(false);
    }
  }, [types, tags, limit, onlyFlagged, getMemories, searchMemories]);
  
  /**
   * Add a new knowledge item
   */
  const addKnowledgeItem = useCallback(async (
    data: {
      content: string;
      type: MemoryType;
      source?: string;
      importance?: KnowledgeImportance;
      tags?: string[];
      flagged?: boolean;
      metadata?: Record<string, any>;
    }
  ) => {
    try {
      const { content, type, source, importance, tags, flagged, metadata = {} } = data;
      
      // Add memory using base hook
      const result = await addMemory({
        type,
        content,
        metadata: {
          source,
          importance,
          tags,
          flagged,
          ...metadata,
          timestamp: new Date().toISOString()
        }
      });
      
      // Refresh the list
      await loadKnowledgeItems();
      
      return result;
    } catch (error) {
      console.error('Error adding knowledge item:', error);
      throw error;
    }
  }, [addMemory, loadKnowledgeItems]);
  
  /**
   * Update a knowledge item
   */
  const updateKnowledgeItem = useCallback(async (
    id: string,
    data: {
      content?: string;
      type?: MemoryType;
      source?: string;
      importance?: KnowledgeImportance;
      tags?: string[];
      flagged?: boolean;
      metadata?: Record<string, any>;
    }
  ) => {
    try {
      const { content, type, source, importance, tags, flagged, metadata = {} } = data;
      
      // Get current memory to merge metadata
      const currentMemory = await getMemory(id);
      
      // Prepare update data
      const updateData = {
        id,
        type: type || currentMemory.payload.type,
        content: content !== undefined ? content : undefined,
        metadata: {
          ...currentMemory.payload.metadata,
          ...(source !== undefined ? { source } : {}),
          ...(importance !== undefined ? { importance } : {}),
          ...(tags !== undefined ? { tags } : {}),
          ...(flagged !== undefined ? { flagged } : {}),
          ...metadata,
          updatedAt: new Date().toISOString()
        }
      };
      
      // Update memory
      const result = await updateMemory(updateData);
      
      // Refresh the list
      await loadKnowledgeItems();
      
      return result;
    } catch (error) {
      console.error('Error updating knowledge item:', error);
      throw error;
    }
  }, [getMemory, updateMemory, loadKnowledgeItems]);
  
  /**
   * Delete a knowledge item
   */
  const deleteKnowledgeItem = useCallback(async (id: string, type: MemoryType) => {
    try {
      await deleteMemory({ id, type });
      
      // Refresh the list
      await loadKnowledgeItems();
      
      return true;
    } catch (error) {
      console.error('Error deleting knowledge item:', error);
      throw error;
    }
  }, [deleteMemory, loadKnowledgeItems]);
  
  /**
   * Toggle flagged status of a knowledge item
   */
  const toggleFlagged = useCallback(async (id: string, type: MemoryType) => {
    try {
      // Get current memory
      const currentMemory = await getMemory(id);
      
      // Toggle flagged status
      const currentFlagged = currentMemory.payload.metadata?.flagged || false;
      
      return await updateKnowledgeItem(id, {
        type,
        flagged: !currentFlagged
      });
    } catch (error) {
      console.error('Error toggling flagged status:', error);
      throw error;
    }
  }, [getMemory, updateKnowledgeItem]);
  
  /**
   * Change importance of a knowledge item
   */
  const changeImportance = useCallback(async (
    id: string,
    type: MemoryType,
    importance: KnowledgeImportance
  ) => {
    try {
      return await updateKnowledgeItem(id, {
        type,
        importance
      });
    } catch (error) {
      console.error('Error changing importance:', error);
      throw error;
    }
  }, [updateKnowledgeItem]);
  
  // Load items on initial render and when dependencies change
  useEffect(() => {
    loadKnowledgeItems();
  }, [loadKnowledgeItems]);
  
  return {
    knowledgeItems,
    isLoading,
    error,
    totalCount,
    loadKnowledgeItems,
    addKnowledgeItem,
    updateKnowledgeItem,
    deleteKnowledgeItem,
    toggleFlagged,
    changeImportance,
    refresh: loadKnowledgeItems
  };
} 