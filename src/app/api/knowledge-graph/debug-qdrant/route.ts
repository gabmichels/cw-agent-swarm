import { NextRequest, NextResponse } from 'next/server';
import { QdrantClient } from '@qdrant/js-client-rest';

/**
 * Debug endpoint to test direct Qdrant operations
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Testing direct Qdrant operations...');
    
    // Create Qdrant client
    const client = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333'
    });
    
    // Test 1: Check collection info
    console.log('📊 Checking knowledge_nodes collection...');
    const collectionInfo = await client.getCollection('knowledge_nodes');
    console.log('Collection info:', JSON.stringify(collectionInfo, null, 2));
    
    // Test 2: Try a simple upsert with the exact expected format
    console.log('🔧 Testing simple upsert...');
    const testPoint = {
      id: 'test-debug-node-001',
      vector: Array(1536).fill(0).map(() => Math.random() * 2 - 1), // Random 1536-dimensional vector
      payload: {
        id: 'test-debug-node-001',
        label: 'Debug Test Node',
        type: 'CONCEPT',
        description: 'A simple debug test node',
        tags: ['debug', 'test'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        vectorDimensions: 1536
      }
    };
    
    console.log('Upserting point:', {
      id: testPoint.id,
      vectorLength: testPoint.vector.length,
      payloadKeys: Object.keys(testPoint.payload)
    });
    
    const upsertResult = await client.upsert('knowledge_nodes', {
      wait: true,
      points: [testPoint]
    });
    
    console.log('✅ Upsert successful:', upsertResult);
    
    // Test 3: Verify the point was added
    const retrieveResult = await client.retrieve('knowledge_nodes', {
      ids: [testPoint.id],
      with_payload: true
    });
    
    console.log('✅ Retrieve successful:', retrieveResult);
    
    // Test 4: Clean up
    await client.delete('knowledge_nodes', {
      points: [testPoint.id],
      wait: true
    });
    
    console.log('✅ Cleanup successful');
    
    return NextResponse.json({
      success: true,
      message: 'Direct Qdrant operations successful',
      collectionInfo: {
        pointsCount: collectionInfo.points_count,
        vectorSize: collectionInfo.config?.params?.vectors?.size || 'unknown',
        payloadSchema: collectionInfo.payload_schema
      }
    });
    
  } catch (error) {
    console.error('❌ Direct Qdrant test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
} 