/**
 * Structured Logger Interface
 * 
 * Simple interface for structured logging to fix compilation issues.
 * This is a minimal implementation for the unified tools foundation.
 */

export interface IStructuredLogger {
  info(message: string, context?: Record<string, unknown> | Error): void;
  error(message: string, context?: Record<string, unknown> | Error): void;
  warn(message: string, context?: Record<string, unknown> | Error): void;
  debug(message: string, context?: Record<string, unknown> | Error): void;
} 