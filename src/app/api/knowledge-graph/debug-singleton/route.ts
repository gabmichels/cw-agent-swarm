import { NextRequest, NextResponse } from 'next/server';
import KnowledgeGraphSingleton from '../../../../lib/singletons/knowledge-graph-singleton';

/**
 * Debug endpoint to check the singleton state
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debug: Checking singleton state...');
    
    // Check if initialized
    const isInitialized = KnowledgeGraphSingleton.isInitialized();
    console.log('🔍 Debug: Singleton initialized?', isInitialized);
    
    if (!isInitialized) {
      return NextResponse.json({
        success: true,
        message: 'Singleton not initialized',
        data: {
          initialized: false,
          stats: null,
          nodes: [],
          edges: []
        }
      });
    }
    
    // Get the instance
    const graphManager = await KnowledgeGraphSingleton.getInstance();
    
    // Get stats
    const stats = await graphManager.getStats();
    console.log('🔍 Debug: Graph stats:', stats);
    
    // Get visualization data
    const { nodes, edges } = graphManager.getVisualizationData();
    console.log('🔍 Debug: Retrieved nodes:', nodes.length, 'edges:', edges.length);
    
    return NextResponse.json({
      success: true,
      message: 'Singleton debug info',
      data: {
        initialized: isInitialized,
        stats,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        sampleNodes: nodes.slice(0, 3), // First 3 nodes for inspection
        sampleEdges: edges.slice(0, 3)  // First 3 edges for inspection
      }
    });
    
  } catch (error) {
    console.error('❌ Debug singleton error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
} 