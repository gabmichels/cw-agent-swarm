import React, { useEffect, useRef } from 'react';
import { ThinkingVisualization, VisualizationNode, VisualizationEdge, VisualizationNodeType, VisualizationEdgeType } from '../services/thinking/visualization';

interface VisualizationRendererProps {
  visualization: ThinkingVisualization;
  width?: number;
  height?: number;
}

const nodeColors = {
  [VisualizationNodeType.START]: '#4CAF50',
  [VisualizationNodeType.CONTEXT_RETRIEVAL]: '#2196F3',
  [VisualizationNodeType.THINKING]: '#9C27B0',
  [VisualizationNodeType.DELEGATION_DECISION]: '#FF9800',
  [VisualizationNodeType.TOOL_SELECTION]: '#03A9F4',
  [VisualizationNodeType.TOOL_EXECUTION]: '#00BCD4',
  [VisualizationNodeType.RESPONSE_GENERATION]: '#3F51B5',
  [VisualizationNodeType.END]: '#4CAF50',
  [VisualizationNodeType.ERROR]: '#F44336'
};

const edgeColors = {
  [VisualizationEdgeType.FLOW]: '#757575',
  [VisualizationEdgeType.DELEGATION]: '#FF9800',
  [VisualizationEdgeType.TOOL_USE]: '#00BCD4',
  [VisualizationEdgeType.ERROR]: '#F44336'
};

