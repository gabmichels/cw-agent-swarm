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
  ReactFlowProvider,
  ConnectionLineType,
  Handle
} from 'reactflow';
import dagre from '@dagrejs/dagre';
import 'reactflow/dist/style.css';
import { Department, OrgHierarchyNode } from '../../types/organization';
import { AgentMetadata, AgentStatus } from '../../types/metadata';
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
 * Node dimensions and spacing constants for Dagre layout
 */
const NODE_DIMENSIONS = {
  DEPARTMENT_WIDTH: 300,
  DEPARTMENT_HEIGHT: 200,
  SUBDEPARTMENT_WIDTH: 250,
  SUBDEPARTMENT_HEIGHT: 150,
  TEAM_WIDTH: 200,
  TEAM_HEIGHT: 120,
  AGENT_WIDTH: 180,
  AGENT_HEIGHT: 200,
  SPACING: 80
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
  [AgentStatus.AVAILABLE]: { color: '#4CAF50', icon: '●', label: 'Available' },
  [AgentStatus.BUSY]: { color: '#FF9800', icon: '●', label: 'Busy' },
  [AgentStatus.OFFLINE]: { color: '#9E9E9E', icon: '●', label: 'Offline' },
  [AgentStatus.MAINTENANCE]: { color: '#F44336', icon: '●', label: 'Maintenance' }
} as const;

// Dagre instances are created fresh for each layout calculation

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
 * Get node dimensions based on type
 */
const getNodeDimensions = (nodeType: string) => {
  switch (nodeType) {
    case 'department':
      return { width: NODE_DIMENSIONS.DEPARTMENT_WIDTH, height: NODE_DIMENSIONS.DEPARTMENT_HEIGHT };
    case 'subdepartment':
      return { width: NODE_DIMENSIONS.SUBDEPARTMENT_WIDTH, height: NODE_DIMENSIONS.SUBDEPARTMENT_HEIGHT };
    case 'team':
      return { width: NODE_DIMENSIONS.TEAM_WIDTH, height: NODE_DIMENSIONS.TEAM_HEIGHT };
    case 'agent':
      return { width: NODE_DIMENSIONS.AGENT_WIDTH, height: NODE_DIMENSIONS.AGENT_HEIGHT };
    default:
      return { width: NODE_DIMENSIONS.AGENT_WIDTH, height: NODE_DIMENSIONS.AGENT_HEIGHT };
  }
};

/**
 * Dagre graph configuration - following official example pattern
 */
const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

/**
 * Apply Dagre layout - following official example exactly
 */
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    const { width, height } = getNodeDimensions(node.type || 'agent');
    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const { width, height } = getNodeDimensions(node.type || 'agent');
    const newNode = {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };

    return newNode;
  });

  return { nodes: newNodes, edges };
};

/**
 * Custom Department Node Component
 */
