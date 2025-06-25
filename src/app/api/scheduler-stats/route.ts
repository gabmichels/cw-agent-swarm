import { NextRequest, NextResponse } from 'next/server';
import { getSchedulerCoordinator } from '../../../lib/scheduler/coordination/SchedulerCoordinator';

export async function GET(request: NextRequest) {
  try {
    const coordinator = getSchedulerCoordinator();
    const stats = coordinator.getStats();

    return NextResponse.json({
      success: true,
      data: {
        schedulerCoordinator: stats,
        message: `Found ${stats.totalRegistered} registered schedulers, ${stats.enabled} enabled, running: ${stats.isRunning}`
      }
    });
  } catch (error) {
    console.error('Error getting scheduler stats:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 