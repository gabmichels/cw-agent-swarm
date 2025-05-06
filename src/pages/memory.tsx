/**
 * Component-level state/variables that should be outside
 * the functional component's render loop
 */
import React, { useState, useCallback, useEffect } from 'react';
import MemoryItem from '../components/memory/MemoryItem';
import { MemoryPoint, BaseMemorySchema } from '../server/memory/models/base-schema';
import { getMemoryServices } from '../server/memory/services';
import { RefreshCw, Search, Database } from 'lucide-react';

// Define the SearchResult interface based on what the API returns
interface SearchResult<T extends BaseMemorySchema> {
  point: MemoryPoint<T>;
  score: number;
  type: string;
  collection: string;
}

export default function MemoryPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [memories, setMemories] = useState<MemoryPoint<BaseMemorySchema>[]>([]);
  const [filteredMemories, setFilteredMemories] = useState<MemoryPoint<BaseMemorySchema>[]>([]);
  const [regenerating, setRegenerating] = useState<{memoryId: string, inProgress: boolean} | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [memoryTypes, setMemoryTypes] = useState<string[]>([]);
  
  // Fetch memories from API
  const fetchMemories = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Get memories from service
      const { searchService } = await getMemoryServices();
      const results = await searchService.search<BaseMemorySchema>('', { limit: 100 });
      
      // Extract memory points from search results
      const memoryPoints = results.map(result => result.point);
      
      setMemories(memoryPoints);
      setFilteredMemories(memoryPoints);
    } catch (error) {
      console.error('Error fetching memories:', error);
      // Use browser alert instead of toast for now
      alert("Failed to load memories: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);
  
  // Handle tag updates
  const handleTagUpdate = useCallback(async (memoryId: string, tags: string[]) => {
    console.log(`handleTagUpdate called for memory ${memoryId} with tags:`, tags);
    
    try {
      // Call the API to update tags
      const response = await fetch(`/api/memory/${memoryId}/tags`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tags }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update tags: ${response.status} ${response.statusText}\n${errorText}`);
      }
      
      // Log success
      console.log(`Tags updated successfully for memory ${memoryId}`);
      
      // Update memory tags in the UI
      setFilteredMemories(prev => 
        prev.map(memory => {
          if (memory.id === memoryId) {
            return {
              ...memory,
              payload: {
                ...memory.payload,
                metadata: {
                  ...memory.payload.metadata,
                  tags
                }
              }
            };
          }
          return memory;
        })
      );
      
      // Refresh the memories to get the latest data
      fetchMemories();
    } catch (error) {
      console.error('Error updating tags:', error);
      alert(`Error updating tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [fetchMemories]);
  
  /**
   * Regenerate tags for a memory item using the OpenAI tag extractor
   * This is a properly memoized function that won't change on re-renders
   */
  const regenerateTagsForMemory = useCallback(async (memoryId: string, content: string): Promise<string[]> => {
    console.log(`DEBUG: regenerateTagsForMemory called for memory ${memoryId}`);
    console.log(`DEBUG: Content length: ${content.length}`);
    
    // Set regenerating state for UI feedback
    setRegenerating({memoryId, inProgress: true});
    
    try {
      // Call the minimal API endpoint that doesn't use dynamic routing
      const apiUrl = `/api/tag-generator`;
      console.log(`DEBUG: About to fetch ${apiUrl}`);
      console.log(`DEBUG: Full URL path: ${window.location.origin}${apiUrl}`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memoryId,
          content
        }),
      });
      
      console.log(`DEBUG: API response status: ${response.status}`);
      
      // Parse the response (even if not ok, we'll try to get tags)
      const data = await response.json();
      console.log(`DEBUG: API response data:`, data);
      
      // Log any errors but continue
      if (!response.ok) {
        console.error("DEBUG: API warning:", data.error || "Unknown error");
      }
      
      // Get tags from response or use fallback
      const tags = data.tags || ['fallback', 'tags']; 
      console.log("DEBUG: Tags generated:", tags);
      
      // CRITICAL FIX: Explicitly update the memory with the new tags
      try {
        console.log(`DEBUG: Explicitly updating memory ${memoryId} with new tags:`, tags);
        await handleTagUpdate(memoryId, tags);
        
        // Explicitly refresh memories to ensure UI is updated
        console.log('DEBUG: Explicitly refreshing memories to update UI');
        await fetchMemories();
      } catch (updateError) {
        console.error("DEBUG: Failed to update memory with new tags:", updateError);
        // Continue regardless of update error - we'll return the tags
      }
      
      // Return the new tags
      return tags;
    } catch (error) {
      // Log error but return fallback tags
      console.error('DEBUG: Error regenerating tags:', error);
      
      // Show error to user but don't throw
      alert("Error regenerating tags, using fallback tags");
      
      // Return fallback tags instead of throwing
      return ['error', 'fallback', 'tags'];
    } finally {
      // Always clear regenerating state
      setRegenerating(null);
    }
  }, [handleTagUpdate, fetchMemories]);
  
  // Load memories on component mount
  useEffect(() => {
    console.log("Memory page mounted, fetching memories...");
    fetchMemories();
    
    // Debug info to console
    console.log("regenerateTagsForMemory is defined:", typeof regenerateTagsForMemory === 'function');
  }, [fetchMemories, regenerateTagsForMemory]);
  
  // Handle tag suggestion removal
  const handleTagSuggestionRemove = useCallback(async (memoryId: string) => {
    console.log(`handleTagSuggestionRemove called for memory ${memoryId}`);
    
    try {
      // Call the API to reject suggested tags
      const response = await fetch(`/api/memory/${memoryId}/tags/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to reject tags: ${response.status} ${response.statusText}\n${errorText}`);
      }
      
      // Log success
      console.log(`Tags rejected successfully for memory ${memoryId}`);
      
      // Remove suggested tags from the UI
      setFilteredMemories(prev => 
        prev.map(memory => {
          if (memory.id === memoryId) {
            return {
              ...memory,
              payload: {
                ...memory.payload,
                metadata: {
                  ...memory.payload.metadata,
                  suggestedTags: [],
                  autoGeneratedTags: false
                }
              }
            };
          }
          return memory;
        })
      );
      
      // Refresh the memories to get the latest data
      fetchMemories();
    } catch (error) {
      console.error('Error rejecting tags:', error);
      alert(`Error rejecting tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [fetchMemories]);
  
  // Add debug log to check if the function is properly defined
  console.log("regenerateTagsForMemory function is defined:", typeof regenerateTagsForMemory === 'function');
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">Memory</h1>
      
      {isLoading ? (
        <div className="text-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-lg text-gray-500">Loading memory points...</p>
        </div>
      ) : filteredMemories.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-gray-700 rounded-lg">
          <Database className="h-12 w-12 mx-auto mb-4 text-gray-500" />
          <p className="text-xl text-gray-400 mb-2">No memory points found</p>
          <p className="text-gray-500">Memory items will appear here as your agent processes information</p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-4 items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search memories..."
                className="pl-10 pr-4 py-2 w-full md:w-80 bg-gray-800 border border-gray-700 rounded-md text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400 whitespace-nowrap">Filter by type:</label>
              <select
                className="bg-gray-800 border border-gray-700 rounded-md text-gray-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">All types</option>
                {memoryTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="space-y-4">
            {filteredMemories.map((memory) => (
              <MemoryItem 
                key={memory.id} 
                memory={memory} 
                onTagUpdate={handleTagUpdate}
                onTagSuggestionRemove={handleTagSuggestionRemove}
                regenerateTagsForMemory={regenerateTagsForMemory}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
} 