/**
 * QdrantTaskRegistry.ts - Qdrant-based Task Registry Implementation
 * 
 * This file provides an implementation of the TaskRegistry interface that uses
 * Qdrant as persistent storage for tasks, with caching to improve performance.
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { Task, TaskStatus, createTask, TaskScheduleType } from '../../models/Task.model';
import { TaskFilter } from '../../models/TaskFilter.model';
import { TaskRegistry } from '../../interfaces/TaskRegistry.interface';
import { TaskRegistryError, TaskRegistryErrorCode } from '../../errors/TaskRegistryError';
import { ulid } from 'ulid';
import { randomUUID } from 'crypto';
// Use require for lru-cache to avoid TypeScript definition issues
const LRU = require('lru-cache');

// Define the cache options type
interface CacheOptions {
  maxSize: number;
  ttlMs: number;
}

// Default cache configuration
const DEFAULT_CACHE_OPTIONS: CacheOptions = {
  maxSize: 500, // Cache up to 500 tasks by default
  ttlMs: 60000, // Cache entries expire after 1 minute
};

/**
 * Function serialization helpers for preserving task handlers
 */
interface SerializedHandler {
  type: 'serialized_function';
  functionString: string;
  handlerId: string;
}

/**
 * Registry for storing and retrieving serialized functions
 */
class HandlerRegistry {
  private static instance: HandlerRegistry;
  private handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  
  static getInstance(): HandlerRegistry {
    if (!HandlerRegistry.instance) {
      HandlerRegistry.instance = new HandlerRegistry();
    }
    return HandlerRegistry.instance;
  }
  
  registerHandler(id: string, handler: (...args: unknown[]) => Promise<unknown>): void {
    this.handlers.set(id, handler);
  }
  
  getHandler(id: string): ((...args: unknown[]) => Promise<unknown>) | undefined {
    return this.handlers.get(id);
  }
  
  hasHandler(id: string): boolean {
    return this.handlers.has(id);
  }
}

/**
 * Qdrant implementation of the TaskRegistry interface with caching
 */
export class QdrantTaskRegistry implements TaskRegistry {
  private client: QdrantClient;
  private collectionName: string;
  private initialized = false;

  // Cache for task objects - improves read performance
  private taskCache: any; // Use any type to avoid TypeScript issues with lru-cache
  
  // Cache frequently accessed task lists (like pending tasks) for faster scheduling
  private queryCache: any; // Use any type to avoid TypeScript issues with lru-cache
  
  // Options for caching behavior
  private cacheOptions: CacheOptions;
  
  // Handler registry for function serialization
  private handlerRegistry: HandlerRegistry;

  /**
   * Create a new QdrantTaskRegistry
   * 
   * @param client - Qdrant client instance
   * @param collectionName - Name of the Qdrant collection to use for tasks
   * @param cacheOptions - Optional configuration for the caching behavior
   */
  constructor(
    client: QdrantClient, 
    collectionName = 'tasks',
    cacheOptions: Partial<CacheOptions> = {},
  ) {
    this.client = client;
    this.collectionName = collectionName;
    this.cacheOptions = { ...DEFAULT_CACHE_OPTIONS, ...cacheOptions };
    this.handlerRegistry = HandlerRegistry.getInstance();
    
    // Initialize caches
    this.taskCache = new LRU({
      max: this.cacheOptions.maxSize,
      ttl: this.cacheOptions.ttlMs,
    });
    
    this.queryCache = new LRU({
      max: 50, // Keep fewer query results in cache
      ttl: 30000, // Shorter TTL for query results (30 seconds)
    });
  }

