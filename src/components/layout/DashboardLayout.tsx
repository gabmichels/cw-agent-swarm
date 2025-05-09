import React, { ReactNode, useState, useCallback, useEffect } from 'react';
import Header from '../Header';
import Sidebar from '../Sidebar';
import TabsNavigation from '../TabsNavigation';
import { AgentService } from '../../services/AgentService';
import { useRouter } from 'next/router';

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const router = useRouter();
  
  // State for available agents
  const [availableAgents, setAvailableAgents] = useState<Record<string, string[]>>({
    Marketing: ['Chloe'],
    HR: [],
    Finance: []
  });
  
  // State for the layout components
  const [selectedDepartment, setSelectedDepartment] = useState('Marketing');
  const [selectedAgent, setSelectedAgent] = useState('Chloe');
  const [selectedTab, setSelectedTab] = useState('knowledge');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);
  
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
        
        // For now, place all agents in Marketing dept - in real app would check capabilities
        for (const id of agentIds) {
          const agent = await AgentService.getAgent(id);
          if (agent) {
            // Determine department based on agent capabilities or metadata
            const dept = agent.department || 'Marketing';
            // Use agent name or ID as display name
            const name = agent.name || id;
            // Add to department list
            if (agentsByDept[dept]) {
              agentsByDept[dept].push(name);
            } else {
              agentsByDept[dept] = [name];
            }
          }
        }
        
        setAvailableAgents(agentsByDept);
        
        // If no agent is selected but we have agents, select the first one
        if (!selectedAgent && Object.values(agentsByDept).some(arr => arr.length > 0)) {
          const firstDept = Object.keys(agentsByDept).find(dept => agentsByDept[dept].length > 0);
          if (firstDept) {
            setSelectedDepartment(firstDept);
            setSelectedAgent(agentsByDept[firstDept][0]);
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
      setSelectedAgent(availableAgents[dept][0]);
    } else {
      setSelectedAgent('');
    }
  };

  const handleAgentChange = (agent: string) => {
    setSelectedAgent(agent);
    setIsAgentDropdownOpen(false);
  };
  
  // Handle agent deletion
  const handleDeleteAgent = useCallback(async () => {
    try {
      // Convert agent display name to ID (lowercase)
      const agentId = selectedAgent.toLowerCase();
      
      // Call agent service to delete the agent
      await AgentService.deleteAgent(agentId);
      
      // Update available agents list
      setAvailableAgents(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(dept => {
          updated[dept] = updated[dept].filter(name => name.toLowerCase() !== agentId);
        });
        return updated;
      });
      
      // Select a new agent if available, or navigate to home
      const hasRemainingAgents = Object.values(availableAgents).some(agents => agents.length > 0);
      if (hasRemainingAgents) {
        const firstDept = Object.keys(availableAgents).find(dept => availableAgents[dept].length > 0);
        if (firstDept) {
          setSelectedDepartment(firstDept);
          setSelectedAgent(availableAgents[firstDept][0]);
        }
      } else {
        // Navigate to the home page or agent selection page if no agents left
        router.push('/');
      }
      
      // Show success notification (you can implement this)
      console.log(`Agent ${selectedAgent} deleted successfully`);
    } catch (error) {
      // Handle errors
      console.error(`Failed to delete agent: ${error}`);
      // Show error notification (you can implement this)
    }
  }, [selectedAgent, router, availableAgents]);

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
        />
      )}

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - conditionally show based on state */}
        <div 
          className={`bg-gray-800 border-r border-gray-700 flex flex-col transition-all duration-300 
            ${isSidebarOpen ? 'w-64' : 'w-0'} 
            ${isFullscreen ? 'hidden' : 'block'}`}
        >
          {isSidebarOpen && (
            <Sidebar
              isSidebarOpen={isSidebarOpen}
              isSidebarPinned={isSidebarPinned}
              selectedAgent={selectedAgent}
              toggleSidebarPin={toggleSidebarPin}
              setSelectedAgent={setSelectedAgent}
            />
          )}
        </div>

        {/* Content container */}
        <div className={`flex-1 flex flex-col ${isFullscreen ? 'w-full' : ''}`}>
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Navigation with tabs and fullscreen toggle */}
            <TabsNavigation
              selectedTab={selectedTab}
              setSelectedTab={setSelectedTab}
              isFullscreen={isFullscreen}
              toggleFullscreen={toggleFullscreen}
              agentName={selectedAgent}
              onDeleteAgent={handleDeleteAgent}
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