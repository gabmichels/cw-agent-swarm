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

import { ChatOpenAI } from '@langchain/openai';
// Standardized memory system imports
import { getMemoryServices } from '../../../server/memory/services';
import { MemoryType } from '../../../server/memory/config';
import { BaseMemorySchema, MemoryPoint } from '../../../server/memory/models';
// Core agent types and systems
import { BaseTool } from '../../../lib/shared/types/agentTypes';
import { AgentMonitor } from '../monitoring/AgentMonitor';
import { AgentMessage, MessageRouter, MessageType } from '../messaging/MessageRouter';
import { Planner, PlanningContext, Plan } from '../planning/Planner';
import { AgentHealthChecker } from '../coordination/AgentHealthChecker';
import { CapabilityRegistry, CapabilityLevel, CapabilityType, Capability } from '../coordination/CapabilityRegistry';
// Import manager system
import { BaseManager, ManagerConfig } from './managers/BaseManager';
// Imports for memory operations
import { 
  addMessageMemory, 
  addCognitiveProcessMemory, 
  addTaskMemory,
  addDocumentMemory
} from '../../../server/memory/services/memory/memory-service-wrappers';
import { 
  createThreadInfo,
  createMessageMetadata
} from '../../../server/memory/services/helpers/metadata-helpers';
import {
  createSystemId,
  createAgentId,
  createUserId,
  createChatId,
  StructuredId,
  EntityType
} from '../../../types/structured-id';
import {
  CognitiveProcessType,
  TaskStatus,
  TaskPriority,
  DocumentSource
} from '../../../types/metadata';
import { MessageRole } from '../../chloe/types/state';
import { 
  ImportanceLevel, 
  MemoryImportanceLevel 
} from '../../../constants/memory';

// Extend MessageType to include 'command' type
type ExtendedMessageType = MessageType | 'command';

// Extended agent message interface to include id
interface ExtendedAgentMessage extends AgentMessage {
  id?: string;
}

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
 * Base Agent Configuration
 */
export interface AgentBaseConfig {
  /** Unique identifier for this agent instance */
  agentId: string;
  
  /** Human-readable name for this agent */
  name: string;
  
  /** Agent version */
  version: string;
  
  /** Whether this agent is enabled */
  enabled: boolean;
  
  /** Additional agent configuration */
  [key: string]: unknown;
}

/**
 * Agent status information
 */
export interface AgentStatus {
  /** Agent ID */
  agentId: string;
  
  /** Agent name */
  name: string;
  
  /** Whether the agent is initialized */
  initialized: boolean;
  
  /** Whether the agent is enabled */
  enabled: boolean;
  
  /** Agent state information */
  state: string;
  
  /** Additional status properties */
  [key: string]: unknown;
}

/**
 * Agent configuration interface
 */
export interface AgentConfig {
  /** Unique agent identifier */
  agentId: string;
  
  /** Agent name */
  name: string;
  
  /** Agent description */
  description?: string;
  
  /** Agent capabilities */
  capabilities?: string[];
  
  /** Whether the agent is enabled */
  enabled: boolean;
  
  /** Manager configurations */
  managers?: Record<string, ManagerConfig>;
  
  /** Additional configuration properties */
  [key: string]: unknown;
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
  getConfig(): AgentConfig;
  
  /**
   * Update the agent configuration
   * @param config The configuration updates to apply
   * @returns The updated configuration
   */
  updateConfig(config: Partial<AgentConfig>): AgentConfig;
  
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
   * @returns Whether the agent is enabled
   */
  isEnabled(): boolean;
  
  /**
   * Enable or disable the agent
   * @param enabled Whether to enable or disable
   * @returns The updated enabled state
   */
  setEnabled(enabled: boolean): boolean;
  
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
  protected config: AgentConfig;
  
  /** Registered managers */
  protected managers: Map<string, BaseManager> = new Map();
  
  /**
   * Create a new agent instance
   * @param config Agent configuration
   */
  constructor(config: AgentConfig) {
    this.config = {
      ...config,
      enabled: config.enabled ?? true
    };
  }
  
  /**
   * Get the unique ID of this agent
   * @returns The agent ID
   */
  getAgentId(): string {
    return this.config.agentId;
  }
  
  /**
   * Get the agent name
   * @returns The agent name
   */
  getName(): string {
    return this.config.name;
  }
  
  /**
   * Get the agent configuration
   * @returns The current agent configuration
   */
  getConfig(): AgentConfig {
    return this.config;
  }
  
  /**
   * Update the agent configuration
   * @param config The configuration updates to apply
   * @returns The updated configuration
   */
  updateConfig(config: Partial<AgentConfig>): AgentConfig {
    this.config = {
      ...this.config,
      ...config
    };
    return this.config;
  }
  
  /**
   * Initialize the agent
   * @returns Promise resolving to true if initialization succeeds
   */
  async initialize(): Promise<boolean> {
    console.log(`[${this.getAgentId()}] Initializing agent`);
    
    // Initialize all registered managers
    const managerInitResults = await Promise.all(
      Array.from(this.managers.values()).map(manager => manager.initialize())
    );
    
    // Check if all managers initialized successfully
    return managerInitResults.every(result => result === true);
  }
  
  /**
   * Shutdown the agent and release resources
   * @returns Promise that resolves when shutdown is complete
   */
  async shutdown(): Promise<void> {
    console.log(`[${this.getAgentId()}] Shutting down agent`);
    
    // Shutdown all registered managers
    await Promise.all(
      Array.from(this.managers.values()).map(manager => manager.shutdown())
    );
  }
  
  /**
   * Register a manager with this agent
   * @param manager The manager to register
   * @returns The registered manager
   */
  registerManager<T extends BaseManager>(manager: T): T {
    const managerType = manager.getType();
    
    // Set the agent reference on the manager
    if ('setAgent' in manager && typeof manager.setAgent === 'function') {
      (manager as any).setAgent(this);
    }
    
    // Store the manager
    this.managers.set(managerType, manager);
    console.log(`[${this.getAgentId()}] Registered ${managerType} manager`);
    
    return manager;
  }
  
  /**
   * Get a registered manager by type
   * @param managerType The type of manager to retrieve
   * @returns The manager instance or undefined if not found
   */
  getManager<T extends BaseManager>(managerType: string): T | undefined {
    return this.managers.get(managerType) as T | undefined;
  }
  
  /**
   * Get all registered managers
   * @returns An array of all registered managers
   */
  getManagers(): BaseManager[] {
    return Array.from(this.managers.values());
  }
  
  /**
   * Check if the agent is currently enabled
   * @returns Whether the agent is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
  
  /**
   * Enable or disable the agent
   * @param enabled Whether to enable or disable
   * @returns The updated enabled state
   */
  setEnabled(enabled: boolean): boolean {
    this.config.enabled = enabled;
    return this.config.enabled;
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
    const managerHealthPromises = Array.from(this.managers.entries()).map(
      async ([type, manager]) => {
        try {
          const health = await manager.getHealth();
          return [type, health] as const;
        } catch (error) {
          return [
            type, 
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
