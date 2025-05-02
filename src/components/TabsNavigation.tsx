import React, { useState, useEffect } from 'react';
import { MinimizeIcon, MaximizeIcon, Search } from 'lucide-react';

interface TabsNavigationProps {
  selectedTab: string;
  setSelectedTab: (tab: string) => void;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  onSearch?: (query: string) => void;
}

const TabsNavigation: React.FC<TabsNavigationProps> = ({
  selectedTab,
  setSelectedTab,
  isFullscreen,
  toggleFullscreen,
  onSearch,
}) => {
  const tabs = ['Chat', 'Tools', 'Tasks', 'Memory', 'Knowledge', 'Social', 'Files'];
  const [searchQuery, setSearchQuery] = useState('');

  // Update search whenever the query changes
  useEffect(() => {
    if (onSearch) {
      console.log('TabsNavigation useEffect calling onSearch with:', searchQuery);
      onSearch(searchQuery);
    }
  }, [searchQuery, onSearch]);

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
        {/* Search input disabled for now - waiting for pagination implementation
        <div className="relative">
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => {
              console.log('Search input changed to:', e.target.value);
              setSearchQuery(e.target.value);
            }}
            className="bg-gray-700 text-white text-sm rounded-md px-8 py-1 w-48 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          {searchQuery && (
            <button
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
              onClick={() => setSearchQuery('')}
            >
              &times;
            </button>
          )}
        </div>
        */}
        
        {/* Disabled search placeholder */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search (coming soon)..."
            disabled
            className="bg-gray-800 text-gray-500 text-sm rounded-md px-8 py-1 w-48 cursor-not-allowed"
          />
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-600" />
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