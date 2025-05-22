/**
 * Logging index - centralizes logging functionality for the application
 * 
 * This module exports a centralized logger instance for use throughout the application
 */

import * as winstonLogger from './winston-logger';

// Export all functions and types explicitly to ensure CommonJS compatibility
export const logger = winstonLogger.logger;
export const createLogger = winstonLogger.createLogger;
export const getManagerLogger = winstonLogger.getManagerLogger;
export const getAgentLogger = winstonLogger.getAgentLogger;
export const setLogLevel = winstonLogger.setLogLevel;
export const configureLogger = winstonLogger.configureLogger;
export const LogLevel = winstonLogger.LogLevel;

// Configure the logger if needed based on environment variables
// Use string values directly for better compatibility with CommonJS
const LOG_LEVEL = process.env.LOG_LEVEL?.toLowerCase() || 'debug';
const ENABLE_FILE_LOGGING = process.env.ENABLE_FILE_LOGGING === 'true';
const LOG_FILE_PATH = process.env.LOG_FILE_PATH || './logs/app.log';

// Apply configuration based on environment
configureLogger({
  level: LOG_LEVEL,
  enableFile: ENABLE_FILE_LOGGING,
  logFilePath: LOG_FILE_PATH,
  enableColors: process.env.DISABLE_COLORS !== 'true'
}); 