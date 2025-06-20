'use client';

import React, { useState, useEffect, useCallback } from 'react';
import MemoryGraphVisualization from './MemoryGraphVisualization';
import { MemoryType } from '../../server/memory/config';
import { NodeType } from '../../hooks/useMemoryGraph';

const KnowledgeGraphPage: React.FC = () => {
  const [selectedTypes, setSelectedTypes] = useState<MemoryType[]>([
    MemoryType.MESSAGE,
    MemoryType.DOCUMENT,
    MemoryType.THOUGHT
  ]);
  const [selectedRootId, setSelectedRootId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [depth, setDepth] = useState<number>(2);
  const [limit, setLimit] = useState<number>(50); // Node limit control
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [graphStats, setGraphStats] = useState<{ nodes: number; edges: number }>({ nodes: 0, edges: 0 });
  const [isGraphLoading, setIsGraphLoading] = useState(false);

  // Handle type selection
  const toggleType = (type: MemoryType) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter(t => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  // Search for memories to use as root nodes
  const searchMemories = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    
    try {
      const response = await fetch('/api/memory/hybrid-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: searchQuery,
          limit: 10,
          filter: selectedTypes.length > 0 
            ? { must: [{ key: 'type', match: { in: selectedTypes } }] } 
            : undefined
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      } else {
        console.error('Search failed:', response.statusText);
      }
    } catch (error) {
      console.error('Error searching memories:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle node selection
  const handleNodeSelect = useCallback((nodeData: any) => {
    setSelectedNode(nodeData);
  }, []);

  // Handle root node selection from search results
  const selectRootNode = (id: string) => {
    setSelectedRootId(id);
    setSearchResults([]);
    setSearchQuery('');
  };

  // Handle graph loading state changes
  const handleGraphLoadingChange = useCallback((loading: boolean) => {
    setIsGraphLoading(loading);
  }, []);

  // Handle graph data changes for statistics
  const handleGraphDataChange = useCallback((data: { nodes: any[]; edges: any[] }) => {
    setGraphStats({ nodes: data.nodes.length, edges: data.edges.length });
  }, []);

  return (
    <div className="bg-gray-900 p-6 rounded-lg">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Memory Relationship Graph</h1>
        
        {/* Graph Statistics */}
        <div className="flex items-center gap-4 text-sm">
          <div className="bg-gray-800 px-3 py-1 rounded">
            <span className="text-gray-400">Nodes:</span>
            <span className="ml-1 font-mono text-blue-400">{graphStats.nodes}</span>
          </div>
          <div className="bg-gray-800 px-3 py-1 rounded">
            <span className="text-gray-400">Edges:</span>
            <span className="ml-1 font-mono text-green-400">{graphStats.edges}</span>
          </div>
          {isGraphLoading && (
            <div className="text-blue-400 text-sm">
              <span className="animate-pulse">Loading graph...</span>
            </div>
          )}
        </div>
      </div>

      {/* Controls section */}
      <div className="bg-gray-800 p-4 rounded-lg mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left column - filters */}
          <div>
            <h2 className="text-lg font-medium mb-3">Filters & Limits</h2>
            
            {/* Memory type filter */}
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2">Memory Types</h3>
              <div className="flex flex-wrap gap-2">
                {Object.values(MemoryType).map(type => (
                  <button
                    key={type}
                    className={`px-3 py-1 text-sm rounded-full ${
                      selectedTypes.includes(type)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    onClick={() => toggleType(type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Node limit control */}
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2">
                Node Limit: {limit}
                {graphStats.nodes >= limit && (
                  <span className="ml-2 text-yellow-400 text-xs">(limit reached)</span>
                )}
              </h3>
              <input
                type="range"
                min="10"
                max="200"
                step="10"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>10</span>
                <span>50</span>
                <span>100</span>
                <span>200</span>
              </div>
            </div>
            
            {/* Depth control */}
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2">Relationship Depth: {depth}</h3>
              <input
                type="range"
                min="1"
                max="4"
                value={depth}
                onChange={(e) => setDepth(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Direct</span>
                <span>Extended</span>
              </div>
            </div>
            
            {/* Mode indicator */}
            <div className="text-sm">
              <h3 className="font-medium mb-1">Viewing Mode</h3>
              <p className="text-gray-400">
                📊 <strong>All Agent Memories</strong> - Shows memories from all agents with intelligent relationship detection
              </p>
            </div>
          </div>
          
          {/* Middle column - search for root node */}
          <div>
            <h2 className="text-lg font-medium mb-3">Focus Point</h2>
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search for a memory..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchMemories()}
                  className="flex-grow bg-gray-700 border border-gray-600 rounded px-3 py-2"
                />
                <button
                  onClick={searchMemories}
                  disabled={isSearching}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50"
                >
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
              </div>
              
              {/* Search results */}
              {searchResults.length > 0 && (
                <div className="mt-3 bg-gray-700 rounded-lg max-h-48 overflow-y-auto">
                  <ul className="divide-y divide-gray-600">
                    {searchResults.map((result) => (
                      <li 
                        key={result.point.id} 
                        className="p-2 hover:bg-gray-600 cursor-pointer"
                        onClick={() => selectRootNode(result.point.id)}
                      >
                        <div className="font-medium truncate">{result.point.payload.text.substring(0, 60)}...</div>
                        <div className="text-xs text-gray-400 flex items-center justify-between">
                          <span>{result.point.payload.type || 'unknown'}</span>
                          <span>Score: {result.score.toFixed(2)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {selectedRootId && (
              <div className="p-2 bg-gray-700 rounded text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">Selected Focus:</span>
                  <button 
                    className="text-red-400 text-xs hover:text-red-300"
                    onClick={() => setSelectedRootId('')}
                  >
                    Clear
                  </button>
                </div>
                <div className="text-gray-300 truncate">{selectedRootId}</div>
              </div>
            )}
          </div>

          {/* Right column - Performance & Tips */}
          <div>
            <h2 className="text-lg font-medium mb-3">Performance Tips</h2>
            <div className="space-y-2 text-sm text-gray-400">
              <div className="bg-gray-700 p-2 rounded">
                <div className="font-medium text-gray-300">Optimal Settings:</div>
                <ul className="mt-1 space-y-1 text-xs">
                  <li>• 20-50 nodes for fast rendering</li>
                  <li>• Depth 1-2 for focused view</li>
                  <li>• Use specific memory types</li>
                  <li>• Set a focus point for better results</li>
                </ul>
              </div>
              
              {/* Performance warnings */}
              {limit > 100 && (
                <div className="bg-yellow-900/20 border border-yellow-600 p-2 rounded text-yellow-300">
                  <div className="font-medium text-xs">⚠ High node limit</div>
                  <div className="text-xs">May impact performance</div>
                </div>
              )}
              
              {graphStats.nodes === 0 && !isGraphLoading && (
                <div className="bg-blue-900/20 border border-blue-600 p-2 rounded text-blue-300">
                  <div className="font-medium text-xs">ℹ No data loaded</div>
                  <div className="text-xs">Try adjusting filters or limits</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Graph visualization */}
      <div className="mb-6">
        <MemoryGraphVisualization
          rootId={selectedRootId || undefined}
          types={selectedTypes.length > 0 ? selectedTypes : undefined}
          depth={depth}
          limit={limit}
          className="h-[600px]"
          onNodeSelect={handleNodeSelect}
          onLoadingChange={handleGraphLoadingChange}
          onDataChange={handleGraphDataChange}
        />
      </div>

      {/* Selected node details */}
      {selectedNode && (
        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-lg font-medium mb-3">Selected Memory Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Type</h3>
              <div className="bg-gray-700 p-2 rounded">
                {selectedNode.data?.type || selectedNode.data?.point?.metadata?.type || selectedNode.type || 'unknown'}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2">Memory ID</h3>
              <div className="bg-gray-700 p-2 rounded text-xs font-mono truncate">
                {selectedNode.data?.point?.id || selectedNode.data?.id || selectedNode.id}
              </div>
            </div>
            {selectedNode.data?.point?.timestamp && (
              <div className="md:col-span-2">
                <h3 className="text-sm font-medium mb-2">Timestamp</h3>
                <div className="bg-gray-700 p-2 rounded text-sm">
                  {new Date(selectedNode.data.point.timestamp).toLocaleString()}
                </div>
              </div>
            )}
            <div className="md:col-span-2">
              <h3 className="text-sm font-medium mb-2">Full Content</h3>
              <div className="bg-gray-700 p-3 rounded max-h-60 overflow-y-auto whitespace-pre-wrap text-sm">
                {selectedNode.data?.point?.text || 
                 selectedNode.data?.text || 
                 selectedNode.data?.content || 
                 selectedNode.payload?.text || 
                 selectedNode.content || 
                 'No content available'}
              </div>
            </div>
            {(selectedNode.data?.point?.metadata || selectedNode.data?.metadata) && (
              <div className="md:col-span-2">
                <h3 className="text-sm font-medium mb-2">Metadata</h3>
                <div className="bg-gray-700 p-3 rounded max-h-60 overflow-y-auto">
                  <pre className="text-xs text-gray-300">
                    {JSON.stringify(
                      selectedNode.data?.point?.metadata || selectedNode.data?.metadata || {}, 
                      null, 
                      2
                    )}
                  </pre>
                </div>
              </div>
            )}
            {/* Node visualization info */}
            <div className="md:col-span-2 border-t border-gray-600 pt-3 mt-2">
              <h3 className="text-sm font-medium mb-2 text-gray-400">Node Visualization</h3>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-gray-400">Color:</span>
                  <div className="flex items-center gap-2 mt-1">
                    <div 
                      className="w-4 h-4 rounded" 
                      style={{ backgroundColor: selectedNode.color }}
                    ></div>
                    <span>{selectedNode.color}</span>
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Type:</span>
                  <div className="mt-1 capitalize">{selectedNode.type}</div>
                </div>
                <div>
                  <span className="text-gray-400">Label:</span>
                  <div className="mt-1 truncate">{selectedNode.label}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2 justify-end">
            <button 
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
              onClick={() => setSelectedNode(null)}
            >
              Close
            </button>
            <button 
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              onClick={() => setSelectedRootId(selectedNode.data?.point?.id || selectedNode.data?.id || selectedNode.id)}
            >
              Set as Focus
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeGraphPage; 