import { NextRequest, NextResponse } from 'next/server';
import { ThinkingVisualizer } from '../../../../services/thinking/visualization';

// Create a singleton instance of the visualizer
const thinkingVisualizer = new ThinkingVisualizer();

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
    
    // Get visualizations
    const visualizations = thinkingVisualizer.getAllVisualizations()
      // Filter by chatId if provided (chatId might be stored in requestId or in node data)
      .filter(viz => 
        viz.requestId.includes(chatId) || 
        viz.nodes.some(node => node.data && node.data.chatId === chatId)
      )
      // Filter by messageId if provided
      .filter(viz => 
        !messageId || 
        viz.requestId.includes(messageId) || 
        viz.nodes.some(node => node.data && node.data.messageId === messageId)
      )
      // Sort by timestamp, newest first
      .sort((a, b) => b.timestamp - a.timestamp);
    
    return NextResponse.json({ visualizations });
  } catch (error) {
    console.error('Error getting thinking visualizations:', error);
    return NextResponse.json(
      { error: 'Failed to get thinking visualizations' },
      { status: 500 }
    );
  }
} 