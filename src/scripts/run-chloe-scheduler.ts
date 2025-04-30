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

async function main() {
  try {
    const arg = process.argv[2]?.toLowerCase() || 'daily';
    
    console.log('🤖 Chloe Scheduler Test Script');
    console.log('==============================');
    
    switch (arg) {
      case 'daily':
        console.log('📅 Running daily cycle...');
        await runChloeDaily();
        console.log('✅ Daily cycle completed');
        break;
        
      case 'weekly':
        console.log('🗓️ Running weekly cycle...');
        await runChloeWeekly();
        console.log('✅ Weekly cycle completed');
        break;
        
      case 'maintain':
      case 'maintenance':
        console.log('🔧 Running maintenance cycle...');
        await runChloeMaintenance();
        console.log('✅ Maintenance cycle completed');
        break;
        
      case 'all':
        console.log('🔄 Running all cycles in sequence...');
        
        console.log('\n📅 Running daily cycle...');
        await runChloeDaily();
        console.log('✅ Daily cycle completed');
        
        console.log('\n🗓️ Running weekly cycle...');
        await runChloeWeekly();
        console.log('✅ Weekly cycle completed');
        
        console.log('\n🔧 Running maintenance cycle...');
        await runChloeMaintenance();
        console.log('✅ Maintenance cycle completed');
        
        console.log('\n🎉 All cycles completed successfully!');
        break;
        
      default:
        console.error(`❌ Unknown command: ${arg}`);
        console.log('Valid commands: daily, weekly, maintain, all');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error running Chloe scheduler:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
}); 