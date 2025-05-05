'use client';

import { useState, useEffect } from 'react';
import useMemory from '../../hooks/useMemory';
import { MemoryType } from '../../server/memory/config';

export default function MemoryDebugPage() {
  const { memories, isLoading, error, getMemories, searchMemories } = useMemory();
  const [searchQuery, setSearchQuery] = useState('');
  const [debugOutput, setDebugOutput] = useState<string[]>([]);
  
  // Log function to add to debug output
  const log = (message: string) => {
    setDebugOutput(prev => [...prev, `[${new Date().toISOString()}] ${message}`]);
  };
  
  // Fetch memories on page load
  useEffect(() => {
    const fetchData = async () => {
      log('Fetching all memories...');
      try {
        const result = await getMemories({ limit: 20 });
        log(`Successfully fetched ${result.length} memories`);
      } catch (err) {
        log(`Error fetching memories: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    
    fetchData();
  }, [getMemories]);
  
  // Handle search submit
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    log(`Searching for: "${searchQuery}"`);
    try {
      const results = await searchMemories({ 
        query: searchQuery,
        types: [MemoryType.MESSAGE, MemoryType.THOUGHT],
        limit: 10
      });
      log(`Search returned ${results.length} results`);
    } catch (err) {
      log(`Search error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Memory System Debug</h1>
      
      {/* Status Display */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Status</h2>
        <div className="p-4 bg-gray-100 rounded">
          <p><strong>Loading:</strong> {isLoading ? 'Yes' : 'No'}</p>
          <p><strong>Error:</strong> {error ? error.message : 'None'}</p>
          <p><strong>Memory Count:</strong> {memories.length}</p>
        </div>
      </div>
      
      {/* Search Form */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Search Memories</h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter search query..."
            className="flex-1 p-2 border rounded"
          />
          <button 
            type="submit" 
            className="px-4 py-2 bg-blue-500 text-white rounded"
            disabled={isLoading}
          >
            Search
          </button>
        </form>
      </div>
      
      {/* Debug Output */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Debug Log</h2>
        <div className="p-4 bg-black text-green-400 font-mono text-sm rounded max-h-60 overflow-y-auto">
          {debugOutput.length > 0 ? (
            debugOutput.map((line, i) => (
              <div key={i}>{line}</div>
            ))
          ) : (
            <div>No log entries yet...</div>
          )}
        </div>
      </div>
      
      {/* Memory List */}
      <div>
        <h2 className="text-xl font-semibold mb-2">Memory List</h2>
        {isLoading ? (
          <p>Loading memories...</p>
        ) : memories.length > 0 ? (
          <div className="grid gap-4">
            {memories.map((memory) => (
              <div key={memory.id} className="p-4 border rounded">
                <p><strong>ID:</strong> {memory.id}</p>
                <p><strong>Type:</strong> {memory.type}</p>
                <p><strong>Content:</strong> {memory.content}</p>
                <p><strong>Created:</strong> {new Date(memory.timestamp).toLocaleString()}</p>
              </div>
            ))}
          </div>
        ) : (
          <p>No memories found.</p>
        )}
      </div>
    </div>
  );
} 