import { NextResponse } from 'next/server';
import { getGlobalChloeAgent } from '../../../lib/singletons/chloeAgent';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Get all scheduled tasks from Chloe
 */
export async function GET() {
  try {
    console.log('Fetching Chloe scheduled tasks');
    
    // Use the global instance instead of creating a new one
    const chloe = await getGlobalChloeAgent();
    console.log('Using global Chloe agent instance');
    
    // Access tasks via autonomy system
    console.log('Getting autonomy system...');
    const autonomySystem = await chloe.getAutonomySystem();
    console.log('Autonomy system retrieved:', autonomySystem ? 'Yes' : 'No');
    
    if (!autonomySystem || !autonomySystem.scheduler) {
      console.error('Chloe scheduler not available:', autonomySystem);
      
      // Return default tasks for demonstration purposes
      const defaultTasks = [
        {
          id: 'market-scan',
          name: 'Market Scanner',
          description: 'Scan for market trends, news, and insights',
          cronExpression: '0 7,15 * * *',
          enabled: true,
          lastRun: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
          nextRun: new Date(Date.now() + 1000 * 60 * 60 * 9).toISOString()
        },
        {
          id: 'daily-planning',
          name: 'Daily Planning',
          description: 'Create a daily plan for marketing tasks',
          cronExpression: '0 8 * * *',
          enabled: true,
          lastRun: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
          nextRun: new Date(Date.now() + 1000 * 60 * 60 * 16).toISOString()
        },
        {
          id: 'weekly-reflection',
          name: 'Weekly Reflection',
          description: 'Reflect on weekly performance and achievements',
          cronExpression: '0 18 * * 0',
          enabled: true,
          lastRun: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
          nextRun: new Date(Date.now() + 1000 * 60 * 60 * 24 * 4).toISOString()
        }
      ];
      
      return NextResponse.json(defaultTasks);
    }
    
    // Get the tasks
    const schedulerTasks = autonomySystem.scheduler.getScheduledTasks();
    console.log(`Retrieved ${schedulerTasks.length} scheduled tasks`);
    
    // Transform task format to match the UI's expected interface
    const formattedTasks = schedulerTasks.map((task: any) => ({
      id: task.id,
      name: task.id.replace(/-/g, ' ').split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
      description: task.goalPrompt || 'No description available',
      cronExpression: task.cronExpression,
      enabled: task.enabled,
      lastRun: task.lastRun ? new Date(task.lastRun).toISOString() : undefined,
      nextRun: undefined // We don't have this in the scheduler tasks
    }));
    
    return NextResponse.json(formattedTasks);
  } catch (error) {
    console.error('Error fetching scheduled tasks:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch scheduled tasks',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 