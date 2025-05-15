import React from 'react';
import { FlaggedKnowledgeItem, KnowledgeSourceType, SuggestedKnowledgeType, FlaggedItemStatus } from '../../lib/knowledge/flagging/types';

interface FlaggedItemsListProps {
  items: FlaggedKnowledgeItem[];
  onItemClick?: (item: FlaggedKnowledgeItem) => void;
  isLoading?: boolean;
  onRefresh?: () => void;
}

const getTypeBadge = (type: SuggestedKnowledgeType) => {
  const colors: Record<SuggestedKnowledgeType, string> = {
    [SuggestedKnowledgeType.CONCEPT]: 'bg-blue-600',
    [SuggestedKnowledgeType.RELATIONSHIP]: 'bg-purple-600',
    [SuggestedKnowledgeType.FACT]: 'bg-green-600',
    [SuggestedKnowledgeType.RULE]: 'bg-yellow-600',
    [SuggestedKnowledgeType.PROCEDURE]: 'bg-red-600'
  };
  return (
    <span className={`px-2 py-1 rounded text-xs ${colors[type] || 'bg-gray-600'}`}>
      {type}
    </span>
  );
};

const getSourceBadge = (source: KnowledgeSourceType) => {
  const colors: Record<KnowledgeSourceType, string> = {
    [KnowledgeSourceType.CONVERSATION]: 'bg-blue-600',
    [KnowledgeSourceType.DOCUMENT]: 'bg-purple-600',
    [KnowledgeSourceType.TASK]: 'bg-green-600',
    [KnowledgeSourceType.MEMORY]: 'bg-yellow-600',
    [KnowledgeSourceType.EXTERNAL]: 'bg-red-600'
  };
  return (
    <span className={`px-2 py-1 rounded text-xs ${colors[source] || 'bg-gray-600'}`}>
      {source}
    </span>
  );
};

const getStatusBadge = (status: FlaggedItemStatus) => {
  const colors: Record<FlaggedItemStatus, string> = {
    [FlaggedItemStatus.PENDING]: 'bg-yellow-600',
    [FlaggedItemStatus.APPROVED]: 'bg-green-600',
    [FlaggedItemStatus.REJECTED]: 'bg-red-600',
    [FlaggedItemStatus.NEEDS_REVIEW]: 'bg-orange-600'
  };
  return (
    <span className={`px-2 py-1 rounded text-xs ${colors[status] || 'bg-gray-600'}`}>
      {status}
    </span>
  );
};

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const FlaggedItemsList: React.FC<FlaggedItemsListProps> = ({ 
  items, 
  onItemClick,
  isLoading = false,
  onRefresh
}) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="flagged-items-list">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Flagged Items ({items.length})</h3>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
          >
            Refresh
          </button>
        )}
      </div>
      
      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          No flagged items found
        </div>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            className="flagged-item bg-gray-700 p-4 rounded-lg mb-4 cursor-pointer hover:bg-gray-600"
            onClick={() => onItemClick?.(item)}
          >
            <div className="item-header flex justify-between items-center mb-2">
              <div className="flex gap-2">
                {getTypeBadge(item.type)}
                {getSourceBadge(item.source)}
                {getStatusBadge(item.status)}
              </div>
              {item.confidence !== undefined && (
                <span className="text-sm text-gray-400">
                  Confidence: {(item.confidence * 100).toFixed(0)}%
                </span>
              )}
            </div>
            <div className="item-content text-gray-200 mb-2">
              {item.content}
            </div>
            <div className="item-metadata flex justify-between items-center text-sm text-gray-400">
              <span className="item-date">
                {formatDate(item.timestamp)}
              </span>
              {item.reviewer && (
                <span className="text-sm">
                  Reviewed by: {item.reviewer}
                </span>
              )}
            </div>
            {item.reviewNotes && (
              <div className="mt-2 text-sm text-gray-400 italic">
                Review notes: {item.reviewNotes}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default FlaggedItemsList; 