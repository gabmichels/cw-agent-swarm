import { NextResponse } from 'next/server';
// Note: Chloe agent system has been removed

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Get all scheduled tasks
 */
export async function GET() {
  try {
    return NextResponse.json({
      success: false,
      message: 'Chloe agent system has been deprecated',
      tasks: []
    }, { status: 410 });
  } catch (error) {
    console.error('Error getting tasks:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to get tasks',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 