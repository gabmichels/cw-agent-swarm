/**
 * Bootstrap Logger - Simple Winston logger for bootstrap scripts
 * This is a CommonJS module for direct use in Node.js scripts
 */
const winston = require('winston');

// Create a custom format
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, moduleId, ...metadata }) => {
    const moduleStr = moduleId ? `[${moduleId}]` : '';
    const metaStr = Object.keys(metadata).length 
      ? `\n${JSON.stringify(metadata, null, 2)}`
      : '';
      
    return `${timestamp} ${level} ${moduleStr} ${message}${metaStr}`;
  })
);

// Add custom log levels and colors
const customLevels = {
  levels: {
    debug: 7,
    info: 6,
    success: 5,
    system: 4,
    warn: 3,
    error: 2,
    fatal: 1
  },
  colors: {
    debug: 'gray',
    info: 'blue',
    success: 'green',
    system: 'magenta',
    warn: 'yellow',
    error: 'red',
    fatal: 'red'
  }
};

// Add the custom colors
winston.addColors(customLevels.colors);

// Create the Winston logger
const defaultLogger = winston.createLogger({
  levels: customLevels.levels,
  level: 'debug', // Default to debug level
  format: customFormat,
  transports: [
    new winston.transports.Console()
  ]
});

// Create a logger with context
function createLogger(context = {}) {
  return {
    debug: (message, meta = {}) => {
      defaultLogger.debug(message, { ...context, ...meta });
    },
    info: (message, meta = {}) => {
      defaultLogger.info(message, { ...context, ...meta });
    },
    warn: (message, meta = {}) => {
      defaultLogger.warn(message, { ...context, ...meta });
    },
    error: (message, meta = {}) => {
      defaultLogger.error(message, { ...context, ...meta });
    },
    fatal: (message, meta = {}) => {
      defaultLogger.log('fatal', message, { ...context, ...meta });
    },
    system: (message, meta = {}) => {
      defaultLogger.log('system', message, { ...context, ...meta });
    },
    success: (message, meta = {}) => {
      defaultLogger.log('success', message, { ...context, ...meta });
    }
  };
}

// Set log level
function setLogLevel(level) {
  defaultLogger.level = level.toLowerCase();
}

// Create the default logger
const logger = createLogger();

// Export all the functions
module.exports = {
  logger,
  createLogger,
  setLogLevel
}; 