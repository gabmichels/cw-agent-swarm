'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  Edge, 
  MiniMap, 
  Node, 
  Position,
  useNodesState,
  useEdgesState,
  MarkerType,
  Panel,
  NodeChange,
  EdgeChange,
  Connection,
  addEdge,
  ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Department, OrgHierarchyNode } from '../../types/organization';
import { AgentMetadata } from '../../types/metadata';
import { PlatformConfigService } from '../../services/PlatformConfigService';

/**
 * Props for the OrgChartRenderer component
 */
export interface OrgChartRendererProps {
  departments: Department[];
  agents: AgentMetadata[];
  hierarchy: OrgHierarchyNode[];
  width?: number;
  height?: number;
  interactive?: boolean;
  planningMode?: boolean;
  onNodeMove?: (nodeId: string, position: { x: number; y: number }) => void;
  onDepartmentCreate?: (parentId: string | null, position: { x: number; y: number }) => void;
  onAgentReassign?: (agentId: string, newDepartmentId: string) => void;
  onPreviewChanges?: (changes: OrgChartChange[]) => void;
}

/**
 * Represents a change in the organizational chart
 */
export interface OrgChartChange {
  type: 'agent_move' | 'department_create' | 'agent_reassign';
  agentId?: string;
  departmentId?: string;
  newPosition?: { x: number; y: number };
  newDepartmentId?: string;
  parentDepartmentId?: string | null;
}

/**
 * Node dimensions and spacing constants
 */
const NODE_DIMENSIONS = {
  DEPARTMENT_WIDTH: 300,
  DEPARTMENT_HEIGHT: 200,
  AGENT_WIDTH: 180,
  AGENT_HEIGHT: 80,
  SPACING_X: 100,
  SPACING_Y: 150,
  LEVEL_HEIGHT: 250
} as const;

/**
 * Department visual themes based on type/function
 */
const DEPARTMENT_THEMES = {
  engineering: { color: '#2196F3', bgColor: '#E3F2FD', icon: '⚙️' },
  operations: { color: '#FF9800', bgColor: '#FFF3E0', icon: '🔧' },
  marketing: { color: '#E91E63', bgColor: '#FCE4EC', icon: '📈' },
  sales: { color: '#4CAF50', bgColor: '#E8F5E0', icon: '💼' },
  finance: { color: '#9C27B0', bgColor: '#F3E5F5', icon: '💰' },
  hr: { color: '#607D8B', bgColor: '#ECEFF1', icon: '👥' },
  default: { color: '#757575', bgColor: '#F5F5F5', icon: '🏢' }
} as const;

/**
 * Agent status indicators with visual styling
 */
const AGENT_STATUS_CONFIG = {
  AVAILABLE: { color: '#4CAF50', icon: '●', label: 'Available' },
  BUSY: { color: '#FF9800', icon: '●', label: 'Busy' },
  OFFLINE: { color: '#9E9E9E', icon: '●', label: 'Offline' },
  MAINTENANCE: { color: '#F44336', icon: '●', label: 'Maintenance' }
} as const;

/**
 * Get department theme based on name/type
 */
const getDepartmentTheme = (departmentName: string) => {
  const name = departmentName.toLowerCase();
  if (name.includes('engineering') || name.includes('tech')) return DEPARTMENT_THEMES.engineering;
  if (name.includes('operations') || name.includes('ops')) return DEPARTMENT_THEMES.operations;
  if (name.includes('marketing')) return DEPARTMENT_THEMES.marketing;
  if (name.includes('sales')) return DEPARTMENT_THEMES.sales;
  if (name.includes('finance')) return DEPARTMENT_THEMES.finance;
  if (name.includes('hr') || name.includes('human')) return DEPARTMENT_THEMES.hr;
  return DEPARTMENT_THEMES.default;
};

/**
 * Custom Department Node Component
 */
