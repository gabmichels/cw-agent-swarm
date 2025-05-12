/**
 * Operation Queue Types
 * 
 * This module defines the core types and interfaces for the operation queue system.
 * It follows interface-first design principles and clean break architecture.
 */

import { MemoryType } from '../../config/types';
import { MemoryEntry } from '../../../../lib/shared/types/agentTypes';

/**
 * Operation types that can be queued
 */
export enum OperationType {
  // Memory operations
  MEMORY_ADD = 'memory_add',
  MEMORY_UPDATE = 'memory_update',
  MEMORY_DELETE = 'memory_delete',
  MEMORY_SEARCH = 'memory_search',
  
  // Query operations
  QUERY_EXECUTE = 'query_execute',
  QUERY_CACHE_INVALIDATE = 'query_cache_invalidate',
  
  // Agent operations
  AGENT_TASK = 'agent_task',
  AGENT_REFLECTION = 'agent_reflection',
  AGENT_LEARNING = 'agent_learning',
  
  // System operations
  SYSTEM_MAINTENANCE = 'system_maintenance',
  SYSTEM_BACKUP = 'system_backup',
  SYSTEM_CLEANUP = 'system_cleanup'
}

/**
 * Operation queue priority levels
 */
export enum OperationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high'
}

/**
 * Base operation payload interface
 */
export interface BaseOperationPayload {
  type: OperationType;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Memory operation payload
 */
export interface MemoryOperationPayload extends BaseOperationPayload {
  type: OperationType.MEMORY_ADD | OperationType.MEMORY_UPDATE | OperationType.MEMORY_DELETE | OperationType.MEMORY_SEARCH;
  memoryType: MemoryType;
  content?: string;
  memoryId?: string;
  searchQuery?: string;
  options?: Record<string, unknown>;
}

/**
 * Query operation payload
 */
export interface QueryOperationPayload extends BaseOperationPayload {
  type: OperationType.QUERY_EXECUTE | OperationType.QUERY_CACHE_INVALIDATE;
  queryId: string;
  query?: string;
  parameters?: Record<string, unknown>;
}

/**
 * Agent operation payload
 */
export interface AgentOperationPayload extends BaseOperationPayload {
  type: OperationType.AGENT_TASK | OperationType.AGENT_REFLECTION | OperationType.AGENT_LEARNING;
  agentId: string;
  taskId?: string;
  goal?: string;
  context?: Record<string, unknown>;
}

/**
 * System operation payload
 */
export interface SystemOperationPayload extends BaseOperationPayload {
  type: OperationType.SYSTEM_MAINTENANCE | OperationType.SYSTEM_BACKUP | OperationType.SYSTEM_CLEANUP;
  target?: string;
  parameters?: Record<string, unknown>;
}

/**
 * Union type of all operation payloads
 */
export type OperationPayload = 
  | MemoryOperationPayload 
  | QueryOperationPayload 
  | AgentOperationPayload 
  | SystemOperationPayload;

/**
 * Operation status
 */
export enum OperationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Operation result
 */
export interface OperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: Error;
  metadata?: Record<string, unknown>;
}

/**
 * Operation queue item
 */
export interface OperationQueueItem<T extends OperationPayload = OperationPayload> {
  id: string;
  payload: T;
  priority: OperationPriority;
  status: OperationStatus;
  enqueuedAt: number;
  startedAt?: number;
  completedAt?: number;
  retryCount: number;
  maxRetries: number;
  result?: OperationResult;
  execute: () => Promise<OperationResult>;
}

/**
 * Operation queue configuration
 */
export interface OperationQueueConfig {
  maxSize: number;
  maxConcurrent: number;
  rateLimit: number;
  retryDelay: number;
  maxRetries: number;
  priorityWeights: Record<OperationPriority, number>;
}

/**
 * Operation queue statistics
 */
export interface OperationQueueStats {
  size: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
  averageWaitTime: number;
  averageProcessingTime: number;
  rateLimit: number;
  priorityDistribution: Record<OperationPriority, number>;
  typeDistribution: Record<OperationType, number>;
  errorRate: number;
  retryRate: number;
  retries: number;
}

/**
 * Operation queue interface
 */
export interface IOperationQueue {
  /**
   * Enqueue a new operation
   */
  enqueue<T extends OperationPayload>(item: Omit<OperationQueueItem<T>, 'id' | 'status' | 'retryCount'>): Promise<string>;
  
  /**
   * Dequeue the next operation based on priority
   */
  dequeue(): Promise<OperationQueueItem | undefined>;
  
  /**
   * Process the next operation in the queue
   */
  processNext(): Promise<void>;
  
  /**
   * Process a batch of operations
   */
  processBatch(batchSize?: number): Promise<void>;
  
  /**
   * Get operation by ID
   */
  getOperation(id: string): Promise<OperationQueueItem | undefined>;
  
  /**
   * Cancel an operation
   */
  cancel(id: string): Promise<boolean>;
  
  /**
   * Get current queue statistics
   */
  getStats(): OperationQueueStats;
  
  /**
   * Update queue configuration
   */
  updateConfig(config: Partial<OperationQueueConfig>): void;
  
  /**
   * Clear the queue
   */
  clear(): void;
  
  /**
   * Register event handlers
   */
  on(event: 'completed' | 'failed' | 'cancelled' | 'health', callback: (data: any) => void): void;
} 