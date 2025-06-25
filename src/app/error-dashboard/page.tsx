'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    AlertCircle,
    AlertOctagon,
    AlertTriangle,
    BarChart3,
    CheckCircle,
    Clock,
    Download,
    Info,
    RefreshCw,
    Search,
    TrendingUp
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface ErrorLog {
  id: string;
  errorType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'IGNORED';
  agentId?: string;
  userId?: string;
  operation?: string;
  message: string;
  stackTrace?: string;
  retryAttempt: number;
  maxRetries: number;
  userNotified: boolean;
  createdAt: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  metadata?: Record<string, unknown>;
}

interface ErrorStatistics {
  totalErrors: number;
  errorsByType: Map<string, number>;
  errorsBySeverity: Map<string, number>;
  errorsByStatus: Map<string, number>;
  resolutionRate: number;
  averageResolutionTime: number;
  topFailingComponents: Array<{ component: string; count: number }>;
}

const severityIcons = {
  LOW: <Info className="h-4 w-4" />,
  MEDIUM: <AlertTriangle className="h-4 w-4" />,
  HIGH: <AlertCircle className="h-4 w-4" />,
  CRITICAL: <AlertOctagon className="h-4 w-4" />
};

const severityColors = {
  LOW: 'bg-blue-100 text-blue-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800'
};

const statusColors = {
  NEW: 'bg-red-100 text-red-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  RESOLVED: 'bg-green-100 text-green-800',
  IGNORED: 'bg-gray-100 text-gray-800'
};

