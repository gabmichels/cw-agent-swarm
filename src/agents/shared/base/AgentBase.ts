/**
 * AgentBase.ts - Core base class for all agents in the system
 * 
 * This base class provides common functionality that all agents share:
 * - Memory management with agent-scoped access using standardized memory system
 * - Tool management with permissions
 * - Planning and execution capabilities
 * - Agent coordination for delegation
 * - Inter-agent messaging
 * - Pluggable manager architecture for customizing agent capabilities
 */

import { AgentMessage, MessageRouter, MessageType } from '../messaging/MessageRouter';
import { BaseManager, ManagerConfig } from './managers/BaseManager';
import { 
  AgentStatus, 
  AgentBaseConfig, 
  AgentCapability 
} from './types';

/**
 * Managers configuration for the agent
 */
export interface ManagersConfig {
  memory?: ManagerConfig;
  planning?: ManagerConfig;
  knowledge?: ManagerConfig;
  scheduler?: ManagerConfig;
  reflection?: ManagerConfig;
  tools?: ManagerConfig;
  [key: string]: ManagerConfig | undefined;
}

/**
 * Base agent interface that all agent implementations extend
 */
export interface AgentBase {
  /**
   * Get the unique ID of this agent
   * @returns The agent ID string
   */
  getAgentId(): string;
  
  /**
   * Get the agent name
   * @returns The agent name
   */
  getName(): string;
  
  /**
   * Get the agent configuration
   * @returns The current agent configuration
   */
  getConfig(): AgentBaseConfig;
  
  /**
   * Update the agent configuration
   * @param config The configuration updates to apply
   */
  updateConfig(config: Partial<AgentBaseConfig>): void;
  
  /**
   * Initialize the agent
   * @returns Promise resolving to true if initialization succeeds
   */
  initialize(): Promise<boolean>;
  
  /**
   * Shutdown the agent and release resources
   * @returns Promise that resolves when shutdown is complete
   */
  shutdown(): Promise<void>;
  
  /**
   * Register a manager with this agent
   * @param manager The manager to register
   * @returns The registered manager
   */
  registerManager<T extends BaseManager>(manager: T): T;
  
  /**
   * Get a registered manager by type
   * @param managerType The type of manager to retrieve
   * @returns The manager instance or undefined if not found
   */
  getManager<T extends BaseManager>(managerType: string): T | undefined;
  
  /**
   * Get all registered managers
   * @returns An array of all registered managers
   */
  getManagers(): BaseManager[];
  
  /**
   * Check if the agent is currently enabled
   * @returns Whether the agent is enabled (status is not OFFLINE)
   */
  isEnabled(): boolean;
  
  /**
   * Enable or disable the agent
   * @param enabled Whether to enable or disable
   * @returns The updated enabled state
   */
  setEnabled(enabled: boolean): boolean;
  
  /**
   * Check if a capability is enabled
   * @param capabilityId The ID of the capability to check
   * @returns Whether the capability is enabled
   */
  hasCapability(capabilityId: string): boolean;
  
  /**
   * Enable a capability
   * @param capability The capability to enable
   */
  enableCapability(capability: AgentCapability): void;
  
  /**
   * Disable a capability
   * @param capabilityId The ID of the capability to disable
   */
  disableCapability(capabilityId: string): void;
  
  /**
   * Get agent health status
   * @returns The current health status
   */
  getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    managerHealth?: Record<string, {
      status: 'healthy' | 'degraded' | 'unhealthy';
      message?: string;
    }>;
  }>;
}

/**
 * Abstract implementation of the AgentBase interface
 * Provides common functionality for concrete agent implementations
 */
export abstract class AbstractAgentBase implements AgentBase {
  /** Agent configuration */
  protected config: AgentBaseConfig;
  
  /** Registered managers */
  protected managers: BaseManager[] = [];
  
  /**
   * Create a new agent instance
   * @param config Agent configuration
   */
  constructor(config: AgentBaseConfig) {
    this.config = config;
  }
  
