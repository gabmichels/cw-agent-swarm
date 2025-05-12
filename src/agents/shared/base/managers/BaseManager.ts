/**
 * Base Manager Interface
 * 
 * This file defines the base manager interface that all specialized
 * agent managers extend from. It provides core functionality common
 * to all manager types.
 */

import type { AgentBase } from '../AgentBase';

/**
 * Manager configuration interface
 */
export interface ManagerConfig {
  /** Whether this manager is enabled */
  enabled: boolean;
  
  /** Additional configuration properties */
  [key: string]: unknown;
}

/**
 * Base manager interface that all specialized managers extend
 */
export interface BaseManager {
  /**
   * Get the unique ID of this manager
   * @returns The manager ID string
   */
  getId(): string;
  
  /**
   * Get the manager type
   * @returns The manager type string
   */
  getType(): string;
  
  /**
   * Get the manager configuration
   * @returns The current manager configuration
   */
  getConfig<T extends ManagerConfig>(): T;
  
  /**
   * Update the manager configuration
   * @param config The configuration updates to apply
   * @returns The updated configuration
   */
  updateConfig<T extends ManagerConfig>(config: Partial<T>): T;
  
  /**
   * Get the associated agent instance
   * @returns The agent instance this manager belongs to
   */
  getAgent(): AgentBase;
  
  /**
   * Initialize the manager
   * @returns Promise resolving to true if initialization succeeds
   */
  initialize(): Promise<boolean>;
  
  /**
   * Shutdown the manager and release resources
   * @returns Promise that resolves when shutdown is complete
   */
  shutdown(): Promise<void>;
  
  /**
   * Check if the manager is currently enabled
   * @returns Whether the manager is enabled
   */
  isEnabled(): boolean;
  
  /**
   * Enable or disable the manager
   * @param enabled Whether to enable or disable
   * @returns The updated enabled state
   */
  setEnabled(enabled: boolean): boolean;
  
  /**
   * Reset the manager to its initial state
   * @returns Promise resolving to true if reset succeeds
   */
  reset(): Promise<boolean>;
  
  /**
   * Get manager health status
   * @returns The current health status
   */
  getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    metrics?: Record<string, unknown>;
  }>;
}

/**
 * BaseManager.ts - Base manager implementation
 * 
 * This file provides the base manager implementation that all managers should extend.
 */

export abstract class BaseManager {
  protected agent: AgentBase;
  protected type: string;
  protected initialized: boolean = false;

  constructor(agent: AgentBase, type: string) {
    this.agent = agent;
    this.type = type;
  }

  getType(): string {
    return this.type;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getAgent(): AgentBase {
    return this.agent;
  }
}

/**
 * Abstract implementation of the BaseManager interface
 * Provides common functionality for concrete manager implementations
 */
export abstract class AbstractBaseManager extends BaseManager implements BaseManager {
  /** Unique identifier for this manager instance */
  protected managerId: string;
  
  /** Type of manager (e.g., 'memory', 'tool', 'scheduler') */
  protected managerType: string;
  
  /** Manager configuration */
  protected config: ManagerConfig;
  
  /** Whether the manager is initialized */
  protected initialized: boolean = false;
  
  /**
   * Create a new manager instance
   * @param managerId Unique ID for this manager
   * @param managerType Type of manager
   * @param agent The agent this manager belongs to
   * @param config Manager configuration
   */
  constructor(
    managerId: string,
    managerType: string,
    agent: AgentBase,
    config: ManagerConfig
  ) {
    super(agent, managerType);
    this.managerId = managerId;
    this.managerType = managerType;
    this.config = {
      ...config,
      enabled: config.enabled ?? true
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
   * Get the manager's configuration
   */
  getConfig<T extends ManagerConfig>(): T {
    return this.config as T;
  }

  /**
   * Update the manager configuration
   */
  updateConfig<T extends ManagerConfig>(config: Partial<T>): T {
    this.config = {
      ...this.config,
      ...config
    };
    return this.config as T;
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
  setEnabled(enabled: boolean): boolean {
    const wasEnabled = this.config.enabled;
    this.config.enabled = enabled;
    return wasEnabled !== enabled;  // Return true if state changed
  }

  /**
   * Initialize the manager
   */
  abstract initialize(): Promise<boolean>;

  /**
   * Shut down the manager and release resources
   */
  abstract shutdown(): Promise<void>;

  /**
   * Reset the manager to its initial state
   */
  async reset(): Promise<boolean> {
    await this.shutdown();
    const success = await this.initialize();
    return success;
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

  /**
   * Get manager health status
   * @returns The current health status
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    metrics?: Record<string, unknown>;
  }> {
    return {
      status: 'healthy',
      message: `${this.managerType} manager is healthy`
    };
  }
} 