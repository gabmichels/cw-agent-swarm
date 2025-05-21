'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';

// Import only types, not implementation
import type { ThinkingVisualization } from '@/services/thinking/visualization';
import type { VisualizationNodeType, VisualizationEdgeType } from '@/services/thinking/visualization';

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
  
  useEffect(() => {
    const loadVisualizations = async () => {
      try {
        setLoading(true);
        
        // Create a mock visualization for browser environment
        const mockViz = createMockVisualization(chatId, messageId);
        setVisualizations([mockViz]);
        
        setLoading(false);
      } catch (error) {
        console.error("Error loading visualizations:", error);
        setLoading(false);
      }
    };
    
    loadVisualizations();
  }, [chatId, messageId]);
  
  return { visualizations, loading };
};

/**
 * Visualizations debug page
 * Shows all visualizations from the thinking process
 */
export default function VisualizationsPage() {
  const searchParams = useSearchParams();
  const chatId = searchParams?.get('chatId') || undefined;
  const messageId = searchParams?.get('messageId') || undefined;
  
  const { visualizations, loading } = useBrowserSafeIntegrationService(chatId, messageId);
  const [selectedVisualization, setSelectedVisualization] = useState<ThinkingVisualization | null>(null);

  // Handle selecting a visualization
  const handleSelectVisualization = (visualization: ThinkingVisualization) => {
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

  // For iframe compatibility, use a simpler layout that fills available space
  return (
    <div className="flex flex-col h-full bg-gray-900 text-white overflow-hidden">
      <div className="flex-shrink-0 p-3 border-b border-gray-800">
        <h1 className="text-xl font-bold">Thinking Process Visualizations</h1>
        {chatId && <p className="text-xs text-gray-400">Chat: {chatId}</p>}
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
            ) : visualizations.length > 0 ? (
              <ul>
                {visualizations.map(viz => (
                  <li 
                    key={viz.id}
                    className={`mb-2 p-2 rounded cursor-pointer transition-colors text-sm ${
                      selectedVisualization?.id === viz.id
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
            ) : (
              <div className="text-center py-4 text-gray-400">
                <p className="text-xs">No visualizations found</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Main content area with visualization */}
        <div className="flex-1 overflow-y-auto bg-white">
          {selectedVisualization ? (
            <VisualizationRenderer 
              visualization={selectedVisualization}
              width={800}
              height={600}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-800">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">No Visualization Selected</h3>
                <p className="text-gray-600 text-sm">Select a request from the sidebar</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 