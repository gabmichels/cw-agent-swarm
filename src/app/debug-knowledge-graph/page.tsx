'use client';

import React, { useEffect, useState } from 'react';
import useMemoryGraph from '../../hooks/useMemoryGraph';
import useMemory from '../../hooks/useMemory';

export default function DebugKnowledgeGraphPage() {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const { searchMemories } = useMemory();
  const { graphData, isLoading, error } = useMemoryGraph({ 
    limit: 5,
    types: undefined // Don't filter by type
  });

    useEffect(() => {
    const testSearch = async () => {
      try {
        console.log('Debug: Testing searchMemories directly...');
        const results = await searchMemories({
          query: '',
          limit: 3
        });
        console.log('Debug: searchMemories results:', results);
        setDebugInfo({
          searchResults: results,
          searchResultsCount: results.length,
          firstResult: results[0],
          graphData: graphData,
          graphNodesCount: graphData.nodes.length,
          graphEdgesCount: graphData.edges.length,
          isLoading: isLoading,
          error: error?.message
        });
      } catch (err) {
        console.error('Debug: searchMemories error:', err);
        setDebugInfo({ error: err });
      }
    };
    
    testSearch();
  }, [searchMemories, graphData, isLoading, error]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-2xl font-bold mb-6">Knowledge Graph Debug</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Graph Hook Status</h2>
          <div className="space-y-2">
            <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
            <div>Error: {error ? error.message : 'None'}</div>
            <div>Nodes: {graphData.nodes.length}</div>
            <div>Edges: {graphData.edges.length}</div>
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Debug Info</h2>
          <pre className="text-xs overflow-auto max-h-96">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg col-span-full">
          <h2 className="text-lg font-semibold mb-4">Graph Data</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium mb-2">Nodes ({graphData.nodes.length})</h3>
              <div className="space-y-2 max-h-64 overflow-auto">
                {graphData.nodes.map((node, index) => (
                  <div key={node.id} className="bg-gray-700 p-2 rounded text-sm">
                    <div><strong>ID:</strong> {node.id}</div>
                    <div><strong>Label:</strong> {node.label}</div>
                    <div><strong>Type:</strong> {node.type}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-2">Edges ({graphData.edges.length})</h3>
              <div className="space-y-2 max-h-64 overflow-auto">
                {graphData.edges.map((edge, index) => (
                  <div key={edge.id} className="bg-gray-700 p-2 rounded text-sm">
                    <div><strong>From:</strong> {edge.source}</div>
                    <div><strong>To:</strong> {edge.target}</div>
                    <div><strong>Type:</strong> {edge.type}</div>
                    <div><strong>Weight:</strong> {edge.weight}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}