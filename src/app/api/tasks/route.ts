import { NextResponse } from 'next/server';
import { ChloeAgent } from '../../../agents/chloe';

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
    
    // Create a temporary Chloe instance to access the scheduler
    const chloe = new ChloeAgent();
    
    // Initialize the agent
    try {
      await chloe.initialize();
    } catch (error) {
      console.error('Error initializing Chloe agent:', error);
      return NextResponse.json({
        success: false,
        message: 'Failed to initialize Chloe agent',
        error: error instanceof Error ? error.message : String(error)
      }, { status: 500 });
    }
    
    // Access tasks via autonomy system
    const autonomySystem = await (chloe as any).getAutonomySystem();
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