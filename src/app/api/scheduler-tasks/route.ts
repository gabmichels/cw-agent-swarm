import { NextResponse } from 'next/server';
import { getGlobalChloeAgent } from '../../../lib/singletons/chloeAgent';
import { ChloeScheduler, setupDefaultSchedule, initializeAutonomy } from '../../../agents/chloe/scheduler';
import { TASK_IDS } from '../../../lib/shared/constants';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Define a generic task interface to handle different task types
interface GenericTask {
  id: string;
  [key: string]: any;
}

// Optional global cache for task list with timestamp
declare global {
  var schedulerTasksCache: {
    tasks: any[];
    timestamp: number;
    expiresAt: number;
  } | undefined;
}

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Safely parse a date to ISO string format
 */
function safelyFormatDate(dateValue: any): string | undefined {
  if (!dateValue) return undefined;
  
  try {
    // Handle different date formats
    const date = dateValue instanceof Date 
      ? dateValue 
      : new Date(dateValue);
    
    // Validate the date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date value:', dateValue);
      return undefined;
    }
    
    return date.toISOString();
  } catch (error) {
    console.warn('Error parsing date:', error);
    return undefined;
  }
}

/**
 * Get all scheduled tasks from Chloe
 */
export async function GET() {
  console.log('Fetching Chloe scheduled tasks');
  
  try {
    // Add timeout to the request processing
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request processing timed out')), 8000);
    });
    
    // Actual processing logic
    const processingPromise = processRequest();
    
    // Race between timeout and processing
    const result = await Promise.race([
      processingPromise,
      timeoutPromise
    ]) as any[];
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in scheduler-tasks endpoint:', error);
    
    // Check if we have a valid cache we can return
    if (globalThis.schedulerTasksCache && 
        Array.isArray(globalThis.schedulerTasksCache.tasks) && 
        globalThis.schedulerTasksCache.tasks.length > 0) {
      console.log(`Returning cached tasks after error (cache age: ${(Date.now() - globalThis.schedulerTasksCache.timestamp) / 1000}s)`);
      return NextResponse.json(globalThis.schedulerTasksCache.tasks);
    }
    
    // Fall back to default tasks if no cache
    console.log('Returning default tasks due to error');
    return NextResponse.json(getDefaultTasks());
  }
}

/**
 * Process the request to get scheduled tasks
 */
