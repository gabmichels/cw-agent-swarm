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
  MarkerType
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

const VisualizationRenderer: React.FC<VisualizationRendererProps> = ({ 
  visualization, 
  width = 800, 
  height = 600 
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width, height });
  
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
    switch (type) {
      case 'start':
        return '#4CAF50'; // Green
      case 'end':
        return '#F44336'; // Red
      case 'thinking':
        return '#2196F3'; // Blue
      case 'tool_selection':
        return '#FFC107'; // Amber
      case 'tool_execution':
        return '#FF9800'; // Orange
      case 'context_retrieval':
        return '#9C27B0'; // Purple
      case 'response_generation':
        return '#00BCD4'; // Cyan
      case 'error':
        return '#F44336'; // Red
      case 'delegation_decision':
        return '#795548'; // Brown
      case 'reflection':
        return '#3F51B5'; // Indigo
      case 'planning':
        return '#009688'; // Teal
      case 'insight':
        return '#E91E63'; // Pink
      case 'decision':
        return '#673AB7'; // Deep Purple
      default:
        return '#9E9E9E'; // Grey
    }
  };

  const getNodeStatusColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return '#4CAF50'; // Green
      case 'in_progress':
        return '#FFC107'; // Amber
      case 'error':
        return '#F44336'; // Red
      case 'pending':
        return '#9E9E9E'; // Grey
      default:
        return '#9E9E9E'; // Grey
    }
  };
  
  // Custom node renderer
  const customNodeStyle = (type: string, status: string) => ({
    padding: '10px',
    borderRadius: '5px',
    borderLeft: `4px solid ${getNodeColorByType(type)}`,
    backgroundColor: '#f8f9fa',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    width: NODE_WIDTH,
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
    const levelHeight = NODE_HEIGHT * 1.5;
    const flowNodes: Node[] = [];
    
    levelMap.forEach((level, nodeId) => {
      const node = nodeMap.get(nodeId);
      if (!node) return;
      
      const nodesInLevel = nodesByLevel.get(level) || [];
      const levelWidth = Math.max(dimensions.width, nodesInLevel.length * NODE_WIDTH * 1.5);
      const nodeIndex = nodesInLevel.indexOf(nodeId);
      const xPosition = (levelWidth / (nodesInLevel.length + 1)) * (nodeIndex + 1);
      const yPosition = level * levelHeight;
      
      // Create ReactFlow node
      flowNodes.push({
        id: node.id,
        type: 'default',
        position: { x: xPosition, y: yPosition },
        data: { 
          label: (
            <div>
              <div className="flex justify-between items-start">
                <div className="text-xs text-gray-500">{node.type}</div>
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getNodeStatusColor(node.status) }}
                />
              </div>
              <div className="font-semibold mb-1 text-sm">{node.label}</div>
              {renderNodeContent(node)}
              {node.metrics?.duration && (
                <div className="text-xs text-gray-500 mt-1">
                  {node.metrics.duration}ms
                </div>
              )}
            </div>
          )
        },
        style: customNodeStyle(node.type, node.status),
      });
    });
    
    // Create ReactFlow edges
    const flowEdges: Edge[] = visualization.edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: 'smoothstep',
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 15,
        height: 15,
      },
      style: { stroke: '#888' },
    }));
    
    setNodes(flowNodes);
    setEdges(flowEdges);
  };
  
  // Render specific content based on node type
  const renderNodeContent = (node: any) => {
    switch (node.type) {
      case 'thinking':
        return (
          <div className="text-xs overflow-hidden text-ellipsis max-h-10">
            {node.data.content?.substring(0, 50)}
            {node.data.content?.length > 50 && '...'}
          </div>
        );
      case 'tool_execution':
        return (
          <div className="text-xs">
            <div><strong>Tool:</strong> {node.data.toolName}</div>
            {node.data.result && <div><strong>Result:</strong> Available</div>}
          </div>
        );
      case 'error':
        return (
          <div className="text-xs text-red-500">
            {node.data.error?.substring(0, 50)}
            {node.data.error?.length > 50 && '...'}
          </div>
        );
      default:
        return null;
    }
  };
  
  // Initialize graph when visualization changes or when dimensions change
  useEffect(() => {
    initializeGraph(visualization);
  }, [visualization, dimensions]);
  
  const nodeTypes = useMemo(() => ({}), []);

  return (
    <div ref={containerRef} className="visualization-renderer w-full h-full relative">
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
          <MiniMap />
          <Background />
        </ReactFlow>
      </div>
    </div>
  );
};

export default VisualizationRenderer; 