import { testGenerateFeedbackInsights, FeedbackInsight } from './feedbackIngestor';

/**
 * Demonstrates the feedback ingestor functionality
 */
async function demonstrateFeedbackIngestor() {
  console.log("🧠 Feedback Ingestor Example");
  console.log("----------------------------------------");
  console.log("📊 Analyzing past task performance, corrections, and reflections...");
  
  // Generate sample insights using the test helper
  const insights = await testGenerateFeedbackInsights();
  
  console.log(`✅ Generated ${insights.length} feedback insights`);
  console.log("----------------------------------------");
  
  // Display the insights
  console.log("🔍 Feedback Insights:");
  for (let i = 0; i < insights.length; i++) {
    const insight = insights[i];
    console.log(`\n[${i + 1}] ${insight.severity.toUpperCase()} - ${insight.category}`);
    console.log(`  ${insight.description}`);
    
    if (insight.affectedTasks.length > 0) {
      console.log(`  Affected tasks: ${insight.affectedTasks.join(', ')}`);
    }
  }
  console.log("----------------------------------------");
  
  // Display the patterns that were detected
  console.log("🔎 Pattern Detection Summary:");
  console.log("  - Low scoring tasks (< 70) with common penalties");
  console.log("  - Correction categories that occur multiple times");
  console.log("  - Common tags across reflection entries");
  console.log("  - Related insights merged by category and severity");
  console.log("----------------------------------------");
  
  // Explain memory storage
  console.log("💾 Memory Storage Simulation:");
  console.log("  In a production environment, insights would be stored in Chloe's");
  console.log("  memory with the following attributes:");
  console.log("  - Type: feedback_insight");
  console.log("  - Importance: HIGH");
  console.log("  - Tags: feedback, learning, self_improvement");
  console.log("----------------------------------------");
  
  return insights;
}

// Run if called directly
if (require.main === module) {
  demonstrateFeedbackIngestor()
    .then((insights) => {
      console.log("✅ Feedback analysis complete");
    })
    .catch((error) => {
      console.error("❌ Error running feedback ingestor:", error);
    });
}

export { demonstrateFeedbackIngestor }; 