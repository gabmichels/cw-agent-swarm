'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Search, FileText, Tag, Calendar, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface MarkdownDocument {
  id: string;
  title: string;
  source: string;
  type: string;
  path: string;
  tags: string[];
  timestamp: string;
  isMarkdown: boolean;
  content: string;
  originalTitle?: string;    // Made optional to fix type error
  titleExtracted?: boolean;  // Made optional to fix type error
  extractionMethod?: string; // Added to note how title was extracted
}

interface MarkdownStats {
  total: number;
  markdownCount: number;
  bySource: Record<string, number>;
  byType: Record<string, number>;
  byPathPattern: Record<string, number>;
  withTags: number;
}

interface ApiResponse {
  success: boolean;
  statistics: MarkdownStats;
  documents: MarkdownDocument[];
  error?: string;
  details?: string;
}

// Function to extract title from the first line of markdown content
const extractTitleFromFirstLine = (content: string): string | null => {
  if (!content) return null;
  
  // Get the first line only
  const firstLine = content.split(/\r?\n/)[0];
  if (!firstLine || !firstLine.trim()) return null;
  
  // Remove any leading # characters and clean up formatting
  let cleanedTitle = firstLine.trim()
    .replace(/^#+\s*/, '')  // Remove any leading hashtags and spaces
    .replace(/\*\*|\*|__|\|_/g, '')  // Remove bold/italic markers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');  // Convert links to just text
  
  // Filter out "DOCUMENT [timestamp]:" prefix with a more flexible pattern
  cleanedTitle = cleanedTitle.replace(/^DOCUMENT\s+\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z\]:?\s*/i, '');
  
  // Also handle alternative formats like "document [date] [time]:"
  cleanedTitle = cleanedTitle.replace(/^(?:document|doc)\s+\[\d{4}-\d{2}-\d{2}(?:T|\s+)\d{2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?(?:Z)?\]:?\s*/i, '');
  
  // Remove any remaining timestamp patterns at the beginning
  cleanedTitle = cleanedTitle.replace(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z\]:?\s*/i, '');
  
  return cleanedTitle;
};

