import React, { useState, useEffect } from 'react';
import { Play, Plus, Settings, Trash2, Search } from 'lucide-react';

interface Workflow {
  id: string;
  name: string;
  description: string;
  platform: 'n8n' | 'zapier';
  category: string;
  parameters: WorkflowParameter[];
  isActive: boolean;
  executionCount: number;
  lastExecuted?: Date;
}

interface WorkflowParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  required: boolean;
  description?: string;
  defaultValue?: any;
}

interface WorkflowsTabProps {
  agentId?: string;
  agentName?: string;
}

const WorkflowsTab: React.FC<WorkflowsTabProps> = ({ agentId, agentName }) => {
  const [assignedWorkflows, setAssignedWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Mock data for now - replace with real API calls when server is ready
  const mockWorkflows: Workflow[] = [
    {
      id: 'wf_email_automation',
      name: 'Email Automation',
      description: 'Automatically send personalized emails based on triggers',
      platform: 'n8n',
      category: 'Communication',
      parameters: [
        { name: 'to', type: 'string', required: true, description: 'Recipient email address' },
        { name: 'subject', type: 'string', required: true, description: 'Email subject' },
        { name: 'content', type: 'string', required: true, description: 'Email content' }
      ],
      isActive: true,
      executionCount: 12,
      lastExecuted: new Date('2024-01-15')
    },
    {
      id: 'wf_slack_notification',
      name: 'Slack Notification',
      description: 'Send notifications to Slack channels',
      platform: 'zapier',
      category: 'Communication',
      parameters: [
        { name: 'channel', type: 'string', required: true, description: 'Slack channel name' },
        { name: 'message', type: 'string', required: true, description: 'Message content' }
      ],
      isActive: true,
      executionCount: 8,
      lastExecuted: new Date('2024-01-14')
    },
    {
      id: 'wf_data_backup',
      name: 'Data Backup',
      description: 'Automatically backup data to cloud storage',
      platform: 'n8n',
      category: 'Automation',
      parameters: [
        { name: 'source', type: 'string', required: true, description: 'Source data location' },
        { name: 'destination', type: 'string', required: true, description: 'Backup destination' }
      ],
      isActive: false,
      executionCount: 3,
      lastExecuted: new Date('2024-01-10')
    }
  ];

  useEffect(() => {
    // Load assigned workflows for the agent
    // TODO: Replace with real API call
    setAssignedWorkflows(mockWorkflows);
  }, [agentId]);

  const handleExecuteWorkflow = async (workflowId: string) => {
    setIsLoading(true);
    try {
      // TODO: Show parameter input modal first
      console.log('Executing workflow:', workflowId);
      
      // Mock execution
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update execution count
      setAssignedWorkflows(prev => 
        prev.map(wf => 
          wf.id === workflowId 
            ? { ...wf, executionCount: wf.executionCount + 1, lastExecuted: new Date() }
            : wf
        )
      );
    } catch (error) {
      console.error('Workflow execution failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleWorkflow = async (workflowId: string) => {
    setAssignedWorkflows(prev =>
      prev.map(wf =>
        wf.id === workflowId ? { ...wf, isActive: !wf.isActive } : wf
      )
    );
  };

  const handleRemoveWorkflow = async (workflowId: string) => {
    if (confirm('Are you sure you want to remove this workflow from the agent?')) {
      setAssignedWorkflows(prev => prev.filter(wf => wf.id !== workflowId));
    }
  };

  const filteredWorkflows = assignedWorkflows.filter(workflow =>
    workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    workflow.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    workflow.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Agent Workflows</h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Workflow</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search workflows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Workflow List */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredWorkflows.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              {assignedWorkflows.length === 0 ? (
                <>
                  <div className="text-6xl mb-4">🔧</div>
                  <h3 className="text-lg font-medium mb-2">No Workflows Assigned</h3>
                  <p className="text-sm">Add workflows to enable automation capabilities for this agent.</p>
                </>
              ) : (
                <>
                  <div className="text-6xl mb-4">🔍</div>
                  <h3 className="text-lg font-medium mb-2">No Matching Workflows</h3>
                  <p className="text-sm">Try adjusting your search terms.</p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredWorkflows.map((workflow) => (
              <div
                key={workflow.id}
                className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-medium">{workflow.name}</h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        workflow.platform === 'n8n'
                          ? 'bg-purple-600 text-purple-100'
                          : 'bg-orange-600 text-orange-100'
                      }`}>
                        {workflow.platform.toUpperCase()}
                      </span>
                      <span className="px-2 py-1 text-xs bg-gray-600 text-gray-200 rounded-full">
                        {workflow.category}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${
                        workflow.isActive ? 'bg-green-500' : 'bg-gray-500'
                      }`} />
                    </div>
                    <p className="text-gray-300 text-sm mb-3">{workflow.description}</p>
                    <div className="flex items-center space-x-4 text-xs text-gray-400">
                      <span>Executed {workflow.executionCount} times</span>
                      {workflow.lastExecuted && (
                        <span>Last: {workflow.lastExecuted.toLocaleDateString()}</span>
                      )}
                      <span>{workflow.parameters.length} parameters</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleExecuteWorkflow(workflow.id)}
                      disabled={!workflow.isActive || isLoading}
                      className="p-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition-colors"
                      title="Execute workflow"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleToggleWorkflow(workflow.id)}
                      className={`p-2 rounded transition-colors ${
                        workflow.isActive
                          ? 'bg-yellow-600 hover:bg-yellow-700'
                          : 'bg-gray-600 hover:bg-gray-700'
                      }`}
                      title={workflow.isActive ? 'Disable workflow' : 'Enable workflow'}
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleRemoveWorkflow(workflow.id)}
                      className="p-2 bg-red-600 hover:bg-red-700 rounded transition-colors"
                      title="Remove workflow"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Parameters Preview */}
                {workflow.parameters.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <h4 className="text-xs font-medium text-gray-400 mb-2">Parameters:</h4>
                    <div className="flex flex-wrap gap-2">
                      {workflow.parameters.map((param) => (
                        <span
                          key={param.name}
                          className={`px-2 py-1 text-xs rounded ${
                            param.required
                              ? 'bg-red-900 text-red-200 border border-red-700'
                              : 'bg-blue-900 text-blue-200 border border-blue-700'
                          }`}
                        >
                          {param.name} ({param.type})
                          {param.required && ' *'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Workflow Modal Placeholder */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl m-4">
            <h3 className="text-lg font-semibold mb-4">Add Workflow to Agent</h3>
            <p className="text-gray-300 mb-4">
              Browse and assign workflows from the workflow library to enable automation capabilities.
            </p>
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">🚧</div>
              <p>Workflow library integration coming soon...</p>
              <p className="text-sm">Server setup required</p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
              >
                Browse Library
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowsTab; 