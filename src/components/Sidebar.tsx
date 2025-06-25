import { AgentProfile } from '@/lib/multi-agent/types/agent';
import { ChatProfile } from '@/lib/multi-agent/types/chat';
import { getCurrentUser } from '@/lib/user';
import { ActivityIcon, Loader, MessageSquare, PinIcon, Users } from 'lucide-react';
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
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [chats, setChats] = useState<ChatProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch agents from API
  useEffect(() => {
    const fetchAgents = async () => {
      setIsLoadingAgents(true);
      
      try {
        const response = await fetch(getApiUrl('/api/multi-agent/agents'));
        
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
            // Normal successful case - might still be empty array
            setAgents(data.agents || []);
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
  
  // Fetch chats from API
  useEffect(() => {
    const fetchChats = async () => {
      setIsLoadingChats(true);
      
      try {
        const response = await fetch(getApiUrl('/api/multi-agent/chats'));
        
        if (!response.ok) {
          throw new Error(`Failed to fetch chats: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.chats) {
          setChats(data.chats);
        } else {
          throw new Error('Failed to load chats');
        }
      } catch (err) {
        console.error('Error fetching chats:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoadingChats(false);
      }
    };
    
    fetchChats();
  }, []);

  if (!isSidebarOpen) return null;

  // Helper function to get agent status color
  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      available: 'bg-green-800 text-green-100',
      unavailable: 'bg-red-800 text-red-100',
      maintenance: 'bg-yellow-800 text-yellow-100'
    };
    
    return statusColors[status] || 'bg-gray-800 text-gray-100';
  };
  
  // Navigate to chat
  const handleChatClick = (chatId: string) => {
    router.push(`/chat/${chatId}`);
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
        
        <ul className="space-y-1 mb-4">
          {isLoadingAgents ? (
            <li className="flex items-center space-x-2 p-2 text-gray-400">
              <Loader className="h-4 w-4 animate-spin" />
              <span>Loading agents...</span>
            </li>
          ) : agents.length === 0 ? (
            <li className="text-gray-400 text-sm p-2">
              No agents found. <Link href="/agents/register" className="text-blue-400 hover:text-blue-300">Register one</Link>
            </li>
          ) : (
            agents.map((agent) => (
              <li key={agent.id}>
                <button
                  onClick={() => handleAgentClick(agent.id)}
                  className={`w-full text-left block p-2 rounded ${
                    selectedAgent === agent.id ? 'bg-blue-600' : 'hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{agent.name}</span>
                    <span className={`px-2 py-0.5 text-xs leading-5 font-semibold rounded-full ${getStatusColor(agent.status)}`}>
                      {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                    </span>
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
        
        {/* Chats Section */}
        <div className="flex justify-between items-center mb-2 mt-6">
          <h3 className="text-sm font-semibold text-gray-400">CHATS</h3>
          <Link 
            href="/chats" 
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            View All
          </Link>
        </div>
        
        <ul className="space-y-1 mb-4">
          {isLoadingChats ? (
            <li className="flex items-center space-x-2 p-2 text-gray-400">
              <Loader className="h-4 w-4 animate-spin" />
              <span>Loading chats...</span>
            </li>
          ) : chats.length === 0 ? (
            <li className="text-gray-400 text-sm p-2">
              No chats found.
            </li>
          ) : (
            chats.map((chat) => (
              <li key={chat.id}>
                <button
                  onClick={() => handleChatClick(chat.id)}
                  className={`w-full text-left flex items-center space-x-2 p-2 rounded transition-colors ${
                    chat.id === selectedAgent
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>{chat.name || `Chat ${chat.id.slice(0, 6)}`}</span>
                </button>
              </li>
            ))
          )}
        </ul>
        
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
      </div>
    </>
  );
};

export default Sidebar; 