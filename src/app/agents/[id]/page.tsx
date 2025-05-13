'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AgentProfile } from '@/lib/multi-agent/types/agent';
import CreateChatButton from '@/components/chat/CreateChatButton';

const AgentDetailPage: React.FC = () => {
  const params = useParams();
  const agentId = params.id as string;
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Hardcoded user ID for now, will be replaced with authentication system
  const userId = 'user_gab';

  useEffect(() => {
    const fetchAgentDetails = async () => {
      setIsLoading(true);
      
      try {
        // First try to fetch the agent with the exact ID
        let response = await fetch(`/api/multi-agent/agents?id=${agentId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch agent details: ${response.statusText}`);
        }
        
        let data = await response.json();
        
        // Check if agent was found
        if (data.agents && data.agents.length > 0) {
          setAgent(data.agents[0]);
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
            const foundAgent = data.agents.find((a: any) => {
              // Compare raw IDs
              if (a.id === agentId) return true;
              
              // Also try ID extraction if agent ID is in a different format
              // Some DB formats might store ID as an object with an id property
              const extractedId = typeof a.id === 'object' && a.id !== null ? a.id.id : a.id;
              return extractedId === agentId;
            });
            
            if (foundAgent) {
              setAgent(foundAgent as AgentProfile);
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

  const statusColors = {
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
        <CreateChatButton agent={agent} userId={userId} />
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
            <h2 className="text-xl font-semibold mb-4">Capabilities</h2>
            <ul className="space-y-2">
              {agent.capabilities.map((capability) => (
                <li key={capability.id} className="bg-gray-700 p-3 rounded">
                  <h3 className="font-medium">{capability.name}</h3>
                  <p className="text-sm text-gray-300">{capability.description}</p>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold mb-4">Model Parameters</h2>
            <div className="bg-gray-700 p-4 rounded">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-400 text-sm">Model</span>
                  <p>{agent.parameters.model}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">Temperature</span>
                  <p>{agent.parameters.temperature}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">Max Tokens</span>
                  <p>{agent.parameters.maxTokens}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">Tools</span>
                  <p>{agent.parameters.tools.length > 0 ? agent.parameters.tools.join(', ') : 'None'}</p>
                </div>
              </div>
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
    </div>
  );
};

export default AgentDetailPage; 