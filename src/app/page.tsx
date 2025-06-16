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
  const [socialMediaMessage, setSocialMediaMessage] = useState<{type: 'success' | 'error', message: string, platform?: string} | null>(null);
  
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

  // Check for social media callback parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const socialSuccess = urlParams.get('social_success');
    const socialError = urlParams.get('social_error');
    const platform = urlParams.get('platform');
    const account = urlParams.get('account');

    if (socialSuccess === 'true' && platform) {
      setSocialMediaMessage({
        type: 'success',
        message: `Successfully connected ${platform}${account ? ` account: ${account}` : ''}!`,
        platform
      });
      
      // Dispatch custom event to notify modal to refresh connections
      window.dispatchEvent(new CustomEvent('socialMediaOAuthSuccess', {
        detail: { platform, account }
      }));
      
      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (socialError && platform) {
      setSocialMediaMessage({
        type: 'error',
        message: `Failed to connect ${platform}: ${socialError}`,
        platform
      });
      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
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
      {/* Social Media Notification */}
      {socialMediaMessage && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-md ${
          socialMediaMessage.type === 'success' 
            ? 'bg-green-600 border border-green-500' 
            : 'bg-red-600 border border-red-500'
        }`}>
          <div className="flex justify-between items-start">
            <div className="flex items-center">
              {socialMediaMessage.type === 'success' ? (
                <svg className="w-5 h-5 mr-2 text-green-200" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 mr-2 text-red-200" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              <span className="text-white font-medium">{socialMediaMessage.message}</span>
            </div>
            <button
              onClick={() => setSocialMediaMessage(null)}
              className="ml-4 text-white hover:text-gray-200"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

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
          userId="test-user"
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
