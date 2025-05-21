/**
 * colorLogger.ts - Provides colored console logging functionality
 * 
 * This utility enables colored console output for different log levels and categories,
 * making it easier to distinguish between different types of log messages.
 */

// ANSI color codes
export const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',

  // Foreground colors
  fgBlack: '\x1b[30m',
  fgRed: '\x1b[31m',
  fgGreen: '\x1b[32m',
  fgYellow: '\x1b[33m',
  fgBlue: '\x1b[34m',
  fgMagenta: '\x1b[35m',
  fgCyan: '\x1b[36m',
  fgWhite: '\x1b[37m',
  fgGray: '\x1b[90m',

  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
  bgGray: '\x1b[100m'
};

// Log level type
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success' | 'system';

// Log level color mappings
const levelColors: Record<LogLevel, string> = {
  debug: colors.fgGray,
  info: colors.fgBlue,
  warn: colors.fgYellow,
  error: colors.fgRed,
  success: colors.fgGreen,
  system: colors.fgMagenta
};

// Category color mappings
const categoryColors: Record<string, string> = {
  scheduler: colors.fgCyan,
  memory: colors.fgMagenta,
  agent: colors.fgGreen,
  task: colors.fgYellow,
  planning: colors.fgBlue,
  autonomy: colors.fgCyan + colors.bright,
  knowledge: colors.fgGreen + colors.bright,
  default: colors.fgWhite
};

/**
 * Colorizes a string with the specified ANSI color code
 */
export function colorize(text: string, color: string): string {
  return `${color}${text}${colors.reset}`;
}

/**
 * Creates a formatted timestamp string
 */
function getTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').substr(0, 19);
}

/**
 * ColorLogger class for colored console logging
 */
export class ColorLogger {
  private moduleName: string;
  private category: string;
  private minLevel: LogLevel = 'info';
  private enableColors: boolean = true;

  /**
   * Create a new color logger
   * 
   * @param moduleName Name of the module doing the logging
   * @param category Category for grouping logs (e.g., 'scheduler', 'memory')
   */
  constructor(moduleName: string, category: string = 'default') {
    this.moduleName = moduleName;
    this.category = category.toLowerCase();
    
    // Check if colors should be disabled (can be set via env var)
    if (process.env.NO_COLOR === 'true' || process.env.DISABLE_COLORS === 'true') {
      this.enableColors = false;
    }
  }

  /**
   * Set the minimum log level
   */
  setLogLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Enable or disable colored output
   */
  setColorEnabled(enabled: boolean): void {
    this.enableColors = enabled;
  }

  /**
   * Log a message with the specified level
   */
  log(level: LogLevel, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) return;

    const timestamp = colorize(getTimestamp(), colors.fgGray);
    const levelStr = this.formatLevel(level);
    const moduleStr = this.formatModule();
    
    // Format the log message
    const formattedMsg = `${timestamp} ${levelStr} ${moduleStr} ${message}`;
    
    // Determine which console method to use
    switch (level) {
      case 'debug':
        console.debug(formattedMsg, data || '');
        break;
      case 'info':
      case 'system':
      case 'success':
        console.info(formattedMsg, data || '');
        break;
      case 'warn':
        console.warn(formattedMsg, data || '');
        break;
      case 'error':
        console.error(formattedMsg, data || '');
        break;
    }
  }

  /**
   * Format the level indicator with appropriate color
   */
  private formatLevel(level: LogLevel): string {
    const levelDisplay = level.toUpperCase().padEnd(7);
    
    if (this.enableColors) {
      return colorize(levelDisplay, levelColors[level]);
    }
    
    return `[${levelDisplay}]`;
  }

  /**
   * Format the module name with appropriate category color
   */
  private formatModule(): string {
    const categoryColor = categoryColors[this.category] || categoryColors.default;
    
    if (this.enableColors) {
      return colorize(`[${this.moduleName}]`, categoryColor);
    }
    
    return `[${this.moduleName}]`;
  }

  /**
   * Determine if a message should be logged based on the minimum log level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'success', 'system', 'warn', 'error'];
    const currentIndex = levels.indexOf(this.minLevel);
    const msgIndex = levels.indexOf(level);
    
    // Log if message level is equal to or higher than the set minimum log level
    return msgIndex >= currentIndex;
  }

  // Convenience methods for each log level

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }

  success(message: string, data?: unknown): void {
    this.log('success', message, data);
  }

  system(message: string, data?: unknown): void {
    this.log('system', message, data);
  }
}

/**
 * Create a logger for the scheduler category
 */
export function createSchedulerLogger(moduleName: string): ColorLogger {
  return new ColorLogger(moduleName, 'scheduler');
}

/**
 * Create a logger for the memory category
 */
export function createMemoryLogger(moduleName: string): ColorLogger {
  return new ColorLogger(moduleName, 'memory');
}

/**
 * Create a logger for the agent category
 */
export function createAgentLogger(moduleName: string): ColorLogger {
  return new ColorLogger(moduleName, 'agent');
}

/**
 * Create a logger for the task category
 */
export function createTaskLogger(moduleName: string): ColorLogger {
  return new ColorLogger(moduleName, 'task');
}

// Default export for direct imports
export default ColorLogger; 