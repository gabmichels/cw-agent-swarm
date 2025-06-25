'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  Cloud, 
  Server, 
  Plus, 
  RefreshCw, 
  Play, 
  Pause, 
  Download,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Clock,
  Settings
} from 'lucide-react';

interface N8nConnection {
  id: string;
  provider: 'N8N_CLOUD' | 'N8N_SELF_HOSTED';
  displayName: string;
  email: string;
  domain?: string;
  status: 'ACTIVE' | 'ERROR' | 'REVOKED';
  lastSyncAt: Date;
  workflowCount?: number;
}

interface UserWorkflow {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  tags: string[];
  nodeCount: number;
  lastModified: Date;
  executionCount: number;
  source: 'user' | 'imported';
  originalLibraryId?: string;
}

interface N8nAccountManagerProps {
  onWorkflowImport?: (workflow: any, connectionId: string) => void;
  selectedWorkflowForImport?: any;
}

export function N8nAccountManager({ 
  onWorkflowImport, 
  selectedWorkflowForImport 
}: N8nAccountManagerProps) {
  const [connections, setConnections] = useState<N8nConnection[]>([]);
  const [userWorkflows, setUserWorkflows] = useState<Record<string, UserWorkflow[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importingWorkflow, setImportingWorkflow] = useState(false);

  // Load user's N8N connections
  const loadConnections = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch workspace connections for N8N providers
      const response = await fetch('/api/workspace/connections?provider=N8N_CLOUD,N8N_SELF_HOSTED');
      if (!response.ok) {
        throw new Error('Failed to load N8N connections');
      }

      const data = await response.json();
      const n8nConnections: N8nConnection[] = data.connections?.map((conn: any) => ({
        id: conn.id,
        provider: conn.provider,
        displayName: conn.displayName,
        email: conn.email,
        domain: conn.domain,
        status: conn.status,
        lastSyncAt: new Date(conn.lastSyncAt),
        workflowCount: 0 // Will be loaded separately
      })) || [];

      setConnections(n8nConnections);

      // Load workflow counts for each connection
      for (const connection of n8nConnections) {
        if (connection.status === 'ACTIVE') {
          loadUserWorkflows(connection.id);
        }
      }

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load connections');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load workflows for a specific connection
  const loadUserWorkflows = useCallback(async (connectionId: string) => {
    try {
      const response = await fetch(`/api/workflows/user-workflows/${connectionId}`);
      if (!response.ok) {
        throw new Error('Failed to load workflows');
      }

      const data = await response.json();
      if (data.success) {
        setUserWorkflows(prev => ({
          ...prev,
          [connectionId]: data.workflows
        }));

        // Update connection workflow count
        setConnections(prev => prev.map(conn => 
          conn.id === connectionId 
            ? { ...conn, workflowCount: data.totalCount }
            : conn
        ));
      }
    } catch (error) {
      console.error('Failed to load workflows for connection:', connectionId, error);
    }
  }, []);

  // Sync workflows for a connection
  const syncWorkflows = useCallback(async (connectionId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/workflows/user-workflows/${connectionId}`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to sync workflows');
      }

      const data = await response.json();
      if (data.success) {
        setUserWorkflows(prev => ({
          ...prev,
          [connectionId]: data.workflows
        }));

        setConnections(prev => prev.map(conn => 
          conn.id === connectionId 
            ? { ...conn, workflowCount: data.totalCount, lastSyncAt: new Date() }
            : conn
        ));
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to sync workflows');
    } finally {
      setLoading(false);
    }
  }, []);

  // Import workflow from library to user's N8N account
  const importWorkflowToAccount = useCallback(async (
    workflow: any, 
    connectionId: string,
    options: { customName?: string; activate?: boolean } = {}
  ) => {
    try {
      setImportingWorkflow(true);
      setError(null);

      const response = await fetch('/api/workflows/import-to-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          workflowId: workflow.id,
          customName: options.customName,
          activate: options.activate || false
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to import workflow');
      }

      const result = await response.json();
      if (result.success) {
        // Refresh workflows for this connection
        await loadUserWorkflows(connectionId);
        
        // Close import dialog
        setShowImportDialog(false);
        
        // Notify parent component
        onWorkflowImport?.(workflow, connectionId);
        
        // Show success message
        alert(`Workflow "${workflow.name}" imported successfully!`);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to import workflow');
    } finally {
      setImportingWorkflow(false);
    }
  }, [onWorkflowImport, loadUserWorkflows]);

  // Initialize component
  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  // Handle selected workflow for import
  useEffect(() => {
    if (selectedWorkflowForImport && connections.length > 0) {
      setShowImportDialog(true);
    }
  }, [selectedWorkflowForImport, connections]);

  const getProviderIcon = (provider: string) => {
    return provider === 'N8N_CLOUD' ? <Cloud className="h-4 w-4" /> : <Server className="h-4 w-4" />;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'ERROR':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">N8N Account Management</h2>
          <p className="text-gray-600">
            Connect your N8N accounts to import and manage workflows
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.href = '/api/workspace/connect?provider=N8N_CLOUD'}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Connect N8N Cloud
          </button>
          <button
            onClick={() => window.open('/settings?tab=api-keys&provider=N8N_SELF_HOSTED', '_blank')}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            Connect Self-Hosted
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}

      {/* Connections List */}
      {connections.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">No N8N Accounts Connected</h3>
          <p className="text-gray-600 mb-6">
            Connect your N8N Cloud or self-hosted account to start importing and managing workflows.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => window.location.href = '/api/workspace/connect?provider=N8N_CLOUD'}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Connect N8N Cloud
            </button>
            <button
              onClick={() => window.open('/settings?tab=api-keys&provider=N8N_SELF_HOSTED', '_blank')}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              Connect Self-Hosted
            </button>
          </div>
        </div>
      ) : (
        <Tabs value={selectedConnection || connections[0]?.id} onValueChange={setSelectedConnection}>
          <TabsList className="grid w-full grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
            {connections.map((connection) => (
              <TabsTrigger key={connection.id} value={connection.id} className="flex items-center gap-2">
                {getProviderIcon(connection.provider)}
                {getStatusIcon(connection.status)}
                <span className="truncate">{connection.displayName}</span>
                {connection.workflowCount !== undefined && (
                  <Badge variant="secondary" className="ml-auto">
                    {connection.workflowCount}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {connections.map((connection) => (
            <TabsContent key={connection.id} value={connection.id}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {getProviderIcon(connection.provider)}
                        {connection.displayName}
                        {getStatusIcon(connection.status)}
                      </CardTitle>
                      <CardDescription>
                        {connection.email} • {connection.provider.replace('N8N_', '').replace('_', ' ')}
                        {connection.domain && ` • ${connection.domain}`}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncWorkflows(connection.id)}
                        disabled={loading || connection.status !== 'ACTIVE'}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Sync
                      </Button>
                      {selectedWorkflowForImport && (
                        <Button
                          size="sm"
                          onClick={() => setShowImportDialog(true)}
                          disabled={connection.status !== 'ACTIVE'}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Import Workflow
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {connection.status !== 'ACTIVE' ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        This connection is not active. Please check your credentials and try reconnecting.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold">Workflows ({userWorkflows[connection.id]?.length || 0})</h4>
                        <p className="text-sm text-muted-foreground">
                          Last synced: {connection.lastSyncAt.toLocaleString()}
                        </p>
                      </div>
                      
                      <ScrollArea className="h-[300px]">
                        {userWorkflows[connection.id]?.length > 0 ? (
                          <div className="space-y-2">
                            {userWorkflows[connection.id].map((workflow) => (
                              <div
                                key={workflow.id}
                                className="flex items-center justify-between p-3 border rounded-lg"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <h5 className="font-medium">{workflow.name}</h5>
                                    {workflow.active ? (
                                      <Play className="h-3 w-3 text-green-500" />
                                    ) : (
                                      <Pause className="h-3 w-3 text-gray-500" />
                                    )}
                                    {workflow.source === 'imported' && (
                                      <Badge variant="outline" className="text-xs">
                                        Imported
                                      </Badge>
                                    )}
                                  </div>
                                  {workflow.description && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {workflow.description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                    <span>{workflow.nodeCount} nodes</span>
                                    <span>{workflow.executionCount} executions</span>
                                    <span>Modified {workflow.lastModified.toLocaleDateString()}</span>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  {workflow.tags.map((tag) => (
                                    <Badge key={tag} variant="secondary" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Settings className="h-8 w-8 text-muted-foreground mb-2" />
                            <p className="text-muted-foreground">No workflows found</p>
                            <p className="text-sm text-muted-foreground">
                              Create workflows in your N8N account or import from the library
                            </p>
                          </div>
                        )}
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Import Dialog */}
      {showImportDialog && selectedWorkflowForImport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Import Workflow</h3>
            <p className="text-gray-600 mb-4">
              Import "{selectedWorkflowForImport.name}" to your N8N account
            </p>
            
            <div className="space-y-2 mb-4">
              <label className="text-sm font-medium">Select N8N Account</label>
              {connections.filter(conn => conn.status === 'ACTIVE').map((connection) => (
                <button
                  key={connection.id}
                  onClick={() => importWorkflowToAccount(selectedWorkflowForImport, connection.id)}
                  disabled={importingWorkflow}
                  className="w-full p-3 border rounded text-left hover:bg-gray-50 disabled:opacity-50"
                >
                  <div className="font-medium">{connection.displayName}</div>
                  <div className="text-sm text-gray-600">{connection.email}</div>
                </button>
              ))}
            </div>
            
            {connections.filter(conn => conn.status === 'ACTIVE').length === 0 && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 mb-4">
                No active N8N connections found. Please connect an N8N account first.
              </div>
            )}
            
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowImportDialog(false)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 