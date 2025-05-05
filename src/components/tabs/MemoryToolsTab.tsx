import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import useToolsMemory from '../../hooks/useToolsMemory';

/**
 * ToolExecution component that displays a single tool execution result
 */
interface ToolExecutionProps {
  tool: {
    id: string;
    metadata?: {
      toolName?: string;
      status?: string;
      startTime?: string;
      duration?: number;
      result?: Record<string, unknown>;
      params?: Record<string, unknown>;
    };
    timestamp?: string;
  };
  expanded: boolean;
  onToggleExpand: () => void;
}

const ToolExecution: React.FC<ToolExecutionProps> = ({ tool, expanded, onToggleExpand }) => {
  const timestamp = new Date(tool.metadata?.startTime || tool.timestamp || Date.now());
  const status = tool.metadata?.status || 'unknown';
  const toolName = tool.metadata?.toolName || 'Unknown Tool';
  const duration = tool.metadata?.duration ? `${(tool.metadata.duration / 1000).toFixed(2)}s` : 'N/A';
  const result = tool.metadata?.result || {};
  
  return (
    <div className="border border-gray-700 rounded-md mb-3 overflow-hidden">
      <div 
        className={`p-3 cursor-pointer flex justify-between items-center ${
          status === 'completed' ? 'bg-green-900/20' : 
          status === 'failed' ? 'bg-red-900/20' : 'bg-blue-900/20'
        }`}
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">
            {status === 'completed' ? '✅' : status === 'failed' ? '❌' : '🔄'}
          </span>
          <div>
            <h3 className="font-medium">{toolName}</h3>
            <p className="text-xs text-gray-400">
              {timestamp.toLocaleString()} • Duration: {duration}
            </p>
          </div>
        </div>
        <span className="text-gray-400">
          {expanded ? '▼' : '►'}
        </span>
      </div>
      
      {expanded && (
        <div className="p-3 bg-gray-800">
          <h4 className="text-sm font-medium mb-2">Parameters:</h4>
          <pre className="bg-gray-900 p-2 rounded text-xs overflow-x-auto mb-3">
            {JSON.stringify(tool.metadata?.params || {}, null, 2)}
          </pre>
          
          <h4 className="text-sm font-medium mb-2">Result:</h4>
          <pre className="bg-gray-900 p-2 rounded text-xs overflow-x-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

/**
 * DiagnosticExecution component that displays a single diagnostic execution result
 */
interface DiagnosticExecutionProps {
  diagnostic: {
    id: string;
    metadata?: {
      diagnosticType?: string;
      status?: string;
      startTime?: string;
      duration?: number;
      result?: Record<string, unknown>;
      params?: Record<string, unknown>;
    };
    timestamp?: string;
  };
  expanded: boolean;
  onToggleExpand: () => void;
}

const DiagnosticExecution: React.FC<DiagnosticExecutionProps> = ({ diagnostic, expanded, onToggleExpand }) => {
  const timestamp = new Date(diagnostic.metadata?.startTime || diagnostic.timestamp || Date.now());
  const status = diagnostic.metadata?.status || 'unknown';
  const diagnosticType = diagnostic.metadata?.diagnosticType || 'Unknown Diagnostic';
  const duration = diagnostic.metadata?.duration ? `${(diagnostic.metadata.duration / 1000).toFixed(2)}s` : 'N/A';
  const result = diagnostic.metadata?.result || {};
  
  return (
    <div className="border border-gray-700 rounded-md mb-3 overflow-hidden">
      <div 
        className={`p-3 cursor-pointer flex justify-between items-center ${
          status === 'completed' ? 'bg-green-900/20' : 
          status === 'failed' ? 'bg-red-900/20' : 'bg-blue-900/20'
        }`}
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">
            {status === 'completed' ? '✅' : status === 'failed' ? '❌' : '🔄'}
          </span>
          <div>
            <h3 className="font-medium">{diagnosticType}</h3>
            <p className="text-xs text-gray-400">
              {timestamp.toLocaleString()} • Duration: {duration}
            </p>
          </div>
        </div>
        <span className="text-gray-400">
          {expanded ? '▼' : '►'}
        </span>
      </div>
      
      {expanded && (
        <div className="p-3 bg-gray-800">
          <h4 className="text-sm font-medium mb-2">Parameters:</h4>
          <pre className="bg-gray-900 p-2 rounded text-xs overflow-x-auto mb-3">
            {JSON.stringify(diagnostic.metadata?.params || {}, null, 2)}
          </pre>
          
          <h4 className="text-sm font-medium mb-2">Result:</h4>
          <pre className="bg-gray-900 p-2 rounded text-xs overflow-x-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

/**
 * MemoryToolsTab component that uses the memory system to track tools and diagnostics
 */
export default function MemoryToolsTab() {
  // Use the tools memory hook
  const {
    toolsMemories,
    isLoading,
    error,
    isExecuting,
    diagnosticResults,
    runDiagnostic,
    getRecentDiagnostics,
    clearDiagnosticHistory,
    toolResults,
    executeTool,
    getRecentToolExecutions,
    clearToolHistory,
    initialize
  } = useToolsMemory();
  
  // State for active tab
  const [activeTab, setActiveTab] = useState('tools');
  
  // State for tool executions
  const [toolExecutions, setToolExecutions] = useState<Array<{id: string; [key: string]: unknown}>>([]);
  const [diagnosticExecutions, setDiagnosticExecutions] = useState<Array<{id: string; [key: string]: unknown}>>([]);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  
  // Load tool and diagnostic executions - only when the component is mounted
  useEffect(() => {
    const loadHistory = async () => {
      // Initialize the memory system first
      await initialize();
      
      const tools = await getRecentToolExecutions(20);
      const diagnostics = await getRecentDiagnostics(20);
      
      setToolExecutions(tools);
      setDiagnosticExecutions(diagnostics);
    };
    
    loadHistory();
  }, [getRecentToolExecutions, getRecentDiagnostics, initialize]); // Add initialize to dependencies
  
  // Toggle expanded state for an item
  const toggleExpand = (id: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  
  // Execute a diagnostic
  const handleRunDiagnostic = async (diagnosticType: string, params: Record<string, unknown> = {}) => {
    const result = await runDiagnostic(diagnosticType, params);
    
    // Refresh the list
    const diagnostics = await getRecentDiagnostics(20);
    setDiagnosticExecutions(diagnostics);
    
    return result;
  };
  
  // Execute a tool
  const handleRunTool = async (toolName: string, params: Record<string, unknown> = {}) => {
    const result = await executeTool(toolName, params);
    
    // Refresh the list
    const tools = await getRecentToolExecutions(20);
    setToolExecutions(tools);
    
    return result;
  };
  
  // Clear tool history
  const handleClearToolHistory = async () => {
    const success = await clearToolHistory();
    if (success) {
      setToolExecutions([]);
    }
  };
  
  // Clear diagnostic history
  const handleClearDiagnosticHistory = async () => {
    const success = await clearDiagnosticHistory();
    if (success) {
      setDiagnosticExecutions([]);
    }
  };

  // Run system diagnostic
  const handleSystemDiagnostic = async () => {
    return handleRunDiagnostic('system', {
      checkMemory: true,
      checkDisk: true,
      checkNetwork: true,
      checkRuntime: true
    });
  };
  
  // Run chat diagnostic
  const handleChatDiagnostic = async () => {
    return handleRunDiagnostic('chat', {
      checkMessageCounts: true,
      checkConversationStructure: true,
      checkResponseTimes: true
    });
  };
  
  // Run agent diagnostic
  const handleAgentDiagnostic = async () => {
    return handleRunDiagnostic('agent', {
      checkAgentStatus: true,
      checkConfigurationIntegrity: true,
      checkToolAvailability: true
    });
  };
  
  // Clear chat history
  const handleClearChat = async () => {
    return handleRunTool('clear_chat', {
      confirmationRequired: true
    });
  };

  // Clear image cache
  const handleClearImages = async () => {
    return handleRunTool('clear_images', {
      confirmationRequired: true
    });
  };
  
  // Reset all data
  const handleResetAll = async () => {
    return handleRunTool('reset_all', {
      confirmationRequired: true
    });
  };

  // Clear markdown cache
  const handleClearMarkdownCache = async () => {
    if (!confirm('Are you sure you want to clear the markdown cache? This will force all markdown files to be reprocessed and re-indexed on next load.')) {
      return;
    }
    
    try {
      // Make the API request to clear markdown cache using the App Router endpoint
      const response = await fetch('/api/debug/clear-markdown-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('Successfully cleared markdown cache. Files will be re-ingested on next reload.');
        console.log('Markdown cache cleared successfully:', data);
      } else {
        alert(`Failed to clear markdown cache: ${data.error || 'Unknown error'}`);
        console.error('Error clearing markdown cache:', data);
      }
    } catch (error) {
      console.error('Error clearing markdown cache:', error);
      alert('An error occurred while clearing markdown cache. See console for details.');
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 w-[400px] mb-4">
          <TabsTrigger value="tools">Tools</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="tools" className="space-y-4">
          <div className="bg-gray-800 p-4 rounded-lg">
            <h2 className="text-lg font-medium mb-4">Available Tools</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <button
                onClick={handleClearChat}
                disabled={isExecuting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
              >
                Clear Chat History
              </button>
              <button
                onClick={handleClearImages}
                disabled={isExecuting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
              >
                Clear Images
              </button>
              <button
                onClick={handleResetAll}
                disabled={isExecuting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
              >
                Reset All Data
              </button>
              <button
                onClick={handleClearToolHistory}
                disabled={isExecuting}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white"
              >
                Clear Tool History
              </button>
              <button
                onClick={handleClearMarkdownCache}
                disabled={isExecuting}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-white"
              >
                Clear Markdown Cache
              </button>
            </div>
          </div>
          
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">Tool Execution History</h2>
              {isLoading && <span className="text-sm text-gray-400">Loading...</span>}
            </div>
            
            {toolExecutions.length > 0 ? (
              <div className="max-h-96 overflow-y-auto">
                {toolExecutions.map(tool => (
                  <ToolExecution
                    key={tool.id}
                    tool={tool as ToolExecutionProps['tool']}
                    expanded={!!expandedItems[tool.id]}
                    onToggleExpand={() => toggleExpand(tool.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-gray-400">No tool executions found.</p>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="diagnostics" className="space-y-4">
          <div className="bg-gray-800 p-4 rounded-lg">
            <h2 className="text-lg font-medium mb-4">Available Diagnostics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <button
                onClick={handleSystemDiagnostic}
                disabled={isExecuting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
              >
                System Diagnostic
              </button>
              <button
                onClick={handleChatDiagnostic}
                disabled={isExecuting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
              >
                Chat Diagnostic
              </button>
              <button
                onClick={handleAgentDiagnostic}
                disabled={isExecuting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
              >
                Agent Diagnostic
              </button>
              <button
                onClick={handleClearDiagnosticHistory}
                disabled={isExecuting}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-white"
              >
                Clear Diagnostic History
              </button>
            </div>
          </div>
          
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">Diagnostic History</h2>
              {isLoading && <span className="text-sm text-gray-400">Loading...</span>}
            </div>
            
            {diagnosticExecutions.length > 0 ? (
              <div className="max-h-96 overflow-y-auto">
                {diagnosticExecutions.map(diagnostic => (
                  <DiagnosticExecution
                    key={diagnostic.id}
                    diagnostic={diagnostic as DiagnosticExecutionProps['diagnostic']}
                    expanded={!!expandedItems[diagnostic.id]}
                    onToggleExpand={() => toggleExpand(diagnostic.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-gray-400">No diagnostics found.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 