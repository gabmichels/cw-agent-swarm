import React, { useState, useEffect } from 'react';
import { SSEHealthMonitor, PerformanceMetrics, ConnectionMetrics, HealthCheckResult } from '../../lib/monitoring/SSEHealthMonitor';

interface SSEPerformanceDashboardProps {
  className?: string;
  refreshInterval?: number;
}

/**
 * Comprehensive SSE Performance Dashboard
 */
export function SSEPerformanceDashboard({ 
  className = '', 
  refreshInterval = 5000 
}: SSEPerformanceDashboardProps) {
  const [healthMonitor] = useState(() => SSEHealthMonitor.getInstance());
  const [currentMetrics, setCurrentMetrics] = useState<PerformanceMetrics | null>(null);
  const [performanceHistory, setPerformanceHistory] = useState<PerformanceMetrics[]>([]);
  const [activeConnections, setActiveConnections] = useState<ConnectionMetrics[]>([]);
  const [healthCheck, setHealthCheck] = useState<HealthCheckResult | null>(null);
  const [resourceComparison, setResourceComparison] = useState<any>(null);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'connections' | 'performance' | 'errors'>('overview');

  // Refresh data
  const refreshData = React.useCallback(() => {
    setCurrentMetrics(healthMonitor.getCurrentMetrics());
    setPerformanceHistory(healthMonitor.getPerformanceHistory(50));
    setActiveConnections(healthMonitor.getActiveConnections());
    setHealthCheck(healthMonitor.performHealthCheck());
    setResourceComparison(healthMonitor.getResourceComparison());
  }, [healthMonitor]);

  // Set up auto-refresh
  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshData, refreshInterval]);

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'degraded': return 'text-yellow-600 bg-yellow-100';
      case 'unhealthy': return 'text-red-600 bg-red-100';
      case 'active': return 'text-green-600 bg-green-100';
      case 'disconnected': return 'text-gray-600 bg-gray-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (!currentMetrics || !healthCheck) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-lg border ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-xl font-semibold text-gray-900">SSE Performance Dashboard</h2>
        <div className="flex items-center gap-4">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(healthCheck.status)}`}>
            {healthCheck.status.toUpperCase()}
          </div>
          <button
            onClick={refreshData}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {[
          { id: 'overview', label: 'Overview', icon: '📊' },
          { id: 'connections', label: 'Connections', icon: '🔗' },
          { id: 'performance', label: 'Performance', icon: '⚡' },
          { id: 'errors', label: 'Errors', icon: '🚨' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setSelectedTab(tab.id as any)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              selectedTab === tab.id
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {selectedTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{currentMetrics.activeConnections}</div>
                <div className="text-sm text-gray-600">Active Connections</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{currentMetrics.eventsPerSecond.toFixed(1)}</div>
                <div className="text-sm text-gray-600">Events/Second</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{(currentMetrics.errorRate * 100).toFixed(1)}%</div>
                <div className="text-sm text-gray-600">Error Rate</div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {formatDuration(healthCheck.metrics.uptime)}
                </div>
                <div className="text-sm text-gray-600">Uptime</div>
              </div>
            </div>

            {/* Resource Comparison */}
            {resourceComparison && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-3">SSE vs Polling Comparison</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Network Requests</div>
                    <div className="text-lg font-medium">
                      SSE: {resourceComparison.sse.requests.toLocaleString()}
                    </div>
                    <div className="text-lg font-medium text-gray-500">
                      Polling: {resourceComparison.polling.requests.toLocaleString()}
                    </div>
                    <div className="text-sm text-green-600">
                      Saved: {resourceComparison.savings.requests.toLocaleString()} 
                      ({resourceComparison.savings.percentage.toFixed(1)}%)
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Bandwidth</div>
                    <div className="text-lg font-medium">
                      SSE: {formatBytes(resourceComparison.sse.bandwidth * 1024)}
                    </div>
                    <div className="text-lg font-medium text-gray-500">
                      Polling: {formatBytes(resourceComparison.polling.bandwidth * 1024)}
                    </div>
                    <div className="text-sm text-green-600">
                      Saved: {formatBytes(resourceComparison.savings.bandwidth * 1024)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Memory Usage</div>
                    <div className="text-lg font-medium">
                      {currentMetrics.memoryUsage ? `${currentMetrics.memoryUsage}MB` : 'N/A'}
                    </div>
                    <div className="text-sm text-gray-600">Current Heap</div>
                  </div>
                </div>
              </div>
            )}

            {/* Health Issues */}
            {healthCheck.issues.length > 0 && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                <h3 className="font-semibold text-red-900 mb-2">Health Issues</h3>
                <ul className="space-y-1">
                  {healthCheck.issues.map((issue, index) => (
                    <li key={index} className="text-red-700 text-sm">• {issue}</li>
                  ))}
                </ul>
                {healthCheck.recommendations.length > 0 && (
                  <div className="mt-3">
                    <h4 className="font-medium text-red-900 mb-1">Recommendations:</h4>
                    <ul className="space-y-1">
                      {healthCheck.recommendations.map((rec, index) => (
                        <li key={index} className="text-red-600 text-sm">→ {rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {selectedTab === 'connections' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Active Connections ({activeConnections.length})</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Connection ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User/Chat
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Events
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Errors
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activeConnections.map((connection) => (
                    <tr key={connection.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {connection.id.slice(-8)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {connection.userId || 'Anonymous'} / {connection.chatId || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDuration(Date.now() - connection.connectedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {connection.eventsDelivered}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(connection.status)}`}>
                          {connection.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {connection.errorCount}
                        {connection.reconnectCount > 0 && (
                          <span className="ml-2 text-orange-600">
                            ({connection.reconnectCount} reconnects)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {activeConnections.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No active connections
              </div>
            )}
          </div>
        )}

        {selectedTab === 'performance' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Performance Metrics Over Time */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-3">Performance Trends</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Avg Connection Duration:</span>
                    <span className="text-sm font-medium">
                      {formatDuration(currentMetrics.averageConnectionDuration)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Reconnection Rate:</span>
                    <span className="text-sm font-medium">
                      {(currentMetrics.reconnectionRate * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Connections:</span>
                    <span className="text-sm font-medium">
                      {currentMetrics.totalConnections}
                    </span>
                  </div>
                </div>
              </div>

              {/* System Resources */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-3">System Resources</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Memory Usage:</span>
                    <span className="text-sm font-medium">
                      {currentMetrics.memoryUsage ? `${currentMetrics.memoryUsage}MB` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">CPU Usage:</span>
                    <span className="text-sm font-medium">
                      {currentMetrics.cpuUsage ? `${currentMetrics.cpuUsage}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Data Points:</span>
                    <span className="text-sm font-medium">
                      {performanceHistory.length} samples
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance History Chart (Simplified) */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-3">Connection History</h3>
              <div className="h-32 flex items-end space-x-1">
                {performanceHistory.slice(-20).map((metric, index) => (
                  <div
                    key={index}
                    className="bg-blue-500 rounded-t"
                    style={{
                      height: `${Math.max(4, (metric.activeConnections / Math.max(...performanceHistory.map(m => m.activeConnections), 1)) * 100)}%`,
                      width: '4%'
                    }}
                    title={`${metric.activeConnections} connections at ${new Date(metric.timestamp).toLocaleTimeString()}`}
                  />
                ))}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Last 20 data points • Blue bars represent active connections
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'errors' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Recent Errors</h3>
              <div className="text-sm text-gray-600">
                Error Rate: {(currentMetrics.errorRate * 100).toFixed(1)}%
              </div>
            </div>
            
            <div className="space-y-2">
              {healthMonitor.getRecentErrors().map((error) => (
                <div key={error.id} className="bg-red-50 border border-red-200 p-3 rounded">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor('error')}`}>
                          {error.type}
                        </span>
                        <span className="text-sm text-gray-600">
                          {new Date(error.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm text-red-800 mt-1">{error.message}</div>
                      <div className="text-xs text-gray-600 mt-1">
                        Connection: {error.connectionId.slice(-8)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {healthMonitor.getRecentErrors().length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No recent errors 🎉
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 