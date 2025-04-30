// API route to test if memory system initialization is working

import { NextResponse } from 'next/server';
import * as serverQdrant from '../../../server/qdrant';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Initial memory system setup endpoint
export async function GET() {
  try {
    console.log('Initializing Qdrant memory system');
    
    // Initialize Qdrant memory with OpenAI for embeddings if configured
    await serverQdrant.initMemory({
      useOpenAI: process.env.USE_OPENAI_EMBEDDINGS === 'true'
    });
    
    // Test search to verify initialization
    const testResults = await serverQdrant.searchMemory(null, 'test', { limit: 1 });
    console.log(`Memory initialization test returned ${testResults.length} results`);
    
    // Check initialization status
    const isInitialized = serverQdrant.isInitialized();
    
    return NextResponse.json({
      success: isInitialized,
      message: 'Memory system initialized',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error initializing memory system:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, {
      status: 500
    });
  }
} 