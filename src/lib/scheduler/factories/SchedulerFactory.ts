/**
 * SchedulerFactory.ts - Factory for Creating Scheduler Components
 * 
 * This file provides factory functions to simplify creation of scheduler components
 * and the ModularSchedulerManager. This helps with migration from DefaultSchedulerManager.
 */

import { ModularSchedulerManager } from '../implementations/ModularSchedulerManager';
import { MemoryTaskRegistry } from '../implementations/registry/MemoryTaskRegistry';
import { StrategyBasedTaskScheduler } from '../implementations/scheduler/StrategyBasedTaskScheduler';
import { ExplicitTimeStrategy } from '../implementations/strategies/ExplicitTimeStrategy';
import { IntervalStrategy } from '../implementations/strategies/IntervalStrategy';
import { PriorityBasedStrategy } from '../implementations/strategies/PriorityBasedStrategy';
import { BasicTaskExecutor } from '../implementations/executor/BasicTaskExecutor';
import { BasicDateTimeProcessor } from '../implementations/datetime/BasicDateTimeProcessor';
import { SchedulerConfig, DEFAULT_SCHEDULER_CONFIG } from '../models/SchedulerConfig.model';

/**
 * Factory function to create a ModularSchedulerManager with standard components
 * 
 * This simplifies the migration from DefaultSchedulerManager by creating all
 * necessary components with sensible defaults.
 * 
 * @param config - Optional configuration to override defaults
 * @returns A fully initialized ModularSchedulerManager instance
 */
export async function createSchedulerManager(config?: Partial<SchedulerConfig>): Promise<ModularSchedulerManager> {
  // Create the date time processor
  const dateTimeProcessor = new BasicDateTimeProcessor();
  
  // Create the task registry
  const registry = new MemoryTaskRegistry();
  
  // Create the scheduling strategies
  const explicitStrategy = new ExplicitTimeStrategy();
  const intervalStrategy = new IntervalStrategy();
  const priorityStrategy = new PriorityBasedStrategy();
  
  // Create the scheduler with all strategies
  const scheduler = new StrategyBasedTaskScheduler([
    explicitStrategy,
    intervalStrategy,
    priorityStrategy
  ]);
  
  // Create the task executor
  const executor = new BasicTaskExecutor();
  
  // Create the scheduler manager with all components
  const manager = new ModularSchedulerManager(
    registry,
    scheduler,
    executor,
    dateTimeProcessor,
    config
  );
  
  // Initialize the manager
  await manager.initialize();
  
  return manager;
}

/**
 * Factory function to create only the scheduler components without initializing them
 * 
 * This is useful when you need more control over the initialization process.
 * 
 * @returns All components needed for a ModularSchedulerManager
 */
export function createSchedulerComponents() {
  const dateTimeProcessor = new BasicDateTimeProcessor();
  const registry = new MemoryTaskRegistry();
  
  const explicitStrategy = new ExplicitTimeStrategy();
  const intervalStrategy = new IntervalStrategy();
  const priorityStrategy = new PriorityBasedStrategy();
  
  const scheduler = new StrategyBasedTaskScheduler([
    explicitStrategy,
    intervalStrategy,
    priorityStrategy
  ]);
  
  const executor = new BasicTaskExecutor();
  
  return {
    dateTimeProcessor,
    registry,
    scheduler,
    executor,
    strategies: {
      explicitStrategy,
      intervalStrategy,
      priorityStrategy
    }
  };
}

/**
 * Migration helper for replacing DefaultSchedulerManager
 * 
 * @param config - Optional configuration to override defaults
 * @returns A fully initialized ModularSchedulerManager instance
 * @deprecated Use createSchedulerManager instead. This is only for easing migration.
 */
export async function createDefaultSchedulerManagerReplacement(
  config?: Partial<SchedulerConfig>
): Promise<ModularSchedulerManager> {
  return createSchedulerManager(config);
} 