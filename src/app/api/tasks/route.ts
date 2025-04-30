import { NextResponse } from 'next/server';
import { getGlobalChloeAgent } from '../../../lib/singletons/chloeAgent';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Get all scheduled tasks from Chloe
 * This is a fallback endpoint for the UI in case the /api/scheduler-tasks doesn't work.
 */
export async function GET() {
  try {
    console.log('Fetching Chloe scheduled tasks');
    
    // Use the global instance instead of creating a new one
    const chloe = await getGlobalChloeAgent();
    
    // Access tasks via autonomy system
    const autonomySystem = await chloe.getAutonomySystem();
    if (!autonomySystem || !autonomySystem.scheduler) {
      return NextResponse.json({
        success: false,
        message: 'Chloe scheduler not available'
      }, { status: 404 });
    }
    
    // Get the tasks
    const tasks = autonomySystem.scheduler.getScheduledTasks();
    
    return NextResponse.json({
      success: true,
      tasks: tasks,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching scheduled tasks:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch scheduled tasks',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 