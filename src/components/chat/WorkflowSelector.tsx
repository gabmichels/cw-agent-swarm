import { ExternalLink, Play, Plus, Settings } from 'lucide-react';
import React, { useEffect, useRef } from 'react';
import { AgentWorkflow, AvailableWorkflow } from '../../hooks/useWorkflows';

interface WorkflowSelectorProps {
  isOpen: boolean;
  searchQuery: string;
  workflows: AgentWorkflow[]; // Agent-assigned workflows
  availableWorkflows?: AvailableWorkflow[]; // Available workflows from discovery
  selectedIndex: number;
  onSelect: (workflow: AgentWorkflow | AvailableWorkflow) => void;
  onClose: () => void;
  onNavigateToWorkflowsTab: () => void;
  onAddWorkflow?: (workflow: AvailableWorkflow) => void; // New prop for adding workflows
  position?: { top: number; left: number };
}

const WorkflowSelector: React.FC<WorkflowSelectorProps> = ({
  isOpen,
  searchQuery,
  workflows,
  availableWorkflows = [],
  selectedIndex,
  onSelect,
  onClose,
  onNavigateToWorkflowsTab,
  onAddWorkflow,
  position = { top: 0, left: 0 }
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter agent workflows based on search query
  const filteredAgentWorkflows = workflows.filter(workflow => {
    if (!workflow || !searchQuery) return true;
    
    const queryLower = searchQuery.toLowerCase();
    const name = (workflow.name || '').toLowerCase();
    const description = (workflow.description || '').toLowerCase();
    const category = (workflow.category || '').toLowerCase();
    
    // Direct text matching
    const directMatch = name.includes(queryLower) || 
                       description.includes(queryLower) || 
                       category.includes(queryLower);
    
    // Email-related keyword expansion
    if (queryLower === 'email' || queryLower === 'mail') {
      const emailKeywords = ['gmail', 'email', 'mail', 'smtp', 'outlook', 'send', 'notification'];
      const hasEmailKeyword = emailKeywords.some(keyword => 
        name.includes(keyword) || description.includes(keyword)
      );
      return directMatch || hasEmailKeyword;
    }
    
    return directMatch;
  });

  // Filter available workflows (exclude already assigned ones)
  const filteredAvailableWorkflows = availableWorkflows.filter(workflow => {
    if (!workflow) return false;
    
    const queryLower = (searchQuery || '').toLowerCase();
    const name = (workflow.name || '').toLowerCase();
    const description = (workflow.description || '').toLowerCase();
    const category = (workflow.category || '').toLowerCase();
    
    // Don't show workflows that are already assigned
    const isAlreadyAssigned = workflows.some(agentWf => agentWf && agentWf.id === workflow.id);
    if (isAlreadyAssigned) return false;
    
    // Apply search filter
    const directMatch = name.includes(queryLower) || 
                       description.includes(queryLower) || 
                       category.includes(queryLower) ||
                       (workflow.tags || []).some(tag => (tag || '').toLowerCase().includes(queryLower));
    
    // Email-related keyword expansion
    if (queryLower === 'email' || queryLower === 'mail') {
      const emailKeywords = ['gmail', 'email', 'mail', 'smtp', 'outlook', 'send', 'notification'];
      const hasEmailKeyword = emailKeywords.some(keyword => 
        name.includes(keyword) || description.includes(keyword) ||
        (workflow.tags || []).some(tag => (tag || '').toLowerCase().includes(keyword))
      );
      return directMatch || hasEmailKeyword;
    }
    
    return directMatch;
  });

  // Combine all workflows for navigation
  const allFilteredWorkflows = [...filteredAgentWorkflows, ...filteredAvailableWorkflows];

  // Debug logging
  console.log('WorkflowSelector:', {
    isOpen,
    searchQuery,
    agentWorkflows: filteredAgentWorkflows.length,
    availableWorkflows: filteredAvailableWorkflows.length,
    total: allFilteredWorkflows.length
  });

  // Handle clicks outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (containerRef.current && selectedIndex >= 0) {
      const selectedElement = containerRef.current.children[selectedIndex + 1] as HTMLElement; // +1 for header
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const handleAddWorkflow = (workflow: AvailableWorkflow, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAddWorkflow) {
      onAddWorkflow(workflow);
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed z-[9999] bg-gray-800 border border-gray-600 rounded-lg shadow-lg min-w-80 max-w-96"
      style={{
        top: position.top - 320, // Position above the input
        left: position.left,
        maxHeight: '300px',
        overflowY: 'auto'
      }}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-700 bg-gray-750">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-200">
            {searchQuery ? `Workflows matching "${searchQuery}"` : 'Available Workflows'}
          </span>
          <span className="text-xs text-gray-400">
            {allFilteredWorkflows.length} found
          </span>
        </div>
      </div>

      {/* Workflow List */}
      {allFilteredWorkflows.length === 0 ? (
        <div className="px-3 py-4 text-center">
          <div className="text-gray-400 mb-3">
            <div className="text-3xl mb-2">🔍</div>
            <p className="text-sm">
              {searchQuery ? 'No workflows match your search' : 'No workflows available'}
            </p>
          </div>
          <button
            onClick={onNavigateToWorkflowsTab}
            className="flex items-center space-x-2 text-blue-400 hover:text-blue-300 text-sm"
          >
            <span>Add workflows to your agent</span>
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <>
          {/* Agent Workflows Section */}
          {filteredAgentWorkflows.length > 0 && (
            <>
              <div className="px-3 py-1 bg-gray-750 border-b border-gray-700">
                <span className="text-xs font-medium text-green-400">
                  ✓ Your Agent's Workflows ({filteredAgentWorkflows.length})
                </span>
              </div>
              {filteredAgentWorkflows.map((workflow, index) => (
                <div
                  key={workflow.id}
                  onClick={() => onSelect(workflow)}
                  className={`px-3 py-2 cursor-pointer transition-colors ${
                    index === selectedIndex
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-gray-700 text-gray-200'
                  }`}
                >
                  <div className="flex items-center">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-medium truncate">{workflow.name || 'Untitled Workflow'}</span>
                        <span className={`px-1.5 py-0.5 text-xs rounded ${
                          (workflow.platform || 'unknown') === 'n8n'
                            ? 'bg-purple-600 text-purple-100'
                            : 'bg-orange-600 text-orange-100'
                        }`}>
                          {(workflow.platform || 'unknown').toUpperCase()}
                        </span>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          workflow.isActive ? 'bg-green-500' : 'bg-gray-500'
                        }`} />
                      </div>
                      <p className="text-xs text-gray-400 truncate mb-1">
                        {workflow.description || 'No description available'}
                      </p>
                      <div className="flex items-center space-x-3 text-xs text-gray-500">
                        <span>{workflow.category || 'Uncategorized'}</span>
                        <span>{(workflow.parameters || []).length} parameters</span>
                        {(workflow.parameters || []).some(p => p && p.required) && (
                          <span className="text-red-400">*required</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 ml-2">
                      {workflow.isActive ? (
                        <Play className="h-3 w-3 text-green-500" />
                      ) : (
                        <Settings className="h-3 w-3 text-gray-500" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Available Workflows Section */}
          {filteredAvailableWorkflows.length > 0 && (
            <>
              <div className="px-3 py-1 bg-gray-750 border-b border-gray-700">
                <span className="text-xs font-medium text-blue-400">
                  + Available to Add ({filteredAvailableWorkflows.length})
                </span>
              </div>
              {filteredAvailableWorkflows.map((workflow, index) => {
                const adjustedIndex = index + filteredAgentWorkflows.length;
                return (
                  <div
                    key={workflow.id}
                    onClick={() => onSelect(workflow)}
                    className={`px-3 py-2 cursor-pointer transition-colors group relative ${
                      adjustedIndex === selectedIndex
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-gray-700 text-gray-200'
                    }`}
                  >
                    <div className="flex items-center">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium truncate">{workflow.name || 'Untitled Workflow'}</span>
                          <span className={`px-1.5 py-0.5 text-xs rounded ${
                            (workflow.platform || 'unknown') === 'n8n'
                              ? 'bg-purple-600 text-purple-100'
                              : 'bg-orange-600 text-orange-100'
                          }`}>
                            {(workflow.platform || 'unknown').toUpperCase()}
                          </span>
                          <span className={`px-1 py-0.5 text-xs rounded ${
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
                        <p className="text-xs text-gray-400 truncate mb-1">
                          {workflow.description || 'No description available'}
                        </p>
                        <div className="flex items-center space-x-3 text-xs text-gray-500">
                          <span>{workflow.category || 'Uncategorized'}</span>
                          <span>{workflow.nodeCount || 0} nodes</span>
                          <span>{(workflow.parameters || []).length} parameters</span>
                        </div>
                        {/* Tags */}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(workflow.tags || []).slice(0, 3).map(tag => (
                            <span 
                              key={tag}
                              className="px-1 py-0.5 text-xs bg-gray-600 text-gray-300 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                          {(workflow.tags || []).length > 3 && (
                            <span className="text-xs text-gray-500">
                              +{(workflow.tags || []).length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Add Button - appears on hover */}
                      <div className="flex items-center space-x-1 ml-2">
                        <button
                          onClick={(e) => handleAddWorkflow(workflow, e)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-green-600 hover:bg-green-700 rounded text-white"
                          title="Add to agent"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
          
          {/* Footer */}
          <div className="px-3 py-2 border-t border-gray-700 bg-gray-750">
            <button
              onClick={onNavigateToWorkflowsTab}
              className="flex items-center space-x-2 text-blue-400 hover:text-blue-300 text-xs w-full"
            >
              <span>Browse all workflows in the Workflows tab</span>
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </>
      )}

      {/* Keyboard hints */}
      {allFilteredWorkflows.length > 0 && (
        <div className="px-3 py-1 border-t border-gray-700 bg-gray-750 text-xs text-gray-500">
          <div className="flex items-center space-x-4">
            <span>↑↓ navigate</span>
            <span>↵ select</span>
            <span>esc close</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowSelector; 