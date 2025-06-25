/**
 * SchedulerCoordinator.ts - Centralized coordination for all agent schedulers
 * 
 * This class provides centralized timing coordination to prevent multiple
 * agent schedulers from running their own independent timers, which causes
 * rapid-fire task checking instead of the intended 60-second intervals.
 */

import { createLogger } from '../../logging/winston-logger';
import type { ModularSchedulerManager } from '../implementations/ModularSchedulerManager';

interface RegisteredScheduler {
  agentId: string;
  scheduler: ModularSchedulerManager;
  lastExecution: Date;
  enabled: boolean;
}

/**
 * Centralized scheduler coordinator to manage timing for all agent schedulers
 */
export class SchedulerCoordinator {
  private static instance: SchedulerCoordinator | null = null;
  private logger = createLogger({ moduleId: 'scheduler-coordinator' });

  private registeredSchedulers = new Map<string, RegisteredScheduler>();
  private globalTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private defaultIntervalMs = 120000; // 2 minutes - matches scheduler.config.ts

  private constructor() {
    this.logger.info('SchedulerCoordinator created');
  }

  /**
   * Get the singleton instance of the scheduler coordinator
   */
  public static getInstance(): SchedulerCoordinator {
    if (!SchedulerCoordinator.instance) {
      SchedulerCoordinator.instance = new SchedulerCoordinator();
    }
    return SchedulerCoordinator.instance;
  }

  /**
   * Register a scheduler to be coordinated
   */
  public registerScheduler(agentId: string, scheduler: ModularSchedulerManager): void {
    this.logger.info(`Registering scheduler for agent ${agentId}`);

    this.registeredSchedulers.set(agentId, {
      agentId,
      scheduler,
      lastExecution: new Date(),
      enabled: true
    });

    // Start the global timer if this is the first scheduler
    if (this.registeredSchedulers.size === 1 && !this.isRunning) {
      this.startGlobalTimer();
    }

    this.logger.info(`Scheduler registered for agent ${agentId}. Total registered: ${this.registeredSchedulers.size}`);
  }

  /**
   * Unregister a scheduler
   */
  public unregisterScheduler(agentId: string): void {
    const removed = this.registeredSchedulers.delete(agentId);
    if (removed) {
      this.logger.info(`Unregistered scheduler for agent ${agentId}. Total registered: ${this.registeredSchedulers.size}`);

      // Stop the global timer if no schedulers remain
      if (this.registeredSchedulers.size === 0) {
        this.stopGlobalTimer();
      }
    }
  }

  /**
   * Start the global coordinated timer
   */
  private startGlobalTimer(): void {
    if (this.isRunning) {
      this.logger.warn('Global timer is already running');
      return;
    }

    this.logger.info(`Starting global scheduler timer with interval ${this.defaultIntervalMs}ms`);

    this.globalTimer = setInterval(async () => {
      await this.executeSchedulingCycle();
    }, this.defaultIntervalMs);

    this.isRunning = true;

    // Execute immediately on start
    setImmediate(() => this.executeSchedulingCycle());

    this.logger.info('Global scheduler timer started successfully');
  }

  /**
   * Stop the global coordinated timer
   */
  private stopGlobalTimer(): void {
    if (this.globalTimer) {
      clearInterval(this.globalTimer);
      this.globalTimer = null;
    }
    this.isRunning = false;
    this.logger.info('Global scheduler timer stopped');
  }

  /**
   * Execute a coordinated scheduling cycle for all registered schedulers
   */
  private async executeSchedulingCycle(): Promise<void> {
    if (this.registeredSchedulers.size === 0) {
      return;
    }

    this.logger.debug(`Executing coordinated scheduling cycle for ${this.registeredSchedulers.size} schedulers`);

    const executionPromises: Promise<void>[] = [];

    for (const [agentId, registered] of Array.from(this.registeredSchedulers.entries())) {
      if (!registered.enabled) {
        continue;
      }

      const executionPromise = this.executeSchedulerCycle(registered);
      executionPromises.push(executionPromise);
    }

    // Execute all scheduler cycles in parallel
    try {
      await Promise.allSettled(executionPromises);
      this.logger.debug('Coordinated scheduling cycle completed');
    } catch (error) {
      this.logger.error('Error during coordinated scheduling cycle', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Execute the scheduling cycle for a specific scheduler
   */
  private async executeSchedulerCycle(registered: RegisteredScheduler): Promise<void> {
    try {
      // Check if the scheduler has a method to execute due tasks directly
      if (typeof (registered.scheduler as any).executeDueTasksForAgent === 'function') {
        await (registered.scheduler as any).executeDueTasksForAgent(registered.agentId);
      } else if (typeof (registered.scheduler as any).executeDueTasks === 'function') {
        await (registered.scheduler as any).executeDueTasks();
      } else {
        this.logger.warn(`Scheduler for agent ${registered.agentId} does not have expected execution methods`);
      }

      registered.lastExecution = new Date();

    } catch (error) {
      this.logger.error(`Error executing scheduler cycle for agent ${registered.agentId}`, {
        agentId: registered.agentId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Enable or disable a specific scheduler
   */
  public setSchedulerEnabled(agentId: string, enabled: boolean): void {
    const registered = this.registeredSchedulers.get(agentId);
    if (registered) {
      registered.enabled = enabled;
      this.logger.info(`Scheduler for agent ${agentId} ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Get statistics about registered schedulers
   */
  public getStats(): {
    totalRegistered: number;
    enabled: number;
    disabled: number;
    isRunning: boolean;
    intervalMs: number;
  } {
    const enabled = Array.from(this.registeredSchedulers.values()).filter(s => s.enabled).length;
    const disabled = this.registeredSchedulers.size - enabled;

    return {
      totalRegistered: this.registeredSchedulers.size,
      enabled,
      disabled,
      isRunning: this.isRunning,
      intervalMs: this.defaultIntervalMs
    };
  }

  /**
   * Force an immediate execution cycle for all schedulers
   */
  public async forceExecutionCycle(): Promise<void> {
    this.logger.info('Forcing immediate execution cycle');
    await this.executeSchedulingCycle();
  }

  /**
   * Cleanup and stop all coordination
   */
  public cleanup(): void {
    this.logger.info('Cleaning up scheduler coordinator');
    this.stopGlobalTimer();
    this.registeredSchedulers.clear();
    SchedulerCoordinator.instance = null;
  }
}

/**
 * Convenience function to get the scheduler coordinator instance
 */
export function getSchedulerCoordinator(): SchedulerCoordinator {
  return SchedulerCoordinator.getInstance();
} 