import React, { useState } from 'react';
import { AlertCircle, CheckCircle, XCircle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

interface FlaggedItem {
  id: string;
  title: string;
  content: string;
  sourceType: string;
  sourceReference: string;
  suggestedType: string;
  suggestedCategory: string;
  suggestedSubcategory?: string;
  confidence: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
}

interface FlaggedItemsListProps {
  isLoading: boolean;
  items: FlaggedItem[];
  onRefresh: () => void;
}

const FlaggedItemsList: React.FC<FlaggedItemsListProps> = ({ 
  isLoading, 
  items,
  onRefresh 
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set());

  const toggleItemExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const updateItemStatus = async (id: string, status: 'approved' | 'rejected') => {
    setProcessingItems(prev => new Set(prev).add(id));
    
    try {
      const response = await fetch(`/api/knowledge/flagged/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      
      if (response.ok) {
        // If status is approved, process the item
        if (status === 'approved') {
          await processItem(id);
        } else {
          onRefresh();
        }
      } else {
        console.error('Failed to update item status');
      }
    } catch (error) {
      console.error('Error updating item status:', error);
    } finally {
      setProcessingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const processItem = async (id: string) => {
    try {
      const response = await fetch('/api/knowledge/flagged/process', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });
      
      if (response.ok) {
        onRefresh();
      } else {
        console.error('Failed to process item');
      }
    } catch (error) {
      console.error('Error processing item:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 bg-amber-900/50 text-amber-300 rounded-full text-xs">Pending</span>;
      case 'approved':
        return <span className="px-2 py-1 bg-green-900/50 text-green-300 rounded-full text-xs">Approved</span>;
      case 'rejected':
        return <span className="px-2 py-1 bg-red-900/50 text-red-300 rounded-full text-xs">Rejected</span>;
      default:
        return <span className="px-2 py-1 bg-gray-900/50 text-gray-300 rounded-full text-xs">{status}</span>;
    }
  };

  const getTypeBadge = (type: string) => {
    const badges: Record<string, { bg: string, text: string }> = {
      concept: { bg: 'bg-blue-900/50', text: 'text-blue-300' },
      principle: { bg: 'bg-purple-900/50', text: 'text-purple-300' },
      framework: { bg: 'bg-teal-900/50', text: 'text-teal-300' },
      research: { bg: 'bg-indigo-900/50', text: 'text-indigo-300' },
      relationship: { bg: 'bg-pink-900/50', text: 'text-pink-300' },
    };

    const { bg, text } = badges[type] || { bg: 'bg-gray-900/50', text: 'text-gray-300' };
    return <span className={`px-2 py-1 ${bg} ${text} rounded-full text-xs capitalize`}>{type}</span>;
  };

  const getSourceBadge = (source: string) => {
    const badges: Record<string, { bg: string, text: string }> = {
      conversation: { bg: 'bg-green-900/50', text: 'text-green-300' },
      file: { bg: 'bg-blue-900/50', text: 'text-blue-300' },
      market_scan: { bg: 'bg-purple-900/50', text: 'text-purple-300' },
      web_search: { bg: 'bg-amber-900/50', text: 'text-amber-300' },
      manual_entry: { bg: 'bg-gray-900/50', text: 'text-gray-300' },
    };

    const { bg, text } = badges[source] || { bg: 'bg-gray-900/50', text: 'text-gray-300' };
    const displayName = source.replace('_', ' ');
    return <span className={`px-2 py-1 ${bg} ${text} rounded-full text-xs capitalize`}>{displayName}</span>;
  };

  if (isLoading) {
    return (
      <div className="bg-gray-700 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Flagged Knowledge Items</h3>
        </div>
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-gray-700 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Flagged Knowledge Items</h3>
          <button 
            onClick={onRefresh} 
            className="p-2 rounded hover:bg-gray-600"
            aria-label="Refresh"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
        <div className="text-center py-8 text-gray-400">
          No flagged knowledge items found
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-700 rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Flagged Knowledge Items ({items.length})</h3>
        <button 
          onClick={onRefresh} 
          className="p-2 rounded hover:bg-gray-600"
          aria-label="Refresh"
        >
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>
      
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="bg-gray-800 rounded-lg overflow-hidden">
            <div 
              className="p-3 cursor-pointer flex justify-between items-center hover:bg-gray-750"
              onClick={() => toggleItemExpanded(item.id)}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="font-medium">{item.title}</span>
                <div className="flex gap-2 flex-wrap">
                  {getStatusBadge(item.status)}
                  {getTypeBadge(item.suggestedType)}
                  {getSourceBadge(item.sourceType)}
                </div>
              </div>
              <div className="flex items-center">
                {item.status === 'pending' && !processingItems.has(item.id) && (
                  <div className="flex mr-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateItemStatus(item.id, 'approved');
                      }}
                      className="p-1 text-green-400 hover:text-green-300 mr-1"
                      aria-label="Approve"
                    >
                      <CheckCircle className="h-5 w-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateItemStatus(item.id, 'rejected');
                      }}
                      className="p-1 text-red-400 hover:text-red-300"
                      aria-label="Reject"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>
                )}
                {processingItems.has(item.id) ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500 mr-2"></div>
                ) : null}
                {expandedItems.has(item.id) ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </div>
            </div>
            
            {expandedItems.has(item.id) && (
              <div className="p-4 border-t border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Category</p>
                    <p>{item.suggestedCategory}{item.suggestedSubcategory ? ` › ${item.suggestedSubcategory}` : ''}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Source</p>
                    <p>{item.sourceReference}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Created</p>
                    <p>{formatDate(item.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Confidence</p>
                    <p>{(item.confidence * 100).toFixed(0)}%</p>
                  </div>
                </div>
                
                <div className="mb-4">
                  <p className="text-sm text-gray-400 mb-1">Content</p>
                  <div className="bg-gray-900 p-3 rounded whitespace-pre-wrap">{item.content}</div>
                </div>
                
                {/* Actions */}
                {item.status === 'pending' && (
                  <div className="flex justify-end space-x-2 mt-4">
                    <button
                      onClick={() => updateItemStatus(item.id, 'rejected')}
                      className="px-3 py-1 bg-red-700 hover:bg-red-600 rounded"
                      disabled={processingItems.has(item.id)}
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => updateItemStatus(item.id, 'approved')}
                      className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded"
                      disabled={processingItems.has(item.id)}
                    >
                      Approve
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FlaggedItemsList; 