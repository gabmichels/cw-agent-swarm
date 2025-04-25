import { NextResponse } from 'next/server';
import { ChloeAgent } from '../../../agents/chloe';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Run a scheduled task immediately
 */
export async function POST(request: Request) {
  try {
    // Parse request body
    const body = await request.json();
    const { taskId } = body;
    
    if (!taskId) {
      return NextResponse.json({
        success: false,
        message: 'Task ID is required'
      }, { status: 400 });
    }
    
    console.log(`Running task ${taskId} immediately`);
    
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
    
    // Run the task
    const result = await autonomySystem.scheduler.runTaskNow(taskId);
    
    if (result) {
      return NextResponse.json({
        success: true,
        message: `Task ${taskId} executed successfully`,
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json({
        success: false,
        message: `Failed to run task ${taskId}`,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error running task:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to run task',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 