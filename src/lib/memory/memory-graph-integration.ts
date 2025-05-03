/**
 * Memory Graph Integration
 * 
 * This file provides integration points between the MemoryGraph system
 * and the core memory storage/retrieval flow.
 */

import { getMemoryGraph } from './MemoryUtils';
import { storeMemory as originalStoreMemory, searchMemory } from '../../server/qdrant';
import { MemoryRecord } from '../../server/qdrant';
import { ImportanceLevel } from '../../constants/memory';
import { Tag } from './TagExtractor';

/**
 * Enhanced version of storeMemory that also connects the memory to the graph
 * 
 * @param content Content of the memory
 * @param type Type of memory
 * @param source Source of the memory
 * @param metadata Additional metadata
 * @param options Storage options
 * @returns ID of the stored memory
 */
export async function storeMemoryWithGraph(
  content: string, 
  type: string, 
  source: string, 
  metadata: Record<string, any> = {},
  options: {
    importance?: ImportanceLevel;
    importance_score?: number;
    existingEmbedding?: number[];
    tags?: Array<string | Tag>;
    tagConfidence?: number;
    connectToGraph?: boolean;
  } = {}
): Promise<string> {
  try {
    // Determine if we should connect to graph (default to true)
    const connectToGraph = options.connectToGraph !== false;
    
    // First store memory normally using the original function
    const memoryId = await originalStoreMemory(
      content,
      type,
      source,
      metadata,
      options
    );
    
    // If graph connection is enabled, connect the memory to related memories
    if (connectToGraph && memoryId) {
      try {
        // Connect in background to avoid blocking
        // This is an asynchronous operation that we don't need to wait for
        getMemoryGraph()
          .then(memoryGraph => memoryGraph.connectMemory(memoryId))
          .then(connectionCount => {
            if (connectionCount > 0) {
              console.log(`Connected memory ${memoryId} to ${connectionCount} related memories`);
            }
          })
          .catch(err => {
            console.error('Error connecting memory to graph:', err);
          });
      } catch (error) {
        // Log the error but don't fail the memory storage
        console.error('Error setting up graph connection:', error);
      }
    }
    
    return memoryId;
  } catch (error) {
    console.error('Error in storeMemoryWithGraph:', error);
    throw error;
  }
}

/**
 * Create a memory index for all existing memories
 * This is used to build initial connections for the memory graph
 * 
 * @param options Indexing options
 */
export async function buildMemoryGraph(
  options: {
    batchSize?: number;
    maxMemories?: number;
    minImportance?: number;
    memoryTypes?: string[];
  } = {}
): Promise<{
  processed: number;
  connected: number;
  errors: number;
}> {
  // Set up stats
  const stats = {
    processed: 0,
    connected: 0,
    errors: 0
  };
  
  try {
    // Get the memory graph instance
    const memoryGraph = await getMemoryGraph();
    
    // Set defaults
    const batchSize = options.batchSize || 100;
    const maxMemories = options.maxMemories || 1000;
    const minImportance = options.minImportance || 0.3;
    
    // For now, we'll use a simple approach to get memories using searchMemory with empty query
    // In a full implementation, we would use pagination to process all memories
    const allMemories = await searchMemory(null, "", { 
      limit: maxMemories,
      filter: {
        importance_score: { $gte: minImportance }
      }
    });
    
    console.log(`Building memory graph for ${allMemories.length} memories...`);
    
    // Process in batches
    for (let i = 0; i < allMemories.length; i += batchSize) {
      const batch = allMemories.slice(i, i + batchSize);
      
      // Process batch in parallel with Promise.all
      const results = await Promise.allSettled(
        batch.map((memory: MemoryRecord) => memoryGraph.connectMemory(memory.id))
      );
      
      // Update stats
      for (const result of results) {
        stats.processed++;
        
        if (result.status === 'fulfilled') {
          const connectionCount = result.value;
          if (connectionCount > 0) {
            stats.connected++;
          }
        } else {
          stats.errors++;
        }
      }
      
      console.log(`Processed ${stats.processed}/${allMemories.length} memories. Connected: ${stats.connected}, Errors: ${stats.errors}`);
    }
    
    return stats;
  } catch (error) {
    console.error('Error building memory graph:', error);
    return stats;
  }
}

// Export the original function for compatibility
export const storeMemory = storeMemoryWithGraph; 