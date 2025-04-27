import { ChevronDown, MenuIcon, PinIcon } from 'lucide-react';
import React, { useState } from 'react';

interface HeaderProps {
  selectedDepartment: string;
  selectedAgent: string;
  isDeptDropdownOpen: boolean;
  isAgentDropdownOpen: boolean;
  isDebugMode: boolean;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  toggleDeptDropdown: (e: React.MouseEvent) => void;
  toggleAgentDropdown: (e: React.MouseEvent) => void;
  handleDepartmentChange: (dept: string) => void;
  handleAgentChange: (agent: string) => void;
  setIsDebugMode: (value: boolean) => void;
  departments: string[];
  agentsByDepartment: Record<string, string[]>;
}

const Header: React.FC<HeaderProps> = ({
  selectedDepartment,
  selectedAgent,
  isDeptDropdownOpen,
  isAgentDropdownOpen,
  isDebugMode,
  isSidebarOpen,
  toggleSidebar,
  toggleDeptDropdown,
  toggleAgentDropdown,
  handleDepartmentChange,
  handleAgentChange,
  setIsDebugMode,
  departments,
  agentsByDepartment,
}) => {
  return (
    <header className="bg-gray-800 border-b border-gray-700 py-2 px-4 flex justify-between items-center">
      <div className="flex items-center">
        <button 
          onClick={toggleSidebar}
          className="p-2 mr-2 rounded hover:bg-gray-700"
          aria-label="Toggle sidebar"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
        <img 
          src="/assets/images/cw_fulltext.svg" 
          alt="Crowd Wisdom" 
          className="h-8" 
        />
        
        <div className="ml-4 flex space-x-2">
          {/* Department dropdown */}
          <div className="relative">
            <button 
              className="flex items-center px-3 py-1 bg-gray-700 rounded text-sm"
              onClick={toggleDeptDropdown}
            >
              <span>{selectedDepartment}</span>
              <ChevronDown className="h-4 w-4 ml-1" />
            </button>
            
            {isDeptDropdownOpen && (
              <div className="absolute z-10 mt-1 w-40 bg-gray-700 rounded shadow-lg">
                <ul className="py-1">
                  {departments.map((dept) => (
                    <li key={dept}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDepartmentChange(dept);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-600 ${
                          selectedDepartment === dept ? 'bg-blue-600' : ''
                        }`}
                      >
                        {dept}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          {/* Agent dropdown */}
          <div className="relative">
            <button 
              className="flex items-center px-3 py-1 bg-gray-700 rounded text-sm"
              onClick={toggleAgentDropdown}
            >
              <span>{selectedAgent}</span>
              <ChevronDown className="h-4 w-4 ml-1" />
            </button>
            
            {isAgentDropdownOpen && (
              <div className="absolute z-10 mt-1 w-40 bg-gray-700 rounded shadow-lg">
                <ul className="py-1">
                  {(agentsByDepartment[selectedDepartment] || []).map((agent) => (
                    <li key={agent}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAgentChange(agent);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm ${
                          agent.includes('Soon') ? 'text-gray-500 cursor-not-allowed' : 'hover:bg-gray-600'
                        } ${selectedAgent === agent ? 'bg-blue-600' : ''}`}
                      >
                        {agent}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <nav>
          <ul className="flex space-x-4">
            <li>
              <a href="#" className="text-sm hover:text-blue-400">Dashboard</a>
            </li>
            <li>
              <a href="#" className="text-sm hover:text-blue-400">Projects</a>
            </li>
            <li>
              <a href="#" className="text-sm hover:text-blue-400">Analytics</a>
            </li>
            <li>
              <a href="/knowledge-gaps" className="text-sm hover:text-blue-400">Knowledge Gaps</a>
            </li>
            <li>
              <a href="#" className="text-sm hover:text-blue-400">Settings</a>
            </li>
          </ul>
        </nav>
        <button
          onClick={() => setIsDebugMode(!isDebugMode)}
          className={`p-2 rounded ${isDebugMode ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
        >
          <PinIcon className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
};

export default Header; 