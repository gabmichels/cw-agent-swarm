'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AgentService } from '@/services/AgentService';
import { Plus, Info, Settings, RefreshCw, Network } from 'lucide-react';
import AgentSettings from '@/components/agent/AgentSettings';
import AgentRelationshipVisualizer from '@/components/agent/AgentRelationshipVisualizer';
import { AgentType } from '@/constants/agent';

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
}

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showCapabilities, setShowCapabilities] = useState<string | null>(null);
  const [showRelationships, setShowRelationships] = useState<boolean>(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

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
  }, []);
  
  const handleCreateAgent = () => {
    router.push('/agents/create');
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
          
          <button
            onClick={handleCreateAgent}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 rounded hover:bg-blue-700"
          >
            <Plus size={16} />
            Create Agent
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500 bg-opacity-20 text-red-400 rounded">
          {error}
        </div>
      )}
      
      {/* Relationship Visualizer */}
      {showRelationships && agents.length > 1 && (
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
            You don't have any agents yet. Create your first agent to get started.
          </p>
          <button
            onClick={handleCreateAgent}
            className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
          >
            Create Agent
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map(agent => (
            <div 
              key={agent.id} 
              id={`agent-card-${agent.id}`}
              className="bg-gray-800 rounded-lg overflow-hidden shadow-lg transition-colors duration-300"
            >
              <div className="p-5">
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
                  <div className="flex space-x-1">
                    <button
                      onClick={() => setShowCapabilities(showCapabilities === agent.id ? null : agent.id)}
                      className="p-2 rounded hover:bg-gray-700"
                      title="View capabilities"
                    >
                      <Info size={18} />
                    </button>
                    <div className="p-2 rounded hover:bg-gray-700">
                      <AgentSettings
                        agentId={agent.id}
                        agentName={agent.name}
                      />
                    </div>
                  </div>
                </div>
                
                <p className="mt-3 text-gray-400 text-sm line-clamp-2">
                  {agent.description || 'No description available.'}
                </p>
                
                {showCapabilities === agent.id && (
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
              
              <div className="bg-gray-700 p-4 flex justify-between items-center">
                <div className="text-xs text-gray-400">
                  Created: {new Date(agent.createdAt).toLocaleDateString()}
                </div>
                <button
                  onClick={() => router.push(`/chat?agent=${agent.id}`)}
                  className="px-3 py-1 bg-blue-600 text-sm rounded hover:bg-blue-700"
                >
                  Chat with Agent
                </button>
              </div>
            </div>
              ))}
        </div>
      )}
    </div>
  );
} 