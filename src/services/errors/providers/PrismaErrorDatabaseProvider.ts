/**
 * Prisma Error Database Provider Implementation
 *
 * Following IMPLEMENTATION_GUIDELINES.md:
 * - Constructor dependency injection with Prisma client
 * - ULID IDs for all records
 * - Strict TypeScript typing
 * - Comprehensive error handling with structured logging
 */

import { ulid } from 'ulid';
import { prisma } from '../../../lib/prisma';
import {
  BaseError,
  ErrorSeverity,
  ErrorStatus,
  ErrorType
} from '../../../lib/errors/types/BaseError';
import {
  ErrorLogResult,
  ErrorResolutionInput,
  ErrorSearchCriteria,
  ErrorStatistics,
  IErrorDatabaseProvider
} from '../interfaces/IErrorManagementService';

/**
 * Logger interface for structured logging
 */
interface ILogger {
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
  debug(message: string, metadata?: Record<string, unknown>): void;
  fatal(message: string, metadata?: Record<string, unknown>): void;
  system(message: string, metadata?: Record<string, unknown>): void;
}

/**
 * Prisma-based implementation of error database provider
 */
export class PrismaErrorDatabaseProvider implements IErrorDatabaseProvider {
  private readonly logger: ILogger;

  constructor(logger?: ILogger) {
    this.logger = logger || {
      info: (message: string, metadata?: Record<string, unknown>) => console.log(`INFO: ${message}`, metadata),
      warn: (message: string, metadata?: Record<string, unknown>) => console.warn(`WARN: ${message}`, metadata),
      error: (message: string, metadata?: Record<string, unknown>) => console.error(`ERROR: ${message}`, metadata),
      debug: (message: string, metadata?: Record<string, unknown>) => console.debug(`DEBUG: ${message}`, metadata),
      fatal: (message: string, metadata?: Record<string, unknown>) => console.error(`FATAL: ${message}`, metadata),
      system: (message: string, metadata?: Record<string, unknown>) => console.log(`SYSTEM: ${message}`, metadata)
    };
  }

