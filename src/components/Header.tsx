import { ChevronDown, MenuIcon, PinIcon, Settings } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AgentMonitor } from '@/agents/shared/monitoring/AgentMonitor';
import { WorkspaceSettingsModal } from './workspace/WorkspaceSettingsModal';
import { SettingsModal } from './SettingsModal';

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
  userId?: string;
  organizationId?: string;
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
  userId,
  organizationId,
}) => {
  const [hasMultipleAgents, setHasMultipleAgents] = useState<boolean>(false);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [workspaceConnectionCount, setWorkspaceConnectionCount] = useState<number>(0);
  const [showSuccessMessage, setShowSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const checkMultipleAgents = () => {
      const logs = AgentMonitor.getLogs();
      const uniqueAgents = new Set(logs.map(l => l.agentId));
      setHasMultipleAgents(uniqueAgents.size > 1);
    };
    
    // Check initially
    checkMultipleAgents();
    
    // Set up an interval to check periodically
    const intervalId = setInterval(checkMultipleAgents, 30000);
    
    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, []);

  // Handle OAuth callback success and load workspace connections
  useEffect(() => {
    const loadWorkspaceConnections = async () => {
      try {
        const params = new URLSearchParams();
        if (userId) params.append('userId', userId);
        if (organizationId) params.append('organizationId', organizationId);

        const response = await fetch(`/api/workspace/connections?${params}`);
        const data = await response.json();

        if (data.success) {
          setWorkspaceConnectionCount(data.connections.length);
        }
      } catch (error) {
        console.error('Error loading workspace connections:', error);
      }
    };

    const handleOAuthCallback = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const workspaceConnected = urlParams.get('workspace_connected');
      const provider = urlParams.get('provider');
      const error = urlParams.get('error');

      if (workspaceConnected && provider) {
        setShowSuccessMessage(`Successfully connected to ${provider.replace('_', ' ')}`);
        // Clean up URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Refresh workspace connections immediately after successful OAuth
        loadWorkspaceConnections().then(() => {
          // Dispatch custom event to notify other components
          window.dispatchEvent(new CustomEvent('workspaceConnectionsUpdated'));
          
          // Auto-open workspace modal to show the new connection AFTER connections are refreshed
          // Add a small delay to ensure database consistency
          setTimeout(() => {
            setIsWorkspaceModalOpen(true);
          }, 500);
        });
        
        // Clear success message after 5 seconds
        setTimeout(() => setShowSuccessMessage(null), 5000);
        return true; // Indicate OAuth callback was handled
      } else if (error) {
        console.error('Workspace connection error:', error);
        return true; // Indicate OAuth callback was handled (even if error)
      }
      return false; // No OAuth callback
    };

    // Handle OAuth callback first
    const wasOAuthCallback = handleOAuthCallback();
    
    // Only load connections on initial mount if there's no OAuth callback
    if (!wasOAuthCallback) {
      loadWorkspaceConnections();
    }
  }, [userId, organizationId]);

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
              <Link href="/org-chart" className="text-sm hover:text-blue-400">
                Org Chart
              </Link>
            </li>
            {/* Commented out hasMultipleAgents check for testing */}
            {/* {hasMultipleAgents && ( */}
              <li>
                <Link href="/agents" className="text-sm hover:text-blue-400">
                  Agents
                </Link>
              </li>
            {/* )} */}
            <li>
              <Link href="/multi-agent-chat" className="text-sm hover:text-blue-400">
                Multi-Agent
              </Link>
            </li>
            <li>
              <a href="/knowledge-gaps" className="text-sm hover:text-blue-400">Knowledge Gaps</a>
            </li>
            <li>
              <button 
                onClick={() => setIsWorkspaceModalOpen(true)}
                className="text-sm hover:text-blue-400" 
              >
                Workspace
                {workspaceConnectionCount > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-green-600 text-xs rounded-full">
                    {workspaceConnectionCount}
                  </span>
                )}
              </button>
            </li>
            <li>
              <button 
                onClick={() => setIsSettingsModalOpen(true)}
                className="text-sm hover:text-blue-400"
              >
                Settings
              </button>
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

      {/* Success Message */}
      {showSuccessMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg">
          <div className="flex items-center">
            <Settings className="h-4 w-4 mr-2" />
            {showSuccessMessage}
          </div>
        </div>
      )}

      {/* Workspace Settings Modal */}
      <WorkspaceSettingsModal
        isOpen={isWorkspaceModalOpen}
        onClose={() => {
          setIsWorkspaceModalOpen(false);
          // Refresh connection count when modal closes
          const params = new URLSearchParams();
          if (userId) params.append('userId', userId);
          if (organizationId) params.append('organizationId', organizationId);
          
          fetch(`/api/workspace/connections?${params}`)
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                setWorkspaceConnectionCount(data.connections.length);
              }
            })
            .catch(console.error);
        }}
        userId={userId}
        organizationId={organizationId}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        userId={userId}
        organizationId={organizationId}
      />
    </header>
  );
};

export default Header; 