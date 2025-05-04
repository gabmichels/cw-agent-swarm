import React, { useState, useEffect } from 'react';
import KnowledgeStats from '../knowledge/KnowledgeStats';
import FlaggedItemsList from '../knowledge/FlaggedItemsList';
import TagSelector from '../knowledge/TagSelector';
import TaggedItemsList from '../knowledge/TaggedItemsList';
import FlaggedMessagesApproval from '../knowledge/FlaggedMessagesApproval';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import useKnowledgeMemory, { KnowledgeImportance } from '../../hooks/useKnowledgeMemory';
import { MemoryType } from '../../server/memory/config';
import { FlaggedKnowledgeItem, KnowledgeSourceType, SuggestedKnowledgeType } from '../../lib/knowledge/flagging/types';

interface KnowledgeTabProps {
  // Props can be expanded as needed
}

const KnowledgeTab: React.FC<KnowledgeTabProps> = () => {
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>('flagged');
  const [filter, setFilter] = useState({
    status: '',
    type: '',
    source: ''
  });

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
    onlyFlagged: true
  });

  // Load stats
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

  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    setFilter(prev => ({ ...prev, [key]: value }));
    
    // Refresh flagged items when filters change
    loadKnowledgeItems();
  };

  // Handle tag selection changes
  const handleTagChange = (tags: string[]) => {
    setSelectedTags(tags);
  };

  // Refresh items
  const handleRefresh = () => {
    loadKnowledgeItems();
  };

  // Convert memory items to flagged knowledge items format
  const convertToFlaggedItems = (): FlaggedKnowledgeItem[] => {
    return flaggedItems.map(item => ({
      id: item.id,
      title: item.content.substring(0, 100),
      content: item.content,
      status: (item.metadata?.status || 'pending') as 'pending' | 'approved' | 'rejected',
      suggestedType: (item.metadata?.suggestedType || 'concept') as SuggestedKnowledgeType,
      sourceType: (item.metadata?.source || 'unknown') as KnowledgeSourceType,
      sourceReference: item.metadata?.sourceReference || '',
      suggestedCategory: item.metadata?.category || 'general',
      confidence: item.metadata?.confidence || 0.8,
      createdAt: item.timestamp.toISOString(),
      updatedAt: item.metadata?.updatedAt || new Date().toISOString(),
      description: item.content,
      metadata: item.metadata,
      suggestedProperties: {
        type: 'concept',
        name: item.content.split('\n')[0].substring(0, 50),
        description: item.content
      }
    }));
  };

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
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="flagged">Flagged Items</TabsTrigger>
          <TabsTrigger value="messages">Message Approval</TabsTrigger>
          <TabsTrigger value="tagged">By Tag</TabsTrigger>
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
      </Tabs>
    </div>
  );
};

export default KnowledgeTab; 