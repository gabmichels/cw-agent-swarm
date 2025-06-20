import React, { useEffect, useState, useMemo, useRef } from 'react';
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
  Panel
} from 'reactflow';
import 'reactflow/dist/style.css';
import { ThinkingVisualization } from '../services/thinking/visualization/types';

interface VisualizationRendererProps {
  visualization: ThinkingVisualization;
  width?: number;
  height?: number;
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 120;

// Define type interfaces for our configuration objects
interface NodeTypeConfig {
  color: string;
  icon: string;
  label: string;
}

interface EdgeTypeConfig {
  color: string;
  style: string;
  label: string;
}

interface NodeStatusConfig {
  color: string;
  icon: string;
  pulse: boolean;
  label: string;
}

// Define configuration objects with proper index signatures
const NODE_TYPE_CONFIG: { [key: string]: NodeTypeConfig } = {
  // Core types
  'start': { color: '#4CAF50', icon: '▶️', label: 'Start' },
  'end': { color: '#F44336', icon: '⏹️', label: 'End' },
  'thinking': { color: '#2196F3', icon: '🧠', label: 'Thinking' },
  'tool_selection': { color: '#FFC107', icon: '🔍', label: 'Tool Selection' },
  'tool_execution': { color: '#FF9800', icon: '⚒️', label: 'Tool Execution' },
  'context_retrieval': { color: '#9C27B0', icon: '📚', label: 'Context Retrieval' },
  'response_generation': { color: '#00BCD4', icon: '💬', label: 'Response' },
  'error': { color: '#F44336', icon: '❌', label: 'Error' },
  'delegation_decision': { color: '#795548', icon: '🔄', label: 'Delegation' },
  'reflection': { color: '#3F51B5', icon: '🔮', label: 'Reflection' },
  'planning': { color: '#009688', icon: '📋', label: 'Planning' },
  'insight': { color: '#E91E63', icon: '💡', label: 'Insight' },
  'decision': { color: '#673AB7', icon: '🧩', label: 'Decision' },
  'memory_retrieval': { color: '#8D6E63', icon: '🧠', label: 'Memory Retrieval' },
  
  // Self-correction types
  'self_correction': { color: '#D32F2F', icon: '🔧', label: 'Self-Correction' },
  'correction_insight': { color: '#C2185B', icon: '💡', label: 'Correction Insight' },
  'correction_check': { color: '#7B1FA2', icon: '🔍', label: 'Correction Check' },
  'correction_suggestion': { color: '#512DA8', icon: '💭', label: 'Suggestion' },
  'correction_application': { color: '#303F9F', icon: '✅', label: 'Applied Correction' },
  
  // Memory consolidation types
  'memory_consolidation': { color: '#0288D1', icon: '🔄', label: 'Memory Consolidation' },
  'memory_group_consolidation': { color: '#0097A7', icon: '📑', label: 'Group Consolidation' },
  'memory_forget': { color: '#00796B', icon: '🗑️', label: 'Memory Forget' },
  'consolidation_summary': { color: '#388E3C', icon: '📊', label: 'Consolidation Summary' },
  
  // Default for any other types
  'default': { color: '#9E9E9E', icon: '📄', label: 'Node' }
};

// Define edge type styling
const EDGE_TYPE_CONFIG: { [key: string]: EdgeTypeConfig } = {
  'flow': { color: '#555', style: 'default', label: 'Flow' },
  'dependency': { color: '#0277BD', style: 'step', label: 'Depends On' },
  'error': { color: '#D32F2F', style: 'straight', label: 'Error' },
  'influence': { color: '#7B1FA2', style: 'smoothstep', label: 'Influences' },
  'cause': { color: '#F57F17', style: 'default', label: 'Causes' },
  'next': { color: '#2E7D32', style: 'default', label: 'Next' },
  'child': { color: '#795548', style: 'smoothstep', label: 'Child' },
  'triggered_correction': { color: '#D81B60', style: 'default', label: 'Triggers Correction' },
  'generated_insight': { color: '#FFA000', style: 'default', label: 'Generates Insight' },
  'initiated_check': { color: '#6A1B9A', style: 'default', label: 'Initiates Check' },
  'suggested_adjustment': { color: '#283593', style: 'step', label: 'Suggests' },
  'applying_correction': { color: '#1565C0', style: 'default', label: 'Applies' },
  'initiated_consolidation': { color: '#00695C', style: 'default', label: 'Initiates' },
  'consolidates_category': { color: '#2E7D32', style: 'smoothstep', label: 'Consolidates' },
  'forgets_sources': { color: '#BF360C', style: 'step', label: 'Forgets' },
  'summarizes': { color: '#4527A0', style: 'default', label: 'Summarizes' },
  'default': { color: '#888', style: 'default', label: '' }
};

// Status indicators with animations
const NODE_STATUS_CONFIG: { [key: string]: NodeStatusConfig } = {
  'completed': { color: '#4CAF50', icon: '✓', pulse: false, label: 'Complete' },
  'in_progress': { color: '#FFC107', icon: '⟳', pulse: true, label: 'In Progress' },
  'error': { color: '#F44336', icon: '⚠', pulse: false, label: 'Error' },
  'pending': { color: '#9E9E9E', icon: '⏱', pulse: false, label: 'Pending' }
};

const VisualizationRenderer: React.FC<VisualizationRendererProps> = ({ 
  visualization, 
  width = 800, 
  height = 600 
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width, height });
  const [filterEdgeType, setFilterEdgeType] = useState<string | null>(null);
  const [filterNodeType, setFilterNodeType] = useState<string | null>(null);
  