  /**
   * Get the unique ID of this agent
   */
  getAgentId(): string {
    // Use the string id from StructuredId
    return typeof this.config.id === 'object' ? this.config.id.id : String(this.config.id);
  }
  
  /**
   * Get the agent name
   */
  getName(): string {
    return this.config.name;
  }
  
  /**
   * Get the agent configuration
   */
  getConfig(): AgentBaseConfig {
    return this.config;
  }
  
  /**
   * Update the agent configuration
   */
  updateConfig(config: Partial<AgentBaseConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Initialize the agent
   */
  abstract initialize(): Promise<boolean>;
  
  /**
   * Shutdown the agent
   */
  abstract shutdown(): Promise<void>;
  
  /**
   * Register a manager with this agent
   */
  registerManager<T extends BaseManager>(manager: T): T {
    const existingManager = this.managers.find(m => m.getType() === manager.getType());
    if (existingManager) {
      this.managers = this.managers.filter(m => m.getType() !== manager.getType());
    }
    this.managers.push(manager);
    return manager;
  }
  
  /**
   * Get a registered manager by type
   */
  getManager<T extends BaseManager>(managerType: string): T | undefined {
    return this.managers.find(manager => manager.getType() === managerType) as T | undefined;
  }
  
  /**
   * Get all registered managers
   */
  getManagers(): BaseManager[] {
    return this.managers;
  }
  
  /**
   * Check if the agent is currently enabled
   */
  isEnabled(): boolean {
    // Treat status OFFLINE as not enabled
    return this.config.status !== AgentStatus.OFFLINE;
  }
  
  /**
   * Enable or disable the agent
   */
  setEnabled(enabled: boolean): boolean {
    // Set status based on enabled flag
    this.config.status = enabled ? AgentStatus.AVAILABLE : AgentStatus.OFFLINE;
    return this.isEnabled();
  }
  
  /**
   * Check if a capability is enabled
   * @param capabilityId The ID of the capability to check
   * @returns Whether the capability is enabled
   */
  hasCapability(capabilityId: string): boolean {
    return this.config.capabilities.some((cap: AgentCapability) => cap.id === capabilityId);
  }
  
  /**
   * Enable a capability
   * @param capability The capability to enable
   */
  enableCapability(capability: AgentCapability): void {
    if (!this.hasCapability(capability.id)) {
      this.config.capabilities.push(capability);
    }
  }

  /**
   * Disable a capability
   * @param capabilityId The ID of the capability to disable
   */
  disableCapability(capabilityId: string): void {
    this.config.capabilities = this.config.capabilities.filter((cap: AgentCapability) => cap.id !== capabilityId);
  }
  
  /**
   * Get agent health status
   * @returns The current health status
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    managerHealth?: Record<string, {
      status: 'healthy' | 'degraded' | 'unhealthy';
      message?: string;
    }>;
  }> {
    // Get health status from all managers
    const managerHealthPromises = this.managers.map(
      async manager => {
        try {
          const health = await manager.getHealth();
          return [manager.getType(), health] as const;
        } catch (error) {
          return [
            manager.getType(), 
            { 
              status: 'unhealthy' as const,
              message: `Failed to get health: ${error}`
            }
          ] as const;
        }
      }
    );
    
    const managerHealthResults = await Promise.all(managerHealthPromises);
    const managerHealth: Record<string, {
      status: 'healthy' | 'degraded' | 'unhealthy';
      message?: string;
    }> = Object.fromEntries(managerHealthResults);
    
    // Determine overall agent health based on manager health
    const healthStatuses = Object.values(managerHealth).map(h => h.status);
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (healthStatuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (healthStatuses.includes('degraded')) {
      overallStatus = 'degraded';
    }
      
      return {
      status: overallStatus,
      message: `Agent ${this.getAgentId()} is ${overallStatus}`,
      managerHealth
    };
  }
}
