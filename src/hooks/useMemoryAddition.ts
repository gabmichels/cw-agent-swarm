import { useState, useCallback } from 'react';
import { MemoryType, ImportanceLevel } from '../server/memory/config';
import { BaseMemorySchema } from '../server/memory/models';

interface AddMemoryOptions<T extends BaseMemorySchema> {
  /**
   * Type of memory to add
   */
  type: MemoryType;
  
  /**
   * Content of the memory
   */
  content: string;
  
  /**
   * Additional metadata for the memory
   */
  metadata?: Record<string, any>;
  
  /**
   * Optional pre-computed embedding
   */
  embedding?: number[];
  
  /**
   * Optional custom ID (generated if not provided)
   */
  id?: string;
}

/**
 * Hook for adding new memories
 */
export function useMemoryAddition<T extends BaseMemorySchema = BaseMemorySchema>() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [addedMemory, setAddedMemory] = useState<T | null>(null);
  
  /**
   * Add a new memory
   */
  const addMemory = useCallback(async (options: AddMemoryOptions<T>) => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    setAddedMemory(null);
    
    try {
      // Add default importance if not specified
      if (options.metadata && !options.metadata.importance) {
        options.metadata.importance = ImportanceLevel.MEDIUM;
      }
      
      // Send request
      const response = await fetch('/api/memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(options)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add memory');
      }
      
      const data = await response.json();
      setAddedMemory(data.memory);
      setSuccess(true);
      return data.memory;
    } catch (err) {
      console.error('Error adding memory:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
  
  /**
   * Add a message memory
   */
  const addMessageMemory = useCallback(async (
    content: string, 
    metadata: Record<string, any> = {}
  ) => {
    return addMemory({
      type: MemoryType.MESSAGE,
      content,
      metadata
    });
  }, [addMemory]);
  
  /**
   * Add a thought memory
   */
  const addThoughtMemory = useCallback(async (
    content: string, 
    metadata: Record<string, any> = {}
  ) => {
    return addMemory({
      type: MemoryType.THOUGHT,
      content,
      metadata
    });
  }, [addMemory]);
  
  /**
   * Add a document memory
   */
  const addDocumentMemory = useCallback(async (
    content: string, 
    metadata: Record<string, any> = {}
  ) => {
    return addMemory({
      type: MemoryType.DOCUMENT,
      content,
      metadata
    });
  }, [addMemory]);
  
  /**
   * Add a task memory
   */
  const addTaskMemory = useCallback(async (
    content: string, 
    metadata: Record<string, any> = {}
  ) => {
    return addMemory({
      type: MemoryType.TASK,
      content,
      metadata
    });
  }, [addMemory]);
  
  /**
   * Reset the state
   */
  const reset = useCallback(() => {
    setError(null);
    setSuccess(false);
    setAddedMemory(null);
  }, []);
  
  return {
    addMemory,
    addMessageMemory,
    addThoughtMemory,
    addDocumentMemory,
    addTaskMemory,
    loading,
    error,
    success,
    addedMemory,
    reset
  };
}

export default useMemoryAddition; 