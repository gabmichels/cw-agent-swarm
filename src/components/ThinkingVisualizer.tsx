import React, { useState, useEffect, useRef } from 'react';
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
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check if the feature is enabled
    checkIfEnabled();
    
    // Fetch visualizations when the component mounts or when chatId/messageId changes
    if (chatId) {
      fetchVisualizations();
    }
    
    return () => {
      // Clean up any pending timeouts
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [chatId, messageId]);

  const checkIfEnabled = async () => {
    try {
      const response = await fetch('/api/config/get?key=enableThinkingVisualization');
      const data = await response.json();
      setIsEnabled(data.value === true);
    } catch (error) {
      console.error('Error checking visualization feature flag:', error);
      setIsEnabled(false);
    }
  };

  const fetchVisualizations = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const url = new URL('/api/thinking/visualizations', window.location.origin);
      url.searchParams.append('chatId', chatId);
      if (messageId) {
        url.searchParams.append('messageId', messageId);
      }
      
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Failed to fetch visualizations: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.visualizations && Array.isArray(data.visualizations)) {
        setVisualizations(data.visualizations);
        
        // If no visualization is selected yet and we have visualizations, select the first one
        if (!selectedVisualization && data.visualizations.length > 0) {
          setSelectedVisualization(data.visualizations[0]);
        }
      } else {
        // If there are no visualizations yet, we might want to retry after a delay
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }
        
        retryTimeoutRef.current = setTimeout(() => {
          fetchVisualizations();
        }, 5000); // Retry after 5 seconds
      }
    } catch (error) {
      console.error('Error fetching visualizations:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleVisualizationSelect = (visualization: ThinkingVisualization) => {
    setSelectedVisualization(visualization);
  };

  if (!isEnabled) {
    return null; // Don't render anything if the feature is disabled
  }
  
  if (error) {
    return (
      <div className="thinking-visualizer-error">
        <p>Error loading thinking visualizations: {error}</p>
        <button onClick={fetchVisualizations}>Retry</button>
      </div>
    );
  }
  
  if (isLoading && visualizations.length === 0) {
    return <div className="thinking-visualizer-loading">Loading thinking process visualization...</div>;
  }
  
  if (visualizations.length === 0) {
    return (
      <div className="thinking-visualizer-empty">
        <p>No thinking visualizations available for this conversation yet.</p>
      </div>
    );
  }
  
  return (
    <div className="thinking-visualizer">
      {visualizations.length > 1 && (
        <div className="visualization-selector">
          <label htmlFor="visualization-select">Select thinking process:</label>
          <select 
            id="visualization-select"
            value={selectedVisualization?.id || ''}
            onChange={(e) => {
              const selected = visualizations.find(v => v.id === e.target.value);
              if (selected) {
                handleVisualizationSelect(selected);
              }
            }}
          >
            {visualizations.map((viz) => (
              <option key={viz.id} value={viz.id}>
                {new Date(viz.timestamp).toLocaleString()} - {viz.message.substring(0, 30)}...
              </option>
            ))}
          </select>
        </div>
      )}
      
      {selectedVisualization && (
        <div className="visualization-container">
          <VisualizationRenderer visualization={selectedVisualization} />
          <div className="visualization-metadata">
            <div>
              <strong>Timestamp:</strong> {new Date(selectedVisualization.timestamp).toLocaleString()}
            </div>
            <div>
              <strong>Duration:</strong> {selectedVisualization.metrics.totalDuration}ms
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThinkingVisualizer; 