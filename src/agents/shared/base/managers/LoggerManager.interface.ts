/**
 * LoggerManager.interface.ts - Logger Manager Interface
 * 
 * This file defines the logger manager interface that provides logging
 * functionality for agents.
 */

import { BaseManager } from './BaseManager';

/**
 * Interface for logger managers
 */
export interface LoggerManager extends BaseManager {
  /**
   * Log a message with optional metadata
   */
  log(message: string, metadata?: Record<string, unknown>): void;

  /**
   * Log a debug level message
   */
  debug(message: string, metadata?: Record<string, unknown>): void;

  /**
   * Log an info level message
   */
  info(message: string, metadata?: Record<string, unknown>): void;

  /**
   * Log a warning level message
   */
  warn(message: string, metadata?: Record<string, unknown>): void;

  /**
   * Log an error level message
   */
  error(message: string, metadata?: Record<string, unknown>): void;
} 