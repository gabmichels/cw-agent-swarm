'use client';

import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';

// Import only types, not implementation
import type { ThinkingVisualization } from '@/services/thinking/visualization/types';
import type { VisualizationNodeType, VisualizationEdgeType } from '@/services/thinking/visualization/types';

// Dynamically import components with no SSR to avoid node:events errors
const VisualizationRenderer = dynamic(
  () => import('@/components/VisualizationRenderer'),
  { ssr: false }
);

// Create a mock visualization for the browser
const createMockVisualization = (chatId?: string, messageId?: string): ThinkingVisualization => {
  // These are proper string literals that match the enum values in the types
  const NODE_TYPE_START = 'start' as VisualizationNodeType;
  const NODE_TYPE_THINKING = 'thinking' as VisualizationNodeType;
  const NODE_TYPE_RESPONSE = 'response_generation' as VisualizationNodeType;
  const EDGE_TYPE_FLOW = 'flow' as VisualizationEdgeType;

  return {
    id: 'mock-visualization',
    requestId: messageId || 'mock-request',
    userId: 'user-123',
    agentId: 'agent-default',
    chatId: chatId || 'chat-mock',
    messageId: messageId || 'msg-mock',
    message: 'Sample visualization (browser compatible)',
    timestamp: Date.now(),
    nodes: [
      {
        id: 'node-1',
        type: NODE_TYPE_START,
        label: 'Start',
        status: 'completed',
        data: { message: 'Sample query' },
        metrics: { startTime: Date.now(), endTime: Date.now() + 100, duration: 100 }
      },
      {
        id: 'node-2',
        type: NODE_TYPE_THINKING,
        label: 'Thinking',
        status: 'completed',
        data: { content: 'Sample thinking process' },
        metrics: { startTime: Date.now() + 110, endTime: Date.now() + 500, duration: 390 }
      },
      {
        id: 'node-3',
        type: NODE_TYPE_RESPONSE,
        label: 'Response',
        status: 'completed',
        data: { content: 'Sample response' },
        metrics: { startTime: Date.now() + 510, endTime: Date.now() + 800, duration: 290 }
      }
    ],
    edges: [
      { id: 'edge-1', source: 'node-1', target: 'node-2', type: EDGE_TYPE_FLOW },
      { id: 'edge-2', source: 'node-2', target: 'node-3', type: EDGE_TYPE_FLOW }
    ],
    metrics: {
      totalDuration: 800,
      startTime: Date.now(),
      endTime: Date.now() + 800
    }
  };
};

// Import IntegrationService dynamically only if in server environment
const useBrowserSafeIntegrationService = (chatId?: string, messageId?: string) => {
  const [visualizations, setVisualizations] = useState<ThinkingVisualization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasServerError, setHasServerError] = useState(false);
  const [showExampleViz, setShowExampleViz] = useState(false);
  
  useEffect(() => {
    const loadVisualizations = async () => {
      try {
        setLoading(true);
        setError(null);
        setHasServerError(false);
        
        if (chatId) {
          // Attempt to fetch real visualizations from the API
          const url = new URL('/api/thinking/visualizations', window.location.origin);
          url.searchParams.append('chatId', chatId);
          if (messageId) {
            url.searchParams.append('messageId', messageId);
          }
          
          try {
            const response = await fetch(url.toString());
            
            // Check if there was a server error but the request itself was "successful"
            if (response.ok) {
              const data = await response.json();
              // Check for server-side errors that might be in the response
              if (data.error) {
                console.warn("Server reported error:", data.error);
                setHasServerError(true);
                
                // Format a detailed error message if available
                let errorDetails = data.error;
                if (data.details) {
                  errorDetails += `: ${data.details}`;
                }
                if (data.message && data.message !== data.details) {
                  errorDetails += ` (${data.message})`;
                }
                
                setError(errorDetails);
                
                // If the server indicates this is a fallback situation, automatically show the example
                if (data.fallback) {
                  setShowExampleViz(true);
                }
                
                setVisualizations([]);
                setLoading(false);
                return;
              }
              
              if (data.visualizations && Array.isArray(data.visualizations) && data.visualizations.length > 0) {
                setVisualizations(data.visualizations);
                setLoading(false);
                return;
              }
            } else {
              // Handle HTTP error responses
              setHasServerError(true);
              throw new Error(`Failed to fetch visualizations: ${response.statusText}`);
            }
          } catch (err) {
            console.error("Error fetching visualizations:", err);
            setHasServerError(true);
            setError(err instanceof Error ? err.message : 'Failed to fetch visualizations');
          }
        }
        
        // Default to empty array if no visualizations found
        setVisualizations([]);
        setLoading(false);
      } catch (error) {
        console.error("Error loading visualizations:", error);
        setHasServerError(true);
        setError(error instanceof Error ? error.message : 'Unknown error');
        setLoading(false);
      }
    };
    
    loadVisualizations();
  }, [chatId, messageId]);
  
  return { visualizations, loading, error, hasServerError };
};

/**
 * Visualizations debug page
 * Shows all visualizations from the thinking process
 */
