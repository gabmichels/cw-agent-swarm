'use client';

/**
 * Workflow Management Dashboard
 * 
 * Unified interface for managing external workflows and direct integrations.
 * Follows IMPLEMENTATION_GUIDELINES.md: React best practices, TypeScript strict typing.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Input } from '../../components/ui/input';
import { WorkflowLibraryBrowser } from '../../components/workflows/WorkflowLibraryBrowser';
import { N8nWorkflowTemplate } from '../../types/workflow';
import { 
  Search, 
  Plus, 
  Play, 
  Pause, 
  Edit, 
  Trash2, 
  BarChart3, 
  Clock, 
  CheckCircle, 
  XCircle,
  ExternalLink,
  Zap,
  Bot
} from 'lucide-react';

/**
 * Workflow execution history entry
 */
interface WorkflowExecutionHistory {
  readonly executionId: string;
  readonly workflowId: string;
  readonly workflowName: string;
  readonly platform: 'n8n' | 'zapier' | 'direct';
  readonly status: 'completed' | 'failed' | 'running' | 'cancelled';
  readonly startedAt: Date;
  readonly completedAt?: Date;
  readonly durationMs?: number;
  readonly triggeredBy: {
    readonly type: 'agent' | 'user' | 'system';
    readonly id: string;
    readonly name?: string;
  };
  readonly result?: unknown;
  readonly error?: string;
  readonly costUsd?: number;
}

/**
 * Workflow metrics summary
 */
interface WorkflowMetrics {
  readonly totalExecutions: number;
  readonly successfulExecutions: number;
  readonly failedExecutions: number;
  readonly averageDurationMs: number;
  readonly totalCostUsd: number;
  readonly executionsToday: number;
  readonly executionsThisWeek: number;
  readonly executionsThisMonth: number;
}

/**
 * Direct integration info
 */
interface DirectIntegration {
  readonly id: string;
  readonly name: string;
  readonly platform: string;
  readonly category: 'communication' | 'productivity' | 'social' | 'business' | 'content';
  readonly isConfigured: boolean;
  readonly lastUsed?: Date;
  readonly usageCount: number;
  readonly status: 'active' | 'inactive' | 'error';
}

/**
 * External workflow info
 */
interface ExternalWorkflow {
  readonly id: string;
  readonly name: string;
  readonly platform: 'n8n' | 'zapier';
  readonly description: string;
  readonly isActive: boolean;
  readonly lastExecuted?: Date;
  readonly executionCount: number;
  readonly nlpTriggers: readonly string[];
  readonly assignedAgents: readonly string[];
  readonly createdAt: Date;
}

/**
 * Workflow dashboard state
 */
interface WorkflowDashboardState {
  directIntegrations: readonly DirectIntegration[];
  externalWorkflows: readonly ExternalWorkflow[];
  executionHistory: readonly WorkflowExecutionHistory[];
  metrics: WorkflowMetrics | null;
  loading: boolean;
  error: string | null;
  searchQuery: string;
  selectedTab: 'overview' | 'external' | 'direct' | 'library' | 'history' | 'metrics';
}

/**
 * Workflow Management Dashboard Component
 */
