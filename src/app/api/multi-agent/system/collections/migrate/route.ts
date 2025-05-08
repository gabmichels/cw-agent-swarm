import { NextResponse } from 'next/server';
import { getMemoryServices } from '../../../../../../server/memory/services';

// Define interfaces for collections and memory points
interface Collection {
  name: string;
  vectorSize: number;
  type?: string;
  metadata?: Record<string, any>;
}

interface MemoryPoint {
  id: string;
  vector: number[];
  payload: Record<string, any>;
  [key: string]: any; // Allow additional properties for transforms
}

// Define transform function types
interface TransformOptions {
  field?: string;
  value?: any;
  sourcePath?: string;
  targetPath?: string;
  [key: string]: any;
}

interface TransformFunction {
  (points: MemoryPoint[], options: TransformOptions): MemoryPoint[];
}

interface TransformFunctions {
  [key: string]: TransformFunction;
}

/**
 * POST handler - migrate data between collections
 */
export async function POST(
  request: Request
) {
  try {
    console.log(`API DEBUG: POST multi-agent/system/collections/migrate`);
    
    const data = await request.json();
    
    // Validate request data
    if (!data.sourceCollectionId) {
      return NextResponse.json(
        { error: 'Source collection ID is required' },
        { status: 400 }
      );
    }
    
    if (!data.targetCollectionId) {
      return NextResponse.json(
        { error: 'Target collection ID is required' },
        { status: 400 }
      );
    }
    
    if (data.sourceCollectionId === data.targetCollectionId) {
      return NextResponse.json(
        { error: 'Source and target collections must be different' },
        { status: 400 }
      );
    }
    
    const { memoryService } = await getMemoryServices();
    
    // Check if collections exist
    const collections = await (memoryService as any).listCollections() as Collection[];
    const sourceExists = collections.some((c: Collection) => c.name === data.sourceCollectionId);
    const targetExists = collections.some((c: Collection) => c.name === data.targetCollectionId);
    
    if (!sourceExists) {
      return NextResponse.json(
        { error: `Source collection '${data.sourceCollectionId}' not found` },
        { status: 404 }
      );
    }
    
    if (!targetExists) {
      return NextResponse.json(
        { error: `Target collection '${data.targetCollectionId}' not found` },
        { status: 404 }
      );
    }
    
    // Get filter options (if any)
    const filter = data.filter || {};
    const limit = data.limit || 1000; // Default limit to prevent huge migrations
    
    // Get data from source collection
    const sourcePoints = await (memoryService as any).search(data.sourceCollectionId, { 
      filter,
      limit
    }) as MemoryPoint[];
    
    if (sourcePoints.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No points found matching the filter criteria',
        migratedCount: 0
      });
    }
    
    // Transform points if a transform function is provided
    let pointsToMigrate = sourcePoints;
    
    if (data.transform) {
      // For security reasons, we don't evaluate arbitrary code
      // Instead, we support common transform operations
      
      const transforms: TransformFunctions = {
        // Add a field to all points
        addField: (points: MemoryPoint[], options: TransformOptions): MemoryPoint[] => {
          return points.map((point: MemoryPoint) => ({
            ...point,
            [options.field as string]: options.value
          }));
        },
        
        // Move a field from one location to another
        moveField: (points: MemoryPoint[], options: TransformOptions): MemoryPoint[] => {
          return points.map((point: MemoryPoint) => {
            const newPoint = { ...point };
            // Get value from source path (simple dot notation)
            let value = point;
            const parts = (options.sourcePath as string).split('.');
            
            for (const part of parts) {
              value = value?.[part];
              if (value === undefined) break;
            }
            
            if (value !== undefined) {
              // Set value at target path
              let target: any = newPoint;
              const targetParts = (options.targetPath as string).split('.');
              
              for (let i = 0; i < targetParts.length - 1; i++) {
                const part = targetParts[i];
                if (!target[part]) target[part] = {};
                target = target[part];
              }
              
              target[targetParts[targetParts.length - 1]] = value;
            }
            
            return newPoint;
          });
        }
      };
      
      // Apply transform if it exists
      const transformType = data.transform.type as string;
      if (transformType && transforms[transformType]) {
        pointsToMigrate = transforms[transformType](pointsToMigrate, data.transform.options || {});
      }
    }
    
    // Prepare batch upload
    let migratedCount = 0;
    const batchSize = 100; // Process in batches to avoid memory issues
    
    for (let i = 0; i < pointsToMigrate.length; i += batchSize) {
      const batch = pointsToMigrate.slice(i, i + batchSize);
      
      // Add points to target collection
      for (const point of batch) {
        await (memoryService as any).add(data.targetCollectionId, point.vector, point.payload);
        migratedCount++;
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Successfully migrated ${migratedCount} points from '${data.sourceCollectionId}' to '${data.targetCollectionId}'`,
      migratedCount,
      totalPoints: sourcePoints.length
    });
  } catch (error) {
    console.error(`Error migrating collection:`, error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 