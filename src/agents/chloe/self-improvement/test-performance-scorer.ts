import { PlannedTask } from '../human-collaboration';
import { ChloeMemory } from '../memory';
import { scoreTaskPerformance, TaskPerformanceScore } from './performanceScorer';

/**
 * Example function to demonstrate the performance scorer
 */
async function demonstratePerformanceScorer() {
  // Create an example task
  const exampleTask: PlannedTask = {
    goal: "Find the latest sales figures",
    subGoals: [{ 
      id: "sg1", 
      description: "Query the database", 
      priority: 1, 
      status: "completed" 
    }],
    reasoning: "Need to analyze sales trends",
    status: "completed",
    wasCorrected: true,
    correctionCategory: "missed_context",
    correctionNotes: ["You missed the date range specification"],
    needsClarification: false
  };

  console.log("🚀 Performance Scorer Example");
  console.log("----------------------------------------");
  console.log("📋 Task Details:");
  console.log(`Goal: ${exampleTask.goal}`);
  console.log(`Status: ${exampleTask.status}`);
  console.log(`Was Corrected: ${exampleTask.wasCorrected}`);
  console.log(`Correction Category: ${exampleTask.correctionCategory}`);
  console.log(`Needs Clarification: ${exampleTask.needsClarification}`);
  console.log("----------------------------------------");

  // Score the task (without memory storage for demo)
  const score = await scoreTaskPerformance(exampleTask);

  // Display the results
  console.log("🏆 Performance Score Results:");
  console.log(`Base Score: ${score.baseScore}`);
  console.log(`Penalties: ${score.penalties.join(', ')}`);
  console.log(`Final Score: ${score.finalScore}`);
  console.log(`Insights: ${score.insights.join('\n  - ')}`);
  console.log("----------------------------------------");

  // Summary of penalty rules
  console.log("📚 Penalty Rules Summary:");
  console.log("  - Task needed correction: -20 points");
  console.log("  - Task needed clarification: -10 points");
  console.log("  - Task failed or incomplete: -30 points");
  console.log("----------------------------------------");

  // In a real scenario, we would initialize memory and store the score
  console.log("💾 Memory Write Simulation:");
  console.log("  In a live environment, this score would be written to");
  console.log("  Chloe's memory with the following parameters:");
  console.log("  - Memory Type: performance_score");
  console.log("  - Importance: medium");
  console.log("  - Tags: performance, task_score, self_improvement");
  console.log("----------------------------------------");

  return score;
}

// Only run if executed directly
if (require.main === module) {
  demonstratePerformanceScorer()
    .then((score) => {
      console.log("✅ Performance scoring complete!");
    })
    .catch((error) => {
      console.error("❌ Error running performance scorer:", error);
    });
}

export { demonstratePerformanceScorer }; 