/**
 * Test script for feedback loop functionality
 */
import { ChloeMemory } from '../memory';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';
import { MemoryType } from '../../../server/memory/config/types';
import { 
  getTaskBehavioralModifiers, 
  recordBehaviorAdjustment,
  generateBehavioralAdjustmentReport 
} from './feedbackLoop';

/**
 * Simulates a task with known past failures to test feedback loop
 */
async function testFeedbackLoop() {
  console.log('Starting feedback loop test...');
  
  // Initialize memory
  const memory = new ChloeMemory();
  
  // 1. First create some simulated feedback insights in memory
  await memory.addMemory(
    `FEEDBACK INSIGHT
Category: tool_misuse
Description: Chloe frequently misused the email sending tool by not properly validating addresses
Affected Tasks: email_campaign_123, newsletter_setup
Severity: high
Recommendation: Always validate email addresses before sending`,
    MemoryType.FEEDBACK_INSIGHT,
    ImportanceLevel.HIGH,
    MemorySource.SYSTEM,
    "Performance analysis",
    ["tool_misuse", "email_tool"]
  );
  
  await memory.addMemory(
    `FEEDBACK INSIGHT
Category: missed_context
Description: Chloe missed important context about audience demographics in previous marketing tasks
Affected Tasks: audience_targeting, ad_campaign_456
Severity: medium
Recommendation: Review all demographic data before planning ad targeting strategies`,
    MemoryType.FEEDBACK_INSIGHT,
    ImportanceLevel.MEDIUM,
    MemorySource.SYSTEM,
    "Performance analysis",
    ["missed_context", "marketing"]
  );
  
  await memory.addMemory(
    `CORRECTION
Task: ad_campaign_456
The campaign targeting was too broad and missed key demographics that were mentioned in the brief.
Please ensure all contextual information is incorporated in planning stages.`,
    MemoryType.CORRECTION,
    ImportanceLevel.MEDIUM,
    MemorySource.USER,
    "Marketing campaign feedback",
    ["missed_context", "targeting"]
  );
  
  // 2. Simulate a new marketing task
  const testTask = {
    id: "new_ad_campaign_789",
    goal: "Create a targeted ad campaign for our new product launch focusing on millennials",
    type: "marketing"
  };
  
  console.log(`Testing with task: ${testTask.goal}`);
  
  // 3. Get behavioral modifiers for the task
  const modifiers = await getTaskBehavioralModifiers(testTask);
  
  console.log('Behavioral modifiers retrieved:');
  modifiers.forEach(m => console.log(`- ${m}`));
  
  // 4. Record that these modifiers were applied
  await recordBehaviorAdjustment(
    testTask.id as string,
    testTask.goal,
    modifiers
  );
  
  console.log('Recorded behavior adjustment in memory');
  
  // 5. Generate a report
  const report = await generateBehavioralAdjustmentReport();
  
  console.log('\nBehavioral Adjustment Report:');
  console.log(report);
  
  console.log('\nTest completed successfully!');
}

// Only run directly (not when imported)
if (require.main === module) {
  testFeedbackLoop()
    .then(() => console.log('Test completed'))
    .catch(err => console.error('Test failed:', err));
} 