async function processRequest(): Promise<any[]> {
  // Check if we have a valid global cache first
  if (globalThis.schedulerTasksCache && 
      globalThis.schedulerTasksCache.tasks && 
      Array.isArray(globalThis.schedulerTasksCache.tasks) && 
      globalThis.schedulerTasksCache.tasks.length > 0 &&
      Date.now() < globalThis.schedulerTasksCache.expiresAt) {
    console.log(`Using global cache with ${globalThis.schedulerTasksCache.tasks.length} tasks (age: ${(Date.now() - globalThis.schedulerTasksCache.timestamp) / 1000}s)`);
    return globalThis.schedulerTasksCache.tasks;
  }
  
  // Use the global instance instead of creating a new one
  const chloe = await getGlobalChloeAgent();
  console.log('Using global Chloe agent instance');
  
  // Try to get tasks via autonomy system first
  console.log('Getting autonomy system...');
  const autonomySystem = await chloe.getAutonomySystem();
  console.log('Autonomy system retrieved:', autonomySystem ? 'Yes' : 'No');
  
  let tasks: GenericTask[] = [];
  
  // Try getting tasks from the autonomy system
  if (autonomySystem && autonomySystem.scheduler) {
    try {
      tasks = autonomySystem.scheduler.getScheduledTasks();
      console.log(`Retrieved ${tasks.length} tasks from autonomy system`);
    } catch (err) {
      console.error('Error getting tasks from autonomy system:', err);
    }
  }
  
  // If no tasks found from autonomy system, try direct scheduler
  if (tasks.length === 0) {
    console.log('No tasks found in autonomy system, trying direct scheduler...');
    try {
      const directScheduler = new ChloeScheduler(chloe);
      const directTasks = directScheduler.getScheduledTasks();
      console.log(`Retrieved ${directTasks.length} tasks from direct scheduler`);
      
      if (directTasks.length > 0) {
        tasks = directTasks;
      } else {
        // If still no tasks, set up default schedule
        console.log('No tasks found, setting up default schedule');
        setupDefaultSchedule(directScheduler);
        directScheduler.setAutonomyMode(true);
        
        tasks = directScheduler.getScheduledTasks();
        console.log(`Set up ${tasks.length} default tasks`);
        
        // Try to update the global autonomy system
        try {
          console.log('Reinitializing autonomy system with tasks');
          const newAutonomySystem = initializeAutonomy(chloe);
          
          // @ts-ignore - force update private field
          chloe.autonomySystem = newAutonomySystem;
          console.log('Updated global autonomy system');
        } catch (autoErr) {
          console.error('Error updating global autonomy system:', autoErr);
        }
      }
    } catch (directErr) {
      console.error('Error with direct scheduler:', directErr);
    }
  }
  
  // Format tasks for response - handle different task formats
  const formattedTasks = tasks.map((task: any) => ({
    id: task.id,
    name: task.id.replace(/-/g, ' ').split(' ').map((word: string) => 
      word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
    description: task.goalPrompt || task.description || 'No description available',
    cronExpression: task.cronExpression || task.schedule || '* * * * *',
    enabled: task.enabled !== undefined ? task.enabled : true,
    lastRun: safelyFormatDate(task.lastRun),
    nextRun: safelyFormatDate(task.nextRun)
  }));
  
  // If we still have no tasks after all attempts, use default tasks
  const finalTasks = formattedTasks.length > 0 ? formattedTasks : getDefaultTasks();
  
  // Save to global cache for future use
  try {
    globalThis.schedulerTasksCache = {
      tasks: finalTasks,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_TTL
    };
    console.log('Updated global cache with formatted tasks');
  } catch (cacheErr) {
    console.error('Error updating cache:', cacheErr);
  }
  
  return finalTasks;
}

/**
 * Get default tasks when no real tasks are available
 */
function getDefaultTasks() {
  console.log('Returning default mock tasks');
  
  // Generate default mock tasks if no real tasks available
  return [
    {
      id: TASK_IDS.MARKET_SCAN,
      name: 'Market Scanner',
      description: 'Scan for market trends, news, and insights',
      cronExpression: '0 7,15 * * *',
      enabled: true,
      lastRun: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      nextRun: new Date(Date.now() + 1000 * 60 * 60 * 9).toISOString()
    },
    {
      id: TASK_IDS.DAILY_PLANNING,
      name: 'Daily Planning',
      description: 'Create a daily plan for marketing tasks',
      cronExpression: '0 8 * * *',
      enabled: true,
      lastRun: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      nextRun: new Date(Date.now() + 1000 * 60 * 60 * 16).toISOString()
    },
    {
      id: TASK_IDS.WEEKLY_MARKETING_REVIEW,
      name: 'Weekly Reflection',
      description: 'Reflect on weekly performance and achievements',
      cronExpression: '0 18 * * 0',
      enabled: true,
      lastRun: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
      nextRun: new Date(Date.now() + 1000 * 60 * 60 * 24 * 4).toISOString()
    },
    {
      id: TASK_IDS.CONTENT_IDEA_GENERATION,
      name: 'Content Idea Generation',
      description: 'Generate fresh content ideas for blog, social media, and newsletter',
      cronExpression: '0 14 * * 2,4',
      enabled: true,
      lastRun: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      nextRun: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString()
    },
    {
      id: TASK_IDS.MEMORY_CONSOLIDATION,
      name: 'Memory Consolidation',
      description: 'Process and organize memories for improved knowledge retrieval',
      cronExpression: '0 2 * * *',
      enabled: true,
      lastRun: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
      nextRun: new Date(Date.now() + 1000 * 60 * 60 * 24 * 1).toISOString()
    }
  ];
} 