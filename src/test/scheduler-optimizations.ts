#!/usr/bin/env node
/**
 * scheduler-optimizations.ts - Test Scheduler Optimizations
 * 
 * This script tests the performance optimizations made to the scheduler system,
 * including query optimization and caching strategy.
 */

import { createSchedulerManager, RegistryType } from '../lib/scheduler/factories/SchedulerFactory';
import { TaskScheduleType, TaskStatus, Task } from '../lib/scheduler/models/Task.model';
import { performance } from 'perf_hooks';
import { BatchTaskRegistry } from '../lib/scheduler/implementations/registry/BatchTaskRegistry';
import { TaskRegistry } from '../lib/scheduler/interfaces/TaskRegistry.interface';

/**
 * Measure the time taken to execute a function
 */
async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T, time: number }> {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  return { result, time: end - start };
}

/**
 * Run performance tests for the scheduler optimizations
 */
async function testSchedulerOptimizations() {
  console.log('===== Testing Scheduler Optimizations =====');
  
  // Create a scheduler with memory registry (no batching)
  console.log('\nCreating memory-based scheduler without batching...');
  const memoryScheduler = await createSchedulerManager({
    registryType: RegistryType.MEMORY,
    useBatching: false
  });
  
  // Create a scheduler with memory registry and batching
  console.log('\nCreating memory-based scheduler with batching...');
  const batchScheduler = await createSchedulerManager({
    registryType: RegistryType.MEMORY,
    useBatching: true,
    batchSize: 10
  });
  
  // Create sample tasks
  const numTasks = 100;
  console.log(`\nCreating ${numTasks} sample tasks...`);
  
  const taskPromises = [];
  for (let i = 0; i < numTasks; i++) {
    const task: Partial<Task> = {
      name: `Test Task ${i}`,
      scheduleType: TaskScheduleType.EXPLICIT,
      scheduledTime: new Date(Date.now() - 60000), // 1 minute ago (due)
      status: TaskStatus.PENDING,
      priority: Math.floor(Math.random() * 10),
      handler: async () => Promise.resolve(`Task ${i} executed`)
    };
    
    taskPromises.push(memoryScheduler.createTask(task as Task));
  }
  
  const tasks = await Promise.all(taskPromises);
  console.log(`Created ${tasks.length} tasks successfully`);
  
  // Test get metrics performance
  console.log('\n----- Testing Metrics Caching -----');
  
  // First call (no cache)
  const { time: firstMetricsTime } = await measureTime(() => memoryScheduler.getMetrics());
  console.log(`First metrics call (no cache): ${firstMetricsTime.toFixed(2)} ms`);
  
  // Second call (should use cache)
  const { time: secondMetricsTime } = await measureTime(() => memoryScheduler.getMetrics());
  console.log(`Second metrics call (cached): ${secondMetricsTime.toFixed(2)} ms`);
  console.log(`Cache speedup: ${(firstMetricsTime / secondMetricsTime).toFixed(2)}x`);
  
  // Test executeDueTasks without batching
  console.log('\n----- Testing Task Execution Without Batching -----');
  const { time: noBatchTime } = await measureTime(() => memoryScheduler.executeDueTasks());
  console.log(`Time to execute tasks without batching: ${noBatchTime.toFixed(2)} ms`);
  
  // Reset tasks for batch scheduler
  console.log('\nResetting tasks for batch scheduler...');
  // Get all tasks
  const allTasks = await memoryScheduler.findTasks({});
  // Delete each task
  for (const task of allTasks) {
    await memoryScheduler.deleteTask(task.id);
  }
  
  // Create tasks for batch scheduler
  const batchTaskPromises = [];
  for (let i = 0; i < numTasks; i++) {
    const task: Partial<Task> = {
      name: `Batch Test Task ${i}`,
      scheduleType: TaskScheduleType.EXPLICIT,
      scheduledTime: new Date(Date.now() - 60000), // 1 minute ago (due)
      status: TaskStatus.PENDING,
      priority: Math.floor(Math.random() * 10),
      handler: async () => Promise.resolve(`Batch Task ${i} executed`)
    };
    
    batchTaskPromises.push(batchScheduler.createTask(task as Task));
  }
  
  await Promise.all(batchTaskPromises);
  
  // Test executeDueTasks with batching
  console.log('\n----- Testing Task Execution With Batching -----');
  const { time: batchTime } = await measureTime(() => batchScheduler.executeDueTasks());
  console.log(`Time to execute tasks with batching: ${batchTime.toFixed(2)} ms`);
  
  if (noBatchTime > 0 && batchTime > 0) {
    console.log(`Batching speedup: ${(noBatchTime / batchTime).toFixed(2)}x`);
  }
  
  console.log('\n===== Optimization Tests Complete =====');
}

// Run the tests
testSchedulerOptimizations()
  .then(() => {
    console.log('All tests completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error running tests:', error);
    process.exit(1);
  }); 