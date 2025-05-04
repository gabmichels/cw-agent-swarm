import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import useToolsMemory from '../../hooks/useToolsMemory';

/**
 * ToolExecution component that displays a single tool execution result
 */
interface ToolExecutionProps {
  tool: any;
  expanded: boolean;
  onToggleExpand: () => void;
}

const ToolExecution: React.FC<ToolExecutionProps> = ({ tool, expanded, onToggleExpand }) => {
  const timestamp = new Date(tool.metadata?.startTime || tool.timestamp);
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
  diagnostic: any;
  expanded: boolean;
  onToggleExpand: () => void;
}

const DiagnosticExecution: React.FC<DiagnosticExecutionProps> = ({ diagnostic, expanded, onToggleExpand }) => {
  const timestamp = new Date(diagnostic.metadata?.startTime || diagnostic.timestamp);
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
  } = useToolsMemory();
  
  // State for active tab
  const [activeTab, setActiveTab] = useState('tools');
  
  // State for tool executions
  const [toolExecutions, setToolExecutions] = useState<any[]>([]);
  const [diagnosticExecutions, setDiagnosticExecutions] = useState<any[]>([]);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  
  // Load tool and diagnostic executions
  useEffect(() => {
    const loadHistory = async () => {
      const tools = await getRecentToolExecutions(20);
      const diagnostics = await getRecentDiagnostics(20);
      
      setToolExecutions(tools);
      setDiagnosticExecutions(diagnostics);
    };
    
    loadHistory();
  }, [getRecentToolExecutions, getRecentDiagnostics]);
  
  // Toggle expanded state for an item
  const toggleExpand = (id: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  
  // Execute a diagnostic
  const handleRunDiagnostic = async (diagnosticType: string, params: any = {}) => {
    const result = await runDiagnostic(diagnosticType, params);
    
    // Refresh the list
    const diagnostics = await getRecentDiagnostics(20);
    setDiagnosticExecutions(diagnostics);
    
    return result;
  };
  
  // Execute a tool
  const handleRunTool = async (toolName: string, params: any = {}) => {
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
  
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">Tools & Diagnostics</h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="tools">Tools</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="tools" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-lg font-medium mb-4">Data Management</h2>
              <div className="space-y-2">
                <button
                  onClick={handleClearChat}
                  disabled={isExecuting}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
                >
                  Clear Chat History
                </button>
                <button
                  onClick={handleClearImages}
                  disabled={isExecuting}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
                >
                  Clear Image Cache
                </button>
                <button
                  onClick={() => handleRunTool('reset_all', { confirmationRequired: true })}
                  disabled={isExecuting}
                  className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
                >
                  Reset All Data
                </button>
              </div>
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-lg font-medium mb-4">Advanced Tools</h2>
              <div className="space-y-2">
                <button
                  onClick={() => handleRunTool('refresh_config', {})}
                  disabled={isExecuting}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white"
                >
                  Refresh Configuration
                </button>
                <button
                  onClick={() => handleRunTool('test_agent', {})}
                  disabled={isExecuting}
                  className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white"
                >
                  Test Agent
                </button>
                <button
                  onClick={() => handleRunTool('clear_markdown_cache', {})}
                  disabled={isExecuting}
                  className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-white"
                >
                  Clear Markdown Cache
                </button>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800 p-4 rounded-lg mb-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">Tool Execution History</h2>
              <button
                onClick={handleClearToolHistory}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm"
                disabled={isExecuting || toolExecutions.length === 0}
              >
                Clear History
              </button>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : toolExecutions.length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <p>No tool executions yet.</p>
                <p className="mt-2 text-sm">Run a tool to see its execution history here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {toolExecutions.map(tool => (
                  <ToolExecution
                    key={tool.id}
                    tool={tool}
                    expanded={!!expandedItems[tool.id]}
                    onToggleExpand={() => toggleExpand(tool.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="diagnostics" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-lg font-medium mb-4">System Diagnostics</h2>
              <button
                onClick={handleSystemDiagnostic}
                disabled={isExecuting}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
              >
                Run System Check
              </button>
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-lg font-medium mb-4">Chat Diagnostics</h2>
              <button
                onClick={handleChatDiagnostic}
                disabled={isExecuting}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
              >
                Run Chat Check
              </button>
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-lg font-medium mb-4">Agent Diagnostics</h2>
              <button
                onClick={handleAgentDiagnostic}
                disabled={isExecuting}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
              >
                Run Agent Check
              </button>
            </div>
          </div>
          
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">Diagnostic History</h2>
              <button
                onClick={handleClearDiagnosticHistory}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm"
                disabled={isExecuting || diagnosticExecutions.length === 0}
              >
                Clear History
              </button>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : diagnosticExecutions.length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <p>No diagnostic runs yet.</p>
                <p className="mt-2 text-sm">Run a diagnostic to see its results here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {diagnosticExecutions.map(diagnostic => (
                  <DiagnosticExecution
                    key={diagnostic.id}
                    diagnostic={diagnostic}
                    expanded={!!expandedItems[diagnostic.id]}
                    onToggleExpand={() => toggleExpand(diagnostic.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 