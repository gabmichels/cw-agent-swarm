import { NextResponse } from 'next/server';
import { getGlobalChloeAgent } from '../../../lib/singletons/chloeAgent';
import { ChloeScheduler, setupDefaultSchedule, initializeAutonomy } from '../../../agents/chloe/scheduler';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Debug and fix the scheduler - completely reinitialize all tasks
 */
export async function GET() {
  try {
    console.log('DEBUG: Complete scheduler reinitialization');
    
    // Get the global Chloe agent instance
    const chloe = await getGlobalChloeAgent();
    console.log('Global Chloe agent retrieved');
    
    // STEP 1: Create a new scheduler instance directly
    console.log('Creating fresh scheduler instance');
    const scheduler = new ChloeScheduler(chloe);
    
    // Setup all default tasks defined in the original code
    console.log('Setting up all default tasks');
    setupDefaultSchedule(scheduler);
    scheduler.setAutonomyMode(true);
    
    // Check how many tasks we have after setup
    const directTasks = scheduler.getScheduledTasks();
    console.log(`Direct scheduler has ${directTasks.length} tasks`);
    console.log('Direct scheduler task IDs:', directTasks.map(t => t.id).join(', '));
    
    // STEP 2: Create a completely new autonomy system
    console.log('Creating new autonomy system');
    const newAutonomySystem = initializeAutonomy(chloe);
    
    // Check tasks in the new autonomy system
    const systemTasks = newAutonomySystem.scheduler.getScheduledTasks();
    console.log(`New autonomy system has ${systemTasks.length} tasks`);
    console.log('Autonomy system task IDs:', systemTasks.map(t => t.id).join(', '));
    
    // STEP 3: Force replace the agent's autonomy system
    try {
      console.log('Replacing the global agent autonomy system');
      
      // @ts-ignore - accessing private field
      chloe.autonomySystem = newAutonomySystem;
      
      // If the agent has a scheduledTasks property, update it too
      // @ts-ignore - accessing private field
      if (chloe.scheduledTasks) {
        // @ts-ignore - accessing private field
        chloe.scheduledTasks = systemTasks;
        console.log('Updated agent scheduledTasks directly');
      }
    } catch (error) {
      console.error('Error updating global agent:', error);
    }
    
    // STEP 4: Verify the update was successful
    console.log('Verifying autonomy system update');
    const verifiedSystem = await chloe.getAutonomySystem();
    const verifiedTasks = verifiedSystem?.scheduler?.getScheduledTasks() || [];
    console.log(`After update, verified tasks count: ${verifiedTasks.length}`);
    console.log('Verified task IDs:', verifiedTasks.map(t => t.id).join(', '));
    
    // Use the best available task list
    const allTasks = verifiedTasks.length >= 3 ? verifiedTasks : 
                     systemTasks.length >= 3 ? systemTasks :
                     directTasks;
    
    // Format tasks for display
    const formattedTasks = allTasks.map((task: any) => ({
      id: task.id,
      name: task.id.replace(/-/g, ' ').split(' ').map((word: string) => 
        word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
      description: task.goalPrompt || task.description || 'No description available',
      cronExpression: task.cronExpression || task.schedule || '* * * * *',
      enabled: task.enabled !== undefined ? task.enabled : true,
      lastRun: task.lastRun ? new Date(task.lastRun).toISOString() : undefined,
      nextRun: undefined
    }));
    
    // STEP 5: Update the scheduler-tasks API cache with our task list
    try {
      // Create a cache entry for the /api/scheduler-tasks endpoint to use
      if (typeof globalThis.schedulerTasksCache === 'undefined') {
        // @ts-ignore - creating global cache
        globalThis.schedulerTasksCache = formattedTasks;
        console.log('Created global cache for scheduler tasks');
      } else {
        // @ts-ignore - updating global cache
        globalThis.schedulerTasksCache = formattedTasks;
        console.log('Updated global cache for scheduler tasks');
      }
    } catch (cacheError) {
      console.error('Error updating global cache:', cacheError);
    }
    
    return NextResponse.json({
      status: 'success',
      message: 'Scheduler completely reinitialized with all default tasks',
      directTaskCount: directTasks.length,
      systemTaskCount: systemTasks.length,
      verifiedTaskCount: verifiedTasks.length,
      taskIds: allTasks.map((t: any) => t.id),
      tasks: formattedTasks
    });
  } catch (error) {
    console.error('Error in debug-scheduler endpoint:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Failed to debug scheduler',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 