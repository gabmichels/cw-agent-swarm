/**
 * ManagerHealth.ts - Manager Health Interface
 * 
 * This file defines the interface for manager health status reporting.
 */

/**
 * Health status for a manager
 */
export interface ManagerHealth {
  /**
   * Current health status
   */
  status: 'healthy' | 'degraded' | 'unhealthy';

  /**
   * Optional message describing the health status
   */
  message?: string;

  /**
   * Optional metrics about the manager's performance
   */
  metrics?: Record<string, unknown>;

  /**
   * Detailed health information
   */
  details: {
    /**
     * When the health check was performed
     */
    lastCheck: Date;

    /**
     * Any issues detected during the health check
     */
    issues: Array<{
      /**
       * Issue severity
       */
      severity: 'low' | 'medium' | 'high' | 'critical';
      /**
       * Issue message
       */
      message: string;
      /**
       * When the issue was first detected
       */
      detectedAt: Date;
    }>;

    /**
     * Optional metrics specific to this health check
     */
    metrics?: Record<string, unknown>;
  };
} 