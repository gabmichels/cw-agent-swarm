import { PrismaClient } from '@prisma/client';
import { ulid } from 'ulid';
import { logger } from '../../../lib/logging';
import {
  ExecutionStatus,
  WorkflowExecutionError,
  WorkflowExecutionHistory,
  WorkflowExecutionResult
} from '../../../types/workflow';

// === Execution Tracking Interface ===

export interface IExecutionTrackingService {
  // Execution Persistence
  createExecution(execution: CreateExecutionRequest): Promise<string>;
  updateExecutionStatus(executionId: string, status: ExecutionStatus, result?: Partial<WorkflowExecutionResult>): Promise<void>;
  getExecution(executionId: string): Promise<StoredExecution | null>;

  // History & Analytics
  getExecutionHistory(userId: string, filters?: ExecutionHistoryFilters): Promise<WorkflowExecutionHistory>;
  getExecutionStats(userId: string, timeRange?: TimeRange): Promise<ExecutionStats>;
  cleanupOldExecutions(olderThanDays: number): Promise<number>;
}

// === Supporting Types ===

export interface CreateExecutionRequest {
  readonly executionId: string;
  readonly userId: string;
  readonly workflowId: string;
  readonly connectionId: string;
  readonly parameters: Record<string, unknown>;
  readonly startedAt: Date;
  readonly timeoutMs?: number;
  readonly metadata?: Record<string, unknown>;
}

export interface StoredExecution {
  readonly id: string;
  readonly executionId: string;
  readonly userId: string;
  readonly workflowId: string;
  readonly connectionId: string;
  readonly status: ExecutionStatus;
  readonly parameters: Record<string, unknown>;
  readonly result?: Record<string, unknown>;
  readonly error?: string;
  readonly startedAt: Date;
  readonly completedAt?: Date;
  readonly duration?: number;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ExecutionHistoryFilters {
  readonly workflowId?: string;
  readonly status?: ExecutionStatus[];
  readonly dateFrom?: Date;
  readonly dateTo?: Date;
  readonly limit?: number;
  readonly offset?: number;
  readonly orderBy?: 'startedAt' | 'completedAt' | 'duration';
  readonly orderDirection?: 'asc' | 'desc';
}

export interface ExecutionStats {
  readonly totalExecutions: number;
  readonly successfulExecutions: number;
  readonly failedExecutions: number;
  readonly averageDuration: number;
  readonly executionsByStatus: Record<ExecutionStatus, number>;
  readonly executionsByWorkflow: Array<{
    workflowId: string;
    count: number;
    successRate: number;
  }>;
  readonly timeRange: TimeRange;
}

export interface TimeRange {
  readonly from: Date;
  readonly to: Date;
}

// === Database Schema Extensions ===

// This would extend the existing database schema
interface WorkflowExecutionRecord {
  id: string;
  executionId: string;
  userId: string;
  workflowId: string;
  connectionId: string;
  status: string;
  parameters: string; // JSON
  result?: string; // JSON
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  metadata: string; // JSON
  createdAt: Date;
  updatedAt: Date;
}

// === Execution Tracking Service Implementation ===

export class ExecutionTrackingService implements IExecutionTrackingService {
  private readonly serviceName = 'ExecutionTrackingService';
  private readonly logger = logger;

  // In-memory fallback when database is not available
  private readonly memoryStore = new Map<string, StoredExecution>();

  constructor(
    private readonly prisma: PrismaClient
  ) { }

  // === Execution Persistence ===

