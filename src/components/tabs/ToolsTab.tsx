import React, { useState } from 'react';
import { COLLECTIONS, DEFAULTS } from '../../constants/qdrant';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import MemoryToolsTab from './MemoryToolsTab';
import useToolsMemory from '../../hooks/useToolsMemory';
import useMemory from '../../hooks/useMemory';

interface ToolsTabProps {
  isLoading: boolean;
  checkChloe: () => void;
  runDiagnostics: () => void;
  inspectChloeMemory: () => void;
  resetChatHistory: () => void;
  testChloeAgent: () => void;
  showFixInstructions: () => void;
  runDirectMarketScan: () => void;
  diagnosticResults: Record<string, unknown>;
  chloeCheckResults: Record<string, unknown>;
  fixInstructions: Record<string, unknown>;
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
  const [debugResults, setDebugResults] = useState<Record<string, unknown> | null>(null);
  const [isDebugLoading, setIsDebugLoading] = useState(false);
  const [codaResults, setCodaResults] = useState<Record<string, unknown> | null>(null);
  const [isCodaLoading, setIsCodaLoading] = useState(false);
  const [codaInputValue, setCodaInputValue] = useState('');
  const [activeTab, setActiveTab] = useState<string>('legacy');
  
  // Get memory hook for standardized memory system access
  // We're only using the methods, not triggering automatic data loading
  const { executeTool } = useToolsMemory();
  
  // Initialize useMemory without initialTypes to prevent auto-loading
  const { getMemories, deleteMemory } = useMemory();
  
  // Define results and success message variables
  const results = {
    markdownCacheCleared: false,
    documentDirectSearched: false,
    allCollectionsReset: false,
    documentReset: false,
    memoryReset: false,
    searchDeleted: false,
    documentPurged: false,
    memoryRestarted: false
  };

  let successMessage = '';
  
