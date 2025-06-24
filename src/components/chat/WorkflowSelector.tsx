import React, { useEffect, useRef } from 'react';
import { Play, Settings, ExternalLink } from 'lucide-react';

interface Workflow {
  id: string;
  name: string;
  description: string;
  platform: 'n8n' | 'zapier';
  category: string;
  parameters: WorkflowParameter[];
  isActive: boolean;
}

interface WorkflowParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  required: boolean;
  description?: string;
}

interface WorkflowSelectorProps {
  isOpen: boolean;
  searchQuery: string;
  workflows: Workflow[];
  selectedIndex: number;
  onSelect: (workflow: Workflow) => void;
  onClose: () => void;
  onNavigateToWorkflowsTab: () => void;
  position?: { top: number; left: number };
}

const WorkflowSelector: React.FC<WorkflowSelectorProps> = ({
  isOpen,
  searchQuery,
  workflows,
  selectedIndex,
  onSelect,
  onClose,
  onNavigateToWorkflowsTab,
  position = { top: 0, left: 0 }
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter workflows based on search query
  const filteredWorkflows = workflows.filter(workflow => {
    const queryLower = searchQuery.toLowerCase();
    const name = workflow.name.toLowerCase();
    const description = workflow.description.toLowerCase();
    const category = workflow.category.toLowerCase();
    
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

  // Debug logging
  console.log('WorkflowSelector:', {
    isOpen,
    searchQuery,
    totalWorkflows: workflows.length,
    filteredWorkflows: filteredWorkflows.length,
    filtered: filteredWorkflows.map(w => ({ name: w.name, desc: w.description.slice(0, 50) }))
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
            {filteredWorkflows.length} found
          </span>
        </div>
      </div>

      {/* Workflow List */}
      <div className="py-1">
        {filteredWorkflows.length === 0 ? (
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
            {filteredWorkflows.map((workflow, index) => (
              <div
                key={workflow.id}
                onClick={() => onSelect(workflow)}
                className={`px-3 py-2 cursor-pointer transition-colors ${
                  index === selectedIndex
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-700 text-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-medium truncate">{workflow.name}</span>
                      <span className={`px-1.5 py-0.5 text-xs rounded ${
                        workflow.platform === 'n8n'
                          ? 'bg-purple-600 text-purple-100'
                          : 'bg-orange-600 text-orange-100'
                      }`}>
                        {workflow.platform.toUpperCase()}
                      </span>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        workflow.isActive ? 'bg-green-500' : 'bg-gray-500'
                      }`} />
                    </div>
                    <p className="text-xs text-gray-400 truncate mb-1">
                      {workflow.description}
                    </p>
                    <div className="flex items-center space-x-3 text-xs text-gray-500">
                      <span>{workflow.category}</span>
                      <span>{workflow.parameters.length} parameters</span>
                      {workflow.parameters.some(p => p.required) && (
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
            
            {/* Footer */}
            <div className="px-3 py-2 border-t border-gray-700 bg-gray-750">
              <button
                onClick={onNavigateToWorkflowsTab}
                className="flex items-center space-x-2 text-blue-400 hover:text-blue-300 text-xs w-full"
              >
                <span>Missing workflows? Add them to your agent</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Keyboard hints */}
      {filteredWorkflows.length > 0 && (
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