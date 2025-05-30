'use client';

import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Link from 'next/link';

export default function Home() {
  const [selectedDepartment, setSelectedDepartment] = useState('Marketing');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  
  // Toggle functions for UI features
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  
  // Toggle sidebar pin state
  const toggleSidebarPin = () => setIsSidebarPinned(!isSidebarPinned);
  
  // Toggle department dropdown
  const toggleDeptDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeptDropdownOpen(!isDeptDropdownOpen);
    setIsAgentDropdownOpen(false);
  };
  
  // Toggle agent dropdown
  const toggleAgentDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAgentDropdownOpen(!isAgentDropdownOpen);
    setIsDeptDropdownOpen(false);
  };
  
  // Close all dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setIsDeptDropdownOpen(false);
      setIsAgentDropdownOpen(false);
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);
  
  // Available departments
  const departments = ['Marketing', 'HR', 'Finance', 'Sales'];
  
  // Available agents per department
  const agentsByDepartment = {
    Marketing: [],
    HR: ['Emma (Soon)'],
    Finance: ['Alex (Soon)'],
    Sales: ['Sam (Soon)']
  };
  
  // Handle department change
  const handleDepartmentChange = (dept: string) => {
    setSelectedDepartment(dept);
    setIsDeptDropdownOpen(false);
    
    // Select first agent from new department
    const availableAgents = agentsByDepartment[dept as keyof typeof agentsByDepartment] || [];
    if (availableAgents.length > 0 && !availableAgents[0].includes('Soon')) {
      setSelectedAgent(availableAgents[0]);
    }
  };
  
  // Handle agent change
  const handleAgentChange = (agent: string) => {
    if (!agent.includes('Soon')) {
      setSelectedAgent(agent);
    }
    setIsAgentDropdownOpen(false);
  };

  // Welcome screen component
  const WelcomeScreen = () => {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 px-4 text-center">
        <img 
          src="/assets/images/cw_fulltext.svg" 
          alt="Crowd Wisdom" 
          className="h-16 mb-8" 
        />
        <h1 className="text-3xl font-bold mb-4">Welcome to Crowd Wisdom</h1>
        <p className="text-xl text-gray-400 mb-8 max-w-2xl">
          Your platform for intelligent agent-based collaboration. Get started by creating your first agent or using one of our pre-built agents.
        </p>
        <div className="flex space-x-4">
          <Link href="/agents">
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition duration-200 flex items-center">
              <span className="mr-2">Create Agent</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </Link>
          <Link href="/multi-agent-chat">
            <button className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition duration-200 flex items-center">
              <span className="mr-2">Multi-Agent Interface</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
            </button>
          </Link>
        </div>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl">
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-500 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <h3 className="text-lg font-semibold mb-2">Get Started</h3>
            <p className="text-gray-400">Learn the basics with our interactive tutorials and comprehensive documentation.</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-500 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <h3 className="text-lg font-semibold mb-2">Explore Templates</h3>
            <p className="text-gray-400">Browse our library of pre-built agent templates for various use cases and industries.</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-purple-500 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
            <h3 className="text-lg font-semibold mb-2">Developer Resources</h3>
            <p className="text-gray-400">Access APIs, SDKs, and developer tools to integrate and extend agent capabilities.</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
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

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className={`bg-gray-800 border-r border-gray-700 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-0'}`}>
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

        {/* Main content */}
          <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden flex items-center justify-center">
                      <WelcomeScreen />
                          </div>
                  </div>
                </div>
    </div>
  );
} 
