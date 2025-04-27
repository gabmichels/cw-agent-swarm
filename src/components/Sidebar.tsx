import React from 'react';
import { PinIcon } from 'lucide-react';

interface SidebarProps {
  isSidebarOpen: boolean;
  isSidebarPinned: boolean;
  selectedAgent: string;
  toggleSidebarPin: () => void;
  setSelectedAgent: (agent: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isSidebarOpen,
  isSidebarPinned,
  selectedAgent,
  toggleSidebarPin,
  setSelectedAgent,
}) => {
  if (!isSidebarOpen) return null;

  return (
    <>
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <h2 className="font-semibold">Quick Actions</h2>
        <button
          onClick={toggleSidebarPin} 
          className={`p-1 rounded ${isSidebarPinned ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
          title={isSidebarPinned ? "Unpin sidebar" : "Pin sidebar"}
        >
          <PinIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-sm font-semibold mb-2 text-gray-400">AGENTS</h3>
        <ul className="space-y-1 mb-4">
          <li>
            <button
              onClick={() => setSelectedAgent('Chloe')}
              className={`w-full text-left block p-2 rounded ${selectedAgent === 'Chloe' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
            >
              Chloe (Marketing)
            </button>
          </li>
          <li>
            <button className="w-full text-left block p-2 rounded text-gray-500 cursor-not-allowed">
              Emma (HR) - Coming Soon
            </button>
          </li>
          <li>
            <button className="w-full text-left block p-2 rounded text-gray-500 cursor-not-allowed">
              Alex (Finance) - Coming Soon
            </button>
          </li>
        </ul>
        
        <h3 className="text-sm font-semibold mb-2 text-gray-400">COMMON TASKS</h3>
        <ul className="space-y-1">
          <li>
            <button className="w-full text-left block p-2 rounded hover:bg-gray-700">
              Content Planning
            </button>
          </li>
          <li>
            <button className="w-full text-left block p-2 rounded hover:bg-gray-700">
              Social Monitoring
            </button>
          </li>
          <li>
            <button className="w-full text-left block p-2 rounded hover:bg-gray-700">
              Create Campaign
            </button>
          </li>
          <li>
            <button className="w-full text-left block p-2 rounded hover:bg-gray-700">
              Analyze Metrics
            </button>
          </li>
          <li>
            <a href="/knowledge-gaps" className="w-full text-left block p-2 rounded hover:bg-gray-700">
              Knowledge Gaps
            </a>
          </li>
        </ul>
      </div>
    </>
  );
};

export default Sidebar; 