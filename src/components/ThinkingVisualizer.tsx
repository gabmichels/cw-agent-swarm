import React, { useState, useEffect } from 'react';
import VisualizationRenderer from './VisualizationRenderer';
import { ThinkingVisualization } from '../services/thinking/visualization';

interface ThinkingVisualizerProps {
  chatId: string;
  messageId?: string;
}

const ThinkingVisualizer: React.FC<ThinkingVisualizerProps> = ({ chatId, messageId }) => {
  const [visualizations, setVisualizations] = useState<ThinkingVisualization[]>([]);
  const [selectedVisualization, setSelectedVisualization] = useState<ThinkingVisualization | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chatId) return;
    
    const fetchVisualizations = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch visualizations for the current chat
        const response = await fetch(`/api/thinking/visualizations?chatId=${chatId}${messageId ? `&messageId=${messageId}` : ''}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch visualizations: ${response.statusText}`);
        }
        
        const data = await response.json();
        setVisualizations(data.visualizations || []);
        
        // Select the first visualization by default
        if (data.visualizations && data.visualizations.length > 0) {
          setSelectedVisualization(data.visualizations[0]);
        }
      } catch (err) {
        console.error('Error fetching visualizations:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch visualizations');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchVisualizations();
  }, [chatId, messageId]);

  const handleVisualizationSelect = (vizId: string) => {
    const viz = visualizations.find(v => v.id === vizId);
    if (viz) {
      setSelectedVisualization(viz);
    }
  };

  return (
    <div className="thinking-visualizer">
      <h2 className="text-2xl font-bold mb-4">Thinking Process Visualizations</h2>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
          <p className="text-sm mt-2">
            Note: You need to enable thinking visualization in your agent settings.
          </p>
        </div>
      ) : visualizations.length === 0 ? (
        <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded">
          <p>No thinking visualizations available for this chat.</p>
          <p className="text-sm mt-2">
            Make sure thinking visualization is enabled for your agent and try sending a new message.
          </p>
        </div>
      ) : (
        <div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select a visualization:
            </label>
            <select 
              className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={selectedVisualization?.id || ''}
              onChange={(e) => handleVisualizationSelect(e.target.value)}
            >
              {visualizations.map((viz) => (
                <option key={viz.id} value={viz.id}>
                  {new Date(viz.timestamp).toLocaleString()} - {viz.message.substring(0, 30)}{viz.message.length > 30 ? '...' : ''}
                </option>
              ))}
            </select>
          </div>
          
          {selectedVisualization ? (
            <div className="border border-gray-300 rounded-lg p-4 bg-white">
              <VisualizationRenderer 
                visualization={selectedVisualization}
                width={800}
                height={600}
              />
            </div>
          ) : (
            <div className="text-center text-gray-500">
              Select a visualization to view details
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ThinkingVisualizer; 