import { BaseTool } from '../../../lib/shared/types/agentTypes';
import { getToolManager, initializeToolManager } from './fixToolManagerSingleton';
import { logger } from '../../../lib/logging';
import { getToolPerformanceTracker } from './toolPerformanceTracker';
import { getToolLearner } from './toolLearning';
import { ChloeMemory } from '../memory';

/**
 * A simple test tool for demonstration
 */
class TestSearchTool extends BaseTool {
  constructor(reliability: number = 0.9) {
    super(
      'test_search',
      'Search for information',
      {
        query: {
          type: 'string',
          description: 'The search query'
        }
      }
    );
    this.reliability = reliability;
  }

  private reliability: number;

  async execute(params: Record<string, any>): Promise<any> {
    const { query } = params;
    
    // Simulate occasional failures based on reliability
    if (Math.random() > this.reliability) {
      return {
        success: false,
        error: 'Search failed due to network error'
      };
    }
    
    return {
      success: true,
      results: [`Found result for query: ${query}`]
    };
  }
}

/**
 * Another test tool that offers similar functionality
 */
class TestAlternativeSearchTool extends BaseTool {
  constructor(reliability: number = 0.7) {
    super(
      'alternative_search',
      'Alternative search method',
      {
        query: {
          type: 'string',
          description: 'The search query'
        }
      }
    );
    this.reliability = reliability;
  }

  private reliability: number;

  async execute(params: Record<string, any>): Promise<any> {
    const { query } = params;
    
    // Simulate occasional failures based on reliability
    if (Math.random() > this.reliability) {
      return {
        success: false,
        error: 'Alternative search failed'
      };
    }
    
    return {
      success: true,
      results: [`Alternative search found: ${query}`]
    };
  }
}

/**
 * A tool for summarizing information
 */
class TestSummarizeTool extends BaseTool {
  constructor() {
    super(
      'test_summarize',
      'Summarize information',
      {
        text: {
          type: 'string',
          description: 'The text to summarize'
        }
      }
    );
  }

  async execute(params: Record<string, any>): Promise<any> {
    const { text } = params;
    
    return {
      success: true,
      summary: `Summary of: ${text.substring(0, 20)}...`
    };
  }
}

/**
 * Test the adaptive tool system
 */
async function testAdaptiveToolSystem() {
  console.log('🧪 TESTING ADAPTIVE TOOL SYSTEM');
  
  // Initialize memory
  const memory = new ChloeMemory();
  
  // Initialize the tool manager
  initializeToolManager(memory);
  
  // Get tool management components
  const toolManager = getToolManager();
  const performanceTracker = getToolPerformanceTracker();
  const toolLearner = getToolLearner();
  
  // Register test tools
  console.log('📝 Registering test tools...');
  toolManager.registerTool(new TestSearchTool(0.7), ['search', 'information_retrieval']);
  toolManager.registerTool(new TestAlternativeSearchTool(0.8), ['search', 'information_retrieval']);
  toolManager.registerTool(new TestSummarizeTool(), ['summarization', 'content_processing']);
  
  // Test individual tools
  console.log('\n🔍 Testing search tools');
  
  // Run several search queries with both tools to build performance data
  for (let i = 0; i < 10; i++) {
    console.log(`\n📊 Test iteration ${i + 1}`);
    
    // Run search
    const searchResult = await toolManager.executeTool(
      'test_search',
      { query: `test query ${i}` },
      'search',
      ['web', 'test']
    );
    console.log('Search result:', searchResult.success ? 'SUCCESS' : 'FAILURE');
    
    // Run alternative search
    const altSearchResult = await toolManager.executeTool(
      'alternative_search',
      { query: `test query ${i}` },
      'search',
      ['web', 'test']
    );
    console.log('Alternative search result:', altSearchResult.success ? 'SUCCESS' : 'FAILURE');
  }
  
  // Test best tool selection
  console.log('\n🏆 Testing best tool selection for search task');
  const bestTool = toolManager.getBestToolForTask('search', ['web']);
  console.log('Best tool selected:', bestTool?.name);
  
  if (bestTool) {
    console.log('Executing best tool...');
    const result = await bestTool.execute({ query: 'final test query' });
    console.log('Result:', result);
  }
  
  // Test tool combination
  console.log('\n🔄 Testing tool combination');
  const comboTool = toolManager.createToolCombination(
    'search_and_summarize',
    ['test_search', 'test_summarize']
  );
  
  if (comboTool) {
    console.log('Executing combined tool...');
    const comboResult = await comboTool.execute({ query: 'combination test', text: 'This is a test' });
    console.log('Combination result:', comboResult);
  }
  
  // Print performance stats
  console.log('\n📊 Tool Performance Statistics:');
  const records = performanceTracker.getAllPerformanceRecords();
  records.forEach(record => {
    console.log(`${record.toolName}: ${record.successRate.toFixed(2)} success rate (${record.totalRuns} runs)`);
  });
  
  console.log('\n✅ Adaptive Tool System test completed');
}

// Only run the test if this file is executed directly
if (require.main === module) {
  testAdaptiveToolSystem().catch(error => {
    console.error('Test failed:', error);
  });
}

export { testAdaptiveToolSystem }; 