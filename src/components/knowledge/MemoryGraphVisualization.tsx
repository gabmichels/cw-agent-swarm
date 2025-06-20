import React, { useCallback, useEffect, useState, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  NodeTypes,
  useNodesState,
  useEdgesState,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import useMemoryGraph, { GraphNode, GraphEdge, NodeType, EdgeType } from '../../hooks/useMemoryGraph';
import { MemoryType } from '../../server/memory/config';

// Custom node component for different node types
const CustomNode = ({ data }: { data: any }) => {
  let bgColor = '#9CA3AF'; // default gray
  
  switch (data.type) {
    case NodeType.MESSAGE:
      bgColor = '#4F46E5'; // Indigo
      break;
    case NodeType.KNOWLEDGE:
      bgColor = '#10B981'; // Emerald
      break;
    case NodeType.THOUGHT:
      bgColor = '#F59E0B'; // Amber
      break;
    case NodeType.DOCUMENT:
      bgColor = '#6366F1'; // Violet
      break;
    case NodeType.TASK:
      bgColor = '#EF4444'; // Red
      break;
    default:
      bgColor = '#9CA3AF'; // Gray
  }
  
  return (
    <div style={{ 
      background: bgColor, 
      color: '#fff',
      padding: '10px', 
      borderRadius: '5px',
      minWidth: '150px',
      maxWidth: '250px',
      boxShadow: data.highlighted ? '0 0 10px 2px rgba(255, 255, 0, 0.7)' : '0 4px 6px rgba(0, 0, 0, 0.1)',
      transform: `scale(${data.size || 1})`,
      transition: 'transform 0.3s ease, box-shadow 0.3s ease'
    }}>
      <div key="label" style={{ fontWeight: 'bold', marginBottom: '5px' }}>{data.label}</div>
      {data.description && <div key="description" style={{ fontSize: '0.85em' }}>{data.description}</div>}
    </div>
  );
};

// Define node types (moved inside component to avoid issues)

interface MemoryGraphVisualizationProps {
  rootId?: string;
  types?: MemoryType[];
  depth?: number;
  limit?: number;
  className?: string;
  onNodeSelect?: (nodeData: any) => void;
  onLoadingChange?: (loading: boolean) => void;
  onDataChange?: (data: { nodes: any[]; edges: any[] }) => void;
}

const MemoryGraphVisualization: React.FC<MemoryGraphVisualizationProps> = ({
  rootId,
  types,
  depth = 2,
  limit = 50,
  className = '',
  onNodeSelect,
  onLoadingChange,
  onDataChange
}) => {
  // Use the memory graph hook
  const { graphData, isLoading, error, refresh } = useMemoryGraph({
    rootId,
    types,
    depth,
    limit
  });
  
  // State for ReactFlow
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Define node types with useMemo to prevent recreating on every render
  const nodeTypes: NodeTypes = useMemo(() => ({
    custom: CustomNode,
  }), []);

  // Position nodes in a radial layout (memoized to prevent recreating the function)
  const getNodePosition = useCallback((index: number, total: number) => {
    // For small graphs, use a simple circular layout
    if (total <= 10) {
      const radius = 200;
      const slice = (2 * Math.PI) / total;
      const angle = slice * index;
      
      return {
        x: 300 + radius * Math.cos(angle),
        y: 300 + radius * Math.sin(angle)
      };
    }
    
    // For larger graphs, use a force-directed inspired layout
    // This is a simplified version - in production you'd use a proper force simulation
    const spiralFactor = 15;
    const angle = 0.8 * index;
    const radius = spiralFactor * Math.sqrt(index);
    
    return {
      x: 300 + radius * Math.cos(angle),
      y: 300 + radius * Math.sin(angle)
    };
  }, []);

  // Memoize the conversion of graph data to ReactFlow format to prevent infinite loops
  const { flowNodes, flowEdges } = useMemo(() => {
    // Create a unique session ID to ensure stable IDs within this component instance
    const sessionId = Date.now().toString(36);
    
    const flowNodes: Node[] = graphData.nodes.map((node, index) => ({
      id: `node-${sessionId}-${node.id}`, // Use original node ID with session prefix
      type: 'default',
      position: getNodePosition(index, graphData.nodes.length),
      data: {
        label: node.label,
        originalId: node.id,
        originalData: node
      }
    }));
    
    // Create a map for quick lookup of flow node IDs by original IDs
    const nodeIdMap = new Map(
      flowNodes.map(flowNode => [flowNode.data.originalId, flowNode.id])
    );
    
    const flowEdges: Edge[] = graphData.edges.map((edge, index) => ({
      id: `edge-${sessionId}-${edge.source}-${edge.target}-${index}`, // Stable ID based on source/target
      source: nodeIdMap.get(edge.source) || edge.source,
      target: nodeIdMap.get(edge.target) || edge.target,
      label: edge.label,
      type: 'smoothstep',
      animated: edge.type === EdgeType.DERIVES_FROM || edge.type === EdgeType.RESPONDS_TO,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 15,
        height: 15
      },
      style: {
        strokeWidth: edge.weight ? Math.max(1, Math.min(5, edge.weight * 3)) : 1
      }
    }));
    
    return { flowNodes, flowEdges };
  }, [graphData, getNodePosition]);

  // Update ReactFlow state when memoized data changes
  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  // Notify parent component of data changes (with useCallback to prevent recreating the function)
  const notifyDataChange = useCallback(() => {
    if (onDataChange) {
      onDataChange({
        nodes: graphData.nodes,
        edges: graphData.edges
      });
    }
  }, [onDataChange, graphData.nodes, graphData.edges]);

  useEffect(() => {
    notifyDataChange();
  }, [notifyDataChange]);

  // Notify parent component of loading state changes (with useCallback to prevent recreating the function)
  const notifyLoadingChange = useCallback(() => {
    if (onLoadingChange) {
      onLoadingChange(isLoading);
    }
  }, [onLoadingChange, isLoading]);

  useEffect(() => {
    notifyLoadingChange();
  }, [notifyLoadingChange]);

  // Handle node click
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.data.originalId || node.id);
    
    if (onNodeSelect) {
      onNodeSelect(node.data.originalData);
    }
  }, [onNodeSelect]);

  // Show loading or error states
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-96 bg-gray-800 rounded-lg ${className}`}>
        <div className="flex flex-col items-center text-gray-300">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <div>Loading memory relationships...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-96 bg-gray-800 rounded-lg ${className}`}>
        <div className="text-red-400 text-center p-6">
          <div className="text-xl mb-2">Error Loading Graph</div>
          <div>{error.message}</div>
          <button 
            className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
            onClick={() => refresh()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (graphData.nodes.length === 0) {
    return (
      <div className={`flex items-center justify-center h-96 bg-gray-800 rounded-lg ${className}`}>
        <div className="text-gray-400 text-center p-6">
          <div className="text-xl mb-2">No Memory Relationships Found</div>
          <div>There are no memory relationships to display for the selected criteria.</div>
          <button 
            className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
            onClick={() => refresh()}
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-96 bg-gray-800 rounded-lg overflow-hidden ${className}`}>
      <ReactFlow
        key={`reactflow-${graphData.nodes.length}-${graphData.edges.length}`}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
      >
        <Background color="#4a5568" gap={16} />
        <Controls />
        <MiniMap 
          nodeColor={(node) => {
            const nodeType = node.data?.type || NodeType.OTHER;
            
            switch (nodeType) {
              case NodeType.MESSAGE: return '#4F46E5'; // Indigo
              case NodeType.KNOWLEDGE: return '#10B981'; // Emerald
              case NodeType.THOUGHT: return '#F59E0B'; // Amber
              case NodeType.DOCUMENT: return '#6366F1'; // Violet
              case NodeType.TASK: return '#EF4444'; // Red
              default: return '#9CA3AF'; // Gray
            }
          }}
          maskColor="rgba(0, 0, 0, 0.2)"
        />
      </ReactFlow>
    </div>
  );
};

export default MemoryGraphVisualization; 