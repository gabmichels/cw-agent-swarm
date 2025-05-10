import { BaseManager, ManagerConfig } from './BaseManager';
import { IManager } from '../../../../lib/shared/types/agentTypes';
import { AgentBase } from '../AgentBase';

/**
 * Adapter class that adapts IManager to BaseManager
 */
export class ManagerAdapter extends BaseManager {
  private manager: IManager;
  private config: ManagerConfig;

  constructor(manager: IManager, agent: AgentBase, type: string) {
    super(agent, type);
    this.manager = manager;
    this.config = {
      enabled: true
    };
  }

  getId(): string {
    return this.manager.getAgentId();
  }

  getConfig<T extends ManagerConfig>(): T {
    return this.config as T;
  }

  updateConfig<T extends ManagerConfig>(config: Partial<T>): T {
    this.config = {
      ...this.config,
      ...config
    };
    return this.config as T;
  }

  async initialize(): Promise<boolean> {
    try {
      await this.manager.initialize();
      this.initialized = true;
      return true;
    } catch (error) {
      console.error(`Error initializing manager ${this.type}:`, error);
      return false;
    }
  }

  async shutdown(): Promise<void> {
    if (this.manager.shutdown) {
      await this.manager.shutdown();
    }
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  setEnabled(enabled: boolean): boolean {
    this.config.enabled = enabled;
    return this.config.enabled;
  }

  async reset(): Promise<boolean> {
    // IManager doesn't have reset, so we'll just reinitialize
    return this.initialize();
  }

  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    metrics?: Record<string, unknown>;
  }> {
    // IManager doesn't have health check, so we'll check initialization
    return {
      status: this.manager.isInitialized() ? 'healthy' : 'unhealthy',
      message: this.manager.isInitialized() ? 'Manager is initialized' : 'Manager is not initialized'
    };
  }
} 