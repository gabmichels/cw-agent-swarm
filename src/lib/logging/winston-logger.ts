/**
 * winston-logger.ts - Standardized application logging based on Winston
 * 
 * This module provides a centralized logging solution using Winston for
 * consistent logging across all components of the application.
 */

import * as winston from 'winston';
import * as Transport from 'winston-transport';

// Define log levels with proper order (debug is lowest, fatal is highest)
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
  SYSTEM = 'system',  // Added system level for system-related messages
  SUCCESS = 'success' // Added success level for success messages
}

// Log level priorities (lower number = higher priority)
const LOG_LEVEL_PRIORITIES: Record<string, number> = {
  [LogLevel.DEBUG]: 7,
  [LogLevel.INFO]: 6, 
  [LogLevel.SUCCESS]: 5, // Put success between info and warn
  [LogLevel.SYSTEM]: 4,  // Put system between success and warn
  [LogLevel.WARN]: 3,
  [LogLevel.ERROR]: 2,
  [LogLevel.FATAL]: 1
};

// Winston custom format for colorized output
const colorizedFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, moduleId, agentId, ...metadata }) => {
    const moduleStr = moduleId ? `[${moduleId}]` : '';
    const agentStr = agentId ? `[${agentId}]` : '';
    const metaStr = Object.keys(metadata).length 
      ? `\n${JSON.stringify(metadata, null, 2)}`
      : '';
      
    return `${timestamp} ${level} ${agentStr}${moduleStr} ${message}${metaStr}`;
  })
);

// Add colors for our custom log levels
winston.addColors({
  debug: 'gray',
  info: 'blue',
  success: 'green',
  system: 'magenta',
  warn: 'yellow',
  error: 'red',
  fatal: 'red'
});

// Interface for logger configuration
export interface LoggerConfig {
  level: LogLevel | string;
  enableColors: boolean;
  enableConsole: boolean;
  enableFile: boolean;
  logFilePath?: string;
  additionalTransports?: Transport[];
}

// Default configuration
const DEFAULT_CONFIG: LoggerConfig = {
  level: LogLevel.DEBUG, // Debug by default as requested
  enableColors: true,    // Colors enabled by default
  enableConsole: true,   // Console output enabled by default
  enableFile: false      // File output disabled by default
};

// Create the Winston logger
const createWinstonLogger = (config: LoggerConfig = DEFAULT_CONFIG): winston.Logger => {
  // Configure transports
  const transports: Transport[] = [];
  
  // Console transport
  if (config.enableConsole) {
    transports.push(new winston.transports.Console({
      format: config.enableColors ? colorizedFormat : winston.format.simple()
    }));
  }
  
  // File transport
  if (config.enableFile && config.logFilePath) {
    transports.push(new winston.transports.File({
      filename: config.logFilePath,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }));
  }
  
  // Add any additional transports
  if (config.additionalTransports) {
    transports.push(...config.additionalTransports);
  }
  
  // Create and return the logger
  return winston.createLogger({
    level: config.level.toLowerCase(),
    levels: LOG_LEVEL_PRIORITIES,
    transports
  });
};

// Create default logger instance with default config
const defaultLogger = createWinstonLogger();

// Logging context interface
export interface LoggingContext {
  moduleId?: string;
  agentId?: string;
  [key: string]: any;
}

/**
 * Create a logger with a specific context
 * 
 * @param context The logging context (moduleId, agentId, etc.)
 * @returns A logging interface with context attached
 */
export function createLogger(context: LoggingContext = {}) {
  return {
    debug: (message: string, meta: Record<string, any> = {}) => {
      defaultLogger.debug(message, { ...context, ...meta });
    },
    info: (message: string, meta: Record<string, any> = {}) => {
      defaultLogger.info(message, { ...context, ...meta });
    },
    warn: (message: string, meta: Record<string, any> = {}) => {
      defaultLogger.warn(message, { ...context, ...meta });
    },
    error: (message: string, meta: Record<string, any> = {}) => {
      defaultLogger.error(message, { ...context, ...meta });
    },
    fatal: (message: string, meta: Record<string, any> = {}) => {
      defaultLogger.error(message, { ...context, ...meta, isFatal: true });
    },
    // Add custom log levels
    system: (message: string, meta: Record<string, any> = {}) => {
      defaultLogger.log('system', message, { ...context, ...meta });
    },
    success: (message: string, meta: Record<string, any> = {}) => {
      defaultLogger.log('success', message, { ...context, ...meta });
    }
  };
}

/**
 * Configure the global logger settings
 * 
 * @param config Configuration options for the logger
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  const newConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Create a new logger instance with the updated config
  const newLogger = createWinstonLogger(newConfig);
  
  // Update the default logger with the new instance's properties
  Object.assign(defaultLogger, newLogger);
}

/**
 * Set the global log level
 * 
 * @param level The minimum log level to output (can be LogLevel enum or string)
 */
export function setLogLevel(level: LogLevel | string): void {
  // Handle both enum and string values to be compatible with CommonJS
  let logLevel: string;
  
  if (typeof level === 'string') {
    logLevel = level;
  } else {
    // Handle enum value
    logLevel = level as string;
  }
  
  defaultLogger.level = logLevel.toLowerCase();
}

// Export the default logger for direct use
export const logger = createLogger();

// Export a convenience function to get a logger for a manager
export function getManagerLogger(managerId: string, agentId: string) {
  return createLogger({ moduleId: managerId, agentId });
}

// Export a convenience function to get a logger for an agent
export function getAgentLogger(agentId: string) {
  return createLogger({ agentId });
}

export default logger; 