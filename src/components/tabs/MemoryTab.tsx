import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AlertCircleIcon, Filter, X, Tag, Info, RefreshCw, ChevronDown, Loader2, Search, Hash, Settings, Menu, Bug } from 'lucide-react';
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

// Extend MemoryItem type to include metadata
interface ExtendedMemoryItem extends MemoryItem {
  kind?: string;
  metadata?: Record<string, any>;
  isMemoryEdit?: boolean;
}

// Interface for MemoryTab component props
interface MemoryTabProps {
  isLoadingMemories: boolean;
  allMemories: ExtendedMemoryItem[];
  onRefresh?: () => void;
}

const MemoryTab: React.FC<MemoryTabProps> = ({
  isLoadingMemories,
  allMemories,
  onRefresh
}) => {
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

  // All possible memory types
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
    "knowledge",
    "document",
    "memory_edits",
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

  // All possible memory types
  const memoryTypes = useMemo(() => {
    const typeSet = new Set<string>();
    if (allMemories && Array.isArray(allMemories)) {
      allMemories.forEach(memory => {
        if (memory.kind) typeSet.add(memory.kind);
        if (memory.metadata?.type) typeSet.add(memory.metadata.type);
        if (memory.category) typeSet.add(memory.category);
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
        type: m.kind || m.metadata?.type || m.category || 'unknown',
        contentPreview: m.content ? m.content.substring(0, 30) + '...' : 'No content',
        timestamp: m.created || m.timestamp
      })) : [],
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
    
    console.log(`Starting with ${allMemories.length} total memories`);
    
    // Count and log each memory type to diagnose the issue
    const typeCount: Record<string, number> = {};
    allMemories.forEach(memory => {
      const type = memory.kind || 
                  memory.metadata?.type || 
                  memory.category || 
                  (memory as any).type || 
                  'unknown';
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    console.log('Memory types in allMemories:', typeCount);
    
    // Optional: Log memory_edit records for debugging
    const memoryEdits = allMemories.filter(memory => memory.isMemoryEdit || memory.metadata?.isMemoryEdit);
    if (memoryEdits.length > 0) {
      console.log(`Found ${memoryEdits.length} memory_edit records`);
    }
    
    // First, filter out memory_edit records - we'll display these as versions of their originals
    // But keep them if explicitly showing memory_edits type
    let filtered = selectedTypes.includes('memory_edits')
      ? allMemories 
      : allMemories.filter(memory => !(memory.isMemoryEdit || memory.metadata?.isMemoryEdit));
    
    // Apply text search filter if any
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(memory => 
        memory.content && memory.content.toLowerCase().includes(query)
      );
    }
    
    // Apply tag filter if selected
    if (selectedTagFilter) {
      filtered = filtered.filter(memory => {
        const tags = memory.tags || [];
        return tags.includes(selectedTagFilter);
      });
    }
    
    // Apply memory type filter if any are selected
    if (selectedTypes.length > 0) {
      filtered = filtered.filter(memory => {
        const memoryType = memory.kind || 
                memory.metadata?.type || 
                memory.category || 
                (memory as any).type || 
                'unknown';
                
        return selectedTypes.includes(memoryType);
      });
    }
    
    // Log final filtered memories count by type
    const filteredTypeCount: Record<string, number> = {};
    filtered.forEach(memory => {
      const type = memory.kind || 
                  memory.metadata?.type || 
                  memory.category || 
                  (memory as any).type || 
                  'unknown';
      filteredTypeCount[type] = (filteredTypeCount[type] || 0) + 1;
    });
    console.log('Filtered memory types:', filteredTypeCount);
    
    return filtered;
  }, [allMemories, searchQuery, selectedTagFilter, selectedTypes]);

  // Add a new effect to log filtered memories when they change
  useEffect(() => {
    console.log('MemoryTab: filteredMemories updated', {
      count: filteredMemories?.length || 0,
      sample: filteredMemories && filteredMemories.length > 0 ? filteredMemories[0]?.id : null,
    });
  }, [filteredMemories]);

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

  // Handle refresh button click
  const handleRefresh = () => {
    console.log('Manually refreshing memories');
    onRefresh?.();
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

  // Add a debug function to show raw memory data
  const toggleDebug = () => setShowDebug(!showDebug);

  // Add this new function to display type distributions
  const displayMemoryTypeCounts = (memories: ExtendedMemoryItem[] | null | undefined) => {
    if (!memories || memories.length === 0) {
      console.log('No memories to analyze');
      return {};
    }
    
    // Count each memory type 
    const typeCount: Record<string, number> = {};
    memories.forEach(memory => {
      // Skip null/undefined items
      if (!memory) {
        console.warn('Found null or undefined memory item in memories array');
        return;
      }
      
      // Try to get memory type from all possible locations
      const type = memory.kind || 
                  memory.metadata?.type || 
                  memory.category || 
                  (memory as any).type || 
                  'unknown';
      
      // Log problematic memory records for debugging
      if (type === 'unknown') {
        console.warn('Found memory with unknown type:', memory);
      }
      
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    
    console.log('Memory Type Distribution:', typeCount);
    return typeCount;
  };

  // Add this inside the MemoryTab component
  const handleDebugClick = () => {
    console.log('Memory Debug Information:');
    console.log(`Total allMemories count: ${allMemories?.length || 0}`);
    console.log(`Filtered memories count: ${filteredMemories?.length || 0}`);
    
    // Check if allMemories is an array
    if (!Array.isArray(allMemories)) {
      console.error('allMemories is not an array:', typeof allMemories, allMemories);
    } else if (allMemories.length === 0) {
      console.warn('allMemories array is empty');
    } else {
      // Log sample record structure
      console.log('Sample memory record format:', allMemories[0]);
    }
    
    const typeCounts = displayMemoryTypeCounts(allMemories);
    const filteredTypeCounts = displayMemoryTypeCounts(filteredMemories);
    
    console.log('All Memories Type Distribution:', typeCounts);
    console.log('Filtered Memories Type Distribution:', filteredTypeCounts);
    
    // Display the first few memories for inspection
    console.log('Sample of All Memories:', allMemories?.slice(0, 3));
    
    // Set debug state to display on UI
    setShowDebug(!showDebug);
  };

  // Add new function to diagnose memory types across all collections
  const checkAllMemoryTypes = async () => {
    setIsChecking(true);
    
    try {
      console.log('Running detailed memory type analysis...');
      const response = await fetch('/api/memory/debug-memory-types');
      
      if (response.ok) {
        const data = await response.json();
        console.log('Memory type analysis results:', data);
        
        // Display results in debug panel
        setDebugResult({
          status: 'success',
          message: `Found ${data.totalMemories} total memories across all collections`,
          totalMessages: data.totalMemories,
          suspectedReflectionCount: data.allMemories?.count || 0,
          suspectedMessages: [] // Not using this field
        });
        
        // Show the debug panel
        setShowDebug(true);
      } else {
        console.error('Error checking memory types:', await response.text());
        setDebugResult({
          status: 'error',
          message: 'Failed to analyze memory types',
          totalMessages: 0,
          suspectedReflectionCount: 0,
          suspectedMessages: []
        });
      }
    } catch (error) {
      console.error('Error in memory type analysis:', error);
      setDebugResult({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        totalMessages: 0,
        suspectedReflectionCount: 0,
        suspectedMessages: []
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Memory ({filteredMemories?.length || 0} of {memoryCount})</h2>
        <div className="flex space-x-2">
          {/* Memory Type Analysis Button */}
          <button 
            onClick={checkAllMemoryTypes}
            className="p-1 hover:bg-gray-700 rounded-md"
            title="Check All Memory Types"
          >
            <AlertCircleIcon className="h-5 w-5 text-gray-300" />
          </button>
          
          {/* Debug button */}
          <button 
            onClick={handleDebugClick}
            className="p-1 hover:bg-gray-700 rounded-md"
            title="Debug Memory Information"
          >
            <Bug className="h-5 w-5 text-gray-300" />
          </button>

          {/* Refresh button */}
          <button 
            onClick={handleRefresh}
            className="p-1 hover:bg-gray-700 rounded-md flex items-center"
            title="Refresh memories"
            disabled={isLoadingMemories}
          >
            {isLoadingMemories ? (
              <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
            ) : (
              <RefreshCw className="h-5 w-5 text-gray-300" />
            )}
          </button>
          
          {/* Settings/Debug button */}
          <button 
            onClick={() => setShowDebug(!showDebug)}
            className={`p-1 hover:bg-gray-700 rounded-md ${showDebug ? 'bg-gray-700' : ''}`}
            title={showDebug ? "Hide debug info" : "Show debug info"}
          >
            <Settings className={`h-5 w-5 ${showDebug ? 'text-blue-400' : 'text-gray-300'}`} />
          </button>
        </div>
      </div>
      
      {/* Memory count indicator */}
      <div className="mb-2 text-sm flex items-center text-gray-400">
        <Info className="h-4 w-4 mr-1" />
        <span>Total memories: {memoryCount}</span>
      </div>
      
      {/* Debug output */}
      {showDebug && (
        <div className="mb-4 p-3 bg-gray-900 rounded-md text-xs overflow-auto max-h-40">
          <h3 className="text-sm font-bold mb-2">Raw Memory Data (First 3)</h3>
          <pre className="text-gray-300">
            {JSON.stringify(allMemories?.slice(0, 3), null, 2)}
          </pre>
          <p className="mt-2 text-gray-400">Total Raw Memory Count: {allMemories?.length || 0}</p>
          <p className="text-gray-400">Filtered Memory Count: {filteredMemories?.length || 0}</p>
        </div>
      )}
      
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
            <div 
              key={memory.id || index} 
              className="relative"
            >
              <MemoryItemComponent
                memory={memory}
                onTagUpdate={handleTagUpdate}
                onTagSuggestionRemove={handleTagRejection}
              />
              
              {/* Add debug info button when debug mode is on */}
              {showDebug && (
                <div className="mt-1 text-xs text-gray-400 flex items-center">
                  <div className="flex-1">
                    <span className="mr-2">ID: {memory.id?.substring(0, 8)}</span>
                    <span className="mr-2">Type: {memory.kind || memory.metadata?.type || memory.category || ('type' in memory ? memory.type as string : 'unknown')}</span>
                    {memory.timestamp && <span>Date: {new Date(memory.timestamp).toLocaleString()}</span>}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowRawMemory(JSON.stringify(memory));
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    View Raw Data
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Display raw memory data in debug mode */}
      {showDebug && showRawMemory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4">
          <div className="bg-gray-800 rounded-lg p-4 max-w-4xl max-h-[90vh] overflow-auto w-full">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold">Raw Memory Data</h3>
              <button 
                onClick={() => setShowRawMemory(null)}
                className="text-gray-300 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <pre className="text-xs text-gray-300 overflow-auto">
              {JSON.stringify(JSON.parse(showRawMemory), null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Add debug information display */}
      {showDebug && (
        <div className="mt-4 p-4 bg-gray-800 border border-gray-600 rounded-md">
          <h3 className="text-lg font-medium text-gray-200 mb-2">Debug Information</h3>
          <p className="text-gray-300">Total Memories: {allMemories?.length || 0}</p>
          <p className="text-gray-300">Filtered Memories: {filteredMemories?.length || 0}</p>
          
          <div className="mt-2">
            <h4 className="text-md font-medium text-gray-300">Memory Type Distribution:</h4>
            <div className="grid grid-cols-2 gap-1 mt-1">
              {Object.entries(displayMemoryTypeCounts(allMemories)).map(([type, count]) => (
                <div key={type} className="flex justify-between px-2 py-1 bg-gray-700 rounded">
                  <span className="text-gray-300">{type}:</span>
                  <span className="text-gray-300 font-mono">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemoryTab; 