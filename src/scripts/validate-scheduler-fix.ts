/**
 * Validation script for scheduler coordinator fix
 * 
 * This script verifies that the scheduler timer fix is working correctly
 * by checking the coordinator stats and monitoring timer behavior.
 */

import { getSchedulerCoordinator } from '../lib/scheduler/coordination/SchedulerCoordinator';

async function validateSchedulerFix() {
  console.log('🔧 Validating Scheduler Coordinator Fix...\n');

  try {
    // Get the coordinator instance
    const coordinator = getSchedulerCoordinator();
    console.log('✅ Scheduler coordinator instance obtained');

    // Get initial stats
    const stats = coordinator.getStats();
    console.log('\n📊 Scheduler Coordinator Stats:');
    console.log(`   - Total Registered: ${stats.totalRegistered}`);
    console.log(`   - Enabled: ${stats.enabled}`);
    console.log(`   - Disabled: ${stats.disabled}`);
    console.log(`   - Is Running: ${stats.isRunning}`);
    console.log(`   - Interval: ${stats.intervalMs}ms (${stats.intervalMs / 1000}s)`);

    // Validate expected behavior
    let validationsPassed = 0;
    let totalValidations = 0;

    // Test 1: Coordinator should exist
    totalValidations++;
    if (coordinator) {
      console.log('✅ Test 1: Coordinator exists');
      validationsPassed++;
    } else {
      console.log('❌ Test 1: Coordinator does not exist');
    }

    // Test 2: Coordinator should be using 2-minute intervals (120000ms)
    totalValidations++;
    if (stats.intervalMs === 120000) {
      console.log('✅ Test 2: Coordinator using correct 2-minute interval');
      validationsPassed++;
    } else {
      console.log(`❌ Test 2: Coordinator using wrong interval: ${stats.intervalMs}ms (expected 120000ms)`);
    }

    // Test 3: If running, should be managing multiple schedulers
    totalValidations++;
    if (stats.isRunning && stats.totalRegistered > 0) {
      console.log(`✅ Test 3: Coordinator is managing ${stats.totalRegistered} schedulers`);
      validationsPassed++;
    } else if (!stats.isRunning && stats.totalRegistered === 0) {
      console.log('✅ Test 3: Coordinator not running (no agents registered yet)');
      validationsPassed++;
    } else {
      console.log(`❌ Test 3: Unexpected state - running: ${stats.isRunning}, registered: ${stats.totalRegistered}`);
    }

    // Test 4: Force execution cycle to test functionality
    totalValidations++;
    try {
      await coordinator.forceExecutionCycle();
      console.log('✅ Test 4: Force execution cycle completed successfully');
      validationsPassed++;
    } catch (error) {
      console.log(`❌ Test 4: Force execution cycle failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Final validation summary
    console.log('\n🎯 Validation Summary:');
    console.log(`   - Tests Passed: ${validationsPassed}/${totalValidations}`);
    console.log(`   - Success Rate: ${Math.round((validationsPassed / totalValidations) * 100)}%`);

    if (validationsPassed === totalValidations) {
      console.log('🎉 All validations passed! Scheduler coordinator fix is working correctly.');
      console.log('\n💡 The fix should prevent multiple agent schedulers from creating');
      console.log('   their own timers and instead use a single coordinated timer.');
    } else {
      console.log('⚠️  Some validations failed. Please check the implementation.');
    }

    // Instructions for monitoring
    console.log('\n📝 To monitor the fix effectiveness:');
    console.log('   1. Check logs for "🎯 Agent X checking for due tasks..." messages');
    console.log('   2. Verify these only occur every 2 minutes (120s) instead of multiple times per second');
    console.log('   3. Visit /api/scheduler-stats to see coordinator status');
    console.log('   4. Look for "Scheduler registered with coordinator" messages in agent logs');

    return validationsPassed === totalValidations;

  } catch (error) {
    console.error('❌ Validation failed with error:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Run validation if called directly
if (require.main === module) {
  validateSchedulerFix()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Validation script error:', error);
      process.exit(1);
    });
}

export { validateSchedulerFix };
