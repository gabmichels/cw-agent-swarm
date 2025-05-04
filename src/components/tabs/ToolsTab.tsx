import React, { useState } from 'react';
import { Message } from '../../types';
import AdvancedSearchTool from '../tools/AdvancedSearchTool';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import MemoryToolsTab from './MemoryToolsTab';

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
  const [codaResults, setCodaResults] = useState<any>(null);
  const [isCodaLoading, setIsCodaLoading] = useState(false);
  const [codaInputValue, setCodaInputValue] = useState('');
  const [activeTab, setActiveTab] = useState<string>('legacy');

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

  // New functions for Coda test tools
  const createCodaTestDocument = async () => {
    setIsCodaLoading(true);
    setCodaResults(null);
    try {
      const response = await fetch('/api/tools/coda-test-doc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: codaInputValue }),
      });
      const data = await response.json();
      setCodaResults(data);
    } catch (error) {
      console.error('Error creating Coda test document:', error);
      setCodaResults({ error: 'Failed to create Coda document' });
    } finally {
      setIsCodaLoading(false);
    }
  };

  const readCodaPage = async () => {
    setIsCodaLoading(true);
    setCodaResults(null);
    try {
      const response = await fetch('/api/tools/coda-read-page', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pageId: codaInputValue || 'canvas-12gCwjgwEO' }),
      });
      const data = await response.json();
      setCodaResults(data);
    } catch (error) {
      console.error('Error reading Coda page:', error);
      setCodaResults({ error: 'Failed to read Coda page' });
    } finally {
      setIsCodaLoading(false);
    }
  };

  const appendCodaLine = async () => {
    setIsCodaLoading(true);
    setCodaResults(null);
    try {
      const response = await fetch('/api/tools/coda-append-line', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          line: codaInputValue,
          pageId: 'canvas-12gCwjgwEO' 
        }),
      });
      const data = await response.json();
      setCodaResults(data);
    } catch (error) {
      console.error('Error appending to Coda document:', error);
      setCodaResults({ error: 'Failed to append line to Coda document' });
    } finally {
      setIsCodaLoading(false);
    }
  };

  // New function to resolve Coda browser links
  const resolveCodaBrowserLink = async () => {
    setIsCodaLoading(true);
    setCodaResults(null);
    try {
      const browserLink = codaInputValue;
      if (!browserLink || !browserLink.includes('coda.io')) {
        setCodaResults({ 
          success: false, 
          error: "Please enter a valid Coda URL (e.g., https://coda.io/d/...)" 
        });
        setIsCodaLoading(false);
        return;
      }
      
      const response = await fetch('/api/tools/coda-resolve-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ browserLink }),
      });
      const data = await response.json();
      setCodaResults(data);
    } catch (error) {
      console.error('Error resolving Coda browser link:', error);
      setCodaResults({ error: String(error) });
    } finally {
      setIsCodaLoading(false);
    }
  };

  // New function to directly test document access with different ID formats
  const testDirectDocAccess = async () => {
    setIsCodaLoading(true);
    setCodaResults(null);
    try {
      const input = codaInputValue;
      const isUrl = input.includes('coda.io/');
      
      let requestBody = {};
      if (isUrl) {
        requestBody = { url: input };
      } else {
        requestBody = { id: input };
      }
      
      const response = await fetch('/api/tools/coda-direct-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      setCodaResults(data);
    } catch (error) {
      console.error('Error testing direct document access:', error);
      setCodaResults({ error: String(error) });
    } finally {
      setIsCodaLoading(false);
    }
  };

  // New function to create a document with LLM content
  const createDocWithLLM = async () => {
    setIsCodaLoading(true);
    setCodaResults(null);
    try {
      // Split the input by '|' to get title and content prompt
      const [title, contentPrompt] = codaInputValue.split('|').map(part => part.trim());
      
      if (!title || !contentPrompt) {
        setCodaResults({ 
          success: false, 
          error: "Please format your input as 'Title | Content instructions'" 
        });
        setIsCodaLoading(false);
        return;
      }
      
      const response = await fetch('/api/tools/coda-create-from-llm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, contentPrompt }),
      });
      
      const data = await response.json();
      setCodaResults(data);
    } catch (error) {
      console.error('Error creating document with LLM content:', error);
      setCodaResults({ error: String(error) });
    } finally {
      setIsCodaLoading(false);
    }
  };

  // Function to clear markdown cache
  const handleClearMarkdownCache = async () => {
    if (!confirm('Are you sure you want to clear the markdown cache? Files will be re-ingested on next server restart.')) {
      return;
    }
    
    setIsDebugLoading(true);
    try {
      // Make the request with a simple error handling approach
      const response = await fetch('/api/debug/clear-markdown-cache', {
        method: 'POST',
      });
      
      // Get the response as text first to safely handle any response format
      const responseText = await response.text();
      
      // Try to parse as JSON if possible
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        // If not JSON, create an error object
        data = { 
          success: false, 
          error: `Server returned non-JSON response: ${responseText.substring(0, 150)}...`,
          statusCode: response.status
        };
      }
      
      setDebugResults(data);
      
      if (data.success) {
        alert(`Success: ${data.message || 'Markdown cache cleared successfully'}`);
      } else {
        alert(`Error: ${data.error || 'Unknown error occurred'}`);
      }
    } catch (error) {
      console.error('Network error clearing markdown cache:', error);
      setDebugResults({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
      alert(`Network error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsDebugLoading(false);
    }
  };

  // Render method with tabs for both legacy and memory-based tools
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">Tools & Diagnostics</h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid grid-cols-2">
          <TabsTrigger value="legacy">Legacy View</TabsTrigger>
          <TabsTrigger value="memory">Memory System</TabsTrigger>
        </TabsList>
        
        <TabsContent value="legacy" className="mt-4">
          {/* Original Legacy Tools UI */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-lg font-medium mb-4">Diagnostic Tools</h2>
              <div className="space-y-2">
                <button
                  onClick={checkChloe}
                  disabled={isLoading}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
                >
                  Check Chloe
                </button>
                <button
                  onClick={runDiagnostics}
                  disabled={isLoading}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
                >
                  Run Diagnostics
                </button>
                <button
                  onClick={inspectChloeMemory}
                  disabled={isLoading}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
                >
                  Inspect Chloe Memory
                </button>
                <button
                  onClick={testChloeAgent}
                  disabled={isLoading}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
                >
                  Test Chloe Agent
                </button>
                <button
                  onClick={showFixInstructions}
                  disabled={isLoading}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
                >
                  Show Fix Instructions
                </button>
                <button
                  onClick={runDirectMarketScan}
                  disabled={isLoading}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
                >
                  Run Direct Market Scan
                </button>
              </div>
            </div>
            
            <div className="bg-gray-800 p-4 rounded-lg">
              <h2 className="text-lg font-medium mb-4">Advanced Debug Tools</h2>
              <div className="space-y-2">
                <button
                  onClick={handleDeleteChatHistory}
                  disabled={isDebugLoading}
                  className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
                >
                  Delete Chat History
                </button>
                <button
                  onClick={handleClearImages}
                  disabled={isDebugLoading}
                  className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
                >
                  Clear All Images/Attachments
                </button>
                <button
                  onClick={handleDeleteAllData}
                  disabled={isDebugLoading}
                  className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
                >
                  Delete ALL Data
                </button>
              </div>
            </div>
          </div>

          {/* Keep the rest of the original UI ... */}
          {/* ... existing code ... */}
        </TabsContent>
        
        <TabsContent value="memory" className="mt-4">
          <MemoryToolsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ToolsTab; 