/**
 * Example demonstrating Chloe's new LangGraph-based planning system
 */

import { getChloeInstance } from '../index';

async function runGraphPlanningExample() {
  try {
    // Get the Chloe instance (singleton)
    console.log('Initializing Chloe agent...');
    const chloeAgent = await getChloeInstance();
    console.log('Chloe agent initialized');

    // Define a complex goal
    const goal = 'Create a comprehensive marketing campaign for a new eco-friendly coffee brand that targets health-conscious millennials.';
    
    console.log(`\nExecuting with goal: ${goal}\n`);
    
    // Execute the planning process with the new LangGraph implementation
    // This will:
    // 1. Break down the goal into sub-goals
    // 2. Prioritize sub-goals 
    // 3. Execute each sub-goal in turn
    // 4. Reflect on progress after each execution
    // 5. Adjust the plan if needed
    // 6. Create a final summary
    const result = await chloeAgent.planAndExecuteAdvanced(goal, true, {
      trace: true, // Enable detailed tracing
      goalPrompt: goal,
      autonomyMode: true,
      maxSteps: 15,
      timeLimit: 600 // 10 minutes in seconds
    });
    
    // Print the results
    console.log('\n=== EXECUTION COMPLETED ===\n');
    console.log(`Success: ${result.success}`);
    console.log(`Message: ${result.message}`);
    
    console.log('\n=== PLAN STEPS ===\n');
    result.plan?.steps.forEach((step, index) => {
      console.log(`${index + 1}. ${step.description} (${step.status})`);
    });
    
    if (result.error) {
      console.error('\n=== ERROR ===\n');
      console.error(result.error);
    }
  } catch (error) {
    console.error('Error running example:', error);
  }
}

// Run the example
runGraphPlanningExample().catch(console.error); 