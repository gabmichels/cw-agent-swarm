/**
 * Constants related to logging and notifications
 */

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
}

/**
 * Notification levels
 * Used in notifierManager and logging systems
 */
export enum NotificationLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
}

/**
 * Notification channels
 */
export enum NotificationChannel {
  UI = 'ui',
  CONSOLE = 'console',
  EMAIL = 'email',
  SLACK = 'slack',
  DISCORD = 'discord',
} 