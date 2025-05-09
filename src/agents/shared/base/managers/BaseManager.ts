/**
 * BaseManager Interface
 * 
 * This file defines the core manager interface that all agent managers will implement.
 * The manager pattern allows for a pluggable component architecture where agents can
 * selectively enable different capabilities.
 */

/**
 * Configuration options for managers
 */
export interface ManagerConfig {
  enabled: boolean;
  [key: string]: any;
}

/**
 * Base interface for all managers
 */
export interface BaseManager {
  /**
   * Initialize the manager
   * @returns Promise resolving to true if initialization successful
   */
  initialize(): Promise<boolean>;
  
  /**
   * Shutdown the manager and clean up resources
   */
  shutdown(): Promise<void>;
  
  /**
   * Get the manager's current status
   * @returns Status object with manager-specific information
   */
  getStatus(): any;
  
  /**
   * Get manager ID
   * @returns Unique identifier for this manager
   */
  getManagerId(): string;
  
  /**
   * Get manager type
   * @returns Type of manager (e.g., 'memory', 'planning', 'scheduler')
   */
  getManagerType(): string;
}

/**
 * Abstract base class for all managers
 */
export abstract class AbstractBaseManager implements BaseManager {
  protected managerId: string;
  protected managerType: string;
  protected config: ManagerConfig;
  protected initialized: boolean = false;
  
  constructor(managerId: string, managerType: string, config: ManagerConfig) {
    this.managerId = managerId;
    this.managerType = managerType;
    this.config = {
      // Set defaults for any missing config values
      ...{ enabled: true },  // Default enabled unless explicitly disabled
      ...config              // Override with provided config
    };
  }
  
  async initialize(): Promise<boolean> {
    this.initialized = true;
    return true;
  }
  
  async shutdown(): Promise<void> {
    this.initialized = false;
  }
  
  getStatus(): any {
    return {
      id: this.managerId,
      type: this.managerType,
      initialized: this.initialized,
      enabled: this.config.enabled,
    };
  }
  
  getManagerId(): string {
    return this.managerId;
  }
  
  getManagerType(): string {
    return this.managerType;
  }
} 