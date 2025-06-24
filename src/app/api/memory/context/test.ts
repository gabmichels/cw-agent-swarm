/**
 * Memory context API test utility
 * This file helps test the memory context API functionality
 */

import { MemoryType } from "../../../../server/memory/config";
import { getMemoryServices } from "../../../../server/memory/services";

/**
 * Test querying memory contexts with different strategies
 */
export async function testMemoryContexts() {
  try {
    // Initialize services
    const { searchService } = await getMemoryServices();

    // Test 1: Topic-based grouping with a query
    console.log('Testing topic-based grouping...');
    const topicResults = await searchService.getMemoryContext({
      query: 'project planning',
      types: [MemoryType.THOUGHT, MemoryType.REFLECTION, MemoryType.MESSAGE],
      maxMemoriesPerGroup: 3,
      maxTotalMemories: 15,
      includeSummary: true,
      groupingStrategy: 'topic'
    });

    console.log(`Retrieved ${topicResults.groups.length} topic groups with ${topicResults.groups.reduce((sum: any, g: any) => sum + g.memories.length, 0)} total memories`);

    if (topicResults.summary) {
      console.log(`Summary: ${topicResults.summary}`);
    }

    // Test 2: Type-based grouping
    console.log('\nTesting type-based grouping...');
    const typeResults = await searchService.groupMemoriesByType();
    typeResults.groups.forEach((group: any) => {
      console.log(`Type: ${group.type}, Count: ${group.memories.length}`);
    });

    // Test 3: Time-based grouping with time weighting
    console.log('\nTesting time-based grouping with time weighting...');
    const timeResults = await searchService.groupMemoriesByTimeframe('week');
    timeResults.groups.forEach((group: any) => {
      console.log(`Timeframe: ${group.timeframe}, Count: ${group.memories.length}`);
    });

    // Test 4: Custom categories grouping
    console.log('\nTesting custom categories grouping...');
    const customResults = await searchService.groupMemoriesByCustomFilter({ limit: 50 });
    customResults.groups.forEach((group: any) => {
      console.log(`Custom group: ${group.key}, Count: ${group.memories.length}`);
    });

    return {
      success: true,
      results: {
        topic: topicResults,
        type: typeResults,
        time: timeResults,
        custom: customResults
      }
    };
  } catch (error) {
    console.error('Error testing memory contexts:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
} 