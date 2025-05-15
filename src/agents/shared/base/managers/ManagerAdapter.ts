import { BaseManager, ManagerConfig } from './BaseManager';
import { IManager } from '../../../../lib/shared/types/agentTypes';
import { AgentBase } from '../AgentBase';
import { ManagerType } from './ManagerType';
import { ManagerHealth } from './ManagerHealth';

/**
 * Adapter class that adapts IManager to BaseManager
 */
export class ManagerAdapter implements BaseManager {
  public readonly managerId: string;
  public readonly managerType: ManagerType;
  private manager: IManager;
  private _config: ManagerConfig;
  private _initialized: boolean = false;
  private readonly agent: AgentBase;

  constructor(manager: IManager, agent: AgentBase, type: ManagerType) {
    this.manager = manager;
    this.agent = agent;
    this.managerId = `${agent.getAgentId()}-${type}`;
    this.managerType = type;
    this._config = {
      enabled: true
    };
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
    try {
      await this.manager.initialize();
      this._initialized = true;
      return true;
    } catch (error) {
      console.error(`Error initializing manager ${this.managerType}:`, error);
      return false;
    }
  }

  async shutdown(): Promise<void> {
    if (this.manager.shutdown) {
      await this.manager.shutdown();
    }
    this._initialized = false;
  }

  isEnabled(): boolean {
    return this._config.enabled;
  }

  setEnabled(enabled: boolean): boolean {
    this._config.enabled = enabled;
    return this._config.enabled;
  }

  async reset(): Promise<boolean> {
    // IManager doesn't have reset, so we'll just reinitialize
    this._initialized = false;
    return this.initialize();
  }

  async getHealth(): Promise<ManagerHealth> {
    // IManager doesn't have health check, so we'll check initialization
    return {
      status: this.manager.isInitialized() ? 'healthy' : 'unhealthy',
      details: {
        lastCheck: new Date(),
        issues: [],
        metrics: {
          initialized: this.manager.isInitialized()
        }
      }
    };
  }
} 