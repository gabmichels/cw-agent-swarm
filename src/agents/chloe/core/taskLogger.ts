export interface LogAction {
  action: string;
  details?: Record<string, any>;
  timestamp?: Date;
}

export class TaskLogger {
  private logs: LogAction[] = [];
  private maxLogs: number;

  constructor(maxLogs: number = 1000) {
    this.maxLogs = maxLogs;
  }

  /**
   * Log an action with optional details
   */
  logAction(action: string, details?: Record<string, any>): void {
    const logEntry: LogAction = {
      action,
      details,
      timestamp: new Date()
    };

    this.logs.push(logEntry);

    // Trim logs if exceeding max size
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  /**
   * Get all logs
   */
  getLogs(): LogAction[] {
    return [...this.logs];
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Get logs filtered by action
   */
  getLogsByAction(action: string): LogAction[] {
    return this.logs.filter(log => log.action === action);
  }

  /**
   * Get logs within a time range
   */
  getLogsInTimeRange(start: Date, end: Date): LogAction[] {
    return this.logs.filter(log => {
      const timestamp = log.timestamp || new Date();
      return timestamp >= start && timestamp <= end;
    });
  }
} 