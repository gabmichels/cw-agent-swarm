import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import VisualizationsContainer from '../components/VisualizationsContainer';
import { ThinkingVisualizer } from '../services/thinking/visualization/ThinkingVisualizer';
import { createSampleVisualization } from '../services/thinking/visualization';
import { MemoryService } from '../server/memory/services/memory/memory-service';
import { QdrantMemoryClient } from '../server/memory/services/client/qdrant-client';
import { EmbeddingService } from '../server/memory/services/client/embedding-service';

export default function VisualizationsPage() {
  const router = useRouter();
  const { chatId, messageId } = router.query;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Initialize with sample data if needed
  useEffect(() => {
    async function initializeSampleData() {
      try {
        // Only initialize once
        if (initialized) return;
        setInitialized(true);

        // Check if we should show sample data
        const response = await fetch('/api/config/get?key=enableSampleVisualization');
        const data = await response.json();
        
        if (data.value !== true) return;

        // Create sample visualization
        const memoryClient = new QdrantMemoryClient();
        const embeddingService = new EmbeddingService();
        const memoryService = new MemoryService(memoryClient, embeddingService);

        // Initialize client if needed
        if (!memoryClient.isInitialized()) {
          await memoryClient.initialize();
        }

        const visualizer = new ThinkingVisualizer(memoryService);
        
        // Create a sample visualization
        const sampleVisualization = createSampleVisualization();
        
        // Save it to the memory service
        await visualizer.saveVisualization(sampleVisualization);
        
        setLoading(false);
      } catch (error) {
        console.error('Error initializing sample data:', error);
        setError('Failed to initialize sample data');
        setLoading(false);
      }
    }

    initializeSampleData();
  }, [initialized]);

  // If chatId is not provided, use a default one (for sample data)
  const effectiveChatId = typeof chatId === 'string' ? chatId : 'chat-456';
  const effectiveMessageId = typeof messageId === 'string' ? messageId : undefined;

  return (
    <div className="container mx-auto p-4">
      {loading ? (
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading visualizations...</p>
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
        </div>
      ) : (
        <VisualizationsContainer 
          chatId={effectiveChatId} 
          messageId={effectiveMessageId}
        />
      )}
    </div>
  );
} 