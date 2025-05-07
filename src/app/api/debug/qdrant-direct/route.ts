import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';
import { QdrantClient } from '@qdrant/js-client-rest';

export const runtime = 'nodejs'; // Mark as server-side only
export const dynamic = 'force-dynamic'; // Prevent caching

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || '';

// Create direct HTTP fetch wrapper for Qdrant API
async function callQdrantHttpApi(path: string, method: string = 'GET', body?: object): Promise<Response> {
  const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
  const qdrantApiKey = process.env.QDRANT_API_KEY;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (qdrantApiKey) {
    headers['api-key'] = qdrantApiKey;
  }
  
  const options: RequestInit = {
    method,
    headers,
  };
  
  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }
  
  return fetch(`${qdrantUrl}${path}`, options);
}

// Common collection name prefixes to check
const KNOWN_PREFIXES = ['memory_'];

// Get the actual Qdrant collection name for a memory type
function getCollectionName(memoryType: string): string {
  return `memory_${memoryType}`;
}

// Convert Qdrant collection name back to memory type
function getMemoryTypeFromCollection(collectionName: string): string {
  for (const prefix of KNOWN_PREFIXES) {
    if (collectionName.startsWith(prefix)) {
      return collectionName.substring(prefix.length);
    }
  }
  return collectionName;
}

/**
 * Direct API endpoint to perform various Qdrant operations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { operation } = body;
    
    // Initialize Qdrant client
    const client = new QdrantClient({ url: QDRANT_URL, apiKey: QDRANT_API_KEY });
    
    // Handle different operations
    switch (operation) {
      case 'listCollections':
        return await listCollections(client);
      
      case 'deleteAllCollections':
        return await deleteAllCollections(client);
      
      case 'deleteCollection':
        return await deleteCollection(client, body.collection);
      
      case 'deletePoints':
        return await deletePoints(client, body.collection, body.filter);
      
      case 'createCollections':
        return await createCollections(client, body.collections);
      
      default:
        return NextResponse.json(
          { success: false, error: `Unknown operation: ${operation}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in Qdrant direct API:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * List all collections
 */
async function listCollections(client: QdrantClient) {
  try {
    const { collections } = await client.getCollections();
    
    return NextResponse.json({
      success: true,
      result: {
        collections: collections.map(c => c.name),
        count: collections.length
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Delete all collections
 */
async function deleteAllCollections(client: QdrantClient) {
  try {
    const { collections } = await client.getCollections();
    const collectionNames = collections.map(c => c.name);
    
    // Group by collection name prefix (like memory_, documents_, etc.)
    const groupedByType: Record<string, { count: number; deleted: boolean }> = {};
    
    // Collect collection names by type
    for (const name of collectionNames) {
      const parts = name.split('_');
      const type = parts.length > 1 ? parts[0] : 'general';
      
      if (!groupedByType[type]) {
        groupedByType[type] = { count: 0, deleted: false };
      }
      
      groupedByType[type].count++;
    }
    
    let deletedCount = 0;
    
    // Delete each collection
    for (const name of collectionNames) {
      try {
        await client.deleteCollection(name);
        deletedCount++;
        
        // Update deleted status for the type
        const parts = name.split('_');
        const type = parts.length > 1 ? parts[0] : 'general';
        if (groupedByType[type]) {
          groupedByType[type].deleted = true;
        }
      } catch (deleteError) {
        console.warn(`Failed to delete collection ${name}:`, deleteError);
      }
    }
    
    return NextResponse.json({
      success: true,
      result: {
        totalCollections: collectionNames.length,
        deletedCollections: deletedCount,
        byType: groupedByType
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Delete a specific collection
 */
async function deleteCollection(client: QdrantClient, collectionName: string) {
  if (!collectionName) {
    return NextResponse.json(
      { success: false, error: 'Collection name is required' },
      { status: 400 }
    );
  }
  
  try {
    await client.deleteCollection(collectionName);
    
    return NextResponse.json({
      success: true,
      result: {
        collection: collectionName,
        deleted: true
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Delete points from a collection
 */
async function deletePoints(client: QdrantClient, collectionName: string, filter: any) {
  if (!collectionName) {
    return NextResponse.json(
      { success: false, error: 'Collection name is required' },
      { status: 400 }
    );
  }
  
  try {
    const result = await client.delete(collectionName, { filter, wait: true });
    
    return NextResponse.json({
      success: true,
      result: {
        collection: collectionName,
        deleted: result.status === 'completed' ? true : false,
        status: result.status
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Create multiple collections with specified dimensions
 */
async function createCollections(client: QdrantClient, collections: Array<{name: string, dimensions: number}>) {
  if (!collections || !Array.isArray(collections) || collections.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Collections array is required' },
      { status: 400 }
    );
  }
  
  try {
    const results = [];
    
    for (const collection of collections) {
      if (!collection.name || !collection.dimensions) {
        results.push({
          name: collection.name || 'unnamed',
          created: false,
          error: 'Missing name or dimensions'
        });
        continue;
      }
      
      try {
        // Check if collection already exists
        const { collections: existingCollections } = await client.getCollections();
        const exists = existingCollections.some(c => c.name === collection.name);
        
        if (exists) {
          results.push({
            name: collection.name,
            created: false,
            error: 'Collection already exists'
          });
          continue;
        }
        
        // Create collection
        await client.createCollection(collection.name, {
          vectors: {
            size: collection.dimensions,
            distance: "Cosine"
          },
          optimizers_config: {
            indexing_threshold: 0, // Start indexing immediately
            memmap_threshold: 10000 // Force memory-mapping for speed
          }
        });
        
        // Create standard indices for common fields
        const indices: Array<{field_name: string, field_schema: "datetime" | "keyword" | "float" | "bool"}> = [
          { field_name: "timestamp", field_schema: "datetime" },
          { field_name: "type", field_schema: "keyword" },
          { field_name: "importance", field_schema: "float" },
          { field_name: "is_deleted", field_schema: "bool" },
          { field_name: "tags", field_schema: "keyword" }
        ];
        
        // Create all indices
        for (const index of indices) {
          try {
            await client.createPayloadIndex(collection.name, index);
          } catch (indexError) {
            console.warn(`Failed to create index ${index.field_name} for collection ${collection.name}:`, indexError);
            // Continue with other indices even if one fails
          }
        }
        
        results.push({
          name: collection.name,
          created: true,
          dimensions: collection.dimensions,
          indices: indices.map(i => i.field_name)
        });
      } catch (error) {
        results.push({
          name: collection.name,
          created: false,
          error: String(error)
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      result: {
        collections: results,
        totalRequested: collections.length,
        totalCreated: results.filter(r => r.created).length
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
} 