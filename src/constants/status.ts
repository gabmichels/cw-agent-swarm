/**
 * Constants related to status values used across various tools and systems
 */

/**
 * Generic item status
 * Common status values used throughout the codebase
 */
export enum ItemStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  STOPPED = 'stopped',
}

/**
 * Health status
 * Used for system and component health checks
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  FAILED = 'failed',
}

/**
 * Processing status
 * Used for file and data processing operations
 */
export enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Tool development status
 * Used in tool management systems
 */
export enum ToolStatus {
  PROPOSED = 'proposed',
  APPROVED = 'approved',
  IN_DEVELOPMENT = 'in_development',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}

/**
 * Knowledge gap status
 * Used in knowledge management systems
 */
export enum KnowledgeGapStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  DISMISSED = 'dismissed',
}

/**
 * Autonomy result status
 * Used to report results of autonomous operations
 */
export enum AutonomyStatus {
  SUCCESS = 'success',
  PARTIAL = 'partial',
  FAILED = 'failed',
} 