import { ImportanceLevel } from '../../../constants/memory';

/**
 * Log level for artifact storage operations
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

/**
 * The type of cognitive artifact being stored
 */
export enum ArtifactType {
  THOUGHT = 'THOUGHT',
  ENTITY = 'ENTITY',
  REASONING = 'REASONING',
  PLAN = 'PLAN',
  INSIGHT = 'INSIGHT',
  REFLECTION = 'REFLECTION',
  TASK = 'TASK'
}

/**
 * Information about a stored artifact for logging
 */
export interface ArtifactStorageInfo {
  /**
   * Type of artifact
   */
  type: ArtifactType;
  
  /**
   * Artifact ID generated after storage
   */
  id: string;
  
  /**
   * User ID associated with the artifact
   */
  userId: string;
  
  /**
   * Brief description or summary of the artifact content
   */
  summary: string;
  
  /**
   * Importance level of the artifact
   */
  importance: ImportanceLevel;
  
  /**
   * Tags associated with the artifact
   */
  tags: string[];
  
  /**
   * Stage of the thinking process when this was stored
   */
  stage: string;
  
  /**
   * IDs of related artifacts
   */
  relatedTo?: string[];
  
  /**
   * Timestamp when the artifact was stored
   */
  timestamp: string;
  
  /**
   * Duration of the storage operation in milliseconds
   */
  durationMs?: number;
}

/**
 * Metrics for artifact storage operations
 */
export interface StorageMetrics {
  /**
   * Total number of artifacts stored
   */
  totalArtifacts: number;
  
  /**
   * Count of artifacts by type
   */
  artifactsByType: Record<ArtifactType, number>;
  
  /**
   * Average storage duration in milliseconds
   */
  averageStorageDurationMs: number;
  
  /**
   * Total storage operations successful
   */
  successfulOperations: number;
  
  /**
   * Total storage operations failed
   */
  failedOperations: number;
}

/**
 * Service for logging and tracking cognitive artifact storage
 */
export class ArtifactLogger {
  /**
   * All logged storage operations
   */
  private logs: ArtifactStorageInfo[] = [];
  
  /**
   * Error logs for failed storage operations
   */
  private errorLogs: Array<{ error: Error; info: Partial<ArtifactStorageInfo>; timestamp: string }> = [];
  
  /**
   * Performance metrics for storage operations
   */
  private metrics: StorageMetrics = {
    totalArtifacts: 0,
    artifactsByType: {
      [ArtifactType.THOUGHT]: 0,
      [ArtifactType.ENTITY]: 0,
      [ArtifactType.REASONING]: 0,
      [ArtifactType.PLAN]: 0,
      [ArtifactType.INSIGHT]: 0,
      [ArtifactType.REFLECTION]: 0,
      [ArtifactType.TASK]: 0
    },
    averageStorageDurationMs: 0,
    successfulOperations: 0,
    failedOperations: 0
  };
  
  /**
   * Log an artifact storage operation
   */
  public logStorage(info: ArtifactStorageInfo): void {
    this.logs.push(info);
    this.updateMetrics(info);
    
    // Log to console for now - could be replaced with proper logging system
    this.logToConsole(LogLevel.INFO, `Stored ${info.type}: ${info.id} - ${info.summary} (${info.durationMs}ms)`);
  }
  
  /**
   * Log a failed storage operation
   */
  public logStorageError(error: Error, partialInfo: Partial<ArtifactStorageInfo>): void {
    const errorInfo = {
      error,
      info: partialInfo,
      timestamp: new Date().toISOString()
    };
    
    this.errorLogs.push(errorInfo);
    this.metrics.failedOperations++;
    
    // Log to console for now - could be replaced with proper logging system
    this.logToConsole(
      LogLevel.ERROR, 
      `Failed to store ${partialInfo.type || 'artifact'}: ${error.message}`
    );
  }
  
  /**
   * Get storage metrics
   */
  public getMetrics(): StorageMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Get recent storage logs
   */
  public getRecentLogs(count: number = 10): ArtifactStorageInfo[] {
    return this.logs.slice(-count);
  }
  
  /**
   * Get recent error logs
   */
  public getRecentErrorLogs(count: number = 10): Array<{ error: Error; info: Partial<ArtifactStorageInfo>; timestamp: string }> {
    return this.errorLogs.slice(-count);
  }
  
  /**
   * Clear all logs
   */
  public clearLogs(): void {
    this.logs = [];
    this.errorLogs = [];
    this.resetMetrics();
  }
  
  /**
   * Reset metrics
   */
  private resetMetrics(): void {
    this.metrics = {
      totalArtifacts: 0,
      artifactsByType: {
        [ArtifactType.THOUGHT]: 0,
        [ArtifactType.ENTITY]: 0,
        [ArtifactType.REASONING]: 0,
        [ArtifactType.PLAN]: 0,
        [ArtifactType.INSIGHT]: 0,
        [ArtifactType.REFLECTION]: 0,
        [ArtifactType.TASK]: 0
      },
      averageStorageDurationMs: 0,
      successfulOperations: 0,
      failedOperations: 0
    };
  }
  
  /**
   * Update metrics after a storage operation
   */
  private updateMetrics(info: ArtifactStorageInfo): void {
    this.metrics.totalArtifacts++;
    this.metrics.artifactsByType[info.type]++;
    this.metrics.successfulOperations++;
    
    // Update average duration
    if (info.durationMs) {
      const totalDuration = this.metrics.averageStorageDurationMs * (this.metrics.successfulOperations - 1);
      this.metrics.averageStorageDurationMs = (totalDuration + info.durationMs) / this.metrics.successfulOperations;
    }
  }
  
  /**
   * Log to console with appropriate styling
   */
  public logToConsole(level: LogLevel, message: string): void {
    const timestamp = new Date().toISOString();
    
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(`[ARTIFACT] ${timestamp} - ${message}`);
        break;
      case LogLevel.INFO:
        console.info(`[ARTIFACT] ${timestamp} - ${message}`);
        break;
      case LogLevel.WARN:
        console.warn(`[ARTIFACT] ${timestamp} - ${message}`);
        break;
      case LogLevel.ERROR:
        console.error(`[ARTIFACT] ${timestamp} - ${message}`);
        break;
    }
  }
}

// Create singleton instance
const artifactLogger = new ArtifactLogger();
export default artifactLogger; 