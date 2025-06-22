'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
import { 
  SubGoal, 
  PlanningTask, 
  ExecutionTrace, 
  PlanningState, 
  GraphNode, 
  GraphEdge,
  GraphData,
  TraceToKnowledgeMapping 
} from './types';
import { ExecutionTraceKnowledgeConnector } from '../../../services/executionTraceKnowledgeConnector';

// Custom node component for different node types
const CustomNode = ({ data }: { data: any }) => {
  let bgColor = '#ffffff';
  
  switch (data.type) {
    case 'task':
      bgColor = '#10B981'; // green
      break;
    case 'concept':
      bgColor = '#3B82F6'; // blue
      break;
    case 'tool':
      bgColor = '#F59E0B'; // yellow
      break;
    case 'strategy':
      bgColor = '#8B5CF6'; // purple
      break;
    case 'insight':
      bgColor = '#EC4899'; // pink
      break;
    default:
      bgColor = '#9CA3AF'; // gray
  }
  
  return (
    <div style={{ 
      background: bgColor, 
      color: '#fff',
      padding: '10px', 
      borderRadius: '5px',
      minWidth: '150px',
      maxWidth: '250px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{data.label}</div>
      {data.description && <div style={{ fontSize: '0.85em' }}>{data.description}</div>}
    </div>
  );
};

// Define node types
const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

export default function GraphDebugPage() {
  const [planningState, setPlanningState] = useState<PlanningState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('execution'); // 'execution' or 'knowledge'
  const [graphSearchQuery, setGraphSearchQuery] = useState('');
  const [selectedNodeTypes, setSelectedNodeTypes] = useState<string[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [traceToKnowledgeMappings, setTraceToKnowledgeMappings] = useState<TraceToKnowledgeMapping[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const router = useRouter();
  
  // State for React Flow
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const connector = useMemo(() => new ExecutionTraceKnowledgeConnector(), []);

  useEffect(() => {
    async function fetchLastExecution() {
      try {
        // Fetch the most recent execution from an API endpoint
        const response = await fetch('/api/chloe/last-execution');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch execution data: ${response.statusText}`);
        }
        
        const data = await response.json();
        setPlanningState(data);
      } catch (err) {
        console.error('Error fetching plan execution data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        
        // For testing/demo purposes, use sample data if API fails
        setPlanningState(getSamplePlanningState());
      } finally {
        setLoading(false);
      }
    }
    
    fetchLastExecution();
  }, []);

  // Fetch knowledge graph data
  useEffect(() => {
    async function fetchKnowledgeGraph() {
      try {
        // Extract goal-related tags from planning state to use as filters
        const goalTags = planningState?.goal
          ? extractKeywords(planningState.goal)
          : [];
          
        // Build query parameters for filtering
        const queryParams = new URLSearchParams();
        
        // Add any selected node types as filters
        selectedNodeTypes.forEach(type => {
          queryParams.append('nodeType', type);
        });
        
        // Add extracted tags as filters
        goalTags.forEach(tag => {
          queryParams.append('tag', tag);
        });
        
        // Fetch knowledge graph data with filters
        const response = await fetch(`/api/knowledge-graph/visualize?${queryParams.toString()}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch knowledge graph: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          // Transform data to ReactFlow format
          const transformedNodes: Node[] = data.data.nodes.map((node: GraphNode, index: number) => ({
            id: node.id,
            type: 'custom',
            position: { x: 100 + Math.random() * 800, y: 100 + Math.random() * 500 }, // Random initial positions
            data: {
              label: node.label,
              description: node.description,
              type: node.type || 'default',
              metadata: node.metadata,
              tags: node.tags
            }
          }));
          
          const transformedEdges: Edge[] = data.data.edges.map((edge: GraphEdge) => ({
            id: edge.id || `${edge.from}-${edge.to}`,
            source: edge.from,
            target: edge.to,
            label: edge.label,
            type: 'smoothstep',
            animated: edge.strength && edge.strength > 0.7,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 20,
              height: 20
            },
            style: {
              strokeWidth: edge.strength ? Math.max(1, Math.min(5, edge.strength * 5)) : 1
            }
          }));
          
          setNodes(transformedNodes);
          setEdges(transformedEdges);
        } else {
          throw new Error(data.error || 'Unknown error loading knowledge graph');
        }
      } catch (err) {
        console.error('Error fetching knowledge graph:', err);
        // Use sample graph data if needed
        const sampleData = getSampleGraphData();
        setNodes(sampleData.nodes);
        setEdges(sampleData.edges);
      }
    }
    
    if (activeTab === 'knowledge' && planningState) {
      fetchKnowledgeGraph();
    }
  }, [activeTab, planningState, selectedNodeTypes, setNodes, setEdges]);

  // Connect execution trace to knowledge graph when both are available
  useEffect(() => {
    if (planningState?.executionTrace && nodes.length > 0) {
      try {
        // Transform ReactFlow nodes to GraphNode format
        const graphNodes: GraphNode[] = nodes.map(node => ({
          id: node.id,
          label: node.data.label,
          type: node.data.type,
          description: node.data.description,
          tags: node.data.tags,
          metadata: node.data.metadata
        }));
        
        // Transform ReactFlow edges to GraphEdge format
        const graphEdges: GraphEdge[] = edges.map(edge => ({
          id: edge.id,
          from: edge.source,
          to: edge.target,
          label: edge.label ? String(edge.label) : undefined,
          type: edge.type,
          strength: edge.style?.strokeWidth ? (edge.style.strokeWidth as number) / 5 : 0.5
        }));
        
        // Generate mappings
        const mappings = connector.mapTraceToKnowledge(
          planningState.executionTrace, 
          graphNodes, 
          graphEdges
        );
        
        setTraceToKnowledgeMappings(mappings);
      } catch (err) {
        console.error('Error connecting execution trace to knowledge graph:', err);
      }
    }
  }, [planningState?.executionTrace, nodes, edges, connector]);
  
  // Apply highlighting when a trace is selected
  useEffect(() => {
    if (!selectedTraceId) {
      // Reset all nodes to normal state
      setNodes(nodes => nodes.map(node => ({
        ...node,
        style: { ...node.style, boxShadow: 'none' }
      })));
      
      // Reset all edges to normal state
      setEdges(edges => edges.map(edge => ({
        ...edge,
        animated: edge.data?.originalAnimated || false,
        style: { 
          ...edge.style, 
          stroke: undefined, 
          strokeWidth: edge.data?.originalStrokeWidth || edge.style?.strokeWidth
        }
      })));
      
      return;
    }
    
    // Find highlights for the selected trace
    const highlights = connector.getHighlights(
      traceToKnowledgeMappings,
      selectedTraceId
    );
    
    // Highlight nodes
    setNodes(nodes => nodes.map(node => ({
      ...node,
      style: {
        ...node.style,
        boxShadow: highlights.nodeIds.includes(node.id)
          ? '0 0 10px 5px rgba(255, 215, 0, 0.75)'
          : 'none'
      }
    })));
    
    // Highlight edges
    setEdges(edges => edges.map(edge => {
      // Store original state if not already stored
      const data = edge.data || {};
      if (!('originalAnimated' in data)) {
        data.originalAnimated = edge.animated;
        data.originalStrokeWidth = edge.style?.strokeWidth;
      }
      
      const isHighlighted = highlights.edgeIds.includes(edge.id!);
      
      return {
        ...edge,
        animated: isHighlighted ? true : data.originalAnimated,
        style: {
          ...edge.style,
          stroke: isHighlighted ? '#FFD700' : undefined,
          strokeWidth: isHighlighted 
            ? (typeof edge.style?.strokeWidth === 'number' ? edge.style.strokeWidth * 2 : 3)
            : data.originalStrokeWidth
        },
        data
      };
    }));
  }, [selectedTraceId, traceToKnowledgeMappings, connector, setNodes, setEdges]);
  
  // Handle trace row click
  const handleTraceRowClick = useCallback((index: number) => {
    const traceId = `trace-${index}`;
    setSelectedTraceId(prev => prev === traceId ? null : traceId); // Toggle selection
    
    if (activeTab === 'execution') {
      // Switch to knowledge tab to see the connections
      setActiveTab('knowledge');
    }
  }, [activeTab, setActiveTab]);

  // Helper function to format timestamp
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  // Helper function to get status color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 border-green-500 text-green-800';
      case 'failed':
        return 'bg-red-100 border-red-500 text-red-800';
      case 'in_progress':
        return 'bg-blue-100 border-blue-500 text-blue-800';
      case 'pending':
        return 'bg-gray-100 border-gray-500 text-gray-800';
      default:
        return 'bg-gray-100 border-gray-500 text-gray-800';
    }
  };
  
  // Helper function to extract keywords from text for tagging
  const extractKeywords = (text: string): string[] => {
    // Simple implementation - extract words longer than 3 chars
    // In a real implementation, this would use NLP to extract key entities
    const words = text.toLowerCase().match(/\b\w{4,}\b/g) || [];
    return Array.from(new Set(words)); // Remove duplicates
  };
  
  // Node click handler for graph visualization
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    // Set the selected node
    setSelectedNodeId(prev => prev === node.id ? null : node.id);
    
    // If a node is selected, find all trace steps that reference this node
    if (node.id) {
      const connectedTraces = traceToKnowledgeMappings
        .filter(mapping => mapping.relevantNodeIds.includes(node.id))
        .map(mapping => mapping.traceStepId);
      
      // If there are connected traces and we're in the knowledge tab,
      // consider switching to the execution tab to show the connections
      if (connectedTraces.length > 0) {
        console.log(`Node ${node.id} is connected to traces:`, connectedTraces);
        
        // Optional: If you want to automatically switch tabs
        // if (activeTab === 'knowledge') {
        //   setActiveTab('execution');
        // }
      }
      
      // Display a notification
      const count = connectedTraces.length;
      if (count > 0) {
        // In a real implementation, this would show a toast notification
        // or update a status display
        console.log(`This knowledge node is used in ${count} execution steps`);
      }
    }
  }, [traceToKnowledgeMappings]);
  
  // Toggle node type filter
  const toggleNodeType = (type: string) => {
    setSelectedNodeTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type) 
        : [...prev, type]
    );
  };

  // Default React Flow props
  const defaultViewport = { x: 0, y: 0, zoom: 1 };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error && !planningState) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative max-w-md">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
        <button 
          onClick={() => router.push('/')}
          className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Return Home
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Chloe&apos;s Decision Process Visualization</h1>
      
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('execution')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'execution'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Execution Trace
          </button>
          <button
            onClick={() => setActiveTab('knowledge')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'knowledge'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Knowledge Graph
          </button>
        </nav>
      </div>
      
      {planningState && (
        <div className="space-y-8">
          {/* Goal Section - Always visible */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h2 className="text-xl text-white font-semibold mb-2">Goal</h2>
            <p className="text-gray-300">{planningState.goal}</p>
          </div>
          
          {/* Execution Trace Tab Content */}
          {activeTab === 'execution' && (
            <>
              {/* Planning Status */}
              {planningState.task && (
                <div className="bg-gray-100 p-4 rounded-lg border-l-4 border-blue-500">
                  <h2 className="text-lg font-semibold">Plan Status: <span className="font-normal">{planningState.task.status}</span></h2>
                  <div className="mt-2">
                    <h3 className="font-medium">Reasoning</h3>
                    <p className="text-gray-700">{planningState.task.reasoning}</p>
                  </div>
                </div>
              )}
              
              {/* Sub-goals/Steps Section */}
              {planningState.task && planningState.task.subGoals && (
                <div>
                  <h2 className="text-xl font-semibold mb-4">Execution Steps</h2>
                  <div className="space-y-4">
                    {planningState.task.subGoals.map((subGoal, index) => (
                      <div 
                        key={subGoal.id}
                        className={`p-4 rounded-lg border-l-4 ${getStatusColor(subGoal.status)}`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">Step {index + 1}: {subGoal.description}</h3>
                            <div className="text-sm text-gray-500">Status: {subGoal.status}</div>
                            {subGoal.timestamp && (
                              <div className="text-sm text-gray-500">Time: {formatTimestamp(subGoal.timestamp)}</div>
                            )}
                          </div>
                          <div className="px-2 py-1 rounded-full text-xs font-semibold">
                            {subGoal.status === 'completed' ? '✓' : subGoal.status === 'failed' ? '✗' : '●'}
                          </div>
                        </div>
                        
                        {subGoal.reasoning && (
                          <div className="mt-2">
                            <h4 className="text-sm font-medium">Reasoning</h4>
                            <p className="text-gray-700 text-sm">{subGoal.reasoning}</p>
                          </div>
                        )}
                        
                        {subGoal.result && (
                          <div className="mt-2">
                            <h4 className="text-sm font-medium">Result</h4>
                            <p className="text-gray-700 text-sm whitespace-pre-wrap">{subGoal.result}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Execution Trace */}
              {planningState.executionTrace && planningState.executionTrace.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold mb-4">Execution Trace</h2>
                  <div className="bg-gray-900 text-gray-300 p-4 rounded-lg overflow-auto max-h-96">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b border-gray-700">
                          <th className="pb-2 pr-4">Step</th>
                          <th className="pb-2 pr-4">Status</th>
                          <th className="pb-2 pr-4">Start Time</th>
                          <th className="pb-2 pr-4">End Time</th>
                          <th className="pb-2 pr-4">Duration</th>
                          <th className="pb-2">Knowledge</th>
                        </tr>
                      </thead>
                      <tbody>
                        {planningState.executionTrace.map((trace, index) => {
                          // Get status color
                          let statusColor = '';
                          switch(trace.status) {
                            case 'success': statusColor = 'text-green-400'; break;
                            case 'error': statusColor = 'text-red-400'; break;
                            case 'info': statusColor = 'text-blue-400'; break;
                            case 'simulated': statusColor = 'text-yellow-400'; break;
                            default: statusColor = 'text-gray-400';
                          }
                          
                          // Determine if this row is selected
                          const isSelected = selectedTraceId === `trace-${index}`;
                          
                          // Find mapping for this trace if available
                          const mapping = traceToKnowledgeMappings.find(m => m.traceStepId === `trace-${index}`);
                          
                          // Check if this trace is connected to the selected node
                          const isConnectedToSelectedNode = selectedNodeId && 
                            mapping?.relevantNodeIds.includes(selectedNodeId);
                          
                          return (
                            <tr 
                              key={index} 
                              className={`border-b border-gray-800 hover:bg-gray-800 cursor-pointer 
                                ${isSelected ? 'bg-gray-800' : ''} 
                                ${isConnectedToSelectedNode ? 'bg-blue-900 border-l-4 border-blue-500' : ''}`}
                              onClick={() => handleTraceRowClick(index)}
                            >
                              <td className="py-2 pr-4">{trace.step}</td>
                              <td className={`py-2 pr-4 ${statusColor}`}>{trace.status}</td>
                              <td className="py-2 pr-4">{formatTimestamp(trace.startTime)}</td>
                              <td className="py-2 pr-4">{trace.endTime ? formatTimestamp(trace.endTime) : '-'}</td>
                              <td className="py-2">
                                {trace.duration !== undefined ? `${(trace.duration / 1000).toFixed(2)}s` : '-'}
                              </td>
                              <td className="py-2 text-xs">
                                {mapping && (
                                  <div className="flex items-center">
                                    <span className={`inline-block w-2 h-2 rounded-full mr-1 ${mapping.confidenceScore > 0.5 ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                                    {mapping.relevantNodeIds.length > 0 ? `${mapping.relevantNodeIds.length} connections` : 'No connections'}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {/* Final Result */}
              {planningState.finalResult && (
                <div className="bg-green-100 p-4 rounded-lg border-l-4 border-green-500">
                  <h2 className="text-xl font-semibold mb-2">Final Result</h2>
                  <p className="text-gray-800 whitespace-pre-wrap">{planningState.finalResult}</p>
                </div>
              )}
              
              {/* Error (if any) */}
              {planningState.error && (
                <div className="bg-red-100 p-4 rounded-lg border-l-4 border-red-500">
                  <h2 className="text-xl font-semibold mb-2">Error</h2>
                  <p className="text-red-800">{planningState.error}</p>
                </div>
              )}
            </>
          )}
          
          {/* Knowledge Graph Tab Content */}
          {activeTab === 'knowledge' && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Filters Panel */}
                <div className="w-full md:w-1/4 bg-gray-100 p-4 rounded-lg">
                  <h3 className="font-semibold mb-3">Graph Filters</h3>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                    <input 
                      type="text" 
                      placeholder="Search nodes..." 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      value={graphSearchQuery}
                      onChange={(e) => setGraphSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Node Types</label>
                    <div className="space-y-2">
                      {['task', 'concept', 'trend', 'tool', 'strategy', 'insight'].map(type => (
                        <div key={type} className="flex items-center">
                          <input 
                            type="checkbox" 
                            id={`type-${type}`}
                            checked={selectedNodeTypes.includes(type)}
                            onChange={() => toggleNodeType(type)}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                          />
                          <label htmlFor={`type-${type}`} className="ml-2 text-sm text-gray-700">{type}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Add Connection Info Panel */}
                  {selectedTraceId && (
                    <div className="mt-6 border-t border-gray-300 pt-4">
                      <h3 className="font-semibold mb-2">Connection Info</h3>
                      
                      {(() => {
                        const mapping = traceToKnowledgeMappings.find(m => m.traceStepId === selectedTraceId);
                        const traceIndex = selectedTraceId ? parseInt(selectedTraceId.split('-')[1]) : -1;
                        const trace = traceIndex >= 0 && planningState?.executionTrace ? 
                          planningState.executionTrace[traceIndex] : undefined;
                          
                        if (!mapping || !trace) {
                          return <p className="text-sm text-gray-500">No connection information available</p>;
                        }
                        
                        return (
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium">Selected Step:</span> 
                              <span className="ml-1">{trace.step}</span>
                            </div>
                            
                            <div>
                              <span className="font-medium">Status:</span> 
                              <span className={`ml-1 ${
                                trace.status === 'success' ? 'text-green-600' : 
                                trace.status === 'error' ? 'text-red-600' : 
                                trace.status === 'info' ? 'text-blue-600' : 'text-yellow-600'
                              }`}>{trace.status}</span>
                            </div>
                            
                            <div>
                              <span className="font-medium">Knowledge Connections:</span> 
                              <span className="ml-1">{mapping.relevantNodeIds.length}</span>
                            </div>
                            
                            <div>
                              <span className="font-medium">Confidence:</span> 
                              <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                                <div 
                                  className={`h-2.5 rounded-full ${
                                    mapping.confidenceScore > 0.7 ? 'bg-green-600' : 
                                    mapping.confidenceScore > 0.4 ? 'bg-yellow-400' : 'bg-red-500'
                                  }`} 
                                  style={{ width: `${mapping.confidenceScore * 100}%` }}
                                ></div>
                              </div>
                            </div>
                            
                            {mapping.explanation && (
                              <div>
                                <span className="font-medium">Explanation:</span> 
                                <p className="mt-1 text-gray-600">{mapping.explanation}</p>
                              </div>
                            )}
                            
                            {trace.details && (
                              <div className="mt-2">
                                <span className="font-medium">Step Details:</span> 
                                <div className="mt-1 p-2 bg-gray-200 rounded text-xs">
                                  {typeof trace.details === 'object' ? 
                                    Object.entries(trace.details).map(([key, value]) => (
                                      <div key={key} className="mb-1">
                                        <span className="font-medium">{key}:</span> {String(value)}
                                      </div>
                                    )) : 
                                    String(trace.details)
                                  }
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
                
                {/* Graph Visualization */}
                <div className="w-full md:w-3/4 bg-gray-800 rounded-lg overflow-hidden" style={{ height: '600px' }}>
                  {nodes.length > 0 ? (
                    <ReactFlow
                      nodes={nodes}
                      edges={edges}
                      onNodesChange={onNodesChange}
                      onEdgesChange={onEdgesChange}
                      onNodeClick={onNodeClick}
                      nodeTypes={nodeTypes}
                      defaultViewport={defaultViewport}
                      fitView
                    >
                      <Background />
                      <Controls />
                      <MiniMap />
                    </ReactFlow>
                  ) : (
                    <div className="flex justify-center items-center h-full">
                      <div className="text-white">Loading graph data...</div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Relationship to Execution Trace */}
              <div className="bg-gray-100 p-4 rounded-lg">
                <h3 className="font-semibold mb-3">Knowledge Graph Insights</h3>
                <p className="text-sm text-gray-700">
                  This visualization shows the knowledge entities and relationships relevant to the current task:
                  &quot;{planningState.goal}&quot;. The knowledge graph helps Chloe make informed decisions by leveraging
                  structured knowledge about concepts, tools, and processes related to the task.
                </p>
                <p className="text-sm text-gray-700 mt-2">
                  <span className="font-semibold">Connection to execution:</span> Execution steps are influenced by
                  the relationships and properties in the knowledge graph. You can identify how knowledge is applied
                  in decision making process.
                </p>
                
                {/* Add instructions for interaction */}
                <div className="bg-blue-50 p-3 mt-3 text-sm border border-blue-200 rounded">
                  <p className="font-semibold text-blue-800">How to use:</p>
                  <ol className="list-decimal pl-5 mt-1 text-blue-700 space-y-1">
                    <li>Click on any execution trace step in the Execution Trace tab to highlight related knowledge nodes</li>
                    <li>Nodes and edges with golden highlights are directly connected to the selected execution step</li>
                    <li>Use the filters to focus on specific types of knowledge</li>
                    <li>Click on nodes to explore their connections</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Sample data for testing/demo purposes
function getSamplePlanningState(): PlanningState {
  return {
    goal: "Create a marketing campaign for our new fitness product",
    task: {
      goal: "Create a marketing campaign for our new fitness product",
      subGoals: [
        {
          id: "sg-1",
          description: "Analyze target audience demographics",
          status: "completed",
          reasoning: "Need to understand who would be most interested in this product",
          result: "Analysis shows that young adults (25-34) who are health-conscious but time-constrained are the primary target audience.",
          timestamp: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: "sg-2",
          description: "Develop key messaging and unique selling points",
          status: "completed",
          reasoning: "Need to craft a compelling value proposition",
          result: "Key message: 'Fit in your fitness, anytime, anywhere' with USPs focusing on convenience, effectiveness, and community support.",
          timestamp: new Date(Date.now() - 2400000).toISOString()
        },
        {
          id: "sg-3",
          description: "Outline social media campaign strategy",
          status: "completed",
          reasoning: "Social media is a key channel for reaching the target audience",
          result: "Strategy includes Instagram and TikTok as primary platforms with influencer partnerships and user-generated content contests.",
          timestamp: new Date(Date.now() - 1200000).toISOString()
        },
        {
          id: "sg-4",
          description: "Create sample content and ad mockups",
          status: "failed",
          reasoning: "Visual content is crucial for engagement",
          result: "Failed: Unable to create visual mockups due to lack of design tools integration.",
          timestamp: new Date(Date.now() - 600000).toISOString()
        },
        {
          id: "sg-5",
          description: "Develop budget allocation and ROI metrics",
          status: "completed",
          reasoning: "Need to ensure campaign is cost-effective",
          result: "Budget proposal: 40% on paid social, 30% on influencer partnerships, 20% on content creation, 10% on analytics tools.",
          timestamp: new Date(Date.now() - 300000).toISOString()
        }
      ],
      reasoning: "This plan provides a comprehensive approach to launching a marketing campaign for the new fitness product, covering audience analysis, messaging, channel strategy, content, and budget considerations.",
      status: "completed"
    },
    executionTrace: [
      {
        step: "Analyze target audience demographics",
        startTime: new Date(Date.now() - 3600000).toISOString(),
        endTime: new Date(Date.now() - 3600000 + 1200000).toISOString(),
        duration: 1200000,
        status: "success",
        details: {
          result: "Analysis shows that young adults (25-34) who are health-conscious but time-constrained are the primary target audience."
        }
      },
      {
        step: "Develop key messaging and unique selling points",
        startTime: new Date(Date.now() - 2400000).toISOString(),
        endTime: new Date(Date.now() - 2400000 + 800000).toISOString(),
        duration: 800000,
        status: "success",
        details: {
          result: "Key message: 'Fit in your fitness, anytime, anywhere' with USPs focusing on convenience, effectiveness, and community support."
        }
      },
      {
        step: "Outline social media campaign strategy",
        startTime: new Date(Date.now() - 1200000).toISOString(),
        endTime: new Date(Date.now() - 1200000 + 400000).toISOString(),
        duration: 400000,
        status: "success",
        details: {
          result: "Strategy includes Instagram and TikTok as primary platforms with influencer partnerships and user-generated content contests."
        }
      },
      {
        step: "Create sample content and ad mockups",
        startTime: new Date(Date.now() - 600000).toISOString(),
        endTime: new Date(Date.now() - 600000 + 200000).toISOString(),
        duration: 200000,
        status: "error",
        details: {
          error: "Failed: Unable to create visual mockups due to lack of design tools integration."
        }
      },
      {
        step: "Develop budget allocation and ROI metrics",
        startTime: new Date(Date.now() - 300000).toISOString(),
        endTime: new Date(Date.now() - 300000 + 250000).toISOString(),
        duration: 250000,
        status: "success",
        details: {
          result: "Budget proposal: 40% on paid social, 30% on influencer partnerships, 20% on content creation, 10% on analytics tools."
        }
      }
    ],
    finalResult: "Marketing Campaign Plan for New Fitness Product\n\nTarget Audience: Young adults (25-34) who are health-conscious but time-constrained\n\nKey Message: 'Fit in your fitness, anytime, anywhere'\n\nChannels: Primary focus on Instagram and TikTok with influencer partnerships\n\nBudget Allocation: 40% on paid social, 30% on influencer partnerships, 20% on content creation, 10% on analytics tools\n\nLimitations: Unable to create visual mockups due to tool limitations. Recommend working with design team for visual content creation."
  };
}

// Sample knowledge graph data for testing in ReactFlow format
function getSampleGraphData() {
  // Initial node positions
  const positions = {
    'concept-1': { x: 250, y: 100 },
    'concept-2': { x: 450, y: 100 },
    'concept-3': { x: 650, y: 200 },
    'concept-4': { x: 450, y: 300 },
    'tool-1': { x: 100, y: 300 },
    'tool-2': { x: 100, y: 400 },
    'strategy-1': { x: 250, y: 500 },
    'strategy-2': { x: 450, y: 500 },
    'task-1': { x: 650, y: 400 },
    'task-2': { x: 800, y: 300 },
    'task-3': { x: 800, y: 500 }
  };

  return {
    nodes: [
      { id: 'concept-1', type: 'custom', position: positions['concept-1'], data: { label: 'Fitness', type: 'concept' } },
      { id: 'concept-2', type: 'custom', position: positions['concept-2'], data: { label: 'Young Adults', type: 'concept' } },
      { id: 'concept-3', type: 'custom', position: positions['concept-3'], data: { label: 'Time Constraints', type: 'concept' } },
      { id: 'concept-4', type: 'custom', position: positions['concept-4'], data: { label: 'Health Consciousness', type: 'concept' } },
      { id: 'tool-1', type: 'custom', position: positions['tool-1'], data: { label: 'Instagram', type: 'tool' } },
      { id: 'tool-2', type: 'custom', position: positions['tool-2'], data: { label: 'TikTok', type: 'tool' } },
      { id: 'strategy-1', type: 'custom', position: positions['strategy-1'], data: { label: 'Influencer Marketing', type: 'strategy' } },
      { id: 'strategy-2', type: 'custom', position: positions['strategy-2'], data: { label: 'Content Marketing', type: 'strategy' } },
      { id: 'task-1', type: 'custom', position: positions['task-1'], data: { label: 'Analyze Demographics', type: 'task' } },
      { id: 'task-2', type: 'custom', position: positions['task-2'], data: { label: 'Develop Messaging', type: 'task' } },
      { id: 'task-3', type: 'custom', position: positions['task-3'], data: { label: 'Create Campaign', type: 'task' } }
    ],
    edges: [
      { id: 'e1-2', source: 'concept-1', target: 'concept-2', label: 'appeals to', type: 'smoothstep', animated: true },
      { id: 'e2-3', source: 'concept-2', target: 'concept-3', label: 'experiences', type: 'smoothstep' },
      { id: 'e2-4', source: 'concept-2', target: 'concept-4', label: 'values', type: 'smoothstep' },
      { id: 'e1-t1', source: 'concept-1', target: 'tool-1', label: 'promoted via', type: 'smoothstep' },
      { id: 'e1-t2', source: 'concept-1', target: 'tool-2', label: 'trending on', type: 'smoothstep' },
      { id: 's1-t1', source: 'strategy-1', target: 'tool-1', label: 'utilizes', type: 'smoothstep' },
      { id: 's1-t2', source: 'strategy-1', target: 'tool-2', label: 'utilizes', type: 'smoothstep' },
      { id: 's2-c4', source: 'strategy-2', target: 'concept-4', label: 'targets', type: 'smoothstep' },
      { id: 'task1-c2', source: 'task-1', target: 'concept-2', label: 'analyzes', type: 'smoothstep' },
      { id: 'task2-c1', source: 'task-2', target: 'concept-1', label: 'promotes', type: 'smoothstep' },
      { id: 'task3-s1', source: 'task-3', target: 'strategy-1', label: 'implements', type: 'smoothstep' },
      { id: 'task3-s2', source: 'task-3', target: 'strategy-2', label: 'implements', type: 'smoothstep' }
    ]
  };
} 