'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AgentService } from '@/services/AgentService';
import { Plus, Info, Settings, RefreshCw, Network, FileText, Clock, Trash2, CheckSquare, Square } from 'lucide-react';
import AgentRelationshipVisualizer from '@/components/agent/AgentRelationshipVisualizer';
import { AgentType } from '@/constants/agent';

const AGENT_DRAFT_STORAGE_KEY = 'agent_registration_form_data';

interface Agent {
  id: string;
  name: string;
  description: string;
  status: string;
  capabilities: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  createdAt: Date;
  chatId?: string;
  metadata?: {
    chatId?: string;
  };
}

interface AgentDraft {
  formData: {
    name: string;
    description: string;
  };
  currentStep: number;
  lastSaved: string;
}

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showCapabilities, setShowCapabilities] = useState<string | null>(null);
  const [showRelationships, setShowRelationships] = useState<boolean>(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [draftData, setDraftData] = useState<AgentDraft | null>(null);
  
  // Batch deletion state
  const [batchMode, setBatchMode] = useState<boolean>(false);
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Check for draft data in localStorage
  const checkForDraft = () => {
    try {
      const savedData = localStorage.getItem(AGENT_DRAFT_STORAGE_KEY);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        if (parsedData.formData && parsedData.formData.name) {
          setDraftData({
            formData: parsedData.formData,
            currentStep: parsedData.currentStep || 0,
            lastSaved: new Date().toISOString() // We'll use current time as approximation
          });
        }
      }
    } catch (error) {
      console.error('Error checking for draft data:', error);
    }
  };

  const loadAgents = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const allAgents = await AgentService.getAllAgents();
      setAgents(allAgents);
    } catch (err) {
      setError('Failed to load agents. Please try again.');
      console.error('Error loading agents:', err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadAgents();
    checkForDraft();

    // Check for draft when user focuses the window/tab
    const handleWindowFocus = () => {
      checkForDraft();
    };

    window.addEventListener('focus', handleWindowFocus);
    
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);
  
  const handleCreateAgent = () => {
    router.push('/agents/create');
  };

  const handleContinueDraft = () => {
    router.push('/agents/create');
  };

  const handleDiscardDraft = () => {
    if (confirm('Are you sure you want to discard your draft? This action cannot be undone.')) {
      localStorage.removeItem(AGENT_DRAFT_STORAGE_KEY);
      setDraftData(null);
    }
  };

  // Batch selection handlers
  const toggleBatchMode = () => {
    setBatchMode(!batchMode);
    setSelectedAgents(new Set()); // Clear selection when toggling mode
  };

  const toggleAgentSelection = (agentId: string) => {
    console.log('Toggling selection for agent:', agentId);
    const agent = agents.find(a => a.id === agentId);
    console.log('Agent found:', agent?.name, agent?.id);
    
    setSelectedAgents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(agentId)) {
        newSet.delete(agentId);
        console.log('Deselected agent:', agentId);
      } else {
        newSet.add(agentId);
        console.log('Selected agent:', agentId);
      }
      console.log('Total selected:', newSet.size);
      return newSet;
    });
  };

  const selectAllAgents = () => {
    if (selectedAgents.size === agents.length) {
      setSelectedAgents(new Set()); // Deselect all
    } else {
      setSelectedAgents(new Set(agents.map(agent => agent.id))); // Select all
    }
  };

  const handleBatchDelete = async () => {
    if (selectedAgents.size === 0) return;
    
    setDeleting(true);
    
    try {
      const deletePromises = Array.from(selectedAgents).map(async (agentId) => {
        const response = await fetch(`/api/multi-agent/system/agents/${agentId}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Failed to delete agent ${agentId}: ${errorData.error || 'Unknown error'}`);
        }
        
        return agentId;
      });

      const deletedAgentIds = await Promise.all(deletePromises);
      
      // Update local state to remove deleted agents
      setAgents(prev => prev.filter(agent => !deletedAgentIds.includes(agent.id)));
      
      // Clear selection and close modal
      setSelectedAgents(new Set());
      setBatchMode(false);
      setShowDeleteConfirm(false);
      
      console.log(`Successfully deleted ${deletedAgentIds.length} agents`);
      
    } catch (error) {
      console.error('Error during batch deletion:', error);
      alert(`Error deleting agents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleGoToChat = async (agentId: string) => {
    try {
      const agent = agents.find(a => a.id === agentId);
      if (!agent) return;

      // Check if agent has an existing chatId in metadata
      const existingChatId = agent.metadata?.chatId || agent.chatId;
      
      if (existingChatId) {
        // Navigate directly to existing chat
        router.push(`/chat/${existingChatId}`);
        return;
      }

      // If no chatId, try to find existing chat first (fallback)
      const chatsResponse = await fetch(`/api/multi-agent/chats?userId=user_gab`);
      if (chatsResponse.ok) {
        const chatsData = await chatsResponse.json();
        const chats = chatsData.chats || [];
        
        const existingChat = chats.find((chat: any) => {
          return chat.participants?.some((p: any) => 
            p.participantId === agentId && p.participantType === 'agent'
          );
        });
        
        if (existingChat) {
          router.push(`/chat/${existingChat.id}`);
          return;
        }
      }

      // If no existing chat found, create a new one
      const chatData = {
        name: `Chat with ${agent.name}`,
        description: `Discussion with ${agent.name} - ${agent.description.substring(0, 100)}${agent.description.length > 100 ? '...' : ''}`,
        settings: {
          visibility: 'private',
          allowAnonymousMessages: false,
          enableBranching: false,
          recordTranscript: true
        },
        metadata: {
          tags: [],
          category: ['one-on-one'],
          priority: 'medium',
          sensitivity: 'internal',
          language: ['en'],
          version: '1.0'
        }
      };

      const chatResponse = await fetch('/api/multi-agent/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chatData),
      });

      if (!chatResponse.ok) {
        throw new Error('Failed to create chat');
      }

      const chatResult = await chatResponse.json();
      const chatId = chatResult.chat.id;

      // Add participants to the chat
      const participantsResponse = await fetch(`/api/multi-agent/chats/${chatId}/participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participants: [
            {
              participantId: 'user_gab', // TODO: Get from auth context
              participantType: 'user',
              role: 'member'
            },
            {
              participantId: agentId,
              participantType: 'agent',
              role: 'member'
            }
          ]
        }),
      });

      if (!participantsResponse.ok) {
        throw new Error('Failed to add participants to chat');
      }

      // Navigate to the new chat
      router.push(`/chat/${chatId}`);
    } catch (error) {
      console.error('Error with chat:', error);
      alert('Failed to access chat. Please try again.');
    }
  };

  const getStepName = (stepNumber: number) => {
    const stepNames = [
      'Template Selection',
      'Basic Information',
      'Persona Setup',
      'Knowledge Upload',
      'Capabilities',
      'Workspace Permissions',
      'Social Media Permissions',
      'Manager Configuration'
    ];
    return stepNames[stepNumber] || 'Unknown Step';
  };
  
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'available':
        return 'bg-green-500';
      case 'busy':
        return 'bg-yellow-500';
      case 'maintenance':
        return 'bg-blue-500';
      case 'offline':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };
      
  // Format agents for the relationship visualizer
  const formatAgentsForVisualizer = () => {
    return agents.map(agent => ({
      id: agent.id,
      name: agent.name,
      type: agent.capabilities.some(cap => cap.name.toLowerCase().includes('marketing')) 
        ? AgentType.SPECIALIST 
        : AgentType.ASSISTANT,
      capabilities: agent.capabilities.map(cap => cap.id),
      domains: agent.capabilities
        .filter(cap => cap.id.startsWith('domain.'))
        .map(cap => cap.id.replace('domain.', '')),
      roles: agent.capabilities
        .filter(cap => cap.id.startsWith('role.'))
        .map(cap => cap.id.replace('role.', ''))
    }));
  };
  
  const handleAgentClick = (agentId: string) => {
    setSelectedAgentId(agentId);
    // Scroll to the agent card
    const agentCard = document.getElementById(`agent-card-${agentId}`);
    if (agentCard) {
      agentCard.scrollIntoView({ behavior: 'smooth' });

      // Highlight the card temporarily
      agentCard.classList.add('bg-blue-900');
      setTimeout(() => {
        agentCard.classList.remove('bg-blue-900');
      }, 1500);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Agents</h1>
          <p className="text-gray-600 dark:text-gray-300">
            View and manage your AI agents
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          {!batchMode && (
            <>
              <button
                onClick={() => setShowRelationships(!showRelationships)}
                className={`flex items-center gap-2 px-3 py-2 ${
                  showRelationships ? 'bg-blue-600' : 'bg-gray-700'
                } rounded hover:bg-blue-700`}
                title="Show agent relationships"
              >
                <Network size={16} />
                {showRelationships ? 'Hide Relationships' : 'Show Relationships'}
              </button>
              
              <button
                onClick={loadAgents}
                className="flex items-center gap-2 px-3 py-2 bg-gray-700 rounded hover:bg-gray-600"
                disabled={loading}
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </>
          )}
          
          {agents.length > 0 && (
            <button
              onClick={toggleBatchMode}
              className={`flex items-center gap-2 px-3 py-2 rounded ${
                batchMode ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {batchMode ? (
                <>
                  <Trash2 size={16} />
                  Cancel
                </>
              ) : (
                <>
                  <CheckSquare size={16} />
                  Batch Delete
                </>
              )}
            </button>
          )}
          
          {!batchMode && (
            <button
              onClick={handleCreateAgent}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 rounded hover:bg-blue-700"
            >
              <Plus size={16} />
              Create Agent
            </button>
          )}
        </div>
      </div>

      {/* Batch mode controls */}
      {batchMode && agents.length > 0 && (
        <div className="mb-6 p-4 bg-red-900 bg-opacity-20 border border-red-500 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <CheckSquare className="h-4 w-4 text-red-400" />
                <span className="text-sm font-medium text-red-400">Batch Delete Mode</span>
              </div>
              <span className="text-xs text-gray-400">Click on agent cards to select them</span>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={selectAllAgents}
                className="flex items-center gap-2 px-3 py-2 bg-gray-700 rounded hover:bg-gray-600"
              >
                {selectedAgents.size === agents.length ? (
                  <>
                    <CheckSquare size={16} />
                    Deselect All
                  </>
                ) : (
                  <>
                    <Square size={16} />
                    Select All
                  </>
                )}
              </button>
              <span className="text-sm text-gray-300">
                {selectedAgents.size} of {agents.length} agents selected
              </span>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={selectedAgents.size === 0}
                className={`px-4 py-2 rounded flex items-center space-x-2 ${
                  selectedAgents.size === 0
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete {selectedAgents.size} Agent{selectedAgents.size !== 1 ? 's' : ''}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Confirm Deletion</h3>
            <p className="text-gray-300 mb-4">
              Are you sure you want to delete the following {selectedAgents.size} agent{selectedAgents.size !== 1 ? 's' : ''}?
            </p>
            <div className="max-h-32 overflow-y-auto mb-4">
              <ul className="text-sm text-gray-400 space-y-1">
                {Array.from(selectedAgents).map(agentId => {
                  const agent = agents.find(a => a.id === agentId);
                  return (
                    <li key={agentId} className="flex items-center">
                      <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                      {agent?.name || agentId}
                    </li>
                  );
                })}
              </ul>
            </div>
            <p className="text-red-400 text-sm mb-6">
              This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  if (!deleting) {
                    setShowDeleteConfirm(false);
                  }
                }}
                disabled={deleting}
                className={`px-4 py-2 rounded ${
                  deleting 
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                    : 'bg-gray-600 hover:bg-gray-700 text-white'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleBatchDelete}
                disabled={deleting}
                className={`px-4 py-2 rounded flex items-center space-x-2 ${
                  deleting
                    ? 'bg-red-600 cursor-not-allowed opacity-70'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {deleting && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <span>{deleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-500 bg-opacity-20 text-red-400 rounded">
          {error}
        </div>
      )}

      {/* Draft continuation banner */}
      {draftData && (
        <div className="mb-6 p-4 bg-amber-500 bg-opacity-20 border border-amber-500 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 mt-0.5">
                <FileText className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-amber-400 font-medium">Draft Agent Found</h3>
                <p className="text-amber-200 text-sm mt-1">
                  You have an unsaved agent draft: <strong>&ldquo;{draftData.formData.name || 'Unnamed Agent'}&rdquo;</strong>
                </p>
                <p className="text-amber-300 text-xs mt-1 flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  Last worked on: {getStepName(draftData.currentStep)}
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleContinueDraft}
                className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded hover:bg-amber-700 transition-colors"
              >
                Continue Draft
              </button>
              <button
                onClick={handleDiscardDraft}
                className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Relationship Visualizer */}
      {showRelationships && agents.length > 1 && !batchMode && (
        <AgentRelationshipVisualizer
          agents={formatAgentsForVisualizer()}
          currentAgentId={selectedAgentId || undefined}
          onAgentClick={handleAgentClick}
        />
      )}
      
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 rounded-full border-4 border-t-blue-500 border-r-transparent border-b-blue-500 border-l-transparent animate-spin"></div>
            <p className="mt-4 text-gray-400">Loading agents...</p>
        </div>
        </div>
      ) : agents.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">No agents found</h2>
          <p className="text-gray-400 mb-6">
            You don&apos;t have any agents yet. Create your first agent to get started.
            {draftData && (
              <span className="block mt-2 text-amber-400 text-sm">
                📝 Looks like you have an unfinished agent draft above!
              </span>
            )}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {draftData && (
              <button
                onClick={handleContinueDraft}
                className="px-4 py-2 bg-amber-600 rounded hover:bg-amber-700 flex items-center gap-2"
              >
                <FileText size={16} />
                Continue Draft
              </button>
            )}
            <button
              onClick={handleCreateAgent}
              className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus size={16} />
              Create New Agent
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map(agent => (
            <div 
              key={agent.id} 
              id={`agent-card-${agent.id}`}
              className={`relative bg-gray-800 rounded-lg overflow-hidden shadow-lg transition-all duration-300 ${
                batchMode ? 'cursor-pointer hover:bg-gray-750 border-2 border-dashed' : ''
              } ${
                selectedAgents.has(agent.id) ? 'ring-2 ring-red-500 border-red-500' : batchMode ? 'border-gray-600 hover:border-red-400' : ''
              }`}
              onClick={batchMode ? (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleAgentSelection(agent.id);
              } : undefined}
            >
              {/* Batch mode checkbox */}
              {batchMode && (
                <div className="absolute top-3 left-3 z-20 bg-gray-900 rounded p-1 pointer-events-none">
                  {selectedAgents.has(agent.id) ? (
                    <CheckSquare className="h-5 w-5 text-red-500" />
                  ) : (
                    <Square className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              )}
              
              {/* Batch mode overlay - only show on hover and when not selected */}
              {batchMode && !selectedAgents.has(agent.id) && (
                <div className="absolute inset-0 bg-gray-900 bg-opacity-20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                  <div className="text-center text-gray-300">
                    <Square className="h-6 w-6 mx-auto mb-1" />
                    <span className="text-xs">Click to select</span>
                  </div>
                </div>
              )}
              
              <div className={`p-5 ${batchMode ? 'pointer-events-none' : ''}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-semibold">{agent.name}</h2>
                    <div className="flex items-center mt-1">
                      <span 
                        className={`w-2 h-2 rounded-full mr-2 ${getStatusColor(agent.status)}`}
                      ></span>
                      <span className="text-sm text-gray-400 capitalize">{agent.status}</span>
        </div>
                  </div>
                  {!batchMode && (
                    <div className="flex space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowCapabilities(showCapabilities === agent.id ? null : agent.id);
                        }}
                        className="p-2 rounded hover:bg-gray-700"
                        title="View capabilities"
                      >
                        <Info size={18} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/agents/${agent.id}`);
                        }}
                        className="p-2 rounded hover:bg-gray-700"
                        title="Edit agent"
                      >
                        <Settings size={18} />
                      </button>
                    </div>
                  )}
                </div>
                
                <p className="mt-3 text-gray-400 text-sm line-clamp-2">
                  {agent.description || 'No description available.'}
                </p>
                
                {showCapabilities === agent.id && !batchMode && (
                  <div className="mt-4 p-3 bg-gray-700 rounded">
                    <h3 className="text-sm font-medium mb-2">Capabilities ({agent.capabilities.length})</h3>
                    <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                      {agent.capabilities.length > 0 ? (
                        agent.capabilities.map(cap => (
                          <li key={cap.id} className="flex items-start">
                            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mt-1.5 mr-2"></span>
                      <div>
                              <span className="font-medium">{cap.name}</span>
                              {cap.description && (
                                <p className="text-gray-400 mt-0.5">{cap.description}</p>
                              )}
                    </div>
                  </li>
                        ))
                      ) : (
                        <li className="text-gray-400">No capabilities defined</li>
                      )}
            </ul>
          </div>
                )}
              </div>
              
              {!batchMode && (
                <div className="bg-gray-700 p-4 flex justify-between items-center">
                  <div className="text-xs text-gray-400">
                    Created: {new Date(agent.createdAt).toLocaleDateString()}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGoToChat(agent.id);
                    }}
                    className="px-3 py-1 bg-blue-600 text-sm rounded hover:bg-blue-700"
                  >
                    {(agent.metadata?.chatId || agent.chatId) ? 'Go to Chat' : 'Create Chat'}
                  </button>
                </div>
              )}
            </div>
              ))}
        </div>
      )}
    </div>
  );
} 