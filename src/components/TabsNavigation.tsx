import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { MinimizeIcon, MaximizeIcon, Search, Settings, Activity } from 'lucide-react';
import SearchResults from './SearchResults';
import AgentSettings from './agent/AgentSettings';

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
  agentId?: string;
  agentName?: string;
  onDeleteChatHistory?: () => Promise<boolean>;
  onViewAgent?: (agentId: string) => void;
}

const TabsNavigation: React.FC<TabsNavigationProps> = React.memo(({
  selectedTab,
  setSelectedTab,
  isFullscreen,
  toggleFullscreen,
  onSearch,
  onSearchFocus,
  onSearchClose,
  searchResults = [],
  searchQuery = '',
  onSelectResult,
  agentId = '',
  agentName = 'Agent',
  onDeleteChatHistory,
  onViewAgent
}) => {
  // Memoize tabs array to prevent recreation on every render
  const tabs = useMemo(() => ['Chat', 'Memory', 'Tools', 'Tasks', 'Knowledge', 'Bookmarks', 'Files', 'Visualizations'], []);
  
  const [searchInputValue, setSearchInputValue] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  const handleTabClick = useCallback((tab: string) => {
    setSelectedTab(tab.toLowerCase());
  }, [setSelectedTab]);

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

  const handleViewAgent = useCallback(() => {
    if (agentId && onViewAgent) {
      onViewAgent(agentId);
    } else if (agentId) {
      window.location.assign(`/agents/${agentId}`);
    }
    setShowSettingsMenu(false);
  }, [agentId, onViewAgent]);

  const handleDeleteChatHistory = useCallback(async () => {
    if (onDeleteChatHistory) {
      const confirmed = window.confirm("Are you sure you want to delete the chat history? This action cannot be undone.");
      if (confirmed) {
        const success = await onDeleteChatHistory();
        if (success) {
          alert("Chat history deleted successfully");
        }
      }
    }
    setShowSettingsMenu(false);
  }, [onDeleteChatHistory]);

  // Close settings menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setShowSettingsMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <>
      <div className="bg-gray-800 border-b border-gray-700 p-2 flex justify-between items-center">
        <div className="flex space-x-1">
          {tabs.map((tab) => (
            <button 
              key={tab}
              onClick={() => handleTabClick(tab)}
              className={`px-3 py-1 rounded-t flex items-center space-x-1 ${
                selectedTab === tab.toLowerCase()
                  ? 'bg-gray-700 text-white'
                  : 'hover:bg-gray-700/50'
              }`}
            >
              {tab === 'Visualizations' && <Activity className="h-4 w-4" />}
              <span>{tab}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center space-x-2">
          {/* Settings Icon with Context Menu */}
          <div className="relative" ref={settingsMenuRef}>
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="p-2 rounded hover:bg-gray-700"
              aria-label="Settings"
              title="Settings"
            >
              <Settings className="h-5 w-5" />
            </button>
            
            {showSettingsMenu && (
              <div className="absolute right-0 mt-1 w-48 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 z-50">
                <div className="py-1" role="menu" aria-orientation="vertical">
                  <button
                    onClick={handleViewAgent}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-100 hover:bg-gray-700"
                    role="menuitem"
                  >
                    View Agent
                  </button>
                  <button
                    onClick={handleDeleteChatHistory}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-100 hover:bg-gray-700"
                    role="menuitem"
                  >
                    Delete Chat History
                  </button>
                </div>
              </div>
            )}
          </div>
          
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
              <div className="absolute right-0 top-full z-50 mt-1 search-results-panel">
                <SearchResults
                  searchQuery={searchInputValue}
                  results={searchResults || []}
                  onSelectResult={(id) => {
                    if (onSelectResult) {
                      onSelectResult(id);
                    }
                  }}
                  onClose={() => setShowSearchResults(false)}
                />
              </div>
            )}
          </div>
          
          {/* Agent Settings Button */}
          {agentId && (
            <div className="p-2 rounded hover:bg-gray-700">
              <AgentSettings 
                agentId={agentId}
                agentName={agentName}
              />
            </div>
          )}
          
          {/* Fullscreen Button */}
          <button 
            onClick={toggleFullscreen}
            className="p-2 rounded hover:bg-gray-700"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <MinimizeIcon className="h-5 w-5" />
            ) : (
              <MaximizeIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </>
  );
});

export default TabsNavigation; 