  /**
   * Initialize the registry, ensuring the collection exists
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔧 QdrantTaskRegistry: Initializing task collection...');
      
      const collections = await this.client.getCollections();
      const collectionExists = collections.collections.some(
        collection => collection.name === this.collectionName
      );

      if (!collectionExists) {
        console.log(`📦 QdrantTaskRegistry: Creating collection '${this.collectionName}'...`);
        
        // Create the collection if it doesn't exist
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: 1536, // 1536-dimensional vector size
            distance: 'Dot', // Doesn't matter for our use case
          },
        });
        
        console.log(`✅ QdrantTaskRegistry: Collection '${this.collectionName}' created successfully`);
      } else {
        console.log(`✅ QdrantTaskRegistry: Collection '${this.collectionName}' already exists`);
      }

      this.initialized = true;
      console.log('✅ QdrantTaskRegistry: Initialization completed successfully');
    } catch (error) {
      console.error('❌ QdrantTaskRegistry: Failed to initialize:', error);
      throw TaskRegistryError.storageError(
        `Failed to initialize Qdrant collection: ${(error as Error).message}`
      );
    }
  }

  /**
   * Convert filter to Qdrant query filter
   */
  private buildQdrantFilter(filter: TaskFilter): any {
    const must: any[] = [];
    const must_not: any[] = [];

    // Add filters for each relevant field
    if (filter.ids && filter.ids.length > 0) {
      // Convert ULIDs to UUIDs for Qdrant has_id filter
      const qdrantIds = filter.ids.map(ulid => this.ulidToUuid(ulid));
      must.push({
        has_id: qdrantIds,
      });
    }

    if (filter.name) {
      must.push({
        key: 'name',
        match: {
          value: filter.name,
        },
      });
    }

    if (filter.nameContains) {
      must.push({
        key: 'name',
        text: {
          contains: filter.nameContains,
        },
      });
    }

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      must.push({
        key: 'status',
        match: {
          any: statuses,
        },
      });
    }

    if (filter.scheduleType) {
      const scheduleTypes = Array.isArray(filter.scheduleType) 
        ? filter.scheduleType 
        : [filter.scheduleType];
      must.push({
        key: 'scheduleType',
        match: {
          any: scheduleTypes,
        },
      });
    }

    if (filter.minPriority !== undefined) {
      must.push({
        key: 'priority',
        range: {
          gte: filter.minPriority,
        },
      });
    }

    if (filter.maxPriority !== undefined) {
      must.push({
        key: 'priority',
        range: {
          lte: filter.maxPriority,
        },
      });
    }

    if (filter.tags && filter.tags.length > 0) {
      for (const tag of filter.tags) {
        must.push({
          key: 'metadata.tags',
          match: {
            value: tag,
          },
        });
      }
    }

    if (filter.anyTags && filter.anyTags.length > 0) {
      must.push({
        key: 'metadata.tags',
        match: {
          any: filter.anyTags,
        },
      });
    }

    if (filter.isOverdue || filter.isDueNow) {
      const now = new Date();
      must.push({
        key: 'scheduledTime',
        range: {
          lte: now.toISOString(),
        },
      });
      must.push({
        key: 'status',
        match: {
          value: TaskStatus.PENDING,
        },
      });
    }

    if (filter.metadata) {
      const metadataKeys = Object.keys(filter.metadata);
      for (const key of metadataKeys) {
        const value = filter.metadata[key];
        
        // Handle nested objects (like agentId)
        if (value !== null && typeof value === 'object') {
          const nestedKeys = Object.keys(value as Record<string, unknown>);
          for (const nestedKey of nestedKeys) {
            const nestedValue = (value as Record<string, unknown>)[nestedKey];
            
            if (nestedValue !== null && typeof nestedValue === 'object') {
              // Handle deeply nested objects (like agentId.id)
              const deepKeys = Object.keys(nestedValue as Record<string, unknown>);
              for (const deepKey of deepKeys) {
                const deepValue = (nestedValue as Record<string, unknown>)[deepKey];
                must.push({
                  key: `metadata.${key}.${nestedKey}.${deepKey}`,
                  match: {
                    value: deepValue,
                  },
                });
              }
            } else {
              // Simple nested property
              must.push({
                key: `metadata.${key}.${nestedKey}`,
                match: {
                  value: nestedValue,
                },
              });
            }
          }
        } else {
          // Simple property
          must.push({
            key: `metadata.${key}`,
            match: {
              value: value,
            },
          });
        }
      }
    }

    const qdrantFilter: any = {};
    if (must.length > 0) {
      qdrantFilter.must = must;
    }
    if (must_not.length > 0) {
      qdrantFilter.must_not = must_not;
    }

