import { Play, Plus, RefreshCw, Search, Settings, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useWorkflows } from '../../hooks/useWorkflows';

interface WorkflowsTabProps {
  agentId?: string;
  agentName?: string;
}

const WorkflowsTab: React.FC<WorkflowsTabProps> = ({ agentId, agentName }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  
  // Use the workflows hook
  const {
    agentWorkflows,
    agentWorkflowsLoading,
    agentWorkflowsError,
    availableWorkflows,
    availableWorkflowsLoading,
    availableWorkflowsError,
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    totalPages,
    assignWorkflowToAgent,
    removeWorkflowFromAgent,
    executeWorkflow,
    toggleWorkflowStatus,
    refreshAll
  } = useWorkflows({ agentId, autoFetch: true });

  const handleExecuteWorkflow = async (workflowId: string) => {
    try {
      const executionId = await executeWorkflow(workflowId);
      console.log('Workflow executed:', executionId);
      // TODO: Show success notification
    } catch (error) {
      console.error('Failed to execute workflow:', error);
      // TODO: Show error notification
    }
  };

  const handleToggleWorkflow = async (workflowId: string, isActive: boolean) => {
    try {
      await toggleWorkflowStatus(workflowId, !isActive);
      // TODO: Show success notification
    } catch (error) {
      console.error('Failed to toggle workflow:', error);
      // TODO: Show error notification
    }
  };

  const handleRemoveWorkflow = async (workflowId: string) => {
    const confirmed = window.confirm('Are you sure you want to remove this workflow from your agent?');
    if (!confirmed) return;

    try {
      await removeWorkflowFromAgent(workflowId);
      // TODO: Show success notification
    } catch (error) {
      console.error('Failed to remove workflow:', error);
      // TODO: Show error notification
    }
  };

  const handleAssignWorkflow = async (workflowId: string) => {
    try {
      const success = await assignWorkflowToAgent(workflowId);
      if (success) {
        console.log('Workflow assigned successfully');
        // TODO: Show success notification
      }
    } catch (error) {
      console.error('Failed to assign workflow:', error);
      // TODO: Show error notification
    }
  };

  const filteredAgentWorkflows = agentWorkflows.filter(workflow => {
    if (!workflow || !localSearchQuery) return true;
    const query = localSearchQuery.toLowerCase();
    const name = (workflow.name || '').toLowerCase();
    const description = (workflow.description || '').toLowerCase();
    const category = (workflow.category || '').toLowerCase();
    return name.includes(query) || description.includes(query) || category.includes(query);
  });

  const filteredAvailableWorkflows = availableWorkflows.filter(workflow => {
    if (!workflow || !localSearchQuery) return true;
    const query = localSearchQuery.toLowerCase();
    const name = (workflow.name || '').toLowerCase();
    const description = (workflow.description || '').toLowerCase();
    const category = (workflow.category || '').toLowerCase();
    const tags = (workflow.tags || []).join(' ').toLowerCase();
    return name.includes(query) || description.includes(query) || category.includes(query) || tags.includes(query);
  });

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Agent Workflows</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={refreshAll}
              disabled={agentWorkflowsLoading || availableWorkflowsLoading}
              className="p-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 rounded-lg transition-colors"
              title="Refresh workflows"
            >
              <RefreshCw className={`h-4 w-4 ${(agentWorkflowsLoading || availableWorkflowsLoading) ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Browse Library</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search workflows..."
            value={localSearchQuery}
            onChange={(e) => setLocalSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Agent Workflows Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-green-400">
              ✓ Assigned Workflows ({filteredAgentWorkflows.length})
            </h3>
            {agentWorkflowsError && (
              <span className="text-red-400 text-sm">{agentWorkflowsError}</span>
            )}
          </div>

          {agentWorkflowsLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-blue-500 rounded-full mx-auto mb-2"></div>
              <p className="text-gray-400">Loading agent workflows...</p>
            </div>
          ) : filteredAgentWorkflows.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-4">
                {agentWorkflows.length === 0 ? (
                  <>
                    <div className="text-6xl mb-4">🔧</div>
                    <h4 className="text-lg font-medium mb-2">No Workflows Assigned</h4>
                    <p className="text-sm">Assign workflows from the library below to enable automation capabilities.</p>
                  </>
                ) : (
                  <>
                    <div className="text-6xl mb-4">🔍</div>
                    <h4 className="text-lg font-medium mb-2">No Matching Workflows</h4>
                    <p className="text-sm">Try adjusting your search terms.</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAgentWorkflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="font-medium">{workflow.name || 'Untitled Workflow'}</h4>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          (workflow.platform || 'unknown') === 'n8n'
                            ? 'bg-purple-600 text-purple-100'
                            : 'bg-orange-600 text-orange-100'
                        }`}>
                          {(workflow.platform || 'unknown').toUpperCase()}
                        </span>
                        <span className="px-2 py-1 text-xs bg-gray-600 text-gray-200 rounded-full">
                          {workflow.category || 'Uncategorized'}
                        </span>
                        <span className={`w-2 h-2 rounded-full ${
                          workflow.isActive ? 'bg-green-500' : 'bg-gray-500'
                        }`} />
                      </div>
                      <p className="text-gray-300 text-sm mb-3">{workflow.description || 'No description available'}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-400">
                        <span>Executed {workflow.executionCount || 0} times</span>
                        {workflow.lastExecuted && (
                          <span>Last: {new Date(workflow.lastExecuted).toLocaleDateString()}</span>
                        )}
                        <span>{(workflow.parameters || []).length} parameters</span>
                        {workflow.assignedAt && (
                          <span>Added: {new Date(workflow.assignedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleExecuteWorkflow(workflow.id)}
                        disabled={!workflow.isActive}
                        className="p-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded transition-colors"
                        title="Execute workflow"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggleWorkflow(workflow.id, workflow.isActive)}
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
                  {(workflow.parameters || []).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <h5 className="text-xs font-medium text-gray-400 mb-2">Parameters:</h5>
                      <div className="flex flex-wrap gap-2">
                        {(workflow.parameters || []).map((param) => (
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

        {/* Available Workflows Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-blue-400">
              + Available Workflows ({filteredAvailableWorkflows.length})
            </h3>
            {availableWorkflowsError && (
              <span className="text-red-400 text-sm">{availableWorkflowsError}</span>
            )}
          </div>

          {availableWorkflowsLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-blue-500 rounded-full mx-auto mb-2"></div>
              <p className="text-gray-400">Loading available workflows...</p>
            </div>
          ) : filteredAvailableWorkflows.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-4">
                <div className="text-6xl mb-4">📚</div>
                <h4 className="text-lg font-medium mb-2">No Available Workflows</h4>
                <p className="text-sm">
                  {localSearchQuery 
                    ? 'No workflows match your search criteria.' 
                    : 'Make sure the FastAPI server is running to discover workflows.'
                  }
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAvailableWorkflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="font-medium">{workflow.name || 'Untitled Workflow'}</h4>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          (workflow.platform || 'unknown') === 'n8n'
                            ? 'bg-purple-600 text-purple-100'
                            : 'bg-orange-600 text-orange-100'
                        }`}>
                          {(workflow.platform || 'unknown').toUpperCase()}
                        </span>
                        <span className="px-2 py-1 text-xs bg-gray-600 text-gray-200 rounded-full">
                          {workflow.category || 'Uncategorized'}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded ${
                          (workflow.complexity || 'unknown') === 'simple' 
                            ? 'bg-green-600 text-green-100'
                            : (workflow.complexity || 'unknown') === 'medium'
                            ? 'bg-yellow-600 text-yellow-100'
                            : 'bg-red-600 text-red-100'
                        }`}>
                          {workflow.complexity || 'unknown'}
                        </span>
                        <span className="text-xs text-gray-400">
                          ⭐ {workflow.popularity || 0}
                        </span>
                      </div>
                      <p className="text-gray-300 text-sm mb-3">{workflow.description || 'No description available'}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-400 mb-2">
                        <span>{workflow.nodeCount || 0} nodes</span>
                        <span>{(workflow.parameters || []).length} parameters</span>
                      </div>
                      {/* Tags */}
                      <div className="flex flex-wrap gap-1">
                        {(workflow.tags || []).slice(0, 5).map(tag => (
                          <span 
                            key={tag}
                            className="px-2 py-1 text-xs bg-gray-600 text-gray-300 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                        {(workflow.tags || []).length > 5 && (
                          <span className="text-xs text-gray-500">
                            +{(workflow.tags || []).length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleAssignWorkflow(workflow.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-medium"
                        title="Add to agent"
                      >
                        Add to Agent
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Workflow Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-4xl m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Workflow Library</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            {/* Search in modal */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search workflow library..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-4">
              {availableWorkflowsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-blue-500 rounded-full mx-auto mb-2"></div>
                  <p className="text-gray-400">Loading workflow library...</p>
                </div>
              ) : availableWorkflows.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-4xl mb-2">🚧</div>
                  <p>No workflows available</p>
                  <p className="text-sm">Make sure the FastAPI server is running</p>
                </div>
              ) : (
                availableWorkflows.map((workflow) => (
                  <div
                    key={workflow.id}
                    className="bg-gray-700 rounded-lg p-4 border border-gray-600 hover:border-gray-500 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="font-medium">{workflow.name || 'Untitled Workflow'}</h4>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            (workflow.platform || 'unknown') === 'n8n'
                              ? 'bg-purple-600 text-purple-100'
                              : 'bg-orange-600 text-orange-100'
                          }`}>
                            {(workflow.platform || 'unknown').toUpperCase()}
                          </span>
                          <span className="px-2 py-1 text-xs bg-gray-600 text-gray-200 rounded-full">
                            {workflow.category || 'Uncategorized'}
                          </span>
                        </div>
                        <p className="text-gray-300 text-sm mb-2">{workflow.description || 'No description available'}</p>
                        <div className="flex flex-wrap gap-1">
                          {(workflow.tags || []).slice(0, 3).map(tag => (
                            <span key={tag} className="px-2 py-1 text-xs bg-gray-600 text-gray-300 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          handleAssignWorkflow(workflow.id);
                          setShowAddModal(false);
                        }}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-medium"
                      >
                        Add to Agent
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowsTab; 