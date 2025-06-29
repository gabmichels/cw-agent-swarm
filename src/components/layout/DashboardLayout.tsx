import { useRouter } from 'next/navigation';
import React, { ReactNode, useEffect, useState, useRef, useCallback } from 'react';
import { AgentService } from '../../services/AgentService';
import Header from '../Header';
import Sidebar from '../Sidebar';
import TabsNavigation from '../TabsNavigation';

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const router = useRouter();
  
  // State for available agents
  const [availableAgents, setAvailableAgents] = useState<Record<string, string[]>>({
    Marketing: [],
    HR: [],
    Finance: []
  });
  
  // State for the layout components
  const [selectedDepartment, setSelectedDepartment] = useState('Marketing');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [selectedTab, setSelectedTab] = useState('knowledge');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);
  
  // Sidebar resize state
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  
  // User context - for now using same pattern as other pages
  const userId = "test-user";
  const organizationId = undefined; // Can be added later when org context is available
  
  // Agent ID-to-name mapping
  const [agentIdMap, setAgentIdMap] = useState<Record<string, string>>({});

  // Handle resize functionality
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    const newWidth = e.clientX;
    if (newWidth >= 200 && newWidth <= 600) { // Min and max width constraints
      setSidebarWidth(newWidth);
    }
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);
  
  // Load available agents from registry
  useEffect(() => {
    const loadAgents = async () => {
      try {
        // Get agent IDs from registry
        const agentIds = await AgentService.getAgentIds();
        
        if (!agentIds.length) {
          console.log('No agents found in registry');
          return;
        }
        
        // Group agents by department (in a real app, you'd get this from agent metadata)
        const agentsByDept: Record<string, string[]> = {
          Marketing: [],
          HR: [],
          Finance: []
        };
        
        // Create ID to name mapping
        const idToName: Record<string, string> = {};
        
        // For now, place all agents in Marketing dept - in real app would check capabilities
        for (const id of agentIds) {
          const agent = await AgentService.getAgent(id);
          if (agent) {
            // Determine department based on agent capabilities or metadata
            const dept = agent.metadata?.department || 'Marketing';
            // Use agent name or ID as display name
            const name = agent.name || id;
            // Add to department list
            if (agentsByDept[dept]) {
              agentsByDept[dept].push(name);
            } else {
              agentsByDept[dept] = [name];
            }
            
            // Add to ID mapping
            idToName[id] = name;
            if (name.toLowerCase() === selectedAgent.toLowerCase()) {
              setSelectedAgentId(id);
            }
          }
        }
        
        setAgentIdMap(idToName);
        setAvailableAgents(agentsByDept);
        
        // If no agent is selected but we have agents, select the first one
        if (!selectedAgent && Object.values(agentsByDept).some(arr => arr.length > 0)) {
          const firstDept = Object.keys(agentsByDept).find(dept => agentsByDept[dept].length > 0);
          if (firstDept) {
            setSelectedDepartment(firstDept);
            setSelectedAgent(agentsByDept[firstDept][0]);
            // Find the ID for this agent
            const agentId = Object.keys(idToName).find(
              id => idToName[id].toLowerCase() === agentsByDept[firstDept][0].toLowerCase()
            );
            if (agentId) {
              setSelectedAgentId(agentId);
            }
          }
        }
      } catch (error) {
        console.error('Error loading agents:', error);
      }
    };
    
    loadAgents();
  }, [selectedAgent]);

  // Toggle functions
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleSidebarPin = () => setIsSidebarPinned(!isSidebarPinned);
  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);
  const toggleDeptDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeptDropdownOpen(!isDeptDropdownOpen);
    setIsAgentDropdownOpen(false);
  };
  const toggleAgentDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAgentDropdownOpen(!isAgentDropdownOpen);
    setIsDeptDropdownOpen(false);
  };

  // Handle department and agent changes
  const handleDepartmentChange = (dept: string) => {
    setSelectedDepartment(dept);
    setIsDeptDropdownOpen(false);
    
    // If the department has agents, select the first one
    if (availableAgents[dept] && availableAgents[dept].length > 0) {
      const newAgent = availableAgents[dept][0];
      setSelectedAgent(newAgent);
      
      // Find agent ID
      const agentId = Object.keys(agentIdMap).find(
        id => agentIdMap[id].toLowerCase() === newAgent.toLowerCase()
      );
      if (agentId) {
        setSelectedAgentId(agentId);
      }
    } else {
      setSelectedAgent('');
      setSelectedAgentId('');
    }
  };

  const handleAgentChange = (agent: string) => {
    setSelectedAgent(agent);
    setIsAgentDropdownOpen(false);
    
    // Find agent ID
    const agentId = Object.keys(agentIdMap).find(
      id => agentIdMap[id].toLowerCase() === agent.toLowerCase()
    );
    if (agentId) {
      setSelectedAgentId(agentId);
    }
  };

  // List of available departments
  const departments = Object.keys(availableAgents);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header - hide in fullscreen mode */}
      {!isFullscreen && (
        <Header
          selectedDepartment={selectedDepartment}
          selectedAgent={selectedAgent}
          isDeptDropdownOpen={isDeptDropdownOpen}
          isAgentDropdownOpen={isAgentDropdownOpen}
          isDebugMode={isDebugMode}
          isSidebarOpen={isSidebarOpen}
          toggleSidebar={toggleSidebar}
          toggleDeptDropdown={toggleDeptDropdown}
          toggleAgentDropdown={toggleAgentDropdown}
          handleDepartmentChange={handleDepartmentChange}
          handleAgentChange={handleAgentChange}
          setIsDebugMode={setIsDebugMode}
          departments={departments}
          agentsByDepartment={availableAgents}
          userId={userId}
          organizationId={organizationId}
        />
      )}

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - conditionally show based on state */}
        {isSidebarOpen && !isFullscreen && (
          <div className="relative flex">
            <div 
              className="bg-gray-800 border-r border-gray-700 flex flex-col transition-all duration-300"
              style={{ width: `${sidebarWidth}px` }}
            >
              <Sidebar
                isSidebarOpen={isSidebarOpen}
                isSidebarPinned={isSidebarPinned}
                selectedAgent={selectedAgent}
                toggleSidebarPin={toggleSidebarPin}
                setSelectedAgent={setSelectedAgent}
              />
            </div>
            
            {/* Resize handle */}
            <div
              className={`w-1 bg-gray-700 hover:bg-gray-600 cursor-col-resize flex items-center justify-center group transition-colors ${
                isResizing ? 'bg-blue-500' : ''
              }`}
              onMouseDown={handleMouseDown}
            >
              <div className="w-1 h-8 bg-gray-500 group-hover:bg-gray-300 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"></div>
            </div>
          </div>
        )}

        {/* Content container */}
        <div className={`flex-1 flex flex-col ${isFullscreen ? 'w-full' : ''}`}>
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Navigation with tabs and fullscreen toggle */}
            <TabsNavigation
              selectedTab={selectedTab}
              setSelectedTab={setSelectedTab}
              isFullscreen={isFullscreen}
              toggleFullscreen={toggleFullscreen}
              agentId={selectedAgentId}
              agentName={selectedAgent}
            />

            {/* Main content area */}
            <div className="flex-1 overflow-y-auto p-4">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout; 