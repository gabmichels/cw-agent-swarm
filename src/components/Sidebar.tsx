import { AgentProfile } from '@/lib/multi-agent/types/agent';
import { getCurrentUser } from '@/lib/user';
import { ActivityIcon, Loader, PinIcon, Users, Circle, Clock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

// Helper function to construct proper API URLs
function getApiUrl(path: string): string {
  // Determine if we're running in a browser
  const isBrowser = typeof window !== 'undefined';
  
  // Get the base URL from the browser if available, otherwise use a default
  const baseUrl = isBrowser 
    ? `${window.location.protocol}//${window.location.host}`
    : 'http://localhost:3000'; // Default for server-side

  // Ensure path starts with a slash
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  return `${baseUrl}${normalizedPath}`;
}

interface ServiceStatus {
  name: string;
  port: number;
  status: 'online' | 'offline' | 'checking';
  lastChecked?: Date;
}

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
  const router = useRouter();
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Service status state
  const [serviceStatuses, setServiceStatuses] = useState<ServiceStatus[]>([
    { name: 'Qdrant', port: 6333, status: 'checking' },
    { name: 'Prisma Studio', port: 5555, status: 'checking' },
    { name: 'FastServer', port: 8000, status: 'checking' }
  ]);
  
  // Check service status
  const checkServiceStatus = async (service: ServiceStatus): Promise<'online' | 'offline'> => {
    try {
      // Use a timeout to avoid hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      let checkUrl: string;
      let fetchOptions: RequestInit;
      
      // Different endpoints and strategies for different services
      switch (service.name) {
        case 'Qdrant':
          checkUrl = `http://localhost:${service.port}/`;
          fetchOptions = {
            method: 'GET',
            signal: controller.signal,
            mode: 'cors'
          };
          break;
        case 'Prisma Studio':
          // Prisma Studio blocks CORS, so we'll use a different strategy
          // Try to check via our own API endpoint that can make the request server-side
          checkUrl = getApiUrl(`/api/debug/service-status?service=prisma&port=${service.port}`);
          fetchOptions = {
            method: 'GET',
            signal: controller.signal
          };
          break;
        case 'FastServer':
          checkUrl = `http://localhost:${service.port}/health`;
          fetchOptions = {
            method: 'GET',
            signal: controller.signal,
            mode: 'cors'
          };
          break;
        default:
          checkUrl = `http://localhost:${service.port}/`;
          fetchOptions = {
            method: 'GET',
            signal: controller.signal,
            mode: 'cors'
          };
      }
      
      const response = await fetch(checkUrl, fetchOptions);
      
      clearTimeout(timeoutId);
      
      // For most services, any response (even error) means the service is running
      // For our API endpoint, check the JSON response
      if (service.name === 'Prisma Studio') {
        const data = await response.json();
        return data.online ? 'online' : 'offline';
      }
      
      // For direct service checks, any response means it's online
      return 'online';
    } catch (error) {
      // Network error, timeout, or CORS error typically means service is down
      return 'offline';
    }
  };
  
  // Check all services
  const checkAllServices = async () => {
    const updatedStatuses = await Promise.all(
      serviceStatuses.map(async (service) => {
        const status = await checkServiceStatus(service);
        return {
          ...service,
          status,
          lastChecked: new Date()
        };
      })
    );
    
    setServiceStatuses(updatedStatuses);
  };
  
  // Set up periodic checking (every 2 minutes)
  useEffect(() => {
    // Initial check
    checkAllServices();
    
    // Set up interval for periodic checks
    const interval = setInterval(checkAllServices, 2 * 60 * 1000); // 2 minutes
    
    return () => clearInterval(interval);
  }, []);
  
  // Get status color and icon
  const getStatusIndicator = (status: 'online' | 'offline' | 'checking') => {
    switch (status) {
      case 'online':
        return <Circle className="h-3 w-3 fill-green-500 text-green-500" />;
      case 'offline':
        return <Circle className="h-3 w-3 fill-red-500 text-red-500" />;
      case 'checking':
        return <Circle className="h-3 w-3 fill-yellow-500 text-yellow-500 animate-pulse" />;
    }
  };

  // Fetch agents from API
  useEffect(() => {
    const fetchAgents = async () => {
      setIsLoadingAgents(true);
      
      try {
        const response = await fetch(getApiUrl('/api/multi-agent/agents?limit=50')); // Increase limit for better sorting
        
        if (!response.ok) {
          // Only show error for actual server errors (5xx)
          if (response.status >= 500) {
            const errorText = await response.text();
            console.error(`Failed to fetch agents: ${response.status} ${response.statusText}`, errorText);
            setError(`Server error (${response.status})`);
          } else if (response.status === 404) {
            // 404 means the endpoint doesn't exist yet - this is a legitimate case during setup
            console.log('Agents API endpoint not found, likely still being set up');
            setAgents([]);
          } else {
            // Other client errors, log but don't show prominently
            console.warn(`Agents API returned ${response.status}: ${response.statusText}`);
            setAgents([]);
          }
        } else {
          // Parse the successful response
          const data = await response.json();
          
          if (data.success === false) {
            // API returned success: false but with a 200 status
            console.warn('API returned success: false', data.error);
            setAgents([]);
          } else {
            // Normal successful case - agents are already sorted by the API
            const agentsData = data.agents || [];
            // Convert lastActivity strings to Date objects for proper formatting
            const processedAgents = agentsData.map((agent: any) => ({
              ...agent,
              lastActivity: agent.lastActivity ? new Date(agent.lastActivity) : undefined,
              createdAt: new Date(agent.createdAt),
              updatedAt: new Date(agent.updatedAt)
            }));
            setAgents(processedAgents);
            setError(null); // Clear any previous errors
          }
        }
      } catch (err) {
        // Handle network/parsing errors differently from empty results
        console.error('Error fetching agents:', err);
        
        // Suppress error UI since "No agents found" is sufficient
        // Just log the error for debugging purposes
        setAgents([]);
      } finally {
        setIsLoadingAgents(false);
      }
    };
    
    fetchAgents();
  }, []);

  if (!isSidebarOpen) return null;

  // Format last activity time
  const formatLastActivity = (lastActivity?: Date) => {
    if (!lastActivity) return null;
    
    const now = new Date();
    const diffMs = now.getTime() - lastActivity.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return lastActivity.toLocaleDateString();
  };
  
  // Handle agent selection in the main interface
  const handleAgentClick = async (agentId: string) => {
    try {
      // First, find or create a chat between the current user and the selected agent
      const currentUser = getCurrentUser(); // You'll need to import this or get user ID another way
      const userId = currentUser.id;
      
      // Try to find existing chat between user and agent
      let chatResponse = await fetch(getApiUrl(`/api/multi-agent/chats?userId=${userId}&agentId=${agentId}`));
      let chatData = await chatResponse.json();
      
      let chatId: string;
      
      if (chatResponse.ok && chatData.success && chatData.chats && chatData.chats.length > 0) {
        // Use existing chat
        chatId = chatData.chats[0].id;
      } else {
        // Create new chat between user and agent
        // First get agent profile for chat naming
        const agentResponse = await fetch(getApiUrl(`/api/multi-agent/agents/${agentId}`));
        const agentJson = await agentResponse.json();
        
        let agentName = agentId;
        if (agentResponse.ok && agentJson.success && agentJson.agent) {
          agentName = agentJson.agent.name || agentId;
        }
        
        const createChatResponse = await fetch(getApiUrl('/api/multi-agent/chats'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: `Chat with ${agentName}`,
            description: `Direct chat with ${agentName}`,
            settings: {
              visibility: 'private',
              allowAnonymousMessages: false,
              enableBranching: false,
              recordTranscript: true
            },
            metadata: {
              userInitiated: true,
              userId: userId,
              agentId: agentId,
              agentName: agentName
            }
          })
        });
        
        const createChatData = await createChatResponse.json();
        
        if (!createChatResponse.ok || !createChatData.success || !createChatData.chat) {
          console.error('Failed to create chat:', createChatData.error);
          return; // Exit if chat creation failed
        }
        
        chatId = createChatData.chat.id;
      }
      
      // Set the selected agent in the main interface  
      setSelectedAgent(agentId);
      
      // Navigate to the chat page using the chatId
      router.push(`/chat/${chatId}`);
    } catch (error) {
      console.error('Error handling agent click:', error);
    }
  };

  return (
    <>
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.3);
          border-radius: 3px;
          transition: background 0.2s ease;
        }
        
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.6);
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.8);
        }
        
        /* Firefox */
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(156, 163, 175, 0.3) transparent;
        }
      `}</style>
      
      <div className="flex flex-col h-full bg-gray-900 text-white">
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
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {/* Agents Section */}
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-gray-400">AGENTS</h3>
            <Link 
              href="/agents" 
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              View All
            </Link>
          </div>
          
          {error && (
            <div className="text-red-500 text-sm mb-2">
              {error}
            </div>
          )}
          
          {/* Fixed height container for agents with scrolling */}
          <div className="mb-6">
            <div className="max-h-80 overflow-y-auto custom-scrollbar">
              {isLoadingAgents ? (
                <div className="flex items-center space-x-2 p-3 text-gray-400">
                  <Loader className="h-4 w-4 animate-spin" />
                  <span>Loading agents...</span>
                </div>
              ) : agents.length === 0 ? (
                <div className="text-gray-400 text-sm p-3">
                  No agents found. <Link href="/agents/register" className="text-blue-400 hover:text-blue-300">Register one</Link>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {agents.map((agent) => (
                    <div key={agent.id}>
                      <button
                        onClick={() => handleAgentClick(agent.id)}
                        className={`w-full text-left block p-2 rounded transition-colors ${
                          selectedAgent === agent.id ? 'bg-blue-600' : 'hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium truncate">{agent.name}</span>
                        </div>
                        {agent.lastActivity && (
                          <div className="flex items-center space-x-1 text-xs text-gray-400">
                            <Clock className="h-3 w-3" />
                            <span>{formatLastActivity(agent.lastActivity)}</span>
                          </div>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Knowledge Section */}
          <div className="flex justify-between items-center mb-2 mt-6">
            <h3 className="text-sm font-semibold text-gray-400">KNOWLEDGE</h3>
          </div>
          
          <ul className="space-y-1 mb-4">
            <li>
              <Link
                href="/knowledge-graph"
                className="w-full text-left flex items-center space-x-2 p-2 rounded transition-colors text-gray-300 hover:bg-gray-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14-7l2 2-2 2M5 13l-2-2 2-2m8-6v16" />
                </svg>
                <span>Knowledge Graph</span>
              </Link>
            </li>
            <li>
              <Link
                href="/knowledge-gaps"
                className="w-full text-left flex items-center space-x-2 p-2 rounded transition-colors text-gray-300 hover:bg-gray-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span>Knowledge Gaps</span>
              </Link>
            </li>
            <li>
              <Link
                href="/memory-debug"
                className="w-full text-left flex items-center space-x-2 p-2 rounded transition-colors text-gray-300 hover:bg-gray-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Memory Debug</span>
              </Link>
            </li>
          </ul>
          
          {/* Visualizations Section */}
          <div className="flex justify-between items-center mb-2 mt-6">
            <h3 className="text-sm font-semibold text-gray-400">VISUALIZATIONS</h3>
          </div>
          
          <ul className="space-y-1 mb-4">
            <li>
              <Link
                href="/visualizations"
                className="w-full text-left flex items-center space-x-2 p-2 rounded transition-colors text-gray-300 hover:bg-gray-700"
              >
                <ActivityIcon className="h-4 w-4" />
                <span>Thinking Process</span>
              </Link>
            </li>
          </ul>
          
          {/* Developer Section */}
          <h3 className="text-sm font-semibold mb-2 text-gray-400">DEVELOPER</h3>
          <ul className="space-y-1 mb-4">
            <li>
              <Link 
                href="/debug/graph" 
                className="w-full text-left flex items-center p-2 rounded hover:bg-gray-700"
              >
                <ActivityIcon className="h-4 w-4 mr-2" />
                <span>Execution Graph</span>
              </Link>
            </li>
            <li>
              <Link 
                href="/error-dashboard" 
                className="w-full text-left flex items-center p-2 rounded hover:bg-gray-700"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span>Error Dashboard</span>
              </Link>
            </li>
            <li>
              <Link 
                href="/agents/register" 
                className="w-full text-left flex items-center p-2 rounded hover:bg-gray-700"
              >
                <Users className="h-4 w-4 mr-2" />
                <span>Register Agent</span>
              </Link>
            </li>
          </ul>
          
          {/* Service Status Section */}
          <div className="border-t border-gray-700 pt-4 mt-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-gray-400">SERVICE STATUS</h3>
              <button
                onClick={checkAllServices}
                className="text-xs text-blue-400 hover:text-blue-300"
                title="Refresh status"
              >
                Refresh
              </button>
            </div>
            
            <div className="space-y-1">
              {serviceStatuses.map((service) => (
                <div
                  key={service.name}
                  className="flex items-center justify-between text-xs text-gray-300 py-1"
                >
                  <div className="flex items-center space-x-2">
                    {getStatusIndicator(service.status)}
                    <span>{service.name}</span>
                    <span className="text-gray-500">:{service.port}</span>
                  </div>
                  <span className="text-gray-500">
                    {service.status === 'checking' ? 'Checking...' : service.status}
                  </span>
                </div>
              ))}
            </div>
            
            {serviceStatuses.some(s => s.lastChecked) && (
              <div className="text-xs text-gray-500 mt-2">
                Last checked: {serviceStatuses.find(s => s.lastChecked)?.lastChecked?.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar; 