  // Update dimensions based on container size
  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          setDimensions({ 
            width: Math.max(width, 400), 
            height: Math.max(height, 300) 
          });
        }
      });
      
      resizeObserver.observe(containerRef.current);
      
      // Initial measurement
      setDimensions({
        width: Math.max(containerRef.current.offsetWidth, 400),
        height: Math.max(containerRef.current.offsetHeight, 300)
      });
      
      return () => {
        resizeObserver.disconnect();
      };
    }
  }, []);
  
  const getNodeColorByType = (type: string): string => {
    return (NODE_TYPE_CONFIG[type] || NODE_TYPE_CONFIG['default']).color;
  };

  const getNodeIconByType = (type: string): string => {
    return (NODE_TYPE_CONFIG[type] || NODE_TYPE_CONFIG['default']).icon;
  };

  const getNodeStatusColor = (status: string): string => {
    return (NODE_STATUS_CONFIG[status] || NODE_STATUS_CONFIG['pending']).color;
  };

  const getNodeStatusIcon = (status: string): string => {
    return (NODE_STATUS_CONFIG[status] || NODE_STATUS_CONFIG['pending']).icon;
  };

  const getEdgeConfig = (type: string) => {
    return EDGE_TYPE_CONFIG[type] || EDGE_TYPE_CONFIG['default'];
  };
  
  // Custom node renderer with enhanced styling
  const customNodeStyle = (type: string, status: string) => ({
    padding: '10px',
    borderRadius: '8px',
    border: `2px solid ${getNodeColorByType(type)}`,
    borderTop: `8px solid ${getNodeColorByType(type)}`,
    backgroundColor: '#ffffff',
    boxShadow: status === 'in_progress' 
      ? `0 0 8px ${getNodeStatusColor(status)}` 
      : '0 2px 4px rgba(0, 0, 0, 0.1)',
    width: NODE_WIDTH,
    transition: 'all 0.3s ease',
    opacity: filterNodeType && type !== filterNodeType ? 0.4 : 1,
  });
  
  // Function to convert visualization data to ReactFlow format
  const initializeGraph = (visualization: ThinkingVisualization) => {
    if (!visualization || !visualization.nodes) return;
    
    // Calculate node positions in a top-down tree layout
    const levelMap = new Map<string, number>();
    const nodeMap = new Map<string, any>();
    
    // First pass: determine node levels
    visualization.nodes.forEach((node, index) => {
      if (index === 0) {
        levelMap.set(node.id, 0);
      }
      nodeMap.set(node.id, node);
    });
    
    // Second pass: propagate levels through edges
    visualization.edges.forEach(edge => {
      const sourceLevel = levelMap.get(edge.source);
      if (sourceLevel !== undefined) {
        const currentLevel = levelMap.get(edge.target) || Infinity;
        levelMap.set(edge.target, Math.min(sourceLevel + 1, currentLevel));
      }
    });
    
    // Group nodes by level
    const nodesByLevel = new Map<number, string[]>();
    
    levelMap.forEach((level, nodeId) => {
      if (!nodesByLevel.has(level)) {
        nodesByLevel.set(level, []);
      }
      nodesByLevel.get(level)!.push(nodeId);
    });
    
    // Calculate positions
    const levelHeight = NODE_HEIGHT * 1.8; // Increase spacing
    const flowNodes: Node[] = [];
    
    levelMap.forEach((level, nodeId) => {
      const node = nodeMap.get(nodeId);
      if (!node) return;
      
      const nodesInLevel = nodesByLevel.get(level) || [];
      const levelWidth = Math.max(dimensions.width, nodesInLevel.length * NODE_WIDTH * 1.5);
      const nodeIndex = nodesInLevel.indexOf(nodeId);
      const xPosition = (levelWidth / (nodesInLevel.length + 1)) * (nodeIndex + 1);
      const yPosition = level * levelHeight;
      
      // Create ReactFlow node with enhanced styling
      flowNodes.push({
        id: node.id,
        type: 'default',
        position: { x: xPosition, y: yPosition },
        data: { 
          label: (
            <div className="node-content">
              <div className="flex justify-between items-start">
                <div className="node-type">
                  <span className="node-icon">{getNodeIconByType(node.type)}</span>
                  <span className="node-type-label">{(NODE_TYPE_CONFIG[node.type] || NODE_TYPE_CONFIG['default']).label}</span>
                </div>
                <div 
                  className={`status-indicator ${node.status === 'in_progress' ? 'pulse' : ''}`}
                  title={NODE_STATUS_CONFIG[node.status]?.label || 'Unknown'}
                >
                  {getNodeStatusIcon(node.status)}
                </div>
              </div>
              <div className="node-label">{node.label}</div>
              {renderNodeContent(node)}
              {node.metrics?.duration && (
                <div className="node-metrics">
                  ⏱️ {node.metrics.duration}ms
                </div>
              )}
            </div>
          )
        },
        style: customNodeStyle(node.type, node.status),
      });
    });
    
    // Create ReactFlow edges with better styling
    const flowEdges: Edge[] = visualization.edges.map(edge => {
      const edgeConfig = getEdgeConfig(edge.type);
      
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label || edgeConfig.label,
        type: edgeConfig.style,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 15,
          height: 15,
          color: edgeConfig.color,
        },
        style: { 
          stroke: edgeConfig.color,
          opacity: filterEdgeType && edge.type !== filterEdgeType ? 0.2 : 1,
          strokeWidth: 2,
          transition: 'all 0.3s ease'
        },
        animated: ['dependency', 'influence', 'initiated_consolidation', 'triggered_correction'].includes(edge.type),
      };
    });
    
    setNodes(flowNodes);
    setEdges(flowEdges);
  };
  
  // Render specific content based on node type
  const renderNodeContent = (node: any) => {
    switch (node.type) {
      case 'thinking':
        return (
          <div className="node-details thinking">
            {node.data.content?.substring(0, 50)}
            {node.data.content?.length > 50 && '...'}
          </div>
        );
      case 'tool_execution':
        return (
          <div className="node-details tool">
            <div key="tool-name"><strong>Tool:</strong> {node.data.toolName}</div>
            {node.data.result && <div key="tool-result"><strong>Result:</strong> Available</div>}
          </div>
        );
      case 'error':
        return (
          <div className="node-details error">
            {node.data.error?.substring(0, 50)}
            {node.data.error?.length > 50 && '...'}
          </div>
        );
      case 'self_correction':
        return (
          <div className="node-details correction">
            <div key="correction-category"><strong>Category:</strong> {node.data.category || 'General'}</div>
            {node.data.correctionText && (
              <div key="correction-text" className="text-truncate">
                {node.data.correctionText.substring(0, 40)}
                {node.data.correctionText.length > 40 && '...'}
              </div>
            )}
          </div>
        );
      case 'memory_consolidation':
      case 'memory_group_consolidation':
        return (
          <div className="node-details memory">
            {node.data.memoryCount && <div key="memory-count"><strong>Memories:</strong> {node.data.memoryCount}</div>}
            {node.data.category && <div key="memory-category"><strong>Category:</strong> {node.data.category}</div>}
          </div>
        );
      default:
        return null;
    }
  };
  
  // Get unique edge types for filtering
  const uniqueEdgeTypes = useMemo(() => {
    if (!visualization?.edges) return [];
    const types = Array.from(new Set(visualization.edges.map(e => e.type)));
    return types.map(type => ({
      type,
      label: EDGE_TYPE_CONFIG[type]?.label || type,
      color: EDGE_TYPE_CONFIG[type]?.color || '#888'
    }));
  }, [visualization?.edges]);

  // Get unique node types for filtering
  const uniqueNodeTypes = useMemo(() => {
    if (!visualization?.nodes) return [];
    const types = Array.from(new Set(visualization.nodes.map(n => n.type)));
    return types.map(type => ({
      type,
      label: NODE_TYPE_CONFIG[type]?.label || type,
      color: NODE_TYPE_CONFIG[type]?.color || '#9E9E9E'
    }));
  }, [visualization?.nodes]);
  
  // Initialize graph when visualization changes or when dimensions change
  useEffect(() => {
    initializeGraph(visualization);
  }, [visualization, dimensions, filterEdgeType, filterNodeType]);
  
  const nodeTypes = useMemo(() => ({}), []);

  return (
    <div ref={containerRef} className="visualization-renderer w-full h-full relative">
      <style jsx global>{`
        .node-content {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        }
        .node-type {
          display: flex;
          align-items: center;
          font-size: 0.7rem;
          color: #666;
          margin-bottom: 4px;
        }
        .node-icon {
          margin-right: 4px;
          font-size: 0.9rem;
        }
        .node-type-label {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .node-label {
          font-weight: 600;
          font-size: 0.8rem;
          margin-bottom: 6px;
          color: #333;
        }
        .node-details {
          font-size: 0.75rem;
          overflow: hidden;
          text-overflow: ellipsis;
          max-height: 40px;
          color: #555;
          background: #f5f5f5;
          padding: 4px;
          border-radius: 4px;
        }
        .node-details.error {
          color: #D32F2F;
          background: #FFEBEE;
        }
        .node-details.thinking {
          color: #1565C0;
          background: #E3F2FD;
        }
        .node-details.tool {
          color: #EF6C00;
          background: #FFF3E0;
        }
        .node-details.correction {
          color: #C2185B;
          background: #FCE4EC;
        }
        .node-details.memory {
          color: #00796B;
          background: #E0F2F1;
        }
        .node-metrics {
          font-size: 0.7rem;
          color: #666;
          margin-top: 4px;
          text-align: right;
        }
        .status-indicator {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          font-size: 0.8rem;
          line-height: 1;
        }
        .pulse {
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0% {
            transform: scale(0.95);
            opacity: 0.8;
          }
          70% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(0.95);
            opacity: 0.8;
          }
        }
        .filter-panel {
          font-size: 0.85rem;
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.1);
          padding: 8px;
        }
        .filter-title {
          font-weight: 600;
          margin-bottom: 6px;
        }
        .filter-options {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          max-width: 300px;
        }
        .filter-chip {
          font-size: 0.7rem;
          padding: 2px 8px;
          border-radius: 20px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          border: 1px solid #eee;
          white-space: nowrap;
        }
        .filter-chip:hover {
          opacity: 0.8;
        }
        .filter-chip.active {
          font-weight: 600;
        }
        .filter-chip-color {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 4px;
        }
        .text-truncate {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
      
      <div className="absolute inset-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
        >
          <Controls position="bottom-right" />
          <MiniMap 
            nodeColor={(node) => getNodeColorByType(node.data?.label?.props?.children[0]?.props?.children[0]?.props?.children[1]?.props?.children || 'default')}
            maskColor="rgba(255, 255, 255, 0.7)"
          />
          <Background />
          
          <Panel position="top-left" className="filter-panel">
            {uniqueNodeTypes.length > 0 && (
              <div className="mb-3">
                <div className="filter-title">Filter by Node Type</div>
                <div className="filter-options">
                  <div 
                    className={`filter-chip ${filterNodeType === null ? 'active' : ''}`}
                    style={{ backgroundColor: filterNodeType === null ? '#f0f0f0' : 'white' }}
                    onClick={() => setFilterNodeType(null)}
                  >
                    All Types
                  </div>
                  {uniqueNodeTypes.map(({ type, label, color }) => (
                    <div 
                      key={`node-${type}`}
                      className={`filter-chip ${filterNodeType === type ? 'active' : ''}`}
                      style={{ backgroundColor: filterNodeType === type ? '#f0f0f0' : 'white' }}
                      onClick={() => setFilterNodeType(type === filterNodeType ? null : type)}
                    >
                      <div className="filter-chip-color" style={{ backgroundColor: color }}></div>
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {uniqueEdgeTypes.length > 0 && (
              <div>
                <div className="filter-title">Filter by Relationship</div>
                <div className="filter-options">
                  <div 
                    className={`filter-chip ${filterEdgeType === null ? 'active' : ''}`}
                    style={{ backgroundColor: filterEdgeType === null ? '#f0f0f0' : 'white' }}
                    onClick={() => setFilterEdgeType(null)}
                  >
                    All Relationships
                  </div>
                  {uniqueEdgeTypes.map(({ type, label, color }) => (
                    <div 
                      key={`edge-${type}`}
                      className={`filter-chip ${filterEdgeType === type ? 'active' : ''}`}
                      style={{ backgroundColor: filterEdgeType === type ? '#f0f0f0' : 'white' }}
                      onClick={() => setFilterEdgeType(type === filterEdgeType ? null : type)}
                    >
                      <div className="filter-chip-color" style={{ backgroundColor: color }}></div>
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
};

export default VisualizationRenderer; 