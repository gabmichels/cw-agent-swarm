import React, { useState } from 'react';
import { AlertCircle, CheckCircle, XCircle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import KnowledgePreview from './KnowledgePreview';
import { FlaggedKnowledgeItem, SuggestedRelationship } from '../../lib/knowledge/flagging/types';

interface FlaggedItemsListProps {
  isLoading: boolean;
  items: FlaggedKnowledgeItem[];
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
    const actionVerb = status === 'approved' ? 'approve' : 'reject';
    const confirmationMessage = `Are you sure you want to ${actionVerb} this item?`;
    if (!window.confirm(confirmationMessage)) {
      return;
    }
    
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
        if (status === 'approved') {
          await processItem(id);
        } else {
          setProcessingItems(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
          });
          onRefresh();
        }
      } else {
        console.error('Failed to update item status');
        alert(`Failed to ${actionVerb} item. Please check console for details.`);
        setProcessingItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
         });
      }
    } catch (error) {
      console.error('Error updating item status:', error);
      alert(`An error occurred while trying to ${actionVerb} the item.`);
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
        const errorData = await response.json().catch(() => ({ error: 'Failed to process item' }));
        console.error('Failed to process item:', errorData);
        alert(`Failed to add approved item to knowledge graph: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error processing item:', error);
      alert('An error occurred while adding the item to the knowledge graph.');
    } finally {
       setProcessingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
       });
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch (e) {
        return dateString;
    }
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
          <div key={item.id} className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
            <div 
              className="p-3 cursor-pointer flex justify-between items-center hover:bg-gray-750"
              onClick={() => toggleItemExpanded(item.id)}
            >
              <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2 pr-4">
                <span className="font-medium truncate" title={item.title}>{item.title}</span>
                <div className="flex gap-1 flex-wrap">
                  {getStatusBadge(item.status)}
                  {getTypeBadge(item.suggestedType)}
                  {getSourceBadge(item.sourceType)}
                </div>
              </div>
              <div className="flex items-center flex-shrink-0">
                {item.status === 'pending' && !processingItems.has(item.id) && (
                  <div className="flex mr-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateItemStatus(item.id, 'approved');
                      }}
                      className="p-1 text-green-400 hover:text-green-300 rounded-full hover:bg-green-900/30"
                      aria-label="Approve"
                      title="Approve"
                    >
                      <CheckCircle className="h-5 w-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateItemStatus(item.id, 'rejected');
                      }}
                      className="p-1 text-red-400 hover:text-red-300 rounded-full hover:bg-red-900/30"
                      aria-label="Reject"
                      title="Reject"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>
                )}
                {processingItems.has(item.id) && (
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500 mr-2"></div>
                )}
                <button 
                  onClick={() => toggleItemExpanded(item.id)}
                  className="p-1 rounded-full hover:bg-gray-600"
                  aria-label={expandedItems.has(item.id) ? "Collapse" : "Expand"}
                >
                  {expandedItems.has(item.id) ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
            
            {expandedItems.has(item.id) && (
              <div className="p-4 border-t border-gray-700 bg-gray-850">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-1 font-medium">Category</p>
                    <p>{item.suggestedCategory}{item.suggestedSubcategory ? ` › ${item.suggestedSubcategory}` : ''}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1 font-medium">Source Ref</p>
                    <p className="truncate" title={item.sourceReference}>{item.sourceReference}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1 font-medium">Confidence</p>
                    <p>{(item.confidence * 100).toFixed(0)}%</p>
                  </div>
                   <div>
                    <p className="text-xs text-gray-400 mb-1 font-medium">Created</p>
                    <p>{formatDate(item.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1 font-medium">Updated</p>
                    <p>{formatDate(item.updatedAt)}</p>
                  </div>
                   {item.processedAt && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1 font-medium">Processed</p>
                      <p>{formatDate(item.processedAt)}</p>
                    </div>
                   )}
                </div>
                
                <div className="mb-4">
                  <p className="text-xs text-gray-400 mb-1 font-medium">Flagged Content</p>
                  <div className="bg-gray-900 p-3 rounded max-h-40 overflow-y-auto text-sm whitespace-pre-wrap">{item.content}</div>
                </div>

                {item.suggestedProperties && (
                  <KnowledgePreview 
                    suggestedType={item.suggestedType}
                    properties={item.suggestedProperties}
                  />
                )}

                {item.suggestedRelationships && item.suggestedRelationships.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-400 mb-1 font-medium">Suggested Relationships</p>
                    <div className="bg-gray-900 p-3 rounded space-y-2">
                      {item.suggestedRelationships.map((rel, index) => (
                        <div key={index} className="text-sm">
                          <span className="font-semibold">{rel.sourceConceptName}</span>
                          <span className="text-purple-400 mx-1">→[{rel.relationshipType}]→</span>
                          <span className="font-semibold">{rel.targetConceptName}</span>
                          <span className="text-gray-400 ml-2">({(rel.strength * 100).toFixed(0)}%)</span>
                          {rel.description && <p className="text-xs text-gray-400 pl-2">- {rel.description}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="mt-4">
                    <p className="text-xs text-gray-400 mb-1 font-medium">Suggested Properties (Raw)</p>
                    <pre className="bg-gray-900 p-3 rounded max-h-40 overflow-y-auto text-xs">{JSON.stringify(item.suggestedProperties, null, 2)}</pre>
                  </div>

                {item.status === 'pending' && (
                  <div className="flex justify-end space-x-3 mt-4 pt-4 border-t border-gray-700">
                    <button
                      onClick={() => updateItemStatus(item.id, 'rejected')}
                      className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded text-sm font-medium transition-colors duration-150"
                      disabled={processingItems.has(item.id)}
                      aria-label="Reject Item"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => updateItemStatus(item.id, 'approved')}
                      className="px-4 py-2 bg-green-700 hover:bg-green-600 rounded text-sm font-medium transition-colors duration-150"
                      disabled={processingItems.has(item.id)}
                      aria-label="Approve Item"
                    >
                      {processingItems.has(item.id) ? 'Processing...' : 'Approve'}
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