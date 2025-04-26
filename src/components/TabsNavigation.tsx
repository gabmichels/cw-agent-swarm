import React from 'react';
import { MinimizeIcon, MaximizeIcon } from 'lucide-react';

interface TabsNavigationProps {
  selectedTab: string;
  setSelectedTab: (tab: string) => void;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
}

const TabsNavigation: React.FC<TabsNavigationProps> = ({
  selectedTab,
  setSelectedTab,
  isFullscreen,
  toggleFullscreen,
}) => {
  const tabs = ['Chat', 'Tools', 'Tasks', 'Memory', 'Social', 'Files'];

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
  );
};

export default TabsNavigation; 