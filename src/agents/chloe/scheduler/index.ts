/**
 * Chloe Scheduler module
 * Exports scheduler functionality for autonomous agent behavior
 */

export { ChloeScheduler } from './chloeScheduler';
export { calculateChloeCapacity, deferOverflowTasks } from './capacityManager';
export { 
  enableAutonomousMode, 
  runAutonomousMaintenance, 
  checkForSelfTriggeredTasks
} from './autonomousScheduler';
export type { PlannedTask } from './autonomousScheduler';

// Future extensions can be added here:
// export * from './cronManager';
// export * from './schedulerHooks'; 