/**
 * Operation Queue Tests
 * 
 * Tests for the in-memory operation queue implementation.
 */

import { OperationQueue } from './OperationQueue';
import { 
  OperationType, 
  OperationPriority, 
  OperationStatus,
  MemoryOperationPayload,
  QueryOperationPayload,
  AgentOperationPayload,
  SystemOperationPayload,
  OperationResult
} from './types';
import { MemoryType } from '../../config/types';

// Helper function to create test memory operation
const createTestMemoryOp = (): MemoryOperationPayload => ({
  type: OperationType.MEMORY_ADD,
  timestamp: Date.now(),
  memoryType: MemoryType.MESSAGE,
  content: 'test content'
});

describe('OperationQueue', () => {
  let queue: OperationQueue;

  beforeEach(() => {
    queue = new OperationQueue({
      maxSize: 10,
      maxConcurrent: 2,
      rateLimit: 100,
      retryDelay: 100,
      maxRetries: 2
    });
  });

  afterEach(() => {
    queue.clear();
  });

  describe('Basic Queue Operations', () => {
    it('should enqueue and process operations in priority order', async () => {
      const results: string[] = [];
      
      // Create operations with different priorities
      const lowOp = {
        payload: createTestMemoryOp(),
        priority: OperationPriority.LOW,
        enqueuedAt: Date.now(),
        maxRetries: 2,
        execute: async () => {
          results.push('low');
          return { success: true };
        }
      };

      const highOp = {
        ...lowOp,
        priority: OperationPriority.HIGH,
        execute: async () => {
          results.push('high');
          return { success: true };
        }
      };

      const normalOp = {
        ...lowOp,
        priority: OperationPriority.NORMAL,
        execute: async () => {
          results.push('normal');
          return { success: true };
        }
      };

      // Enqueue in random order
      await queue.enqueue(normalOp);
      await queue.enqueue(lowOp);
      await queue.enqueue(highOp);

      // Process all operations
      await queue.processBatch(3);

      // Should process in priority order: high -> normal -> low
      expect(results).toEqual(['high', 'normal', 'low']);
    });

    it('should respect rate limiting', async () => {
      const startTime = Date.now();
      const operations = Array(5).fill(null).map(() => ({
        payload: createTestMemoryOp(),
        priority: OperationPriority.NORMAL,
        enqueuedAt: Date.now(),
        maxRetries: 2,
        execute: async () => ({ success: true })
      }));

      // Enqueue all operations
      await Promise.all(operations.map(op => queue.enqueue(op)));

      // Process with rate limit of 100 ops/second
      await queue.processBatch(5);

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // With rate limit of 100 ops/second, 5 operations should take at least 40ms
      // (100 ops/sec = 1 op/10ms, so 5 ops should take at least 40ms)
      expect(duration).toBeGreaterThanOrEqual(40);
    });

    it('should handle operation failures and retries', async () => {
      let attempts = 0;
      const op = {
        payload: createTestMemoryOp(),
        priority: OperationPriority.NORMAL,
        enqueuedAt: Date.now(),
        maxRetries: 2,
        execute: async () => {
          attempts++;
          if (attempts < 2) {
            return { success: false, error: new Error('Temporary failure') };
          }
          return { success: true };
        }
      };

      const id = await queue.enqueue(op);
      await queue.processNext();

      // Should have retried once and succeeded
      expect(attempts).toBe(2);
      const stats = queue.getStats();
      expect(stats.retries).toBe(1);
      expect(stats.failed).toBe(0);
    });

    it('should maintain accurate statistics', async () => {
      const successOp = {
        payload: createTestMemoryOp(),
        priority: OperationPriority.NORMAL,
        enqueuedAt: Date.now(),
        maxRetries: 2,
        execute: async () => ({ success: true })
      };

      const failOp = {
        ...successOp,
        execute: async () => ({ success: false, error: new Error('Permanent failure') })
      };

      await queue.enqueue(successOp);
      await queue.enqueue(failOp);
      await queue.processBatch(2);

      const stats = queue.getStats();
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.typeDistribution[OperationType.MEMORY_ADD]).toBe(2);
      expect(stats.priorityDistribution[OperationPriority.NORMAL]).toBe(2);
    });
  });

  describe('Queue Management', () => {
    it('should enforce maximum queue size', async () => {
      const ops = Array(11).fill(null).map(() => ({
        payload: createTestMemoryOp(),
        priority: OperationPriority.NORMAL,
        enqueuedAt: Date.now(),
        maxRetries: 2,
        execute: async () => ({ success: true })
      }));

      // First 10 should succeed
      for (let i = 0; i < 10; i++) {
        await expect(queue.enqueue(ops[i])).resolves.toBeDefined();
      }

      // 11th should fail
      await expect(queue.enqueue(ops[10])).rejects.toThrow('Queue is at maximum capacity');
    });

    it('should allow operation cancellation', async () => {
      const op = {
        payload: createTestMemoryOp(),
        priority: OperationPriority.NORMAL,
        enqueuedAt: Date.now(),
        maxRetries: 2,
        execute: async () => ({ success: true })
      };

      const id = await queue.enqueue(op);
      const cancelled = await queue.cancel(id);
      
      expect(cancelled).toBe(true);
      const stats = queue.getStats();
      expect(stats.cancelled).toBe(1);
    });

    it('should process operations concurrently up to maxConcurrent', async () => {
      const processingTimes: number[] = [];
      const ops = Array(5).fill(null).map(() => ({
        payload: createTestMemoryOp(),
        priority: OperationPriority.NORMAL,
        enqueuedAt: Date.now(),
        maxRetries: 2,
        execute: async () => {
          const start = Date.now();
          await new Promise(resolve => setTimeout(resolve, 100)); // Simulate work
          processingTimes.push(Date.now() - start);
          return { success: true };
        }
      }));

      // Enqueue all operations
      await Promise.all(ops.map(op => queue.enqueue(op)));

      // Process with maxConcurrent = 2
      await queue.processBatch(5);

      // Should have processed in batches of 2
      expect(processingTimes.length).toBe(5);
      // First batch should start together
      expect(Math.abs(processingTimes[0] - processingTimes[1])).toBeLessThan(10);
      // Second batch should start after first batch
      expect(processingTimes[2] - processingTimes[0]).toBeGreaterThan(90);
    });
  });

  describe('Event Handling', () => {
    it('should emit events for operation completion', async () => {
      interface QueueEvent {
        id: string;
        error?: Error;
        result?: OperationResult;
      }

      const events: QueueEvent[] = [];
      queue.on('completed', (data: QueueEvent) => events.push(data));
      queue.on('failed', (data: QueueEvent) => events.push(data));

      const successOp = {
        payload: createTestMemoryOp(),
        priority: OperationPriority.NORMAL,
        enqueuedAt: Date.now(),
        maxRetries: 2,
        execute: async () => ({ success: true })
      };

      const failOp = {
        ...successOp,
        execute: async () => ({ success: false, error: new Error('Test error') })
      };

      const successId = await queue.enqueue(successOp);
      const failId = await queue.enqueue(failOp);
      await queue.processBatch(2);

      expect(events).toHaveLength(2);
      expect(events[0].id).toBe(successId);
      expect(events[1].id).toBe(failId);
      expect(events[1].error).toBeInstanceOf(Error);
    });
  });
}); 