const DepartmentNode: React.FC<{ data: any }> = ({ data }) => {
  const theme = getDepartmentTheme(data.department?.name || data.name || 'Unknown');
  // Count agents from the department data, or use the direct agents array
  const agentCount = data.agents?.length || 0;
  
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
      {/* Handles for connecting edges */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: theme.color }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: theme.color }}
      />
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
            {data.department?.name || data.name}
          </h3>
          {data.department?.description && (
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
          👥 {agentCount} agents
        </div>
        {data.department?.managerId && (
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
            👤 Manager: {data.managerName || 'Unknown'}
          </div>
        )}
        <div style={{ fontSize: '12px', color: '#666' }}>
          💰 Budget: {data.department?.currency || '$'}{data.department?.budgetLimit || 0}
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
            onClick={() => data.onEdit?.(data.department?.id)}
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
  const agent = data.agent;
  const status = agent?.status as AgentStatus || AgentStatus.OFFLINE;
  const statusConfig = AGENT_STATUS_CONFIG[status];
  
  // Use department theme color if available, otherwise use status color
  const departmentTheme = data.departmentTheme || DEPARTMENT_THEMES.default;
  const borderColor = departmentTheme.color;
  const bgColor = departmentTheme.bgColor;
  
  return (
    <div 
      className="agent-node"
      style={{
        width: NODE_DIMENSIONS.AGENT_WIDTH,
        height: NODE_DIMENSIONS.AGENT_HEIGHT,
        backgroundColor: bgColor,
        border: `2px solid ${borderColor}`,
        borderRadius: '6px',
        padding: '8px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}
    >
      {/* Handles for connecting edges */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: borderColor }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: borderColor }}
      />
      <div className="agent-header" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '4px'
      }}>
        <h4 style={{ 
          margin: 0, 
          fontSize: '12px', 
          fontWeight: 'bold',
          color: borderColor,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1
        }}>
          {agent?.name || 'Unknown Agent'}
        </h4>
        <span 
          style={{ 
            color: statusConfig.color, 
            fontSize: '10px',
            fontWeight: 'bold',
            marginLeft: '4px'
          }}
          title={statusConfig.label}
        >
          {statusConfig.icon}
        </span>
      </div>
      
      <div className="agent-details" style={{ flex: 1 }}>
        <div style={{ fontSize: '10px', color: '#666', marginBottom: '1px' }}>
          📋 {agent?.position || 'Agent'}
        </div>
        {agent?.specialization?.length > 0 && (
          <div style={{ fontSize: '9px', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            🎯 {agent.specialization.slice(0, 1).join(', ')}
          </div>
        )}
      </div>
      
      {data.planningMode && (
        <div 
          className="agent-actions"
          style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            display: 'flex',
            gap: '1px'
          }}
        >
          <button 
            style={{
              background: statusConfig.color,
              color: 'white',
              border: 'none',
              borderRadius: '2px',
              padding: '1px 4px',
              fontSize: '8px',
              cursor: 'pointer'
            }}
            onClick={() => data.onReassign?.(agent?.agentId)}
          >
            ↔
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Custom SubDepartment Node Component
 */
const SubDepartmentNode: React.FC<{ data: any }> = ({ data }) => {
  const parentTheme = getDepartmentTheme(data.parentDepartmentName || '');
  
  return (
    <div 
      className="subdepartment-node"
      style={{
        width: NODE_DIMENSIONS.SUBDEPARTMENT_WIDTH,
        height: NODE_DIMENSIONS.SUBDEPARTMENT_HEIGHT,
        backgroundColor: `${parentTheme.bgColor}aa`,
        border: `2px dashed ${parentTheme.color}`,
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
        position: 'relative'
      }}
    >
      <div className="subdepartment-header" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        marginBottom: '8px'
      }}>
        <span style={{ fontSize: '18px', marginRight: '6px' }}>📂</span>
        <h4 style={{ 
          margin: 0, 
          color: parentTheme.color, 
          fontSize: '14px', 
          fontWeight: 'bold' 
        }}>
          {data.name}
        </h4>
      </div>
      
      <div className="subdepartment-stats">
        <div style={{ fontSize: '11px', color: '#666' }}>
          👥 {data.agentCount || 0} agents
        </div>
      </div>
    </div>
  );
};

/**
 * Custom Team Node Component
 */
const TeamNode: React.FC<{ data: any }> = ({ data }) => {
  return (
    <div 
      className="team-node"
      style={{
        width: NODE_DIMENSIONS.TEAM_WIDTH,
        height: NODE_DIMENSIONS.TEAM_HEIGHT,
        backgroundColor: '#f8f9fa',
        border: '2px solid #6c757d',
        borderRadius: '6px',
        padding: '10px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        position: 'relative'
      }}
    >
      <div className="team-header" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        marginBottom: '6px'
      }}>
        <span style={{ fontSize: '16px', marginRight: '4px' }}>👥</span>
        <h5 style={{ 
          margin: 0, 
          color: '#495057', 
          fontSize: '12px', 
          fontWeight: 'bold' 
        }}>
          {data.name}
        </h5>
      </div>
      
      <div className="team-stats">
        <div style={{ fontSize: '10px', color: '#666' }}>
          Members: {data.agentCount || 0}
        </div>
      </div>
    </div>
  );
};

/**
 * Node types for React Flow
 */
const nodeTypes = {
  department: DepartmentNode,
  agent: AgentNode,
  subdepartment: SubDepartmentNode,
  team: TeamNode,
};

