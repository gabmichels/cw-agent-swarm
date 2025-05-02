import React, { useState, useCallback } from 'react';
import { MinimizeIcon, MaximizeIcon, Search } from 'lucide-react';
import SearchResults from './SearchResults';

interface TabsNavigationProps {
  selectedTab: string;
  setSelectedTab: (tab: string) => void;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  onSearch?: (query: string) => void;
  onSearchFocus?: () => void;
  onSearchClose?: () => void;
  searchResults?: any[];
  searchQuery?: string;
  onSelectResult?: (messageId: string) => void;
}

const TabsNavigation: React.FC<TabsNavigationProps> = ({
  selectedTab,
  setSelectedTab,
  isFullscreen,
  toggleFullscreen,
  onSearch,
  onSearchFocus,
  onSearchClose,
  searchResults = [],
  searchQuery = '',
  onSelectResult
}) => {
  const tabs = ['Chat', 'Tools', 'Tasks', 'Memory', 'Knowledge', 'Social', 'Files'];
  const [searchInputValue, setSearchInputValue] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInputValue(value);
    
    if (onSearch) {
      onSearch(value);
    }
  }, [onSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(searchInputValue);
    }
  }, [searchInputValue, onSearch]);

  const handleClearSearch = useCallback(() => {
    setSearchInputValue('');
    
    if (onSearch) {
      onSearch('');
    }
    
    if (onSearchClose) {
      onSearchClose();
    }
    
    setShowSearchResults(false);
  }, [onSearch, onSearchClose]);

  const handleSearchFocus = useCallback(() => {
    setShowSearchResults(true);
    
    if (onSearchFocus) {
      onSearchFocus();
    }
    
    // Automatically show search results when focusing the search input
    if (searchInputValue.trim() && onSearch) {
      onSearch(searchInputValue);
    }
  }, [onSearchFocus, searchInputValue, onSearch]);
  
  const handleSearchBlur = useCallback((e: React.FocusEvent) => {
    // Don't hide results if clicking within the results panel
    if (e.relatedTarget && (e.relatedTarget as HTMLElement).closest('.search-results-panel')) {
      return;
    }
    
    // Small delay to allow for clicks on search results
    setTimeout(() => {
      if (!document.activeElement?.closest('.search-results-panel')) {
        setShowSearchResults(false);
      }
    }, 200);
  }, []);

  return (
    <div className="bg-gray-800 border-b border-gray-700 p-2 flex justify-between items-center">
      <div className="flex space-x-1">
        {tabs.map((tab) => (
          <button 
            key={tab}
            onClick={() => setSelectedTab(tab.toLowerCase())}
            className={`px-3 py-1 rounded-t ${
              selectedTab === tab.toLowerCase()
                ? 'bg-gray-700 text-white'
                : 'hover:bg-gray-700/50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="flex items-center space-x-2">
        {/* Active search input */}
        <div className="relative search-input-container">
          <input
            type="text"
            placeholder="Search messages..."
            value={searchInputValue}
            onChange={handleSearch}
            onKeyDown={handleKeyDown}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            className="bg-gray-700 text-white text-sm rounded-md px-8 py-1.5 w-56 focus:outline-none focus:ring-1 focus:ring-blue-500"
            aria-label="Search messages"
          />
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          {searchInputValue && (
            <button
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
              onClick={handleClearSearch}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
          
          {/* Search results dropdown */}
          {showSearchResults && searchInputValue && (
            <div className="absolute right-0 top-full z-50 mt-1">
              <SearchResults
                searchQuery={searchInputValue}
                results={searchResults || []}
                onSelectMessage={(id) => {
                  console.log('Selected search result:', id);
                  if (onSelectResult) {
                    onSelectResult(id);
                  }
                }}
                onClose={() => setShowSearchResults(false)}
              />
            </div>
          )}
        </div>
        
        <button 
          onClick={toggleFullscreen}
          className="p-2 rounded hover:bg-gray-700"
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? (
            <MinimizeIcon className="h-5 w-5" />
          ) : (
            <MaximizeIcon className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
};

export default TabsNavigation; 