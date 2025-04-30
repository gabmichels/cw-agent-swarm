import { testGenerateStrategyAdjustments, StrategyAdjustment, applyStrategyAdjustments } from './strategyAdjuster';
import { FeedbackInsight } from './feedbackIngestor';

/**
 * Demonstrates the strategy adjuster functionality
 */
async function demonstrateStrategyAdjuster() {
  console.log("🧠 Strategy Adjuster Example");
  console.log("----------------------------------------");
  console.log("📊 Analyzing feedback insights to generate strategy adjustments...");
  
  // Generate sample strategy adjustments using the test helper
  const adjustments = testGenerateStrategyAdjustments();
  
  console.log(`✅ Generated ${adjustments.length} strategy adjustments`);
  console.log("----------------------------------------");
  
  // Display the source insights (high and medium severity only)
  console.log("🔍 Source Feedback Insights:");
  const sourceInsights = [
    {
      category: 'correction_tool_misuse',
      description: 'Incorrect tool usage requiring corrections in 3 tasks',
      affectedTasks: ['task_1234', 'task_5678', 'task_9012'],
      severity: 'high'
    },
    {
      category: 'clarifications_needed',
      description: 'Recurring issue: Required clarification in 2 tasks, average score: 65.0',
      affectedTasks: ['task_2345', 'task_6789'],
      severity: 'medium'
    }
  ];
  
  for (let i = 0; i < sourceInsights.length; i++) {
    const insight = sourceInsights[i];
    console.log(`\n[${i + 1}] ${insight.severity.toUpperCase()} - ${insight.category}`);
    console.log(`  ${insight.description}`);
    
    if (insight.affectedTasks.length > 0) {
      console.log(`  Affected tasks: ${insight.affectedTasks.join(', ')}`);
    }
  }
  console.log("----------------------------------------");
  
  // Display the generated strategy adjustments
  console.log("🔧 Strategy Adjustments:");
  for (let i = 0; i < adjustments.length; i++) {
    const adjustment = adjustments[i];
    console.log(`\n[${i + 1}] ${adjustment.impact.toUpperCase()} - ${adjustment.category}`);
    console.log(`  ID: ${adjustment.adjustmentId}`);
    console.log(`  Description: ${adjustment.description}`);
    console.log(`  Applied to: ${adjustment.appliedTo.join(', ')}`);
    console.log(`  Date: ${adjustment.date}`);
  }
  console.log("----------------------------------------");
  
  // Simulate applying the adjustments
  console.log("⚙️ Applying Strategy Adjustments:");
  applyStrategyAdjustments(adjustments);
  console.log("----------------------------------------");
  
  // Explain memory storage
  console.log("💾 Memory Storage Simulation:");
  console.log("  In a production environment, adjustments would be stored in Chloe's");
  console.log("  memory with the following attributes:");
  console.log("  - Type: strategy_adjustment");
  console.log("  - Importance: HIGH");
  console.log("  - Tags: strategy, learning, self_improvement");
  console.log("----------------------------------------");
  
  return adjustments;
}

// Run if called directly
if (require.main === module) {
  demonstrateStrategyAdjuster()
    .then((adjustments) => {
      console.log("✅ Strategy adjustment complete");
    })
    .catch((error) => {
      console.error("❌ Error running strategy adjuster:", error);
    });
}

export { demonstrateStrategyAdjuster }; 