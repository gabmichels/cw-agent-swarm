import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  BarChart3, 
  Clock, 
  Brain, 
  Database, 
  Cpu, 
  Zap,
  Filter,
  Search,
  Calendar,
  TrendingUp,
  Eye,
  EyeOff
} from 'lucide-react';
import ThinkingVisualizer from '../ThinkingVisualizer';

// Types for visualization data
interface VisualizationMetrics {
  totalRequests: number;
  averageProcessingTime: number;
  memoryRetrievalCount: number;
  llmInteractionCount: number;
  toolExecutionCount: number;
  successRate: number;
}

interface ProcessingStep {
  id: string;
  type: 'memory_retrieval' | 'thinking' | 'llm_interaction' | 'tool_execution';
  label: string;
  duration: number;
  timestamp: number;
  status: 'completed' | 'error' | 'in_progress';
  details: Record<string, any>;
}

interface VisualizationSession {
  id: string;
  requestId: string;
  userMessage: string;
  timestamp: number;
  processingTime: number;
  steps: ProcessingStep[];
  response?: string;
  success: boolean;
}

export const VisualizationDashboard: React.FC = () => {
  const [selectedView, setSelectedView] = useState<'dashboard' | 'visualizations'>('dashboard');
  const [sessions, setSessions] = useState<VisualizationSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [showDetails, setShowDetails] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch visualization sessions from API
  const fetchSessions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        timeRange,
        filterType,
        searchQuery
      });
      
      const response = await fetch(`/api/visualizations/sessions?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setSessions(data.data.sessions || []);
      } else {
        throw new Error(data.error || 'Failed to fetch sessions');
      }
    } catch (err) {
      console.error('Error fetching visualization sessions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
      // Fall back to mock data if API fails
      setSessions(mockSessions);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data on component mount and when filters change
  useEffect(() => {
    fetchSessions();
  }, [timeRange, filterType, searchQuery]);

  // Mock data - in real implementation, this would come from API
  const mockSessions: VisualizationSession[] = useMemo(() => [
    {
      id: 'session_1',
      requestId: 'req_001',
      userMessage: 'What are my upcoming tasks?',
      timestamp: Date.now() - 1000 * 60 * 15, // 15 minutes ago
      processingTime: 2340,
      success: true,
      response: 'Here are your upcoming tasks...',
      steps: [
        {
          id: 'step_1',
          type: 'thinking',
          label: 'Analyzing request',
          duration: 450,
          timestamp: Date.now() - 1000 * 60 * 15,
          status: 'completed',
          details: { intent: 'task_query', confidence: 0.95 }
        },
        {
          id: 'step_2',
          type: 'memory_retrieval',
          label: 'Retrieving task memories',
          duration: 890,
          timestamp: Date.now() - 1000 * 60 * 15 + 450,
          status: 'completed',
          details: { query: 'tasks upcoming', retrieved: 8, types: ['task', 'reminder'] }
        },
        {
          id: 'step_3',
          type: 'llm_interaction',
          label: 'Generating response',
          duration: 1000,
          timestamp: Date.now() - 1000 * 60 * 15 + 1340,
          status: 'completed',
          details: { model: 'gpt-4', tokens: 1250, temperature: 0.7 }
        }
      ]
    },
    {
      id: 'session_2',
      requestId: 'req_002',
      userMessage: 'Search for information about React hooks',
      timestamp: Date.now() - 1000 * 60 * 45, // 45 minutes ago
      processingTime: 3200,
      success: true,
      response: 'Here\'s what I found about React hooks...',
      steps: [
        {
          id: 'step_4',
          type: 'thinking',
          label: 'Understanding search intent',
          duration: 380,
          timestamp: Date.now() - 1000 * 60 * 45,
          status: 'completed',
          details: { intent: 'information_search', confidence: 0.88 }
        },
        {
          id: 'step_5',
          type: 'tool_execution',
          label: 'Web search execution',
          duration: 1800,
          timestamp: Date.now() - 1000 * 60 * 45 + 380,
          status: 'completed',
          details: { tool: 'web_search', query: 'React hooks documentation', results: 12 }
        },
        {
          id: 'step_6',
          type: 'llm_interaction',
          label: 'Synthesizing results',
          duration: 1020,
          timestamp: Date.now() - 1000 * 60 * 45 + 2180,
          status: 'completed',
          details: { model: 'gpt-4', tokens: 2100, temperature: 0.5 }
        }
      ]
    }
  ], []);

  // Filtered sessions based on search and filter
  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      const matchesSearch = searchQuery === '' || 
        session.userMessage.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.response?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = filterType === 'all' || 
        session.steps.some(step => step.type === filterType);
      
      const matchesTimeRange = (() => {
        const now = Date.now();
        const ranges = {
          '1h': 60 * 60 * 1000,
          '24h': 24 * 60 * 60 * 1000,
          '7d': 7 * 24 * 60 * 60 * 1000,
          '30d': 30 * 24 * 60 * 60 * 1000
        };
        return (now - session.timestamp) <= ranges[timeRange];
      })();

      return matchesSearch && matchesFilter && matchesTimeRange;
    });
  }, [sessions, searchQuery, filterType, timeRange]);

  // Calculate metrics
  const metrics: VisualizationMetrics = useMemo(() => {
    const validSessions = filteredSessions.filter(s => s.success);
    return {
      totalRequests: filteredSessions.length,
      averageProcessingTime: validSessions.length > 0 
        ? validSessions.reduce((sum, s) => sum + s.processingTime, 0) / validSessions.length 
        : 0,
      memoryRetrievalCount: validSessions.reduce((sum, s) => 
        sum + s.steps.filter(step => step.type === 'memory_retrieval').length, 0),
      llmInteractionCount: validSessions.reduce((sum, s) => 
        sum + s.steps.filter(step => step.type === 'llm_interaction').length, 0),
      toolExecutionCount: validSessions.reduce((sum, s) => 
        sum + s.steps.filter(step => step.type === 'tool_execution').length, 0),
      successRate: filteredSessions.length > 0 
        ? (validSessions.length / filteredSessions.length) * 100 
        : 0
    };
  }, [filteredSessions]);

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getStepIcon = (type: ProcessingStep['type']) => {
    switch (type) {
      case 'thinking': return <Brain className="h-4 w-4" />;
      case 'memory_retrieval': return <Database className="h-4 w-4" />;
      case 'llm_interaction': return <Cpu className="h-4 w-4" />;
      case 'tool_execution': return <Zap className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getStepColor = (type: ProcessingStep['type']) => {
    switch (type) {
      case 'thinking': return 'text-purple-400';
      case 'memory_retrieval': return 'text-blue-400';
      case 'llm_interaction': return 'text-green-400';
      case 'tool_execution': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="h-full bg-gray-900 text-white">
      {/* Header with view toggle */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex justify-between items-center">
          <div className="flex space-x-1">
            <button
              onClick={() => setSelectedView('dashboard')}
              className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                selectedView === 'dashboard'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setSelectedView('visualizations')}
              className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                selectedView === 'visualizations'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <Activity className="h-4 w-4" />
              <span>Visualizations</span>
            </button>
          </div>
          
          {selectedView === 'dashboard' && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 flex items-center space-x-2"
            >
              {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span>{showDetails ? 'Hide' : 'Show'} Details</span>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {selectedView === 'dashboard' ? (
        <div className="p-4 space-y-6">
          {/* Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Requests</p>
                  <p className="text-2xl font-bold">{metrics.totalRequests}</p>
                </div>
                <Activity className="h-8 w-8 text-blue-400" />
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Avg Processing</p>
                  <p className="text-2xl font-bold">{formatDuration(metrics.averageProcessingTime)}</p>
                </div>
                <Clock className="h-8 w-8 text-green-400" />
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Memory Queries</p>
                  <p className="text-2xl font-bold">{metrics.memoryRetrievalCount}</p>
                </div>
                <Database className="h-8 w-8 text-blue-400" />
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">LLM Calls</p>
                  <p className="text-2xl font-bold">{metrics.llmInteractionCount}</p>
                </div>
                <Cpu className="h-8 w-8 text-green-400" />
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Tool Executions</p>
                  <p className="text-2xl font-bold">{metrics.toolExecutionCount}</p>
                </div>
                <Zap className="h-8 w-8 text-yellow-400" />
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Success Rate</p>
                  <p className="text-2xl font-bold">{metrics.successRate.toFixed(1)}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-400" />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center space-x-2">
                <Search className="h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search sessions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-gray-700 text-white px-3 py-1 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="bg-gray-700 text-white px-3 py-1 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">All Steps</option>
                  <option value="thinking">Thinking</option>
                  <option value="memory_retrieval">Memory Retrieval</option>
                  <option value="llm_interaction">LLM Interaction</option>
                  <option value="tool_execution">Tool Execution</option>
                </select>
              </div>
              
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value as any)}
                  className="bg-gray-700 text-white px-3 py-1 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="1h">Last Hour</option>
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                </select>
              </div>
            </div>
          </div>

          {/* Sessions List */}
          <div className="bg-gray-800 rounded-lg">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold">Processing Sessions</h3>
              <p className="text-gray-400 text-sm">Recent agent decision-making processes</p>
            </div>
            
            <div className="divide-y divide-gray-700">
              {filteredSessions.map((session) => (
                <div key={session.id} className="p-4 hover:bg-gray-750">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-white">{session.userMessage}</p>
                      <p className="text-sm text-gray-400">
                        {formatTimestamp(session.timestamp)} • {formatDuration(session.processingTime)} • {session.steps.length} steps
                      </p>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs ${
                      session.success ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
                    }`}>
                      {session.success ? 'Success' : 'Error'}
                    </div>
                  </div>
                  
                  {showDetails && (
                    <div className="mt-3">
                      <div className="flex flex-wrap gap-2 mb-2">
                        {session.steps.map((step) => (
                          <div
                            key={step.id}
                            className={`flex items-center space-x-1 px-2 py-1 rounded-md bg-gray-700 text-xs ${getStepColor(step.type)}`}
                          >
                            {getStepIcon(step.type)}
                            <span>{step.label}</span>
                            <span className="text-gray-400">({formatDuration(step.duration)})</span>
                          </div>
                        ))}
                      </div>
                      
                      {session.response && (
                        <p className="text-sm text-gray-300 bg-gray-700 p-2 rounded-md">
                          {session.response.substring(0, 150)}...
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
              
              {filteredSessions.length === 0 && (
                <div className="p-8 text-center text-gray-400">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No sessions found matching your criteria</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="h-full">
          <ThinkingVisualizer chatId="" messageId="" />
        </div>
      )}
    </div>
  );
}; 