/**
 * AgentLifecycleManager.ts - Handles agent lifecycle operations
 * 
 * This component is responsible for:
 * - Start/stop/pause/resume operations
 * - Health monitoring and status reporting
 * - Graceful shutdown procedures
 * - Resource cleanup management
 */

import { AgentBase } from '../base/AgentBase.interface';
import { BaseManager } from '../base/managers/BaseManager';
import { ManagerType } from '../base/managers/ManagerType';
import { ModularSchedulerManager } from '../../../lib/scheduler/implementations/ModularSchedulerManager';
import { OpportunityManager } from '../../../lib/opportunity';
import { ResourceUtilizationTracker } from '../scheduler/ResourceUtilization';
import { createLogger } from '../../../lib/logging/winston-logger';

/**
 * Agent status enumeration
 */
export enum AgentStatus {
  INITIALIZING = 'initializing',
  AVAILABLE = 'available',
  BUSY = 'busy',
  PAUSED = 'paused',
  SHUTTING_DOWN = 'shutting_down',
  OFFLINE = 'offline',
  ERROR = 'error'
}

/**
 * Agent health information
 */
export interface AgentHealth {
  status: AgentStatus;
  uptime: number;
  lastActivity: Date;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  managerHealth: Array<{
    type: ManagerType;
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: Date;
    issues: string[];
  }>;
  resourceUtilization?: {
    cpu: number;
    memory: number;
    tokensPerMinute: number;
    apiCallsPerMinute: number;
  };
}

/**
 * Lifecycle operation result
 */
export interface LifecycleOperationResult {
  success: boolean;
  message: string;
  previousStatus: AgentStatus;
  newStatus: AgentStatus;
  timestamp: Date;
  errors?: Error[];
}

/**
 * Error class for lifecycle-related errors
 */
export class AgentLifecycleError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown>;

  constructor(message: string, code = 'LIFECYCLE_ERROR', context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'AgentLifecycleError';
    this.code = code;
    this.context = context;
  }
}

/**
 * AgentLifecycleManager class - Handles agent lifecycle operations
 */
export class AgentLifecycleManager {
  private logger: ReturnType<typeof createLogger>;
  private agent: AgentBase;
  private status: AgentStatus = AgentStatus.OFFLINE;
  private startTime: Date | null = null;
  private lastActivity: Date = new Date();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private memoryRefreshInterval: NodeJS.Timeout | null = null;
  private shutdownPromise: Promise<void> | null = null;
  private shuttingDown = false;

  constructor(agent: AgentBase) {
    this.agent = agent;
    this.logger = createLogger({
      moduleId: 'agent-lifecycle-manager',
    });
  }

  /**
   * Start the agent
   */
  async start(): Promise<LifecycleOperationResult> {
    const previousStatus = this.status;
    
    try {
      this.logger.info(`Starting agent ${this.agent.getId()}`);
      
      if (this.status === AgentStatus.AVAILABLE) {
        return {
          success: true,
          message: 'Agent is already running',
          previousStatus,
          newStatus: this.status,
          timestamp: new Date()
        };
      }
      
      if (this.status === AgentStatus.SHUTTING_DOWN) {
        throw new AgentLifecycleError(
          'Cannot start agent while it is shutting down',
          'INVALID_STATE_TRANSITION'
        );
      }
      
      this.status = AgentStatus.INITIALIZING;
      this.startTime = new Date();
      this.lastActivity = new Date();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Start memory refresh if configured
      this.startMemoryRefresh();
      
      this.status = AgentStatus.AVAILABLE;
      this.logger.info(`Agent ${this.agent.getId()} started successfully`);
      
      return {
        success: true,
        message: 'Agent started successfully',
        previousStatus,
        newStatus: this.status,
        timestamp: new Date()
      };
      
    } catch (error) {
      this.status = AgentStatus.ERROR;
      this.logger.error(`Error starting agent ${this.agent.getId()}:`, { error: error instanceof Error ? error.message : String(error) });
      
      return {
        success: false,
        message: `Failed to start agent: ${(error as Error).message}`,
        previousStatus,
        newStatus: this.status,
        timestamp: new Date(),
        errors: [error as Error]
      };
    }
  }

