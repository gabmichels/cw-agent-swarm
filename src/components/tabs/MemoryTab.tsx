import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AlertCircleIcon, Filter, X, Tag, Info, RefreshCw, ChevronDown, Loader2, Search, Hash, Settings, Menu, Bug } from 'lucide-react';
import MemoryItemComponent from '../memory/MemoryItem';
import { MemoryType } from '../../server/memory/config';
import { BaseMemorySchema, MemoryPoint } from '../../server/memory/models';
import { SearchResult } from '../../server/memory/services/search/types';
import useMemory from '../../hooks/useMemory';
import useMemorySearch from '../../hooks/useMemorySearch';

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

// Extend MemoryItem type to include metadata
interface ExtendedMemoryItem extends MemoryPoint<BaseMemorySchema> {
  kind?: string;
  metadata?: Record<string, any>;
  isMemoryEdit?: boolean;
}

// Interface for MemoryTab component props
interface MemoryTabProps {
  isLoadingMemories?: boolean;
  allMemories?: ExtendedMemoryItem[];
  onRefresh?: () => void;
}

const MemoryTab: React.FC<MemoryTabProps> = ({
  isLoadingMemories: externalLoading,
  allMemories: externalMemories,
  onRefresh: externalRefresh
}) => {
  // Use standardized memory hooks
  const { memories, isLoading: isLoadingMemoryHook, error, totalCount, getMemories } = useMemory();
  const { 
    results: searchResults,
    loading: isSearching,
    hybridSearch,
    clearSearch
  } = useMemorySearch<BaseMemorySchema>();

  // State variables
  const [isChecking, setIsChecking] = useState(false);
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [memoryCount, setMemoryCount] = useState<number>(0);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [typeMenuOpen, setTypeMenuOpen] = useState<boolean>(false);
  const typeMenuRef = useRef<HTMLDivElement>(null);
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [showRawMemory, setShowRawMemory] = useState<string | null>(null);

  // Derive loading and memory states, preferring hook values but falling back to props
  const isLoadingMemories = isLoadingMemoryHook || externalLoading || false;
  const allMemories = memories.length > 0 ? memories : (externalMemories || []);

  // All possible memory types as strings - use the enum values
  const MEMORY_TYPES: string[] = [
    ...Object.values(MemoryType),
    // Add any legacy or additional types that might still be in the system
    "reflection",
    "fact",
    "insight",
    "system_learning",
    "decision",
    "feedback",
    "knowledge",
    "unknown",
    "chat",
    "idea",
    "summary"
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

  // Load memories when component mounts
  useEffect(() => {
    if (!externalMemories) {
      handleRefresh();
    }
  }, []);

  // All possible memory types
  const memoryTypes = useMemo(() => {
    const typeSet = new Set<string>();
    if (allMemories && Array.isArray(allMemories)) {
      allMemories.forEach(memory => {
        if (memory.payload?.type) typeSet.add(memory.payload.type);
        if (memory.kind) typeSet.add(memory.kind);
        if (memory.metadata?.type) typeSet.add(memory.metadata.type);
        if (memory.payload?.metadata?.category) typeSet.add(memory.payload.metadata.category);
        if ('type' in memory && memory.type) typeSet.add(memory.type as string);
      });
    }
    return Array.from(typeSet).sort();
  }, [allMemories]);

  // Log memory data when it changes
  useEffect(() => {
    console.log('MemoryTab: allMemories updated', {
      count: allMemories?.length || 0,
      isArray: Array.isArray(allMemories),
      firstThree: allMemories && allMemories.length > 0 ? allMemories.slice(0, 3).map(m => ({
        id: m.id,
        type: m.payload?.type || m.kind || m.metadata?.type || m.payload?.metadata?.category || 'unknown',
        contentPreview: m.payload?.text ? m.payload.text.substring(0, 30) + '...' : 'No content',
        timestamp: m.payload?.timestamp
      })) : [],
    });
    
    setMemoryCount(allMemories?.length || 0);
  }, [allMemories]);

  // Extract all unique tags from memories
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    if (allMemories && Array.isArray(allMemories)) {
      allMemories.forEach(memory => {
        if (memory && memory.payload?.metadata?.tags && Array.isArray(memory.payload.metadata.tags)) {
          memory.payload.metadata.tags.forEach((tag: string) => {
            if (tag) tagSet.add(tag);
          });
        }
      });
    }
    return Array.from(tagSet).sort();
  }, [allMemories]);

  // Filter memories based on selected tag, search query, and memory types
  const filteredMemories = useMemo(() => {
    // If we have search results and search query, use the search results
    if (searchResults && searchResults.length > 0 && searchQuery) {
      console.log(`Using ${searchResults.length} search results instead of filtering`);
      
      // The search results are already compatible with our requirements
      // We'll use type assertion to satisfy TypeScript
      return searchResults as unknown as ExtendedMemoryItem[];
    }
    
    if (!allMemories) return [];
    
    console.log(`Starting with ${allMemories.length} total memories`);
    
    // Count and log each memory type to diagnose the issue
    const typeCount: Record<string, number> = {};
    allMemories.forEach(memory => {
      const type = memory.payload?.type || 
                  memory.kind || 
                  memory.metadata?.type || 
                  memory.payload?.metadata?.category || 
                  (memory as any).type || 
                  'unknown';
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    console.log('Memory types in allMemories:', typeCount);
    
    // First, filter out memory_edit records - we'll display these as versions of their originals
    // But keep them if explicitly showing memory_edits type
    const memoryEditType = MemoryType.MEMORY_EDIT as string;
    let filtered = selectedTypes.includes(memoryEditType) || selectedTypes.includes('memory_edit')
      ? allMemories 
      : allMemories.filter(memory => !(
          memory.isMemoryEdit || 
          memory.metadata?.isMemoryEdit || 
          memory.payload?.type === memoryEditType
      ));
    
    // Apply text search filter if any
    if (searchQuery && searchResults?.length === 0) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(memory => 
        memory.payload?.text && memory.payload.text.toLowerCase().includes(query)
      );
    }
    
    // Apply tag filter if selected
    if (selectedTagFilter) {
      filtered = filtered.filter(memory => {
        const tags = memory.payload?.metadata?.tags || [];
        return tags.includes(selectedTagFilter);
      });
    }
    
    // Apply memory type filter if any are selected
    if (selectedTypes.length > 0) {
      filtered = filtered.filter(memory => {
        const memoryType = memory.payload?.type || 
                          memory.kind || 
                memory.metadata?.type || 
                          memory.payload?.metadata?.category || 
                (memory as any).type || 
                'unknown';
                
        return selectedTypes.includes(memoryType);
      });
    }
    
    return filtered;
  }, [allMemories, selectedTypes, selectedTagFilter, searchQuery, searchResults]);

  const toggleTypeSelection = (type: string) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter(t => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  const checkIncorrectReflections = async () => {
    setIsChecking(true);
    setDebugResult(null);
    
    try {
      // Use standardized API endpoint
      const response = await fetch('/api/diagnostics/memory-check');
      if (!response.ok) {
        throw new Error(`Failed to run diagnostic: ${response.statusText}`);
      }
      const result = await response.json();
      setDebugResult(result);
    } catch (error) {
      console.error('Error checking reflections:', error);
      setDebugResult({
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
        totalMessages: 0,
        suspectedReflectionCount: 0,
        suspectedMessages: []
      });
    } finally {
      setIsChecking(false);
    }
  };

  const clearFilters = () => {
    setSelectedTagFilter('');
    setSelectedTypes([]);
    setSearchQuery('');
    clearSearch();
  };

  const handleRefresh = () => {
    if (externalRefresh) {
      externalRefresh();
    } else {
      // Use the standardized getMemories function from the hook
      getMemories();
    }
  };

  const handleTagUpdate = async (memoryId: string, tags: string[]) => {
    console.log(`Updating tags for memory ${memoryId}`, { tags });
    
    try {
      // Use standardized API endpoint for updating memory tags
      const response = await fetch(`/api/memory/${memoryId}/tags`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tags })
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`Error updating tags: ${text}`);
        throw new Error(`Failed to update tags: ${response.status} ${response.statusText}`);
        }
      
      // Update memory in state
      const updatedMemory = await response.json();
      console.log('Tags updated successfully', updatedMemory);
      
      // Refresh the memories list
      handleRefresh();
    } catch (error) {
      console.error('Error updating tags:', error);
    }
  };

  const handleTagRejection = async (memoryId: string) => {
    console.log(`Rejecting suggested tags for memory ${memoryId}`);
    
    try {
      // Use standardized API endpoint for memory tag rejection
      const response = await fetch(`/api/memory/${memoryId}/reject-tags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to reject tags: ${response.status} ${response.statusText}`);
        }
      
      // Process successful response
      const result = await response.json();
      console.log('Tags rejection processed successfully', result);
      
      // Refresh the memories list
      handleRefresh();
    } catch (error) {
      console.error('Error rejecting tags:', error);
    }
  };

  const toggleDebug = () => setShowDebug(!showDebug);

  const displayMemoryTypeCounts = (memories: ExtendedMemoryItem[] | null | undefined) => {
    if (!memories) return null;
    
    // Count occurrences of each memory type
    const typeCounts: Record<string, number> = {};
    memories.forEach(memory => {
      const type = memory.payload?.type || 
                  memory.kind || 
                  memory.metadata?.type || 
                  memory.payload?.metadata?.category || 
                  (memory as any).type || 
                  'unknown';
      
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    // Convert to sortable array
    const counts = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1]) // Sort by count, descending
      .map(([type, count]) => ({ type, count }));
    
    return (
      <div className="flex flex-wrap gap-2 mb-4">
        {counts.map(({ type, count }) => (
          <div 
            key={type} 
            className={`px-2 py-1 text-xs rounded-md flex items-center gap-1 cursor-pointer ${selectedTypes.includes(type) ? 'bg-blue-100 border border-blue-300' : 'bg-gray-100 border border-gray-200'}`}
            onClick={() => toggleTypeSelection(type)}
          >
            <Hash size={12} />
            <span>{type}</span>
            <span className="font-semibold">({count})</span>
          </div>
        ))}
      </div>
    );
  };

  const handleDebugClick = () => {
    // Toggle debug panel
    toggleDebug();
    
    // If turning on debug, check for incorrect reflections
    if (!showDebug) {
      checkIncorrectReflections();
    }
  };

  const checkAllMemoryTypes = async () => {
    console.log('Checking memory collection status...');
    setIsChecking(true);
    
    try {
      // Use standardized API endpoint for memory check
      const response = await fetch('/api/diagnostics/memory-status');
      
      if (!response.ok) {
        throw new Error(`Failed to check memory status: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Memory status result:', result);
      
      alert(
        `Memory Database Status:\n\n` +
        `Total Memories: ${result.counts.total}\n` +
        `By Type:\n${Object.entries(result.counts.byType)
          .map(([type, count]) => `- ${type}: ${count}`)
          .join('\n')}\n\n` +
        `Collections: ${result.collections.join(', ')}\n` +
        `Vector Size: ${result.vectorSize}`
      );
    } catch (error) {
      console.error('Error checking memory status:', error);
      alert(`Error checking memory status: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsChecking(false);
    }
  };

  const performHybridSearch = async (query: string) => {
    if (!query.trim()) {
      clearSearch();
      return;
    }
    
    // Convert selected types to MemoryType enum values where possible
    const typesForSearch = selectedTypes.map(type => {
      // Check if this string is a valid MemoryType enum value
      if (Object.values(MemoryType).includes(type as any)) {
        return type as MemoryType;
      }
      return null;
    }).filter(Boolean) as MemoryType[];
    
    // Build filter object
    const filter: any = {};
    
    // Add type filter if we have types
    if (typesForSearch.length > 0) {
      filter.types = typesForSearch;
    }
    
    // Add tag filter if we have one
    if (selectedTagFilter) {
      filter.tags = [selectedTagFilter];
    }
    
    // Use the hybridSearch function from the hook
    await hybridSearch({
      query,
      filter,
      limit: 50,
      hybridRatio: 0.7 // 70% vector, 30% keyword
    });
  };

  // Handle search form submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performHybridSearch(searchQuery);
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setSearchQuery(newQuery);
    
    // Clear search results if the query is empty
    if (!newQuery.trim()) {
      clearSearch();
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header with refresh button */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          Memory System
          <span className="text-sm font-normal text-gray-500">
            ({memoryCount} items)
          </span>
        </h2>
        
        <div className="flex gap-2">
          <button 
            className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300"
            onClick={handleRefresh}
            disabled={isLoadingMemories}
          >
            {isLoadingMemories ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Refresh
          </button>
          
          <button
            className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300"
            onClick={handleDebugClick}
          >
            <Bug size={14} />
            Debug
          </button>
          
          <button 
            className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300"
            onClick={checkAllMemoryTypes}
            disabled={isChecking}
          >
            {isChecking ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Settings size={14} />
            )}
            Status
          </button>
        </div>
      </div>
      
      {/* Search and filters */}
      <div className="space-y-4">
        {/* Search form */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-grow">
              <input
                type="text"
                value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search memories..."
              className="w-full px-3 py-2 border rounded-md pl-9"
              />
            <div className="absolute left-3 top-2.5 text-gray-400">
              <Search size={16} />
            </div>
            </div>
            
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center gap-2"
            disabled={isSearching}
          >
            {isSearching ? <Loader2 size={16} className="animate-spin" /> : 'Search'}
          </button>
        </form>
        
        {/* Filters section */}
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <div className="flex items-center gap-1 text-gray-500">
            <Filter size={14} />
            <span className="text-sm">Filters:</span>
            </div>
            
          {/* Type filter */}
          <div className="relative" ref={typeMenuRef}>
              <button
              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300"
                onClick={() => setTypeMenuOpen(!typeMenuOpen)}
            >
              Type ({selectedTypes.length || 'All'})
              <ChevronDown size={14} />
              </button>
              
              {typeMenuOpen && (
              <div className="absolute z-10 mt-1 bg-white border rounded-md shadow-lg p-2 max-h-60 overflow-y-auto w-64">
                <div className="space-y-1">
                    {MEMORY_TYPES.map(type => (
                      <div 
                        key={type} 
                      className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 rounded cursor-pointer"
                        onClick={() => toggleTypeSelection(type)}
                      >
                        <input 
                          type="checkbox" 
                          checked={selectedTypes.includes(type)} 
                          onChange={() => {}} 
                        className="h-4 w-4"
                        />
                      <span className="text-sm">{type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          
          {/* Tag filter */}
          {allTags.length > 0 && (
            <div className="relative">
              <select
                value={selectedTagFilter}
                onChange={(e) => setSelectedTagFilter(e.target.value)}
                className="text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 cursor-pointer"
              >
                <option value="">Tag (All)</option>
                {allTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>
          )}
            
            {/* Clear filters button */}
          {(selectedTypes.length > 0 || selectedTagFilter || searchQuery) && (
              <button 
              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-100 hover:bg-red-200 text-red-700"
                onClick={clearFilters}
              >
              <X size={14} />
              Clear Filters
              </button>
            )}
        </div>
        
        {/* Show type counts for the current memories */}
        {displayMemoryTypeCounts(allMemories)}
      </div>
      
      {/* Debug panel */}
      {showDebug && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 my-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium flex items-center gap-2">
              <AlertCircleIcon size={16} className="text-yellow-500" />
              Debug Tools
            </h3>
            <button
              className="text-gray-500 hover:text-gray-700"
              onClick={toggleDebug}
            >
              <X size={16} />
            </button>
          </div>
          
          <div className="space-y-2">
            <button
              className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 flex items-center gap-2"
              onClick={checkIncorrectReflections}
              disabled={isChecking}
            >
              {isChecking ? <Loader2 size={14} className="animate-spin" /> : 'Check Memories'}
            </button>
            
            {debugResult && (
              <div className="mt-2 space-y-2">
                <div className="text-sm">
                  <strong>Status:</strong> {debugResult.status}
                </div>
                <div className="text-sm">
                  <strong>Message:</strong> {debugResult.message}
                </div>
                <div className="text-sm">
                  <strong>Total Messages:</strong> {debugResult.totalMessages}
                </div>
                <div className="text-sm">
                  <strong>Suspected Issues:</strong> {debugResult.suspectedReflectionCount}
                </div>
          
          {debugResult.suspectedMessages && debugResult.suspectedMessages.length > 0 && (
            <div className="mt-2">
                    <h4 className="font-medium text-sm mb-1">Suspicious Messages:</h4>
                    <ul className="space-y-2">
                      {debugResult.suspectedMessages.map((msg) => (
                        <li key={msg.id} className="bg-white p-2 rounded border text-sm">
                          <div><strong>ID:</strong> {msg.id}</div>
                          <div><strong>Date:</strong> {new Date(msg.timestamp).toLocaleString()}</div>
                          <div className="mt-1 text-xs bg-gray-50 p-1 rounded whitespace-pre-wrap">{msg.text}</div>
                  </li>
                ))}
                    </ul>
                  </div>
                )}
                
                {debugResult.error && (
                  <div className="text-red-500 text-sm">
                    <strong>Error:</strong> {debugResult.error}
                  </div>
                )}
            </div>
          )}
          </div>
        </div>
      )}
      
      {/* Loading indicator */}
      {isLoadingMemories && (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      )}
      
      {/* Memories list */}
      {!isLoadingMemories && filteredMemories.length === 0 && (
        <div className="text-center py-10 text-gray-500">
          No memories found
          {(selectedTypes.length > 0 || selectedTagFilter || searchQuery) && (
            <>
              <br />
              <span className="text-sm">Try adjusting your filters</span>
            </>
          )}
        </div>
      )}
      
        <div className="space-y-4">
        {filteredMemories.map((memory) => (
              <MemoryItemComponent
            key={memory.id}
                memory={memory}
                onTagUpdate={handleTagUpdate}
                onTagSuggestionRemove={handleTagRejection}
              />
              ))}
            </div>
    </div>
  );
};

export default MemoryTab; 