  /**
   * Save error to database
   */
  async saveError(error: BaseError): Promise<string> {
    try {
      const errorRecord = await prisma.errorLog.create({
        data: {
          id: error.id || ulid(),
          errorType: error.type,
          severity: this.mapSeverityToDatabase(error.severity),
          message: error.message,
          agentId: error.context?.agentId || null,
          operation: error.context?.operation || null,
          errorData: error.context ? JSON.stringify(error.context) : null,
          stackTrace: error.stack || null,
          status: this.mapStatusToDatabase(error.status),
          retryAttempt: error.retryAttempt || 0,
          maxRetries: error.maxRetries || 3,
          retryStrategy: 'EXPONENTIAL_BACKOFF',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      this.logger.info('Error saved to database', {
        errorId: errorRecord.id,
        errorType: errorRecord.errorType,
        severity: errorRecord.severity
      });

      return errorRecord.id;
    } catch (dbError) {
      this.logger.error('Failed to save error to database', {
        error: (dbError as Error).message,
        originalError: {
          id: error.id,
          type: error.type,
          message: error.message
        }
      });
      throw new Error(`Database save failed: ${(dbError as Error).message}`);
    }
  }

  /**
   * Get error by ID (alias for getError)
   */
  async getErrorById(errorId: string): Promise<BaseError | null> {
    return this.getError(errorId);
  }

  /**
   * Get error by ID
   */
  async getError(errorId: string): Promise<BaseError | null> {
    try {
      const errorRecord = await prisma.errorLog.findUnique({
        where: { id: errorId },
        include: {
          resolutions: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      if (!errorRecord) {
        return null;
      }

      return this.mapDatabaseToError(errorRecord);
    } catch (dbError) {
      this.logger.error('Failed to get error from database', {
        error: (dbError as Error).message,
        errorId
      });
      throw new Error(`Database fetch failed: ${(dbError as Error).message}`);
    }
  }

  /**
   * Search errors based on criteria
   */
  async searchErrors(criteria: ErrorSearchCriteria): Promise<readonly BaseError[]> {
    try {
      const whereClause: any = {};

      // Apply filters
      if (criteria.agentId) {
        whereClause.agentId = criteria.agentId;
      }

      if (criteria.errorType) {
        whereClause.errorType = criteria.errorType;
      }

      if (criteria.severity) {
        whereClause.severity = this.mapSeverityToDatabase(criteria.severity);
      }

      if (criteria.status) {
        whereClause.status = this.mapStatusToDatabase(criteria.status);
      }

      if (criteria.dateRange) {
        const { startDate, endDate } = criteria.dateRange;
        whereClause.createdAt = {
          gte: startDate,
          lte: endDate
        };
      }

      if (criteria.searchQuery) {
        whereClause.OR = [
          { message: { contains: criteria.searchQuery, mode: 'insensitive' } },
          { agentId: { contains: criteria.searchQuery, mode: 'insensitive' } },
          { operation: { contains: criteria.searchQuery, mode: 'insensitive' } }
        ];
      }

      const errorRecords = await prisma.errorLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: criteria.limit || 1000,
        skip: criteria.offset || 0,
        include: {
          resolutions: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      return errorRecords.map(record => this.mapDatabaseToError(record));
    } catch (dbError) {
      this.logger.error('Failed to search errors in database', {
        error: (dbError as Error).message,
        criteria
      });
      throw new Error(`Database search failed: ${(dbError as Error).message}`);
    }
  }

  /**
   * Get error statistics
   */
  async getErrorStatistics(criteria?: Partial<ErrorSearchCriteria>): Promise<ErrorStatistics> {
    try {
      const whereClause: any = {};

      if (criteria?.dateRange) {
        whereClause.createdAt = {
          gte: criteria.dateRange.startDate,
          lte: criteria.dateRange.endDate
        };
      }

      const [
        totalErrors,
        resolvedErrors,
        errorsBySeverity,
        errorsByType,
        errorsByStatus
      ] = await Promise.all([
        prisma.errorLog.count({ where: whereClause }),
        prisma.errorLog.count({
          where: { ...whereClause, status: 'RESOLVED' }
        }),
        prisma.errorLog.groupBy({
          by: ['severity'],
          where: whereClause,
          _count: { id: true }
        }),
        prisma.errorLog.groupBy({
          by: ['errorType'],
          where: whereClause,
          _count: { id: true }
        }),
        prisma.errorLog.groupBy({
          by: ['status'],
          where: whereClause,
          _count: { id: true }
        })
      ]);

      const resolutionRate = totalErrors > 0 ? (resolvedErrors / totalErrors) : 0;

      return {
        totalErrors,
        resolvedErrors,
        resolutionRate,
        errorsBySeverity: this.formatGroupByResults(errorsBySeverity, 'severity'),
        errorsByType: this.formatGroupByResults(errorsByType, 'errorType'),
        errorsByStatus: this.formatGroupByResults(errorsByStatus, 'status'),
        averageResolutionTime: 0, // TODO: Calculate from resolution times
        trendsOverTime: [] // TODO: Implement trends analysis
      };
    } catch (dbError) {
      this.logger.error('Failed to get error statistics from database', {
        error: (dbError as Error).message,
        criteria
      });
      throw new Error(`Database statistics failed: ${(dbError as Error).message}`);
    }
  }

  /**
   * Update error
   */
  async updateError(errorId: string, updates: Partial<BaseError>): Promise<boolean> {
    try {
      const updateData: any = {
        updatedAt: new Date()
      };

      if (updates.status !== undefined) {
        updateData.status = this.mapStatusToDatabase(updates.status);
      }

      if (updates.retryAttempt !== undefined) {
        updateData.retryAttempt = updates.retryAttempt;
      }

      if (updates.message !== undefined) {
        updateData.message = updates.message;
      }

      await prisma.errorLog.update({
        where: { id: errorId },
        data: updateData
      });

      this.logger.info('Error updated in database', {
        errorId,
        updates: Object.keys(updateData)
      });

      return true;
    } catch (dbError) {
      this.logger.error('Failed to update error in database', {
        error: (dbError as Error).message,
        errorId,
        updates
      });
      return false;
    }
  }

  /**
   * Update error status
   */
  async updateErrorStatus(errorId: string, status: ErrorStatus): Promise<boolean> {
    try {
      await prisma.errorLog.update({
        where: { id: errorId },
        data: {
          status: this.mapStatusToDatabase(status),
          updatedAt: new Date(),
          ...(status === ErrorStatus.RESOLVED && { resolvedAt: new Date() })
        }
      });

      this.logger.info('Error status updated in database', {
        errorId,
        status
      });

      return true;
    } catch (dbError) {
      this.logger.error('Failed to update error status in database', {
        error: (dbError as Error).message,
        errorId,
        status
      });
      return false;
    }
  }

  /**
   * Save error resolution
   */
  async saveErrorResolution(resolution: ErrorResolutionInput): Promise<boolean> {
    try {
      await prisma.errorResolution.create({
        data: {
          id: ulid(),
          errorLogId: resolution.errorId,
          resolutionType: resolution.strategy || 'MANUAL_FIX',
          description: resolution.description,
          appliedBy: resolution.resolvedBy || 'system',
          timeToResolve: resolution.timeToResolve || 0,
          createdAt: resolution.resolvedAt || new Date()
        }
      });

      this.logger.info('Error resolution saved to database', {
        errorId: resolution.errorId,
        strategy: resolution.strategy
      });

      return true;
    } catch (dbError) {
      this.logger.error('Failed to save error resolution to database', {
        error: (dbError as Error).message,
        resolution
      });
      return false;
    }
  }

  /**
   * Get errors for retry
   */
  async getErrorsForRetry(): Promise<readonly BaseError[]> {
    try {
      const now = new Date();
      const errorRecords = await prisma.errorLog.findMany({
        where: {
          status: 'RETRYING',
          nextRetryAt: {
            lte: now
          },
          retryAttempt: {
            lt: prisma.errorLog.fields.maxRetries
          }
        },
        orderBy: { nextRetryAt: 'asc' },
        take: 100
      });

      return errorRecords.map(record => this.mapDatabaseToError(record));
    } catch (dbError) {
      this.logger.error('Failed to get errors for retry from database', {
        error: (dbError as Error).message
      });
      return [];
    }
  }

  /**
   * Get errors for escalation
   */
  async getErrorsForEscalation(): Promise<readonly BaseError[]> {
    try {
      const escalationThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

      const errorRecords = await prisma.errorLog.findMany({
        where: {
          status: {
            in: ['NEW', 'IN_PROGRESS']
          },
          severity: {
            in: ['CRITICAL', 'HIGH']
          },
          createdAt: {
            lte: escalationThreshold
          },
          escalatedAt: null
        },
        orderBy: { createdAt: 'asc' },
        take: 50
      });

      return errorRecords.map(record => this.mapDatabaseToError(record));
    } catch (dbError) {
      this.logger.error('Failed to get errors for escalation from database', {
        error: (dbError as Error).message
      });
      return [];
    }
  }

  /**
   * Get errors by status
   */
  async getErrorsByStatus(status: ErrorStatus): Promise<readonly BaseError[]> {
    try {
      const errorRecords = await prisma.errorLog.findMany({
        where: {
          status: this.mapStatusToDatabase(status)
        },
        orderBy: { createdAt: 'desc' },
        take: 1000
      });

      return errorRecords.map(record => this.mapDatabaseToError(record));
    } catch (dbError) {
      this.logger.error('Failed to get errors by status from database', {
        error: (dbError as Error).message,
        status
      });
      return [];
    }
  }

  /**
   * Get errors by agent
   */
  async getErrorsByAgent(agentId: string): Promise<readonly BaseError[]> {
    try {
      const errorRecords = await prisma.errorLog.findMany({
        where: {
          agentId: agentId
        },
        orderBy: { createdAt: 'desc' },
        take: 1000
      });

      return errorRecords.map(record => this.mapDatabaseToError(record));
    } catch (dbError) {
      this.logger.error('Failed to get errors by agent from database', {
        error: (dbError as Error).message,
        agentId
      });
      return [];
    }
  }

  /**
   * Get errors by type
   */
  async getErrorsByType(errorType: ErrorType): Promise<readonly BaseError[]> {
    try {
      const errorRecords = await prisma.errorLog.findMany({
        where: {
          errorType: errorType
        },
        orderBy: { createdAt: 'desc' },
        take: 1000
      });

      return errorRecords.map(record => this.mapDatabaseToError(record));
    } catch (dbError) {
      this.logger.error('Failed to get errors by type from database', {
        error: (dbError as Error).message,
        errorType
      });
      return [];
    }
  }

  /**
   * Get error patterns
   */
  async getErrorPatterns(timeWindowHours: number): Promise<readonly any[]> {
    try {
      const startTime = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);

      const patterns = await prisma.errorLog.groupBy({
        by: ['errorType', 'agentId'],
        where: {
          createdAt: {
            gte: startTime
          }
        },
        _count: {
          id: true
        },
        having: {
          id: {
            _count: {
              gt: 1 // Only patterns with more than 1 occurrence
            }
          }
        },
        orderBy: {
          _count: {
            id: 'desc'
          }
        }
      });

      return patterns.map(pattern => ({
        errorType: pattern.errorType,
        agentId: pattern.agentId,
        occurrences: pattern._count.id,
        timeWindow: timeWindowHours,
        severity: 'MEDIUM' // Default, could be enhanced
      }));
    } catch (dbError) {
      this.logger.error('Failed to get error patterns from database', {
        error: (dbError as Error).message,
        timeWindowHours
      });
      return [];
    }
  }

  /**
   * Save error pattern
   */
  async saveErrorPattern(pattern: any): Promise<boolean> {
    try {
      // Note: This would need an ErrorPattern table in the schema
      // For now, just log the pattern
      this.logger.info('Error pattern identified', {
        pattern
      });
      return true;
    } catch (dbError) {
      this.logger.error('Failed to save error pattern to database', {
        error: (dbError as Error).message,
        pattern
      });
      return false;
    }
  }

  /**
   * Get error stats
   */
  async getErrorStats(): Promise<any> {
    try {
      const stats = await this.getErrorStatistics();
      return stats;
    } catch (dbError) {
      this.logger.error('Failed to get error stats from database', {
        error: (dbError as Error).message
      });
      return {
        totalErrors: 0,
        resolvedErrors: 0,
        resolutionRate: 0
      };
    }
  }

  /**
   * Cleanup old errors
   */
  async cleanupOldErrors(daysOld: number): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

      const result = await prisma.errorLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate
          },
          status: 'RESOLVED'
        }
      });

      this.logger.info('Old errors cleaned up from database', {
        deletedCount: result.count,
        daysOld,
        cutoffDate
      });

      return result.count;
    } catch (dbError) {
      this.logger.error('Failed to cleanup old errors from database', {
        error: (dbError as Error).message,
        daysOld
      });
      return 0;
    }
  }

