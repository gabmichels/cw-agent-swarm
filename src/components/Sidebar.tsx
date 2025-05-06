import React from 'react';
import { PinIcon, ActivityIcon } from 'lucide-react';
import Link from 'next/link';

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
              <div className="flex items-center space-x-2">
                <span>Chloe</span>
                <span className="px-2 py-0.5 text-xs leading-5 font-semibold rounded-full bg-blue-800 text-blue-100">
                  Autonomous
                </span>
              </div>
            </button>
          </li>
        </ul>
        
        <h3 className="text-sm font-semibold mb-2 text-gray-400">DEVELOPER</h3>
        <ul className="space-y-1">
          <li>
            <Link 
              href="/debug/graph" 
              className="w-full text-left flex items-center p-2 rounded hover:bg-gray-700"
            >
              <ActivityIcon className="h-4 w-4 mr-2" />
              <span>Execution Graph</span>
            </Link>
          </li>
        </ul>
      </div>
    </>
  );
};

export default Sidebar; 