export default function VisualizationsPage() {
  const searchParams = useSearchParams();
  const chatId = searchParams?.get('chatId') || undefined;
  const messageId = searchParams?.get('messageId') || undefined;
  
  const { visualizations, loading, error, hasServerError } = useBrowserSafeIntegrationService(chatId, messageId);
  const [selectedVisualization, setSelectedVisualization] = useState<ThinkingVisualization | null>(null);
  const [showExampleViz, setShowExampleViz] = useState(false);

  // Sample visualization for empty states
  const exampleVisualization = useMemo(() => createMockVisualization(chatId, messageId), [chatId, messageId]);

  // Handle selecting a visualization
  const handleSelectVisualization = (visualization: ThinkingVisualization) => {
    setShowExampleViz(false);
    setSelectedVisualization(visualization);
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };
  
  // Set the first visualization as selected when data loads
  useEffect(() => {
    if (visualizations.length > 0 && !selectedVisualization) {
      setSelectedVisualization(visualizations[0]);
    }
  }, [visualizations, selectedVisualization]);
  
  // Automatically show example visualization when server error is detected
  useEffect(() => {
    if (hasServerError) {
      setShowExampleViz(true);
      setSelectedVisualization(null);
    }
  }, [hasServerError]);

  // For iframe compatibility, use a simpler layout that fills available space
  return (
    <div className="flex flex-col h-full bg-gray-900 text-white overflow-hidden">
      <div className="flex-shrink-0 p-3 border-b border-gray-800">
        <h1 className="text-xl font-bold">Thinking Process Visualizations</h1>
        {chatId && <p className="text-xs text-gray-400">Chat: {chatId}</p>}
        {hasServerError && (
          <div className="mt-2 px-3 py-2 text-xs text-amber-200 bg-amber-900/40 rounded-md">
            <div className="flex items-center">
              <span className="mr-1">⚠️</span>
              <span>Visualization server issue detected. Showing example visualization instead.</span>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar with list of visualizations */}
        <div className="w-56 border-r border-gray-800 overflow-y-auto flex-shrink-0">
          <div className="p-2">
            <h2 className="text-sm font-semibold mb-2">Requests</h2>
            {loading ? (
              <div className="text-center py-4">
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
                <p className="mt-2 text-xs text-gray-400">Loading...</p>
              </div>
            ) : error && !hasServerError ? (
              <div className="text-center py-4 text-red-400">
                <p className="text-xs">Error: {error}</p>
                <button
                  className="mt-2 text-xs px-2 py-1 bg-red-900 hover:bg-red-800 rounded"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </button>
              </div>
            ) : hasServerError || visualizations.length === 0 ? (
              <div className="py-4">
                <div className="text-center text-gray-400 mb-4">
                  <p className="text-xs">{hasServerError ? 'Server error detected' : 'No visualizations found'}</p>
                </div>
                <div 
                  className={`mb-2 p-2 rounded cursor-pointer transition-colors text-sm ${
                    (showExampleViz || hasServerError) ? 'bg-blue-900/50 border-l-2 border-blue-500' : 'hover:bg-gray-800'
                  }`}
                  onClick={() => {
                    setShowExampleViz(true);
                    setSelectedVisualization(null);
                  }}
                >
                  <div className="font-medium truncate">Example Visualization</div>
                  <div className="text-xs text-gray-400">Demo how it works</div>
                  <div className="text-xs mt-1">
                    <span className="px-1.5 py-0.5 rounded-full text-xs bg-purple-900/50 text-purple-200">
                      Example
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <ul>
                {visualizations.map(viz => (
                  <li 
                    key={viz.id}
                    className={`mb-2 p-2 rounded cursor-pointer transition-colors text-sm ${
                      selectedVisualization?.id === viz.id && !showExampleViz
                        ? 'bg-blue-900/50 border-l-2 border-blue-500'
                        : 'hover:bg-gray-800'
                    }`}
                    onClick={() => handleSelectVisualization(viz)}
                  >
                    <div className="font-medium truncate">{viz.message}</div>
                    <div className="text-xs text-gray-400">{formatTimestamp(viz.timestamp)}</div>
                    <div className="text-xs mt-1">
                      <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                        viz.metrics.totalDuration > 5000
                          ? 'bg-amber-900/50 text-amber-200'
                          : 'bg-green-900/50 text-green-200'
                      }`}>
                        {Math.round(viz.metrics.totalDuration)}ms
                      </span>
                      <span className="ml-2 text-gray-400">{viz.nodes.length} steps</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        
        {/* Main content area with visualization */}
        <div className="flex-1 overflow-y-auto bg-white">
          {(showExampleViz || hasServerError) ? (
            <div className="h-full">
              <div className={`${hasServerError ? 'bg-amber-50' : 'bg-blue-50'} p-3 text-${hasServerError ? 'amber' : 'blue'}-800 text-sm border-b border-${hasServerError ? 'amber' : 'blue'}-200`}>
                {hasServerError ? (
                  <>
                    <strong>Server Error:</strong> {error}. Showing an example visualization instead. The actual visualization data couldn&apos;t be retrieved due to a server configuration issue.
                  </>
                ) : (
                  <>
                    <strong>Example Visualization:</strong> This is a demo of how agent visualizations look. Real visualizations will appear here when the agent processes requests.
                  </>
                )}
              </div>
              <VisualizationRenderer 
                visualization={exampleVisualization}
                width={800}
                height={600}
              />
            </div>
          ) : selectedVisualization ? (
            <VisualizationRenderer 
              visualization={selectedVisualization}
              width={800}
              height={600}
            />
          ) : visualizations.length > 0 ? (
            <div className="flex h-full items-center justify-center text-gray-800">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">No Visualization Selected</h3>
                <p className="text-gray-600 text-sm">Select a request from the sidebar</p>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-gray-800">
              <div className="text-center max-w-md p-6">
                <h3 className="text-lg font-semibold mb-2">No Visualizations Found</h3>
                <p className="text-gray-600 text-sm mb-4">
                  There are no visualizations available for this chat yet. Visualizations are created when you interact with the agent.
                </p>
                <p className="text-gray-600 text-sm">
                  Try sending a new message to the agent to generate visualizations, or click &quot;Example Visualization&quot; in the sidebar to see a demo.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 