  /**
   * Stop the agent
   */
  async stop(): Promise<LifecycleOperationResult> {
    const previousStatus = this.status;
    
    try {
      this.logger.info(`Stopping agent ${this.agent.getId()}`);
      
      if (this.status === AgentStatus.OFFLINE) {
        return {
          success: true,
          message: 'Agent is already stopped',
          previousStatus,
          newStatus: this.status,
          timestamp: new Date()
        };
      }
      
      this.status = AgentStatus.SHUTTING_DOWN;
      this.shuttingDown = true;
      
      // Perform graceful shutdown
      await this.performGracefulShutdown();
      
      this.status = AgentStatus.OFFLINE;
      this.startTime = null;
      this.shuttingDown = false;
      
      this.logger.info(`Agent ${this.agent.getId()} stopped successfully`);
      
      return {
        success: true,
        message: 'Agent stopped successfully',
        previousStatus,
        newStatus: this.status,
        timestamp: new Date()
      };
      
    } catch (error) {
      this.status = AgentStatus.ERROR;
      this.shuttingDown = false;
      this.logger.error(`Error stopping agent ${this.agent.getId()}:`, { error: error instanceof Error ? error.message : String(error) });
      
      return {
        success: false,
        message: `Failed to stop agent: ${(error as Error).message}`,
        previousStatus,
        newStatus: this.status,
        timestamp: new Date(),
        errors: [error as Error]
      };
    }
  }

  /**
   * Pause the agent
   */
  async pause(): Promise<LifecycleOperationResult> {
    const previousStatus = this.status;
    
    if (this.status !== AgentStatus.AVAILABLE && this.status !== AgentStatus.BUSY) {
      return {
        success: false,
        message: `Cannot pause agent from status: ${this.status}`,
        previousStatus,
        newStatus: this.status,
        timestamp: new Date()
      };
    }

    try {
      this.logger.info(`Pausing agent ${this.agent.getId()}...`);
      this.status = AgentStatus.PAUSED;
      
      // Pause all managers
      await this.pauseManagers();
      
      this.logger.info(`Agent ${this.agent.getId()} paused successfully`);
      
      return {
        success: true,
        message: 'Agent paused successfully',
        previousStatus,
        newStatus: this.status,
        timestamp: new Date()
      };
      
    } catch (error) {
      this.status = previousStatus; // Revert status on error
      this.logger.error(`Error pausing agent ${this.agent.getId()}:`, { error: error instanceof Error ? error.message : String(error) });
      
      return {
        success: false,
        message: `Failed to pause agent: ${(error as Error).message}`,
        previousStatus,
        newStatus: this.status,
        timestamp: new Date(),
        errors: [error as Error]
      };
    }
  }

  /**
   * Resume the agent from paused state
   */
  async resume(): Promise<LifecycleOperationResult> {
    const previousStatus = this.status;
    
    if (this.status !== AgentStatus.PAUSED) {
      return {
        success: false,
        message: `Cannot resume agent from status: ${this.status}`,
        previousStatus,
        newStatus: this.status,
        timestamp: new Date()
      };
    }

    try {
      this.logger.info(`Resuming agent ${this.agent.getId()}...`);
      this.status = AgentStatus.AVAILABLE;
      
      // Resume all managers
      await this.resumeManagers();
      
      this.logger.info(`Agent ${this.agent.getId()} resumed successfully`);
      
      return {
        success: true,
        message: 'Agent resumed successfully',
        previousStatus,
        newStatus: this.status,
        timestamp: new Date()
      };
      
    } catch (error) {
      this.status = previousStatus; // Revert status on error
      this.logger.error(`Error resuming agent ${this.agent.getId()}:`, { error: error instanceof Error ? error.message : String(error) });
      
      return {
        success: false,
        message: `Failed to resume agent: ${(error as Error).message}`,
        previousStatus,
        newStatus: this.status,
        timestamp: new Date(),
        errors: [error as Error]
      };
    }
  }

  /**
   * Get current agent status
   */
  getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * Update last activity timestamp
   */
  updateActivity(): void {
    this.lastActivity = new Date();
  }

  /**
   * Set agent status to busy
   */
  setBusy(): void {
    if (this.status === AgentStatus.AVAILABLE) {
      this.status = AgentStatus.BUSY;
      this.updateActivity();
    }
  }

