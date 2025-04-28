import React, { useState } from 'react';
import { Message } from '../../types';
import AdvancedSearchTool from '../tools/AdvancedSearchTool';

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
  const [debugResults, setDebugResults] = useState<any>(null);
  const [isDebugLoading, setIsDebugLoading] = useState(false);

  // Function to delete chat history
  const handleDeleteChatHistory = async () => {
    if (!confirm('Are you sure you want to delete your chat history? This cannot be undone.')) {
      return;
    }
    
    setIsDebugLoading(true);
    try {
      const response = await fetch('/api/debug/reset-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: 'gab' }),
      });
      
      const data = await response.json();
      setDebugResults(data);
      
      if (data.success) {
        alert(`Successfully deleted chat history. Deleted ${data.deletedMessageCount} messages.`);
        // Reload the page to refresh the UI
        window.location.reload();
      } else {
        alert(`Failed to delete chat history: ${data.error}`);
      }
    } catch (error) {
      console.error('Error deleting chat history:', error);
      alert('An error occurred while deleting chat history. See console for details.');
    } finally {
      setIsDebugLoading(false);
    }
  };

  // Function to clear image data and attachments
  const handleClearImages = async () => {
    if (!confirm('Are you sure you want to delete all your images and attachments? This cannot be undone.')) {
      return;
    }
    
    setIsDebugLoading(true);
    try {
      // 1. Clear server-side image data
      const serverResponse = await fetch('/api/debug/clear-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: 'gab' }),
      });
      
      const serverData = await serverResponse.json();
      
      // 2. Clear local storage
      // Get instructions for clearing local storage
      const localStorageResponse = await fetch('/api/debug/clear-local-storage');
      const localStorageData = await localStorageResponse.json();
      
      if (localStorageData.success) {
        // Execute the instructions
        localStorageData.storagesToClear.forEach((key: string) => {
          localStorage.removeItem(key);
        });
      }
      
      // Combine the results
      setDebugResults({
        server: serverData,
        localStorage: localStorageData
      });
      
      alert('Successfully cleared image data. Please reload the page to see the changes.');
      // Reload the page to refresh the UI
      window.location.reload();
    } catch (error) {
      console.error('Error clearing images:', error);
      alert('An error occurred while clearing images. See console for details.');
    } finally {
      setIsDebugLoading(false);
    }
  };

  // Function to delete all data (chat history and images)
  const handleDeleteAllData = async () => {
    if (!confirm('Are you sure you want to delete ALL your data including chat history and images? This cannot be undone.')) {
      return;
    }
    
    setIsDebugLoading(true);
    try {
      // Reset all Qdrant collections completely
      const resetResponse = await fetch('/api/debug/reset-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resetAll: true }),
      });
      
      const resetData = await resetResponse.json();
      console.log('Reset database result:', resetData);
      
      // Clear server-side image data
      await fetch('/api/debug/clear-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: 'gab' }),
      });
      
      // Clear local storage
      const localStorageResponse = await fetch('/api/debug/clear-local-storage');
      const localStorageData = await localStorageResponse.json();
      
      if (localStorageData.success) {
        // Execute the instructions
        localStorageData.storagesToClear.forEach((key: string) => {
          localStorage.removeItem(key);
        });
      }
      
      setDebugResults({
        resetDatabase: resetData,
        localStorageCleared: localStorageData.success,
        completeDatabaseReset: true
      });
      
      alert('Successfully reset the entire database and cleared local data. The page will now reload.');
      // Reload the page to refresh the UI
      window.location.reload();
    } catch (error) {
      console.error('Error deleting all data:', error);
      alert('An error occurred while deleting all data. See console for details.');
    } finally {
      setIsDebugLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-xl font-bold mb-4">Tools & Diagnostics</h2>
      
      {/* Add the new Advanced Search Tool at the top */}
      <div className="mb-6">
        <AdvancedSearchTool />
      </div>
      
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

        {/* New Debug Menu Section */}
        <div className="bg-gray-700 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Debug Menu</h3>
          <p className="text-sm text-gray-300 mb-4">Manage your chat history and images.</p>
          <div className="flex flex-col space-y-2">
            <button
              onClick={handleDeleteChatHistory}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm"
              disabled={isDebugLoading}
            >
              Delete Chat History
            </button>
            <button
              onClick={handleClearImages}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-sm"
              disabled={isDebugLoading}
            >
              Clear Images
            </button>
            <button
              onClick={handleDeleteAllData}
              className="px-3 py-1 bg-red-800 hover:bg-red-900 rounded text-white text-sm"
              disabled={isDebugLoading}
            >
              Delete All Data
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
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-1">Fix Instructions:</h4>
              <div className="bg-gray-900 p-2 rounded text-xs">
                <h5 className="font-bold">{fixInstructions.title}</h5>
                <div className="mt-2 whitespace-pre-wrap">{fixInstructions.content}</div>
              </div>
            </div>
          )}
          
          {debugResults && (
            <div>
              <h4 className="text-sm font-medium mb-1">Debug Operation Results:</h4>
              <pre className="bg-gray-900 p-2 rounded overflow-auto text-xs">
                {JSON.stringify(debugResults, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ToolsTab; 