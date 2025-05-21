/**
 * Default Logger Manager Implementation
 * 
 * This file provides a concrete implementation of the LoggerManager interface
 * that can be used by agent implementations for standardized logging.
 */

import { v4 as uuidv4 } from 'uuid';
import { AgentBase } from '../../shared/base/AgentBase.interface';
import { LoggerManager } from '../../shared/base/managers/LoggerManager.interface';
import { ManagerType } from '../../shared/base/managers/ManagerType';
import { AbstractBaseManager } from '../../shared/base/managers/BaseManager';
import { ManagerHealth } from '../../shared/base/managers/ManagerHealth';
import { logger as systemLogger } from '../../../lib/logging';
import { ManagerConfig } from '../../shared/base/managers/BaseManager';

// Enum for log levels
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

// Interface for log entry
export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  agentId: string;
  managerId?: string;
  metadata?: Record<string, unknown>;
}

// Config for logger
export interface LoggerManagerConfig extends ManagerConfig {
  level: LogLevel;
  maxHistorySize: number;
  logToConsole: boolean;
  includeMetadata: boolean;
  formatMessages: boolean;
  trackLogHistory: boolean;
}

/**
 * Default implementation of the LoggerManager interface
 */
export class DefaultLoggerManager extends AbstractBaseManager implements LoggerManager {
  public readonly managerId: string;
  public readonly managerType = ManagerType.LOGGER;
  private logHistory: LogEntry[] = [];
  private config: LoggerManagerConfig;

  /**
   * Create a new DefaultLoggerManager
   * 
   * @param agent - The agent this manager belongs to
   * @param config - Optional configuration
   */
  constructor(agent: AgentBase, config?: Partial<LoggerManagerConfig>) {
    // Create default config
    const defaultConfig: LoggerManagerConfig = {
      enabled: true,
      level: LogLevel.INFO,
      maxHistorySize: 1000,
      logToConsole: true,
      includeMetadata: true,
      formatMessages: true,
      trackLogHistory: true,
      ...config
    };

    super(
      `logger-manager-${uuidv4()}`, 
      ManagerType.LOGGER, 
      agent,
      defaultConfig
    );

    this.managerId = `logger-manager-${uuidv4()}`;
    this.config = defaultConfig;
  }

  /**
   * Initialize the logger manager
   */
  async initialize(): Promise<boolean> {
    this.log(`Initializing logger manager for agent ${this.getAgent().getAgentId()}`);
    return super.initialize();
  }

  /**
   * Get manager health status
   */
  async getHealth(): Promise<ManagerHealth> {
    const isEnabled = this.isEnabled();
    const logCount = this.logHistory.length;
    
    return {
      status: isEnabled ? 'healthy' : 'unhealthy',
      message: isEnabled 
        ? `Logger is healthy, tracking ${logCount} entries` 
        : 'Logger is disabled',
      metrics: {
        logEntries: logCount,
        maxCapacity: this.config.maxHistorySize,
        utilizationPercent: logCount / this.config.maxHistorySize * 100
      },
      details: {
        lastCheck: new Date(),
        issues: !isEnabled ? [{
          severity: 'medium',
          message: 'Logger manager is disabled',
          detectedAt: new Date()
        }] : []
      }
    };
  }

  /**
   * Get agent this manager belongs to
   */
  getAgent(): AgentBase {
    return super.getAgent();
  }

  /**
   * Create a log entry and store it
   */
  private createLogEntry(
    level: LogLevel, 
    message: string, 
    metadata?: Record<string, unknown>,
    managerId?: string
  ): LogEntry {
    const logEntry: LogEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      level,
      message,
      agentId: this.getAgent().getAgentId(),
      managerId,
      metadata
    };

    // Add to history if tracking is enabled
    if (this.config.trackLogHistory) {
      this.logHistory.push(logEntry);
      
      // Trim if exceeding max size
      if (this.logHistory.length > this.config.maxHistorySize) {
        this.logHistory = this.logHistory.slice(-this.config.maxHistorySize);
      }
    }