  /**
   * Set agent status to available
   */
  setAvailable(): void {
    if (this.status === AgentStatus.BUSY) {
      this.status = AgentStatus.AVAILABLE;
      this.updateActivity();
    }
  }

  /**
   * Get comprehensive health information
   */
  async getHealth(): Promise<AgentHealth> {
    const uptime = this.startTime ? Date.now() - this.startTime.getTime() : 0;
    const memoryUsage = this.getMemoryUsage();
    const managerHealth = await this.getManagerHealth();
    const resourceUtilization = this.getResourceUtilization();

    return {
      status: this.status,
      uptime,
      lastActivity: this.lastActivity,
      memoryUsage,
      managerHealth,
      resourceUtilization
    };
  }

  /**
   * Check if the agent is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const health = await this.getHealth();
      
      // Agent is healthy if:
      // 1. Status is not ERROR
      // 2. All managers are healthy or degraded (not unhealthy)
      // 3. Memory usage is below 90%
      
      if (health.status === AgentStatus.ERROR) {
        return false;
      }
      
      if (health.memoryUsage.percentage > 90) {
        return false;
      }
      
      const unhealthyManagers = health.managerHealth.filter(m => m.status === 'unhealthy');
      if (unhealthyManagers.length > 0) {
        return false;
      }
      
      return true;
    } catch (error) {
      this.logger.error('Error checking agent health:', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  /**
   * Perform graceful shutdown
   */
  private async performGracefulShutdown(): Promise<void> {
    try {
      this.logger.info(`Performing graceful shutdown for agent ${this.agent.getId()}...`);
      
      // Stop health monitoring first
      this.stopHealthMonitoring();
      this.stopMemoryRefresh();
      
      // Execute shutdown
      await this.executeShutdown();
      
    } catch (error) {
      this.logger.error('Error during graceful shutdown:', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      this.shutdownPromise = null;
    }
  }

  /**
   * Execute shutdown procedure
   */
  private async executeShutdown(): Promise<void> {
    try {
      this.logger.info('Starting graceful shutdown procedure');
      
      // Stop health monitoring
      this.stopHealthMonitoring();
      
      // Stop memory refresh
      this.stopMemoryRefresh();
      
      // Shutdown all managers
      await this.shutdownManagers();
      
      // Clean up resources
      await this.cleanupResources();
      
      this.logger.info('Graceful shutdown completed');
      
    } catch (error) {
              this.logger.error('Error during graceful shutdown:', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      return; // Already monitoring
    }
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        const isHealthy = await this.isHealthy();
        if (!isHealthy && this.status !== AgentStatus.ERROR) {
          this.logger.warn(`Agent ${this.agent.getId()} health check failed`);
        }
      } catch (error) {
        this.logger.error('Error during health check:', { error: error instanceof Error ? error.message : String(error) });
      }
    }, 30000); // Check every 30 seconds
    