const DepartmentNode: React.FC<{ data: any }> = ({ data }) => {
  const theme = getDepartmentTheme(data.department.name);
  
  return (
    <div 
      className="department-node"
      style={{
        width: NODE_DIMENSIONS.DEPARTMENT_WIDTH,
        height: NODE_DIMENSIONS.DEPARTMENT_HEIGHT,
        backgroundColor: theme.bgColor,
        border: `2px solid ${theme.color}`,
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        position: 'relative'
      }}
    >
      <div className="department-header" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        marginBottom: '12px',
        borderBottom: `1px solid ${theme.color}`,
        paddingBottom: '8px'
      }}>
        <span style={{ fontSize: '24px', marginRight: '8px' }}>{theme.icon}</span>
        <div>
          <h3 style={{ 
            margin: 0, 
            color: theme.color, 
            fontSize: '16px', 
            fontWeight: 'bold' 
          }}>
            {data.department.name}
          </h3>
          {data.department.description && (
            <p style={{ 
              margin: 0, 
              color: '#666', 
              fontSize: '12px',
              marginTop: '2px'
            }}>
              {data.department.description}
            </p>
          )}
        </div>
      </div>
      
      <div className="department-stats">
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
          👥 {data.agentCount} agents
        </div>
        {data.department.headOfDepartment && (
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
            👤 Head: {data.headName || 'Unknown'}
          </div>
        )}
        <div style={{ fontSize: '12px', color: '#666' }}>
          📊 Utilization: {Math.round((data.agentCount / (data.department.maxCapacity || 10)) * 100)}%
        </div>
      </div>
      
      {data.planningMode && (
        <div 
          className="department-actions"
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            display: 'flex',
            gap: '4px'
          }}
        >
          <button 
            style={{
              background: theme.color,
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
            onClick={() => data.onEdit?.(data.department.id)}
          >
            ✏️
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Custom Agent Node Component
 */
const AgentNode: React.FC<{ data: any }> = ({ data }) => {
  const statusConfig = AGENT_STATUS_CONFIG[data.agent.status as keyof typeof AGENT_STATUS_CONFIG] || AGENT_STATUS_CONFIG.OFFLINE;
  
  return (
    <div 
      className="agent-node"
      style={{
        width: NODE_DIMENSIONS.AGENT_WIDTH,
        height: NODE_DIMENSIONS.AGENT_HEIGHT,
        backgroundColor: 'white',
        border: `2px solid ${statusConfig.color}`,
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        position: 'relative',
        cursor: data.planningMode ? 'grab' : 'default'
      }}
    >
      <div className="agent-header" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '8px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flex: 1,
          minWidth: 0
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: statusConfig.color,
            marginRight: '8px',
            flexShrink: 0
          }} />
          <h4 style={{ 
            margin: 0, 
            fontSize: '14px', 
            fontWeight: 'bold',
            color: '#333',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {data.agent.name}
          </h4>
        </div>
        
        {data.planningMode && (
          <button 
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'grab',
              fontSize: '12px',
              padding: '2px'
            }}
            title="Drag to move"
          >
            ⋮⋮
          </button>
        )}
      </div>
      
      {data.agent.position && (
        <div style={{ 
          fontSize: '12px', 
          color: '#666', 
          marginBottom: '4px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          💼 {data.agent.position}
        </div>
      )}
      
      <div style={{ fontSize: '11px', color: '#999' }}>
        🔧 {data.agent.capabilities?.length || 0} capabilities
      </div>
    </div>
  );
};

/**
 * Main OrgChartRenderer Component
 */
export const OrgChartRenderer: React.FC<OrgChartRendererProps> = ({
  departments,
  agents,
  hierarchy,
  width = 1200,
  height = 800,
  interactive = true,
  planningMode = false,
  onNodeMove,
  onDepartmentCreate,
  onAgentReassign,
  onPreviewChanges
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width, height });
  const [pendingChanges, setPendingChanges] = useState<OrgChartChange[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const platformConfig = PlatformConfigService.getInstance();

  // Custom node types
  const nodeTypes = useMemo(() => ({
    department: DepartmentNode,
    agent: AgentNode
  }), []);

  // Update dimensions based on container size
  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          setDimensions({ 
            width: Math.max(width, 800), 
            height: Math.max(height, 600) 
          });
        }
      });
      
      resizeObserver.observe(containerRef.current);
      
      // Initial measurement
      setDimensions({
        width: Math.max(containerRef.current.offsetWidth, 800),
        height: Math.max(containerRef.current.offsetHeight, 600)
      });
      
      return () => {
        resizeObserver.disconnect();
      };
    }
  }, []);

  /**
   * Calculate hierarchical layout positions
   */
  const calculateLayout = useCallback(() => {
    if (!platformConfig.isOrganizationalMode()) {
      // Personal mode - simple grid layout by category
      return calculatePersonalModeLayout();
    }
    
    return calculateOrganizationalLayout();
  }, [departments, agents, hierarchy, dimensions]);

  /**
   * Personal mode layout - agents grouped by category
   */
  const calculatePersonalModeLayout = useCallback(() => {
    const flowNodes: Node[] = [];
    const flowEdges: Edge[] = [];
    
    // Group agents by category
    const agentsByCategory = agents.reduce((acc, agent) => {
      const category = agent.category || 'Uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(agent);
      return acc;
    }, {} as Record<string, AgentMetadata[]>);

    let yOffset = 50;
    
    Object.entries(agentsByCategory).forEach(([category, categoryAgents]) => {
      // Create category header
      flowNodes.push({
        id: `category-${category}`,
        type: 'default',
        position: { x: 50, y: yOffset },
        data: { 
          label: (
            <div style={{
              padding: '12px 24px',
              backgroundColor: '#f0f0f0',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '16px',
              color: '#333'
            }}>
              📁 {category} ({categoryAgents.length})
            </div>
          )
        },
        draggable: false
      });
      
      yOffset += 80;
      
      // Add agents in this category
      categoryAgents.forEach((agent, index) => {
        const xPosition = 100 + (index % 4) * (NODE_DIMENSIONS.AGENT_WIDTH + NODE_DIMENSIONS.SPACING_X);
        const yPosition = yOffset + Math.floor(index / 4) * (NODE_DIMENSIONS.AGENT_HEIGHT + 40);
        
        flowNodes.push({
          id: agent.agentId,
          type: 'agent',
          position: { x: xPosition, y: yPosition },
          data: { 
            agent,
            planningMode
          },
          draggable: planningMode
        });
      });
      
      yOffset += Math.ceil(categoryAgents.length / 4) * (NODE_DIMENSIONS.AGENT_HEIGHT + 40) + 60;
    });
    
    return { nodes: flowNodes, edges: flowEdges };
  }, [agents, planningMode]);

  /**
   * Organizational mode layout - hierarchical department structure
   */
  const calculateOrganizationalLayout = useCallback(() => {
    const flowNodes: Node[] = [];
    const flowEdges: Edge[] = [];
    
    // Create department hierarchy map
    const departmentMap = new Map(departments.map(dept => [dept.id, dept]));
    const agentsByDepartment = agents.reduce((acc, agent) => {
      const deptId = agent.department?.id || 'unassigned';
      if (!acc[deptId]) acc[deptId] = [];
      acc[deptId].push(agent);
      return acc;
    }, {} as Record<string, AgentMetadata[]>);

    // Calculate department levels
    const departmentLevels = new Map<string, number>();
    const calculateLevel = (deptId: string, visited = new Set<string>()): number => {
      if (visited.has(deptId)) return 0; // Circular reference protection
      if (departmentLevels.has(deptId)) return departmentLevels.get(deptId)!;
      
      const dept = departmentMap.get(deptId);
      if (!dept || !dept.parentDepartmentId) {
        departmentLevels.set(deptId, 0);
        return 0;
      }
      
      visited.add(deptId);
      const level = calculateLevel(dept.parentDepartmentId, visited) + 1;
      departmentLevels.set(deptId, level);
      return level;
    };

    departments.forEach(dept => calculateLevel(dept.id));

    // Group departments by level
    const departmentsByLevel = new Map<number, Department[]>();
    departments.forEach(dept => {
      const level = departmentLevels.get(dept.id) || 0;
      if (!departmentsByLevel.has(level)) {
        departmentsByLevel.set(level, []);
      }
      departmentsByLevel.get(level)!.push(dept);
    });

    // Position departments
    let maxLevel = Math.max(...Array.from(departmentLevels.values()));
    
    for (let level = 0; level <= maxLevel; level++) {
      const depts = departmentsByLevel.get(level) || [];
      const levelWidth = Math.max(dimensions.width, depts.length * (NODE_DIMENSIONS.DEPARTMENT_WIDTH + NODE_DIMENSIONS.SPACING_X));
      
      depts.forEach((dept, index) => {
        const xPosition = (levelWidth / (depts.length + 1)) * (index + 1) - NODE_DIMENSIONS.DEPARTMENT_WIDTH / 2;
        const yPosition = level * NODE_DIMENSIONS.LEVEL_HEIGHT + 50;
        
        // Get head of department name
        const headAgent = dept.headOfDepartment ? 
          agents.find(a => a.agentId === dept.headOfDepartment) : null;
        
        // Create department node
        flowNodes.push({
          id: dept.id,
          type: 'department',
          position: { x: xPosition, y: yPosition },
          data: { 
            department: dept,
            agentCount: agentsByDepartment[dept.id]?.length || 0,
            headName: headAgent?.name,
            planningMode,
            onEdit: (deptId: string) => {
              // Handle department edit
              console.log('Edit department:', deptId);
            }
          },
          draggable: planningMode
        });

        // Add department agents
        const deptAgents = agentsByDepartment[dept.id] || [];
        deptAgents.forEach((agent, agentIndex) => {
          const agentX = xPosition + 20 + (agentIndex % 2) * (NODE_DIMENSIONS.AGENT_WIDTH / 2 + 10);
          const agentY = yPosition + NODE_DIMENSIONS.DEPARTMENT_HEIGHT + 20 + 
                        Math.floor(agentIndex / 2) * (NODE_DIMENSIONS.AGENT_HEIGHT + 10);
          
          flowNodes.push({
            id: agent.agentId,
            type: 'agent',
            position: { x: agentX, y: agentY },
            data: { 
              agent,
              planningMode
            },
            draggable: planningMode,
            parentNode: dept.id,
            extent: 'parent'
          });

          // Create edge from department to agent
          flowEdges.push({
            id: `dept-${dept.id}-agent-${agent.agentId}`,
            source: dept.id,
            target: agent.agentId,
            type: 'straight',
            style: { stroke: '#ddd', strokeWidth: 1 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#ddd' }
          });
        });

        // Create edge from parent department
        if (dept.parentDepartmentId) {
          flowEdges.push({
            id: `dept-${dept.parentDepartmentId}-${dept.id}`,
            source: dept.parentDepartmentId,
            target: dept.id,
            type: 'smoothstep',
            style: { stroke: '#666', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#666' }
          });
        }
      });
    }

    // Add reporting relationships between agents
    agents.forEach(agent => {
      if (agent.reportingTo) {
        const manager = agents.find(a => a.agentId === agent.reportingTo);
        if (manager) {
          flowEdges.push({
            id: `reporting-${agent.agentId}-${manager.agentId}`,
            source: manager.agentId,
            target: agent.agentId,
            type: 'smoothstep',
            style: { stroke: '#4CAF50', strokeWidth: 1, strokeDasharray: '5,5' },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#4CAF50' },
            label: 'Reports to'
          });
        }
      }
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [departments, agents, dimensions, planningMode]);

  // Initialize graph when data changes
  useEffect(() => {
    const { nodes: flowNodes, edges: flowEdges } = calculateLayout();
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [calculateLayout]);

  // Handle node changes (drag, etc.)
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    if (planningMode) {
      changes.forEach(change => {
        if (change.type === 'position' && change.position && onNodeMove) {
          onNodeMove(change.id, change.position);
          
          // Track pending changes
          const newChange: OrgChartChange = {
            type: 'agent_move',
            agentId: change.id,
            newPosition: change.position
          };
          setPendingChanges(prev => [...prev.filter(c => c.agentId !== change.id), newChange]);
        }
      });
    }
    onNodesChange(changes);
  }, [planningMode, onNodeMove, onNodesChange]);

  // Handle connection creation (for planning mode)
  const onConnect = useCallback((params: Connection) => {
    if (planningMode && onAgentReassign) {
      // Handle agent reassignment via connection
      onAgentReassign(params.source!, params.target!);
    }
    setEdges((eds) => addEdge(params, eds));
  }, [planningMode, onAgentReassign, setEdges]);

  // Notify about pending changes
  useEffect(() => {
    if (onPreviewChanges && pendingChanges.length > 0) {
      onPreviewChanges(pendingChanges);
    }
  }, [pendingChanges, onPreviewChanges]);

  // Filter controls for organizational mode
  const departmentFilter = useMemo(() => {
    if (!platformConfig.isOrganizationalMode()) return null;
    
    const uniqueDepartments = departments.map(dept => ({
      id: dept.id,
      name: dept.name,
      agentCount: agents.filter(a => a.department?.id === dept.id).length
    }));

    return (
      <div className="mb-3">
        <div className="filter-title" style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>
          Filter by Department
        </div>
        <div className="filter-options" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          <button
            className={`filter-chip ${selectedDepartment === null ? 'active' : ''}`}
            style={{
              padding: '4px 8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              background: selectedDepartment === null ? '#e3f2fd' : 'white',
              fontSize: '11px',
              cursor: 'pointer'
            }}
            onClick={() => setSelectedDepartment(null)}
          >
            All Departments
          </button>
          {uniqueDepartments.map(dept => (
            <button
              key={dept.id}
              className={`filter-chip ${selectedDepartment === dept.id ? 'active' : ''}`}
              style={{
                padding: '4px 8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                background: selectedDepartment === dept.id ? '#e3f2fd' : 'white',
                fontSize: '11px',
                cursor: 'pointer'
              }}
              onClick={() => setSelectedDepartment(dept.id === selectedDepartment ? null : dept.id)}
            >
              {dept.name} ({dept.agentCount})
            </button>
          ))}
        </div>
      </div>
    );
  }, [departments, agents, selectedDepartment, platformConfig]);

  return (
    <div 
      ref={containerRef}
      className="org-chart-renderer"
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      <style jsx>{`
        .org-chart-renderer .react-flow__node {
          cursor: ${planningMode ? 'grab' : 'default'};
        }
        
        .org-chart-renderer .react-flow__node:active {
          cursor: ${planningMode ? 'grabbing' : 'default'};
        }
        
        .filter-panel {
          background: white;
          padding: 12px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          max-width: 300px;
        }
        
        .filter-title {
          font-size: 12px;
          font-weight: bold;
          margin-bottom: 8px;
          color: #333;
        }
        
        .planning-mode-indicator {
          position: absolute;
          top: 16px;
          right: 16px;
          background: #ff9800;
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: bold;
          z-index: 1000;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        
        .pending-changes {
          position: absolute;
          bottom: 80px;
          right: 16px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 12px;
          max-width: 250px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          z-index: 1000;
        }
      `}</style>
      
      {planningMode && (
        <div className="planning-mode-indicator">
          ✏️ Planning Mode Active
        </div>
      )}
      
      {planningMode && pendingChanges.length > 0 && (
        <div className="pending-changes">
          <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '12px' }}>
            Pending Changes ({pendingChanges.length})
          </div>
          <div style={{ fontSize: '11px', color: '#666' }}>
            {pendingChanges.length} modification{pendingChanges.length !== 1 ? 's' : ''} ready to apply
          </div>
        </div>
      )}
      
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          nodesDraggable={interactive && planningMode}
          nodesConnectable={interactive && planningMode}
          elementsSelectable={interactive}
        >
          <Controls position="bottom-right" />
          <MiniMap 
            nodeColor={(node) => {
              if (node.type === 'department') {
                return getDepartmentTheme(node.data?.department?.name || '').color;
              }
              return '#4CAF50';
            }}
            maskColor="rgba(255, 255, 255, 0.7)"
            position="bottom-left"
          />
          <Background color="#f5f5f5" gap={20} />
          
          <Panel position="top-left" className="filter-panel">
            {departmentFilter}
            
            <div style={{ fontSize: '11px', color: '#666', marginTop: '12px' }}>
              <div>📊 {departments.length} departments</div>
              <div>👥 {agents.length} agents</div>
              {platformConfig.isOrganizationalMode() && (
                <div>🏗️ {Math.max(...Array.from(new Set(departments.map(d => {
                  let level = 0;
                  let current = d;
                  const visited = new Set();
                  while (current.parentDepartmentId && !visited.has(current.id)) {
                    visited.add(current.id);
                    current = departments.find(dept => dept.id === current.parentDepartmentId) || current;
                    level++;
                    if (level > 10) break; // Safety check
                  }
                  return level;
                })))) + 1} levels</div>
              )}
              {planningMode && (
                <div style={{ marginTop: '8px', padding: '4px', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
                  💡 Drag nodes to reorganize
                </div>
              )}
            </div>
          </Panel>
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
};

export default OrgChartRenderer; 