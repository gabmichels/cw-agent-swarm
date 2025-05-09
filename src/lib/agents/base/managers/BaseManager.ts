/**
 * Base Manager Interface
 * 
 * This file defines the base manager interface that all specialized managers must implement.
 * It provides a common foundation for all manager types in the agent architecture.
 */

import type { AgentBase } from '../../../../agents/shared/base/AgentBase';

/**
 * Configuration options for all managers
 */
export interface ManagerConfig {
  /** Whether this manager is enabled */
  enabled: boolean;
  
  /** Additional configuration options specific to manager implementations */
  [key: string]: unknown;
}

/**
 * Base manager interface
 * All specialized managers must implement this interface
 */
export interface BaseManager {
  /**
   * Get the manager's unique identifier
   * @returns The manager ID
   */
  getId(): string;
  
  /**
   * Get the manager's type
   * @returns The manager type
   */
  getType(): string;
  
  /**
   * Get the agent this manager is associated with
   * @returns The agent instance
   */
  getAgent(): AgentBase;
  
  /**
   * Get the manager's configuration
   * @returns The manager configuration
   */
  getConfig(): ManagerConfig;
  
  /**
   * Check if the manager is initialized
   * @returns True if initialized, false otherwise
   */
  isInitialized(): boolean;
  
  /**
   * Check if the manager is enabled
   * @returns True if enabled, false otherwise
   */
  isEnabled(): boolean;
  
  /**
   * Enable or disable the manager
   * @param enabled Whether to enable the manager
   * @returns Promise resolving to true if the state changed, false otherwise
   */
  setEnabled(enabled: boolean): Promise<boolean>;
  
  /**
   * Initialize the manager
   * @returns Promise resolving to true if initialization was successful, false otherwise
   */
  initialize(): Promise<boolean>;
  
  /**
   * Shut down the manager and release resources
   * @returns Promise resolving when shutdown is complete
   */
  shutdown(): Promise<void>;
  
  /**
   * Reset the manager to its initial state
   * @returns Promise resolving when reset is complete
   */
  reset(): Promise<void>;
  
  /**
   * Get manager status information
   * @returns Promise resolving to manager status
   */
  getStatus(): Promise<{
    id: string;
    type: string;
    enabled: boolean;
    initialized: boolean;
    [key: string]: unknown;
  }>;
}

/**
 * Abstract base manager class
 * Provides common functionality for all manager implementations
 */
export abstract class AbstractBaseManager implements BaseManager {
  protected managerId: string;
  protected managerType: string;
  protected agent: AgentBase;
  protected config: ManagerConfig;
  protected initialized: boolean = false;
  
  /**
   * Create a new manager instance
   * @param managerId Unique identifier for this manager
   * @param managerType Type of this manager
   * @param agent The agent this manager belongs to
   * @param config Configuration options
   */
  constructor(
    managerId: string,
    managerType: string,
    agent: AgentBase,
    config: ManagerConfig
  ) {
    this.managerId = managerId;
    this.managerType = managerType;
    this.agent = agent;
    this.config = {
      // Use default configuration with user overrides
      ...{ enabled: true }, // Default: enabled
      ...config
    };
  }
  
  /**
   * Get the manager's unique identifier
   */
  getId(): string {
    return this.managerId;
  }
  
  /**
   * Get the manager's type
   */
  getType(): string {
    return this.managerType;
  }
  
  /**
   * Get the agent this manager is associated with
   */
  getAgent(): AgentBase {
    return this.agent;
  }
  
  /**
   * Get the manager's configuration
   */
  getConfig(): ManagerConfig {
    return this.config;
  }
  
  /**
   * Check if the manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Check if the manager is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
  
  /**
   * Enable or disable the manager
   */
  async setEnabled(enabled: boolean): Promise<boolean> {
    if (this.config.enabled === enabled) {
      return false; // No change
    }
    
    this.config.enabled = enabled;
    return true;
  }
  
  /**
   * Initialize the manager
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true; // Already initialized
    }
    
    // Basic initialization logic
    console.log(`[${this.managerId}] Initializing ${this.managerType} manager`);
    this.initialized = true;
    return true;
  }
  
  /**
   * Shut down the manager and release resources
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return; // Not initialized
    }
    
    console.log(`[${this.managerId}] Shutting down ${this.managerType} manager`);
    this.initialized = false;
  }
  
  /**
   * Reset the manager to its initial state
   */
  async reset(): Promise<void> {
    await this.shutdown();
    await this.initialize();
  }
  
  /**
   * Get manager status information
   */
  async getStatus(): Promise<{
    id: string;
    type: string;
    enabled: boolean;
    initialized: boolean;
    [key: string]: unknown;
  }> {
    return {
      id: this.managerId,
      type: this.managerType,
      enabled: this.isEnabled(),
      initialized: this.isInitialized()
    };
  }
} 