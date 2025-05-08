'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { ServerEvent } from '../server/websocket/types';

interface Agent {
  id: string;
  name: string;
  status: 'available' | 'busy' | 'offline' | 'maintenance';
  capabilities: string[];
}

interface Relationship {
  relationship_id: string;
  agent_1_id: string;
  agent_2_id: string;
  relationship_type: 'collaboration' | 'supervision' | 'delegation' | 'competition' | 'custom';
  strength: number;
  trust_level: number;
  interaction_count: number;
  collaboration_score: number;
}

interface Node {
  id: string;
  label: string;
  color: string;
  size: number;
}

interface Edge {
  id: string;
  from: string;
  to: string;
  label: string;
  width: number;
  color: string;
}

interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

interface AgentRelationshipGraphProps {
  initialAgents?: Agent[];
  initialRelationships?: Relationship[];
  height?: string;
  width?: string;
  interactive?: boolean;
}

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'available':
      return '#4CAF50'; // Green
    case 'busy':
      return '#FFC107'; // Amber
    case 'offline':
      return '#9E9E9E'; // Gray
    case 'maintenance':
      return '#F44336'; // Red
    default:
      return '#2196F3'; // Blue (default)
  }
};

const getRelationshipColor = (type: string, strength: number): string => {
  const opacity = Math.max(0.3, Math.min(0.9, strength / 100));
  
  switch (type) {
    case 'collaboration':
      return `rgba(76, 175, 80, ${opacity})`; // Green with varying opacity
    case 'supervision':
      return `rgba(33, 150, 243, ${opacity})`; // Blue with varying opacity
    case 'delegation':
      return `rgba(156, 39, 176, ${opacity})`; // Purple with varying opacity
    case 'competition':
      return `rgba(244, 67, 54, ${opacity})`; // Red with varying opacity
    default:
      return `rgba(158, 158, 158, ${opacity})`; // Gray with varying opacity
  }
};

export const AgentRelationshipGraph: React.FC<AgentRelationshipGraphProps> = ({
  initialAgents = [],
  initialRelationships = [],
  height = '500px',
  width = '100%',
  interactive = true
}) => {
  const graphRef = useRef<HTMLDivElement>(null);
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [relationships, setRelationships] = useState<Relationship[]>(initialRelationships);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { isConnected, subscribeToEvent } = useWebSocket();
  
  // Fetch agents and relationships data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch agents
        const agentsResponse = await fetch('/api/agents');
        const agentsData = await agentsResponse.json();
        
        // Fetch relationships
        const relationshipsResponse = await fetch('/api/agent-relationships');
        const relationshipsData = await relationshipsResponse.json();
        
        setAgents(agentsData);
        setRelationships(relationshipsData);
      } catch (error) {
        console.error('Error fetching relationship data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (initialAgents.length === 0 || initialRelationships.length === 0) {
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [initialAgents.length, initialRelationships.length]);
  
  // Subscribe to WebSocket events for real-time updates
  useEffect(() => {
    if (!isConnected || !subscribeToEvent) return;
    
    // Handle agent updates
    const unsubscribeAgentUpdated = subscribeToEvent(ServerEvent.AGENT_UPDATED, (payload) => {
      setAgents(prevAgents => {
        const index = prevAgents.findIndex(a => a.id === payload.agentId);
        if (index === -1) return prevAgents;
        
        const updatedAgents = [...prevAgents];
        updatedAgents[index] = {
          ...updatedAgents[index],
          ...payload.agent
        };
        return updatedAgents;
      });
    });
    
    // Handle agent status changes
    const unsubscribeAgentStatus = subscribeToEvent(ServerEvent.AGENT_STATUS_CHANGED, (payload) => {
      setAgents(prevAgents => {
        const index = prevAgents.findIndex(a => a.id === payload.agentId);
        if (index === -1) return prevAgents;
        
        const updatedAgents = [...prevAgents];
        updatedAgents[index] = {
          ...updatedAgents[index],
          status: payload.agent.status
        };
        return updatedAgents;
      });
    });
    
    // Here we would add handlers for relationship updates if an API existed
    
    return () => {
      if (typeof unsubscribeAgentUpdated === 'function') unsubscribeAgentUpdated();
      if (typeof unsubscribeAgentStatus === 'function') unsubscribeAgentStatus();
    };
  }, [isConnected, subscribeToEvent]);
  
  // Process data into graph format
  useEffect(() => {
    if (agents.length === 0) return;
    
    // Create nodes from agents
    const nodes: Node[] = agents.map(agent => ({
      id: agent.id,
      label: agent.name,
      color: getStatusColor(agent.status),
      size: 30 + (agent.capabilities?.length || 0) * 5 // Size based on number of capabilities
    }));
    
    // Create edges from relationships
    const edges: Edge[] = relationships.map(rel => ({
      id: rel.relationship_id,
      from: rel.agent_1_id,
      to: rel.agent_2_id,
      label: `${rel.relationship_type} (${rel.strength})`,
      width: Math.max(1, Math.min(10, rel.interaction_count / 10)), // Width based on interaction count
      color: getRelationshipColor(rel.relationship_type, rel.strength)
    }));
    
    setGraphData({ nodes, edges });
  }, [agents, relationships]);
  
  // Initialize graph visualization
  useEffect(() => {
    if (!graphRef.current || isLoading || graphData.nodes.length === 0) return;
    
    // Define dynamic import type
    type NetworkModule = { 
      Network: new (
        container: HTMLElement, 
        data: any, 
        options: any
      ) => {
        on: (event: string, callback: (params: any) => void) => void;
        destroy: () => void;
      }
    };
    
    // Dynamic import to avoid SSR issues
    const importVisNetwork = async () => {
      try {
        // Use type assertion for dynamic import
        const visNetwork = await import('vis-network' as any) as NetworkModule;
        const container = graphRef.current;
        if (!container) return;
        
        // Create network
        const network = new visNetwork.Network(
          container,
          graphData,
          {
            nodes: {
              shape: 'dot',
              font: {
                size: 14,
                face: 'Roboto',
                color: '#ffffff'
              },
              borderWidth: 2,
              shadow: true
            },
            edges: {
              font: {
                size: 12,
                face: 'Roboto',
                color: '#ffffff'
              },
              smooth: {
                type: 'continuous'
              },
              arrows: {
                to: { enabled: true, scaleFactor: 0.5 }
              }
            },
            physics: {
              enabled: interactive,
              stabilization: {
                iterations: 100
              },
              barnesHut: {
                gravitationalConstant: -80,
                springConstant: 0.02,
                springLength: 150
              }
            },
            interaction: {
              dragNodes: interactive,
              dragView: interactive,
              zoomView: interactive
            }
          }
        );
        
        // Handle node click events if needed
        network.on('click', (params: { nodes: string[] }) => {
          if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            console.log('Node clicked:', nodeId);
            // Additional click handling logic
          }
        });
        
        // Clean up network on component unmount
        return () => {
          network.destroy();
        };
      } catch (error) {
        console.error('Error loading vis-network:', error);
      }
    };
    
    importVisNetwork();
  }, [graphData, isLoading, interactive]);
  
  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      )}
      <div 
        ref={graphRef} 
        className="agent-relationship-graph border border-gray-700 rounded-lg overflow-hidden"
        style={{ height, width }}
      />
    </div>
  );
};

export default AgentRelationshipGraph; 