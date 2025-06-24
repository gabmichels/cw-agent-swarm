import { NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../../../../server/memory/services';

// Define collection and memory point interfaces
interface Collection {
  name: string;
  vectorSize: number;
  type?: string;
  metadata?: Record<string, any>;
}

interface MemoryPoint {
  id: string;
  vector: number[];
  payload: {
    content?: any;
    metadata?: Record<string, any>;
    type?: string;
  };
  timestamp?: number | string;
  messageType?: string;
  type?: string;
}

/**
 * GET handler - get collection statistics
 */
export async function GET(
  request: Request,
  { params }: { params: { collectionId: string } }
) {
  try {
    const awaitedParams = await params;
    console.log(`API DEBUG: GET multi-agent/system/collections/${awaitedParams.collectionId}/stats`);
    
    const { collectionId  } = await params;
    
    if (!collectionId) {
      return NextResponse.json(
        { error: 'Collection ID is required' },
        { status: 400 }
      );
    }
    
    const { memoryService } = await getMemoryServices();
    
    // Check if collection exists
    const collections = await (memoryService as any).listCollections() as Collection[];
    const collection = collections.find((c: Collection) => c.name === collectionId);
    
    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }
    
    // Get collection stats
    const pointCount = await (memoryService as any).countPoints(collectionId);
    
    // Get sample points to calculate additional statistics
    const sampleSize = Math.min(1000, pointCount); // Limit to 1000 points for performance
    const samplePoints = sampleSize > 0 
      ? await (memoryService as any).search(collectionId, { filter: {}, limit: sampleSize }) as MemoryPoint[]
      : [];
    
    // Calculate memory usage (approximate)
    // This is a rough estimate based on sample points
    let totalMemoryBytes = 0;
    let metadataSize = 0;
    let vectorSize = 0;
    
    if (samplePoints.length > 0) {
      // Calculate average sizes
      samplePoints.forEach((point: MemoryPoint) => {
        const pointJson = JSON.stringify(point);
        totalMemoryBytes += pointJson.length;
        
        const metadataJson = JSON.stringify(point.payload);
        metadataSize += metadataJson.length;
        
        const vectorJson = JSON.stringify(point.vector);
        vectorSize += vectorJson.length;
      });
      
      // Average per point
      totalMemoryBytes = Math.round(totalMemoryBytes / samplePoints.length);
      metadataSize = Math.round(metadataSize / samplePoints.length);
      vectorSize = Math.round(vectorSize / samplePoints.length);
      
      // Extrapolate to full collection
      totalMemoryBytes = totalMemoryBytes * pointCount;
      metadataSize = metadataSize * pointCount;
      vectorSize = vectorSize * pointCount;
    }
    
    // Get timestamp range (if available in sample)
    let oldestTimestamp: number | null = null;
    let newestTimestamp: number | null = null;
    
    samplePoints.forEach((point: MemoryPoint) => {
      // Try to find timestamp in top-level field first
      let pointTimestamp = point.timestamp;
      
      // Fall back to metadata
      if (!pointTimestamp && point.payload?.metadata?.timestamp) {
        pointTimestamp = point.payload.metadata.timestamp;
      }
      
      if (pointTimestamp) {
        const timestamp = typeof pointTimestamp === 'number' 
          ? pointTimestamp 
          : new Date(pointTimestamp).getTime();
        
        if (!isNaN(timestamp)) {
          if (oldestTimestamp === null || timestamp < oldestTimestamp) {
            oldestTimestamp = timestamp;
          }
          
          if (newestTimestamp === null || timestamp > newestTimestamp) {
            newestTimestamp = timestamp;
          }
        }
      }
    });
    
    // Get type distribution (if available in sample)
    const typeDistribution: Record<string, number> = {};
    samplePoints.forEach((point: MemoryPoint) => {
      // Look for a type field at various locations
      const pointType = point.messageType || 
                       point.type || 
                       point.payload?.metadata?.type ||
                       point.payload?.type || 
                       'unknown';
      
      typeDistribution[pointType] = (typeDistribution[pointType] || 0) + 1;
    });
    
    // Format type distribution as percentages
    const formattedTypeDistribution: Record<string, number> = {};
    if (samplePoints.length > 0) {
      Object.entries(typeDistribution).forEach(([type, count]) => {
        formattedTypeDistribution[type] = Math.round((count as number / samplePoints.length) * 100);
      });
    }
    
    const stats = {
      pointCount,
      sampleSize,
      memoryUsage: {
        totalBytes: totalMemoryBytes,
        formattedSize: formatBytes(totalMemoryBytes),
        metadataBytes: metadataSize,
        vectorBytes: vectorSize
      },
      timeRange: {
        oldest: oldestTimestamp ? new Date(oldestTimestamp).toISOString() : null,
        newest: newestTimestamp ? new Date(newestTimestamp).toISOString() : null,
        spanDays: oldestTimestamp && newestTimestamp 
          ? Math.round((newestTimestamp - oldestTimestamp) / (1000 * 60 * 60 * 24)) 
          : null
      },
      typeDistribution: formattedTypeDistribution,
      collectionMetadata: collection.metadata || {},
      lastUpdated: new Date().toISOString()
    };
    
    return NextResponse.json({ stats });
  } catch (error) {
    console.error(`Error getting collection stats for ${awaitedParams.collectionId}:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to format bytes into a human-readable format
 */
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
} 