/**
 * Main scheduler entry point
 * This file orchestrates all scheduled tasks
 */

import { runChloeScheduledTasks } from "./chloe";

/**
 * Runs all scheduled tasks based on time of day
 */
export async function runScheduledTasks() {
  console.log(`Running scheduled tasks at ${new Date().toISOString()}`);
  
  try {
    // Run Chloe's daily/weekly cycles
    await runChloeScheduledTasks();
    
    // Add other scheduled tasks here as needed
    
    console.log(`Scheduled tasks completed at ${new Date().toISOString()}`);
  } catch (error) {
    console.error("Error running scheduled tasks:", error);
  }
}

// When this module is executed directly, run the tasks
if (require.main === module) {
  runScheduledTasks().catch(error => {
    console.error("Fatal error in scheduled tasks:", error);
    process.exit(1);
  });
} 