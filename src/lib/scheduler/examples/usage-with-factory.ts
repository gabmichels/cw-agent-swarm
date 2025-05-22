/**
 * Usage Examples with Factory
 * 
 * This file demonstrates how to use the scheduler factory to create a scheduler
 * and use its enhanced date/time processing capabilities.
 */

import { createSchedulerManager } from '../factories/SchedulerFactory';
import { TaskScheduleType, TaskStatus } from '../models/Task.model';

/**
 * Example: Using the scheduler factory and creating tasks with vague expressions
 */
async function schedulerFactoryExample() {
  console.log('\n--- Example: Using Scheduler Factory ---');
  
  // Create the scheduler using the factory
  const scheduler = await createSchedulerManager({
    enabled: true,
    enableAutoScheduling: true,
    schedulingInterval: 5000, // 5 seconds
    maxConcurrentTasks: 5,
    defaultPriority: 5
  });
  
  // Create tasks with vague expressions
  const urgentTask = await scheduler.createTask({
    name: 'Urgent Task',
    description: 'This task should execute immediately',
    scheduleType: TaskScheduleType.EXPLICIT,
    // @ts-ignore - The string will be processed by ModularSchedulerManager.createTask
    scheduledTime: 'urgent', // Will be translated to current time with priority 10
    handler: async () => {
      console.log('Executing urgent task');
      return 'Urgent task completed';
    },
    status: TaskStatus.PENDING
  });
  
  const soonTask = await scheduler.createTask({
    name: 'Soon Task',
    description: 'This task should execute soon',
    scheduleType: TaskScheduleType.EXPLICIT,
    // @ts-ignore - The string will be processed by ModularSchedulerManager.createTask
    scheduledTime: 'soon', // Will be translated to current time + 4 hours with priority 8
    handler: async () => {
      console.log('Executing soon task');
      return 'Soon task completed';
    },
    status: TaskStatus.PENDING
  });
  
  const lowPriorityTask = await scheduler.createTask({
    name: 'Low Priority Task',
    description: 'This is a low priority task',
    scheduleType: TaskScheduleType.EXPLICIT,
    // @ts-ignore - The string will be processed by ModularSchedulerManager.createTask
    scheduledTime: 'whenever', // Will be translated to current time + 30 days with priority 1
    handler: async () => {
      console.log('Executing low priority task');
      return 'Low priority task completed';
    },
    status: TaskStatus.PENDING
  });
  
  // Log task details
  console.log(`Created Urgent Task (${urgentTask.id}):`);
  console.log(`  - Priority: ${urgentTask.priority}`);
  console.log(`  - Scheduled Time: ${urgentTask.scheduledTime}`);
  
  console.log(`Created Soon Task (${soonTask.id}):`);
  console.log(`  - Priority: ${soonTask.priority}`);
  console.log(`  - Scheduled Time: ${soonTask.scheduledTime}`);
  
  console.log(`Created Low Priority Task (${lowPriorityTask.id}):`);
  console.log(`  - Priority: ${lowPriorityTask.priority}`);
  console.log(`  - Scheduled Time: ${lowPriorityTask.scheduledTime}`);
  
  // Execute an urgent task immediately
  console.log('\nExecuting urgent task immediately:');
  const result = await scheduler.executeTaskNow(urgentTask.id);
  console.log(`Execution result: ${result.successful ? 'Success' : 'Failed'}`);
  
  // Clean up - stop the scheduler
  await scheduler.stopScheduler();
  
  return scheduler;
}

/**
 * Run the example
 */
async function runExample() {
  try {
    await schedulerFactoryExample();
    console.log('\nExample completed successfully.');
  } catch (error) {
    console.error('Error running example:', error);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runExample();
}

// Export the example for use in other files
export { schedulerFactoryExample, runExample }; 