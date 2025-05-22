// @ts-nocheck
/**
 * Usage Examples for Enhanced BasicDateTimeProcessor
 * 
 * This file demonstrates how to use the enhanced date/time processing features
 * of the scheduler system, particularly vague temporal expressions.
 */

import { BasicDateTimeProcessor } from '../implementations/datetime/BasicDateTimeProcessor';
import { ModularSchedulerManager } from '../implementations/ModularSchedulerManager';
import { MemoryTaskRegistry } from '../implementations/registry/MemoryTaskRegistry';
import { StrategyBasedTaskScheduler } from '../implementations/scheduler/StrategyBasedTaskScheduler';
import { ExplicitTimeStrategy } from '../implementations/strategies/ExplicitTimeStrategy';
import { IntervalStrategy } from '../implementations/strategies/IntervalStrategy';
import { PriorityBasedStrategy } from '../implementations/strategies/PriorityBasedStrategy';
import { BasicTaskExecutor } from '../implementations/executor/BasicTaskExecutor';
import { TaskScheduleType, TaskStatus, Task } from '../models/Task.model';

/**
 * Setup a full scheduler system with the enhanced date/time processor
 */
async function setupSchedulerWithEnhancedDateTimeProcessor() {
  // Create components
  const dateTimeProcessor = new BasicDateTimeProcessor();
  const registry = new MemoryTaskRegistry();
  
  // Create scheduling strategies
  const explicitStrategy = new ExplicitTimeStrategy(dateTimeProcessor);
  const intervalStrategy = new IntervalStrategy(dateTimeProcessor);
  const priorityStrategy = new PriorityBasedStrategy();
  
  // Create scheduler with strategies
  const scheduler = new StrategyBasedTaskScheduler([
    explicitStrategy,
    intervalStrategy,
    priorityStrategy
  ]);
  
  // Create executor
  const executor = new BasicTaskExecutor();
  
  // Create scheduler manager
  const manager = new ModularSchedulerManager(
    registry,
    scheduler,
    executor,
    dateTimeProcessor,
    {
      enabled: true,
      enableAutoScheduling: true,
      schedulingInterval: 5000, // 5 seconds
      maxConcurrentTasks: 5,
      defaultPriority: 5
    }
  );
  
  // Initialize manager
  await manager.initialize();
  
  return {
    manager,
    dateTimeProcessor
  };
}

/**
 * Example 1: Using vague temporal expressions
 */
function vagueTemporalExpressionsExample() {
  console.log('\n--- Example: Vague Temporal Expressions ---');
  
  const dateProcessor = new BasicDateTimeProcessor();
  
  // Process vague temporal expressions
  const examples = [
    'urgent',
    'immediate',
    'soon',
    'a couple days',
    'by the end of the week',
    'this month',
    'whenever',
    'low priority'
  ];
  
  examples.forEach(expression => {
    const result = dateProcessor.translateVagueTerm(expression);
    if (result) {
      console.log(`Expression: "${expression}"`);
      console.log(`  - Translated date: ${result.date ? dateProcessor.formatDate(result.date) : 'none'}`);
      console.log(`  - Priority: ${result.priority}`);
    } else {
      console.log(`Expression: "${expression}" - Could not translate`);
    }
  });
}

/**
 * Example 2: Using complex expressions
 */
function complexExpressionsExample() {
  console.log('\n--- Example: Complex Expressions ---');
  
  const dateProcessor = new BasicDateTimeProcessor();
  
  // Parse complex date/time expressions
  const examples = [
    'tomorrow',
    'day after tomorrow',
    'next week tuesday',
    '2 weeks from now',
    '3 months from now',
    'next monday'
  ];
  
  examples.forEach(expression => {
    const result = dateProcessor.parseNaturalLanguage(expression);
    if (result) {
      console.log(`Expression: "${expression}"`);
      console.log(`  - Parsed date: ${dateProcessor.formatDate(result, 'long')}`);
    } else {
      console.log(`Expression: "${expression}" - Could not parse`);
    }
  });
}

/**
 * Example 3: Using contextual time periods
 */
function contextualTimePeriodsExample() {
  console.log('\n--- Example: Contextual Time Periods ---');
  
  const dateProcessor = new BasicDateTimeProcessor();
  
  // Parse contextual time periods
  const examples = [
    'by the end of day',
    'by the end of week',
    'by the end of month',
    'by the end of year'
  ];
  
  examples.forEach(expression => {
    const result = dateProcessor.parseNaturalLanguage(expression);
    if (result) {
      console.log(`Expression: "${expression}"`);
      console.log(`  - Parsed date: ${dateProcessor.formatDate(result, 'datetime')}`);
    } else {
      console.log(`Expression: "${expression}" - Could not parse`);
    }
  });
}

/**
 * Example 4: Generating cron expressions for recurring tasks
 */
function cronExpressionExample() {
  console.log('\n--- Example: Cron Expressions ---');
  
  const dateProcessor = new BasicDateTimeProcessor();
  
  // Generate cron expressions
  const examples = [
    'weekdays',
    'weekends',
    'every morning',
    'every evening',
    'every hour during work hours'
  ];
  
  examples.forEach(expression => {
    const cronExpression = dateProcessor.generateCronExpression(expression);
    const nextExecution = dateProcessor.getNextExecutionFromCron(cronExpression);
    
    console.log(`Expression: "${expression}"`);
    console.log(`  - Cron: ${cronExpression}`);
    console.log(`  - Next execution: ${nextExecution ? dateProcessor.formatDate(nextExecution, 'datetime') : 'unknown'}`);
  });
}

/**
 * Run all examples
 */
function runAllExamples() {
  try {
    vagueTemporalExpressionsExample();
    complexExpressionsExample();
    contextualTimePeriodsExample();
    cronExpressionExample();
    
    console.log('\nAll examples completed successfully.');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples();
}

// Export examples for use in other files
export {
  vagueTemporalExpressionsExample,
  complexExpressionsExample,
  contextualTimePeriodsExample,
  cronExpressionExample,
  runAllExamples
}; 