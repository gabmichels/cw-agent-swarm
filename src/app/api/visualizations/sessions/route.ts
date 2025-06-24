import { ThinkingVisualizer } from '@/services/thinking/visualization/ThinkingVisualizer';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/visualizations/sessions
 * Fetches visualization session data for the dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');
    const timeRange = searchParams.get('timeRange') || '24h';
    const filterType = searchParams.get('filterType') || 'all';
    const searchQuery = searchParams.get('searchQuery') || '';

    // Initialize the thinking visualizer
    const visualizer = new ThinkingVisualizer();

    // Get visualizations for the chat
    const visualizations = await visualizer.getVisualizations(chatId || '');

    // Transform visualizations into session format
    const sessions = visualizations.map((viz: any) => {
      // Calculate processing steps from visualization nodes
      const steps = viz.nodes
        .filter((node: any) => node.type !== 'start' && node.type !== 'end')
        .map((node: any) => ({
          id: node.id,
          type: mapNodeTypeToStepType(node.type),
          label: node.label,
          duration: node.metrics?.duration || 0,
          timestamp: node.metrics?.startTime || viz.timestamp,
          status: node.status as 'completed' | 'error' | 'in_progress',
          details: node.data || {}
        }));

      return {
        id: viz.id,
        requestId: viz.requestId,
        userMessage: viz.message,
        timestamp: viz.timestamp,
        processingTime: viz.metrics.totalDuration,
        steps,
        response: viz.response,
        success: !viz.nodes.some((node: any) => node.status === 'error')
      };
    });

    // Apply filters
    const filteredSessions = sessions.filter((session: any) => {
      // Time range filter
      const now = Date.now();
      const ranges = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };
      const timeRangeMs = ranges[timeRange as keyof typeof ranges] || ranges['24h'];
      const matchesTimeRange = (now - session.timestamp) <= timeRangeMs;

      // Search filter
      const matchesSearch = searchQuery === '' ||
        session.userMessage.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.response?.toLowerCase().includes(searchQuery.toLowerCase());

      // Type filter
      const matchesFilter = filterType === 'all' ||
        session.steps.some((step: any) => step.type === filterType);

      return matchesTimeRange && matchesSearch && matchesFilter;
    });

    // Calculate metrics
    const validSessions = filteredSessions.filter((s: any) => s.success);
    const metrics = {
      totalRequests: filteredSessions.length,
      averageProcessingTime: validSessions.length > 0
        ? validSessions.reduce((sum, s) => sum + s.processingTime, 0) / validSessions.length
        : 0,
      memoryRetrievalCount: validSessions.reduce((sum, s) =>
        sum + s.steps.filter((step: any) => step.type === 'memory_retrieval').length, 0),
      llmInteractionCount: validSessions.reduce((sum, s) =>
        sum + s.steps.filter((step: any) => step.type === 'llm_interaction').length, 0),
      toolExecutionCount: validSessions.reduce((sum, s) =>
        sum + s.steps.filter((step: any) => step.type === 'tool_execution').length, 0),
      successRate: filteredSessions.length > 0
        ? (validSessions.length / filteredSessions.length) * 100
        : 0
    };

    return NextResponse.json({
      success: true,
      data: {
        sessions: filteredSessions,
        metrics
      }
    });

  } catch (error) {
    console.error('Error fetching visualization sessions:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch visualization sessions',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * Maps visualization node types to dashboard step types
 */
function mapNodeTypeToStepType(nodeType: string): 'memory_retrieval' | 'thinking' | 'llm_interaction' | 'tool_execution' {
  switch (nodeType) {
    case 'context_retrieval':
    case 'memory_retrieval':
      return 'memory_retrieval';
    case 'thinking':
    case 'decision':
    case 'planning':
      return 'thinking';
    case 'response_generation':
      return 'llm_interaction';
    case 'tool_execution':
    case 'tool_selection':
      return 'tool_execution';
    default:
      return 'thinking';
  }
} 