/**
 * Main OrgChartRenderer Component with Dagre Layout
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
  const [layoutDirection, setLayoutDirection] = useState<'TB' | 'LR'>('TB');

  /**
   * Build initial nodes and edges, then apply layout - following official example pattern
   */
  const { nodes: initialLayoutedNodes, edges: initialLayoutedEdges } = useMemo(() => {
    console.log('Building nodes and edges from hierarchy:', hierarchy.length);
    
    const flowNodes: Node[] = [];
    const flowEdges: Edge[] = [];

    // Create nodes for each hierarchy item
    hierarchy.forEach((item) => {
      const nodeData = item.nodeData || {};
      
      // For agent nodes, find their department to get the theme
      let departmentTheme = null;
      if (item.nodeType === 'agent' && item.departmentId) {
        const department = departments.find(d => d.id === item.departmentId);
        if (department) {
          departmentTheme = getDepartmentTheme(department.name);
        }
      }
      
      let nodeProps: Node = {
        id: item.id,
        type: item.nodeType,
        position: { x: 0, y: 0 }, // Will be set by Dagre
        data: {
          ...nodeData,
          name: item.name,
          nodeType: item.nodeType,
          planningMode,
          // For department nodes - keep agents data for display
          agents: item.nodeType === 'department' ? (nodeData.agents || []) : undefined,
          // For agent nodes - provide the agent data and department theme
          agent: item.nodeType === 'agent' ? nodeData.agent : undefined,
          departmentTheme: departmentTheme,
          department: nodeData.department,
          onEdit: (id: string) => {
            console.log('Edit node:', id);
          },
          onReassign: (agentId: string) => {
            console.log('Reassign agent:', agentId);
            onAgentReassign?.(agentId, item.departmentId || '');
          }
        },
        draggable: planningMode,
      };

      flowNodes.push(nodeProps);
    });

    // Create edges based on parent-child relationships
    hierarchy.forEach((item) => {
      if (item.parentNodeId) {
        const edge: Edge = {
          id: `${item.parentNodeId}-${item.id}`,
          source: item.parentNodeId,
          target: item.id,
          type: 'default',
          style: { 
            stroke: '#666666', 
            strokeWidth: 2,
            strokeDasharray: '5,5'
          }
        };
        
        flowEdges.push(edge);
        console.log(`Created edge: ${edge.id} (${edge.source} -> ${edge.target})`);
      }
    });



    console.log('Generated nodes:', flowNodes.map(n => ({ id: n.id, type: n.type, name: n.data.name })));
    console.log('Generated edges:', flowEdges.map(e => ({ id: e.id, source: e.source, target: e.target })));
    
    // Verify node-edge connections
    flowEdges.forEach(edge => {
      const sourceExists = flowNodes.some(n => n.id === edge.source);
      const targetExists = flowNodes.some(n => n.id === edge.target);
      console.log(`Edge ${edge.id}: source ${edge.source} exists: ${sourceExists}, target ${edge.target} exists: ${targetExists}`);
      if (!sourceExists) console.error(`SOURCE NODE ${edge.source} NOT FOUND`);
      if (!targetExists) console.error(`TARGET NODE ${edge.target} NOT FOUND`);
    });

    // Apply initial layout immediately
    if (flowNodes.length > 0) {
      return getLayoutedElements(flowNodes, flowEdges, layoutDirection);
    }

    return { nodes: flowNodes, edges: flowEdges };
  }, [hierarchy, departments, planningMode, onAgentReassign, layoutDirection]);

  // Initialize React Flow state with layouted elements
  const [nodes, setNodes, onNodesChange] = useNodesState(initialLayoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialLayoutedEdges);

  /**
   * Handle node drag end
   */
  const handleNodeDragStop = useCallback((event: React.MouseEvent, node: Node) => {
    if (planningMode && onNodeMove) {
      onNodeMove(node.id, node.position);
    }
  }, [planningMode, onNodeMove]);

  /**
   * Handle layout direction change - following official example pattern
   */
  const handleLayoutChange = useCallback((direction: 'TB' | 'LR') => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges,
      direction
    );

    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);
    setLayoutDirection(direction);
  }, [nodes, edges, setNodes, setEdges]);

  /**
   * Handle connection between nodes
   */
  const onConnect = useCallback((params: Connection) => {
    const newEdge = {
      ...params,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#10b981', strokeWidth: 2 },
    };
    setEdges((eds) => addEdge(newEdge, eds));
  }, [setEdges]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          connectionLineType={ConnectionLineType.SmoothStep}
          onNodeDragStop={handleNodeDragStop}
          fitView
          fitViewOptions={{ padding: 0.1, includeHiddenNodes: false }}
          style={{ backgroundColor: '#f8f9fa' }}
          snapToGrid={true}
          snapGrid={[20, 20]}
          minZoom={0.2}
          maxZoom={1.5}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          deleteKeyCode={null}
          selectionKeyCode={null}
        >
          <Background color="#e5e7eb" gap={20} />
          <Controls />
          <MiniMap 
            nodeColor={(node) => {
              switch (node.type) {
                case 'department': return '#e91e63';
                case 'subdepartment': return '#ff9800';
                case 'team': return '#2196f3';
                case 'agent': return '#4caf50';
                default: return '#757575';
              }
            }}
            nodeStrokeWidth={3}
            zoomable
            pannable
          />
          
          {/* Layout Controls */}
          <Panel position="top-right">
            <div style={{ display: 'flex', gap: '8px', background: 'white', padding: '8px', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <button
                onClick={() => handleLayoutChange('TB')}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  borderRadius: '4px',
                  background: layoutDirection === 'TB' ? '#2563eb' : '#e5e7eb',
                  color: layoutDirection === 'TB' ? 'white' : '#374151',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Vertical
              </button>
              <button
                onClick={() => handleLayoutChange('LR')}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  borderRadius: '4px',
                  background: layoutDirection === 'LR' ? '#2563eb' : '#e5e7eb',
                  color: layoutDirection === 'LR' ? 'white' : '#374151',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Horizontal
              </button>
            </div>
          </Panel>

          {/* Stats Panel */}
          <Panel position="bottom-left">
            <div style={{ background: 'white', padding: '12px', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', fontSize: '12px' }}>
              <div><strong>Organization Stats</strong></div>
              <div>📁 Departments: {departments.length}</div>
              <div>🤖 Agents: {agents.length}</div>
              <div>🏗️ Nodes: {nodes.length}</div>
              <div>🔗 Connections: {edges.length}</div>
              {planningMode && <div style={{ color: '#dc3545', fontWeight: 'bold' }}>📝 Planning Mode Active</div>}
            </div>
          </Panel>
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
};

export default OrgChartRenderer; 