/**
 * Operation Queue Implementation
 * 
 * A simple in-memory priority queue implementation with rate limiting and monitoring.
 * Follows clean break principles and interface-first design.
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  IOperationQueue, 
  OperationQueueItem, 
  OperationPayload, 
  OperationStatus, 
  OperationResult,
  OperationQueueConfig,
  OperationQueueStats,
  OperationType,
  OperationPriority
} from './types';

/**
 * Queue event types
 */
type QueueEventType = 'completed' | 'failed' | 'cancelled' | 'health';

/**
 * Simple event emitter implementation
 */
class SimpleEventEmitter {
  private listeners: Record<string, ((data: any) => void)[]> = {};

  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  emit(event: string, data: any): void {
    const callbacks = this.listeners[event] || [];
    callbacks.forEach(callback => callback(data));
  }
}

/**
 * Default queue configuration
 */
const DEFAULT_CONFIG: OperationQueueConfig = {
  maxSize: 1000,
  maxConcurrent: 10,
  rateLimit: 100, // operations per second
  retryDelay: 1000, // 1 second
  maxRetries: 3,
  priorityWeights: {
    [OperationPriority.HIGH]: 3,
    [OperationPriority.NORMAL]: 2,
    [OperationPriority.LOW]: 1
  }
};

/**
 * In-memory operation queue implementation
 */
export class OperationQueue implements IOperationQueue {
  private queue: OperationQueueItem[] = [];
  private processing: Set<string> = new Set();
  private config: OperationQueueConfig;
  private events: SimpleEventEmitter;
  private lastProcessedTime: number = 0;
  private stats: {
    completed: number;
    failed: number;
    cancelled: number;
    totalWaitTime: number;
    totalProcessingTime: number;
    typeCounts: Record<OperationType, number>;
    priorityCounts: Record<OperationPriority, number>;
    errors: number;
    retries: number;
  };

  constructor(config: Partial<OperationQueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.events = new SimpleEventEmitter();
    this.stats = {
      completed: 0,
      failed: 0,
      cancelled: 0,
      totalWaitTime: 0,
      totalProcessingTime: 0,
      typeCounts: Object.values(OperationType).reduce((acc, type) => {
        acc[type] = 0;
        return acc;
      }, {} as Record<OperationType, number>),
      priorityCounts: Object.values(OperationPriority).reduce((acc, priority) => {
        acc[priority] = 0;
        return acc;
      }, {} as Record<OperationPriority, number>),
      errors: 0,
      retries: 0
    };
  }

  /**
   * Enqueue a new operation
   */
  async enqueue<T extends OperationPayload>(item: Omit<OperationQueueItem<T>, 'id' | 'status' | 'retryCount'>): Promise<string> {
    if (this.queue.length >= this.config.maxSize) {
      throw new Error('Queue is at maximum capacity');
    }

    const queueItem: OperationQueueItem<T> = {
      ...item,
      id: uuidv4(),
      status: OperationStatus.PENDING,
      retryCount: 0
    };

    // Insert based on priority
    const insertIndex = this.queue.findIndex(
      existing => this.config.priorityWeights[existing.priority] < this.config.priorityWeights[queueItem.priority]
    );

    if (insertIndex === -1) {
      this.queue.push(queueItem);
    } else {
      this.queue.splice(insertIndex, 0, queueItem);
    }

    // Update statistics
    this.stats.typeCounts[item.payload.type]++;
    this.stats.priorityCounts[item.priority]++;

    return queueItem.id;
  }

  /**
   * Dequeue the next operation based on priority and rate limiting
   */
  async dequeue(): Promise<OperationQueueItem | undefined> {
    if (this.queue.length === 0 || this.processing.size >= this.config.maxConcurrent) {
      return undefined;
    }

    // Rate limiting check
    const now = Date.now();
    const timeSinceLastProcess = now - this.lastProcessedTime;
    const minTimeBetweenOps = Math.floor(1000 / this.config.rateLimit);
    
    if (timeSinceLastProcess < minTimeBetweenOps) {
      // Wait for the required time
      await new Promise(resolve => setTimeout(resolve, minTimeBetweenOps - timeSinceLastProcess));
    }

    const item = this.queue.shift();
    if (item) {
      item.status = OperationStatus.PROCESSING;
      item.startedAt = Date.now();
      this.processing.add(item.id);
      this.lastProcessedTime = Date.now();
    }

    return item;
  }

