import { NextResponse } from 'next/server';
// Note: Chloe agent system has been removed

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Toggle a scheduled task (enable/disable)
 */
export async function POST(request: Request) {
  try {
    return NextResponse.json({
      success: false,
      message: 'Chloe agent system has been deprecated'
    }, { status: 410 });
  } catch (error) {
    console.error('Error toggling task:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to toggle task',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 