import React, { ReactNode, useState } from 'react';
import Header from '../Header';
import Sidebar from '../Sidebar';
import TabsNavigation from '../TabsNavigation';

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
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
  };

  const handleAgentChange = (agent: string) => {
    setSelectedAgent(agent);
    setIsAgentDropdownOpen(false);
  };

  // Mock data for departments and agents
  const departments = ['Marketing', 'HR', 'Finance'];
  const agentsByDepartment = {
    Marketing: ['Chloe'],
    HR: ['Emma (Coming Soon)'],
    Finance: ['Alex (Coming Soon)']
  };

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
          agentsByDepartment={agentsByDepartment}
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