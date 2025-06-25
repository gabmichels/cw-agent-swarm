'use client';

import {
    AlertCircle,
    AlertOctagon,
    AlertTriangle,
    Info
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';

interface ErrorData {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  timestamp: string;
  status: 'open' | 'resolved' | 'ignored';
  agent?: string;
  operation?: string;
  metadata?: any;
  stackTrace?: string;
  resolutionNotes?: string;
}

interface ErrorStatistics {
  totalErrors: number;
  resolvedErrors: number;
  criticalErrors: number;
  newErrorsToday: number;
  averageResolutionTime: string;
  resolutionRate: number;
  errorsByType: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  errorsOverTime: Array<{ date: string; count: number }>;
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

const USE_MOCK_DATA = true;

// Mock data for demonstration
const mockErrors: ErrorData[] = [
  {
    id: '01JYKR2CYERZ9HBJM8E4J3456Y',
    type: 'EMAIL_SERVICE_ERROR',
    severity: 'critical',
    message: 'Email service connection failed - SMTP authentication rejected',
    timestamp: '2025-01-16T10:30:00Z',
    status: 'open',
    agent: 'Aria',
    operation: 'sendEmail',
    metadata: {
      recipient: 'gab@crowd-wisdom.com',
      subject: 'Important Update',
      smtpServer: 'smtp.gmail.com',
      errorCode: 'AUTH_REJECTED'
    },
    stackTrace: 'SMTPAuthenticationError: 535-5.7.8 Username and Password not accepted\n    at EmailService.sendEmail (/src/services/EmailService.ts:124)\n    at Agent.executeTool (/src/agents/base/AgentBase.ts:89)'
  },
  {
    id: '01JYKR2CYERZ9HBJM8E4J3457Z',
    type: 'API_RATE_LIMIT',
    severity: 'high',
    message: 'Rate limit exceeded for CoinGecko API',
    timestamp: '2025-01-16T09:15:00Z',
    status: 'open',
    agent: 'MarketAnalyst',
    operation: 'fetchCryptoPrice',
    metadata: {
      apiEndpoint: 'https://api.coingecko.com/api/v3/simple/price',
      rateLimitRemaining: 0,
      resetTime: '2025-01-16T10:00:00Z'
    }
  },
  {
    id: '01JYKR2CYERZ9HBJM8E4J3458A',
    type: 'OAUTH_TOKEN_EXPIRED',
    severity: 'medium',
    message: 'Google Workspace access token expired',
    timestamp: '2025-01-16T08:45:00Z',
    status: 'open',
    agent: 'WorkspaceManager',
    operation: 'accessGoogleDrive',
    metadata: {
      service: 'Google Drive',
      tokenExpiresAt: '2025-01-16T08:44:32Z',
      refreshAttempted: true
    }
  },
  {
    id: '01JYKR2CYERZ9HBJM8E4J3459B',
    type: 'NETWORK_TIMEOUT',
    severity: 'medium',
    message: 'Connection timeout to GitHub API',
    timestamp: '2025-01-16T07:20:00Z',
    status: 'resolved',
    agent: 'CodeAnalyzer',
    operation: 'fetchRepository',
    metadata: {
      repository: 'microsoft/vscode',
      timeoutDuration: '30s',
      retryAttempts: 3
    },
    resolutionNotes: 'Resolved after GitHub API maintenance window ended'
  },
  {
    id: '01JYKR2CYERZ9HBJM8E4J345AC',
    type: 'VALIDATION_ERROR',
    severity: 'low',
    message: 'Invalid webhook payload format from Slack',
    timestamp: '2025-01-15T16:30:00Z',
    status: 'ignored',
    agent: 'SlackIntegration',
    operation: 'processWebhook',
    metadata: {
      expectedFormat: 'application/json',
      receivedFormat: 'text/plain',
      payloadSize: '1.2KB'
    },
    resolutionNotes: 'Known issue with Slack test webhooks, not affecting production'
  }
];

const mockStatistics: ErrorStatistics = {
  totalErrors: 187,
  resolvedErrors: 155,
  criticalErrors: 8,
  newErrorsToday: 31,
  averageResolutionTime: '4.1h',
  resolutionRate: 83.0,
  errorsByType: {
    'API_ERROR': 45,
    'DATABASE_ERROR': 32,
    'NETWORK_ERROR': 28,
    'AUTHENTICATION_ERROR': 23,
    'VALIDATION_ERROR': 18,
    'SYSTEM_ERROR': 15,
    'EMAIL_SERVICE_ERROR': 12,
    'OTHER': 14
  },
  errorsBySeverity: {
    'critical': 8,
    'high': 34,
    'medium': 89,
    'low': 56
  },
  errorsOverTime: [
    { date: '2025-01-10', count: 12 },
    { date: '2025-01-11', count: 18 },
    { date: '2025-01-12', count: 15 },
    { date: '2025-01-13', count: 22 },
    { date: '2025-01-14', count: 28 },
    { date: '2025-01-15', count: 34 },
    { date: '2025-01-16', count: 31 }
  ]
};

export default function ErrorDashboard() {
  const [errors, setErrors] = useState<ErrorData[]>([]);
  const [statistics, setStatistics] = useState<ErrorStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const errorsPerPage = 10;

  // Layout state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      if (USE_MOCK_DATA) {
        // Use mock data
        setErrors(mockErrors);
        setStatistics(mockStatistics);
      } else {
        // Fetch real data from API
        const [errorsResponse, statsResponse] = await Promise.all([
          fetch('/api/errors'),
          fetch('/api/errors?action=statistics')
        ]);

        if (!errorsResponse.ok || !statsResponse.ok) {
          throw new Error('Failed to fetch data');
        }

        const errorsData = await errorsResponse.json();
        const statsData = await statsResponse.json();

        setErrors(errorsData.errors || []);
        setStatistics(statsData.statistics || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Filter errors based on current filters
  const filteredErrors = errors.filter(error => {
    const matchesType = typeFilter === 'all' || error.type === typeFilter;
    const matchesSeverity = severityFilter === 'all' || error.severity === severityFilter;
    const matchesStatus = statusFilter === 'all' || error.status === statusFilter;
    const matchesSearch = searchQuery === '' || 
      error.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      error.agent?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      error.operation?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesType && matchesSeverity && matchesStatus && matchesSearch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredErrors.length / errorsPerPage);
  const startIndex = (currentPage - 1) * errorsPerPage;
  const paginatedErrors = filteredErrors.slice(startIndex, startIndex + errorsPerPage);

  // Handle error actions
  const handleErrorAction = async (errorId: string, action: 'resolve' | 'ignore' | 'retry') => {
    try {
      if (USE_MOCK_DATA) {
        // Update mock data
        setErrors(prev => prev.map(err => 
          err.id === errorId 
            ? { ...err, status: action === 'retry' ? 'open' : action === 'resolve' ? 'resolved' : 'ignored' }
            : err
        ));
      } else {
        // Call API
        const response = await fetch('/api/errors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, errorId })
        });

        if (!response.ok) {
          throw new Error('Failed to update error');
        }

        // Reload data
        await loadData();
      }
    } catch (err) {
      console.error('Error updating error status:', err);
    }
  };

  // Layout handlers
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleDeptDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeptDropdownOpen(!isDeptDropdownOpen);
    setIsAgentDropdownOpen(false);
  };
  const toggleAgentDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAgentDropdownOpen(!isAgentDropdownOpen);
    setIsDeptDropdownOpen(false);
  };
  const handleDepartmentChange = (dept: string) => {
    setIsDeptDropdownOpen(false);
  };
  const handleAgentChange = (agent: string) => {
    setIsAgentDropdownOpen(false);
  };

  // Get unique values for filters
  const uniqueTypes = [...new Set(errors.map(e => e.type))];
  const uniqueSeverities = ['critical', 'high', 'medium', 'low'];
  const uniqueStatuses = ['open', 'resolved', 'ignored'];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400 bg-red-900/20';
      case 'high': return 'text-orange-400 bg-orange-900/20';
      case 'medium': return 'text-yellow-400 bg-yellow-900/20';
      case 'low': return 'text-blue-400 bg-blue-900/20';
      default: return 'text-gray-400 bg-gray-900/20';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-red-400 bg-red-900/20';
      case 'resolved': return 'text-green-400 bg-green-900/20';
      case 'ignored': return 'text-gray-400 bg-gray-900/20';
      default: return 'text-gray-400 bg-gray-900/20';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-gray-900 text-white">
        <Header
          selectedDepartment="System"
          selectedAgent="Error Management"
          isDeptDropdownOpen={isDeptDropdownOpen}
          isAgentDropdownOpen={isAgentDropdownOpen}
          isDebugMode={isDebugMode}
          isSidebarOpen={isSidebarOpen}
          toggleSidebar={toggleSidebar}
          toggleDeptDropdown={toggleDeptDropdown}
          toggleAgentDropdown={toggleAgentDropdown}
          handleDepartmentChange={handleDepartmentChange}
          handleAgentChange={handleAgentChange}
          setIsDebugMode={setIsDebugMode}
          departments={['System']}
          agentsByDepartment={{ System: ['Error Management'] }}
          userId="admin"
          organizationId={undefined}
        />
        
        <div className="flex flex-1 overflow-hidden">
          <div className={`bg-gray-800 border-r border-gray-700 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-0'}`}>
            {isSidebarOpen && (
              <Sidebar
                isSidebarOpen={isSidebarOpen}
                isSidebarPinned={false}
                selectedAgent="Error Management"
                toggleSidebarPin={() => {}}
                setSelectedAgent={() => {}}
              />
            )}
          </div>
          
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading error dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-screen bg-gray-900 text-white">
        <Header
          selectedDepartment="System"
          selectedAgent="Error Management"
          isDeptDropdownOpen={isDeptDropdownOpen}
          isAgentDropdownOpen={isAgentDropdownOpen}
          isDebugMode={isDebugMode}
          isSidebarOpen={isSidebarOpen}
          toggleSidebar={toggleSidebar}
          toggleDeptDropdown={toggleDeptDropdown}
          toggleAgentDropdown={toggleAgentDropdown}
          handleDepartmentChange={handleDepartmentChange}
          handleAgentChange={handleAgentChange}
          setIsDebugMode={setIsDebugMode}
          departments={['System']}
          agentsByDepartment={{ System: ['Error Management'] }}
          userId="admin"
          organizationId={undefined}
        />
        
        <div className="flex flex-1 overflow-hidden">
          <div className={`bg-gray-800 border-r border-gray-700 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-0'}`}>
            {isSidebarOpen && (
              <Sidebar
                isSidebarOpen={isSidebarOpen}
                isSidebarPinned={false}
                selectedAgent="Error Management"
                toggleSidebarPin={() => {}}
                setSelectedAgent={() => {}}
              />
            )}
          </div>
          
          <div className="flex-1 p-6">
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
              <h2 className="text-red-400 font-semibold mb-2">Error Loading Dashboard</h2>
              <p className="text-gray-300">{error}</p>
              <button
                onClick={loadData}
                className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <Header
        selectedDepartment="System"
        selectedAgent="Error Management"
        isDeptDropdownOpen={isDeptDropdownOpen}
        isAgentDropdownOpen={isAgentDropdownOpen}
        isDebugMode={isDebugMode}
        isSidebarOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
        toggleDeptDropdown={toggleDeptDropdown}
        toggleAgentDropdown={toggleAgentDropdown}
        handleDepartmentChange={handleDepartmentChange}
        handleAgentChange={handleAgentChange}
        setIsDebugMode={setIsDebugMode}
        departments={['System']}
        agentsByDepartment={{ System: ['Error Management'] }}
        userId="admin"
        organizationId={undefined}
      />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className={`bg-gray-800 border-r border-gray-700 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-0'}`}>
          {isSidebarOpen && (
            <Sidebar
              isSidebarOpen={isSidebarOpen}
              isSidebarPinned={false}
              selectedAgent="Error Management"
              toggleSidebarPin={() => {}}
              setSelectedAgent={() => {}}
            />
          )}
        </div>

        {/* Content area without tabs */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white">Error Management Dashboard</h1>
                <p className="text-gray-400 mt-1">
                  Monitor system errors, track resolutions, and analyze patterns
                  {USE_MOCK_DATA && (
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-900/20 text-yellow-400">
                      📊 Demo Mode - Mock Data
                    </span>
                  )}
                </p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={loadData}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Refresh</span>
                </button>
                <button className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Export</span>
                </button>
              </div>
            </div>

            {/* Statistics Cards */}
            {statistics && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">Total Errors</p>
                      <p className="text-3xl font-bold text-red-400 mt-1">{statistics.totalErrors}</p>
                    </div>
                    <div className="bg-red-900/20 p-3 rounded-lg">
                      <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">Resolution Rate</p>
                      <p className="text-3xl font-bold text-green-400 mt-1">{statistics.resolutionRate.toFixed(1)}%</p>
                    </div>
                    <div className="bg-green-900/20 p-3 rounded-lg">
                      <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">Avg Resolution</p>
                      <p className="text-3xl font-bold text-blue-400 mt-1">{statistics.averageResolutionTime}</p>
                    </div>
                    <div className="bg-blue-900/20 p-3 rounded-lg">
                      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">New Errors</p>
                      <p className="text-3xl font-bold text-orange-400 mt-1">{statistics.newErrorsToday}</p>
                    </div>
                    <div className="bg-orange-900/20 p-3 rounded-lg">
                      <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <h2 className="text-lg font-semibold text-white mb-4">Filters</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Search */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Search</label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search errors..."
                    className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Type Filter */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Error Type</label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Types</option>
                    {uniqueTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Severity Filter */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Severity</label>
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Severities</option>
                    {uniqueSeverities.map(severity => (
                      <option key={severity} value={severity}>{severity}</option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Statuses</option>
                    {uniqueStatuses.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Error List */}
            <div className="bg-gray-800 rounded-lg border border-gray-700">
              <div className="p-6 border-b border-gray-700">
                <h2 className="text-lg font-semibold text-white">
                  Errors ({filteredErrors.length})
                </h2>
              </div>

              {paginatedErrors.length === 0 ? (
                <div className="p-8 text-center">
                  <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-400">No errors found matching your filters.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {paginatedErrors.map((errorItem) => (
                    <div key={errorItem.id} className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(errorItem.severity)}`}>
                              {errorItem.severity}
                            </span>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(errorItem.status)}`}>
                              {errorItem.status}
                            </span>
                            <span className="text-sm text-gray-400">
                              {new Date(errorItem.timestamp).toLocaleString()}
                            </span>
                          </div>
                          
                          <h3 className="text-lg font-semibold text-white mb-1">
                            {errorItem.message}
                          </h3>
                          
                          <div className="text-sm text-gray-400 space-y-1">
                            <p><span className="font-medium">Type:</span> {errorItem.type}</p>
                            {errorItem.agent && <p><span className="font-medium">Agent:</span> {errorItem.agent}</p>}
                            {errorItem.operation && <p><span className="font-medium">Operation:</span> {errorItem.operation}</p>}
                            <p><span className="font-medium">Error ID:</span> {errorItem.id}</p>
                          </div>
                          
                          {errorItem.metadata && (
                            <div className="mt-3">
                              <details className="group">
                                <summary className="text-sm text-blue-400 cursor-pointer hover:text-blue-300">
                                  View Details
                                </summary>
                                <div className="mt-2 p-3 bg-gray-900 rounded-lg">
                                  <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                                    {JSON.stringify(errorItem.metadata, null, 2)}
                                  </pre>
                                </div>
                              </details>
                            </div>
                          )}
                          
                          {errorItem.stackTrace && (
                            <div className="mt-3">
                              <details className="group">
                                <summary className="text-sm text-blue-400 cursor-pointer hover:text-blue-300">
                                  View Stack Trace
                                </summary>
                                <div className="mt-2 p-3 bg-gray-900 rounded-lg">
                                  <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                                    {errorItem.stackTrace}
                                  </pre>
                                </div>
                              </details>
                            </div>
                          )}
                          
                          {errorItem.resolutionNotes && (
                            <div className="mt-3 p-3 bg-green-900/20 border border-green-700 rounded-lg">
                              <p className="text-sm text-green-300">
                                <span className="font-medium">Resolution:</span> {errorItem.resolutionNotes}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        {errorItem.status === 'open' && (
                          <div className="flex space-x-2 ml-4">
                            <button
                              onClick={() => handleErrorAction(errorItem.id, 'resolve')}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors"
                            >
                              Resolve
                            </button>
                            <button
                              onClick={() => handleErrorAction(errorItem.id, 'ignore')}
                              className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm transition-colors"
                            >
                              Ignore
                            </button>
                            <button
                              onClick={() => handleErrorAction(errorItem.id, 'retry')}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                            >
                              Retry
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="p-6 border-t border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-400">
                      Showing {startIndex + 1} to {Math.min(startIndex + errorsPerPage, filteredErrors.length)} of {filteredErrors.length} results
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                      >
                        Previous
                      </button>
                      <span className="flex items-center px-3 py-2 text-sm text-gray-400">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 