/**
 * Test script for ChloeGraph logging functionality
 * 
 * This script runs a simple task through the ChloeGraph system
 * and verifies that execution logs are generated correctly.
 */

import { getChloeInstance } from '../index';
import { PlanAndExecuteResult, PlanStep } from '../../../lib/shared/types/agentTypes';

async function runGraphTest() {
  try {
    // Get the Chloe instance
    console.log('Initializing Chloe agent...');
    const chloeAgent = await getChloeInstance();
    console.log('Chloe agent initialized');

    // Define a simple test goal
    const goal = 'Create a simple outline for a blog post about productivity tips for remote workers';
    
    console.log(`\nExecuting test goal: ${goal}\n`);
    
    // Execute the planning process with the graph-based implementation
    const result = await chloeAgent.planAndExecute(goal, {
      goalPrompt: goal,
      autonomyMode: true
    });
    
    console.log('\n=== TEST EXECUTION COMPLETED ===\n');
    console.log(`Success: ${result.success}`);
    console.log(`Message: ${result.message}`);
    
    // Print plan steps if available
    if (result.plan && result.plan.steps.length > 0) {
      console.log('\nPlan Steps:');
      result.plan.steps.forEach((step: PlanStep, index: number) => {
        console.log(`${index + 1}. ${step.description} (${step.status})`);
        if (step.result && step.result.response) {
          console.log(`   Result: ${step.result.response.substring(0, 100)}...`);
        }
      });
    }
    
    // Print error if any
    if (result.error) {
      console.log(`\nError: ${result.error}`);
    }
    
    console.log('\n=== TEST COMPLETED ===\n');
    console.log('Check the logs/executions directory for saved execution data');
    
  } catch (error) {
    console.error('Error running graph test:', error);
  }
}

// Run the test
runGraphTest().catch(console.error); 