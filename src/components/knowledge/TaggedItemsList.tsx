import React, { useState, useEffect } from 'react';
import { Loader2, Tag as TagIcon, FileText, MessageCircle, Brain } from 'lucide-react';

interface TaggedItem {
  id: string;
  title: string;
  content: string;
  type: string;
  tags: string[];
  createdAt: string;
  importance?: string;
  source?: string;
}

interface TaggedItemsListProps {
  tags: string[];
  limit?: number;
}

const TaggedItemsList: React.FC<TaggedItemsListProps> = ({ 
  tags,
  limit = 20
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<TaggedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Fetch items when tags change
  useEffect(() => {
    const fetchItems = async () => {
      // If no tags selected, don't fetch anything
      if (tags.length === 0) {
        setItems([]);
        return;
      }
      
      setIsLoading(true);
      setError(null);
      
      try {
        // Build query string with tags
        const queryParams = new URLSearchParams();
        queryParams.append('limit', limit.toString());
        tags.forEach(tag => queryParams.append('tags', tag));
        
        // Fetch from memory API
        const response = await fetch(`/api/memory/all?${queryParams.toString()}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch tagged items: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Transform memory records to tagged items
        const transformedItems: TaggedItem[] = (data.items || []).map((item: any) => ({
          id: item.id || '',
          title: getTitle(item.text),
          content: item.text || '',
          type: item.type || 'unknown',
          tags: item.metadata?.tags || [],
          createdAt: item.timestamp || '',
          importance: item.metadata?.importance || 'medium',
          source: item.metadata?.source || 'unknown'
        }));
        
        setItems(transformedItems);
      } catch (error) {
        console.error('Error fetching tagged items:', error);
        setError('Failed to load items. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchItems();
  }, [tags, limit]);

  // Helper to extract a title from content
  const getTitle = (content: string): string => {
    if (!content) return 'Untitled';
    
    // Try to get first line as title
    const firstLine = content.split('\n')[0].trim();
    if (firstLine.length > 0 && firstLine.length <= 100) {
      return firstLine;
    }
    
    // Otherwise take first 60 chars
    return content.substring(0, 60) + (content.length > 60 ? '...' : '');
  };

  // Toggle item expanded state
  const toggleItemExpanded = (id: string) => {
    setExpandedItem(expandedItem === id ? null : id);
  };

  // Get icon based on item type
  const getItemIcon = (type: string) => {
    switch(type.toLowerCase()) {
      case 'message':
        return <MessageCircle className="h-4 w-4" />;
      case 'thought':
      case 'insight':
        return <Brain className="h-4 w-4" />;
      case 'document':
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  // Format date for display
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (e) {
      return dateString;
    }
  };

  // Display importance badge
  const getImportanceBadge = (importance: string = 'medium') => {
    const colors = {
      high: 'bg-red-900/50 text-red-300',
      medium: 'bg-amber-900/50 text-amber-300',
      low: 'bg-green-900/50 text-green-300',
      critical: 'bg-purple-900/50 text-purple-300'
    };
    
    const bgColor = colors[importance as keyof typeof colors] || colors.medium;
    
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${bgColor}`}>
        {importance}
      </span>
    );
  };

  // Show placeholder if no tags selected
  if (tags.length === 0) {
    return (
      <div className="bg-gray-700 rounded-lg p-6 text-center">
        <TagIcon className="h-8 w-8 mx-auto mb-2 text-gray-500" />
        <p className="text-gray-500">
          Select one or more tags to view related knowledge items
        </p>
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="bg-gray-700 rounded-lg p-6 flex justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 mx-auto mb-2 text-blue-500 animate-spin" />
          <p className="text-gray-400">Fetching tagged items...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="bg-gray-700 rounded-lg p-6 text-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  // Show empty state
  if (items.length === 0) {
    return (
      <div className="bg-gray-700 rounded-lg p-6 text-center">
        <p className="text-gray-500">
          No items found with the selected tags
        </p>
      </div>
    );
  }

  // Show items
  return (
    <div className="bg-gray-700 rounded-lg p-4">
      <h3 className="text-lg font-medium mb-4">
        Tagged Items ({items.length})
      </h3>
      
      <div className="space-y-3">
        {items.map(item => (
          <div 
            key={item.id} 
            className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700"
          >
            <div 
              className="p-3 cursor-pointer flex flex-col hover:bg-gray-750"
              onClick={() => toggleItemExpanded(item.id)}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  {getItemIcon(item.type)}
                  <h4 className="font-medium">{item.title}</h4>
                </div>
                {getImportanceBadge(item.importance)}
              </div>
              
              <div className="flex flex-wrap gap-2 mb-2">
                {item.tags.map(tag => (
                  <span 
                    key={tag} 
                    className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              
              <div className="flex justify-between text-xs text-gray-500">
                <div>Type: {item.type}</div>
                <div>Created: {formatDate(item.createdAt)}</div>
              </div>
              
              {expandedItem === item.id && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="prose prose-sm prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap bg-gray-900 p-3 rounded text-xs">
                      {item.content}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaggedItemsList; 