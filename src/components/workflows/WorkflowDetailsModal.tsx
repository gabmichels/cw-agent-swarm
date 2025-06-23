import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Tooltip } from '../ui/tooltip';
import {
  N8nWorkflowTemplate,
  WorkflowImportOptions,
  WORKFLOW_COMPLEXITY_LABELS,
  WORKFLOW_COMPLEXITY_COLORS,
  WORKFLOW_CATEGORY_ICONS
} from '../../types/workflow';

interface WorkflowDetailsModalProps {
  readonly workflow: N8nWorkflowTemplate | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onImport: (workflow: N8nWorkflowTemplate, options: WorkflowImportOptions) => Promise<void>;
  readonly isImporting?: boolean;
  readonly availableAgents?: ReadonlyArray<{ id: string; name: string }>;
}

interface WorkflowNode {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly category: string;
  readonly description: string;
  readonly position: readonly [number, number];
  readonly parameters: Record<string, unknown>;
}

interface WorkflowConnection {
  readonly source: string;
  readonly target: string;
  readonly sourceOutput: string;
  readonly targetInput: string;
}

interface WorkflowRequirement {
  readonly type: 'credential' | 'api_key' | 'configuration' | 'webhook';
  readonly name: string;
  readonly description: string;
  readonly required: boolean;
  readonly setupUrl?: string;
  readonly documentationUrl?: string;
}

/**
 * WorkflowDetailsModal - Comprehensive workflow preview and import component
 * Implements immutable state management and pure function principles
 */
