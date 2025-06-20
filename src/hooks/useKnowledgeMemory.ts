import { ImportanceLevel, MemoryType } from '@/constants/memory';
import { useState, useCallback, useEffect } from 'react';
import useMemory, { MemorySearchParams } from './useMemory';

/**
 * Knowledge item interface
 */
export interface KnowledgeItem {
  id: string;
  content: string; 
  type: string;
  timestamp: Date;
  source?: string;
  importance?: ImportanceLevel;
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
  /**
   * Whether to automatically load items on mount
   * @default false - Set to false to prevent automatic loading
   */
  autoLoad?: boolean;
}

// Define memory item type interface with more flexible structure
interface MemoryItem {
  id: string;
  payload?: {
    text?: string;
    content?: string; // Some items might use content instead of text
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
  // Some items might have these fields at the top level
  text?: string;
  content?: string;
  type?: string;
  timestamp?: string | number;
  metadata?: {
    source?: string;
    importance?: string;
    tags?: string[];
    flagged?: boolean;
    [key: string]: any;
  };
}

/**
 * Hook for knowledge memory operations
 */
export default function useKnowledgeMemory({
  types = [MemoryType.MESSAGE], // Will be replaced with appropriate types
  tags = [],
  limit = 50,
  onlyFlagged = false,
  autoLoad = false
}: UseKnowledgeMemoryParams = {}) {
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  
  // Use the base memory hook with autoLoad set to false to prevent automatic loading
  const { 
    getMemories, 
    searchMemories, 
    getMemory, 
    addMemory, 
    updateMemory, 
    deleteMemory 
  } = useMemory(types, { autoLoad: false });
  
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
      const knowledgeData = items.map((item: MemoryItem) => {
        // Add null checks to prevent TypeError
        if (!item) {
          console.warn('Received null or undefined memory item');
          // Return a minimal default item
          return {
            id: 'unknown',
            content: 'Content unavailable',
            type: '',
            timestamp: new Date(),
            source: '',
            importance: ImportanceLevel.MEDIUM,
            tags: [],
            flagged: false,
            metadata: {}
          };
        }
        
        // Extract content from wherever it might be located
        const content = 
          (item.payload?.text) || 
          (item.payload?.content) || 
          (item.text) || 
          (item.content) || 
          '';
        
        // Get metadata from either payload or top level
        const metadata = item.payload?.metadata || item.metadata || {};
        
        return {
          id: item.id,
          content,
          type: item.payload?.type || item.type || '',
          timestamp: new Date(item.payload?.timestamp || item.timestamp || Date.now()),
          source: metadata.source || '',
          importance: metadata.importance || ImportanceLevel.MEDIUM,
          tags: Array.isArray(metadata.tags) ? metadata.tags : [],
          flagged: !!metadata.flagged,
          metadata
        };
      });
      
      // Filter for flagged items if needed
      const filteredItems = onlyFlagged
        ? knowledgeData.filter((item: KnowledgeItem) => item.flagged)
        : knowledgeData;
      
      setKnowledgeItems(filteredItems);
      setTotalCount(filteredItems.length);
      
      return filteredItems;
    } catch (error) {
      console.error('Error loading knowledge items:', error);
      setError(error instanceof Error ? error : new Error(String(error)));
      return [];
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
      importance?: ImportanceLevel;
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
      
      return result;
    } catch (error) {
      console.error('Error adding knowledge item:', error);
      throw error;
    }
  }, [addMemory]);
  
  /**
   * Update a knowledge item
   */
  const updateKnowledgeItem = useCallback(async (
    id: string,
    data: {
      content?: string;
      type?: MemoryType;
      source?: string;
      importance?: ImportanceLevel;
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
      
      return result;
    } catch (error) {
      console.error('Error updating knowledge item:', error);
      throw error;
    }
  }, [getMemory, updateMemory]);
  
  /**
   * Delete a knowledge item
   */
  const deleteKnowledgeItem = useCallback(async (id: string, type: MemoryType) => {
    try {
      await deleteMemory({ id, type });
      
      return true;
    } catch (error) {
      console.error('Error deleting knowledge item:', error);
      throw error;
    }
  }, [deleteMemory]);
  
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
    importance: ImportanceLevel
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
  
  // Load items on initial mount if autoLoad is enabled
  useEffect(() => {
    if (autoLoad) {
      loadKnowledgeItems();
    }
  }, []); // Only run on initial mount
  
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