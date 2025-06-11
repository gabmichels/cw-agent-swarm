'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AgentProfile } from '@/lib/multi-agent/types/agent';
import CreateChatButton from '@/components/chat/CreateChatButton';
import MemoryUploader from '@/components/agent/MemoryUploader';
import AgentCapabilityEditor from '@/components/agent/AgentCapabilityEditor';
import { Edit, Save, Upload, X } from 'lucide-react';

export default function AgentPage({ params }: { params: { id?: string } }) {
  // Use nextjs navigation hook for route params
  const routeParams = useParams();
  // Convert route params to expected type and provide default
  const agentId = (routeParams && typeof routeParams.id === 'string' ? routeParams.id : params?.id) || 'default';
  
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Hardcoded user ID for now, will be replaced with authentication system
  const userId = 'user_gab';
  // State for the upload modal
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  
  // Add new state for parameters editing
  const [isEditingParams, setIsEditingParams] = useState(false);
  const [editedParams, setEditedParams] = useState({
    model: '',
    temperature: 0,
    maxTokens: 0,
    autonomous: false
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Add state for capability editing
  const [isEditingCapabilities, setIsEditingCapabilities] = useState(false);

  useEffect(() => {
    const fetchAgentDetails = async () => {
      setIsLoading(true);
      
      try {
        // First try to fetch the agent with the exact ID
        let response = await fetch(`/api/multi-agent/agents?id=${agentId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch agent details: ${response.statusText}`);
        }
        
        let data: { agents?: AgentProfile[] } = await response.json();
        
        // Check if agent was found
        if (data.agents && data.agents.length > 0) {
          // Find the agent with the matching ID
          const foundAgent = data.agents.find(a => 
            a.id === agentId || 
            (typeof a.id === 'object' && a.id !== null && (a.id as unknown as { id: string }).id === agentId)
          );
          
          if (foundAgent) {
            setAgent(foundAgent);
          } else {
            // If no agent found with the matching ID, throw error
            throw new Error(`Agent with ID ${agentId} not found in the response`);
          }
        } else {
          // If no agent found, try to get all agents and find it by ID
          // This is a fallback in case the API has issues with direct ID queries
          console.log('Agent not found with direct ID query, trying to retrieve all agents...');
          response = await fetch('/api/multi-agent/agents');
          
          if (!response.ok) {
            throw new Error(`Failed to fetch agents list: ${response.statusText}`);
          }
          
          data = await response.json();
          
          if (data.agents && data.agents.length > 0) {
            // Try to find the agent by ID, handling different ID formats
            const foundAgent = data.agents.find((a: AgentProfile) => {
              // Compare raw IDs
              if (a.id === agentId) return true;
              
              // Also try ID extraction if agent ID is in a different format
              // Some DB formats might store ID as an object with an id property
              const extractedId = typeof a.id === 'object' && a.id !== null ? (a.id as unknown as { id: string }).id : a.id;
              return extractedId === agentId;
            });
            
            if (foundAgent) {
              setAgent(foundAgent);
            } else {
              throw new Error('Agent not found in the system');
            }
          } else {
            throw new Error('No agents found in the system');
          }
        }
      } catch (err) {
        console.error('Error fetching agent details:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (agentId) {
      fetchAgentDetails();
    }
  }, [agentId]);

  // Add new function to handle parameter updates
  const handleUpdateParameters = async () => {
    if (!agent) return;
    
    setIsSaving(true);
    setSaveError(null);
    
    try {
      const updatedAgent = {
        ...agent,
        parameters: {
          ...agent.parameters,
          model: editedParams.model,
          temperature: editedParams.temperature,
          maxTokens: editedParams.maxTokens,
          autonomous: editedParams.autonomous
        }
      };
      
      const response = await fetch(`/api/multi-agent/agents/${agentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedAgent)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update agent: ${response.statusText}`);
      }
      
      const data = await response.json();
      setAgent(data.agent);
      setIsEditingParams(false);
      
      // If autonomous mode was changed, initiate the autonomous system
      if (editedParams.autonomous !== agent.parameters.autonomous) {
        // Call API to set autonomy mode
        await fetch(`/api/multi-agent/agents/${agentId}/autonomy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ enabled: editedParams.autonomous })
        });
      }
      
    } catch (err) {
      console.error('Error updating agent parameters:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to update parameters');
    } finally {
      setIsSaving(false);
    }
  };
  
  // New function to start edit mode
  const handleStartEditing = () => {
    if (!agent) return;
    
    setEditedParams({
      model: agent.parameters.model,
      temperature: agent.parameters.temperature,
      maxTokens: agent.parameters.maxTokens,
      autonomous: agent.parameters.autonomous || false
    });
    
    setIsEditingParams(true);
  };
  
  // New function to cancel editing
  const handleCancelEditing = () => {
    setIsEditingParams(false);
    setSaveError(null);
  };

  // Add handler for capability updates
  const handleCapabilitiesUpdate = (updatedAgent: AgentProfile) => {
    setAgent(updatedAgent);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-900 border border-red-700 text-white px-6 py-4 rounded mb-6">
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <p>{error || 'Agent not found'}</p>
          <Link href="/agents" className="inline-block mt-4 bg-white text-red-900 px-4 py-2 rounded font-medium">
            Back to Agents
          </Link>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    available: 'bg-green-100 text-green-800',
    unavailable: 'bg-red-100 text-red-800',
    maintenance: 'bg-yellow-100 text-yellow-800'
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <Link href="/agents" className="text-blue-500 hover:text-blue-700">
          ← Back to Agents
        </Link>
        <div className="flex space-x-2">
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Files
          </button>
          <CreateChatButton agent={agent} userId={userId} />
        </div>
      </div>
      
      <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">{agent.name}</h1>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mt-2 ${statusColors[agent.status] || 'bg-gray-100 text-gray-800'}`}>
                {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
              </span>
            </div>
            <div className="text-sm text-gray-400">
              <div>Created: {new Date(agent.createdAt).toLocaleDateString()}</div>
              <div>Updated: {new Date(agent.updatedAt).toLocaleDateString()}</div>
            </div>
          </div>
          
          <p className="mt-4 text-gray-300">{agent.description}</p>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div>
              <h2 className="text-xl font-semibold mb-4">Capabilities</h2>
              <AgentCapabilityEditor 
                agent={agent}
                onCapabilitiesUpdate={handleCapabilitiesUpdate}
                isEditing={isEditingCapabilities}
                onEditingChange={setIsEditingCapabilities}
              />
            </div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Model Parameters</h2>
              {!isEditingParams ? (
                <button
                  onClick={handleStartEditing}
                  className="flex items-center text-blue-500 hover:text-blue-400"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </button>
              ) : (
                <div className="flex space-x-2">
                  <button
                    onClick={handleCancelEditing}
                    className="flex items-center text-gray-400 hover:text-gray-300"
                    disabled={isSaving}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateParameters}
                    className="flex items-center text-green-500 hover:text-green-400"
                    disabled={isSaving}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </button>
                </div>
              )}
            </div>
            
            {saveError && (
              <div className="bg-red-900 border border-red-700 text-white px-4 py-2 rounded mb-4">
                {saveError}
              </div>
            )}
            
            <div className="bg-gray-700 p-4 rounded">
              {!isEditingParams ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-400 text-sm">Model</span>
                    <p>{agent?.parameters.model}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-sm">Temperature</span>
                    <p>{agent?.parameters.temperature}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-sm">Max Tokens</span>
                    <p>{agent?.parameters.maxTokens}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-sm">Autonomous Mode</span>
                    <p>{agent?.parameters.autonomous ? 'Enabled' : 'Disabled'}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400 text-sm">Tools</span>
                    <p>{agent?.parameters.tools.length > 0 ? agent.parameters.tools.join(', ') : 'None'}</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-gray-400 text-sm block mb-1">Model</label>
                    <select
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-sm"
                      value={editedParams.model}
                      onChange={(e) => setEditedParams({...editedParams, model: e.target.value})}
                    >
                      <option value="gpt-4.1-2025-04-14">ChatGPT-4.1</option>
                      <option value="gpt-4.1-nano-2025-04-14">ChatGPT-4.1-nano</option>
                      <option value="claude-3-opus">Claude 3 Opus</option>
                      <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm block mb-1">Temperature</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-sm"
                      value={editedParams.temperature}
                      onChange={(e) => setEditedParams({...editedParams, temperature: parseFloat(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm block mb-1">Max Tokens</label>
                    <input
                      type="number"
                      step="100"
                      min="100"
                      max="100000"
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-sm"
                      value={editedParams.maxTokens}
                      onChange={(e) => setEditedParams({...editedParams, maxTokens: parseInt(e.target.value)})}
                    />
                  </div>
                  <div className="flex items-center">
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={editedParams.autonomous}
                        onChange={(e) => setEditedParams({...editedParams, autonomous: e.target.checked})}
                      />
                      <div className="relative w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      <span className="ms-3 text-sm font-medium">Autonomous Mode</span>
                    </label>
                  </div>
                  <div className="col-span-2">
                    <label className="text-gray-400 text-sm block mb-1">Tools (read-only)</label>
                    <div className="w-full px-3 py-2 bg-gray-500/30 border border-gray-500 rounded text-sm">
                      {agent?.parameters.tools.length > 0 ? agent.parameters.tools.join(', ') : 'None'}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <h2 className="text-xl font-semibold mt-6 mb-4">Metadata</h2>
            <div className="bg-gray-700 p-4 rounded">
              <div className="mb-4">
                <span className="text-gray-400 text-sm">Tags</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {agent.metadata.tags.map((tag) => (
                    <span key={tag} className="bg-gray-600 px-2 py-1 rounded text-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="mb-4">
                <span className="text-gray-400 text-sm">Domains</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {agent.metadata.domain.map((domain) => (
                    <span key={domain} className="bg-blue-900 px-2 py-1 rounded text-sm">
                      {domain}
                    </span>
                  ))}
                </div>
              </div>
              
              <div>
                <span className="text-gray-400 text-sm">Specializations</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {agent.metadata.specialization.map((spec) => (
                    <span key={spec} className="bg-purple-900 px-2 py-1 rounded text-sm">
                      {spec}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Memory Uploader Modal */}
      <MemoryUploader
        agentId={agentId}
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={() => {
          // You could add a notification or refresh the agent data here
          console.log('Successfully uploaded memories!');
        }}
      />
    </div>
  );
} 