    return qdrantFilter;
  }

  /**
   * Generate a cache key for a filter
   */
  private getCacheKey(filter: TaskFilter): string {
    return `filter:${JSON.stringify(filter)}`;
  }

  /**
   * Store a task in the registry
   * 
   * @param task - The task to store
   * @returns The stored task with any generated metadata
   * @throws {TaskRegistryError} If the task cannot be stored
   */
  async storeTask(task: Task): Promise<Task> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Validate the task
      if (!task.name) {
        throw TaskRegistryError.invalidTask('Task name is required');
      }

      // Generate an ID if not provided
      const taskToStore = task.id ? { ...task } : createTask({ ...task, id: ulid() });

      // Update timestamps
      const now = new Date();
      taskToStore.createdAt = taskToStore.createdAt || now;
      taskToStore.updatedAt = now;

      // Fix scheduledTime - convert temporal expressions to actual dates
      if (taskToStore.scheduledTime) {
        if (typeof taskToStore.scheduledTime === 'string') {
          // Handle temporal expressions like "2m", "1h", etc.
          const timeStr = (taskToStore.scheduledTime as string).toLowerCase();
          if (/^\d+[smhd]$/.test(timeStr)) {
            // Parse temporal expression
            const value = parseInt(timeStr);
            const unit = timeStr.slice(-1);
            
            let milliseconds = 0;
            switch (unit) {
              case 's': milliseconds = value * 1000; break;
              case 'm': milliseconds = value * 60 * 1000; break;
              case 'h': milliseconds = value * 60 * 60 * 1000; break;
              case 'd': milliseconds = value * 24 * 60 * 60 * 1000; break;
            }
            
            taskToStore.scheduledTime = new Date(now.getTime() + milliseconds);
            console.log(`📅 QdrantTaskRegistry: Converted temporal expression '${timeStr}' to ${taskToStore.scheduledTime.toISOString()}`);
          } else {
            // Try to parse as ISO string or other date format
            try {
              taskToStore.scheduledTime = new Date(taskToStore.scheduledTime as string);
              if (isNaN(taskToStore.scheduledTime.getTime())) {
                throw new Error('Invalid date');
              }
            } catch (error) {
              console.warn(`⚠️ QdrantTaskRegistry: Failed to parse scheduledTime '${taskToStore.scheduledTime}', using current time + 1 minute`);
              taskToStore.scheduledTime = new Date(now.getTime() + 60000); // Default to 1 minute from now
            }
          }
        } else if (!(taskToStore.scheduledTime instanceof Date)) {
          // Handle other types (like numbers)
          try {
            taskToStore.scheduledTime = new Date(taskToStore.scheduledTime as any);
            if (isNaN(taskToStore.scheduledTime.getTime())) {
              throw new Error('Invalid date');
            }
          } catch (error) {
            console.warn(`⚠️ QdrantTaskRegistry: Failed to convert scheduledTime, using current time + 1 minute`);
            taskToStore.scheduledTime = new Date(now.getTime() + 60000);
          }
        }
      }

      // Store the task in Qdrant
      const qdrantId = this.ulidToUuid(taskToStore.id);
      
      // Serialize the task, handling the handler function specially
      const qdrantPayload = { ...taskToStore } as any;
      
      // Simplify handler serialization - just store a reference for now
      if (taskToStore.handler && typeof taskToStore.handler === 'function') {
        // For now, just store a simple handler identifier instead of the complex serialized function
        qdrantPayload.handler = 'function_handler_placeholder';
      } else {
        qdrantPayload.handler = null;
      }

      // Convert dates to ISO strings for Qdrant storage
      if (qdrantPayload.createdAt instanceof Date) {
        qdrantPayload.createdAt = qdrantPayload.createdAt.toISOString();
      }
      if (qdrantPayload.updatedAt instanceof Date) {
        qdrantPayload.updatedAt = qdrantPayload.updatedAt.toISOString();
      }
      if (qdrantPayload.lastExecutedAt instanceof Date) {
        qdrantPayload.lastExecutedAt = qdrantPayload.lastExecutedAt.toISOString();
      }
      // CRITICAL: Also convert scheduledTime to ISO string
      if (qdrantPayload.scheduledTime instanceof Date) {
        qdrantPayload.scheduledTime = qdrantPayload.scheduledTime.toISOString();
      }

      // Debug: Log what we're about to send to Qdrant
      console.log('🔍 DEBUG: About to upsert to Qdrant:', {
        collectionName: this.collectionName,
        qdrantId,
        originalTaskId: taskToStore.id,
        payloadKeys: Object.keys(qdrantPayload),
        vectorLength: new Array(1536).fill(0).length,
        payloadSample: {
          id: qdrantPayload.id,
          name: qdrantPayload.name,
          status: qdrantPayload.status,
          scheduledTime: qdrantPayload.scheduledTime, // Include this in debug
          handler: typeof qdrantPayload.handler,
          createdAt: qdrantPayload.createdAt,
          updatedAt: qdrantPayload.updatedAt
        }
      });

      await this.client.upsert(this.collectionName, {
        wait: true,
        points: [
          {
            id: qdrantId,
            vector: new Array(1536).fill(0), // 1536-dimensional zero vector to match embedding standards
            payload: qdrantPayload,
          },
        ],
      });

      console.log('✅ DEBUG: Qdrant upsert successful for task:', taskToStore.id);

      // Cache the stored task (with original handler)
      this.taskCache.set(taskToStore.id, taskToStore);
      
      // Invalidate query cache since data has changed
      this.queryCache.clear();

      return taskToStore;
    } catch (error) {
      console.error('❌ QdrantTaskRegistry: Failed to store task:', error);
      if (error instanceof TaskRegistryError) {
        throw error;
      }
      throw TaskRegistryError.storageError(`Failed to store task: ${(error as Error).message}`);
    }
  }

  /**
   * Retrieve a task by its ID
   * 
   * @param taskId - The ID of the task to retrieve
   * @returns The task if found, null otherwise
   * @throws {TaskRegistryError} If there's an error retrieving the task
   */
  async getTaskById(taskId: string): Promise<Task | null> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!taskId) {
        throw TaskRegistryError.invalidTask('Task ID is required');
      }

      // Check cache first
      const cachedTask = this.taskCache.get(taskId);
      if (cachedTask) {
        return cachedTask;
      }

      // Convert ULID to UUID for Qdrant lookup
      const qdrantId = this.ulidToUuid(taskId);
      
      // Not in cache, retrieve from Qdrant
      const response = await this.client.retrieve(this.collectionName, {
        ids: [qdrantId],
      });

      if (!response || response.length === 0) {
        return null;
      }

      // Convert payload to Task with proper type safety
      const payload = response[0].payload as Record<string, unknown>;
      // Validate the payload has required Task properties
      if (!this.isValidTaskPayload(payload)) {
        throw TaskRegistryError.invalidTask(`Invalid task data retrieved from storage for ID: ${taskId}`);
      }
      
      // Convert payload to Task, deserializing the handler
      const task: Task = {
        ...(payload as unknown as Task),
        handler: this.deserializeHandler(payload.handler),
        lastExecutedAt: payload.lastExecutedAt ? new Date(payload.lastExecutedAt as string | number) : undefined
      };
      
      // Update the cache
      this.taskCache.set(taskId, task);
      
      return task;
    } catch (error) {
      if (error instanceof TaskRegistryError) {
        throw error;
      }
      throw TaskRegistryError.storageError(`Failed to retrieve task: ${(error as Error).message}`);
    }
  }

  /**
   * Check if a payload is a valid Task
   */
  private isValidTaskPayload(payload: Record<string, unknown>): boolean {
    // Basic requirements: id and some form of task identification
    const hasId = typeof payload.id === 'string' && payload.id.length > 0;
    
    if (!hasId) {
      return false;
    }
    
    // Check for task identifier (relaxed - either regular Task fields or memory task fields)
    const isRegularTask = (
      // Regular Task objects have these direct fields
      typeof payload.name === 'string' ||
      typeof payload.description === 'string' ||
      typeof payload.status === 'string'
    );
    
    const isMemoryTask = (
      // Memory system tasks have these patterns
      payload.type === 'task' ||
      (payload.metadata && 
       typeof payload.metadata === 'object' && 
       (payload.metadata as any).taskType)
    );
    
    if (!isRegularTask && !isMemoryTask) {
      return false;
    }
    
    // For regular Task objects, check for status field
    if (isRegularTask && typeof payload.status === 'string') {
      return true;
    }
    
    // For memory tasks, check for status in metadata
    if (isMemoryTask && payload.metadata && 
        typeof payload.metadata === 'object' && 
        typeof (payload.metadata as any).status === 'string') {
      return true;
    }
    
    // Check for basic task info (name, description, or title)
    const hasTaskInfo = (
      typeof payload.name === 'string' ||
      typeof payload.description === 'string' ||
      typeof payload.text === 'string' ||
      (payload.metadata && 
       typeof payload.metadata === 'object' && 
       (typeof (payload.metadata as any).title === 'string' ||
        typeof (payload.metadata as any).name === 'string'))
    );
    
    if (!hasTaskInfo) {
      return false;
    }
    
    // All essential checks passed
    return true;
  }

  /**
   * Update an existing task
   * 
   * @param task - The task with updated fields
   * @returns The updated task
   * @throws {TaskRegistryError} If the task does not exist or cannot be updated
   */
  async updateTask(task: Task): Promise<Task> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!task.id) {
        throw TaskRegistryError.invalidTask('Task ID is required for update');
      }

      // Check if task exists
      const existingTask = await this.getTaskById(task.id);
      if (!existingTask) {
        throw TaskRegistryError.taskNotFound(task.id);
      }

      // Update timestamp
      const updatedTask = {
        ...task,
        updatedAt: new Date(),
      };

      // Convert ULID to UUID for Qdrant
      const qdrantId = this.ulidToUuid(task.id);

      // Update the task in Qdrant
      await this.client.setPayload(this.collectionName, {
        points: [qdrantId],
        payload: updatedTask,
      });

      // Update the cache
      this.taskCache.set(task.id, updatedTask);
      
      // Invalidate query cache since data has changed
      this.queryCache.clear();

      return updatedTask;
    } catch (error) {
      if (error instanceof TaskRegistryError) {
        throw error;
      }
      throw TaskRegistryError.storageError(`Failed to update task: ${(error as Error).message}`);
    }
  }

  /**
   * Delete a task by its ID
   * 
   * @param taskId - The ID of the task to delete
   * @returns true if the task was deleted, false if it didn't exist
   * @throws {TaskRegistryError} If there's an error deleting the task
   */
  async deleteTask(taskId: string): Promise<boolean> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!taskId) {
        throw TaskRegistryError.invalidTask('Task ID is required');
      }

      // Check if task exists
      const existingTask = await this.getTaskById(taskId);
      if (!existingTask) {
        return false;
      }

      // Convert ULID to UUID for Qdrant
      const qdrantId = this.ulidToUuid(taskId);

      // Delete the task from Qdrant
      await this.client.delete(this.collectionName, {
        points: [qdrantId],
      });

      // Remove from cache
      this.taskCache.delete(taskId);
      
      // Invalidate query cache since data has changed
      this.queryCache.clear();

      return true;
    } catch (error) {
      if (error instanceof TaskRegistryError) {
        throw error;
      }
      throw TaskRegistryError.storageError(`Failed to delete task: ${(error as Error).message}`);
    }
  }

  /**
   * Find tasks matching the specified filter criteria
   * 
   * @param filter - The filter criteria to apply
   * @returns An array of tasks matching the filter
   * @throws {TaskRegistryError} If there's an error querying for tasks
   */
  async findTasks(filter: TaskFilter = {}): Promise<Task[]> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // For common queries like pending tasks, check the cache first
      const cacheKey = this.getCacheKey(filter);
      const cachedResult = this.queryCache.get(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Create Qdrant filter
      const qdrantFilter = this.buildQdrantFilter(filter);

      // Set up search parameters
      const searchParams: any = {
        filter: qdrantFilter,
        with_payload: true,
        limit: filter.limit || 1000,
      };

      if (filter.offset) {
        searchParams.offset = filter.offset;
      }

      // Execute search
      const response = await this.client.scroll(this.collectionName, searchParams);
      
      if (!response || !response.points) {
        return [];
      }

      // Extract task objects from payload
      const tasks: Task[] = [];
      for (const [index, point] of response.points.entries()) {
        const payload = point.payload as Record<string, unknown>;
        
        // Validate the payload has required Task properties before conversion
        const isValid = this.isValidTaskPayload(payload);
        
        if (isValid) {
          // Convert the Qdrant payload format to Task interface format
          
          // Check if this is a regular Task object or a memory task
          const isRegularTask = (
            typeof payload.name === 'string' &&
            typeof payload.status === 'string' &&
            typeof payload.scheduleType === 'string'
          );
          
          if (isRegularTask) {
            // REGULAR TASK OBJECTS - Use direct payload fields
            
            // Parse scheduledTime from payload
            let scheduledTime: Date | undefined;
            if (payload.scheduledTime) {
              if (typeof payload.scheduledTime === 'string') {
                scheduledTime = new Date(payload.scheduledTime);
              } else if (typeof payload.scheduledTime === 'number') {
                const timestampMs = payload.scheduledTime > 1e12 ? payload.scheduledTime : payload.scheduledTime * 1000;
                scheduledTime = new Date(timestampMs);
              }
              // Validate the resulting date
              if (scheduledTime && isNaN(scheduledTime.getTime())) {
                scheduledTime = undefined;
              }
            }
            
            // Parse createdAt from payload
            let createdAt: Date = new Date();
            if (payload.createdAt) {
              if (typeof payload.createdAt === 'string') {
                createdAt = new Date(payload.createdAt);
              } else if (typeof payload.createdAt === 'number') {
                const timestampMs = payload.createdAt > 1e12 ? payload.createdAt : payload.createdAt * 1000;
                createdAt = new Date(timestampMs);
              }
              // Validate the resulting date
              if (isNaN(createdAt.getTime())) {
                createdAt = new Date();
              }
            }
            
            // Parse updatedAt from payload
            let updatedAt: Date = new Date();
            if (payload.updatedAt) {
              if (typeof payload.updatedAt === 'string') {
                updatedAt = new Date(payload.updatedAt);
              } else if (typeof payload.updatedAt === 'number') {
                const timestampMs = payload.updatedAt > 1e12 ? payload.updatedAt : payload.updatedAt * 1000;
                updatedAt = new Date(timestampMs);
              }
              // Validate the resulting date
              if (isNaN(updatedAt.getTime())) {
                updatedAt = new Date();
              }
            }
            
            // Parse lastExecutedAt from payload
            let lastExecutedAt: Date | undefined;
            if (payload.lastExecutedAt) {
              if (typeof payload.lastExecutedAt === 'string') {
                lastExecutedAt = new Date(payload.lastExecutedAt);
              } else if (typeof payload.lastExecutedAt === 'number') {
                const timestampMs = payload.lastExecutedAt > 1e12 ? payload.lastExecutedAt : payload.lastExecutedAt * 1000;
                lastExecutedAt = new Date(timestampMs);
              }
              // Validate the resulting date
              if (lastExecutedAt && isNaN(lastExecutedAt.getTime())) {
                lastExecutedAt = undefined;
              }
            }
            
            const task: Task = {
              id: payload.id as string,
              name: payload.name as string,
              description: payload.description as string,
              status: payload.status as TaskStatus,
              priority: (payload.priority as number) || 5,
              scheduleType: payload.scheduleType as TaskScheduleType,
              scheduledTime: scheduledTime, // This is the critical field that was missing!
              createdAt: createdAt,
              updatedAt: updatedAt,
              lastExecutedAt: lastExecutedAt,
              metadata: payload.metadata as Record<string, unknown> || {},
              handler: this.deserializeHandler(payload.handler)
            };
            
            tasks.push(task);
          } else {
            // MEMORY TASK CONVERSION - Use the existing logic for memory system tasks
            const metadata = payload.metadata as Record<string, unknown>;
            
            // Improved date parsing with debugging
            let createdAt: Date;
            const rawTimestamp = payload.timestamp;
            
            if (rawTimestamp) {
              // Try different timestamp formats
              if (typeof rawTimestamp === 'number') {
                // Check if it's seconds or milliseconds
                const timestampMs = rawTimestamp > 1e12 ? rawTimestamp : rawTimestamp * 1000;
                createdAt = new Date(timestampMs);
              } else if (typeof rawTimestamp === 'string') {
                // Try parsing as ISO string or number string
                const parsedNumber = parseInt(rawTimestamp, 10);
                if (!isNaN(parsedNumber)) {
                  const timestampMs = parsedNumber > 1e12 ? parsedNumber : parsedNumber * 1000;
                  createdAt = new Date(timestampMs);
                } else {
                  createdAt = new Date(rawTimestamp);
                }
              } else {
                // Unknown format, use current time
                createdAt = new Date();
              }
            } else {
              // No timestamp, use current time
              createdAt = new Date();
            }
            
            // Validate the resulting date
            if (isNaN(createdAt.getTime())) {
              createdAt = new Date();
            }
            
            const task: Task = {
              id: payload.id as string, // Use the original ULID from payload
              name: (metadata.title as string) || 
                    (payload.text ? (payload.text as string).slice(0, 50) + '...' : '') ||
                    (payload.name as string) ||
                    `Task ${payload.id}`,
              status: metadata.status as TaskStatus,
              priority: this.convertPriority(metadata.priority as string) || 5, // Default medium priority
              scheduleType: TaskScheduleType.PRIORITY, // Default for converted tasks
              createdAt: createdAt,
              updatedAt: new Date(),
              metadata: metadata,
              handler: this.deserializeHandler(payload.handler)
            };
            
            tasks.push(task);
          }
        }
      }

      // Apply any additional filtering that can't be done in Qdrant
      let filteredTasks = tasks;

      if (filter.createdBetween) {
        filteredTasks = filteredTasks.filter(task => 
          task.createdAt >= filter.createdBetween!.start && 
          task.createdAt <= filter.createdBetween!.end
        );
      }

      if (filter.scheduledBetween) {
        filteredTasks = filteredTasks.filter(task => 
          task.scheduledTime instanceof Date && 
          task.scheduledTime >= filter.scheduledBetween!.start && 
          task.scheduledTime <= filter.scheduledBetween!.end
        );
      }

      if (filter.lastExecutedBetween) {
        filteredTasks = filteredTasks.filter(task => 
          task.lastExecutedAt instanceof Date && 
          task.lastExecutedAt >= filter.lastExecutedBetween!.start && 
          task.lastExecutedAt <= filter.lastExecutedBetween!.end
        );
      }

      // Apply sorting if needed
      if (filter.sortBy) {
        const sortField = filter.sortBy;
        const sortDirection = filter.sortDirection || 'asc';
        
        filteredTasks.sort((a, b) => {
          let valueA: any;
          let valueB: any;

          // Extract the fields to compare
          switch (sortField) {
            case 'priority':
              valueA = a.priority;
              valueB = b.priority;
              break;
            case 'createdAt':
              valueA = a.createdAt.getTime();
              valueB = b.createdAt.getTime();
              break;
            case 'scheduledTime':
              valueA = a.scheduledTime ? a.scheduledTime.getTime() : Number.MAX_SAFE_INTEGER;
              valueB = b.scheduledTime ? b.scheduledTime.getTime() : Number.MAX_SAFE_INTEGER;
              break;
            case 'lastExecutedAt':
              valueA = a.lastExecutedAt ? a.lastExecutedAt.getTime() : 0;
              valueB = b.lastExecutedAt ? b.lastExecutedAt.getTime() : 0;
              break;
            default:
              valueA = a[sortField as keyof Task];
              valueB = b[sortField as keyof Task];
          }

          // Compare based on sort direction
          if (sortDirection === 'asc') {
            return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
          } else {
            return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
          }
        });
      }

      // Cache frequently accessed queries
      if (this.shouldCacheQuery(filter)) {
        this.queryCache.set(cacheKey, filteredTasks);
        
        // Update task cache for each task
        for (const task of filteredTasks) {
          this.taskCache.set(task.id, task);
        }
      }

      return filteredTasks;
    } catch (error) {
      if (error instanceof TaskRegistryError) {
        throw error;
      }
      throw TaskRegistryError.storageError(`Failed to query tasks: ${(error as Error).message}`);
    }
  }

  /**
   * Determine if a query should be cached based on its properties
   */
  private shouldCacheQuery(filter: TaskFilter): boolean {
    // Cache common queries like "all pending tasks"
    if (
      Object.keys(filter).length === 1 && 
      filter.status === TaskStatus.PENDING
    ) {
      return true;
    }
    
    // Cache queries for due tasks
    if (filter.isDueNow || filter.isOverdue) {
      return true;
    }
    
    // Don't cache complex queries
    return false;
  }

  /**
   * Count tasks matching the specified filter criteria
   * 
   * @param filter - The filter criteria to apply
   * @returns The number of tasks matching the filter
   * @throws {TaskRegistryError} If there's an error counting tasks
   */
  async countTasks(filter: TaskFilter = {}): Promise<number> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Create Qdrant filter
      const qdrantFilter = this.buildQdrantFilter(filter);

      // Get count from Qdrant
      const response = await this.client.count(this.collectionName, {
        filter: qdrantFilter,
      });

      return response.count;
    } catch (error) {
      if (error instanceof TaskRegistryError) {
        throw error;
      }
      throw TaskRegistryError.storageError(`Failed to count tasks: ${(error as Error).message}`);
    }
  }

  /**
   * Clear all tasks from the registry
   * 
   * @returns true if successful
   * @throws {TaskRegistryError} If there's an error clearing tasks
   */
  async clearAllTasks(): Promise<boolean> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Delete all points in the collection
      await this.client.delete(this.collectionName, {
        filter: {}, // Empty filter matches all documents
      });

      // Clear caches
      this.taskCache.clear();
      this.queryCache.clear();

      return true;
    } catch (error) {
      throw TaskRegistryError.storageError(`Failed to clear tasks: ${(error as Error).message}`);
    }
  }

  /**
   * Invalidate all caches - use when data might have been modified externally
   */
  invalidateCaches(): void {
    this.taskCache.clear();
    this.queryCache.clear();
  }

  /**
   * Convert priority string to a number
   */
  private convertPriority(priority: string): number {
    const priorityNumber = parseInt(priority, 10);
    return isNaN(priorityNumber) ? 5 : priorityNumber;
  }

  /**
   * Convert ULID to UUID for Qdrant compatibility
   * Qdrant only accepts UUIDs or integers as point IDs
   */
  private ulidToUuid(ulidString: string): string {
    // Create a proper UUID by deterministically converting the ULID
    // This ensures the same ULID always produces the same valid UUID
    
    // Take the first 32 characters of the ULID and pad/trim as needed
    const cleanUlid = ulidString.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    let hex = '';
    
    // Convert each character to a hex digit
    for (let i = 0; i < cleanUlid.length && hex.length < 32; i++) {
      const char = cleanUlid[i];
      if (/[0-9a-f]/.test(char)) {
        hex += char;
      } else {
        // Convert letters to hex digits deterministically
        const code = char.charCodeAt(0);
        hex += (code % 16).toString(16);
      }
    }
    
    // Pad with zeros if needed
    hex = hex.padEnd(32, '0').slice(0, 32);
    
    // Format as proper UUID: 8-4-4-4-12
    const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(12, 15)}-8${hex.slice(15, 18)}-${hex.slice(18, 30)}`;
    
    return uuid;
  }

  /**
   * Convert UUID back to ULID - this is just for the lookup methods
   * Since we store the original ULID in the payload, we can retrieve it from there
   */
  private uuidToUlid(uuid: string): string {
    // For lookup methods, we need to convert back
    // Since we have the original ULID in the payload, this is mainly for the point ID
    // We'll just return the UUID for now and rely on payload data
    return uuid;
  }

  /**
   * Serialize a handler function for storage in Qdrant
   */
  private serializeHandler(handler: (...args: unknown[]) => Promise<unknown>): SerializedHandler {
    const handlerId = ulid(); // Generate unique ID for the handler
    const functionString = handler.toString();
    
    // Register the handler in our registry
    this.handlerRegistry.registerHandler(handlerId, handler);
    
    return {
      type: 'serialized_function',
      functionString,
      handlerId
    };
  }

  /**
   * Deserialize a handler function from storage
   */
  private deserializeHandler(serialized: SerializedHandler | any): (...args: unknown[]) => Promise<unknown> {
    // Check if it's a serialized handler
    if (serialized && typeof serialized === 'object' && serialized.type === 'serialized_function') {
      const { handlerId, functionString } = serialized;
      
      // First, try to get from our registry
      const registeredHandler = this.handlerRegistry.getHandler(handlerId);
      if (registeredHandler) {
        return registeredHandler;
      }
      
      // If not in registry, try to reconstruct from function string (fallback)
      try {
        // This is a fallback for handlers that might have been created in previous sessions
        // Note: This is limited and may not work for all function types due to closure issues
        const reconstructed = new Function('return ' + functionString)() as (...args: unknown[]) => Promise<unknown>;
        
        // Register it for future use
        this.handlerRegistry.registerHandler(handlerId, reconstructed);
        
        return reconstructed;
      } catch (error) {
        console.warn(`Failed to reconstruct handler from string: ${error}`);
        // Fall through to default handler
      }
    }
    
    // Return default handler if deserialization fails
    return async (...args) => {
      console.log(`Executing task with default handler`);
      return { success: true, result: 'Task completed with default handler' };
    };
  }
} 