  // Function to check Qdrant connection
  const checkQdrantConnection = async () => {
    setIsDebugLoading(true);
    try {
      const response = await fetch('/api/debug/qdrant-test');
      const data = await response.json();
      setDebugResults(data);
      
      if (data.success) {
        alert(`Qdrant connection test successful. ${data.messageCount} messages found.`);
      } else {
        alert(`Qdrant connection test failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Error testing Qdrant connection:', error);
      alert('Error testing Qdrant connection. See console for details.');
    } finally {
      setIsDebugLoading(false);
    }
  };

  // Function to delete chat history
  const handleDeleteChatHistory = async () => {
    if (!confirm('Are you sure you want to delete your chat history? This cannot be undone.')) {
      return;
    }
    
    setIsDebugLoading(true);
    try {
      // First, try the new standardized memory system approach
      if (activeTab === 'memory') {
        // Execute the tool through the memory system
        const result = await executeTool('clear_chat', { confirmationRequired: true });
        setDebugResults(result);
        
        if (result.success) {
          alert('Successfully deleted chat history using the standardized memory system.');
          window.location.reload();
        } else {
          // If new system fails, fall back to legacy approach
          throw new Error('Memory system clear_chat failed, falling back to legacy API');
        }
      } else {
        // Legacy approach
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
          window.location.reload();
        } else {
          alert(`Failed to delete chat history: ${data.error}`);
        }
      }
    } catch (error) {
      console.error('Error deleting chat history:', error);
      alert('An error occurred while deleting chat history. See console for details.');
    } finally {
      setIsDebugLoading(false);
    }
  };

  // Function to clear markdown cache
  const handleClearMarkdownCache = async () => {
    if (!confirm('Are you sure you want to clear the markdown cache? This will force all markdown files to be reprocessed and re-indexed on next load.')) {
      return;
    }
    
    setIsDebugLoading(true);
    try {
      // Make the API request to clear markdown cache using the App Router endpoint
      const response = await fetch('/api/debug/clear-markdown-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      setDebugResults(data);
      
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
      // First, try the new standardized memory system approach
      if (activeTab === 'memory') {
        // Execute the tool through the memory system
        const result = await executeTool('clear_images', { confirmationRequired: true });
        setDebugResults(result);
        
        if (result.success) {
          alert('Successfully cleared image data using the standardized memory system.');
          window.location.reload();
        } else {
          // If new system fails, fall back to legacy approach
          throw new Error('Memory system clear_images failed, falling back to legacy API');
        }
      } else {
        // Legacy approach
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
        window.location.reload();
      }
    } catch (error) {
      console.error('Error clearing images:', error);
      alert('An error occurred while clearing images. See console for details.');
    } finally {
      setIsDebugLoading(false);
    }
  };

  // Function to delete all data (chat history and images)
  const handleDeleteAllData = async () => {
    if (!confirm('Are you sure you want to delete ALL your data including chat history, images, and memory collections? This cannot be undone.')) {
      return;
    }
    
    setIsDebugLoading(true);
    let successMessage = 'Data Reset Status:\n\n';
    
    try {
      console.log("Starting full data deletion process...");
      
      // Delete ALL collections directly from Qdrant
      console.log("Deleting ALL Qdrant collections...");
      const deleteAllResponse = await fetch('/api/debug/qdrant-direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          operation: 'deleteAllCollections'
        }),
      });
      
      if (deleteAllResponse.ok) {
        const deleteAllResult = await deleteAllResponse.json();
        console.log('Delete all collections result:', deleteAllResult);
        
        if (deleteAllResult?.success === true && deleteAllResult?.result) {
          const totalDeleted = deleteAllResult.result.deletedCollections || 0;
          const totalCollections = deleteAllResult.result.totalCollections || 0;
          
          successMessage += `✓ Deleted ${totalDeleted}/${totalCollections} Qdrant collections\n`;
          
          // Recreate standard collections to avoid 404 errors when ingesting documents
          console.log("Recreating standard collections...");
          try {
            // Prepare the collections config
            const collectionsToCreate = Object.values(COLLECTIONS).map(name => ({
              name,
              dimensions: DEFAULTS.DIMENSIONS
            }));
            
            // Call the createCollections API
            const createResponse = await fetch('/api/debug/qdrant-direct', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                operation: 'createCollections',
                collections: collectionsToCreate
              }),
            });
            
            if (createResponse.ok) {
              const createResult = await createResponse.json();
              console.log('Collections recreation result:', createResult);
              
              if (createResult.success) {
                const createdCount = createResult.result?.totalCreated || 0;
                successMessage += `✓ Recreated ${createdCount} standard collections\n`;
              }
            }
          } catch (recreateError) {
            console.error('Error recreating collections:', recreateError);
          }
        }
      } else {
        console.error('Error deleting all collections:', await deleteAllResponse.text().catch(() => 'Unknown error'));
      }
      
      // Clear local storage
      try {
        console.log("Clearing local storage...");
        const localStorageResponse = await fetch('/api/debug/clear-local-storage');
        const localStorageData = await localStorageResponse.json();
        
        if (localStorageData.success) {
          // Execute the instructions
          localStorageData.storagesToClear.forEach((key: string) => {
            localStorage.removeItem(key);
          });
          successMessage += '✓ Local storage cleared\n';
        }
      } catch (error) {
        console.error('Error clearing local storage:', error);
      }
      
      // After deleting Qdrant collections, also clear the markdown cache
      console.log("Clearing markdown cache...");
      try {
        const clearCacheResponse = await fetch('/api/debug/clear-markdown-cache', {
          method: 'POST',
        });
        
        if (clearCacheResponse.ok) {
          const cacheResult = await clearCacheResponse.json();
          console.log("Markdown cache cleared:", cacheResult);
          successMessage += "Markdown cache cleared successfully.\n";
        } else {
          console.error("Failed to clear markdown cache");
          successMessage += "Failed to clear markdown cache.\n";
        }
      } catch (cacheError) {
        console.error("Error clearing markdown cache:", cacheError);
        successMessage += "Error clearing markdown cache.\n";
      }
      
      successMessage += '\nThe page will now reload to apply these changes.';
      alert(successMessage);
      
      // Just reload the page
      // window.location.reload();
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
                <button
                  onClick={checkQdrantConnection}
                  disabled={isDebugLoading}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
                >
                  Check Qdrant Connection
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
                <button
                  onClick={handleClearMarkdownCache}
                  disabled={isDebugLoading}
                  className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-white"
                >
                  Clear Markdown Cache
                </button>
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/debug/markdown-status');
                      if (response.ok) {
                        const data = await response.json();
                        alert(
                          'Markdown Status:\n\n' +
                          `Prevent Reload Flag: ${data.preventMarkdownReload}\n` +
                          `Chloe Prevent Flag: ${data.chloePreventMarkdownReload}\n\n` +
                          `Cache File: ${data.cacheFile.exists ? 'Exists' : 'Missing'}\n` +
                          `Size: ${data.cacheFile.size} bytes\n` +
                          `Last Modified: ${data.cacheFile.lastModified || 'N/A'}\n` +
                          `Entries: ${data.cacheFile.entries}`
                        );
                      } else {
                        alert('Error checking markdown status');
                      }
                    } catch (error) {
                      console.error('Error checking markdown status:', error);
                      alert('Error checking markdown status: ' + String(error));
                    }
                  }}
                  disabled={isDebugLoading}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
                >
                  Check Markdown Status
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