import { IOperationQueue, OperationQueueItem, OperationQueueStats, OperationQueueConfig, OperationPriority } from './types';
import { EventEmitter } from 'events';

const DEFAULT_CONFIG: OperationQueueConfig = {
  maxConcurrent: 4,
  rateLimit: 10, // ops/sec
  batchSize: 5,
  healthCheckIntervalMs: 5000
};

interface InternalQueueItem<T> extends OperationQueueItem<T> {
  startedAt?: number;
  completedAt?: number;
  failedAt?: number;
}

type QueueEvents = {
  completed: [OperationQueueItem];
  failed: [{ item: OperationQueueItem; error: Error }];
  health: [OperationQueueStats];
};

export class OperationQueue<T = any> extends EventEmitter {
  private queue: InternalQueueItem<T>[] = [];
  private processing: Set<string> = new Set();
  private completed = 0;
  private failed = 0;
  private waitTimes: number[] = [];
  private processingTimes: number[] = [];
  private config: OperationQueueConfig;
  private lastProcessTime = 0;
  private tokens = 0;
  private tokenInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<OperationQueueConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startRateLimiter();
    this.startHealthCheck();
  }

  enqueue(item: OperationQueueItem<T>): Promise<void> {
    this.queue.push({ ...item });
    this.queue.sort((a, b) => this.priorityValue(b.priority) - this.priorityValue(a.priority));
    return Promise.resolve();
  }

  async dequeue(): Promise<OperationQueueItem<T> | undefined> {
    return this.queue.shift();
  }

  async processNext(): Promise<void> {
    if (this.processing.size >= this.config.maxConcurrent || this.tokens <= 0) return;
    const item = this.queue.shift();
    if (!item) return;
    this.processing.add(item.id);
    this.tokens--;
    const now = Date.now();
    const waitTime = now - item.enqueuedAt;
    (item as InternalQueueItem<T>).startedAt = now;
    this.waitTimes.push(waitTime);
    try {
      await item.execute();
      this.completed++;
      (item as InternalQueueItem<T>).completedAt = Date.now();
      this.processingTimes.push((item as InternalQueueItem<T>).completedAt! - (item as InternalQueueItem<T>).startedAt!);
      this.emitCompleted(item);
    } catch (err: unknown) {
      this.failed++;
      (item as InternalQueueItem<T>).failedAt = Date.now();
      this.emitFailed({ item, error: err instanceof Error ? err : new Error(String(err)) });
    } finally {
      this.processing.delete(item.id);
    }
  }

  async processBatch(): Promise<void> {
    const batch: InternalQueueItem<T>[] = [];
    while (batch.length < this.config.batchSize && this.queue.length > 0 && this.tokens > 0 && this.processing.size < this.config.maxConcurrent) {
      const item = this.queue.shift();
      if (item) {
        batch.push(item);
        this.processing.add(item.id);
        this.tokens--;
        (item as InternalQueueItem<T>).startedAt = Date.now();
        this.waitTimes.push((item as InternalQueueItem<T>).startedAt! - item.enqueuedAt);
      }
    }
    await Promise.all(batch.map(async (item) => {
      try {
        await item.execute();
        this.completed++;
        (item as InternalQueueItem<T>).completedAt = Date.now();
        this.processingTimes.push((item as InternalQueueItem<T>).completedAt! - (item as InternalQueueItem<T>).startedAt!);
        this.emitCompleted(item);
      } catch (err: unknown) {
        this.failed++;
        (item as InternalQueueItem<T>).failedAt = Date.now();
        this.emitFailed({ item, error: err instanceof Error ? err : new Error(String(err)) });
      } finally {
        this.processing.delete(item.id);
      }
    }));
  }

  getStats(): OperationQueueStats {
    return {
      size: this.queue.length,
      processing: this.processing.size,
      completed: this.completed,
      failed: this.failed,
      averageWaitTime: this.waitTimes.length ? this.waitTimes.reduce((a, b) => a + b, 0) / this.waitTimes.length : 0,
      averageProcessingTime: this.processingTimes.length ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length : 0,
      rateLimit: this.config.rateLimit
    };
  }

  updateConfig(config: Partial<OperationQueueConfig>): void {
    this.config = { ...this.config, ...config };
    this.startRateLimiter();
  }

  clear(): void {
    this.queue = [];
    this.processing.clear();
    this.completed = 0;
    this.failed = 0;
    this.waitTimes = [];
    this.processingTimes = [];
  }

  private priorityValue(priority: OperationPriority): number {
    switch (priority) {
      case 'high': return 2;
      case 'normal': return 1;
      case 'low': return 0;
      default: return 0;
    }
  }

  private startRateLimiter() {
    if (this.tokenInterval) clearInterval(this.tokenInterval);
    this.tokens = this.config.rateLimit;
    this.tokenInterval = setInterval(() => {
      this.tokens = this.config.rateLimit;
      // Try to process as many as allowed
      for (let i = 0; i < this.tokens; i++) {
        this.processNext();
      }
    }, 1000);
  }

  private startHealthCheck() {
    setInterval(() => {
      this.emitHealth(this.getStats());
    }, this.config.healthCheckIntervalMs);
  }

  on(event: 'completed' | 'failed' | 'health', listener: (...args: unknown[]) => void): this {
    // @ts-expect-error: TypeScript does not recognize custom event signatures
    return super.on(event, listener);
  }

  private emitCompleted(item: OperationQueueItem): boolean {
    // @ts-expect-error: TypeScript does not recognize custom event signatures
    return super.emit('completed', item);
  }

  private emitFailed(data: { item: OperationQueueItem; error: Error }): boolean {
    // @ts-expect-error: TypeScript does not recognize custom event signatures
    return super.emit('failed', data);
  }

  private emitHealth(stats: OperationQueueStats): boolean {
    // @ts-expect-error: TypeScript does not recognize custom event signatures
    return super.emit('health', stats);
  }
} 