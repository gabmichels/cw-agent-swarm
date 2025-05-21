import React, { useState, useEffect, useRef } from 'react';
import VisualizationRenderer from './VisualizationRenderer';
import { ThinkingVisualization } from '../services/thinking/visualization/types';
import { isVisualizationEnabled } from '../utils/visualization-utils';

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
  const retryCountRef = useRef<number>(0);
  const maxRetries = 5;
  const retryDelay = 3000; // 3 seconds

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
      const enabled = await isVisualizationEnabled();
      setIsEnabled(enabled);
    } catch (error) {
      console.error('Error checking visualization feature flag:', error);
      setIsEnabled(false);
    }
  };

  const fetchVisualizations = async () => {
    if (!chatId) return;
    
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
        
        // Reset retry count on successful fetch
        retryCountRef.current = 0;
      } else if (retryCountRef.current < maxRetries) {
        // If there are no visualizations yet, retry after a delay
        scheduleRetry();
      }
    } catch (error) {
      console.error('Error fetching visualizations:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      
      // Retry on error if we haven't exceeded max retries
      if (retryCountRef.current < maxRetries) {
        scheduleRetry();
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const scheduleRetry = () => {
    // Clear any existing timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    
    // Increment retry count
    retryCountRef.current += 1;
    
    // Schedule retry with exponential backoff
    const backoffDelay = retryDelay * Math.pow(1.5, retryCountRef.current - 1);
    console.log(`Scheduling retry ${retryCountRef.current}/${maxRetries} in ${backoffDelay}ms`);
    
    retryTimeoutRef.current = setTimeout(() => {
      fetchVisualizations();
    }, backoffDelay);
  };
  
  const handleVisualizationSelect = (visualization: ThinkingVisualization) => {
    setSelectedVisualization(visualization);
  };

  // Don't render anything if the feature is disabled
  if (!isEnabled) {
    return null;
  }
  
  // Show loading state
  if (isLoading && visualizations.length === 0) {
    return (
      <div className="thinking-visualizer-loading">
        <p>Loading thinking visualization...</p>
      </div>
    );
  }
  
  // Show error state
  if (error && visualizations.length === 0) {
    return (
      <div className="thinking-visualizer-error">
        <p>Error loading thinking visualizations: {error}</p>
        <button 
          onClick={() => {
            retryCountRef.current = 0;
            fetchVisualizations();
          }}
          className="retry-button"
        >
          Retry
        </button>
      </div>
    );
  }
  
  // Show empty state
  if (!isLoading && visualizations.length === 0) {
    return (
      <div className="thinking-visualizer-empty">
        <p>No thinking visualizations available yet.</p>
        {retryCountRef.current < maxRetries && (
          <p className="retrying-message">Checking again soon...</p>
        )}
      </div>
    );
  }
  
  // Show visualization
  return (
    <div className="thinking-visualizer">
      {visualizations.length > 1 && (
        <div className="visualization-selector">
          <select 
            value={selectedVisualization?.id || ''}
            onChange={(e) => {
              const selected = visualizations.find(v => v.id === e.target.value);
              if (selected) {
                handleVisualizationSelect(selected);
              }
            }}
          >
            {visualizations.map(v => (
              <option key={v.id} value={v.id}>
                {new Date(v.timestamp).toLocaleString()} - {v.message.substring(0, 30)}
                {v.message.length > 30 ? '...' : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      
      {selectedVisualization && (
        <VisualizationRenderer visualization={selectedVisualization} />
      )}
    </div>
  );
};

export default ThinkingVisualizer; 