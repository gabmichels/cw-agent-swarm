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
  MarkerType,
  Handle,
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import useMemoryGraph, { GraphNode, GraphEdge, NodeType, EdgeType } from '../../hooks/useMemoryGraph';
import { MemoryType } from '../../server/memory/config';

// Custom node component for different node types
const CustomNode = ({ data }: { data: any }) => {
  // Use the color passed from the graph data, or fall back to type-based colors
  const bgColor = data.color || '#6B7280'; // Use provided color or default gray
  
  return (
    <>
      {/* Handles for connecting edges - React Flow requires these */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#555' }}
        isConnectable={true}
      />
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#555' }}
        isConnectable={true}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#555' }}
        isConnectable={true}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#555' }}
        isConnectable={true}
      />
      
      <div style={{ 
        background: bgColor, 
        color: '#fff',
        padding: '12px', 
        borderRadius: '8px',
        minWidth: '160px',
        maxWidth: '280px',
        border: `2px solid ${bgColor}`,
        boxShadow: data.highlighted ? '0 0 15px 3px rgba(255, 255, 0, 0.7)' : '0 4px 8px rgba(0, 0, 0, 0.2)',
        transform: `scale(${data.size || 1})`,
        transition: 'all 0.3s ease',
        fontSize: '13px',
        lineHeight: '1.4'
      }}>
        <div 
          key="label" 
          style={{ 
            fontWeight: 'bold', 
            marginBottom: '4px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {data.label}
        </div>
        {data.type && (
          <div 
            key="type" 
            style={{ 
              fontSize: '11px', 
              opacity: 0.9,
              textTransform: 'capitalize',
              backgroundColor: 'rgba(0,0,0,0.2)',
              padding: '2px 6px',
              borderRadius: '4px',
              display: 'inline-block'
            }}
          >
            {data.type}
          </div>
        )}
      </div>
    </>
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

  // Position nodes in a better layout to prevent overlap
  const getNodePosition = useCallback((index: number, total: number) => {
    // Node dimensions - account for actual node size (minWidth: 160px, maxWidth: 280px)
    const nodeWidth = 280; // Use max width for spacing calculations
    const nodeHeight = 80; // Estimated height with padding
    
    // For very small graphs, use a simple horizontal line
    if (total <= 5) {
      const spacing = nodeWidth + 50; // Node width plus gap
      const startX = -(total - 1) * spacing / 2; // Center the line
      
      return {
        x: 600 + startX + index * spacing,
        y: 400
      };
    }
    
    // For medium graphs, use multiple horizontal rows
    if (total <= 20) {
      const nodesPerRow = Math.min(6, Math.ceil(total / 3)); // Max 6 nodes per row
      const row = Math.floor(index / nodesPerRow);
      const col = index % nodesPerRow;
      const horizontalSpacing = nodeWidth + 60; // Node width plus generous gap
      const verticalSpacing = nodeHeight + 80; // Node height plus generous gap
      
      // Center each row
      const nodesInThisRow = Math.min(nodesPerRow, total - row * nodesPerRow);
      const rowStartX = -(nodesInThisRow - 1) * horizontalSpacing / 2;
      
      return {
        x: 600 + rowStartX + col * horizontalSpacing,
        y: 300 + row * verticalSpacing
      };
    }
    
    // For larger graphs, use a wide grid with maximum spacing
    const maxNodesPerRow = 8; // Limit nodes per row to prevent overcrowding
    const row = Math.floor(index / maxNodesPerRow);
    const col = index % maxNodesPerRow;
    const horizontalSpacing = nodeWidth + 80; // Extra generous horizontal spacing
    const verticalSpacing = nodeHeight + 100; // Extra generous vertical spacing
    
    // Center each row based on how many nodes are in it
    const totalRows = Math.ceil(total / maxNodesPerRow);
    const nodesInThisRow = Math.min(maxNodesPerRow, total - row * maxNodesPerRow);
    const rowStartX = -(nodesInThisRow - 1) * horizontalSpacing / 2;
    const gridStartY = -(totalRows - 1) * verticalSpacing / 2;
    
    return {
      x: 600 + rowStartX + col * horizontalSpacing,
      y: 400 + gridStartY + row * verticalSpacing
    };
  }, []);

  // Memoize the conversion of graph data to ReactFlow format to prevent infinite loops
  const { flowNodes, flowEdges } = useMemo(() => {
    // Create a unique session ID to ensure stable IDs within this component instance
    const sessionId = Date.now().toString(36);
    
    const flowNodes: Node[] = graphData.nodes.map((node, index) => ({
      id: `node-${sessionId}-${node.id}`, // Use original node ID with session prefix
      type: 'custom',
      position: getNodePosition(index, graphData.nodes.length),
      data: {
        label: node.label,
        originalId: node.id,
        originalData: node,
        color: node.color,
        type: node.type
      },
      style: {
        backgroundColor: node.color,
        color: '#FFFFFF',
        border: `2px solid ${node.color}`,
        borderRadius: '8px',
        padding: '8px',
        fontSize: '12px',
        fontWeight: '500'
      }
    }));
    
    // Create a map for quick lookup of flow node IDs by original IDs
    const nodeIdMap = new Map(
      flowNodes.map(flowNode => [flowNode.data.originalId, flowNode.id])
    );
    
    console.log('Node ID mapping:', Object.fromEntries(nodeIdMap));
    console.log('Graph edges to convert:', graphData.edges.map(e => ({ source: e.source, target: e.target })));
    
    const flowEdges: Edge[] = graphData.edges
      .map((edge, index) => {
        const sourceFlowId = nodeIdMap.get(edge.source);
        const targetFlowId = nodeIdMap.get(edge.target);
        
        // Debug logging for every edge
        console.log(`Edge ${index}: ${edge.source} -> ${edge.target}`, {
          sourceFlowId,
          targetFlowId,
          sourceExists: nodeIdMap.has(edge.source),
          targetExists: nodeIdMap.has(edge.target)
        });
        
        // Only create edge if both source and target nodes exist in the flow
        if (sourceFlowId && targetFlowId) {
          const flowEdge = {
            id: `edge-${sessionId}-${edge.source}-${edge.target}-${index}`,
            source: sourceFlowId,
            target: targetFlowId,
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
          };
          console.log('Created valid flow edge:', flowEdge);
          return flowEdge;
        } else {
          console.error('Failed to create edge - missing nodes:', {
            edgeSource: edge.source,
            edgeTarget: edge.target,
            sourceFlowId,
            targetFlowId,
            availableNodes: Array.from(nodeIdMap.keys())
          });
        }
        return null;
      })
      .filter(edge => edge !== null) as Edge[];
      
    console.log(`Created ${flowNodes.length} nodes and ${flowEdges.length} edges for ReactFlow`);
    
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
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
      >
        <Background color="#4a5568" gap={16} />
        <Controls />
        <MiniMap 
          nodeColor={(node) => {
            // Use the actual color from the node data
            return node.data?.color || '#6B7280';
          }}
          maskColor="rgba(0, 0, 0, 0.2)"
        />
      </ReactFlow>
    </div>
  );
};

export default MemoryGraphVisualization; 