    this.logger.info('Health monitoring started');
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      this.logger.info('Health monitoring stopped');
    }
  }

  /**
   * Start memory refresh
   */
  private startMemoryRefresh(): void {
    // This would be configured based on agent configuration
    // For now, we'll skip automatic memory refresh setup
    this.logger.info('Memory refresh monitoring ready');
  }

  /**
   * Stop memory refresh
   */
  private stopMemoryRefresh(): void {
    if (this.memoryRefreshInterval) {
      clearInterval(this.memoryRefreshInterval);
      this.memoryRefreshInterval = null;
      this.logger.info('Memory refresh stopped');
    }
  }

  /**
   * Pause all managers
   */
  private async pauseManagers(): Promise<void> {
    for (const manager of this.agent.getManagers().values()) {
      try {
        if (typeof (manager as any).pause === 'function') {
          await (manager as any).pause();
        }
      } catch (error) {
        this.logger.error(`Error pausing manager ${manager.managerType}:`, { error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  /**
   * Resume all managers
   */
  private async resumeManagers(): Promise<void> {
    for (const manager of this.agent.getManagers().values()) {
      try {
        if (typeof (manager as any).resume === 'function') {
          await (manager as any).resume();
        }
      } catch (error) {
        this.logger.error(`Error resuming manager ${manager.managerType}:`, { error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  /**
   * Shutdown all managers
   */
  private async shutdownManagers(): Promise<void> {
    for (const manager of this.agent.getManagers().values()) {
      try {
        if (typeof (manager as any).shutdown === 'function') {
          await (manager as any).shutdown();
        }
      } catch (error) {
        this.logger.error(`Error shutting down manager ${manager.managerType}:`, { error: error instanceof Error ? error.message : String(error) });
      }
    }
    
    // Shutdown scheduler manager if it exists
    const schedulerManager = (this.agent as any).getSchedulerManager?.();
    if (schedulerManager && typeof schedulerManager.shutdown === 'function') {
      try {
        await schedulerManager.shutdown();
        this.logger.info('Shutdown scheduler manager');
      } catch (error) {
        this.logger.error('Error shutting down scheduler manager:', { error: error instanceof Error ? error.message : String(error) });
      }
    }
    
    // Shutdown opportunity manager if it exists
    const opportunityManager = (this.agent as any).getOpportunityManager?.();
    if (opportunityManager && typeof opportunityManager.shutdown === 'function') {
      try {
        await opportunityManager.shutdown();
        this.logger.info('Shutdown opportunity manager');
      } catch (error) {
        this.logger.error('Error shutting down opportunity manager:', { error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  /**
   * Clean up resources
   */
  private async cleanupResources(): Promise<void> {
    try {
      this.logger.info('Cleaning up lifecycle resources...');
      
      // Clear intervals
      this.stopHealthMonitoring();
      this.stopMemoryRefresh();
      
      // Reset state
      this.startTime = null;
      this.lastActivity = new Date();
      
      this.logger.info('Lifecycle resource cleanup completed');
      
    } catch (error) {
      this.logger.error('Error during resource cleanup:', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Get memory usage information
   */
  private getMemoryUsage(): { used: number; total: number; percentage: number } {
    const memUsage = process.memoryUsage();
    const used = memUsage.heapUsed;
    const total = memUsage.heapTotal;
    const percentage = (used / total) * 100;
    
    return { used, total, percentage };
  }

  /**
   * Get manager health information
   */
  private async getManagerHealth(): Promise<Array<{
    type: ManagerType;
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: Date;
    issues: string[];
  }>> {
    const managerHealth: Array<{
      type: ManagerType;
      status: 'healthy' | 'degraded' | 'unhealthy';
      lastCheck: Date;
      issues: string[];
    }> = [];
    
    for (const manager of this.agent.getManagers().values()) {
      try {
        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        const issues: string[] = [];
        
        // Check if manager has health method
        if (typeof manager.getHealth === 'function') {
          const health = await manager.getHealth();
          status = health.status;
          if (health.details?.issues) {
            issues.push(...health.details.issues.map((issue: any) => issue.message));
          }
        } else if (!(manager as any)._initialized) {
          status = 'unhealthy';
          issues.push('Manager not initialized');
        }
        
        managerHealth.push({
          type: manager.managerType,
          status,
          lastCheck: new Date(),
          issues
        });
        
      } catch (error) {
        managerHealth.push({
          type: manager.managerType,
          status: 'unhealthy',
          lastCheck: new Date(),
          issues: [`Health check failed: ${(error as Error).message}`]
        });
      }
    }
    
    return managerHealth;
  }

  /**
   * Get resource utilization if available
   */
  private getResourceUtilization(): {
    cpu: number;
    memory: number;
    tokensPerMinute: number;
    apiCallsPerMinute: number;
  } | undefined {
    try {
      // This would integrate with actual resource monitoring
      // For now, return mock data or undefined
      
      const resourceTracker = (this.agent as any).getResourceTracker?.();
      if (resourceTracker && typeof resourceTracker.getCurrentUtilization === 'function') {
        return resourceTracker.getCurrentUtilization();
      }
      
    } catch (error) {
      this.logger.error('Error getting resource utilization:', { error: error instanceof Error ? error.message : String(error) });
    }
    
    return undefined;
  }

  /**
   * Check if agent is shutting down
   */
  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  /**
   * Get uptime in milliseconds
   */
  getUptime(): number {
    return this.startTime ? Date.now() - this.startTime.getTime() : 0;
  }

  /**
   * Get last activity timestamp
   */
  getLastActivity(): Date {
    return this.lastActivity;
  }
} 