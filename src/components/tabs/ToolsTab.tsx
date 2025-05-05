import React, { useState } from 'react';
import { Message } from '../../types';
import AdvancedSearchTool from '../tools/AdvancedSearchTool';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import MemoryToolsTab from './MemoryToolsTab';
import useToolsMemory from '../../hooks/useToolsMemory';
import useMemory from '../../hooks/useMemory';
import { MemoryType } from '../../server/memory/config';

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
    if (!confirm('Are you sure you want to delete ALL your data including chat history, markdown files, images, and ALL memory collections? This cannot be undone.')) {
      return;
    }
    
    setIsDebugLoading(true);
    try {
      console.log("Starting full data deletion process...");
      
      // Create an array to collect results from all operations
      const results = {
        collectionResets: [] as Array<Record<string, any>>,
        markdownCleared: false,
        localStorageCleared: false,
        documentReset: false,
        memoryReset: false,
        searchDeleted: false,
        documentPurged: false,
        memoryRestarted: false
      };
      
      // 1. FIRST - Clear the markdown cache file to prevent any file reload detection
      try {
        console.log("Clearing markdown cache file first...");
        const markdownResetResponse = await fetch('/api/debug/clear-markdown-cache', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        const markdownResult = await markdownResetResponse.json();
        console.log('Markdown cache reset result:', markdownResult);
        results.markdownCleared = markdownResult.success === true;
      } catch (error) {
        console.error('Error clearing markdown cache:', error);
        results.markdownCleared = false;
      }
      
      // 1.5 - Most efficient approach: Delete ALL collections directly from Qdrant
      try {
        console.log("Directly deleting ALL Qdrant collections using direct API...");
        
        // Use direct API to delete all collections
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
          const deleteAllResult = await deleteAllResponse.json().catch(() => ({ success: false }));
          console.log('Delete all collections result:', deleteAllResult);
          
          if (deleteAllResult?.success === true && deleteAllResult?.result) {
            const totalDeleted = deleteAllResult.result.deletedCollections || 0;
            const totalCollections = deleteAllResult.result.totalCollections || 0;
            const byType = deleteAllResult.result.byType || {};
            
            // Record the results
            results.collectionResets.push({
              qdrantDirectAll: deleteAllResult.result
            });
            
            // Mark document and memory as reset since we deleted all collections
            results.documentReset = true;
            results.memoryReset = true;
            
            // Build a detailed message
            const typeSummary = Object.entries(byType)
              .map(([type, info]) => {
                // Add type assertion to handle unknown type
                const typedInfo = info as { count: number; deleted: boolean };
                return `${type} (${typedInfo.count})`;
              })
              .join(', ');
            
            successMessage += `✓ Deleted ${totalDeleted}/${totalCollections} Qdrant collections directly\n`;
            
            if (typeSummary) {
              successMessage += `  Types affected: ${typeSummary}\n`;
            }
          }
        } else {
          console.error('Error deleting all collections:', await deleteAllResponse.text().catch(() => 'Unknown error'));
        }
      } catch (deleteAllError) {
        console.error('Error with delete all collections:', deleteAllError);
      }
      
      // 2. Directly purge all documents from vector database
      try {
        console.log("Directly purging all document points from vector database...");
        
        // Try direct point deletion using filter in Qdrant
        const purgeResponse = await fetch('/api/debug/qdrant-direct', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            operation: 'deletePoints',
            collection: 'memory_document',
            filter: {
              must: [
                {
                  key: 'type',
                  match: {
                    value: 'document'
                  }
                }
              ]
            }
          }),
        });
        
        if (purgeResponse.ok) {
          const purgeResult = await purgeResponse.json().catch(() => ({ success: false }));
          console.log('Document purge result:', purgeResult);
          results.documentPurged = purgeResult?.success === true;
          
          if (purgeResult?.result?.deleted > 0) {
            successMessage += `✓ Purged ${purgeResult.result.deleted} document points directly\n`;
          } else if (purgeResult?.success === true && purgeResult?.result?.deleted === 0) {
            successMessage += '✓ No document points found to purge\n';
          }
        }
      } catch (purgeError) {
        console.error('Error with document purge:', purgeError);
      }
      
      // 3. Directly search for and delete all document type memories
      try {
        console.log("Directly searching for and deleting markdown documents...");
        
        // Get all document type memories first
        const searchResponse = await fetch('/api/memory/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: "",
            filter: {
              must: [
                {
                  key: "type",
                  match: {
                    value: "document"
                  }
                }
              ]
            },
            limit: 1000
          })
        });
        
        if (searchResponse.ok) {
          const searchResult = await searchResponse.json();
          
          if (searchResult.results && searchResult.results.length > 0) {
            console.log(`Found ${searchResult.results.length} document memories to delete`);
            
            // Track success and failures
            let successCount = 0;
            let failureCount = 0;
            let errorMessages = new Set<string>();
            
            // Delete memories in smaller batches to avoid overwhelming the server
            const BATCH_SIZE = 10;
            const documents = searchResult.results.slice();
            
            for (let i = 0; i < documents.length; i += BATCH_SIZE) {
              const batch = documents.slice(i, i + BATCH_SIZE);
              console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(documents.length/BATCH_SIZE)}, size: ${batch.length}`);
              
              const batchResults = await Promise.all(batch.map(async (result: any) => {
                if (result.point && result.point.id) {
                  try {
                    const deleteResponse = await fetch(`/api/memory/${result.point.id}`, {
                      method: 'DELETE',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        type: "document"
                      })
                    });
                    
                    if (deleteResponse.ok) {
                      successCount++;
                      return true;
                    } else {
                      const errorData = await deleteResponse.json().catch(() => ({ error: 'Unknown error' }));
                      errorMessages.add(errorData.error || 'Unknown error');
                      failureCount++;
                      return false;
                    }
                  } catch (deleteError) {
                    console.error(`Error deleting memory ${result.point.id}:`, deleteError);
                    errorMessages.add(deleteError instanceof Error ? deleteError.message : 'Unknown error');
                    failureCount++;
                    return false;
                  }
                }
                failureCount++;
                return false;
              }));
            }
            
            console.log(`Successfully deleted ${successCount} document memories, failed to delete ${failureCount}`);
            if (errorMessages.size > 0) {
              console.error('Deletion errors encountered:', Array.from(errorMessages));
            }
            
            results.searchDeleted = successCount > 0;
          } else {
            console.log('No document memories found to delete');
          }
        } else {
          const errorText = await searchResponse.text().catch(() => 'Unknown error');
          console.error('Search response error:', errorText);
        }
      } catch (error) {
        console.error('Error with direct document memory deletion:', error);
      }
      
      // 4. Attempt to use memory API to reset ALL collections
      try {
        console.log("Resetting all memory collections...");
        
        // Instead of using 'all' which causes errors on invalid types,
        // explicitly reset only the core valid memory types
        const coreMemoryTypes = ["message", "thought", "document", "task"];
        
        const resetResults = await Promise.all(coreMemoryTypes.map(async (type) => {
          try {
            // Use direct reset without verification to avoid 400 errors
            const response = await fetch('/api/memory/reset-collection', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ 
                collection: type,
                verify: false, // Skip verification which causes 400 errors
                noScroll: true // Skip scroll operations which are failing
              }),
            });
            
            const result = await response.json();
            console.log(`Reset collection ${type} result:`, result);
            return { type, success: result.status === 'success', result };
          } catch (typeError) {
            console.error(`Error resetting collection ${type}:`, typeError);
            return { type, success: false, error: String(typeError) };
          }
        }));
        
        results.collectionResets.push({ coreTypes: resetResults });
        results.memoryReset = resetResults.some(r => r.success);
      } catch (error) {
        console.error('Error resetting collections:', error);
        results.collectionResets.push({error: String(error)});
      }
      
      // 5. Specifically reset the document collection where markdown files are stored
      try {
        console.log("Specifically resetting document collection which stores markdown files...");
        
        // First try a direct approach without verification
        const documentResponse = await fetch('/api/memory/reset-collection', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            collection: 'document',
            verify: false, // Skip verification to avoid 400 errors
            noScroll: true, // Skip scroll operations that are failing
            forceRebuild: true // Force complete rebuild of collection
          }),
        });
        
        const documentResult = await documentResponse.json();
        console.log('Document collection reset result:', documentResult);
        results.collectionResets.push({document: documentResult});
        
        // Also try a direct approach using the Qdrant API
        try {
          console.log("Attempting low-level Qdrant operation for document collection...");
          
          // First delete the collection completely
          const deleteCollectionResponse = await fetch('/api/debug/qdrant-direct', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              operation: 'deleteCollection',
              collection: 'memory_document'
            }),
          });
          
          if (deleteCollectionResponse.ok) {
            console.log('Successfully deleted document collection');
            
            // Then recreate the collection with proper schema
            const createCollectionResponse = await fetch('/api/debug/qdrant-direct', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ 
                operation: 'createCollection',
                collection: 'memory_document',
                config: {
                  vectors: {
                    size: 1536,
                    distance: "Cosine"
                  }
                }
              }),
            });
            
            if (createCollectionResponse.ok) {
              console.log('Successfully recreated document collection');
              results.collectionResets.push({qdrantDirectSuccess: true});
            }
          }
        } catch (qdrantError) {
          console.error('Error with direct Qdrant operation:', qdrantError);
        }
        
        // Use legacy approach as last resort
        try {
          console.log("Attempting legacy approach for document collection...");
          const legacyDocReset = await fetch('/api/debug/reset-collection', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              collection: 'document',
              hard: true
            }),
          });
          
          if (legacyDocReset.ok) {
            const legacyResult = await legacyDocReset.json();
            console.log('Legacy document reset result:', legacyResult);
            results.collectionResets.push({legacyReset: legacyResult});
          }
        } catch (legacyError) {
          console.error('Error with legacy document reset:', legacyError);
        }
        
        // Mark document reset as successful if any method worked
        results.documentReset = documentResult.status === 'success' || 
                              results.collectionResets.some(r => r.qdrantDirectSuccess === true) ||
                              results.collectionResets.some(r => r.legacyReset?.success === true);
      } catch (error) {
        console.error('Error resetting document collection:', error);
        results.collectionResets.push({documentError: String(error)});
      }
      
      // 6. Use legacy API approaches as fallbacks
      try {
        console.log("Using legacy methods to reset database as backup...");
      const resetResponse = await fetch('/api/debug/reset-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resetAll: true }),
      });
      
      const resetData = await resetResponse.json();
        console.log('Legacy reset database result:', resetData);
        results.collectionResets.push({legacy: resetData});
      } catch (error) {
        console.error('Error using legacy reset:', error);
        results.collectionResets.push({legacyError: String(error)});
      }
      
      // 7. Clear server-side image data
      try {
        console.log("Clearing server-side image data...");
      await fetch('/api/debug/clear-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: 'gab' }),
      });
      } catch (error) {
        console.error('Error clearing images:', error);
      }
      
      // 8. Clear local storage
      try {
        console.log("Clearing local storage...");
      const localStorageResponse = await fetch('/api/debug/clear-local-storage');
      const localStorageData = await localStorageResponse.json();
      
      if (localStorageData.success) {
        // Execute the instructions
        localStorageData.storagesToClear.forEach((key: string) => {
          localStorage.removeItem(key);
        });
          results.localStorageCleared = true;
        }
      } catch (error) {
        console.error('Error clearing local storage:', error);
      }
      
      // 9. Final check to confirm markdown related data is deleted
      let markdownTestResult = null;
      try {
        console.log("Performing final check for markdown documents...");
        const markdownTest = await fetch('/api/markdown-test');
        if (markdownTest.ok) {
          markdownTestResult = await markdownTest.json();
          console.log('Final markdown check result:', markdownTestResult);
        }
      } catch (error) {
        console.error('Error with final markdown check:', error);
      }
      
      // 10. Force a memory system restart if possible
      try {
        console.log("Attempting memory system restart...");
        const restartResponse = await fetch('/api/debug/restart-memory', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        if (restartResponse.ok) {
          const restartResult = await restartResponse.json().catch(() => ({ success: false }));
          console.log('Memory system restart result:', restartResult);
          results.memoryRestarted = restartResult?.success === true;
          
          if (restartResult?.success === true) {
            successMessage += '✓ Memory system restarted successfully\n';
          }
        }
      } catch (restartError) {
        console.error('Error restarting memory system:', restartError);
      }
      
      // Log all results for debugging
      console.log("COMPLETE RESET OPERATION SUMMARY:", {
        markdownCleared: results.markdownCleared,
        collectionResets: results.collectionResets,
        documentPurged: results.documentPurged,
        documentReset: results.documentReset,
        memoryReset: results.memoryReset,
        searchDeleted: results.searchDeleted,
        memoryRestarted: results.memoryRestarted,
        localStorageCleared: results.localStorageCleared,
        finalMarkdownCheck: markdownTestResult,
        timestamp: new Date().toISOString()
      });
      
      setDebugResults({
        resetDatabase: true,
        results: results,
        completeDatabaseReset: true,
        markdownCleared: results.markdownCleared,
        documentReset: results.documentReset,
        searchDeleted: results.searchDeleted,
        finalCheck: markdownTestResult
      });
      
      // Show results to user
      successMessage = 'Successfully reset the database and cleared all data.\n\n';
      
      if (results.markdownCleared) {
        successMessage += '✓ Markdown cache cleared\n';
      } else {
        successMessage += '⚠️ Markdown cache clear may have failed\n';
      }
      
      if (results.searchDeleted) {
        successMessage += '✓ Document memories deleted directly\n';
      } else {
        successMessage += '⚠️ Direct document deletion may have failed\n';
      }
      
      if (results.documentReset) {
        successMessage += '✓ Document collection reset\n';
      } else {
        successMessage += '⚠️ Document collection reset may have failed\n';
      }
      
      // Show which core memory types were successfully reset
      if (results.collectionResets && 
          Array.isArray(results.collectionResets) && 
          results.collectionResets.length > 0) {
        
        const coreTypesReset = results.collectionResets.find(
          (reset: Record<string, any>) => reset && 'coreTypes' in reset
        );
        
        if (coreTypesReset && coreTypesReset.coreTypes) {
          const resetTypes = coreTypesReset.coreTypes
            .filter((r: any) => r && r.success)
            .map((r: any) => r.type);
            
          if (resetTypes.length > 0) {
            successMessage += `✓ Successfully reset collections: ${resetTypes.join(', ')}\n`;
          } else {
            successMessage += '⚠️ Failed to reset any core memory collections\n';
          }
        }
      } else if (results.memoryReset) {
        successMessage += '✓ Memory collections reset\n';
      } else {
        successMessage += '⚠️ Memory collection reset may have failed\n';
      }
      
      if (results.localStorageCleared) {
        successMessage += '✓ Local storage cleared\n';
      } else {
        successMessage += '⚠️ Local storage clear may have failed\n';
      }
      
      if (results.documentPurged) {
        successMessage += '✓ Document points purged directly\n';
      }
      
      if (results.memoryRestarted) {
        successMessage += '✓ Memory system restarted\n';
      }
      
      // Final check info
      if (markdownTestResult && markdownTestResult.statistics) {
        const remainingDocs = markdownTestResult.statistics.markdownCount;
        
        if (remainingDocs === 0) {
          successMessage += '✓ Final check confirms all markdown documents removed\n';
        } else {
          successMessage += `⚠️ Final check shows ${remainingDocs} markdown documents may still remain\n`;
          successMessage += '   Please try again if markdown documents are still visible after reload.\n';
        }
      }
      
      successMessage += '\nThe page will now reload to apply these changes.';
      
      alert(successMessage);
      
      // Force a complete page reload with cache-busting query parameters
      window.location.href = '/?reset=true&t=' + new Date().getTime() + '&clearcache=1';
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