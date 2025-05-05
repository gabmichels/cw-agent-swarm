'use client';

import { useState, useEffect, useCallback } from 'react';
import useMemory from '../../hooks/useMemory';
import { MemoryType } from '../../server/memory/config';

// Define the memory interface to properly type the memories
interface Memory {
  id: string;
  type: string;
  content?: string; // Content might be in different fields depending on the memory type
  text?: string;    // Some memories use text instead of content
  payload?: {
    text?: string;
    content?: string;
    type?: string;
    timestamp?: string;
  };
  timestamp: string;
  metadata?: Record<string, unknown>;
  vector?: number[];
  [key: string]: unknown;
}

export default function MemoryDebugPage() {
  const { memories, isLoading, error, getMemories, searchMemories } = useMemory();
  const [searchQuery, setSearchQuery] = useState('');
  const [debugOutput, setDebugOutput] = useState<string[]>([]);
  
  // Log function to add to debug output
  const log = (message: string) => {
    setDebugOutput(prev => [...prev, `[${new Date().toISOString()}] ${message}`]);
  };
  
  // Function to check API health
  const checkApiEndpoints = useCallback(async () => {
    log('Checking memory API endpoints...');
    
    // Check memory-test API
    try {
      const memoryTestResponse = await fetch('/api/memory-test');
      
      if (memoryTestResponse.ok) {
        const data = await memoryTestResponse.json();
        log(`✅ /api/memory-test endpoint is working, found ${data.memories?.length || 0} memories`);
      } else {
        log(`❌ /api/memory-test endpoint returned ${memoryTestResponse.status}: ${memoryTestResponse.statusText}`);
      }
    } catch (error) {
      log(`❌ Error accessing /api/memory-test: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Check memory API
    try {
      const memoryResponse = await fetch('/api/memory');
      
      if (memoryResponse.ok) {
        const data = await memoryResponse.json();
        log(`✅ /api/memory endpoint is working, found ${data.memories?.length || 0} memories`);
      } else {
        log(`❌ /api/memory endpoint returned ${memoryResponse.status}: ${memoryResponse.statusText}`);
      }
    } catch (error) {
      log(`❌ Error accessing /api/memory: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Check memory-check API
    try {
      const healthCheckResponse = await fetch('/api/memory-check');
      
      if (healthCheckResponse.ok) {
        const data = await healthCheckResponse.json();
        log(`✅ /api/memory-check reports status: ${data.status}`);
        
        // Show service availability
        if (data.checks) {
          Object.entries(data.checks).forEach(([service, available]) => {
            log(`  - ${service}: ${available ? '✅' : '❌'}`);
          });
        }
      } else {
        log(`❌ /api/memory-check returned ${healthCheckResponse.status}: ${healthCheckResponse.statusText}`);
      }
    } catch (error) {
      log(`❌ Error accessing /api/memory-check: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [log]);
  
  // Helper function to extract content from different memory formats
  const getMemoryContent = (memory: Memory): string => {
    if (memory.content) return memory.content;
    if (memory.text) return memory.text;
    if (memory.payload?.text) return memory.payload.text;
    if (memory.payload?.content) return memory.payload.content;
    return '[No content available]';
  };
  
  // Helper function to get timestamp safely
  const getMemoryTimestamp = (memory: Memory): Date => {
    try {
      const timestamp = memory.timestamp || memory.payload?.timestamp || '';
      return new Date(timestamp);
    } catch (e) {
      return new Date(); // Return current date as fallback
    }
  };
  
  // Fetch memories on page load
  useEffect(() => {
    const fetchData = async () => {
      log('Initializing memory debug page...');
      
      // Check API endpoints first
      await checkApiEndpoints();
      
      // Then fetch memories
      log('Fetching all memories...');
      try {
        const result = await getMemories({ limit: 20 });
        log(`Successfully fetched ${result.length} memories`);
      } catch (err) {
        log(`Error fetching memories: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    
    fetchData();
  }, [getMemories, checkApiEndpoints]);
  
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
      
      {/* API Checks */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">API Health Check</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          <button 
            onClick={checkApiEndpoints}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            title="Check the status of the memory API endpoints"
          >
            Run API Checks
          </button>
          
          <button 
            onClick={async () => {
              log('Resetting memory collections...');
              try {
                const response = await fetch('/api/memory/reset-collection', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ 
                    collection: 'all',
                    verify: true 
                  }),
                });
                
                if (response.ok) {
                  const data = await response.json();
                  log(`✅ Memory collections reset with status: ${data.status}`);
                  
                  // Log collection reset results
                  if (data.results) {
                    Object.entries(data.results).forEach(([collection, result]) => {
                      const collectionResult = result as any;
                      log(`  - ${collection}: ${collectionResult.success ? '✅' : '❌'} (${collectionResult.deletedCount || 0} items deleted)`);
                    });
                  }
                  
                  // Refresh memories display
                  getMemories({ limit: 20 });
                } else {
                  const errorData = await response.json();
                  log(`❌ Failed to reset memory collections: ${errorData.error || response.statusText}`);
                }
              } catch (error) {
                log(`❌ Error resetting memory collections: ${error instanceof Error ? error.message : String(error)}`);
              }
            }}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            title="Delete all memories from the database and recreate empty collections"
          >
            Reset Memory Collections
          </button>
          
          <button 
            onClick={async () => {
              log('Resetting memory schema...');
              try {
                const response = await fetch('/api/memory/reset-schema');
                
                if (response.ok) {
                  const data = await response.json();
                  log(`✅ Memory schema reset with status: ${data.success ? 'success' : 'failed'}`);
                  log(`  Message: ${data.message}`);
                  
                  if (data.testRecordId) {
                    log(`  Test record created with ID: ${data.testRecordId}`);
                  }
                  
                  // Refresh memories display
                  getMemories({ limit: 20 });
                } else {
                  const errorData = await response.json();
                  log(`❌ Failed to reset memory schema: ${errorData.message || response.statusText}`);
                }
              } catch (error) {
                log(`❌ Error resetting memory schema: ${error instanceof Error ? error.message : String(error)}`);
              }
            }}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
            title="Reinitialize the memory system schema and create a test record"
          >
            Reset Memory Schema
          </button>
        </div>
      </div>
      
      {/* Status Display */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Memory Status</h2>
        <div className="p-4 bg-gray-100 rounded">
          <p><strong>Loading:</strong> {isLoading ? 'Yes' : 'No'}</p>
          <p><strong>Error:</strong> {error ? error.message : 'None'}</p>
          <p><strong>Memory Count:</strong> {memories.length}</p>
        </div>
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
      
      {/* Memory List */}
      <div>
        <h2 className="text-xl font-semibold mb-2">Memory List</h2>
        {isLoading ? (
          <p>Loading memories...</p>
        ) : memories.length > 0 ? (
          <div className="grid gap-4">
            {memories.map((memory, index) => {
              // Cast the memory to the proper type
              const typedMemory = memory as unknown as Memory;
              return (
                <div key={typedMemory.id || `memory-${index}`} className="p-4 border rounded">
                  <p><strong>ID:</strong> {typedMemory.id || '[No ID]'}</p>
                  <p><strong>Type:</strong> {typedMemory.type || typedMemory.payload?.type || '[Unknown Type]'}</p>
                  <p><strong>Content:</strong> {getMemoryContent(typedMemory)}</p>
                  <p><strong>Created:</strong> {getMemoryTimestamp(typedMemory).toLocaleString()}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <p>No memories found.</p>
        )}
      </div>
    </div>
  );
} 