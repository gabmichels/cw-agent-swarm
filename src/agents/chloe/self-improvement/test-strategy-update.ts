import { ChloeMemory } from '../memory';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';
import { ExecutionOutcome, ExecutionOutcomeAnalyzer } from './executionOutcomeAnalyzer';
import { StrategyUpdater } from './strategyUpdater';
import { ChatOpenAI } from '@langchain/openai';

/**
 * Test strategy updating based on simulated task execution outcomes
 */
export async function testStrategyUpdate(): Promise<void> {
  console.log('🧪 Testing Strategy Update System...');
  
  // Initialize memory
  const memory = new ChloeMemory();
  
  // Generate simulated outcomes
  const simulatedOutcomes = generateSimulatedOutcomes();
  console.log(`Generated ${simulatedOutcomes.length} simulated execution outcomes`);
  
  // Store simulated outcomes in memory
  for (const outcome of simulatedOutcomes) {
    await ExecutionOutcomeAnalyzer.storeOutcome(outcome, memory);
  }
  console.log('Stored simulated outcomes in memory');
  
  // Run strategy update
  const model = new ChatOpenAI({ 
    modelName: 'gpt-4o',
    temperature: 0.2
  });
  
  try {
    const modifiers = await StrategyUpdater.adjustBasedOnRecentOutcomes(memory, model);
    console.log('\n🔄 Generated Strategy Modifiers:');
    modifiers.forEach((modifier, i) => {
      console.log(`${i + 1}. ${modifier}`);
    });
    
    // Verify results
    const success = modifiers.length > 0;
    if (success) {
      console.log('\n✅ Strategy Update Test: PASSED');
      console.log(`Generated ${modifiers.length} strategy modifiers`);
    } else {
      console.log('\n❌ Strategy Update Test: FAILED');
      console.log('No strategy modifiers were generated');
    }
  } catch (error) {
    console.error('\n❌ Strategy Update Test: ERROR');
    console.error('Error during strategy update:', error);
  }
}

/**
 * Generate simulated outcomes for testing
 */
function generateSimulatedOutcomes(): ExecutionOutcome[] {
  const outcomes: ExecutionOutcome[] = [];
  const now = new Date();
  
  // Simulate a pattern of ApifyTool failures
  for (let i = 0; i < 5; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    outcomes.push({
      taskId: `task_apify_fail_${i}`,
      success: false,
      durationMs: 10000 + Math.random() * 5000,
      resultSummary: 'Task failed during web scraping',
      failureReason: 'ApifyTool: Unable to scrape content: Rate limit exceeded',
      affectedTools: ['ApifyTool', 'WebSearchTool'],
      taskType: 'research',
      completionDate: date,
      metadata: {
        subGoalCount: 3,
        hasChildren: false,
        priority: 2,
        totalSteps: 4,
        successfulSteps: 2,
        failedSteps: 2,
        toolUsageCount: 3
      }
    });
  }
  
  // Simulate slow performance for content creation tasks
  for (let i = 0; i < 4; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    outcomes.push({
      taskId: `task_slow_content_${i}`,
      success: true,
      durationMs: 45000 + Math.random() * 15000, // Notably slow
      resultSummary: 'Task completed successfully but took longer than expected',
      affectedTools: ['ContentGeneratorTool', 'LangChainTool'],
      taskType: 'content_creation',
      completionDate: date,
      metadata: {
        subGoalCount: 4,
        hasChildren: true,
        priority: 3,
        totalSteps: 6,
        successfulSteps: 6,
        failedSteps: 0,
        toolUsageCount: 4,
        averageStepDurationMs: 12000
      }
    });
  }
  
  // Simulate successful research tasks using BrowserTool
  for (let i = 0; i < 7; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (i % 3)); // Mix up dates a bit
    
    outcomes.push({
      taskId: `task_research_success_${i}`,
      success: true,
      durationMs: 8000 + Math.random() * 4000, // Faster than alternatives
      resultSummary: 'Research task completed efficiently',
      affectedTools: ['BrowserTool', 'SearchTool'],
      taskType: 'research',
      completionDate: date,
      metadata: {
        subGoalCount: 2,
        hasChildren: false,
        priority: 2,
        totalSteps: 3,
        successfulSteps: 3,
        failedSteps: 0,
        toolUsageCount: 2
      }
    });
  }
  
  // Add some mixed success/failure for analysis tasks
  for (let i = 0; i < 3; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const success = i % 2 === 0;
    
    outcomes.push({
      taskId: `task_analysis_${i}`,
      success,
      durationMs: 12000 + Math.random() * 8000,
      resultSummary: success 
        ? 'Analysis task completed' 
        : 'Analysis task failed due to data processing error',
      failureReason: success ? undefined : 'DataProcessingTool: Invalid data format',
      affectedTools: ['DataProcessingTool', 'VisualizationTool'],
      taskType: 'analysis',
      completionDate: date,
      metadata: {
        subGoalCount: 3,
        hasChildren: false,
        priority: 1,
        totalSteps: 5,
        successfulSteps: success ? 5 : 3,
        failedSteps: success ? 0 : 2,
        toolUsageCount: 3
      }
    });
  }
  
  return outcomes;
}

// Execute the test if this module is run directly
if (require.main === module) {
  testStrategyUpdate()
    .then(() => {
      console.log('Test completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Test failed with error:', error);
      process.exit(1);
    });
} 