export default function ErrorDashboardPage() {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [statistics, setStatistics] = useState<ErrorStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('24h');

  useEffect(() => {
    loadErrorData();
    const interval = setInterval(loadErrorData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [severityFilter, statusFilter, typeFilter, dateRange]);

  const loadErrorData = async () => {
    try {
      setLoading(true);
      
      // Build query parameters for API
      const params = new URLSearchParams();
      if (severityFilter !== 'all') params.append('severity', severityFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('errorType', typeFilter);
      params.append('dateRange', dateRange);

      // Fetch errors from API
      const errorsResponse = await fetch(`/api/errors?${params.toString()}`);
      const errorsData = await errorsResponse.json();

      // Fetch statistics from API
      const statsParams = new URLSearchParams(params);
      statsParams.append('action', 'statistics');
      const statsResponse = await fetch(`/api/errors?${statsParams.toString()}`);
      const statsData = await statsResponse.json();

      if (errorsData.success && statsData.success) {
        setErrors(errorsData.data.errors || []);
        
        // Convert plain objects back to Maps for statistics with safety checks
        const statistics: ErrorStatistics = {
          totalErrors: statsData.data.totalErrors || 0,
          errorsByType: new Map(Object.entries(statsData.data.errorsByType || {})),
          errorsBySeverity: new Map(Object.entries(statsData.data.errorsBySeverity || {})),
          errorsByStatus: new Map(Object.entries(statsData.data.errorsByStatus || {})),
          resolutionRate: statsData.data.resolutionRate || 0,
          averageResolutionTime: statsData.data.averageResolutionTime || 0,
          topFailingComponents: statsData.data.topFailingComponents || []
        };
        setStatistics(statistics);
      } else {
        console.error('Failed to load error data:', errorsData.error || statsData.error);
        
        // Fallback to mock data if API fails
        setErrors([]);
        setStatistics({
          totalErrors: 0,
          errorsByType: new Map(),
          errorsBySeverity: new Map(),
          errorsByStatus: new Map(),
          resolutionRate: 0,
          averageResolutionTime: 0,
          topFailingComponents: []
        });
      }
    } catch (error) {
      console.error('Failed to load error data:', error);
      
      // Fallback to empty data if API fails
      setErrors([]);
      setStatistics({
        totalErrors: 0,
        errorsByType: new Map(),
        errorsBySeverity: new Map(),
        errorsByStatus: new Map(),
        resolutionRate: 0,
        averageResolutionTime: 0,
        topFailingComponents: []
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredErrors = errors.filter(error => {
    const matchesSearch = searchTerm === '' || 
      error.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      error.errorType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      error.agentId?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSeverity = severityFilter === 'all' || error.severity === severityFilter;
    const matchesStatus = statusFilter === 'all' || error.status === statusFilter;
    const matchesType = typeFilter === 'all' || error.errorType === typeFilter;

    return matchesSearch && matchesSeverity && matchesStatus && matchesType;
  });

  const exportErrors = () => {
    const csvContent = [
      'ID,Type,Severity,Status,Agent,User,Operation,Message,Created,Resolved',
      ...filteredErrors.map(error => 
        `${error.id},${error.errorType},${error.severity},${error.status},${error.agentId || ''},${error.userId || ''},${error.operation || ''},${error.message.replace(/,/g, ';')},${error.createdAt},${error.resolvedAt || ''}`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleErrorAction = async (errorId: string, action: 'resolve' | 'ignore' | 'retry', additionalData?: any) => {
    try {
      const response = await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          errorId,
          ...additionalData
        })
      });

      const data = await response.json();

      if (data.success) {
        // Refresh the error data to reflect changes
        await loadErrorData();
        
        // Show success message (you could use a toast notification here)
        console.log(`Error ${errorId} ${action} successfully`);
      } else {
        console.error(`Failed to ${action} error:`, data.error);
      }
    } catch (error) {
      console.error(`Failed to ${action} error:`, error);
    }
  };

  const resolveError = (errorId: string, resolutionNotes?: string) => {
    handleErrorAction(errorId, 'resolve', { resolutionNotes });
  };

  const ignoreError = (errorId: string, ignoreReason?: string) => {
    handleErrorAction(errorId, 'ignore', { ignoreReason });
  };

  const retryError = (errorId: string) => {
    handleErrorAction(errorId, 'retry');
  };

  if (loading && !statistics) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-600">Loading error dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Error Management Dashboard</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-gray-600">Monitor system errors, track resolutions, and analyze patterns</p>
            <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
              📊 Demo Mode - Mock Data
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={loadErrorData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={exportErrors} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Errors</p>
                <p className="text-2xl font-bold text-gray-900">{statistics.totalErrors}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Resolution Rate</p>
                <p className="text-2xl font-bold text-gray-900">{(statistics.resolutionRate * 100).toFixed(1)}%</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-blue-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Avg Resolution</p>
                <p className="text-2xl font-bold text-gray-900">{statistics.averageResolutionTime}h</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-orange-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">New Errors</p>
                <p className="text-2xl font-bold text-gray-900">{statistics.errorsByStatus.get('NEW') || 0}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search errors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
          </div>

          <select 
            value={severityFilter} 
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="w-32 px-3 py-2 bg-gray-700 border border-gray-600 text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-32 px-3 py-2 bg-gray-700 border border-gray-600 text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="NEW">New</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="IGNORED">Ignored</option>
          </select>

          <select 
            value={typeFilter} 
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-40 px-3 py-2 bg-gray-700 border border-gray-600 text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Types</option>
            <option value="TOOL_EXECUTION">Tool Execution</option>
            <option value="API_FAILURE">API Failure</option>
            <option value="WORKSPACE_PERMISSION">Workspace</option>
            <option value="VALIDATION_ERROR">Validation</option>
            <option value="NETWORK_ERROR">Network</option>
          </select>

          <select 
            value={dateRange} 
            onChange={(e) => setDateRange(e.target.value)}
            className="w-32 px-3 py-2 bg-gray-700 border border-gray-600 text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>

          {(searchTerm || severityFilter !== 'all' || statusFilter !== 'all' || typeFilter !== 'all') && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setSeverityFilter('all');
                setStatusFilter('all');
                setTypeFilter('all');
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>
      </Card>

      {/* Error Log Table */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Error Log</h2>
          <Badge variant="secondary">{filteredErrors.length} errors</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-2 font-medium text-gray-700">Severity</th>
                <th className="text-left py-3 px-2 font-medium text-gray-700">Type</th>
                <th className="text-left py-3 px-2 font-medium text-gray-700">Message</th>
                <th className="text-left py-3 px-2 font-medium text-gray-700">Agent</th>
                <th className="text-left py-3 px-2 font-medium text-gray-700">Operation</th>
                <th className="text-left py-3 px-2 font-medium text-gray-700">Status</th>
                <th className="text-left py-3 px-2 font-medium text-gray-700">Retries</th>
                <th className="text-left py-3 px-2 font-medium text-gray-700">Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredErrors.map((error) => (
                <tr key={error.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-2">
                    <Badge className={`${severityColors[error.severity]} flex items-center gap-1`}>
                      {severityIcons[error.severity]}
                      {error.severity}
                    </Badge>
                  </td>
                  <td className="py-3 px-2">
                    <span className="font-mono text-xs bg-gray-700 text-gray-100 px-2 py-1 rounded">
                      {error.errorType}
                    </span>
                  </td>
                  <td className="py-3 px-2 max-w-xs">
                    <div className="truncate" title={error.message}>
                      {error.message}
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <span className="font-mono text-xs">
                      {error.agentId || '-'}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <span className="text-gray-600">
                      {error.operation || '-'}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <Badge className={statusColors[error.status]}>
                      {error.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-2">
                    <span className="text-gray-600">
                      {error.retryAttempt}/{error.maxRetries}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <span className="text-gray-600">
                      {new Date(error.createdAt).toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredErrors.length === 0 && (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No errors found matching your filters</p>
            </div>
          )}
        </div>
      </Card>

      {/* Charts Section */}
      {statistics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Error Types Chart */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Errors by Type
            </h3>
            <div className="space-y-3">
              {Array.from(statistics.errorsByType.entries()).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{type}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${(count / statistics.totalErrors) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Top Failing Components */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Top Failing Components
            </h3>
            <div className="space-y-3">
              {statistics.topFailingComponents.map((component, index) => (
                <div key={component.component} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-gray-700 text-gray-100 px-2 py-1 rounded-full w-6 h-6 flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="text-sm text-gray-600">{component.component}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-red-500 h-2 rounded-full" 
                        style={{ width: `${(component.count / statistics.topFailingComponents[0].count) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{component.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
} 