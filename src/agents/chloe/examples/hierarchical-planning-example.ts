/**
 * Example demonstrating Chloe's enhanced hierarchical planning capabilities
 */

import { getChloeInstance } from '../index';
import { PlanAndExecuteResult, PlanStep } from '../../../lib/shared/types/agentTypes';

async function runHierarchicalPlanningExample() {
  try {
    // Get the Chloe instance (singleton)
    console.log('Initializing Chloe agent...');
    const chloeAgent = await getChloeInstance();
    console.log('Chloe agent initialized');

    // Define a complex goal that would benefit from hierarchical decomposition
    const goal = 'Create and launch a comprehensive digital marketing campaign for a new eco-friendly product line, including content strategy, social media plan, and performance tracking.';
    
    console.log(`\nExecuting with complex goal: ${goal}\n`);
    
    // Execute the planning process with the enhanced hierarchical planning
    const result = await chloeAgent.planAndExecute(goal, {
      goalPrompt: goal,
      autonomyMode: true
    });
    
    // Print the results
    console.log('\n=== HIERARCHICAL PLANNING EXECUTION COMPLETED ===\n');
    console.log(`Success: ${result.success}`);
    console.log(`Message: ${result.message}`);
    
    // Function to recursively print the hierarchical plan
    const printHierarchicalPlan = (steps: PlanStep[], indent: string = '') => {
      steps.forEach((step: PlanStep, index: number) => {
        console.log(`${indent}${index + 1}. ${step.description} (${step.status})`);
        
        // Print children if they exist
        if (step.children && step.children.length > 0) {
          printHierarchicalPlan(step.children, `${indent}   `);
        }
      });
    };
    
    console.log('\n=== HIERARCHICAL PLAN ===\n');
    if (result.plan?.steps) {
      printHierarchicalPlan(result.plan.steps);
    } else {
      console.log('No plan steps available');
    }
    
    if (result.error) {
      console.error('\n=== ERROR ===\n');
      console.error(result.error);
    }
  } catch (error) {
    console.error('Error running hierarchical planning example:', error);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runHierarchicalPlanningExample().catch(console.error);
}

export { runHierarchicalPlanningExample }; 