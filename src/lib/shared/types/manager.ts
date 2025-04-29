/**
 * Base interface for all Manager classes within the agent system.
 */

/**
 * Standard diagnosis result type for manager health checks
 */
export interface DiagnosisResult {
  /** Status of the check: 'healthy', 'degraded', or 'failed' */
  status: 'healthy' | 'degraded' | 'failed';
  /** Summary message describing the current state */
  message: string;
  /** Optional timestamp of when the diagnosis was performed */
  timestamp?: Date;
  /** Additional metrics or measurements */
  metrics?: Record<string, number | string | boolean>;
  /** Details about specific components or subsystems */
  components?: Array<{
    name: string;
    status: 'healthy' | 'degraded' | 'failed';
    message?: string;
  }>;
  /** Any errors encountered during diagnosis */
  errors?: Array<{
    message: string;
    code?: string;
    stack?: string;
  }>;
}

export interface IManager {
  /**
   * Unique identifier for the manager (optional).
   */
  managerId?: string;

  /**
   * Flag indicating if the manager has been successfully initialized.
   */
  isInitialized(): boolean;

  /**
   * Initializes the manager, setting up necessary resources or connections.
   * @returns Promise resolving when initialization is complete.
   */
  initialize(): Promise<void>;

  /**
   * Performs cleanup and shutdown procedures for the manager.
   * @returns Promise resolving when shutdown is complete.
   */
  shutdown?(): Promise<void>;

  /**
   * Performs a health check or diagnosis of the manager's status.
   * @returns Promise resolving to a standardized diagnosis result.
   */
  diagnose?(): Promise<DiagnosisResult>;
} 