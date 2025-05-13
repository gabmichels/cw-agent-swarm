import React, { useRef, useEffect, useState } from 'react';
import { AgentType } from '@/constants/agent';

interface Agent {
  id: string;
  name: string;
  type: AgentType;
  capabilities: string[];
  domains: string[];
  roles: string[];
}

interface AgentRelationship {
  source: string; // Agent ID
  target: string; // Agent ID
  strength: number; // 0 to 1
  type: 'capability' | 'domain' | 'role';
}

interface AgentRelationshipVisualizerProps {
  agents: Agent[];
  currentAgentId?: string;
  onAgentClick?: (agentId: string) => void;
}

const AgentRelationshipVisualizer: React.FC<AgentRelationshipVisualizerProps> = ({
  agents,
  currentAgentId,
  onAgentClick
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [relationships, setRelationships] = useState<AgentRelationship[]>([]);
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);
  
  // Calculate agent positions in a circle
  const calculatePositions = () => {
    const positions: Record<string, { x: number, y: number }> = {};
    const centerX = canvasRef.current!.width / 2;
    const centerY = canvasRef.current!.height / 2;
    const radius = Math.min(centerX, centerY) * 0.7;
    
    agents.forEach((agent, index) => {
      const angle = (index / agents.length) * 2 * Math.PI;
      positions[agent.id] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
    });
    
    return positions;
  };
  
  // Calculate relationships between agents
  useEffect(() => {
    const newRelationships: AgentRelationship[] = [];
    
    // Check all pairs of agents
    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        const agent1 = agents[i];
        const agent2 = agents[j];
        
        // Compare capabilities
        const sharedCapabilities = agent1.capabilities.filter(cap => 
          agent2.capabilities.includes(cap)
        );
        
        if (sharedCapabilities.length > 0) {
          newRelationships.push({
            source: agent1.id,
            target: agent2.id,
            strength: sharedCapabilities.length / Math.max(agent1.capabilities.length, agent2.capabilities.length),
            type: 'capability'
          });
        }
        
        // Compare domains
        const sharedDomains = agent1.domains.filter(domain => 
          agent2.domains.includes(domain)
        );
        
        if (sharedDomains.length > 0) {
          newRelationships.push({
            source: agent1.id,
            target: agent2.id,
            strength: sharedDomains.length / Math.max(agent1.domains.length, agent2.domains.length),
            type: 'domain'
          });
        }
        
        // Compare roles
        const sharedRoles = agent1.roles.filter(role => 
          agent2.roles.includes(role)
        );
        
        if (sharedRoles.length > 0) {
          newRelationships.push({
            source: agent1.id,
            target: agent2.id,
            strength: sharedRoles.length / Math.max(agent1.roles.length, agent2.roles.length),
            type: 'role'
          });
        }
      }
    }
    
    setRelationships(newRelationships);
  }, [agents]);
  
  // Draw the visualization
  useEffect(() => {
    if (!canvasRef.current || agents.length === 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate agent positions
    const agentPositions = calculatePositions();
    
    // Draw relationships
    relationships.forEach(rel => {
      const sourcePos = agentPositions[rel.source];
      const targetPos = agentPositions[rel.target];
      
      // Only draw relationships involving current agent if one is selected
      if (currentAgentId && rel.source !== currentAgentId && rel.target !== currentAgentId) {
        return;
      }
      
      // Set line style based on relationship type
      switch (rel.type) {
        case 'capability':
          ctx.strokeStyle = 'rgba(59, 130, 246, ' + rel.strength * 0.8 + ')'; // Blue
          break;
        case 'domain':
          ctx.strokeStyle = 'rgba(16, 185, 129, ' + rel.strength * 0.8 + ')'; // Green
          break;
        case 'role':
          ctx.strokeStyle = 'rgba(249, 115, 22, ' + rel.strength * 0.8 + ')'; // Orange
          break;
      }
      
      ctx.lineWidth = 1 + rel.strength * 3;
      
      // Draw line
      ctx.beginPath();
      ctx.moveTo(sourcePos.x, sourcePos.y);
      ctx.lineTo(targetPos.x, targetPos.y);
      ctx.stroke();
    });
    
    // Draw agents
    agents.forEach(agent => {
      const pos = agentPositions[agent.id];
      
      // Set node style based on agent type and selection
      ctx.fillStyle = agent.id === currentAgentId 
        ? '#3b82f6' // Blue for current agent
        : agent.id === hoveredAgent
          ? '#6b7280' // Gray for hovered agent 
          : '#374151'; // Dark gray for other agents
      
      // Draw node
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 20, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw agent name
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(agent.name.substring(0, 2), pos.x, pos.y);
      
      // Draw agent name below the node
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#d1d5db';
      ctx.fillText(agent.name, pos.x, pos.y + 30);
    });
    
  }, [agents, relationships, currentAgentId, hoveredAgent]);
  
  // Handle canvas resizing
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && containerRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = 300; // Fixed height
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // Handle mouse interaction
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate agent positions
    const agentPositions = calculatePositions();
    
    // Check if mouse is over an agent
    let foundAgent = null;
    for (const agent of agents) {
      const pos = agentPositions[agent.id];
      const distance = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
      
      if (distance <= 20) {
        foundAgent = agent.id;
        break;
      }
    }
    
    setHoveredAgent(foundAgent);
    
    // Change cursor if hovering over an agent
    canvas.style.cursor = foundAgent ? 'pointer' : 'default';
  };
  
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hoveredAgent && onAgentClick) {
      onAgentClick(hoveredAgent);
    }
  };
  
  return (
    <div className="bg-gray-800 rounded-lg p-6 my-4" ref={containerRef}>
      <h2 className="text-xl font-semibold mb-4">Agent Relationships</h2>
      <p className="text-sm text-gray-400 mb-4">
        This visualization shows how the agents in your system relate to each other based on their capabilities, domains, and roles.
      </p>
      
      {agents.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          No agents available for visualization.
        </div>
      ) : (
        <>
          <div className="flex justify-center mb-4">
            <div className="flex space-x-4">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                <span className="text-xs text-gray-300">Shared Capabilities</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <span className="text-xs text-gray-300">Shared Domains</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-orange-500 rounded-full mr-2"></div>
                <span className="text-xs text-gray-300">Shared Roles</span>
              </div>
            </div>
          </div>
          
          <canvas 
            ref={canvasRef} 
            className="w-full rounded" 
            onMouseMove={handleMouseMove}
            onClick={handleClick}
          />
        </>
      )}
    </div>
  );
};

export default AgentRelationshipVisualizer; 