  /**
   * Update retry info
   */
  async updateRetryInfo(errorId: string, retryAttempt: number, nextRetryAt: Date): Promise<boolean> {
    try {
      await prisma.errorLog.update({
        where: { id: errorId },
        data: {
          retryAttempt,
          nextRetryAt,
          lastRetryAt: new Date(),
          updatedAt: new Date()
        }
      });

      this.logger.info('Error retry info updated in database', {
        errorId,
        retryAttempt,
        nextRetryAt
      });

      return true;
    } catch (dbError) {
      this.logger.error('Failed to update retry info in database', {
        error: (dbError as Error).message,
        errorId,
        retryAttempt
      });
      return false;
    }
  }

  // Helper methods for mapping between database and application types

  private mapSeverityToDatabase(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 'CRITICAL';
      case ErrorSeverity.HIGH:
        return 'HIGH';
      case ErrorSeverity.MEDIUM:
        return 'MEDIUM';
      case ErrorSeverity.LOW:
        return 'LOW';
      default:
        return 'MEDIUM';
    }
  }

  private mapStatusToDatabase(status: ErrorStatus): string {
    switch (status) {
      case ErrorStatus.NEW:
        return 'NEW';
      case ErrorStatus.IN_PROGRESS:
        return 'IN_PROGRESS';
      case ErrorStatus.RESOLVED:
        return 'RESOLVED';
      case ErrorStatus.FAILED_PERMANENTLY:
        return 'FAILED_PERMANENTLY';
      case ErrorStatus.RETRYING:
        return 'RETRYING';
      case ErrorStatus.ESCALATED:
        return 'ESCALATED';
      default:
        return 'NEW';
    }
  }

  private mapDatabaseToError(record: any): BaseError {
    return {
      id: record.id,
      type: record.errorType as ErrorType,
      severity: this.mapDatabaseToSeverity(record.severity),
      status: this.mapDatabaseToStatus(record.status),
      message: record.message,
      stack: record.stackTrace || undefined,
      context: record.errorData ? JSON.parse(record.errorData) : undefined,
      retryAttempt: record.retryAttempt || 0,
      maxRetries: record.maxRetries || 3,
      retryStrategy: record.retryStrategy || 'EXPONENTIAL_BACKOFF',
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      resolvedAt: record.resolvedAt || undefined
    } as BaseError;
  }

  private mapDatabaseToSeverity(severity: string): ErrorSeverity {
    switch (severity) {
      case 'CRITICAL':
        return ErrorSeverity.CRITICAL;
      case 'HIGH':
        return ErrorSeverity.HIGH;
      case 'MEDIUM':
        return ErrorSeverity.MEDIUM;
      case 'LOW':
        return ErrorSeverity.LOW;
      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  private mapDatabaseToStatus(status: string): ErrorStatus {
    switch (status) {
      case 'NEW':
        return ErrorStatus.NEW;
      case 'IN_PROGRESS':
        return ErrorStatus.IN_PROGRESS;
      case 'RESOLVED':
        return ErrorStatus.RESOLVED;
      case 'FAILED_PERMANENTLY':
        return ErrorStatus.FAILED_PERMANENTLY;
      case 'RETRYING':
        return ErrorStatus.RETRYING;
      case 'ESCALATED':
        return ErrorStatus.ESCALATED;
      default:
        return ErrorStatus.NEW;
    }
  }

  private formatGroupByResults(results: any[], field: string): Record<string, number> {
    const formatted: Record<string, number> = {};
    results.forEach(result => {
      formatted[result[field].toLowerCase()] = result._count.id;
    });
    return formatted;
  }
} 