import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AlertCircleIcon, Filter, X, Tag, Info, RefreshCw, ChevronDown, Loader2, Search, Hash, Settings, Menu, Bug, User, Star, StarOff, Trash2, Edit3, BookOpen, Brain, FileText, Lightbulb, Target, MessageSquare, Archive, AlertTriangle } from 'lucide-react';
import MemoryItemComponent from '../memory/MemoryItem';
import { SearchResult } from '../../server/memory/services/search/types';
import { BaseMemorySchema, MemoryPoint } from '../../server/memory/models';
import { MemoryType, ImportanceLevel } from '@/constants/memory';
import KnowledgeStats from '../knowledge/KnowledgeStats';
import FlaggedItemsList from '../knowledge/FlaggedItemsList';
import TagSelector from '../knowledge/TagSelector';
import TaggedItemsList from '../knowledge/TaggedItemsList';
import FlaggedMessagesApproval from '../knowledge/FlaggedMessagesApproval';
import MarkdownKnowledgeTab from '../knowledge/MarkdownKnowledgeTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import useKnowledgeMemory from '../../hooks/useKnowledgeMemory';
import useMemory from '../../hooks/useMemory';
import { FlaggedKnowledgeItem, KnowledgeSourceType, SuggestedKnowledgeType } from '../../lib/knowledge/flagging/types';
import { FlaggedItemStatus } from '../../lib/knowledge/flagging/types';

interface KnowledgeTabProps {
  // Props can be expanded as needed
}

// Define markdown memory item interface
interface MarkdownMemoryItem {
  id: string;
  title: string;
  content: string;
  type: string;
  filePath: string;
  importance: string;
  tags: string[];
  lastModified: string;
}