  /**
   * Process the next operation in the queue
   */
  async processNext(): Promise<void> {
    const item = await this.dequeue();
    if (!item) return;

    try {
      const result = await item.execute();
      
      if (result.success) {
        item.status = OperationStatus.COMPLETED;
        item.completedAt = Date.now();
        this.stats.completed++;
        this.events.emit('completed', { id: item.id, result });
      } else if (item.retryCount < item.maxRetries) {
        // Retry logic
        item.retryCount++;
        item.status = OperationStatus.PENDING;
        this.stats.retries++;
        this.queue.unshift(item);
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
      } else {
        item.status = OperationStatus.FAILED;
        this.stats.failed++;
        this.stats.errors++;
        this.events.emit('failed', { id: item.id, error: result.error });
      }

      // Update timing statistics
      if (item.startedAt && item.completedAt) {
        this.stats.totalProcessingTime += item.completedAt - item.startedAt;
        this.stats.totalWaitTime += item.startedAt - item.enqueuedAt;
      }
    } catch (error) {
      item.status = OperationStatus.FAILED;
      this.stats.failed++;
      this.stats.errors++;
      this.events.emit('failed', { id: item.id, error });
    } finally {
      this.processing.delete(item.id);
    }
  }

  /**
   * Process a batch of operations
   */
  async processBatch(batchSize: number = this.config.maxConcurrent): Promise<void> {
    const promises: Promise<void>[] = [];
    const actualBatchSize = Math.min(batchSize, this.config.maxConcurrent - this.processing.size);
    
    for (let i = 0; i < actualBatchSize; i++) {
      promises.push(this.processNext());
    }

    await Promise.all(promises);
  }

  /**
   * Get operation by ID
   */
  async getOperation(id: string): Promise<OperationQueueItem | undefined> {
    return this.queue.find(item => item.id === id) || 
           Array.from(this.processing).map(id => this.queue.find(item => item.id === id)).find(Boolean);
  }

  /**
   * Cancel an operation
   */
  async cancel(id: string): Promise<boolean> {
    const index = this.queue.findIndex(item => item.id === id);
    if (index === -1) return false;

    const item = this.queue.splice(index, 1)[0];
    item.status = OperationStatus.CANCELLED;
    this.stats.cancelled++;
    this.events.emit('cancelled', { id });
    return true;
  }

  /**
   * Get current queue statistics
   */
  getStats(): OperationQueueStats {
    const totalProcessed = this.stats.completed + this.stats.failed + this.stats.cancelled;
    const avgWaitTime = totalProcessed > 0 ? this.stats.totalWaitTime / totalProcessed : 0;
    const avgProcessingTime = totalProcessed > 0 ? this.stats.totalProcessingTime / totalProcessed : 0;
    const errorRate = totalProcessed > 0 ? this.stats.errors / totalProcessed : 0;
    const retryRate = totalProcessed > 0 ? this.stats.retries / totalProcessed : 0;

    return {
      size: this.queue.length,
      processing: this.processing.size,
      completed: this.stats.completed,
      failed: this.stats.failed,
      cancelled: this.stats.cancelled,
      averageWaitTime: avgWaitTime,
      averageProcessingTime: avgProcessingTime,
      rateLimit: this.config.rateLimit,
      priorityDistribution: this.stats.priorityCounts,
      typeDistribution: this.stats.typeCounts,
      errorRate,
      retryRate,
      retries: this.stats.retries
    };
  }

  /**
   * Update queue configuration
   */
  updateConfig(config: Partial<OperationQueueConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
    this.processing.clear();
    this.stats = {
      ...this.stats,
      completed: 0,
      failed: 0,
      cancelled: 0,
      totalWaitTime: 0,
      totalProcessingTime: 0,
      typeCounts: Object.values(OperationType).reduce((acc, type) => {
        acc[type] = 0;
        return acc;
      }, {} as Record<OperationType, number>),
      priorityCounts: Object.values(OperationPriority).reduce((acc, priority) => {
        acc[priority] = 0;
        return acc;
      }, {} as Record<OperationPriority, number>),
      errors: 0,
      retries: 0
    };
  }

  /**
   * Register event handlers
   */
  on(event: 'completed' | 'failed' | 'cancelled' | 'health', callback: (data: any) => void): void {
    this.events.on(event, callback);
  }
} 