export const WorkflowDetailsModal: React.FC<WorkflowDetailsModalProps> = ({
  workflow,
  isOpen,
  onClose,
  onImport,
  isImporting = false,
  availableAgents = []
}) => {
  const [importOptions, setImportOptions] = React.useState<WorkflowImportOptions>({
    customName: '',
    assignToAgent: '',
    enabledByDefault: true,
    customTags: [],
    triggerSettings: {}
  });

  const [activeTab, setActiveTab] = React.useState<'overview' | 'nodes' | 'requirements' | 'import'>('overview');

  // Reset options when workflow changes
  React.useEffect(() => {
    if (workflow) {
      setImportOptions({
        customName: workflow.name,
        assignToAgent: '',
        enabledByDefault: true,
        customTags: [...workflow.tags],
        triggerSettings: {}
      });
    }
  }, [workflow]);

  const handleImportOptionChange = React.useCallback((updates: Partial<WorkflowImportOptions>): void => {
    setImportOptions(prev => ({ ...prev, ...updates }));
  }, []);

  const handleImport = React.useCallback(async (): Promise<void> => {
    if (!workflow) return;
    
    try {
      await onImport(workflow, importOptions);
      onClose();
    } catch (error) {
      console.error('Failed to import workflow:', error);
    }
  }, [workflow, importOptions, onImport, onClose]);

  const handleAddTag = React.useCallback((tag: string): void => {
    if (tag.trim() && !importOptions.customTags?.includes(tag.trim())) {
      handleImportOptionChange({
        customTags: [...(importOptions.customTags || []), tag.trim()]
      });
    }
  }, [importOptions.customTags, handleImportOptionChange]);

  const handleRemoveTag = React.useCallback((tagToRemove: string): void => {
    handleImportOptionChange({
      customTags: importOptions.customTags?.filter(tag => tag !== tagToRemove) || []
    });
  }, [importOptions.customTags, handleImportOptionChange]);

  // Mock workflow analysis (in real implementation, this would come from the API)
  const mockNodes: ReadonlyArray<WorkflowNode> = React.useMemo(() => {
    if (!workflow) return [];
    
    return [
      {
        id: 'trigger-1',
        type: 'webhook',
        name: 'Webhook Trigger',
        category: 'trigger',
        description: 'Receives incoming webhook requests',
        position: [100, 100],
        parameters: { httpMethod: 'POST', path: '/webhook' }
      },
      {
        id: 'process-1',
        type: 'function',
        name: 'Process Data',
        category: 'transform',
        description: 'Transforms incoming data',
        position: [300, 100],
        parameters: { code: 'return items.map(item => ({ ...item, processed: true }));' }
      },
      {
        id: 'output-1',
        type: 'http-request',
        name: 'Send to API',
        category: 'action',
        description: 'Sends processed data to external API',
        position: [500, 100],
        parameters: { method: 'POST', url: 'https://api.example.com/data' }
      }
    ];
  }, [workflow]);

  const mockConnections: ReadonlyArray<WorkflowConnection> = React.useMemo(() => [
    { source: 'trigger-1', target: 'process-1', sourceOutput: 'main', targetInput: 'main' },
    { source: 'process-1', target: 'output-1', sourceOutput: 'main', targetInput: 'main' }
  ], []);

  const mockRequirements: ReadonlyArray<WorkflowRequirement> = React.useMemo(() => {
    if (!workflow) return [];
    
    return [
      {
        type: 'api_key',
        name: 'External API Key',
        description: 'API key for the external service integration',
        required: true,
        setupUrl: '/settings/api-keys',
        documentationUrl: 'https://docs.example.com/api-keys'
      },
      {
        type: 'webhook',
        name: 'Webhook Endpoint',
        description: 'Public webhook URL for receiving triggers',
        required: true,
        setupUrl: '/settings/webhooks'
      },
      {
        type: 'configuration',
        name: 'Rate Limiting',
        description: 'Configure rate limits for API calls',
        required: false,
        setupUrl: '/settings/rate-limits'
      }
    ];
  }, [workflow]);

  if (!workflow) return null;

  const complexityColor = WORKFLOW_COMPLEXITY_COLORS[workflow.complexity];
  const categoryIcon = WORKFLOW_CATEGORY_ICONS[workflow.category];
  const complexityLabel = WORKFLOW_COMPLEXITY_LABELS[workflow.complexity];

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{categoryIcon}</span>
              <div>
                <DialogTitle className="text-xl">{workflow.name}</DialogTitle>
                <DialogDescription className="text-sm text-gray-600 mt-1">
                  {workflow.description}
                </DialogDescription>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge className={complexityColor}>
                {complexityLabel}
              </Badge>
              <Badge variant="outline">
                {workflow.nodeCount} nodes
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'nodes', label: `Nodes (${mockNodes.length})` },
            { id: 'requirements', label: `Requirements (${mockRequirements.length})` },
            { id: 'import', label: 'Import Settings' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Workflow Metadata */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Workflow Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Category:</span>
                      <p className="text-gray-900">{workflow.category.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Complexity:</span>
                      <p className="text-gray-900">{complexityLabel}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Node Count:</span>
                      <p className="text-gray-900">{workflow.nodeCount}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Trigger Type:</span>
                      <p className="text-gray-900">{workflow.triggerType}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Last Updated:</span>
                      <p className="text-gray-900">
                        {workflow.updatedAt ? formatDate(workflow.updatedAt) : 'Unknown'}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Status:</span>
                      <p className="text-gray-900">{workflow.active ? 'Active' : 'Inactive'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Integrations */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Integrations ({workflow.integrations.length})</CardTitle>
                  <CardDescription>External services used by this workflow</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {workflow.integrations.map((integration) => (
                      <Badge key={integration} variant="secondary" className="text-sm">
                        {integration}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Tags */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tags ({workflow.tags.length})</CardTitle>
                  <CardDescription>Workflow categorization and keywords</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {workflow.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-sm">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'nodes' && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600 mb-4">
                This workflow contains {mockNodes.length} nodes connected in sequence.
              </div>
              
              {mockNodes.map((node, index) => (
                <Card key={node.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <CardTitle className="text-base">{node.name}</CardTitle>
                          <CardDescription className="text-sm">{node.type}</CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {node.category}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-gray-600 mb-3">{node.description}</p>
                    
                    {Object.keys(node.parameters).length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <h4 className="text-xs font-medium text-gray-700 mb-2">Configuration:</h4>
                        <div className="space-y-1">
                          {Object.entries(node.parameters).map(([key, value]) => (
                            <div key={key} className="flex justify-between text-xs">
                              <span className="text-gray-600">{key}:</span>
                              <span className="text-gray-900 font-mono">
                                {typeof value === 'string' ? value : JSON.stringify(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                  
                  {index < mockNodes.length - 1 && (
                    <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-0.5 h-8 bg-gray-300"></div>
                  )}
                </Card>
              ))}
            </div>
          )}

          {activeTab === 'requirements' && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600 mb-4">
                Review the requirements needed to run this workflow successfully.
              </div>
              
              {mockRequirements.map((requirement) => (
                <Card key={requirement.name} className={requirement.required ? 'border-orange-200' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          requirement.required 
                            ? 'bg-orange-100 text-orange-800' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {requirement.required ? '!' : '?'}
                        </div>
                        <div>
                          <CardTitle className="text-base">{requirement.name}</CardTitle>
                          <CardDescription className="text-sm">{requirement.description}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={requirement.required ? 'destructive' : 'secondary'} className="text-xs">
                          {requirement.required ? 'Required' : 'Optional'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {requirement.type}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  
                  {(requirement.setupUrl || requirement.documentationUrl) && (
                    <CardContent className="pt-0">
                      <div className="flex gap-2">
                        {requirement.setupUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(requirement.setupUrl, '_blank')}
                          >
                            Configure
                          </Button>
                        )}
                        {requirement.documentationUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(requirement.documentationUrl, '_blank')}
                          >
                            Documentation
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}

          {activeTab === 'import' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Import Configuration</CardTitle>
                  <CardDescription>Customize how this workflow will be imported</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Custom Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Workflow Name
                    </label>
                    <Input
                      value={importOptions.customName || ''}
                      onChange={(e) => handleImportOptionChange({ customName: e.target.value })}
                      placeholder="Enter custom workflow name"
                    />
                  </div>

                  {/* Agent Assignment */}
                  {availableAgents.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Assign to Agent
                      </label>
                      <select
                        value={importOptions.assignToAgent || ''}
                        onChange={(e) => handleImportOptionChange({ assignToAgent: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">No specific agent</option>
                        {availableAgents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Enable by Default */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="enabledByDefault"
                      checked={importOptions.enabledByDefault || false}
                      onChange={(e) => handleImportOptionChange({ enabledByDefault: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="enabledByDefault" className="ml-2 block text-sm text-gray-700">
                      Enable workflow by default after import
                    </label>
                  </div>

                  {/* Custom Tags */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {importOptions.customTags?.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-sm">
                          {tag}
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-1 hover:text-red-600"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <Input
                      placeholder="Add a tag and press Enter"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const input = e.target as HTMLInputElement;
                          handleAddTag(input.value);
                          input.value = '';
                        }
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>File: {workflow.filename}</span>
            <span>•</span>
            <span>ID: {workflow.id.toString().slice(0, 8)}...</span>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose} disabled={isImporting}>
              Cancel
            </Button>
            
            <Button
              variant="outline"
              onClick={() => window.open(workflow.downloadUrl, '_blank')}
              disabled={isImporting}
            >
              Download JSON
            </Button>
            
            <Button
              onClick={handleImport}
              disabled={isImporting || !importOptions.customName?.trim()}
            >
              {isImporting ? 'Importing...' : 'Import Workflow'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WorkflowDetailsModal; 