    return logEntry;
  }

  /**
   * Format a log message based on config
   */
  private formatLogMessage(entry: LogEntry): string {
    if (!this.config.formatMessages) {
      return entry.message;
    }

    const agentId = entry.agentId ? `[${entry.agentId}]` : '';
    const managerId = entry.managerId ? `[${entry.managerId}]` : '';
    
    return `${agentId}${managerId} ${entry.message}`;
  }

  /**
   * General log method (defaults to INFO level)
   */
  log(message: string, metadata?: Record<string, unknown>): void {
    this.info(message, metadata);
  }

  /**
   * Log a debug message
   */
  debug(message: string, metadata?: Record<string, unknown>): void {
    if (!this.isEnabled() || this.config.level === LogLevel.INFO || 
        this.config.level === LogLevel.WARN || this.config.level === LogLevel.ERROR) {
      return;
    }

    const entry = this.createLogEntry(LogLevel.DEBUG, message, metadata);
    
    if (this.config.logToConsole) {
      const formattedMessage = this.formatLogMessage(entry);
      systemLogger.debug(formattedMessage, this.config.includeMetadata ? metadata : undefined);
    }
  }

  /**
   * Log an info message
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    if (!this.isEnabled() || this.config.level === LogLevel.WARN || 
        this.config.level === LogLevel.ERROR) {
      return;
    }

    const entry = this.createLogEntry(LogLevel.INFO, message, metadata);
    
    if (this.config.logToConsole) {
      const formattedMessage = this.formatLogMessage(entry);
      systemLogger.info(formattedMessage, this.config.includeMetadata ? metadata : undefined);
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    if (!this.isEnabled() || this.config.level === LogLevel.ERROR) {
      return;
    }

    const entry = this.createLogEntry(LogLevel.WARN, message, metadata);
    
    if (this.config.logToConsole) {
      const formattedMessage = this.formatLogMessage(entry);
      systemLogger.warn(formattedMessage, this.config.includeMetadata ? metadata : undefined);
    }
  }

  /**
   * Log an error message
   */
  error(message: string, metadata?: Record<string, unknown>): void {
    if (!this.isEnabled()) {
      return;
    }

    const entry = this.createLogEntry(LogLevel.ERROR, message, metadata);
    
    if (this.config.logToConsole) {
      const formattedMessage = this.formatLogMessage(entry);
      systemLogger.error(formattedMessage, this.config.includeMetadata ? metadata : undefined);
    }
  }

  /**
   * Get log history
   */
  getLogHistory(options?: {
    level?: LogLevel;
    managerId?: string;
    limit?: number;
    offset?: number;
  }): LogEntry[] {
    let filteredLogs = this.logHistory;
    
    // Filter by level
    if (options?.level) {
      filteredLogs = filteredLogs.filter(log => log.level === options.level);
    }
    
    // Filter by managerId
    if (options?.managerId) {
      filteredLogs = filteredLogs.filter(log => log.managerId === options.managerId);
    }
    
    // Apply pagination
    if (options?.offset !== undefined || options?.limit !== undefined) {
      const offset = options.offset ?? 0;
      const limit = options.limit ?? filteredLogs.length;
      filteredLogs = filteredLogs.slice(offset, offset + limit);
    }
    
    return filteredLogs;
  }

  /**
   * Clear log history
   */
  clearLogHistory(): void {
    this.logHistory = [];
  }

  /**
   * Override getConfig from AbstractBaseManager
   */
  override getConfig<T extends ManagerConfig>(): T {
    return this.config as unknown as T;
  }

  /**
   * Update the logger configuration
   */
  override updateConfig<T extends ManagerConfig>(config: Partial<T>): T {
    // Since we maintain a specialized config object but need to
    // conform to the base interface, we need to merge carefully
    const updatedConfig = {
      ...this.config,
      ...config
    };
    
    this.config = updatedConfig as LoggerManagerConfig;
    
    return this.config as unknown as T;
  }

  /**
   * Shutdown the logger
   */
  override async shutdown(): Promise<void> {
    this.info('Logger manager shutting down');
    await super.shutdown();
  }
} 