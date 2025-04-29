/**
 * Logger module
 */

type LogArgument = string | number | boolean | object | null | undefined;

interface Logger {
  debug: (message: string, ...args: LogArgument[]) => void;
  info: (message: string, ...args: LogArgument[]) => void;
  warn: (message: string, ...args: LogArgument[]) => void;
  error: (message: string, ...args: LogArgument[]) => void;
}

export const logger: Logger = {
  debug: (message: string, ...args: LogArgument[]) => {
    console.debug(`[DEBUG] ${message}`, ...args);
  },
  info: (message: string, ...args: LogArgument[]) => {
    console.info(`[INFO] ${message}`, ...args);
  },
  warn: (message: string, ...args: LogArgument[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },
  error: (message: string, ...args: LogArgument[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  }
}; 