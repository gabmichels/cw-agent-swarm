'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Plus, Users, Info } from 'lucide-react';
import ChatMessages from './ChatMessages';
import { Message } from '../types';
import { MessageType } from '../constants/message';
import useChatMemory from '../hooks/useChatMemory';
import { useWebSocket } from '../hooks/useWebSocket';
import { ServerEvent } from '../server/websocket/types';
import TabsNavigation from './TabsNavigation';
import VisualizationsContainer from './VisualizationsContainer';

// Extend the Message type to add the missing properties
interface ExtendedMessage extends Message {
  senderId: string;
  messageType?: MessageType;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  status: 'available' | 'busy' | 'offline' | 'maintenance';
  capabilities: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

interface MultiAgentChatInterfaceProps {
  chatId: string;
  userId: string;
  initialAgents?: Agent[];
}

export default function MultiAgentChatInterface({ 
  chatId, 
  userId,
  initialAgents = []
}: MultiAgentChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [availableAgents, setAvailableAgents] = useState<Agent[]>([]);
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [showAgentCapabilities, setShowAgentCapabilities] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>('chat');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // WebSocket connection for real-time updates
  const { 
    isConnected, 
    subscribeToChat, 
    unsubscribeFromChat, 
    subscribeToEvent 
  } = useWebSocket();
  
  // Use our chat memory hook for message history
  const {
    chatHistory: messages,
    isLoadingHistory,
    historyError,
    addChatMessage,
    loadChatHistory
  } = useChatMemory({
    userId,
    chatId,
    includeInternalMessages: true
  });
  
  // Cast messages to the extended type
  const extendedMessages = messages as unknown as ExtendedMessage[];
  
  // Load agents from API
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await fetch('/api/agents');
        if (response.ok) {
          const data = await response.json();
          setAgents(data);
          setAvailableAgents(data.filter((a: Agent) => a.status === 'available'));
        }
      } catch (error) {
        console.error('Error fetching agents:', error);
      }
    };
    
    if (initialAgents.length === 0) {
      fetchAgents();
    } else {
      setAgents(initialAgents);
      setAvailableAgents(initialAgents.filter((a) => a.status === 'available'));
    }
  }, [initialAgents]);
  
  // Subscribe to chat WebSocket events
  useEffect(() => {
    if (!isConnected || !chatId) return;
    
    // Subscribe to this chat
    subscribeToChat(chatId);
    
    // Listen for message created events
    const unsubscribeMessageCreated = subscribeToEvent(
      ServerEvent.MESSAGE_CREATED, 
      (payload) => {
        if (payload.chatId === chatId) {
          console.log('New message in chat:', payload);
          // Refresh chat history when a new message arrives
          loadChatHistory();
        }
      }
    );
    
    // Listen for participant joined events
    const unsubscribeParticipantJoined = subscribeToEvent(
      ServerEvent.PARTICIPANT_JOINED,
      (payload) => {
        if (payload.chatId === chatId) {
          console.log('Participant joined chat:', payload);
          // Refresh chat history when a participant joins
          loadChatHistory();
        }
      }
    );
    
    // Listen for agent status changes
    const unsubscribeAgentStatus = subscribeToEvent(
      ServerEvent.AGENT_STATUS_CHANGED,
      (payload) => {
        setAgents(prevAgents => {
          return prevAgents.map(agent => {
            if (agent.id === payload.agentId) {
              const updatedAgent = {
                ...agent,
                status: payload.agent.status
              };
              return updatedAgent;
            }
            return agent;
          });
        });
        
        // Update available agents list
        setAvailableAgents(prevAvailable => {
          const agentIndex = prevAvailable.findIndex(a => a.id === payload.agentId);
          const newStatus = payload.agent.status;
          
          // If agent is newly available, add to available list
          if (newStatus === 'available' && agentIndex === -1) {
            const agentToAdd = agents.find(a => a.id === payload.agentId);
            if (agentToAdd) {
              return [...prevAvailable, { ...agentToAdd, status: 'available' }];
            }
          }
          
          // If agent is no longer available, remove from available list
          if (newStatus !== 'available' && agentIndex !== -1) {
            return prevAvailable.filter(a => a.id !== payload.agentId);
          }
          
          return prevAvailable;
        });
      }
    );
    
    // Cleanup on unmount
    return () => {
      if (unsubscribeFromChat) unsubscribeFromChat(chatId);
      if (typeof unsubscribeMessageCreated === 'function') unsubscribeMessageCreated();
      if (typeof unsubscribeParticipantJoined === 'function') unsubscribeParticipantJoined();
      if (typeof unsubscribeAgentStatus === 'function') unsubscribeAgentStatus();
    };
  }, [isConnected, chatId, subscribeToChat, unsubscribeFromChat, subscribeToEvent, loadChatHistory, agents]);
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Handle sending a message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;
    
    setIsLoading(true);
    
    // Determine if message is directed to a specific agent
    const targetAgentId = selectedAgentId;
    const messageContent = input.trim();
    
    try {
      // Create the message
      const response = await fetch('/api/chats/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId,
          content: messageContent,
          senderId: userId,
          senderType: 'user',
          targetAgentId // Include target agent if specified
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }
      
      // Clear input after successful send
      setInput('');
      
      // Refresh chat history (should happen automatically via WebSocket)
      loadChatHistory();
    } catch (error) {
      console.error('Error sending message:', error);
      // Handle error - could show an error message to the user
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle adding an agent to the chat
  const handleAddAgent = async (agentId: string) => {
    try {
      const response = await fetch('/api/chats/participants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId,
          participantId: agentId,
          participantType: 'agent',
          role: 'member'
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to add agent: ${response.statusText}`);
      }
      
      // Close the agent selector
      setShowAgentSelector(false);
      
      // Agent will be added to the chat via WebSocket event
    } catch (error) {
      console.error('Error adding agent to chat:', error);
    }
  };
  
  // Handle selecting an agent to message directly
  const handleSelectAgent = (agentId: string) => {
    setSelectedAgentId(selectedAgentId === agentId ? null : agentId);
    setShowAgentSelector(false);
  };
  
  // Get current chat participants
  const participants = useMemo(() => {
    // Extract unique participant IDs from messages
    const participantIds = new Set<string>();
    
    extendedMessages.forEach(message => {
      if (message.senderId) {
        participantIds.add(message.senderId);
      }
    });
    
    // Map participant IDs to agent info if available
    return Array.from(participantIds).map(id => {
      const agent = agents.find(a => a.id === id);
      return {
        id,
        name: agent?.name || id,
        isAgent: !!agent,
        status: agent?.status || 'unknown'
      };
    });
  }, [extendedMessages, agents]);
  
  return (
    <div className="flex flex-col bg-gray-900 text-white rounded-lg shadow-lg h-[600px]">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-700">
        <div>
          <h2 className="text-xl font-semibold">Multi-Agent Chat</h2>
          <p className="text-sm text-gray-400">ID: {chatId}</p>
        </div>
        <div className="flex space-x-2">
          <button 
            className="flex items-center px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
            onClick={() => setShowAgentSelector(prev => !prev)}
          >
            <Plus size={16} className="mr-1" />
            Add Agent
          </button>
          <button className="flex items-center px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">
            <Users size={16} className="mr-1" />
            Participants ({participants.length})
          </button>
        </div>
      </div>
      
      {/* Add Tabs Navigation */}
      <TabsNavigation 
        selectedTab={selectedTab}
        setSelectedTab={setSelectedTab}
        isFullscreen={false}
        toggleFullscreen={() => {}}
        agentId={selectedAgentId || undefined}
        agentName={selectedAgentId ? (agents.find(a => a.id === selectedAgentId)?.name || 'Agent') : undefined}
        onViewAgent={selectedAgentId ? (agentId) => {
          console.log('Navigate to agent page:', `/agent/${agentId}`);
          window.location.href = `/agent/${agentId}`;
        } : undefined}
        onDeleteChatHistory={async () => {
          const confirmed = window.confirm('Are you sure you want to delete the chat history? This action cannot be undone.');
          if (!confirmed) return false;
          
          try {
            const response = await fetch(`/api/chats/${chatId}`, {
              method: 'DELETE',
            });
            
            if (response.ok) {
              // Clear local messages
              loadChatHistory();
              return true;
            }
            return false;
          } catch (error) {
            console.error('Error deleting chat history:', error);
            return false;
          }
        }}
      />
      
      {/* Agent Selector Dropdown */}
      {showAgentSelector && (
        <div className="absolute right-4 top-24 w-64 bg-gray-800 rounded-lg shadow-lg z-10 border border-gray-700 overflow-hidden">
          <div className="p-2 border-b border-gray-700 bg-gray-700">
            <h3 className="font-medium">Available Agents</h3>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {availableAgents.length === 0 ? (
              <div className="p-3 text-gray-400 text-center">No available agents</div>
            ) : (
              availableAgents.map(agent => (
                <div 
                  key={agent.id} 
                  className="p-2 hover:bg-gray-700 cursor-pointer flex justify-between items-center"
                  onClick={() => handleAddAgent(agent.id)}
                >
                  <div>
                    <div className="font-medium">{agent.name}</div>
                    <div className="text-xs text-gray-400 truncate" style={{ maxWidth: '180px' }}>
                      {agent.capabilities.length} capabilities
                    </div>
                  </div>
                  <button 
                    className="text-gray-400 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAgentCapabilities(agent.id === showAgentCapabilities ? null : agent.id);
                    }}
                  >
                    <Info size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      
      {/* Agent Capabilities Popup */}
      {showAgentCapabilities && (
        <div className="absolute right-72 top-24 w-72 bg-gray-800 rounded-lg shadow-lg z-10 border border-gray-700 overflow-hidden">
          <div className="p-2 border-b border-gray-700 bg-gray-700">
            <h3 className="font-medium">
              {availableAgents.find(a => a.id === showAgentCapabilities)?.name} Capabilities
            </h3>
          </div>
          <div className="max-h-64 overflow-y-auto p-2">
            {availableAgents.find(a => a.id === showAgentCapabilities)?.capabilities.map(cap => (
              <div key={cap.id} className="mb-2 p-2 bg-gray-750 rounded">
                <div className="font-medium">{cap.name}</div>
                <div className="text-xs text-gray-400">{cap.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Chat Participants */}
      <div className="flex overflow-x-auto px-4 py-2 space-x-2 bg-gray-800">
        {participants.map(participant => (
          <div 
            key={participant.id}
            className={`px-3 py-1 rounded-full text-sm cursor-pointer flex items-center
              ${selectedAgentId === participant.id ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}
              ${participant.isAgent ? '' : 'border border-gray-600'}
            `}
            onClick={() => participant.isAgent && handleSelectAgent(participant.id)}
          >
            {participant.name}
            {participant.isAgent && (
              <span 
                className={`ml-2 w-2 h-2 rounded-full 
                  ${participant.status === 'available' ? 'bg-green-500' : 
                    participant.status === 'busy' ? 'bg-yellow-500' : 
                    participant.status === 'offline' ? 'bg-gray-500' : 'bg-red-500'
                  }
                `}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}