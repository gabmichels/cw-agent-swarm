'use client';

import React, { useEffect, useState } from 'react';
import { ThinkingVisualization } from '@/services/thinking/visualization';
import VisualizationRenderer from '@/components/VisualizationRenderer';
import { IntegrationService } from '@/services/thinking/IntegrationService';

/**
 * Visualizations debug page
 * Shows all visualizations from the thinking process
 */
export default function VisualizationsPage() {
  const [visualizations, setVisualizations] = useState<ThinkingVisualization[]>([]);
  const [selectedVisualization, setSelectedVisualization] = useState<ThinkingVisualization | null>(null);
  const [loading, setLoading] = useState(true);

  // Create a sample visualization service for demo purposes
  useEffect(() => {
    const integrationService = new IntegrationService({
      enableVisualization: true
    });
    
    // In a real implementation, you would fetch this from a backend
    // For now, we'll create some sample visualizations
    const loadVisualizations = async () => {
      try {
        setLoading(true);
        
        // In a real app, you'd fetch visualizations from an API
        // For now, get them from the integration service
        const allVisualizations = integrationService.getAllVisualizations();
        
        // If no visualizations exist yet, create a simulated one
        if (allVisualizations.length === 0) {
          // Demo: Create a simple request to generate a visualization
          await integrationService.processMessage(
            "What's the weather like today?",
            { userId: "user-123" }
          );
          
          // Try another request to have multiple visualizations
          await integrationService.processMessage(
            "Tell me about quantum computing",
            { userId: "user-123" }
          );
        }
        
        // Get the visualizations after processing
        const updatedVisualizations = integrationService.getAllVisualizations();
        setVisualizations(updatedVisualizations);
        
        // Select the first visualization by default
        if (updatedVisualizations.length > 0) {
          setSelectedVisualization(updatedVisualizations[0]);
        }
      } catch (error) {
        console.error("Error loading visualizations:", error);
      } finally {
        setLoading(false);
      }
    };
    
    loadVisualizations();
  }, []);

  // Handle selecting a visualization
  const handleSelectVisualization = (visualization: ThinkingVisualization) => {
    setSelectedVisualization(visualization);
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-2xl font-bold">Thinking Process Visualizations</h1>
        <p className="text-gray-400">Debug and analyze agent thinking processes</p>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar with list of visualizations */}
        <div className="w-64 border-r border-gray-800 overflow-y-auto">
          <div className="p-3">
            <h2 className="text-lg font-semibold mb-2">Requests</h2>
            {loading ? (
              <div className="text-center py-4">
                <div className="inline-block animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div>
                <p className="mt-2 text-sm text-gray-400">Loading visualizations...</p>
              </div>
            ) : visualizations.length > 0 ? (
              <ul>
                {visualizations.map(viz => (
                  <li 
                    key={viz.id}
                    className={`mb-2 p-2 rounded cursor-pointer transition-colors ${
                      selectedVisualization?.id === viz.id
                        ? 'bg-blue-900/50 border-l-2 border-blue-500'
                        : 'hover:bg-gray-800'
                    }`}
                    onClick={() => handleSelectVisualization(viz)}
                  >
                    <div className="text-sm font-medium truncate">{viz.message}</div>
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
                <p>No visualizations found</p>
                <p className="text-xs mt-2">Process a request to create a visualization</p>
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
                <h3 className="text-xl font-semibold mb-2">No Visualization Selected</h3>
                <p className="text-gray-600">Select a request from the sidebar to view its thinking process</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 