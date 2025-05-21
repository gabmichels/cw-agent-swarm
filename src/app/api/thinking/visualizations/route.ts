/**
 * Thinking Visualizations API
 * 
 * This API provides endpoints for retrieving and storing thinking visualizations.
 * It uses the ThinkingVisualizer service which now handles its own storage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ThinkingVisualizer } from '../../../../services/thinking/visualization/ThinkingVisualizer';
import { v4 as uuidv4 } from 'uuid';

// Initialize services
const visualizer = new ThinkingVisualizer();

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
    
    try {
      // Get visualizations from the service (now returns in-memory stored visualizations)
      const visualizations = await visualizer.getVisualizations(chatId, messageId || undefined);
      return NextResponse.json({ visualizations });
    } catch (error) {
      console.error('Error getting visualizations:', error);
      
      // Enhanced error response with more details
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return NextResponse.json(
        { 
          error: 'Failed to retrieve visualizations',
          details: errorMessage,
          fallback: true
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error getting thinking visualizations:', error);
    
    // Enhanced error response with more details
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = error instanceof Error && 'code' in error ? (error as any).code : 'UNKNOWN_ERROR';
    
    return NextResponse.json(
      { 
        error: 'Failed to get thinking visualizations',
        details: errorMessage,
        code: errorCode || 'SERVER_ERROR',
        fallback: true
      },
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
    
    // Save the visualization using the service (now stores in-memory)
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