  async createExecution(request: CreateExecutionRequest): Promise<string> {
    const recordId = ulid();

    this.logger.debug(`[${this.serviceName}] Creating execution record`, {
      recordId,
      executionId: request.executionId,
      userId: request.userId,
      workflowId: request.workflowId
    });

    try {
      const executionRecord: StoredExecution = {
        id: recordId,
        executionId: request.executionId,
        userId: request.userId,
        workflowId: request.workflowId,
        connectionId: request.connectionId,
        status: 'pending',
        parameters: request.parameters,
        startedAt: request.startedAt,
        metadata: request.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Try to store in database, fallback to memory
      try {
        // Note: This would require a new table in the database schema
        // For now, we'll use the memory store as the primary storage
        this.memoryStore.set(request.executionId, executionRecord);

        this.logger.info(`[${this.serviceName}] Execution record created`, {
          recordId,
          executionId: request.executionId,
          storage: 'memory'
        });

      } catch (dbError) {
        this.logger.warn(`[${this.serviceName}] Database storage failed, using memory fallback`, {
          recordId,
          executionId: request.executionId,
          error: dbError instanceof Error ? dbError.message : String(dbError)
        });

        this.memoryStore.set(request.executionId, executionRecord);
      }

      return recordId;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to create execution record`, {
        recordId,
        executionId: request.executionId,
        error: error instanceof Error ? error.message : String(error)
      });

      throw new WorkflowExecutionError(
        'Failed to create execution record',
        request.executionId,
        { userId: request.userId, workflowId: request.workflowId, originalError: error }
      );
    }
  }

  async updateExecutionStatus(
    executionId: string,
    status: ExecutionStatus,
    result?: Partial<WorkflowExecutionResult>
  ): Promise<void> {
    this.logger.debug(`[${this.serviceName}] Updating execution status`, {
      executionId,
      status,
      hasResult: !!result
    });

    try {
      const existingRecord = this.memoryStore.get(executionId);
      if (!existingRecord) {
        throw new WorkflowExecutionError(
          `Execution record not found: ${executionId}`,
          executionId
        );
      }

      // Calculate duration if execution is completing
      let duration: number | undefined;
      let completedAt: Date | undefined;

      if (status === 'success' || status === 'failed' || status === 'cancelled') {
        completedAt = new Date();
        duration = completedAt.getTime() - existingRecord.startedAt.getTime();
      }

      // Update the record
      const updatedRecord: StoredExecution = {
        ...existingRecord,
        status,
        result: result?.result,
        error: result?.error,
        completedAt,
        duration,
        updatedAt: new Date()
      };

      this.memoryStore.set(executionId, updatedRecord);

      this.logger.info(`[${this.serviceName}] Execution status updated`, {
        executionId,
        status,
        duration,
        completedAt: completedAt?.toISOString()
      });

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to update execution status`, {
        executionId,
        status,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof WorkflowExecutionError) {
        throw error;
      }

      throw new WorkflowExecutionError(
        'Failed to update execution status',
        executionId,
        { status, originalError: error }
      );
    }
  }

  async getExecution(executionId: string): Promise<StoredExecution | null> {
    this.logger.debug(`[${this.serviceName}] Getting execution record`, { executionId });

    try {
      const record = this.memoryStore.get(executionId);

      if (record) {
        this.logger.debug(`[${this.serviceName}] Execution record found`, {
          executionId,
          status: record.status,
          startedAt: record.startedAt.toISOString()
        });
      } else {
        this.logger.debug(`[${this.serviceName}] Execution record not found`, { executionId });
      }

      return record || null;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to get execution record`, {
        executionId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  // === History & Analytics ===

  async getExecutionHistory(
    userId: string,
    filters: ExecutionHistoryFilters = {}
  ): Promise<WorkflowExecutionHistory> {
    this.logger.debug(`[${this.serviceName}] Getting execution history`, {
      userId,
      filters
    });

    try {
      // Get all executions for the user from memory store
      const userExecutions = Array.from(this.memoryStore.values())
        .filter(exec => exec.userId === userId);

      // Apply filters
      let filteredExecutions = userExecutions;

      if (filters.workflowId) {
        filteredExecutions = filteredExecutions.filter(
          exec => exec.workflowId === filters.workflowId
        );
      }

      if (filters.status && filters.status.length > 0) {
        filteredExecutions = filteredExecutions.filter(
          exec => filters.status!.includes(exec.status)
        );
      }

      if (filters.dateFrom) {
        filteredExecutions = filteredExecutions.filter(
          exec => exec.startedAt >= filters.dateFrom!
        );
      }

      if (filters.dateTo) {
        filteredExecutions = filteredExecutions.filter(
          exec => exec.startedAt <= filters.dateTo!
        );
      }

      // Apply sorting
      const orderBy = filters.orderBy || 'startedAt';
      const orderDirection = filters.orderDirection || 'desc';

      filteredExecutions.sort((a, b) => {
        let aValue: Date | number;
        let bValue: Date | number;

        switch (orderBy) {
          case 'completedAt':
            aValue = a.completedAt?.getTime() || 0;
            bValue = b.completedAt?.getTime() || 0;
            break;
          case 'duration':
            aValue = a.duration || 0;
            bValue = b.duration || 0;
            break;
          default: // 'startedAt'
            aValue = a.startedAt.getTime();
            bValue = b.startedAt.getTime();
            break;
        }

        return orderDirection === 'desc' ? bValue - aValue : aValue - bValue;
      });

      // Apply pagination
      const offset = filters.offset || 0;
      const limit = filters.limit || 50;
      const paginatedExecutions = filteredExecutions.slice(offset, offset + limit);

      // Convert to WorkflowExecutionResult format
      const executions: WorkflowExecutionResult[] = paginatedExecutions.map(stored => ({
        executionId: stored.executionId,
        workflowId: stored.workflowId,
        status: stored.status,
        startedAt: stored.startedAt,
        completedAt: stored.completedAt,
        duration: stored.duration,
        result: stored.result,
        error: stored.error,
        outputData: stored.result ? [stored.result] : undefined,
        metadata: stored.metadata
      }));

      const history: WorkflowExecutionHistory = {
        executions,
        total: filteredExecutions.length,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit
      };

      this.logger.debug(`[${this.serviceName}] Execution history retrieved`, {
        userId,
        total: history.total,
        returned: history.executions.length,
        filters
      });

      return history;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to get execution history`, {
        userId,
        filters,
        error: error instanceof Error ? error.message : String(error)
      });

      throw new WorkflowExecutionError(
        'Failed to get execution history',
        undefined,
        { userId, originalError: error }
      );
    }
  }

