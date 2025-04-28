/**
 * Base interface for all Manager classes within the agent system.
 */
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
   * @returns Promise resolving to a status object or string.
   */
  diagnose?(): Promise<any>; // TODO: Define a standardized diagnosis result type
} 