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
  
  // Collection management state
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(new Set());
  const [isCollectionDeleteLoading, setIsCollectionDeleteLoading] = useState(false);
  
  // Define available collections from the memory system
  const availableCollections = [
    'messages',
    'thoughts', 
    'documents',
    'tasks',
    'agents',
    'chat_sessions',
    'reflections',
    'insights',
    'analysis',
    'memory_edits'
  ];

  // Collection management functions
  const toggleCollectionSelection = (collection: string) => {
    const newSelected = new Set(selectedCollections);
    if (newSelected.has(collection)) {
      newSelected.delete(collection);
    } else {
      newSelected.add(collection);
    }
    setSelectedCollections(newSelected);
  };

  const selectAllCollections = () => {
    setSelectedCollections(new Set(availableCollections));
  };

  const deselectAllCollections = () => {
    setSelectedCollections(new Set());
  };

  const deleteSelectedCollections = async () => {
    if (selectedCollections.size === 0) {
      alert('Please select at least one collection to delete.');
      return;
    }

    const collectionsToDelete = Array.from(selectedCollections);
    const confirmMessage = `Are you sure you want to delete the following collections?\n\n${collectionsToDelete.join(', ')}\n\nThis action cannot be undone. All data in these collections will be permanently lost.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    setIsCollectionDeleteLoading(true);
    try {
      console.log('Deleting collections:', collectionsToDelete);
      
      // Call API to delete selected collections
      const response = await fetch('/api/debug/delete-collections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          collections: collectionsToDelete,
          recreate: true // Recreate collections after deletion
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        alert(`Successfully deleted and recreated ${collectionsToDelete.length} collections:\n${collectionsToDelete.join(', ')}`);
        setSelectedCollections(new Set()); // Clear selection
      } else {
        alert(`Failed to delete collections: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting collections:', error);
      alert('An error occurred while deleting collections. See console for details.');
    } finally {
      setIsCollectionDeleteLoading(false);
    }
  };
  
  // Get memory hook for standardized memory system access
  const { executeTool } = useToolsMemory();
  const { getMemories, deleteMemory } = useMemory();
  
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
      } else {
        alert(`Failed to clear markdown cache: ${data.error || 'Unknown error'}`);
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
      const serverResponse = await fetch('/api/debug/clear-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: 'gab' }),
      });
      
      const serverData = await serverResponse.json();
      
      const localStorageResponse = await fetch('/api/debug/clear-local-storage');
      const localStorageData = await localStorageResponse.json();
      
      if (localStorageData.success) {
        localStorageData.storagesToClear.forEach((key: string) => {
          localStorage.removeItem(key);
        });
      }
      
      setDebugResults({
        server: serverData,
        localStorage: localStorageData
      });
      
      alert('Successfully cleared image data. Please reload the page to see the changes.');
      window.location.reload();
    } catch (error) {
      console.error('Error clearing images:', error);
      alert('An error occurred while clearing images. See console for details.');
    } finally {
      setIsDebugLoading(false);
    }
  };

  // Function to delete all data
  const handleDeleteAllData = async () => {
    if (!confirm('Are you sure you want to delete ALL your data including chat history, images, and memory collections? This cannot be undone.')) {
      return;
    }
    
    setIsDebugLoading(true);
    let successMessage = 'Data Reset Status:\n\n';
    
    try {
      // Delete ALL collections directly from Qdrant
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
        
        if (deleteAllResult?.success === true && deleteAllResult?.result) {
          const totalDeleted = deleteAllResult.result.deletedCollections || 0;
          const totalCollections = deleteAllResult.result.totalCollections || 0;
          
          successMessage += `✓ Deleted ${totalDeleted}/${totalCollections} Qdrant collections\n`;
          
          // Recreate standard collections
          try {
            const collectionsToCreate = Object.values(COLLECTIONS || {}).map(name => ({
              name,
              dimensions: DEFAULTS?.DIMENSIONS || 1536
            }));
            
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
              
              if (createResult.success) {
                const createdCount = createResult.result?.totalCreated || 0;
                successMessage += `✓ Recreated ${createdCount} standard collections\n`;
              }
            }
          } catch (recreateError) {
            console.error('Error recreating collections:', recreateError);
          }
        }
      }
      
      // Clear local storage
      try {
        const localStorageResponse = await fetch('/api/debug/clear-local-storage');
        const localStorageData = await localStorageResponse.json();
        
        if (localStorageData.success) {
          localStorageData.storagesToClear.forEach((key: string) => {
            localStorage.removeItem(key);
          });
          successMessage += '✓ Local storage cleared\n';
        }
      } catch (error) {
        console.error('Error clearing local storage:', error);
      }
      
      // Clear markdown cache
      try {
        const clearCacheResponse = await fetch('/api/debug/clear-markdown-cache', {
          method: 'POST',
        });
        
        if (clearCacheResponse.ok) {
          successMessage += "✓ Markdown cache cleared successfully.\n";
        } else {
          successMessage += "Failed to clear markdown cache.\n";
        }
      } catch (cacheError) {
        successMessage += "Error clearing markdown cache.\n";
      }
      
      successMessage += '\nThe page will now reload to apply these changes.';
      alert(successMessage);
      
    } catch (error) {
      console.error('Error deleting all data:', error);
      alert('An error occurred while deleting all data. See console for details.');
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
                          `Entries: ${data.cacheFile.entries}\n\n` +
                          `Init Flag: ${data.initFlag?.exists ? 'Exists' : 'Missing'}\n` +
                          `Last Modified: ${data.initFlag?.lastModified || 'N/A'}\n` +
                          `Content: ${data.initFlag?.content || 'N/A'}`
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
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/debug/test-watcher');
                      if (response.ok) {
                        alert('Markdown watcher test started. Check console for results.');
                      } else {
                        alert('Error testing markdown watcher');
                      }
                    } catch (error) {
                      console.error('Error testing markdown watcher:', error);
                      alert('Error testing markdown watcher: ' + String(error));
                    }
                  }}
                  disabled={isDebugLoading}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white"
                >
                  Test Markdown Watcher
                </button>
              </div>
            </div>
          </div>

          {/* Collection Management Section */}
          <div className="bg-gray-800 p-4 rounded-lg mb-8">
            <h2 className="text-lg font-medium mb-4">Collection Management</h2>
            <p className="text-sm text-gray-400 mb-4">
              Select collections to delete and recreate. This will permanently remove all data in the selected collections.
            </p>
            
            {/* Collection Selection */}
            <div className="mb-4">
              <div className="flex gap-2 mb-3">
                <button
                  onClick={selectAllCollections}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAllCollections}
                  className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm text-white"
                >
                  Deselect All
                </button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {availableCollections.map((collection) => (
                  <label key={collection} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCollections.has(collection)}
                      onChange={() => toggleCollectionSelection(collection)}
                      className="form-checkbox h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm">{collection}</span>
                  </label>
                ))}
              </div>
            </div>
            
            {/* Delete Button */}
            <div className="flex justify-end">
              <button
                onClick={deleteSelectedCollections}
                disabled={isCollectionDeleteLoading || selectedCollections.size === 0}
                className={`px-4 py-2 rounded text-white font-medium ${
                  selectedCollections.size === 0 
                    ? 'bg-gray-600 cursor-not-allowed' 
                    : 'bg-red-600 hover:bg-red-700'
                } ${isCollectionDeleteLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isCollectionDeleteLoading ? 'Deleting...' : `Delete Selected (${selectedCollections.size})`}
              </button>
            </div>
            
            {selectedCollections.size > 0 && (
              <div className="mt-2 p-2 bg-yellow-900/20 border border-yellow-600 rounded">
                <p className="text-sm text-yellow-200">
                  <strong>Warning:</strong> You have selected {selectedCollections.size} collection(s) for deletion: {Array.from(selectedCollections).join(', ')}
                </p>
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="memory" className="mt-4">
          <MemoryToolsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ToolsTab; 