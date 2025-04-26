import React from 'react';
import { Message } from '../../types';

interface ToolsTabProps {
  isLoading: boolean;
  checkChloe: () => void;
  runDiagnostics: () => void;
  inspectChloeMemory: () => void;
  resetChatHistory: () => void;
  testChloeAgent: () => void;
  showFixInstructions: () => void;
  runDirectMarketScan: () => void;
  diagnosticResults: any;
  chloeCheckResults: any;
  fixInstructions: any;
  isDebugMode: boolean;
}

const ToolsTab: React.FC<ToolsTabProps> = ({
  isLoading,
  checkChloe,
  runDiagnostics,
  inspectChloeMemory,
  resetChatHistory,
  testChloeAgent,
  showFixInstructions,
  runDirectMarketScan,
  diagnosticResults,
  chloeCheckResults,
  fixInstructions,
  isDebugMode,
}) => {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-xl font-bold mb-4">Tools & Diagnostics</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-gray-700 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Agent Diagnostics</h3>
          <p className="text-sm text-gray-300 mb-4">Run tests to check Chloe's configuration and functionality.</p>
          <div className="flex space-x-2">
            <button
              onClick={checkChloe}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
              disabled={isLoading}
            >
              Check Agent
            </button>
            <button 
              onClick={runDiagnostics}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
              disabled={isLoading}
            >
              Run Diagnostics
            </button>
          </div>
        </div>
        
        <div className="bg-gray-700 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Memory Management</h3>
          <p className="text-sm text-gray-300 mb-4">Examine and manage Chloe's memory system.</p>
          <div className="flex space-x-2">
            <button
              onClick={inspectChloeMemory}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
              disabled={isLoading}
            >
              Inspect Memory
            </button>
            <button
              onClick={resetChatHistory}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm"
              disabled={isLoading}
            >
              Reset Chat
            </button>
          </div>
        </div>
        
        <div className="bg-gray-700 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Test Connection</h3>
          <p className="text-sm text-gray-300 mb-4">Test Chloe's connection to backend services.</p>
          <div className="flex space-x-2">
            <button
              onClick={testChloeAgent}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
              disabled={isLoading}
            >
              Test Connection
            </button>
            <button
              onClick={showFixInstructions}
              className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-white text-sm"
              disabled={isLoading}
            >
              Fix Instructions
            </button>
          </div>
        </div>

        <div className="bg-gray-700 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Direct Market Scan</h3>
          <p className="text-sm text-gray-300 mb-4">Run a market scan directly without using the intent router.</p>
          <div className="flex space-x-2">
            <button
              onClick={runDirectMarketScan}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-white text-sm"
              disabled={isLoading}
            >
              Run Market Scan
            </button>
          </div>
        </div>
      </div>
      
      {isDebugMode && (
        <div className="mt-6 p-4 bg-gray-700 rounded-lg">
          <h3 className="font-semibold mb-2">Debug Info</h3>
          {diagnosticResults && (
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-1">Diagnostic Results:</h4>
              <pre className="bg-gray-900 p-2 rounded overflow-auto text-xs">
                {JSON.stringify(diagnosticResults, null, 2)}
              </pre>
            </div>
          )}
          
          {chloeCheckResults && (
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-1">Chloe Check Results:</h4>
              <pre className="bg-gray-900 p-2 rounded overflow-auto text-xs">
                {JSON.stringify(chloeCheckResults, null, 2)}
              </pre>
            </div>
          )}
          
          {fixInstructions && (
            <div>
              <h4 className="text-sm font-medium mb-1">Fix Instructions:</h4>
              <div className="bg-gray-900 p-2 rounded text-xs">
                <h5 className="font-bold">{fixInstructions.title}</h5>
                <div className="mt-2 whitespace-pre-wrap">{fixInstructions.content}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ToolsTab; 