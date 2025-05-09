import { NextResponse } from 'next/server';
import { getGlobalChloeAgent } from '../../../lib/singletons/chloeAgent';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Toggle a scheduled task's enabled status
 */
export async function POST(request: Request) {
  try {
    // Parse request body
    const body = await request.json();
    const { taskId, enabled } = body;
    
    if (!taskId) {
      return NextResponse.json({
        success: false,
        message: 'Task ID is required'
      }, { status: 400 });
    }
    
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({
        success: false,
        message: 'Enabled status must be a boolean'
      }, { status: 400 });
    }
    
    console.log(`Toggling task ${taskId} enabled status to ${enabled}`);
    
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
    
    // Toggle the task's enabled status
    const result = await autonomySystem.scheduler.setTaskEnabled(taskId, enabled);
    
    if (result) {
      return NextResponse.json({
        success: true,
        message: `Task ${taskId} ${enabled ? 'enabled' : 'disabled'} successfully`,
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json({
        success: false,
        message: `Failed to ${enabled ? 'enable' : 'disable'} task ${taskId}`,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error toggling task:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to toggle task status',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 