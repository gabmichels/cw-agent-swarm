import { NextResponse } from 'next/server';
import { getGlobalChloeAgent } from '../../../lib/singletons/chloeAgent';
import { ChloeScheduler, setupDefaultSchedule } from '../../../agents/chloe/scheduler';
import { TASK_IDS } from '../../../lib/shared/constants';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Debug endpoint to fix scheduler issues
 */
export async function GET() {
  try {
    console.log('Running scheduler debug process');
    
    // Get the global Chloe agent
    const chloe = await getGlobalChloeAgent();
    
    // Create fresh scheduler
    const scheduler = new ChloeScheduler(chloe);
    
    // Reset with default tasks
    console.log('Setting up default schedule');
    setupDefaultSchedule(scheduler);
    scheduler.setAutonomyMode(true);
    
    // Generate fresh tasks with proper timestamps
    const now = new Date();
    
    const defaultTasks = [
      {
        id: TASK_IDS.MARKET_SCAN,
        name: 'Market Scanner',
        description: 'Scan for market trends, news, and insights',
        cronExpression: '0 7,15 * * *',
        enabled: true,
        lastRun: new Date(now.getTime() - 1000 * 60 * 60 * 3).toISOString(),
        nextRun: new Date(now.getTime() + 1000 * 60 * 60 * 9).toISOString()
      },
      {
        id: TASK_IDS.DAILY_PLANNING,
        name: 'Daily Planning',
        description: 'Create a daily plan for marketing tasks',
        cronExpression: '0 8 * * *',
        enabled: true,
        lastRun: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
        nextRun: new Date(now.getTime() + 1000 * 60 * 60 * 16).toISOString()
      },
      {
        id: TASK_IDS.WEEKLY_MARKETING_REVIEW,
        name: 'Weekly Reflection',
        description: 'Reflect on weekly performance and achievements',
        cronExpression: '0 18 * * 0',
        enabled: true,
        lastRun: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 3).toISOString(),
        nextRun: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 4).toISOString()
      }
    ];
    
    // Set to global cache for immediate use
    // @ts-ignore - this is safe within the debug endpoint
    globalThis.schedulerTasksCache = defaultTasks;
    
    // Log scheduler state
    const debugInfo = {
      message: 'Scheduler debug complete',
      tasks: defaultTasks,
      tasksLength: defaultTasks.length,
      timestamp: new Date().toISOString()
    };
    
    console.log('Debug info:', debugInfo);
    
    return NextResponse.json(debugInfo);
  } catch (error) {
    console.error('Error in scheduler debug:', error);
    return NextResponse.json({
      success: false,
      message: 'Debug failed',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 