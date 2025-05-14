/**
 * Simple console logging utility
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Simple console logger class
 */
export class ConsoleLogger {
  private moduleName: string;
  private logLevel: LogLevel = 'info';
  
  /**
   * Create a new console logger
   * 
   * @param moduleName Name of the module doing the logging
   */
  constructor(moduleName: string) {
    this.moduleName = moduleName;
  }
  
  /**
   * Set the minimum log level
   * 
   * @param level Minimum level to log
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }
  
  /**
   * Log a debug message
   * 
   * @param message Message to log
   * @param data Optional data to include
   */
  debug(message: string, data?: unknown): void {
    if (this.shouldLog('debug')) {
      console.debug(`[${this.moduleName}] ${message}`, data || '');
    }
  }
  
  /**
   * Log an info message
   * 
   * @param message Message to log
   * @param data Optional data to include
   */
  info(message: string, data?: unknown): void {
    if (this.shouldLog('info')) {
      console.info(`[${this.moduleName}] ${message}`, data || '');
    }
  }
  
  /**
   * Log a warning message
   * 
   * @param message Message to log
   * @param data Optional data to include
   */
  warn(message: string, data?: unknown): void {
    if (this.shouldLog('warn')) {
      console.warn(`[${this.moduleName}] ${message}`, data || '');
    }
  }
  
  /**
   * Log an error message
   * 
   * @param message Message to log
   * @param error Optional error to include
   */
  error(message: string, error?: unknown): void {
    if (this.shouldLog('error')) {
      console.error(`[${this.moduleName}] ${message}`, error || '');
    }
  }
  
  /**
   * Determine if a message should be logged based on log level
   * 
   * @param level Level of the current message
   * @returns Whether the message should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentIndex = levels.indexOf(this.logLevel);
    const msgIndex = levels.indexOf(level);
    
    // Log if message level is equal to or higher than the set log level
    return msgIndex >= currentIndex;
  }
} 