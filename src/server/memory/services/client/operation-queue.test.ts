import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { OperationQueue } from './operation-queue';
import { OperationQueueItem, OperationPriority } from './types';

describe('OperationQueue', () => {
  let queue: OperationQueue;
  let mockExecute: Mock;
  let mockItem: OperationQueueItem;

  beforeEach(() => {
    vi.useFakeTimers();
    queue = new OperationQueue({
      maxConcurrent: 2,
      rateLimit: 10,
      batchSize: 3,
      healthCheckIntervalMs: 1000
    });
    mockExecute = vi.fn().mockResolvedValue(undefined);
    mockItem = {
      id: 'test-1',
      payload: { data: 'test' },
      priority: 'normal' as OperationPriority,
      enqueuedAt: Date.now(),
      execute: mockExecute
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    queue.clear();
  });

  describe('Basic Queue Operations', () => {
    it('should enqueue and dequeue items', async () => {
      await queue.enqueue(mockItem);
      const dequeued = await queue.dequeue();
      expect(dequeued).toEqual(mockItem);
      expect(queue.getStats().size).toBe(0);
    });

    it('should maintain queue order by priority', async () => {
      const lowPriority = { ...mockItem, id: 'low', priority: 'low' as OperationPriority };
      const highPriority = { ...mockItem, id: 'high', priority: 'high' as OperationPriority };
      const normalPriority = { ...mockItem, id: 'normal', priority: 'normal' as OperationPriority };

      await queue.enqueue(lowPriority);
      await queue.enqueue(normalPriority);
      await queue.enqueue(highPriority);

      const first = await queue.dequeue();
      const second = await queue.dequeue();
      const third = await queue.dequeue();

      expect(first?.id).toBe('high');
      expect(second?.id).toBe('normal');
      expect(third?.id).toBe('low');
    });
  });

  describe('Processing Operations', () => {
    it('should process items within rate limit', async () => {
      vi.useRealTimers();
      const items = Array.from({ length: 5 }, (_, i) => ({
        ...mockItem,
        id: `test-${i}`,
        execute: vi.fn().mockResolvedValue(undefined)
      }));

      for (const item of items) {
        await queue.enqueue(item);
      }

      // Wait for the completed event
      const completedPromise = new Promise<void>(resolve => {
        queue.on('completed', () => resolve());
      });
      await queue.processNext();
      await completedPromise;
      expect(queue.getStats().processing).toBe(0); // Should be 0 after completion
      expect(queue.getStats().completed).toBe(1); // Should have completed one item

      // Wait for the next completed event
      const completedPromise2 = new Promise<void>(resolve => {
        queue.on('completed', () => resolve());
      });
      await queue.processNext();
      await completedPromise2;
      expect(queue.getStats().completed).toBe(2); // Should have completed two items
    });

    it('should process items in batches', async () => {
      const items = Array.from({ length: 5 }, (_, i) => ({
        ...mockItem,
        id: `test-${i}`,
        execute: vi.fn().mockResolvedValue(undefined)
      }));

      for (const item of items) {
        await queue.enqueue(item);
      }

      await queue.processBatch();
      expect(queue.getStats().processing).toBeLessThanOrEqual(3); // batchSize is 3
    });

    it('should handle failed operations', async () => {
      vi.useRealTimers();
      const error = new Error('Test error');
      const failingItem = {
        ...mockItem,
        execute: vi.fn().mockRejectedValue(error)
      };

      const failedPromise = new Promise<{ item: any; error: Error }>(resolve => {
        queue.on('failed', (...args: unknown[]) => resolve(args[0] as { item: any; error: Error }));
      });

      await queue.enqueue(failingItem);
      await queue.processNext();
      const failedData = await failedPromise;

      expect(failedData).toEqual(expect.objectContaining({
        item: expect.objectContaining({
          id: failingItem.id,
          payload: failingItem.payload,
          priority: failingItem.priority
        }),
        error
      }));
      expect(queue.getStats().failed).toBe(1);
    });
  });

  describe('Event Handling', () => {
    it('should emit completed event', async () => {
      vi.useRealTimers();
      const completedPromise = new Promise<any>(resolve => {
        queue.on('completed', (item) => resolve(item));
      });

      await queue.enqueue(mockItem);
      await queue.processNext();
      const completedItem = await completedPromise;

      expect(completedItem).toEqual(expect.objectContaining({
        id: mockItem.id,
        payload: mockItem.payload,
        priority: mockItem.priority
      }));
      expect(queue.getStats().completed).toBe(1);
    });

    it('should emit health check events', async () => {
      const healthCallback = vi.fn();
      queue.on('health', healthCallback);

      // Advance time to trigger health check
      vi.advanceTimersByTime(1000);

      expect(healthCallback).toHaveBeenCalledWith(expect.objectContaining({
        size: 0,
        processing: 0,
        completed: 0,
        failed: 0
      }));
    });
  });

  describe('Statistics', () => {
    it('should track wait and processing times', async () => {
      const startTime = Date.now();
      vi.setSystemTime(startTime);

      await queue.enqueue(mockItem);
      vi.advanceTimersByTime(100); // Simulate wait time
      await queue.processNext();

      const stats = queue.getStats();
      expect(stats.averageWaitTime).toBeGreaterThan(0);
      expect(stats.averageProcessingTime).toBeGreaterThanOrEqual(0);
    });

    it('should update statistics after operations', async () => {
      await queue.enqueue(mockItem);
      expect(queue.getStats().size).toBe(1);

      await queue.processNext();
      expect(queue.getStats().completed).toBe(1);
      expect(queue.getStats().processing).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      const newConfig = {
        maxConcurrent: 5,
        rateLimit: 20,
        batchSize: 10
      };

      queue.updateConfig(newConfig);
      const stats = queue.getStats();
      expect(stats.rateLimit).toBe(newConfig.rateLimit);
    });

    it('should clear queue and reset statistics', () => {
      queue.clear();
      const stats = queue.getStats();
      expect(stats.size).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.processing).toBe(0);
    });
  });
}); 