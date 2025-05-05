/**
 * Test data generator utilities
 */
import { v4 as uuidv4 } from 'uuid';
import { MemoryType } from '../../config';
import { BaseMemorySchema, MemoryPoint } from '../../models';

/**
 * Generate a test memory point
 */
export function generateMemoryPoint<T extends BaseMemorySchema = BaseMemorySchema>(
  type: MemoryType = MemoryType.MESSAGE,
  options?: {
    id?: string;
    content?: string;
    timestamp?: number;
    metadata?: Record<string, any>;
    payload?: Partial<T>;
    vector?: number[];
  }
): MemoryPoint<T> {
  const id = options?.id || uuidv4();
  const timestamp = options?.timestamp || Date.now();
  const content = options?.content || `Test memory content for ${id}`;
  
  // Generate a simple deterministic vector if not provided
  let vector: number[] = options?.vector || [];
  if (!vector.length) {
    // Create a simple vector with 3 dimensions for testing
    vector = [0.1, 0.2, 0.3];
  }
  
  // Build the payload
  const payload = {
    id,
    text: content,
    type,
    timestamp: timestamp.toString(),
    metadata: options?.metadata || {},
    ...options?.payload
  } as unknown as T;
  
  return {
    id,
    vector,
    payload
  };
}

/**
 * Generate multiple test memory points
 */
export function generateMemoryPoints<T extends BaseMemorySchema = BaseMemorySchema>(
  count: number,
  type: MemoryType = MemoryType.MESSAGE,
  options?: {
    baseTimestamp?: number;
    baseContent?: string;
    metadata?: Record<string, any>;
    payload?: Partial<T>;
  }
): MemoryPoint<T>[] {
  const points: MemoryPoint<T>[] = [];
  const baseTimestamp = options?.baseTimestamp || Date.now();
  
  for (let i = 0; i < count; i++) {
    const id = uuidv4();
    const timestamp = baseTimestamp - (i * 60000); // Decrement by 1 minute for each
    const content = options?.baseContent 
      ? `${options.baseContent} ${i + 1}`
      : `Test memory content ${i + 1}`;
      
    points.push(generateMemoryPoint<T>(
      type,
      {
        id,
        content,
        timestamp,
        metadata: options?.metadata,
        payload: options?.payload,
        // Create a simple vector with slight variations
        vector: [0.1 + (i * 0.01), 0.2 + (i * 0.01), 0.3 + (i * 0.01)]
      }
    ));
  }
  
  return points;
}

/**
 * Test data for various memory types
 */
export function generateTestMemoryDataset(): Record<MemoryType, MemoryPoint<any>[]> {
  const dataset: Partial<Record<MemoryType, MemoryPoint<any>[]>> = {};
  const baseTimestamp = Date.now();
  
  // Generate message memories
  dataset[MemoryType.MESSAGE] = generateMemoryPoints(
    5, 
    MemoryType.MESSAGE,
    {
      baseTimestamp,
      baseContent: 'Message memory',
      metadata: {
        source: 'test',
        importance: 'medium'
      }
    }
  );
  
  // Generate document memories
  dataset[MemoryType.DOCUMENT] = generateMemoryPoints(
    3,
    MemoryType.DOCUMENT,
    {
      baseTimestamp,
      baseContent: 'Document memory',
      metadata: {
        source: 'test',
        filetype: 'text'
      }
    }
  );
  
  // Generate thought memories
  dataset[MemoryType.THOUGHT] = generateMemoryPoints(
    4,
    MemoryType.THOUGHT,
    {
      baseTimestamp,
      baseContent: 'Thought memory',
      metadata: {
        source: 'test',
        category: 'general'
      }
    }
  );
  
  // Generate task memories
  dataset[MemoryType.TASK] = generateMemoryPoints(
    2,
    MemoryType.TASK,
    {
      baseTimestamp,
      baseContent: 'Task memory',
      metadata: {
        source: 'test',
        status: 'pending'
      }
    }
  );
  
  return dataset as Record<MemoryType, MemoryPoint<any>[]>;
}

/**
 * Generate query text for testing search
 */
export function generateQueryText(type: MemoryType): string {
  const queries: Partial<Record<MemoryType, string>> = {
    [MemoryType.MESSAGE]: 'Message memory 1',
    [MemoryType.DOCUMENT]: 'Document memory 2',
    [MemoryType.THOUGHT]: 'Thought memory 3',
    [MemoryType.TASK]: 'Task memory 1',
    [MemoryType.MEMORY_EDIT]: 'Memory edit record 1'
  };
  
  return queries[type] || 'Test query';
} 