export default function MarkdownViewer() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<MarkdownDocument[]>([]);
  const [stats, setStats] = useState<MarkdownStats | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDoc, setSelectedDoc] = useState<MarkdownDocument | null>(null);
  const [filteredDocs, setFilteredDocs] = useState<MarkdownDocument[]>([]);
  const [activeTab, setActiveTab] = useState<string>('content');
  const [activeStatTab, setActiveStatTab] = useState<string>('source');
  const [debugMode, setDebugMode] = useState<boolean>(false);
  
  const fetchMarkdownDocs = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/markdown-test');
      const data: ApiResponse = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch markdown documents');
      }
      
      // Process documents to extract titles from content
      let processedDocs = data.documents.map(doc => {
        // Always extract title from the first line of content, regardless of original title
        const extractedTitle = extractTitleFromFirstLine(doc.content);
        
        if (extractedTitle) {
          if (debugMode) {
            console.log(`Title extraction for ${doc.path}: Found "${extractedTitle}" (Original: "${doc.title}")`);
          }
          
          return { 
            ...doc, 
            title: extractedTitle,
            originalTitle: doc.title,
            titleExtracted: true,
            extractionMethod: 'first-line'
          };
        } else {
          if (debugMode) {
            console.log(`Title extraction for ${doc.path}: No title found in content. Using original title "${doc.title}"`);
          }
          
          return {
            ...doc,
            originalTitle: doc.title,
            titleExtracted: false
          };
        }
      });
      
      // Deduplicate documents based on file path
      // Some documents might be duplicated in the database but we only want to show each unique file once
      const pathMap = new Map<string, MarkdownDocument>();
      
      // Use the path as a unique key and keep only the latest document for each path
      processedDocs.forEach(doc => {
        if (doc.path) {
          // If we already have this path, only replace if this one is newer
          const existingDoc = pathMap.get(doc.path);
          if (!existingDoc || new Date(doc.timestamp) > new Date(existingDoc.timestamp)) {
            pathMap.set(doc.path, doc);
          }
        } else {
          // For documents without a path, use the ID as the key
          pathMap.set(doc.id, doc);
        }
      });
      
      // Convert back to array
      processedDocs = Array.from(pathMap.values()) as typeof processedDocs;
      
      if (debugMode) {
        console.log(`Deduplication: ${data.documents.length} original docs → ${processedDocs.length} unique docs`);
      }
      
      setDocuments(processedDocs);
      setFilteredDocs(processedDocs);
      setStats({
        ...data.statistics,
        total: processedDocs.length,
        markdownCount: processedDocs.length
      });
      
      if (processedDocs.length > 0) {
        setSelectedDoc(processedDocs[0]);
      } else {
        setSelectedDoc(null);
      }
    } catch (err) {
      console.error('Error fetching markdown documents:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchMarkdownDocs();
  }, []);
  
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredDocs(documents);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = documents.filter(doc => 
      doc.title.toLowerCase().includes(query) ||
      doc.path.toLowerCase().includes(query) ||
      doc.content.toLowerCase().includes(query) ||
      doc.tags.some(tag => tag.toLowerCase().includes(query))
    );
    
    setFilteredDocs(filtered);
  }, [searchQuery, documents]);
  
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return 'Invalid date';
    }
  };
  
  const getPreviewText = (content: string, maxLength = 100) => {
    if (!content) return '';
    
    const plainText = content
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*|\*|__|\||_/g, '')
      .replace(/`{1,3}[\s\S]*?`{1,3}/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();
    
    if (plainText.length <= maxLength) return plainText;
    return plainText.substring(0, maxLength) + '...';
  };
  
  return (
    <div className="container mx-auto py-6">
      <div className="bg-gray-800 shadow rounded-lg mb-6">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Markdown Knowledge Explorer</h2>
            <div className="flex items-center gap-2">
              <label className="flex items-center text-white text-sm">
                <input
                  type="checkbox"
                  checked={debugMode}
                  onChange={(e) => setDebugMode(e.target.checked)}
                  className="mr-1"
                />
                Debug
              </label>
              <button 
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                onClick={fetchMarkdownDocs}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Refresh
              </button>
            </div>
          </div>
        </div>
        <div className="p-4">
          <div className="mb-4">
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded"
              />
              <button className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded">
                <Search className="h-4 w-4" />
              </button>
            </div>
            
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="bg-gray-700 p-2 rounded text-white">
                  <div className="font-medium">Total Documents</div>
                  <div>{stats.total}</div>
                </div>
                <div className="bg-gray-700 p-2 rounded text-white">
                  <div className="font-medium">Markdown Documents</div>
                  <div>{stats.markdownCount}</div>
                </div>
                <div className="bg-gray-700 p-2 rounded text-white">
                  <div className="font-medium">With Tags</div>
                  <div>{stats.withTags}</div>
                </div>
                <div className="bg-gray-700 p-2 rounded text-white">
                  <div className="font-medium">Filtered</div>
                  <div>{filteredDocs.length}</div>
                </div>
              </div>
            )}
          </div>
          
          {error && (
            <div className="p-4 mb-4 bg-red-900 text-red-100 rounded">
              {error}
            </div>
          )}
          
          {loading ? (
            <div className="flex justify-center p-8 text-white">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1 h-[600px] overflow-y-auto border border-gray-700 rounded p-2 bg-gray-800">
                {filteredDocs.length > 0 ? (
                  filteredDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className={`p-2 border-b border-gray-700 cursor-pointer hover:bg-gray-700 rounded transition-colors ${selectedDoc?.id === doc.id ? 'bg-blue-900 hover:bg-blue-800' : ''}`}
                      onClick={() => setSelectedDoc(doc)}
                    >
                      <div className="flex flex-col">
                        <div className="font-semibold text-white">
                          {doc.title}
                          {debugMode && doc.titleExtracted && (
                            <span className="ml-1 text-xs px-1 bg-orange-700 rounded">extracted</span>
                          )}
                        </div>
                        
                        {debugMode && (
                          <div className="text-xs text-gray-400 mb-1">
                            {doc.originalTitle !== doc.title ? (
                              <div className="text-orange-400 break-all">Original: "{doc.originalTitle}"</div>
                            ) : (
                              <div>Original title preserved</div>
                            )}
                            {doc.extractionMethod && <div>Method: {doc.extractionMethod}</div>}
                          </div>
                        )}
                        
                        <div className="text-xs text-gray-400 mb-1">{doc.path}</div>
                        
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className="px-1.5 py-0.5 text-xs bg-gray-600 text-white rounded">{doc.source}</span>
                          <span className="px-1.5 py-0.5 text-xs bg-gray-600 text-white rounded">{doc.type}</span>
                          {doc.tags.slice(0, 3).map((tag, idx) => (
                            <span key={idx} className="px-1.5 py-0.5 text-xs bg-blue-800 text-white rounded">{tag}</span>
                          ))}
                          {doc.tags.length > 3 && (
                            <span className="px-1.5 py-0.5 text-xs bg-gray-600 text-white rounded">+{doc.tags.length - 3}</span>
                          )}
                        </div>
                        
                        <div className="text-xs text-gray-400 mt-1">
                          {getPreviewText(doc.content)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-gray-400">
                    No documents found
                  </div>
                )}
              </div>
              
              <div className="md:col-span-2 border border-gray-700 rounded p-4 h-[600px] overflow-y-auto bg-gray-800">
                {selectedDoc ? (
                  <div>
                    <div className="flex border-b border-gray-700 mb-4">
                      <button 
                        className={`px-4 py-2 text-white ${activeTab === 'content' ? 'border-b-2 border-blue-500' : ''}`}
                        onClick={() => setActiveTab('content')}
                      >
                        Content
                      </button>
                      <button 
                        className={`px-4 py-2 text-white ${activeTab === 'metadata' ? 'border-b-2 border-blue-500' : ''}`}
                        onClick={() => setActiveTab('metadata')}
                      >
                        Metadata
                      </button>
                    </div>
                    
                    {activeTab === 'content' && (
                      <div className="p-2">
                        <div className="prose prose-sm prose-invert max-w-none text-gray-300">
                          <ReactMarkdown>{selectedDoc.content}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                    
                    {activeTab === 'metadata' && (
                      <div>
                        <div className="border border-gray-700 rounded mb-2">
                          <div 
                            className="p-3 border-b border-gray-700 bg-gray-700 cursor-pointer font-medium text-white"
                            onClick={() => {/* Toggle accordion */}}
                          >
                            Basic Information
                          </div>
                          <div className="p-3 text-gray-300">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div className="font-medium">ID</div>
                              <div className="truncate">{selectedDoc.id}</div>
                              
                              <div className="font-medium">Title</div>
                              <div className="truncate">
                                {selectedDoc.title}
                                {debugMode && selectedDoc.titleExtracted && (
                                  <span className="ml-1 text-xs text-green-400">(extracted)</span>
                                )}
                              </div>
                              
                              {debugMode && selectedDoc.originalTitle && (
                                <>
                                  <div className="font-medium">Original Title</div>
                                  <div className="truncate">{selectedDoc.originalTitle}</div>
                                </>
                              )}
                              
                              <div className="font-medium">Source</div>
                              <div>{selectedDoc.source}</div>
                              
                              <div className="font-medium">Type</div>
                              <div>{selectedDoc.type}</div>
                              
                              <div className="font-medium">Last Updated</div>
                              <div>{formatDate(selectedDoc.timestamp)}</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="border border-gray-700 rounded mb-2">
                          <div 
                            className="p-3 border-b border-gray-700 bg-gray-700 cursor-pointer font-medium text-white"
                            onClick={() => {/* Toggle accordion */}}
                          >
                            File Path
                          </div>
                          <div className="p-3 text-gray-300">
                            <div className="text-sm break-all">
                              {selectedDoc.path || 'No path available'}
                            </div>
                          </div>
                        </div>
                        
                        <div className="border border-gray-700 rounded">
                          <div 
                            className="p-3 border-b border-gray-700 bg-gray-700 cursor-pointer font-medium text-white"
                            onClick={() => {/* Toggle accordion */}}
                          >
                            Tags
                          </div>
                          <div className="p-3">
                            <div className="flex flex-wrap gap-2">
                              {selectedDoc.tags.length > 0 ? (
                                selectedDoc.tags.map((tag) => (
                                  <span key={tag} className="px-2 py-1 bg-gray-600 rounded flex items-center text-gray-200">
                                    <Tag className="h-3 w-3 mr-1" />
                                    {tag}
                                  </span>
                                ))
                              ) : (
                                <span className="text-gray-400">No tags</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <FileText className="h-16 w-16 mb-4" />
                    <p>Select a document to view details</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {stats && (
        <div className="bg-gray-800 shadow rounded-lg">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-xl font-bold text-white">Statistics</h2>
          </div>
          <div className="p-4">
            <div className="flex border-b border-gray-700 mb-4">
              <button 
                className={`px-4 py-2 text-white ${activeStatTab === 'source' ? 'border-b-2 border-blue-500' : ''}`}
                onClick={() => setActiveStatTab('source')}
              >
                By Source
              </button>
              <button 
                className={`px-4 py-2 text-white ${activeStatTab === 'type' ? 'border-b-2 border-blue-500' : ''}`}
                onClick={() => setActiveStatTab('type')}
              >
                By Type
              </button>
              <button 
                className={`px-4 py-2 text-white ${activeStatTab === 'pattern' ? 'border-b-2 border-blue-500' : ''}`}
                onClick={() => setActiveStatTab('pattern')}
              >
                By Path Pattern
              </button>
            </div>
            
            {activeStatTab === 'source' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(stats.bySource).map(([source, count]) => (
                  <div key={source} className="bg-gray-700 p-3 rounded">
                    <div className="font-medium truncate text-white">{source}</div>
                    <div className="text-2xl text-white">{count}</div>
                  </div>
                ))}
              </div>
            )}
            
            {activeStatTab === 'type' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(stats.byType).map(([type, count]) => (
                  <div key={type} className="bg-gray-700 p-3 rounded">
                    <div className="font-medium truncate text-white">{type}</div>
                    <div className="text-2xl text-white">{count}</div>
                  </div>
                ))}
              </div>
            )}
            
            {activeStatTab === 'pattern' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(stats.byPathPattern).map(([pattern, count]) => (
                  <div key={pattern} className="bg-gray-700 p-3 rounded">
                    <div className="font-medium truncate text-white">{pattern}</div>
                    <div className="text-2xl text-white">{count}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 