import { NextRequest, NextResponse } from 'next/server';
import { MemoryService } from '../../../../server/memory/services/memory/memory-service';
import { QdrantMemoryClient } from '../../../../server/memory/services/client/qdrant-client';
import { EmbeddingService } from '../../../../server/memory/services/client/embedding-service';
import { ThinkingVisualizer } from '../../../../services/thinking/visualization/ThinkingVisualizer';
import { VisualizationMetadata } from '../../../../services/thinking/visualization/types';
import { BaseMemorySchema } from '../../../../server/memory/models';
import { MemoryType } from '../../../../server/memory/config';
import { v4 as uuidv4 } from 'uuid';

// Collection name for thinking visualizations
const COLLECTION_NAME = 'thinking_visualizations';
// Vector dimensions for the collection (not really used for searching, but required)
const VECTOR_DIMENSIONS = 1536;

// Full memory schema for thinking visualizations
interface ThinkingVisualizationMemory extends BaseMemorySchema {
  metadata: VisualizationMetadata;
}

// Initialize services
const memoryClient = new QdrantMemoryClient();
const embeddingService = new EmbeddingService();
const memoryService = new MemoryService(memoryClient, embeddingService);
const visualizer = new ThinkingVisualizer(memoryService);

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const url = new URL(request.url);
    const chatId = url.searchParams.get('chatId');
    const messageId = url.searchParams.get('messageId');
    
    // Validate required parameters
    if (!chatId) {
      return NextResponse.json(
        { error: 'Missing required parameter: chatId' },
        { status: 400 }
      );
    }
    
    // Initialize services if needed
    if (!memoryClient.isInitialized()) {
      await memoryClient.initialize();
    }
    
    // Get visualizations from the service
    const visualizations = await visualizer.getVisualizations(chatId, messageId || undefined);
    
    return NextResponse.json({ visualizations });
  } catch (error) {
    console.error('Error getting thinking visualizations:', error);
    return NextResponse.json(
      { error: 'Failed to get thinking visualizations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { visualization } = body;
    
    if (!visualization) {
      return NextResponse.json(
        { error: 'Missing required parameter: visualization' },
        { status: 400 }
      );
    }
    
    // Ensure required fields are present
    if (!visualization.chatId) {
      return NextResponse.json(
        { error: 'Missing required field: chatId' },
        { status: 400 }
      );
    }
    
    // Initialize services if needed
    if (!memoryClient.isInitialized()) {
      await memoryClient.initialize();
    }
    
    // Save the visualization using the service
    const visualizationId = await visualizer.saveVisualization(visualization);
    
    if (!visualizationId) {
      return NextResponse.json(
        { error: 'Failed to save visualization' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      visualizationId 
    });
  } catch (error) {
    console.error('Error saving thinking visualization:', error);
    return NextResponse.json(
      { error: 'Failed to save thinking visualization' },
      { status: 500 }
    );
  }
} 