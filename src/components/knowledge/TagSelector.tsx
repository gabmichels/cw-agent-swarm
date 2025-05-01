import React, { useState, useEffect } from 'react';
import { X, Tag as TagIcon, Loader2 } from 'lucide-react';

interface TagCount {
  tag: string;
  count: number;
  sources: {
    memory: number;
    knowledge: number;
  };
}

interface TagSelectorProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  maxDisplayed?: number;
}

const TagSelector: React.FC<TagSelectorProps> = ({ 
  selectedTags, 
  onChange,
  maxDisplayed = 20
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [tags, setTags] = useState<TagCount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  // Fetch tags on component mount
  useEffect(() => {
    const fetchTags = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('/api/knowledge/tags');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch tags: ${response.status}`);
        }
        
        const data = await response.json();
        setTags(data.tags || []);
      } catch (error) {
        console.error('Error fetching tags:', error);
        setError('Failed to load tags. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTags();
  }, []);

  // Filter tags based on search query
  const filteredTags = tags.filter(tag => 
    tag.tag.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Determine tags to display based on current selection and max display limit
  const displayedTags = showAll ? filteredTags : filteredTags.slice(0, maxDisplayed);
  
  // Toggle tag selection
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter(t => t !== tag));
    } else {
      onChange([...selectedTags, tag]);
    }
  };

  // Clear all selected tags
  const clearAllTags = () => {
    onChange([]);
  };

  // Check if there are more tags to display
  const hasMoreTags = filteredTags.length > maxDisplayed;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <TagIcon className="h-4 w-4 text-gray-400" />
        <h3 className="text-sm font-medium">Filter by Tags</h3>
      </div>
      
      {/* Search input */}
      <div className="relative mb-3">
        <input
          type="text"
          placeholder="Search tags..."
          className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      {/* Selected tags */}
      {selectedTags.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">Selected Tags</span>
            <button 
              className="text-xs text-gray-400 hover:text-white"
              onClick={clearAllTags}
            >
              Clear All
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedTags.map(tag => (
              <div 
                key={tag} 
                className="bg-blue-900/60 text-blue-200 text-xs rounded-full px-2 py-1 flex items-center"
              >
                <span>{tag}</span>
                <button 
                  className="ml-1.5 hover:text-white"
                  onClick={() => toggleTag(tag)}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Available tags */}
      <div>
        <div className="text-xs text-gray-400 mb-2">Available Tags</div>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="text-red-400 text-xs py-2">
            {error}
          </div>
        ) : displayedTags.length === 0 ? (
          <div className="text-gray-500 text-xs py-2">
            {searchQuery ? 'No tags match your search' : 'No tags available'}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {displayedTags.map(({ tag, count }) => (
                <button
                  key={tag}
                  className={`text-xs rounded-full px-2 py-1 flex items-center gap-2 transition-colors ${
                    selectedTags.includes(tag)
                      ? 'bg-blue-900/60 text-blue-200'
                      : 'bg-gray-700/60 text-gray-300 hover:bg-gray-600'
                  }`}
                  onClick={() => toggleTag(tag)}
                >
                  <span>{tag}</span>
                  <span className="bg-gray-800/60 px-1.5 rounded-full text-gray-400 text-xs">
                    {count}
                  </span>
                </button>
              ))}
            </div>
            
            {hasMoreTags && !showAll && (
              <button
                className="mt-2 text-blue-400 text-xs hover:text-blue-300"
                onClick={() => setShowAll(true)}
              >
                Show all tags ({filteredTags.length})
              </button>
            )}
            
            {showAll && (
              <button
                className="mt-2 text-blue-400 text-xs hover:text-blue-300"
                onClick={() => setShowAll(false)}
              >
                Show less
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TagSelector; 