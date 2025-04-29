import { testWeeklySelfImprovement, SelfImprovementResult } from './weeklySelfImprovement';

/**
 * Demonstrates the weekly self-improvement process
 */
async function demonstrateWeeklySelfImprovement() {
  console.log("🚀 Weekly Self-Improvement Process Example");
  console.log("----------------------------------------");
  
  // Run the self-improvement cycle with sample data
  console.log("⏳ Running weekly self-improvement cycle...");
  const result = await testWeeklySelfImprovement();
  
  // Display the results in a summary format
  console.log("\n📊 SELF-IMPROVEMENT CYCLE SUMMARY:");
  console.log(`Date: ${result.date}`);
  console.log(`Tasks Scored: ${result.tasksScored}`);
  console.log(`Feedback Insights Generated: ${result.insightsGenerated}`);
  console.log(`Strategy Adjustments Proposed: ${result.adjustmentsProposed}`);
  
  // Display any errors that occurred
  if (result.errors.length > 0) {
    console.log("\n⚠️ ERRORS:");
    for (const error of result.errors) {
      console.log(`- ${error}`);
    }
  }
  
  console.log("\n✅ Self-improvement cycle completed!");
  console.log("----------------------------------------");
  
  // Explain how this fits into Chloe's weekly reflection
  console.log("📝 Integration with Weekly Reflection:");
  console.log("This process would be triggered during Chloe's weekly reflection");
  console.log("to analyze performance, identify improvement opportunities, and");
  console.log("adjust behavior strategies for the coming week.");
  console.log("----------------------------------------");
  
  return result;
}

// Run if called directly
if (require.main === module) {
  demonstrateWeeklySelfImprovement()
    .then(() => {
      console.log("🎉 Process demonstration completed");
    })
    .catch((error) => {
      console.error("❌ Error demonstrating weekly self-improvement:", error);
    });
}

export { demonstrateWeeklySelfImprovement }; 