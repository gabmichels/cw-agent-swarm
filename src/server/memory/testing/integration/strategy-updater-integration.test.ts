/**
 * Integration tests for StrategyUpdater with new memory system
 */

import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import { MemoryService } from '../../services/memory/memory-service';
import { SearchService } from '../../services/search/search-service';
import { QdrantMemoryClient } from '../../services/client/qdrant-client';
import { EmbeddingService } from '../../services/client/embedding-service';
import { MemoryType } from '../../config';

// Import the StrategyUpdater and dependencies
import { StrategyUpdater, StrategyInsight } from '../../../../agents/chloe/self-improvement/strategyUpdater';
import { ExecutionOutcome } from '../../../../agents/chloe/self-improvement/executionOutcomeAnalyzer';
import { ChloeMemory } from '../../../../agents/chloe/memory';

// Use environment variables or defaults
const QDRANT_URL = process.env.TEST_QDRANT_URL || 'http://localhost:6333';
const OPENAI_API_KEY = process.env.TEST_OPENAI_API_KEY;

describe('StrategyUpdater Integration with Memory System', () => {
  // Setup clients and services
  let client: QdrantMemoryClient;
  let embeddingService: EmbeddingService;
  let memoryService: MemoryService;
  let searchService: SearchService;
  let chloeMemory: ChloeMemory;
  
  // Mock execution outcomes for testing
  const testOutcomes: ExecutionOutcome[] = [
    {
      taskId: 'task_123',
      success: true,
      durationMs: 5000,
      resultSummary: 'Successfully completed research task',
      affectedTools: ['web_search', 'file_read'],
      taskType: 'research',
      completionDate: new Date(),
      metadata: { importance: 'high' }
    },
    {
      taskId: 'task_124',
      success: false,
      durationMs: 8000,
      resultSummary: 'Failed to complete analysis task',
      failureReason: 'Missing data',
      affectedTools: ['data_processor', 'chart_generator'],
      taskType: 'analysis',
      completionDate: new Date(),
      metadata: { importance: 'high' }
    },
    {
      taskId: 'task_125',
      success: true,
      durationMs: 3000,
      resultSummary: 'Completed messaging task',
      affectedTools: ['message_sender'],
      taskType: 'communication',
      completionDate: new Date(),
      metadata: { importance: 'medium' }
    }
  ];
  
  // Track created memory IDs for cleanup
  const createdMemoryIds: string[] = [];
  
  beforeAll(async () => {
    // Skip tests if OpenAI API key is not available
    if (!OPENAI_API_KEY) {
      console.warn('Skipping StrategyUpdater integration tests: No OpenAI API key provided');
      return;
    }
    
    // Initialize services
    client = new QdrantMemoryClient({
      qdrantUrl: QDRANT_URL,
      openAIApiKey: OPENAI_API_KEY
    });
    
    embeddingService = new EmbeddingService({
      openAIApiKey: OPENAI_API_KEY,
      embeddingModel: 'text-embedding-ada-002',
      dimensions: 1536
    });
    
    await client.initialize();
    
    memoryService = new MemoryService(client, embeddingService);
    searchService = new SearchService(client, embeddingService, memoryService);
    
    // Initialize ChloeMemory with the memory services
    chloeMemory = new ChloeMemory({
      agentId: 'test_agent'
    });
    
    // Patch ChloeMemory to use our test memory service directly
    (chloeMemory as any).memoryService = memoryService;
    (chloeMemory as any).searchService = searchService;
    (chloeMemory as any).initialized = true;
    
    // Store test execution outcomes in memory
    for (const outcome of testOutcomes) {
      const formattedContent = `Task Execution Outcome: ${outcome.taskId}
Status: ${outcome.success ? 'Success' : 'Failure'}
Type: ${outcome.taskType}
Duration: ${Math.floor((outcome.durationMs || 0) / 1000)}s
Tools used: ${outcome.affectedTools?.join(', ') || 'none'}
${outcome.failureReason ? `Failure reason: ${outcome.failureReason}` : ''}
${outcome.resultSummary || ''}`;
      
      const result = await memoryService.addMemory({
        type: MemoryType.EXECUTION_OUTCOME,
        content: formattedContent,
        metadata: {
          importance: 'high',
          source: 'system',
          tags: ['execution_outcome', outcome.taskType, ...(outcome.affectedTools || [])]
        }
      });
      
      if (result.success) {
        createdMemoryIds.push(result.id);
      }
    }
  });
  
  afterAll(async () => {
    // Clean up test data
    if (OPENAI_API_KEY) {
      for (const id of createdMemoryIds) {
        try {
          await memoryService.deleteMemory({
            id,
            type: MemoryType.EXECUTION_OUTCOME
          });
        } catch (err) {
          console.warn(`Failed to delete test memory ${id}:`, err);
        }
      }
    }
  });
  
  // Conditional tests based on API key availability
  test('Should retrieve execution outcomes from standardized memory system', async () => {
    if (!OPENAI_API_KEY) {
      return;
    }
    
    // Mock the retrieveRecentOutcomes function to check if it's using the memory service correctly
    const retrieveRecentOutcomesSpy = vi.spyOn(
      // @ts-ignore - accessing private function for testing
      global as any, 
      'retrieveRecentOutcomes'
    ).mockImplementation(async (memory: ChloeMemory) => {
      // Verify that memory is of the expected type
      expect(memory).toBe(chloeMemory);
      
      // Return our test outcomes
      return testOutcomes;
    });
    
    try {
      // Create a mock LLM to avoid actual API calls
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue({
          content: JSON.stringify([
            {
              id: "insight_20240701_01",
              description: "Data processor tool fails consistently on analysis tasks",
              confidence: 0.85,
              affectedTools: ["data_processor"],
              affectedTaskTypes: ["analysis"],
              recommendedAction: "Refactor data processor to handle missing data gracefully",
              source: "failure_pattern",
              implementationPriority: "high"
            }
          ])
        })
      };
    
      // Call StrategyUpdater with our memory and mock LLM
      const result = await StrategyUpdater.adjustBasedOnRecentOutcomes(
        chloeMemory,
        mockLLM as any
      );
      
      // Verify that we got a result
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      
      // Check that our mock was called
      expect(retrieveRecentOutcomesSpy).toHaveBeenCalledWith(chloeMemory);
      
      // Verify that the modifier contains info about the failing tool
      expect(result.some(mod => mod.includes('data_processor'))).toBe(true);
      
    } finally {
      // Restore the original function
      retrieveRecentOutcomesSpy.mockRestore();
    }
  });
  
  test('Should store insights in the standardized memory system', async () => {
    if (!OPENAI_API_KEY) {
      return;
    }
    
    // Create test insights
    const testInsights: StrategyInsight[] = [
      {
        id: "insight_20240701_02",
        description: "Web search tool performs well for research tasks",
        confidence: 0.92,
        affectedTools: ["web_search"],
        affectedTaskTypes: ["research"],
        recommendedAction: "Prioritize web search for research tasks",
        source: "performance_trend",
        implementationPriority: "medium"
      }
    ];
    
    // Mock the storeInsights function
    const storeInsightsSpy = vi.spyOn(
      // @ts-ignore - accessing private function for testing
      global as any, 
      'storeInsights'
    );
    
    // Call the function directly
    await (StrategyUpdater as any).storeInsights(testInsights, chloeMemory);
    
    // Verify that storeInsights was called with the right parameters
    expect(storeInsightsSpy).toHaveBeenCalledWith(testInsights, chloeMemory);
    
    // Restore the original function
    storeInsightsSpy.mockRestore();
    
    // Search for insights in memory
    const searchResults = await searchService.search('web search tool', {
      types: [MemoryType.THOUGHT],
      limit: 5
    });
    
    // Expect to find our insight
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults.some(result => 
      result.point.payload.text.includes('web search') && 
      result.point.payload.text.includes('research tasks')
    )).toBe(true);
  });
  
  test('Should store behavior modifiers in the standardized memory system', async () => {
    if (!OPENAI_API_KEY) {
      return;
    }
    
    // Create test behavior modifiers
    const testModifiers = [
      "Prioritize web_search tool for research tasks",
      "Avoid using data_processor tool for analysis tasks when data might be incomplete"
    ];
    
    // Mock the storeModifiers function
    const storeModifiersSpy = vi.spyOn(
      // @ts-ignore - accessing private function for testing
      global as any, 
      'storeModifiers'
    );
    
    // Call the function directly
    await (StrategyUpdater as any).storeModifiers(testModifiers, chloeMemory);
    
    // Verify that storeModifiers was called with the right parameters
    expect(storeModifiersSpy).toHaveBeenCalledWith(testModifiers, chloeMemory);
    
    // Restore the original function
    storeModifiersSpy.mockRestore();
    
    // Search for modifiers in memory
    const searchResults = await searchService.search('behavior modifier', {
      types: [MemoryType.THOUGHT],
      limit: 5
    });
    
    // Expect to find our modifiers
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults.some(result => 
      result.point.payload.text.includes('web_search') && 
      result.point.payload.text.includes('research tasks')
    )).toBe(true);
  });
}); 