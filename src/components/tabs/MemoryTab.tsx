import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AlertCircleIcon, Filter, X, Tag, Info, RefreshCw, ChevronDown } from 'lucide-react';
import MemoryItemComponent from '../memory/MemoryItem';
import { MemoryItem } from '../../types';

// Define types for the debug result
interface SuspectedMessage {
  id: string;
  text: string;
  timestamp: string;
}

interface DebugResult {
  status: string;
  message: string;
  totalMessages: number;
  suspectedReflectionCount: number;
  suspectedMessages: SuspectedMessage[];
  error?: string;
}

interface MemoryTabProps {
  isLoadingMemories: boolean;
  allMemories: (MemoryItem & { metadata?: Record<string, any>; kind?: string })[];
  onRefresh?: () => void;
}

// Extend MemoryItem type to include metadata
interface ExtendedMemoryItem extends MemoryItem {
  kind?: string;
  metadata?: Record<string, any>;
}

const MemoryTab: React.FC<MemoryTabProps> = ({
  isLoadingMemories,
  allMemories,
  onRefresh
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [memoryCount, setMemoryCount] = useState<number>(0);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const typeMenuRef = useRef<HTMLDivElement>(null);

  // Predefined memory types
  const MEMORY_TYPES = [
    "message",
    "thought",
    "reflection",
    "fact",
    "insight",
    "system_learning",
    "task",
    "decision",
    "feedback",
    "knowledge"
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (typeMenuRef.current && !typeMenuRef.current.contains(event.target as Node)) {
        setTypeMenuOpen(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // All possible memory types
  const memoryTypes = useMemo(() => {
    const typeSet = new Set<string>();
    if (allMemories && Array.isArray(allMemories)) {
      allMemories.forEach(memory => {
        if (memory.kind) typeSet.add(memory.kind);
        if (memory.metadata?.type) typeSet.add(memory.metadata.type);
      });
    }
    return Array.from(typeSet).sort();
  }, [allMemories]);

  // Log memory data when it changes
  useEffect(() => {
    console.log('MemoryTab: allMemories updated', {
      count: allMemories?.length || 0,
      isArray: Array.isArray(allMemories),
      sample: allMemories && allMemories.length > 0 ? allMemories[0] : null,
    });
    
    setMemoryCount(allMemories?.length || 0);
  }, [allMemories]);

  // Extract all unique tags from memories
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    if (allMemories && Array.isArray(allMemories)) {
      allMemories.forEach(memory => {
        if (memory && memory.tags && Array.isArray(memory.tags)) {
          memory.tags.forEach(tag => {
            if (tag) tagSet.add(tag);
          });
        }
      });
    }
    return Array.from(tagSet).sort();
  }, [allMemories]);

  // Filter memories based on selected tag, search query, and memory types
  const filteredMemories = useMemo(() => {
    if (!allMemories) return [];
    
    // Filter based on criteria
    const filtered = allMemories.filter(memory => {
      // Filter by tag if one is selected
      const matchesTag = !selectedTagFilter || 
        (memory.tags && memory.tags.includes(selectedTagFilter));
      
      // Filter by search query if provided
      const matchesSearch = !searchQuery || 
        (memory.content && memory.content.toLowerCase().includes(searchQuery.toLowerCase()));
      
      // Filter by memory types if any are selected
      const matchesType = selectedTypes.length === 0 || 
        (memory.kind && selectedTypes.includes(memory.kind)) ||
        (memory.metadata?.type && selectedTypes.includes(memory.metadata.type)) ||
        (memory.category && selectedTypes.includes(memory.category));
      
      return matchesTag && matchesSearch && matchesType;
    });

    // Helper function to normalize content for comparison
    const normalizeContent = (content: string | undefined): string => {
      if (!content) return '';
      
      // Step 1: Get the raw content with basic trimming
      let normalized = content.trim();
      
      // Step 2: Handle nested MESSAGE prefixes more aggressively
      let prevLength;
      do {
        prevLength = normalized.length;
        
        // First, try to handle the doubly nested prefixes like "MESSAGE: MESSAGE [date]: MESSAGE [date]:"
        normalized = normalized.replace(/^MESSAGE:?\s+MESSAGE\s+\[\d{4}-\d{2}-\d{2}[^\]]*\]:\s+MESSAGE\s+\[\d{4}-\d{2}-\d{2}[^\]]*\]:\s+/i, '');
        
        // Then handle single-level nested prefixes like "MESSAGE: MESSAGE [date]:"
        normalized = normalized.replace(/^MESSAGE:?\s+MESSAGE\s+\[\d{4}-\d{2}-\d{2}[^\]]*\]:\s+/i, '');
        
        // Finally handle any remaining prefix patterns
        normalized = normalized.replace(/^MESSAGE:?\s*/i, '');
        normalized = normalized.replace(/^MESSAGE\s+\[\d{4}-\d{2}-\d{2}[^\]]*\]:\s*/i, '');
        
      } while (normalized.length !== prevLength); // Continue until no more changes
      
      // Step 3: Handle any remaining timestamps
      normalized = normalized.replace(/\[\d{4}-\d{2}-\d{2}[^\]]*\]/g, '[DATE]');
      
      // Step 4: Clean up whitespace 
      normalized = normalized.replace(/\s+/g, ' ').trim();
      
      return normalized;
    };
    
    // Helper function to check if two content strings are similar
    const areSimilarContents = (content1: string | undefined, content2: string | undefined): boolean => {
      if (!content1 || !content2) return false;
      
      const normalized1 = normalizeContent(content1);
      const normalized2 = normalizeContent(content2);
      
      // If they're exactly the same after normalization
      if (normalized1 === normalized2) return true;
      
      // If one is a subset of the other (e.g., one has prefix/suffix that the other doesn't)
      if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) return true;
      
      // If either content is very short, require stricter matching
      const shortTextThreshold = 20;
      if (normalized1.length < shortTextThreshold || normalized2.length < shortTextThreshold) {
        // For short texts, require at least 95% similarity
        const shortTextSimilarity = calculateSimilarityRatio(normalized1, normalized2);
        return shortTextSimilarity >= 0.95;
      }
      
      // For longer content, use our existing method
      const commonLength = findLongestCommonSubstring(normalized1, normalized2);
      
      // If the common part is at least 90% of the shorter text
      const similarityRatio = commonLength / Math.min(normalized1.length, normalized2.length);
      return similarityRatio >= 0.9;
    };
    
    // Helper to find the longest common substring length
    const findLongestCommonSubstring = (str1: string, str2: string): number => {
      let commonLength = 0;
      for (let i = 0; i < str1.length; i++) {
        for (let j = 0; j < str2.length; j++) {
          let k = 0;
          while (i + k < str1.length && 
                j + k < str2.length && 
                str1[i + k] === str2[j + k]) {
            k++;
          }
          commonLength = Math.max(commonLength, k);
        }
      }
      return commonLength;
    };
    
    // Calculate a similarity ratio between two strings 
    const calculateSimilarityRatio = (str1: string, str2: string): number => {
      // Count matching characters
      let matches = 0;
      const maxLen = Math.max(str1.length, str2.length);
      
      // Simple approach - match at each position
      for (let i = 0; i < Math.min(str1.length, str2.length); i++) {
        if (str1[i] === str2[i]) {
          matches++;
        }
      }
      
      return maxLen === 0 ? 1.0 : matches / maxLen;
    };

    // Group memories with identical or very similar content
    const contentMap = new Map<string, ExtendedMemoryItem[]>();
    
    filtered.forEach(memory => {
      if (!memory.content) return;
      
      // First check if we have a similar memory already grouped
      let foundSimilar = false;
      
      // Generate a normalized version of the content for the key
      const normalizedContent = normalizeContent(memory.content);
      
      // Check if this content is similar to any existing group
      for (const [existingKey, memories] of Array.from(contentMap.entries())) {
        // First check if we have an exact match after normalization
        if (existingKey === normalizedContent) {
          contentMap.get(existingKey)!.push(memory);
          foundSimilar = true;
          break;
        }
        
        // Otherwise check for similarity with the first memory in the group
        if (memories.length > 0 && areSimilarContents(memory.content, memories[0].content)) {
          contentMap.get(existingKey)!.push(memory);
          foundSimilar = true;
          break;
        }
      }
      
      // If no similar content was found, create a new group
      if (!foundSimilar) {
        contentMap.set(normalizedContent, [memory]);
      }
    });
    
    // For each group, keep only the most recent memory and enhance it with related_versions if duplicates exist
    const deduplicatedMemories: ExtendedMemoryItem[] = [];
    
    contentMap.forEach((memories, content) => {
      if (memories.length === 1) {
        // If only one memory with this content, just add it as is
        deduplicatedMemories.push(memories[0]);
      } else {
        // Sort by date (newest first)
        const sortedMemories = [...memories].sort((a, b) => {
          const dateA = a.created ? new Date(a.created).getTime() : 
                      a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const dateB = b.created ? new Date(b.created).getTime() : 
                      b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return dateB - dateA;
        });
        
        // Take the most recent one as the primary version
        const primaryMemory = sortedMemories[0];
        
        // Add the related versions to its metadata
        const enhancedMemory: ExtendedMemoryItem = {
          ...primaryMemory,
          metadata: {
            ...(primaryMemory.metadata || {}),
            related_versions: sortedMemories.slice(1).map(mem => ({
              id: mem.id,
              type: mem.kind || mem.metadata?.type || 'unknown',
              timestamp: mem.created || mem.timestamp || new Date().toISOString()
            }))
          }
        };
        
        deduplicatedMemories.push(enhancedMemory);
      }
    });

    // Sort by date (newest first)
    return deduplicatedMemories.sort((a, b) => {
      const dateA = a.created ? new Date(a.created).getTime() : 
                  a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const dateB = b.created ? new Date(b.created).getTime() : 
                  b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return dateB - dateA; // Descending order (newest first)
    });
  }, [allMemories, selectedTagFilter, searchQuery, selectedTypes]);

  // Toggle memory type selection
  const toggleTypeSelection = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type) 
        : [...prev, type]
    );
  };

  // Check for incorrect reflections
  const checkIncorrectReflections = async () => {
    setIsChecking(true);
    try {
      const response = await fetch('/api/memory/debug/check-reflections');
      const data = await response.json();
      setDebugResult(data);
    } catch (error) {
      console.error('Error checking reflections:', error);
      setDebugResult({
        status: 'error',
        message: 'Failed to check reflections',
        totalMessages: 0,
        suspectedReflectionCount: 0,
        suspectedMessages: [],
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsChecking(false);
    }
  };

  // Clear filters
  const clearFilters = () => {
    setSelectedTagFilter('');
    setSearchQuery('');
    setSelectedTypes([]);
  };

  // Handle refresh
  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

  // Handle tag update from memory item
  const handleTagUpdate = async (memoryId: string, tags: string[]) => {
    try {
      const response = await fetch('/api/memory/updateTags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memoryId,
          tags,
          action: 'approve'
        }),
      });

      if (response.ok) {
        // Update is handled by refreshing the data
        if (onRefresh) {
          onRefresh();
        }
      } else {
        console.error('Failed to update tags');
      }
    } catch (error) {
      console.error('Error updating tags:', error);
    }
  };

  // Handle tag suggestion rejection
  const handleTagRejection = async (memoryId: string) => {
    try {
      const response = await fetch('/api/memory/updateTags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memoryId,
          action: 'reject'
        }),
      });

      if (response.ok) {
        // Update is handled by refreshing the data
        if (onRefresh) {
          onRefresh();
        }
      } else {
        console.error('Failed to reject tag suggestions');
      }
    } catch (error) {
      console.error('Error rejecting tag suggestions:', error);
    }
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Memory Explorer</h2>
        
        <div className="flex gap-2">
          <button 
            onClick={handleRefresh}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md flex items-center text-sm"
            disabled={isLoadingMemories}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoadingMemories ? 'animate-spin' : ''}`} /> 
            Refresh
          </button>
          
          <button 
            onClick={checkIncorrectReflections}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded-md flex items-center text-sm"
            disabled={isChecking}
          >
            <AlertCircleIcon className="h-4 w-4 mr-1" /> Check Reflections
          </button>
        </div>
      </div>
      
      {/* Memory count indicator */}
      <div className="mb-2 text-sm flex items-center text-gray-400">
        <Info className="h-4 w-4 mr-1" />
        <span>Total memories: {memoryCount}</span>
      </div>
      
      {/* Added filter controls */}
      <div className="mb-4 bg-gray-700 p-3 rounded-md">
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
          <div className="flex items-center">
            <Filter className="h-4 w-4 mr-2 text-gray-400" />
            <span className="text-sm text-gray-300">Filter Memories:</span>
          </div>
          
          <div className="flex flex-wrap gap-3 items-center flex-1">
            {/* Search input */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search in content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm"
              />
            </div>
            
            {/* Tag filter */}
            <div className="flex-1 min-w-[200px]">
              <select
                value={selectedTagFilter}
                onChange={(e) => setSelectedTagFilter(e.target.value)}
                className="w-full px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm appearance-none"
              >
                <option value="">All Tags</option>
                {allTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>
            
            {/* Memory Type filter (dropdown menu) */}
            <div className="flex-1 min-w-[200px] relative" ref={typeMenuRef}>
              <button
                onClick={() => setTypeMenuOpen(!typeMenuOpen)}
                className="w-full flex justify-between items-center px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm"
              >
                <span>
                  {selectedTypes.length === 0 
                    ? "All Memory Types" 
                    : `${selectedTypes.length} type${selectedTypes.length > 1 ? 's' : ''} selected`}
                </span>
                <ChevronDown className="h-4 w-4 ml-2" />
              </button>
              
              {typeMenuOpen && (
                <div className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-600 rounded shadow-lg">
                  <div className="p-2 max-h-60 overflow-y-auto">
                    {MEMORY_TYPES.map(type => (
                      <div 
                        key={type} 
                        className={`px-2 py-1.5 cursor-pointer rounded text-sm flex items-center ${
                          selectedTypes.includes(type) ? 'bg-blue-800' : 'hover:bg-gray-700'
                        }`}
                        onClick={() => toggleTypeSelection(type)}
                      >
                        <input 
                          type="checkbox" 
                          checked={selectedTypes.includes(type)} 
                          onChange={() => {}} 
                          className="mr-2"
                        />
                        <span>{type.replace(/_/g, ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Clear filters button */}
            {(selectedTagFilter || searchQuery || selectedTypes.length > 0) && (
              <button 
                onClick={clearFilters}
                className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1.5 rounded-md flex items-center text-sm"
              >
                <X className="h-4 w-4 mr-1" /> Clear All
              </button>
            )}
          </div>
        </div>
        
        {/* Display active filters */}
        {(selectedTagFilter || searchQuery || selectedTypes.length > 0) && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-gray-400">Active filters:</span>
            <div className="flex flex-wrap gap-1.5">
              {selectedTagFilter && (
                <span className="bg-blue-600/30 text-blue-100 text-xs px-2 py-0.5 rounded-full flex items-center">
                  <Tag className="h-3 w-3 mr-1" /> {selectedTagFilter}
                </span>
              )}
              {searchQuery && (
                <span className="bg-amber-600/30 text-amber-100 text-xs px-2 py-0.5 rounded-full">
                  "{searchQuery}"
                </span>
              )}
              {selectedTypes.map(type => (
                <span 
                  key={type} 
                  className="bg-purple-600/30 text-purple-100 text-xs px-2 py-0.5 rounded-full flex items-center"
                  onClick={() => toggleTypeSelection(type)}
                  style={{ cursor: 'pointer' }}
                >
                  {type.replace(/_/g, ' ')}
                  <X className="h-3 w-3 ml-1" />
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Debug result display */}
      {debugResult && (
        <div className="mb-4 p-2 bg-gray-900 rounded text-xs max-h-40 overflow-auto">
          <p className="mb-2 font-bold">Debug Result:</p>
          <p>Status: {debugResult.status}</p>
          <p>Message: {debugResult.message}</p>
          <p>Total Messages: {debugResult.totalMessages}</p>
          <p>Suspected Reflections: {debugResult.suspectedReflectionCount}</p>
          
          {debugResult.suspectedMessages && debugResult.suspectedMessages.length > 0 && (
            <div className="mt-2">
              <p className="font-bold">Suspected Reflection Messages:</p>
              <ul className="list-disc pl-5">
                {debugResult.suspectedMessages.slice(0, 5).map((msg, idx) => (
                  <li key={idx} className="mt-1">
                    <span className="text-gray-400">{new Date(msg.timestamp).toLocaleString()}</span>: {msg.text}
                  </li>
                ))}
                {debugResult.suspectedMessages.length > 5 && (
                  <li className="mt-1">...and {debugResult.suspectedMessages.length - 5} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
      
      {isChecking && (
        <div className="flex justify-center mb-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-500"></div>
          <span className="ml-2">Checking for incorrect reflections...</span>
        </div>
      )}
      
      {isLoadingMemories ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          <span className="ml-2">Loading memories...</span>
        </div>
      ) : filteredMemories.length === 0 ? (
        <div className="text-gray-400 text-center py-8">
          <p>No memories found matching your filters.</p>
          {memoryCount > 0 && (
            <p className="mt-2 text-sm">
              {selectedTagFilter || searchQuery ? 
                "Try clearing your filters to see all memories." : 
                "There are memories in the system, but they aren't being displayed. Try clicking the Refresh button above."}
            </p>
          )}
          {memoryCount === 0 && (
            <button 
              onClick={handleRefresh}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md inline-flex items-center text-sm"
            >
              <RefreshCw className="h-4 w-4 mr-1" /> Try Refreshing
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMemories.map((memory, index) => (
            <MemoryItemComponent
              key={memory.id || index}
              memory={memory}
              onTagUpdate={handleTagUpdate}
              onTagSuggestionRemove={handleTagRejection}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MemoryTab; 