import { NextRequest, NextResponse } from 'next/server';
import KnowledgeGraphSingleton from '../../../../lib/singletons/knowledge-graph-singleton';

/**
 * API endpoint to manually build the knowledge graph from existing memories
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Building knowledge graph from memories...');
    
    // Reset and get fresh singleton instance
    KnowledgeGraphSingleton.reset();
    const knowledgeGraph = await KnowledgeGraphSingleton.getInstance();
    
    // Get existing memories using our hybrid search endpoint
    console.log('📊 Fetching memories via hybrid search...');
    const response = await fetch('http://localhost:3000/api/memory/hybrid-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        query: '*', 
        limit: 500  // Get a good sample of memories
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch memories: ${response.statusText}`);
    }
    
    const searchResults = await response.json();
    const memories = searchResults.results || [];
    console.log(`📊 Found ${memories.length} memories to process`);
    
    // Convert search results to the format expected by buildGraphFromMemory
    const memoryEntries = memories.map((result: any) => {
      const memory = result.point || result;
      return {
        id: memory.id,
        content: memory.payload?.text || memory.text || '',
        metadata: memory.payload?.metadata || memory.metadata || {}
      };
    });
    
    // Build the graph from memories (with detailed error handling)
    console.log('🔧 Starting to build graph from memories...');
    try {
      await knowledgeGraph.buildGraphFromMemory(memoryEntries, []);
      console.log('✅ Successfully built graph from memories');
    } catch (buildError) {
      console.error('❌ Error building graph from memories:', buildError);
      
      // Try a simpler approach - add just one test node
      console.log('🔧 Trying to add a simple test node...');
      try {
        const testNodeId = await knowledgeGraph.addNode({
          label: 'Test Node',
          type: 'CONCEPT' as any,
          description: 'A simple test node to verify Qdrant connectivity',
          tags: ['test']
        });
        console.log('✅ Successfully added test node:', testNodeId);
      } catch (testError) {
        console.error('❌ Even test node failed:', testError);
        throw testError;
      }
    }
    
    // Get the updated stats
    const stats = await knowledgeGraph.getStats();
    console.log('📈 Knowledge graph stats:', stats);
    
    // Get visualization data
    const { nodes, edges } = await knowledgeGraph.getVisualizationDataAsync();
    
    return NextResponse.json({
      success: true,
      message: 'Knowledge graph built successfully',
      stats: {
        memoriesProcessed: memories.length,
        nodesCreated: nodes.length,
        edgesCreated: edges.length,
        graphStats: stats
      },
      data: {
        nodes: nodes.slice(0, 10), // Sample of nodes
        edges: edges.slice(0, 10)  // Sample of edges
      }
    });
    
  } catch (error) {
    console.error('❌ Error building knowledge graph:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
} 