import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../server/memory/services';

export const runtime = 'nodejs'; // Mark as server-side only
export const dynamic = 'force-dynamic'; // Prevent caching

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
 * Direct operations on Qdrant client for emergency deletion/maintenance
 * This endpoint allows raw operations on the Qdrant client
 * Use with caution as this bypasses normal memory service safeguards
 */
export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body = await req.json();
    const { operation, collection, filter, points, wait = true } = body;
    
    if (!operation) {
      return NextResponse.json(
        { success: false, error: 'Missing operation parameter' },
        { status: 400 }
      );
    }

    // Get Qdrant client (for non-direct operations)
    const { client } = await getMemoryServices();
    
    // Verify connection
    const status = await client.getStatus();
    if (!status.initialized) {
      await client.initialize();
    }

    // Execute requested operation
    let result;
    switch (operation) {
      case 'listCollections':
        try {
          // Use direct HTTP call to Qdrant API
          const response = await callQdrantHttpApi('/collections');
          
          if (response.ok) {
            const data = await response.json();
            result = {
              collections: data.result.collections.map((c: { name: string }) => c.name)
            };
          } else {
            const errorText = await response.text();
            throw new Error(`Qdrant API error: ${response.status} ${errorText}`);
          }
        } catch (listError) {
          console.error('Error listing collections:', listError);
          
          // Fallback to manual method if direct call fails
          try {
            const knownTypes = ["message", "thought", "document", "task", "memory_message", "memory_thought", "memory_document", "memory_task"];
            const collectionExistsPromises = knownTypes.map(async type => {
              try {
                const exists = await client.collectionExists(type);
                return exists ? type : null;
              } catch {
                return null;
              }
            });
            
            const existingCollections = (await Promise.all(collectionExistsPromises)).filter(Boolean);
            
            result = {
              collections: existingCollections,
              note: "Using fallback collection check method"
            };
          } catch (fallbackError) {
            console.error('Error with fallback collection listing:', fallbackError);
            return NextResponse.json({
              success: false,
              error: 'Failed to list collections with fallback method',
              details: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
            }, { status: 500 });
          }
        }
        break;
        
      case 'deleteCollection':
        if (!collection) {
          return NextResponse.json(
            { success: false, error: 'Missing collection parameter for deleteCollection' },
            { status: 400 }
          );
        }
        
        try {
          // Use direct HTTP call to Qdrant API
          const response = await callQdrantHttpApi(`/collections/${collection}`, 'DELETE');
          
          if (response.ok) {
            const data = await response.json();
            result = { 
              deleted: true, 
              collection,
              qdrantResult: data
            };
          } else {
            // If collection doesn't exist, API returns 404
            if (response.status === 404) {
              result = { 
                deleted: true, 
                collection,
                note: "Collection didn't exist (404)"
              };
            } else {
              const errorText = await response.text();
              throw new Error(`Qdrant API error: ${response.status} ${errorText}`);
            }
          }
        } catch (deleteError) {
          console.error(`Error deleting collection ${collection}:`, deleteError);
          
          // Fallback to point deletion if direct call fails
          try {
            // Get all points in the collection
            const allPoints = await client.scrollPoints(collection);
            console.log(`Found ${allPoints.length} points to delete in collection ${collection}`);
            
            // Delete each point
            const deleteResults = await Promise.allSettled(
              allPoints.map(point => client.deletePoint(collection, point.id, { hardDelete: true }))
            );
            
            result = {
              total: allPoints.length,
              deleted: deleteResults.filter(r => r.status === 'fulfilled' && r.value === true).length,
              failed: deleteResults.filter(r => r.status !== 'fulfilled' || r.value !== true).length,
              note: "Used point deletion instead of collection deletion"
            };
          } catch (scrollError) {
            console.error(`Error scrolling collection ${collection}:`, scrollError);
            result = { deleted: false, error: 'Error scrolling collection', note: "Collection may not exist" };
          }
        }
        break;
        
      case 'deleteAllCollections':
        try {
          // Step 1: List all collections using direct HTTP call
          const listResponse = await callQdrantHttpApi('/collections');
          
          if (!listResponse.ok) {
            const errorText = await listResponse.text();
            throw new Error(`Qdrant API error listing collections: ${listResponse.status} ${errorText}`);
          }
          
          const listData = await listResponse.json();
          const collections = listData.result.collections.map((c: { name: string }) => c.name);
          
          console.log(`Found ${collections.length} collections to delete`);
          
          // Step 2: Delete each collection
          const results = [];
          for (const name of collections) {
            try {
              const deleteResponse = await callQdrantHttpApi(`/collections/${name}`, 'DELETE');
              
              if (deleteResponse.ok) {
                const memoryType = getMemoryTypeFromCollection(name);
                results.push({ 
                  collection: name, 
                  memoryType,
                  deleted: true 
                });
              } else {
                const errorText = await deleteResponse.text();
                throw new Error(`Error deleting collection ${name}: ${deleteResponse.status} ${errorText}`);
              }
            } catch (deleteError) {
              console.error(`Error deleting collection ${name}:`, deleteError);
              results.push({ 
                collection: name, 
                memoryType: getMemoryTypeFromCollection(name),
                deleted: false, 
                error: deleteError instanceof Error ? deleteError.message : String(deleteError)
              });
            }
          }
          
          // Group the results by memory type for clearer reporting
          const byType: Record<string, { deleted: boolean, count: number }> = {};
          
          for (const result of results) {
            const type = result.memoryType;
            if (!byType[type]) {
              byType[type] = { deleted: result.deleted, count: 1 };
            } else {
              byType[type].count++;
              if (!result.deleted) {
                byType[type].deleted = false;
              }
            }
          }
          
          result = {
            totalCollections: collections.length,
            deletedCollections: results.filter(r => r.deleted).length,
            failedCollections: results.filter(r => !r.deleted).length,
            byType,
            details: results
          };
        } catch (operationError) {
          console.error('Error in deleteAllCollections operation:', operationError);
          return NextResponse.json({
            success: false,
            error: 'Failed to delete all collections',
            details: operationError instanceof Error ? operationError.message : String(operationError)
          }, { status: 500 });
        }
        break;
      
      case 'deletePoints':
        if (!collection) {
          return NextResponse.json(
            { success: false, error: 'Missing collection parameter for deletePoints' },
            { status: 400 }
          );
        }
        
        // Since direct deletePoints method doesn't exist, we'll use individual deletePoint calls
        if (filter) {
          let points = [];
          
          try {
            // First scroll to get matching points - might fail if collection doesn't exist
            points = await client.scrollPoints(collection, filter, 1000);
            console.log(`Found ${points.length} points to delete`);
          } catch (scrollError) {
            console.error('Error scrolling points:', scrollError);
            
            // Return success with 0 deleted if we couldn't scroll (likely collection doesn't exist)
            return NextResponse.json({
              success: true,
              operation,
              collection,
              result: { total: 0, deleted: 0, failed: 0, error: 'Error scrolling points' }
            });
          }
          
          if (points.length === 0) {
            return NextResponse.json({
              success: true,
              operation,
              collection,
              result: { total: 0, deleted: 0, failed: 0 }
            });
          }
          
          // Delete each point
          const results = await Promise.allSettled(
            points.map(point => client.deletePoint(collection, point.id, { hardDelete: true }))
          );
          
          result = {
            total: points.length,
            deleted: results.filter(r => r.status === 'fulfilled' && r.value === true).length,
            failed: results.filter(r => r.status !== 'fulfilled' || r.value !== true).length
          };
        } else if (points && Array.isArray(points)) {
          // Delete specific points
          const results = await Promise.allSettled(
            points.map(id => client.deletePoint(collection, id, { hardDelete: true }))
          );
          
          result = {
            total: points.length,
            deleted: results.filter(r => r.status === 'fulfilled' && r.value === true).length,
            failed: results.filter(r => r.status !== 'fulfilled' || r.value !== true).length
          };
        } else {
          return NextResponse.json(
            { success: false, error: 'Missing filter or points parameter for deletePoints' },
            { status: 400 }
          );
        }
        break;
        
      case 'resetCollection':
        if (!collection) {
          return NextResponse.json(
            { success: false, error: 'Missing collection parameter for resetCollection' },
            { status: 400 }
          );
        }
        
        try {
          // Get all points in the collection
          const allPoints = await client.scrollPoints(collection);
          console.log(`Found ${allPoints.length} points to delete in collection ${collection}`);
          
          // Delete all points
          const deleteResults = await Promise.allSettled(
            allPoints.map(point => client.deletePoint(collection, point.id, { hardDelete: true }))
          );
          
          result = {
            total: allPoints.length,
            deleted: deleteResults.filter(r => r.status === 'fulfilled' && r.value === true).length,
            failed: deleteResults.filter(r => r.status !== 'fulfilled' || r.value !== true).length
          };
        } catch (scrollError) {
          console.error('Error scrolling collection:', scrollError);
          // Return success with 0 deleted if we couldn't scroll
          result = { total: 0, deleted: 0, failed: 0, error: 'Error scrolling collection' };
        }
        break;
        
      case 'getStatus':
        result = await client.getStatus();
        break;
        
      default:
        return NextResponse.json(
          { success: false, error: `Unsupported operation: ${operation}` },
          { status: 400 }
        );
    }
    
    return NextResponse.json({
      success: true,
      operation,
      collection,
      result
    });
    
  } catch (error) {
    console.error('Error in direct Qdrant operation:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 