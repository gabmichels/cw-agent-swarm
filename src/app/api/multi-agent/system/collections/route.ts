import { NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../../server/memory/services';

// Define collection interface
interface Collection {
  name: string;
  vectorSize: number;
  type?: string;
  metadata?: Record<string, any>;
}

/**
 * GET handler - list collections or search by name/type
 */
export async function GET(
  request: Request
) {
  try {
    console.log(`API DEBUG: GET multi-agent/system/collections`);
    
    // Get query parameters
    const url = new URL(request.url);
    const name = url.searchParams.get('name');
    const type = url.searchParams.get('type');
    
    const { memoryService } = await getMemoryServices();
    
    // Get list of collections
    // Note: Using any here since the MemoryService interface doesn't explicitly define listCollections
    const collections = await (memoryService as any).listCollections() as Collection[];
    
    // Filter collections if name or type provided
    let filteredCollections = collections;
    
    if (name) {
      filteredCollections = filteredCollections.filter((c: Collection) => 
        c.name.toLowerCase().includes(name.toLowerCase()));
    }
    
    if (type) {
      filteredCollections = filteredCollections.filter((c: Collection) => 
        c.type === type);
    }
    
    return NextResponse.json({ collections: filteredCollections });
  } catch (error) {
    console.error(`Error listing collections:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST handler - create a new collection
 */
export async function POST(
  request: Request
) {
  try {
    console.log(`API DEBUG: POST multi-agent/system/collections`);
    
    const data = await request.json();
    
    // Validate request data
    if (!data.name) {
      return NextResponse.json(
        { error: 'Collection name is required' },
        { status: 400 }
      );
    }
    
    const { memoryService } = await getMemoryServices();
    
    // Check if collection already exists
    const collections = await (memoryService as any).listCollections() as Collection[];
    const collectionExists = collections.some((c: Collection) => c.name === data.name);
    
    if (collectionExists) {
      return NextResponse.json(
        { error: `Collection with name '${data.name}' already exists` },
        { status: 409 }
      );
    }
    
    // Create collection with specified parameters
    const vectorSize = data.vectorSize || 1536; // Default for most embeddings
    const collectionConfig = {
      name: data.name,
      vectorSize,
      metadata: data.metadata || {
        description: data.description || '',
        type: data.type || 'general',
        createdAt: new Date().toISOString(),
        createdBy: data.createdBy || 'system'
      }
    };
    
    await (memoryService as any).createCollection(
      collectionConfig.name, 
      collectionConfig.vectorSize, 
      collectionConfig.metadata
    );
    
    return NextResponse.json(
      { 
        collection: collectionConfig,
        message: 'Collection created successfully' 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(`Error creating collection:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 