export default function WorkflowDashboard() {
  const [state, setState] = useState<WorkflowDashboardState>({
    directIntegrations: [],
    externalWorkflows: [],
    executionHistory: [],
    metrics: null,
    loading: true,
    error: null,
    searchQuery: '',
    selectedTab: 'overview'
  });

  /**
   * Load dashboard data
   */
  const loadDashboardData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Load all data in parallel
      const [integrationsRes, workflowsRes, historyRes, metricsRes] = await Promise.all([
        fetch('/api/workflows/integrations'),
        fetch('/api/workflows/external'),
        fetch('/api/workflows/history?limit=50'),
        fetch('/api/workflows/metrics')
      ]);

      if (!integrationsRes.ok || !workflowsRes.ok || !historyRes.ok || !metricsRes.ok) {
        throw new Error('Failed to load workflow data');
      }

      const [integrations, workflows, history, metrics] = await Promise.all([
        integrationsRes.json(),
        workflowsRes.json(),
        historyRes.json(),
        metricsRes.json()
      ]);

      setState(prev => ({
        ...prev,
        directIntegrations: integrations,
        externalWorkflows: workflows,
        executionHistory: history,
        metrics,
        loading: false
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false
      }));
    }
  }, []);

  /**
   * Handle workflow execution
   */
  const executeWorkflow = useCallback(async (workflowId: string) => {
    try {
      const response = await fetch(`/api/workflows/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId, triggeredBy: { type: 'user', id: 'dashboard' } })
      });

      if (!response.ok) {
        throw new Error('Failed to execute workflow');
      }

      // Refresh data after execution
      await loadDashboardData();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Execution failed'
      }));
    }
  }, [loadDashboardData]);

  /**
   * Handle workflow toggle (activate/deactivate)
   */
  const toggleWorkflow = useCallback(async (workflowId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/workflows/external/${workflowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive })
      });

      if (!response.ok) {
        throw new Error('Failed to update workflow');
      }

      // Update local state
      setState(prev => ({
        ...prev,
        externalWorkflows: prev.externalWorkflows.map(wf =>
          wf.id === workflowId ? { ...wf, isActive } : wf
        )
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Update failed'
      }));
    }
  }, []);

  /**
   * Handle workflow import from library
   */
  const handleWorkflowImport = useCallback(async (workflow: N8nWorkflowTemplate): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Import workflow via API
      const response = await fetch('/api/workflows/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: workflow.id,
          name: workflow.name,
          description: workflow.description,
          category: workflow.category,
          source: 'n8n-library'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to import workflow');
      }

      const importedWorkflow = await response.json();
      
      // Show success message
      setState(prev => ({
        ...prev,
        loading: false,
        error: null
      }));

      // Refresh data to show the new workflow
      await loadDashboardData();
      
      // Switch to external workflows tab to show the imported workflow
      setState(prev => ({ ...prev, selectedTab: 'external' }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Import failed'
      }));
    }
  }, [loadDashboardData]);

  /**
   * Handle workflow preview from library
   */
  const handleWorkflowPreview = useCallback((workflow: N8nWorkflowTemplate): void => {
    // Open workflow preview modal or navigate to preview page
    window.open(`/workflows/preview/${workflow.id}`, '_blank');
  }, []);

  /**
   * Filter workflows based on search query
   */
  const filteredWorkflows = state.externalWorkflows.filter(workflow =>
    workflow.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
    workflow.description.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
    workflow.platform.toLowerCase().includes(state.searchQuery.toLowerCase())
  );

  /**
   * Filter integrations based on search query
   */
  const filteredIntegrations = state.directIntegrations.filter(integration =>
    integration.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
    integration.platform.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
    integration.category.toLowerCase().includes(state.searchQuery.toLowerCase())
  );

  // Load data on mount
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (state.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading workflow dashboard...</p>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-4">{state.error}</p>
          <Button onClick={loadDashboardData}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Workflow Management</h1>
          <p className="text-gray-600 mt-2">Manage your external workflows and direct integrations</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => window.open('/workflows/create', '_blank')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Workflow
          </Button>
          <Button variant="outline" onClick={loadDashboardData}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search workflows and integrations..."
          value={state.searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setState(prev => ({ ...prev, searchQuery: e.target.value }))}
          className="pl-10"
        />
      </div>

      <Tabs 
        value={state.selectedTab} 
        onValueChange={(value) => setState(prev => ({ ...prev, selectedTab: value as any }))}
      >
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="external">External Workflows</TabsTrigger>
          <TabsTrigger value="direct">Direct Integrations</TabsTrigger>
          <TabsTrigger value="library">Workflow Library</TabsTrigger>
          <TabsTrigger value="history">Execution History</TabsTrigger>
          <TabsTrigger value="metrics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">External Workflows</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{state.externalWorkflows.length}</div>
                <p className="text-xs text-muted-foreground">
                  {state.externalWorkflows.filter(w => w.isActive).length} active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Direct Integrations</CardTitle>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{state.directIntegrations.length}</div>
                <p className="text-xs text-muted-foreground">
                  {state.directIntegrations.filter(i => i.isConfigured).length} configured
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{state.metrics?.totalExecutions || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {state.metrics?.executionsToday || 0} today
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {state.metrics 
                    ? `${((state.metrics.successfulExecutions / state.metrics.totalExecutions) * 100).toFixed(1)}%`
                    : '0%'
                  }
                </div>
                <p className="text-xs text-muted-foreground">
                  {state.metrics?.successfulExecutions || 0} successful
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest workflow executions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {state.executionHistory.slice(0, 5).map((execution) => (
                  <div key={execution.executionId} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {execution.status === 'completed' ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : execution.status === 'failed' ? (
                        <XCircle className="h-5 w-5 text-red-500" />
                      ) : (
                        <Clock className="h-5 w-5 text-yellow-500" />
                      )}
                      <div>
                        <p className="font-medium">{execution.workflowName}</p>
                        <p className="text-sm text-gray-600">
                          {execution.platform} • {execution.triggeredBy.type}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {execution.durationMs ? `${execution.durationMs}ms` : '-'}
                      </p>
                      <p className="text-xs text-gray-600">
                        {execution.startedAt.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* External Workflows Tab */}
        <TabsContent value="external">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWorkflows.map((workflow) => (
              <Card key={workflow.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{workflow.name}</CardTitle>
                      <CardDescription className="mt-1">{workflow.description}</CardDescription>
                    </div>
                    <Badge variant={workflow.isActive ? 'default' : 'secondary'}>
                      {workflow.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Platform:</span>
                      <Badge variant="outline">{workflow.platform}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Executions:</span>
                      <span>{workflow.executionCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Last used:</span>
                      <span>
                        {workflow.lastExecuted 
                          ? workflow.lastExecuted.toLocaleDateString()
                          : 'Never'
                        }
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Agents:</span>
                      <span>{workflow.assignedAgents.length}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-600 mb-2">Triggers:</p>
                    <div className="flex flex-wrap gap-1">
                      {workflow.nlpTriggers.slice(0, 3).map((trigger, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {trigger}
                        </Badge>
                      ))}
                      {workflow.nlpTriggers.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{workflow.nlpTriggers.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button 
                      size="sm" 
                      onClick={() => executeWorkflow(workflow.id)}
                      disabled={!workflow.isActive}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Execute
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => toggleWorkflow(workflow.id, !workflow.isActive)}
                    >
                      {workflow.isActive ? (
                        <>
                          <Pause className="h-3 w-3 mr-1" />
                          Disable
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3 mr-1" />
                          Enable
                        </>
                      )}
                    </Button>
                    <Button size="sm" variant="outline">
                      <Edit className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredWorkflows.length === 0 && (
            <div className="text-center py-12">
              <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No workflows found</h3>
              <p className="text-gray-600 mb-4">
                {state.searchQuery 
                  ? 'No workflows match your search criteria.'
                  : 'Get started by adding your first external workflow.'
                }
              </p>
              <Button onClick={() => window.open('/workflows/create', '_blank')}>
                <Plus className="h-4 w-4 mr-2" />
                Add Workflow
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Direct Integrations Tab */}
        <TabsContent value="direct">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredIntegrations.map((integration) => (
              <Card key={integration.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{integration.name}</CardTitle>
                      <CardDescription>{integration.platform}</CardDescription>
                    </div>
                    <Badge 
                      variant={integration.status === 'active' ? 'default' : 
                               integration.status === 'error' ? 'destructive' : 'secondary'}
                    >
                      {integration.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Category:</span>
                      <Badge variant="outline">{integration.category}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Usage count:</span>
                      <span>{integration.usageCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Last used:</span>
                      <span>
                        {integration.lastUsed 
                          ? integration.lastUsed.toLocaleDateString()
                          : 'Never'
                        }
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Configured:</span>
                      <span>{integration.isConfigured ? 'Yes' : 'No'}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button 
                      size="sm"
                      variant={integration.isConfigured ? 'outline' : 'default'}
                      onClick={() => window.open(`/settings/integrations/${integration.id}`, '_blank')}
                    >
                      {integration.isConfigured ? 'Manage' : 'Configure'}
                    </Button>
                    <Button size="sm" variant="outline">
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Workflow Library Tab */}
        <TabsContent value="library">
          <WorkflowLibraryBrowser 
            onWorkflowImport={handleWorkflowImport}
            onWorkflowPreview={handleWorkflowPreview}
          />
        </TabsContent>

        {/* Execution History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Execution History</CardTitle>
              <CardDescription>Recent workflow executions and their results</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {state.executionHistory.map((execution) => (
                  <div key={execution.executionId} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        {execution.status === 'completed' ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : execution.status === 'failed' ? (
                          <XCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <Clock className="h-5 w-5 text-yellow-500" />
                        )}
                        <div>
                          <h4 className="font-medium">{execution.workflowName}</h4>
                          <p className="text-sm text-gray-600">
                            {execution.platform} • Triggered by {execution.triggeredBy.type}
                          </p>
                        </div>
                      </div>
                      <Badge variant={
                        execution.status === 'completed' ? 'default' :
                        execution.status === 'failed' ? 'destructive' : 'secondary'
                      }>
                        {execution.status}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Started:</span>
                        <p>{execution.startedAt.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Duration:</span>
                        <p>{execution.durationMs ? `${execution.durationMs}ms` : '-'}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Cost:</span>
                        <p>{execution.costUsd ? `$${execution.costUsd.toFixed(4)}` : '-'}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Execution ID:</span>
                        <p className="font-mono text-xs">{execution.executionId.slice(0, 8)}...</p>
                      </div>
                    </div>

                    {execution.error && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                        <p className="text-sm text-red-800">{execution.error}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="metrics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Execution Metrics</CardTitle>
                <CardDescription>Performance and usage statistics</CardDescription>
              </CardHeader>
              <CardContent>
                {state.metrics && (
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span>Total executions:</span>
                      <span className="font-medium">{state.metrics.totalExecutions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Successful:</span>
                      <span className="font-medium text-green-600">{state.metrics.successfulExecutions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Failed:</span>
                      <span className="font-medium text-red-600">{state.metrics.failedExecutions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Average duration:</span>
                      <span className="font-medium">{state.metrics.averageDurationMs}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total cost:</span>
                      <span className="font-medium">${state.metrics.totalCostUsd.toFixed(4)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Usage Trends</CardTitle>
                <CardDescription>Execution frequency over time</CardDescription>
              </CardHeader>
              <CardContent>
                {state.metrics && (
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span>Today:</span>
                      <span className="font-medium">{state.metrics.executionsToday}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>This week:</span>
                      <span className="font-medium">{state.metrics.executionsThisWeek}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>This month:</span>
                      <span className="font-medium">{state.metrics.executionsThisMonth}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 