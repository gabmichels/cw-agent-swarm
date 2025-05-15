/**
 * Base Manager Interface and Implementation
 * 
 * This file defines the base manager interface and abstract implementation
 * that all specialized agent managers extend from. It provides core functionality 
 * common to all manager types.
 */

import type { AgentBase } from '../AgentBase.interface';
import { ManagerType } from './ManagerType';
import { ManagerHealth } from './ManagerHealth';

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
   */
  readonly managerId: string;
  
  /**
   * Get the manager type
   */
  readonly managerType: ManagerType;
  
  /**
   * Get the manager configuration
   */
  getConfig<T extends ManagerConfig>(): T;
  
  /**
   * Update the manager configuration
   */
  updateConfig<T extends ManagerConfig>(config: Partial<T>): T;
  
  /**
   * Get the associated agent instance
   */
  getAgent(): AgentBase;
  
  /**
   * Initialize the manager
   */
  initialize(): Promise<boolean>;
  
  /**
   * Shutdown the manager and release resources
   */
  shutdown(): Promise<void>;
  
  /**
   * Check if the manager is currently enabled
   */
  isEnabled(): boolean;
  
  /**
   * Enable or disable the manager
   */
  setEnabled(enabled: boolean): boolean;
  
  /**
   * Reset the manager to its initial state
   */
  reset(): Promise<boolean>;
  
  /**
   * Get manager health status
   */
  getHealth(): Promise<ManagerHealth>;
}

/**
 * Abstract base manager implementation that provides common functionality
 */
export abstract class AbstractBaseManager implements BaseManager {
  public readonly managerId: string;
  public readonly managerType: ManagerType;
  
  protected readonly agent: AgentBase;
  protected _config: ManagerConfig;
  protected _initialized: boolean;

  constructor(
    managerId: string,
    managerType: ManagerType,
    agent: AgentBase,
    config: ManagerConfig
  ) {
    this.managerId = managerId;
    this.managerType = managerType;
    this.agent = agent;
    this._config = config;
    this._initialized = false;
  }

  getConfig<T extends ManagerConfig>(): T {
    return this._config as T;
  }

  updateConfig<T extends ManagerConfig>(config: Partial<T>): T {
    this._config = {
      ...this._config,
      ...config
    };
    return this._config as T;
  }

  getAgent(): AgentBase {
    return this.agent;
  }

  async initialize(): Promise<boolean> {
    this._initialized = true;
    return true;
  }

  async shutdown(): Promise<void> {
    this._initialized = false;
  }

  isEnabled(): boolean {
    return this._config.enabled;
  }

  setEnabled(enabled: boolean): boolean {
    this._config.enabled = enabled;
    return enabled;
  }

  async reset(): Promise<boolean> {
    this._initialized = false;
    return true;
  }

  abstract getHealth(): Promise<ManagerHealth>;
} 