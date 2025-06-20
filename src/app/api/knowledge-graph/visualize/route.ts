import { NextRequest, NextResponse } from 'next/server';
import { DefaultKnowledgeGraph } from '../../../../agents/shared/knowledge/DefaultKnowledgeGraph';
import { KnowledgeNodeType, KnowledgeEdgeType, KnowledgeNode, KnowledgeEdge } from '../../../../agents/shared/knowledge/interfaces/KnowledgeGraph.interface';

/**
 * API endpoint for visualizing the knowledge graph
 * Supports filtering by type, tag, or relationship
 */
export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const nodeTypes = searchParams.getAll('nodeType') as KnowledgeNodeType[];
    const edgeTypes = searchParams.getAll('edgeType') as KnowledgeEdgeType[];
    const tags = searchParams.getAll('tag');
    
    // Get singleton instance of the knowledge graph
    const graphManager = new DefaultKnowledgeGraph();
    await graphManager.initialize();
    
    // Get visualization data
    const { nodes: allNodes, edges: allEdges } = graphManager.getVisualizationData();
    
    // Apply filters
    let filteredNodes = allNodes;
    
    // Filter by node type
    if (nodeTypes.length > 0) {
      filteredNodes = filteredNodes.filter(node => nodeTypes.includes(node.type as KnowledgeNodeType));
    }
    
    // Filter by tag
    if (tags.length > 0) {
      filteredNodes = filteredNodes.filter(node => 
        node.tags && node.tags.some((tag: string) => tags.includes(tag))
      );
    }
    
    // Get the IDs of all filtered nodes
    const filteredNodeIds = new Set(filteredNodes.map(node => node.id));
    
    // Filter edges to only include those connecting filtered nodes
    let filteredEdges = allEdges.filter(edge => 
      filteredNodeIds.has(edge.from) && filteredNodeIds.has(edge.to)
    );
    
    // Filter by edge type
    if (edgeTypes.length > 0) {
      filteredEdges = filteredEdges.filter(edge => edgeTypes.includes(edge.type as KnowledgeEdgeType));
    }
    
    // Format for visualization (compatible with common graph visualization libraries)
    const formattedNodes = filteredNodes.map((node: KnowledgeNode) => ({
      id: node.id,
      label: node.label,
      title: node.description || node.label,
      group: node.type,
      metadata: {
        type: node.type,
        tags: node.tags,
        ...node.metadata
      }
    }));
    
    const formattedEdges = filteredEdges.map((edge: KnowledgeEdge) => ({
      id: `${edge.from}-${edge.to}-${edge.type}`,
      from: edge.from,
      to: edge.to,
      label: edge.type,
      title: edge.label || edge.type,
      arrows: 'to',
      dashes: edge.type === 'contradicts',
      width: edge.strength ? Math.max(1, Math.min(5, edge.strength * 5)) : 1,
      metadata: {
        type: edge.type,
        strength: edge.strength
      }
    }));
    
    // Return the formatted data
    return NextResponse.json({
      success: true,
      data: {
        nodes: formattedNodes,
        edges: formattedEdges
      },
      stats: {
        totalNodes: allNodes.length,
        filteredNodes: filteredNodes.length,
        totalEdges: allEdges.length,
        filteredEdges: filteredEdges.length
      }
    });
  } catch (error) {
    console.error('Error generating knowledge graph visualization:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 