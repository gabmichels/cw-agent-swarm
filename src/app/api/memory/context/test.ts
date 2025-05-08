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
    
    console.log(`Retrieved ${topicResults.groups.length} topic groups with ${
      topicResults.groups.reduce((sum, g) => sum + g.memories.length, 0)
    } total memories`);
    
    if (topicResults.summary) {
      console.log(`Summary: ${topicResults.summary}`);
    }
    
    // Test 2: Type-based grouping
    console.log('\nTesting type-based grouping...');
    const typeResults = await searchService.getMemoryContext({
      query: 'agent capabilities',
      types: [MemoryType.THOUGHT, MemoryType.REFLECTION, MemoryType.MESSAGE, MemoryType.DOCUMENT],
      groupingStrategy: 'type'
    });
    
    console.log(`Retrieved ${typeResults.groups.length} type groups:`);
    typeResults.groups.forEach(group => {
      console.log(`- ${group.name}: ${group.memories.length} memories`);
    });
    
    // Test 3: Time-based grouping with time weighting
    console.log('\nTesting time-based grouping with time weighting...');
    const timeResults = await searchService.getMemoryContext({
      query: 'user interaction',
      timeWeighted: true,
      groupingStrategy: 'time',
      includeSummary: true
    });
    
    console.log(`Retrieved ${timeResults.groups.length} time-based groups:`);
    timeResults.groups.forEach(group => {
      console.log(`- ${group.name}: ${group.memories.length} memories (relevance: ${group.relevance.toFixed(2)})`);
    });
    
    // Test 4: Custom categories grouping
    console.log('\nTesting custom categories grouping...');
    const customResults = await searchService.getMemoryContext({
      query: 'system architecture',
      groupingStrategy: 'custom',
      includedGroups: ['design', 'implementation', 'testing', 'documentation']
    });
    
    console.log(`Retrieved ${customResults.groups.length} custom groups:`);
    customResults.groups.forEach(group => {
      console.log(`- ${group.name}: ${group.memories.length} memories`);
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