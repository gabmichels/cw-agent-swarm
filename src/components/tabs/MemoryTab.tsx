import React, { useState, useMemo, useEffect } from 'react';
import { MemoryItem } from '../../types';
import { AlertCircleIcon, Filter, X, Tag, Info, RefreshCw } from 'lucide-react';

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
  allMemories: MemoryItem[];
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
  const [searchQuery, setSearchQuery] = useState('');
  const [memoryCount, setMemoryCount] = useState<number>(0);

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

  // Filter memories based on selected tag and search query
  const filteredMemories = useMemo(() => {
    if (!allMemories || !Array.isArray(allMemories)) {
      console.warn('MemoryTab: allMemories is not an array:', allMemories);
      return [];
    }
    
    return allMemories.filter(memory => {
      // Skip null or undefined memories
      if (!memory) return false;
      
      // Filter by tag if one is selected
      const matchesTag = !selectedTagFilter || 
        (memory.tags && Array.isArray(memory.tags) && memory.tags.includes(selectedTagFilter));
      
      // Filter by search query if provided
      const matchesSearch = !searchQuery || 
        (memory.content && typeof memory.content === 'string' && 
         memory.content.toLowerCase().includes(searchQuery.toLowerCase()));
      
      return matchesTag && matchesSearch;
    });
  }, [allMemories, selectedTagFilter, searchQuery]);

  const checkIncorrectReflections = async () => {
    setIsChecking(true);
    try {
      const res = await fetch('/api/cleanup-messages');
      const data = await res.json();
      setDebugResult(data);
      console.log('Found incorrect reflections:', data);
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
    setSearchQuery('');
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Memory Explorer</h2>
        
        <div className="flex space-x-2">
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
            
            {/* Clear filters button */}
            {(selectedTagFilter || searchQuery) && (
              <button 
                onClick={clearFilters}
                className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1.5 rounded-md flex items-center text-sm"
              >
                <X className="h-4 w-4 mr-1" /> Clear
              </button>
            )}
          </div>
        </div>
        
        {/* Display active filters */}
        {(selectedTagFilter || searchQuery) && (
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
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Content</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Category</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Tags</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {filteredMemories.map((memory, index) => (
                <tr key={memory.id || index} className="hover:bg-gray-750">
                  <td className="px-4 py-3 whitespace-normal text-sm max-w-xs overflow-hidden">
                    {memory.content || 'No content'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-800 text-blue-100">
                      {memory.category || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-normal text-sm">
                    {memory.tags && memory.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {memory.tags.map((tag, tagIndex) => (
                          <span 
                            key={`${tag}-${tagIndex}`}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-200 hover:bg-blue-700 hover:text-white cursor-pointer"
                            onClick={() => setSelectedTagFilter(tag)}
                            title={`Filter by ${tag}`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-500">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {memory.created ? new Date(memory.created).toLocaleString() : 'Unknown'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MemoryTab; 