// Define Memory interface for proper typing
interface Memory {
  id: string;
  content?: string;
  text?: string;
  payload?: {
    text?: string;
    type?: string;
    metadata?: {
      title?: string;
      type?: string;
      source?: string;
      contentType?: string;
      fileType?: string;
      filePath?: string;
      extractedFrom?: string;
      importance?: string;
      tags?: string[];
      lastModified?: string;
      [key: string]: unknown;
    };
  };
  timestamp?: string;
  metadata?: {
    title?: string;
    type?: string;
    source?: string;
    contentType?: string;
    fileType?: string;
    filePath?: string;
    extractedFrom?: string;
    importance?: string;
    tags?: string[];
    lastModified?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// Define stats interface
interface KnowledgeStats {
  totalItems: number;
  pendingItems: number;
  approvedItems: number;
  rejectedItems: number;
  bySourceType: Record<string, number>;
  byKnowledgeType: Record<string, number>;
}

const KnowledgeTab: React.FC<KnowledgeTabProps> = () => {
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>('flagged');
  const [filter, setFilter] = useState({
    status: '',
    type: '',
    source: ''
  });
  const [shouldRefresh, setShouldRefresh] = useState(false);
  const [markdownItems, setMarkdownItems] = useState<MarkdownMemoryItem[]>([]);
  const [isLoadingMarkdown, setIsLoadingMarkdown] = useState(false);
  const [markdownFilter, setMarkdownFilter] = useState({
    type: '',
    tags: [] as string[],
    searchQuery: ''
  });
  const [selectedMarkdownItem, setSelectedMarkdownItem] = useState<MarkdownMemoryItem | null>(null);

  // Use the standardized knowledge memory hook
  const {
    knowledgeItems: flaggedItems,
    isLoading: isLoadingFlagged,
    totalCount,
    loadKnowledgeItems,
  } = useKnowledgeMemory({
    types: [
      MemoryType.MESSAGE,
      MemoryType.DOCUMENT,
      MemoryType.THOUGHT
    ],
    onlyFlagged: true,
    autoLoad: false // Explicitly set to false to prevent auto-loading
  });

  // Use memory hook for markdown documents
  const {
    memories: allMemories,
    isLoading: isLoadingMemories,
    getMemories,
    searchMemories
  } = useMemory([MemoryType.DOCUMENT], { autoLoad: false });

  // Load stats - only on component mount
  useEffect(() => {
    const fetchStats = async () => {
      setIsLoadingStats(true);
      try {
        const response = await fetch('/api/knowledge/flagged/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(data.stats);
        } else {
          console.warn('Failed to fetch knowledge stats');
        }
      } catch (error) {
        console.warn('Error fetching knowledge stats:', error);
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchStats();
  }, []);

  // Load knowledge items once on mount and when refresh is triggered
  useEffect(() => {
    // Initial load or when shouldRefresh is true
    if (shouldRefresh) {
      loadKnowledgeItems();
      setShouldRefresh(false); // Reset the refresh flag
    }
  }, [shouldRefresh, loadKnowledgeItems]);

  // Initial load when the component mounts
  useEffect(() => {
    loadKnowledgeItems();
    // The empty dependency array ensures this only runs once on mount
  }, []);

  // Load markdown documents
  const loadMarkdownDocuments = useCallback(async () => {
    setIsLoadingMarkdown(true);
    try {
      // Fetch documents with source = "markdown" or contentType = "markdown"
      const memories = await getMemories({ 
        types: [MemoryType.DOCUMENT],
        limit: 100
      });
      
      console.log('Total memories fetched:', memories.length);
      
      // Helper function to safely access nested metadata
      const getMetadata = (memory: Memory): Record<string, unknown> => {
        if (memory.metadata) return memory.metadata;
        if (memory.payload?.metadata) return memory.payload.metadata as Record<string, unknown>;
        return {};
      };
      
      // Filter and process markdown documents using multiple criteria
      const markdownDocs = memories
        .filter((memory: Memory) => {
          const metadata = getMetadata(memory);
          
          // Check multiple fields that could indicate markdown content
          const isMarkdownSource = metadata.source === 'markdown' || metadata.source === 'file';
          const isMarkdownContentType = metadata.contentType === 'markdown' || metadata.contentType === 'md';
          const isMarkdownFileType = metadata.fileType === 'md' || metadata.fileType === 'markdown';
          
          // Check file path for markdown extensions or common markdown directories
          const filePath = metadata.filePath || metadata.extractedFrom || '';
          const isMarkdownPath = typeof filePath === 'string' && (
            filePath.endsWith('.md') || 
            filePath.includes('/markdown/') || 
            filePath.includes('/docs/') ||
            filePath.includes('/knowledge/')
          );
          
          // Check content for markdown indicators
          const content = typeof memory.content === 'string' ? memory.content : 
                         typeof memory.text === 'string' ? memory.text :
                         typeof memory.payload?.text === 'string' ? memory.payload.text : '';
          
          const hasMarkdownContent = content.includes('# ') || 
                                    content.includes('## ') || 
                                    content.includes('```') ||
                                    content.includes('**');
          
          // Return true if any of the criteria match
          return isMarkdownSource || isMarkdownContentType || isMarkdownFileType || isMarkdownPath || hasMarkdownContent;
        })
        .map((memory: Memory) => {
          const metadata = getMetadata(memory);
          
          // Try different possible locations for content
          const content = typeof memory.content === 'string' ? memory.content : 
                         typeof memory.text === 'string' ? memory.text :
                         typeof memory.payload?.text === 'string' ? memory.payload.text : '';
          
          // Extract title from metadata or from content
          let title = metadata.title ? String(metadata.title) : '';
          if (!title && content) {
            const firstLine = content.split('\n')[0] || '';
            // If first line starts with #, it's likely a markdown title
            if (firstLine.startsWith('#')) {
              title = firstLine.replace(/^#+\s*/, '');
            } else {
              title = firstLine.slice(0, 40) + (firstLine.length > 40 ? '...' : '');
            }
          }
          
          if (!title) {
            title = 'Untitled Document';
          }
          
          // Get importance level
          let importance = metadata.importance ? String(metadata.importance) : 'medium';
          if (metadata.critical === true) {
            importance = 'critical';
          }
          
          // Get tags - could be stored in different locations
          let tags: string[] = [];
          if (Array.isArray(metadata.tags)) {
            tags = metadata.tags.map(tag => String(tag));
          }
          
          return {
            id: memory.id,
            title: title,
            content: content,
            type: String(metadata.type || 'document'),
            filePath: String(metadata.filePath || metadata.extractedFrom || ''),
            importance: importance,
            tags: tags,
            lastModified: String(metadata.lastModified || memory.timestamp || new Date().toISOString())
          };
        });
      
      setMarkdownItems(markdownDocs);
      console.log(`Found ${markdownDocs.length} markdown documents`);
    } catch (error) {
      console.error('Error loading markdown documents:', error);
    } finally {
      setIsLoadingMarkdown(false);
    }
  }, [getMemories]);

  // Load markdown documents on tab selection
  useEffect(() => {
    if (activeTab === 'markdown') {
      loadMarkdownDocuments();
    }
  }, [activeTab, loadMarkdownDocuments]);

  // Filter markdown items based on current filter
  const filteredMarkdownItems = useCallback(() => {
    return markdownItems.filter(item => {
      // Apply type filter
      if (markdownFilter.type && item.type !== markdownFilter.type) {
        return false;
      }
      
      // Apply tag filter
      if (markdownFilter.tags.length > 0) {
        const hasAnyTag = markdownFilter.tags.some(tag => item.tags.includes(tag));
        if (!hasAnyTag) return false;
      }
      
      // Apply search query
      if (markdownFilter.searchQuery) {
        const query = markdownFilter.searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(query) || 
          item.content.toLowerCase().includes(query) ||
          item.filePath.toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [markdownItems, markdownFilter]);

  // Handle filter changes - do not call loadKnowledgeItems directly
  const handleFilterChange = (key: string, value: string) => {
    setFilter(prev => ({ ...prev, [key]: value }));
    // Set flag to refresh data instead of directly calling loadKnowledgeItems
    setShouldRefresh(true);
  };

  // Handle markdown filter changes
  const handleMarkdownFilterChange = (key: string, value: any) => {
    setMarkdownFilter(prev => ({ ...prev, [key]: value }));
  };

  // Handle tag selection changes
  const handleTagChange = (tags: string[]) => {
    setSelectedTags(tags);
  };

  // Refresh items - triggered by user action only
  const handleRefresh = () => {
    setShouldRefresh(true);
  };

  // Convert memory items to flagged knowledge items format
  const convertToFlaggedItems = useCallback((): FlaggedKnowledgeItem[] => {
    return flaggedItems.map(item => ({
      id: item.id,
      type: (item.metadata?.suggestedType || SuggestedKnowledgeType.CONCEPT) as SuggestedKnowledgeType,
      source: (item.metadata?.source || KnowledgeSourceType.MEMORY) as KnowledgeSourceType,
      content: item.content,
      timestamp: new Date(item.timestamp || Date.now()).getTime(),
      status: (item.metadata?.status || FlaggedItemStatus.PENDING) as FlaggedItemStatus,
      metadata: {
        title: item.content.substring(0, 100),
        category: item.metadata?.category || 'general',
        confidence: item.metadata?.confidence || 0.8,
        sourceReference: item.metadata?.sourceReference || '',
        updatedAt: item.metadata?.updatedAt || new Date().toISOString(),
        suggestedProperties: {
          type: 'concept',
          name: item.content.split('\n')[0].substring(0, 50),
          description: item.content
        }
      },
      context: item.metadata?.context,
      confidence: item.metadata?.confidence,
      reviewer: item.metadata?.reviewer,
      reviewNotes: item.metadata?.reviewNotes,
      reviewTimestamp: item.metadata?.reviewTimestamp
    }));
  }, [flaggedItems]);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h2 className="text-xl font-bold mb-4">Knowledge Management</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KnowledgeStats isLoading={isLoadingStats} stats={stats} />
      </div>

      {/* Knowledge Gaps Link */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <a 
          href="/knowledge-gaps" 
          className="block w-full bg-blue-600 hover:bg-blue-700 text-center py-2 px-4 rounded"
        >
          View Knowledge Gaps Analysis
        </a>
        <a 
          href="/knowledge-graph" 
          className="block w-full bg-purple-600 hover:bg-purple-700 text-center py-2 px-4 rounded"
        >
          Explore Knowledge Graph
        </a>
      </div>

      {/* Tabs for different knowledge views */}
      <Tabs 
        defaultValue="flagged" 
        value={activeTab}
        onValueChange={setActiveTab}
        className="mb-6"
      >
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="flagged">Flagged Items</TabsTrigger>
          <TabsTrigger value="messages">Message Approval</TabsTrigger>
          <TabsTrigger value="tagged">By Tag</TabsTrigger>
          <TabsTrigger value="markdown">Markdown Files</TabsTrigger>
        </TabsList>
        
        <TabsContent value="flagged">
          <div className="mb-6">
            <div className="bg-gray-700 p-4 rounded-lg mb-4">
              <h3 className="text-lg font-medium mb-3">Filter Flagged Items</h3>
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select 
                    className="bg-gray-800 border border-gray-600 rounded px-3 py-2 w-full"
                    value={filter.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                  >
                    <option value="">All</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select 
                    className="bg-gray-800 border border-gray-600 rounded px-3 py-2 w-full"
                    value={filter.type}
                    onChange={(e) => handleFilterChange('type', e.target.value)}
                  >
                    <option value="">All</option>
                    <option value="concept">Concept</option>
                    <option value="principle">Principle</option>
                    <option value="framework">Framework</option>
                    <option value="research">Research</option>
                    <option value="relationship">Relationship</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Source</label>
                  <select 
                    className="bg-gray-800 border border-gray-600 rounded px-3 py-2 w-full"
                    value={filter.source}
                    onChange={(e) => handleFilterChange('source', e.target.value)}
                  >
                    <option value="">All</option>
                    <option value="conversation">Conversation</option>
                    <option value="file">File</option>
                    <option value="market_scan">Market Scan</option>
                    <option value="web_search">Web Search</option>
                    <option value="manual_entry">Manual Entry</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <FlaggedItemsList 
            isLoading={isLoadingFlagged} 
            items={convertToFlaggedItems()}
            onRefresh={handleRefresh} 
          />
        </TabsContent>
        
        <TabsContent value="messages">
          <FlaggedMessagesApproval />
        </TabsContent>
        
        <TabsContent value="tagged">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
              <div className="bg-gray-700 p-4 rounded-lg">
                <TagSelector
                  selectedTags={selectedTags}
                  onChange={handleTagChange}
                  maxDisplayed={15}
                />
              </div>
            </div>
            <div className="md:col-span-3">
              <TaggedItemsList 
                tags={selectedTags}
                limit={50}
              />
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="markdown">
          <MarkdownKnowledgeTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default KnowledgeTab; 