const VisualizationRenderer: React.FC<VisualizationRendererProps> = ({ 
  visualization, 
  width = 800, 
  height = 600 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodePositions = useRef<Map<string, { x: number, y: number }>>(new Map());
  const selectedNode = useRef<string | null>(null);
  const [nodeDetails, setNodeDetails] = React.useState<VisualizationNode | null>(null);

  // Calculate node positions in a tree layout
  const calculateNodePositions = () => {
    const nodes = visualization.nodes;
    const edges = visualization.edges;
    
    // Create adjacency list
    const adjList = new Map<string, string[]>();
    for (const node of nodes) {
      adjList.set(node.id, []);
    }
    
    for (const edge of edges) {
      const sourceNeighbors = adjList.get(edge.source) || [];
      sourceNeighbors.push(edge.target);
      adjList.set(edge.source, sourceNeighbors);
    }
    
    // Find root nodes (those with no incoming edges)
    const inDegree = new Map<string, number>();
    for (const node of nodes) {
      inDegree.set(node.id, 0);
    }
    
    for (const edge of edges) {
      const target = edge.target;
      inDegree.set(target, (inDegree.get(target) || 0) + 1);
    }
    
    const roots = [];
    for (const entry of Array.from(inDegree.entries())) {
      const [nodeId, degree] = entry;
      if (degree === 0) {
        roots.push(nodeId);
      }
    }
    
    // Initialize positions map
    const positions = new Map<string, { x: number, y: number, level: number }>();
    
    // BFS to assign levels to nodes
    const queue = roots.map(root => ({ id: root, level: 0 }));
    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      
      if (positions.has(id)) {
        continue;
      }
      
      positions.set(id, { x: 0, y: level * 120 + 60, level });
      
      const neighbors = adjList.get(id) || [];
      for (const neighbor of neighbors) {
        queue.push({ id: neighbor, level: level + 1 });
      }
    }
    
    // Count nodes at each level
    const levelCounts = new Map<number, number>();
    for (const pos of Array.from(positions.values())) {
      const { level } = pos;
      levelCounts.set(level, (levelCounts.get(level) || 0) + 1);
    }
    
    // Position nodes horizontally
    const levelPositions = new Map<number, number>();
    for (const entry of Array.from(positions.entries())) {
      const [nodeId, pos] = entry;
      const level = pos.level;
      const count = levelCounts.get(level) || 1;
      const position = levelPositions.get(level) || 0;
      
      const x = position * (width / (count + 1)) + (width / (count + 1));
      
      positions.set(nodeId, { ...pos, x });
      levelPositions.set(level, position + 1);
    }
    
    // Convert to final positions
    const finalPositions = new Map<string, { x: number, y: number }>();
    for (const entry of Array.from(positions.entries())) {
      const [nodeId, pos] = entry;
      finalPositions.set(nodeId, { x: pos.x, y: pos.y });
    }
    
    return finalPositions;
  };

  // Draw the visualization
  const drawVisualization = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate node positions if not already done
    if (nodePositions.current.size === 0) {
      nodePositions.current = calculateNodePositions();
    }
    
    // Draw edges
    for (const edge of visualization.edges) {
      const sourcePos = nodePositions.current.get(edge.source);
      const targetPos = nodePositions.current.get(edge.target);
      
      if (!sourcePos || !targetPos) continue;
      
      ctx.beginPath();
      ctx.moveTo(sourcePos.x, sourcePos.y);
      ctx.lineTo(targetPos.x, targetPos.y);
      ctx.strokeStyle = edgeColors[edge.type] || '#757575';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw arrow
      const angle = Math.atan2(targetPos.y - sourcePos.y, targetPos.x - sourcePos.x);
      const arrowLength = 10;
      
      ctx.beginPath();
      ctx.moveTo(targetPos.x, targetPos.y);
      ctx.lineTo(
        targetPos.x - arrowLength * Math.cos(angle - Math.PI / 6),
        targetPos.y - arrowLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        targetPos.x - arrowLength * Math.cos(angle + Math.PI / 6),
        targetPos.y - arrowLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fillStyle = edgeColors[edge.type] || '#757575';
      ctx.fill();
      
      // Draw edge label
      if (edge.label) {
        const midX = (sourcePos.x + targetPos.x) / 2;
        const midY = (sourcePos.y + targetPos.y) / 2;
        
        ctx.fillStyle = '#000000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(edge.label, midX, midY - 10);
      }
    }
    
    // Draw nodes
    for (const node of visualization.nodes) {
      const pos = nodePositions.current.get(node.id);
      if (!pos) continue;
      
      const nodeSize = 30;
      
      // Node circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, nodeSize, 0, 2 * Math.PI);
      ctx.fillStyle = node.status === 'error' 
        ? '#F44336' 
        : (nodeColors[node.type] || '#757575');
      ctx.fill();
      
      if (node.status === 'in_progress') {
        // Draw pulsing circle for in-progress nodes
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeSize + 5, 0, 2 * Math.PI);
        ctx.strokeStyle = nodeColors[node.type] || '#757575';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      // Node border
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, nodeSize, 0, 2 * Math.PI);
      ctx.strokeStyle = node.id === selectedNode.current ? '#000000' : '#FFFFFF';
      ctx.lineWidth = node.id === selectedNode.current ? 3 : 1;
      ctx.stroke();
      
      // Node label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label.slice(0, 15), pos.x, pos.y);
      
      if (node.label.length > 15) {
        ctx.fillText(node.label.slice(15, 30) + '...', pos.x, pos.y + 15);
      }
    }
  };

  // Handle canvas click
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Check if a node was clicked
    for (const node of visualization.nodes) {
      const pos = nodePositions.current.get(node.id);
      if (!pos) continue;
      
      const distance = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
      if (distance <= 30) {
        // Node was clicked
        selectedNode.current = node.id;
        setNodeDetails(node);
        drawVisualization();
        return;
      }
    }
    
    // No node was clicked
    selectedNode.current = null;
    setNodeDetails(null);
    drawVisualization();
  };

  // Initialize visualization
  useEffect(() => {
    nodePositions.current = calculateNodePositions();
    drawVisualization();
    
    // Set up animation
    const interval = setInterval(() => {
      drawVisualization();
    }, 1000);
    
    return () => {
      clearInterval(interval);
    };
  }, [visualization]);

  // Format date for display
  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleTimeString();
  };

  // Format duration for display
  const formatDuration = (duration?: number) => {
    if (!duration) return 'N/A';
    return `${duration.toFixed(2)}ms`;
  };

  return (
    <div className="visualization-container">
      <h2>Request Visualization</h2>
      <div className="visualization-info">
        <div>Request ID: <span className="code">{visualization.requestId}</span></div>
        <div>User ID: <span className="code">{visualization.userId}</span></div>
        <div>Message: "{visualization.message}"</div>
        <div>Timestamp: {new Date(visualization.timestamp).toLocaleString()}</div>
        <div>Duration: {formatDuration(visualization.metrics.totalDuration)}</div>
      </div>
      
      <div className="visualization-canvas-container">
        <canvas 
          ref={canvasRef} 
          width={width} 
          height={height}
          onClick={handleCanvasClick}
          style={{ border: '1px solid #ccc' }}
        />
      </div>
      
      {nodeDetails && (
        <div className="node-details">
          <h3>{nodeDetails.label}</h3>
          <div>Type: {nodeDetails.type}</div>
          <div>Status: {nodeDetails.status}</div>
          <div>Start: {formatTimestamp(nodeDetails.metrics?.startTime)}</div>
          <div>End: {formatTimestamp(nodeDetails.metrics?.endTime)}</div>
          <div>Duration: {formatDuration(nodeDetails.metrics?.duration)}</div>
          
          <h4>Data:</h4>
          <pre>{JSON.stringify(nodeDetails.data, null, 2)}</pre>
        </div>
      )}
      
      <style jsx>{`
        .visualization-container {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 20px;
        }
        
        .visualization-info {
          margin-bottom: 20px;
        }
        
        .code {
          font-family: monospace;
          background-color: #f0f0f0;
          padding: 2px 4px;
          border-radius: 3px;
        }
        
        .visualization-canvas-container {
          margin-bottom: 20px;
        }
        
        .node-details {
          border: 1px solid #ccc;
          padding: 15px;
          border-radius: 5px;
          background-color: #f9f9f9;
        }
        
        pre {
          background-color: #f0f0f0;
          padding: 10px;
          border-radius: 5px;
          overflow: auto;
          max-height: 300px;
        }
      `}</style>
    </div>
  );
};

export default VisualizationRenderer; 