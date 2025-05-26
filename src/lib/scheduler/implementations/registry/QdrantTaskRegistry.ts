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
import { LRUCache } from 'lru-cache';

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
 * Qdrant implementation of the TaskRegistry interface with caching
 */
export class QdrantTaskRegistry implements TaskRegistry {
  private client: QdrantClient;
  private collectionName: string;
  private initialized = false;

  // Cache for task objects - improves read performance
  private taskCache: LRUCache<string, Task>;
  
  // Cache frequently accessed task lists (like pending tasks) for faster scheduling
  private queryCache: LRUCache<string, Task[]>;
  
  // Options for caching behavior
  private cacheOptions: CacheOptions;

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
    
    // Initialize caches
    this.taskCache = new LRUCache<string, Task>({
      max: this.cacheOptions.maxSize,
      ttl: this.cacheOptions.ttlMs,
    });
    
    this.queryCache = new LRUCache<string, Task[]>({
      max: 50, // Keep fewer query results in cache
      ttl: 30000, // Shorter TTL for query results (30 seconds)
    });
  }

  /**
   * Initialize the registry, ensuring the collection exists
   */
  async initialize(): Promise<void> {
    try {
      const collections = await this.client.getCollections();
      const collectionExists = collections.collections.some(
        collection => collection.name === this.collectionName
      );

      if (!collectionExists) {
        // Create the collection if it doesn't exist
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: 1, // Minimal vector size since we're not using vector search
            distance: 'Dot', // Doesn't matter for our use case
          },
        });
      }

      this.initialized = true;
    } catch (error) {
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
        key: 'metadata.status',
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

      // Store the task in Qdrant
      await this.client.upsert(this.collectionName, {
        points: [
          {
            id: this.ulidToUuid(taskToStore.id),
            payload: taskToStore as unknown as Record<string, unknown>,
            vector: [0], // Dummy vector
          },
        ],
      });

      // Update the cache with the new task
      this.taskCache.set(taskToStore.id, taskToStore);
      
      // Invalidate query cache since data has changed
      this.queryCache.clear();

      return taskToStore;
    } catch (error) {
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
      
      const task = payload as unknown as Task;
      
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
    // More lenient validation - just check for essential fields
    
    // Basic requirements: id and some form of task identification
    const hasId = typeof payload.id === 'string' && payload.id.length > 0;
    
    if (!hasId) {
      return false;
    }
    
    // Check for task type (can be in type field or metadata)
    const hasTaskType = (
      payload.type === 'task' ||
      (payload.metadata && 
       typeof payload.metadata === 'object' && 
       (payload.metadata as any).taskType)
    );
    
    if (!hasTaskType) {
      return false;
    }
    
    // Check for some form of status tracking
    const hasStatus = (
      typeof payload.status === 'string' ||
      (payload.metadata && 
       typeof payload.metadata === 'object' && 
       typeof (payload.metadata as any).status === 'string')
    );
    
    if (!hasStatus) {
      return false;
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
      for (const point of response.points) {
        const payload = point.payload as Record<string, unknown>;
        
        // Validate the payload has required Task properties before conversion
        if (this.isValidTaskPayload(payload)) {
          // Convert the Qdrant payload format to Task interface format
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
            name: (metadata.title as string) || (payload.text as string).slice(0, 50) + '...',
            status: metadata.status as TaskStatus,
            priority: this.convertPriority(metadata.priority as string) || 5, // Default medium priority
            scheduleType: TaskScheduleType.PRIORITY, // Default for converted tasks
            createdAt: createdAt,
            updatedAt: new Date(),
            metadata: metadata,
            handler: async (...args) => {
              // **REAL AGENT TASK EXECUTION - NO SIMULATION**
              try {
                // Create AgentTaskHandler for real execution
                const { AgentTaskHandler } = await import('../agent/AgentTaskHandler');
                const agentHandler = new AgentTaskHandler();
                
                // Execute through real agent planning system
                const executionResult = await agentHandler.handleTask(task);
                
                return {
                  success: executionResult.successful,
                  result: executionResult.result || 'Task completed through agent execution',
                  details: {
                    executedAt: new Date().toISOString(),
                    duration: executionResult.duration,
                    agentExecuted: true,
                    planAndExecuteUsed: true,
                    status: executionResult.status,
                    executionMethod: 'AgentTaskHandler.handleTask'
                  }
                };
              } catch (error) {
                return { 
                  success: false, 
                  result: 'Real agent execution failed',
                  error: error instanceof Error ? error.message : String(error),
                  details: {
                    executedAt: new Date().toISOString(),
                    agentExecuted: false,
                    executionMethod: 'AgentTaskHandler.handleTask',
                    errorType: 'AGENT_EXECUTION_FAILURE'
                  }
                };
              }
            }
          };
          
          tasks.push(task);
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
    // Simple deterministic mapping: use the ULID as a seed for consistent UUID generation
    // We'll create a hash-like transformation to ensure the same ULID always produces the same UUID
    let hash = 0;
    for (let i = 0; i < ulidString.length; i++) {
      hash = ((hash << 5) - hash + ulidString.charCodeAt(i)) & 0xffffffff;
    }
    
    // Convert to positive and create hex string
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    
    // Generate a deterministic UUID format
    // We'll use the original ULID string to create more entropy
    const part1 = ulidString.slice(0, 8).replace(/[^a-fA-F0-9]/g, '0').padStart(8, '0').slice(0, 8);
    const part2 = ulidString.slice(8, 12).replace(/[^a-fA-F0-9]/g, '0').padStart(4, '0').slice(0, 4);
    const part3 = '4' + ulidString.slice(12, 15).replace(/[^a-fA-F0-9]/g, '0').padStart(3, '0').slice(0, 3);
    const part4 = '8' + ulidString.slice(15, 18).replace(/[^a-fA-F0-9]/g, '0').padStart(3, '0').slice(0, 3);
    const part5 = ulidString.slice(18).replace(/[^a-fA-F0-9]/g, '0').padStart(12, '0').slice(0, 12);
    
    return `${part1}-${part2}-${part3}-${part4}-${part5}`;
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
} 