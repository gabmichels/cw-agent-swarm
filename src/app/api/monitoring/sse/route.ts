import { NextRequest, NextResponse } from 'next/server';
import { SSEHealthMonitor } from '../../../../lib/monitoring/SSEHealthMonitor';

/**
 * GET /api/monitoring/sse - Get SSE performance metrics
 */
export async function GET(request: NextRequest) {
  try {
    const healthMonitor = SSEHealthMonitor.getInstance();
    const { searchParams } = new URL(request.url);
    
    // Get query parameters
    const includeHistory = searchParams.get('history') === 'true';
    const includeConnections = searchParams.get('connections') === 'true';
    const includeErrors = searchParams.get('errors') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build response data
    const response: any = {
      currentMetrics: healthMonitor.getCurrentMetrics(),
      healthCheck: healthMonitor.performHealthCheck(),
      resourceComparison: healthMonitor.getResourceComparison(),
      timestamp: Date.now()
    };

    // Include optional data based on query parameters
    if (includeHistory) {
      response.performanceHistory = healthMonitor.getPerformanceHistory(limit);
    }

    if (includeConnections) {
      response.activeConnections = healthMonitor.getActiveConnections();
      response.connectionCount = healthMonitor.getActiveConnections().length;
    }

    if (includeErrors) {
      response.recentErrors = healthMonitor.getRecentErrors(limit);
    }

    return NextResponse.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Error fetching SSE monitoring data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch monitoring data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/monitoring/sse/export - Export monitoring data
 */
export async function POST(request: NextRequest) {
  try {
    const healthMonitor = SSEHealthMonitor.getInstance();
    const body = await request.json();
    
    const format = body.format || 'json';
    const includeHistory = body.includeHistory !== false;
    const includeConnections = body.includeConnections !== false;
    const includeErrors = body.includeErrors !== false;

    // Get complete metrics export
    const exportData = healthMonitor.exportMetrics();
    
    // Filter data based on request
    const filteredData: any = {
      timestamp: Date.now(),
      health: exportData.health
    };

    if (includeHistory) {
      filteredData.performance = exportData.performance;
    }

    if (includeConnections) {
      filteredData.connections = exportData.connections;
    }

    if (includeErrors) {
      filteredData.errors = exportData.errors;
    }

    if (format === 'csv') {
      // Convert to CSV format
      const csvData = convertToCSV(filteredData);
      return new NextResponse(csvData, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="sse-metrics-${Date.now()}.csv"`
        }
      });
    }

    // Default JSON format
    return NextResponse.json({
      success: true,
      data: filteredData,
      exportedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error exporting SSE monitoring data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to export monitoring data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/monitoring/sse/reset - Reset monitoring data (development only)
 */
export async function DELETE(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { success: false, error: 'Reset only available in development' },
      { status: 403 }
    );
  }

  try {
    const healthMonitor = SSEHealthMonitor.getInstance();
    
    // Destroy and recreate the monitor (this clears all data)
    healthMonitor.destroy();
    
    return NextResponse.json({
      success: true,
      message: 'Monitoring data reset successfully'
    });

  } catch (error) {
    console.error('Error resetting SSE monitoring data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to reset monitoring data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Convert monitoring data to CSV format
 */
function convertToCSV(data: any): string {
  const lines: string[] = [];
  
  // Performance metrics CSV
  if (data.performance && data.performance.length > 0) {
    lines.push('# Performance Metrics');
    lines.push('timestamp,activeConnections,totalConnections,eventsPerSecond,averageConnectionDuration,reconnectionRate,errorRate,memoryUsage');
    
    data.performance.forEach((metric: any) => {
      lines.push([
        new Date(metric.timestamp).toISOString(),
        metric.activeConnections,
        metric.totalConnections,
        metric.eventsPerSecond.toFixed(2),
        metric.averageConnectionDuration,
        metric.reconnectionRate.toFixed(4),
        metric.errorRate.toFixed(4),
        metric.memoryUsage || 'N/A'
      ].join(','));
    });
    lines.push('');
  }

  // Connections CSV
  if (data.connections && data.connections.length > 0) {
    lines.push('# Active Connections');
    lines.push('id,userId,chatId,connectedAt,duration,eventsDelivered,reconnectCount,status,errorCount');
    
    data.connections.forEach((conn: any) => {
      lines.push([
        conn.id,
        conn.userId || 'N/A',
        conn.chatId || 'N/A',
        new Date(conn.connectedAt).toISOString(),
        conn.duration || (Date.now() - conn.connectedAt),
        conn.eventsDelivered,
        conn.reconnectCount,
        conn.status,
        conn.errorCount
      ].join(','));
    });
    lines.push('');
  }

  // Errors CSV
  if (data.errors && data.errors.length > 0) {
    lines.push('# Recent Errors');
    lines.push('id,timestamp,connectionId,type,message,resolved');
    
    data.errors.forEach((error: any) => {
      lines.push([
        error.id,
        new Date(error.timestamp).toISOString(),
        error.connectionId,
        error.type,
        `"${error.message.replace(/"/g, '""')}"`, // Escape quotes
        error.resolved
      ].join(','));
    });
  }

  return lines.join('\n');
} 