  async getExecutionStats(
    userId: string,
    timeRange?: TimeRange
  ): Promise<ExecutionStats> {
    this.logger.debug(`[${this.serviceName}] Getting execution statistics`, {
      userId,
      timeRange
    });

    try {
      // Get user executions within time range
      const userExecutions = Array.from(this.memoryStore.values())
        .filter(exec => {
          if (exec.userId !== userId) return false;

          if (timeRange) {
            const execTime = exec.startedAt.getTime();
            if (execTime < timeRange.from.getTime() || execTime > timeRange.to.getTime()) {
              return false;
            }
          }

          return true;
        });

      // Calculate basic stats
      const totalExecutions = userExecutions.length;
      const successfulExecutions = userExecutions.filter(exec => exec.status === 'success').length;
      const failedExecutions = userExecutions.filter(exec => exec.status === 'failed').length;

      // Calculate average duration (only for completed executions)
      const completedExecutions = userExecutions.filter(exec => exec.duration != null);
      const averageDuration = completedExecutions.length > 0
        ? completedExecutions.reduce((sum, exec) => sum + (exec.duration || 0), 0) / completedExecutions.length
        : 0;

      // Group by status
      const executionsByStatus: Record<ExecutionStatus, number> = {
        pending: 0,
        running: 0,
        success: 0,
        failed: 0,
        cancelled: 0,
        waiting: 0
      };

      userExecutions.forEach(exec => {
        executionsByStatus[exec.status]++;
      });

      // Group by workflow
      const workflowStats = new Map<string, { total: number; successful: number }>();

      userExecutions.forEach(exec => {
        const current = workflowStats.get(exec.workflowId) || { total: 0, successful: 0 };
        current.total++;
        if (exec.status === 'success') {
          current.successful++;
        }
        workflowStats.set(exec.workflowId, current);
      });

      const executionsByWorkflow = Array.from(workflowStats.entries()).map(([workflowId, stats]) => ({
        workflowId,
        count: stats.total,
        successRate: stats.total > 0 ? stats.successful / stats.total : 0
      }));

      const finalTimeRange = timeRange || {
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        to: new Date()
      };

      const stats: ExecutionStats = {
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        averageDuration,
        executionsByStatus,
        executionsByWorkflow,
        timeRange: finalTimeRange
      };

      this.logger.debug(`[${this.serviceName}] Execution statistics calculated`, {
        userId,
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        averageDuration
      });

      return stats;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to get execution statistics`, {
        userId,
        timeRange,
        error: error instanceof Error ? error.message : String(error)
      });

      throw new WorkflowExecutionError(
        'Failed to get execution statistics',
        undefined,
        { userId, originalError: error }
      );
    }
  }

  async cleanupOldExecutions(olderThanDays: number): Promise<number> {
    this.logger.info(`[${this.serviceName}] Cleaning up executions older than ${olderThanDays} days`);

    try {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
      let deletedCount = 0;

      // Remove old executions from memory store
      for (const [executionId, execution] of this.memoryStore.entries()) {
        if (execution.startedAt < cutoffDate) {
          this.memoryStore.delete(executionId);
          deletedCount++;
        }
      }

      this.logger.info(`[${this.serviceName}] Cleanup completed`, {
        deletedCount,
        cutoffDate: cutoffDate.toISOString()
      });

      return deletedCount;

    } catch (error) {
      this.logger.error(`[${this.serviceName}] Failed to cleanup old executions`, {
        olderThanDays,
        error: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }

  // === Additional Helper Methods ===

  async getActiveExecutions(userId: string): Promise<StoredExecution[]> {
    const activeStatuses: ExecutionStatus[] = ['pending', 'running', 'waiting'];

    return Array.from(this.memoryStore.values())
      .filter(exec =>
        exec.userId === userId &&
        activeStatuses.includes(exec.status)
      );
  }

  async getRecentExecutions(userId: string, limit = 10): Promise<StoredExecution[]> {
    return Array.from(this.memoryStore.values())
      .filter(exec => exec.userId === userId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }
} 