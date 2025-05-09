#!/usr/bin/env node
/**
 * Test script to run Chloe's scheduler
 * 
 * Usage:
 *   - node run-chloe-scheduler.ts daily    (Run daily cycle)
 *   - node run-chloe-scheduler.ts weekly   (Run weekly cycle)
 *   - node run-chloe-scheduler.ts maintain (Run maintenance)
 *   - node run-chloe-scheduler.ts all      (Run all cycles in sequence)
 */

import { runChloeDaily, runChloeWeekly, runChloeMaintenance } from '../agents/chloe/scheduler/chloeScheduler';
import { ChloeAgent } from '../agents/chloe/core/agent';
import * as readline from 'readline';

// Mocked agent initializer for now (you'll need to implement or import the real one)
async function initChloeAgent(): Promise<ChloeAgent> {
  // This is a placeholder - you should import the actual agent initialization
  console.log('Initializing Chloe agent...');
  
  // Return a minimal implementation of the ChloeAgent interface
  const mockAgent = {
    initialize: async () => {},
    getModel: () => null,
    getMemory: () => null,
    getTaskLogger: () => null,
    notify: (message: string) => {},
    planAndExecute: async (goal: string, options: any) => ({ success: true }),
    runDailyTasks: async () => {},
    runWeeklyReflection: async () => "Weekly reflection",
    getReflectionManager: () => null,
    getPlanningManager: () => null,
    getKnowledgeGapsManager: () => null,
    getToolManager: () => null,
    getScheduler: () => null
  } as unknown as ChloeAgent;
  
  return mockAgent;
}

async function main() {
  try {
    console.log('==============================');
    console.log('🤖 Chloe Scheduler CLI');
    console.log('==============================');
    
    const arg = process.argv[2] || 'help';
    
    // Get agent instance
    const chloeAgent = await initChloeAgent();

    // Run the daily cycle based on options
    if (arg === 'daily' || arg === 'all') {
      console.log('📅 Running daily cycle...');
      await runChloeDaily(chloeAgent);
      console.log('✅ Daily cycle completed');
    }

    // Run the weekly cycle
    if (arg === 'weekly' || arg === 'all') {
      console.log('🗓️ Running weekly cycle...');
      await runChloeWeekly(chloeAgent);
      console.log('✅ Weekly cycle completed');
    }

    // Run maintenance tasks
    if (arg === 'maintain' || arg === 'maintenance' || arg === 'all') {
      console.log('🔧 Running maintenance cycle...');
      await runChloeMaintenance(chloeAgent);
      console.log('✅ Maintenance cycle completed');
    }

    // Interactive mode
    if (arg === 'interactive') {
      // Create readline interface with proper types
      const rl = readline.createInterface({
        input: process.stdin as any,
        output: process.stdout as any
      });
      
      // Use callback-based question
      rl.question('What would you like to run?\n1. Daily tasks\n2. Weekly tasks\n3. Maintenance\n4. Exit\nChoice: ', async (answer: string) => {
        if (answer === '1') {
          console.log('Running Chloe daily tasks...');
          await runChloeDaily(chloeAgent);
        } else if (answer === '2') {
          console.log('Running Chloe weekly tasks...');
          await runChloeWeekly(chloeAgent);
        } else if (answer === '3') {
          console.log('Running Chloe maintenance tasks...');
          await runChloeMaintenance(chloeAgent);
        }
        
        rl.close();
        console.log('Done. Exiting...');
        process.exit(0);
      });
    } else if (arg !== 'daily' && arg !== 'weekly' && arg !== 'maintain' && 
              arg !== 'maintenance' && arg !== 'all') {
      console.log('Usage: node run-chloe-scheduler.ts [command]');
      console.log('  Commands:');
      console.log('   - daily       : Run daily tasks');
      console.log('   - weekly      : Run weekly tasks');
      console.log('   - maintain    : Run maintenance tasks');
      console.log('   - all         : Run all tasks');
      console.log('   - interactive : Run in interactive mode');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Error running Chloe scheduler:', error);
    process.exit(1);
  }
}

// Node.js won't exit until readline is closed in interactive mode
if (process.argv[2] !== 'interactive') {
  main();
} else {
  main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
} 