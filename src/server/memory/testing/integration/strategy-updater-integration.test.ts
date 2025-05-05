/**
 * Integration tests for StrategyUpdater with new memory system
 */

import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import { MemoryService } from '../../services/memory/memory-service';
import { SearchService } from '../../services/search/search-service';
import { QdrantMemoryClient } from '../../services/client/qdrant-client';
import { EmbeddingService } from '../../services/client/embedding-service';
import { MemoryType } from '../../config';
import { loadApiKey } from '../load-api-key';
import { randomUUID } from 'crypto';

// Import the StrategyUpdater and dependencies
import { StrategyUpdater, StrategyInsight } from '../../../../agents/chloe/self-improvement/strategyUpdater';
import { ExecutionOutcome } from '../../../../agents/chloe/self-improvement/executionOutcomeAnalyzer';
import { ChloeMemory } from '../../../../agents/chloe/memory';

// Use environment variables or defaults
const QDRANT_URL = process.env.TEST_QDRANT_URL || 'http://localhost:6333';
const OPENAI_API_KEY = loadApiKey();

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
      taskId: randomUUID(),
      success: true,
      durationMs: 5000,
      resultSummary: 'Successfully completed research task',
      affectedTools: ['web_search', 'file_read'],
      taskType: 'research',
      completionDate: new Date(),
      metadata: { importance: 'high' }
    },
    {
      taskId: randomUUID(),
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
      taskId: randomUUID(),
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
  const createdMemoryIds: {id: string, type: MemoryType}[] = [];
  
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
    
    // Store test execution outcomes in memory (as THOUGHT type with specific metadata)
    for (const outcome of testOutcomes) {
      const formattedContent = `EXECUTION_OUTCOME
Task ID: ${outcome.taskId}
Status: ${outcome.success ? 'Success' : 'Failure'}
Type: ${outcome.taskType}
Duration: ${Math.floor((outcome.durationMs || 0) / 1000)}s
Tools used: ${outcome.affectedTools?.join(', ') || 'none'}
${outcome.failureReason ? `Failure reason: ${outcome.failureReason}` : ''}
${outcome.resultSummary || ''}`;
      
      const memoryId = randomUUID();
      const result = await memoryService.addMemory({
        id: memoryId,
        type: MemoryType.THOUGHT,  // Store as THOUGHT instead of EXECUTION_OUTCOME
        content: formattedContent,
        metadata: {
          memoryType: MemoryType.EXECUTION_OUTCOME,  // Tag the real type in metadata
          importance: 'high',
          source: 'system',
          tags: ['execution_outcome', outcome.taskType, ...(outcome.affectedTools || [])]
        }
      });
      
      if (result.success) {
        createdMemoryIds.push({id: memoryId, type: MemoryType.THOUGHT});
      }
    }
  });
  
  afterAll(async () => {
    // Clean up test data
    if (OPENAI_API_KEY) {
      for (const item of createdMemoryIds) {
        try {
          await memoryService.deleteMemory({
            id: item.id,
            type: item.type
          });
        } catch (err) {
          console.warn(`Failed to delete test memory ${item.id}:`, err);
        }
      }
    }
  });
  
  // Mock required StrategyUpdater private functions for testing
  beforeAll(() => {
    if (!OPENAI_API_KEY) return;
    
    // Create global mock for the private retrieveRecentOutcomes function
    (global as any).retrieveRecentOutcomes = async (memory: ChloeMemory) => {
      // In a real implementation, this would query the memory system
      console.log('Mock retrieveRecentOutcomes called');
      return testOutcomes;
    };
    
    // Create global mock for the private storeInsights function
    (global as any).storeInsights = async (insights: StrategyInsight[], memory: ChloeMemory) => {
      console.log('Mock storeInsights called');
      for (const insight of insights) {
        const insightId = randomUUID();
        const result = await memoryService.addMemory({
          id: insightId,
          type: MemoryType.THOUGHT,
          content: `INSIGHT: ${insight.description}
Confidence: ${insight.confidence}
Affected tools: ${insight.affectedTools?.join(', ') || 'none'}
Action: ${insight.recommendedAction}`,
          metadata: {
            memoryType: MemoryType.STRATEGIC_INSIGHTS,
            confidence: insight.confidence,
            source: insight.source,
            priority: insight.implementationPriority,
            tools: insight.affectedTools
          }
        });
        
        if (result.success) {
          createdMemoryIds.push({id: insightId, type: MemoryType.THOUGHT});
        }
      }
      return true;
    };
    
    // Create global mock for the private storeModifiers function
    (global as any).storeModifiers = async (modifiers: string[], memory: ChloeMemory) => {
      console.log('Mock storeModifiers called');
      for (const modifier of modifiers) {
        const modifierId = randomUUID();
        const result = await memoryService.addMemory({
          id: modifierId,
          type: MemoryType.THOUGHT,
          content: `BEHAVIOR_MODIFIER: ${modifier}`,
          metadata: {
            memoryType: MemoryType.BEHAVIOR_MODIFIERS,
            importance: 'high',
            source: 'strategy_updater'
          }
        });
        
        if (result.success) {
          createdMemoryIds.push({id: modifierId, type: MemoryType.THOUGHT});
        }
      }
      return true;
    };
  });
  
  // Conditional tests based on API key availability
  test.skip('Should retrieve execution outcomes from standardized memory system', async () => {
    if (!OPENAI_API_KEY) {
      return;
    }
    
    // Mock the retrieveRecentOutcomes function to check if it's using the memory service correctly
    const retrieveRecentOutcomesSpy = vi.spyOn(
      // @ts-ignore - accessing private function for testing
      global as any, 
      'retrieveRecentOutcomes'
    );
    
    // Use mockImplementation properly
    retrieveRecentOutcomesSpy.mockImplementation(async () => {
      // Return our test outcomes
      return testOutcomes;
    });
    
    try {
      // Create a mock LLM to avoid actual API calls
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue({
          content: JSON.stringify([
            {
              id: randomUUID(),
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
      expect(retrieveRecentOutcomesSpy).toHaveBeenCalled();
      
      // Verify that the modifier contains info about the failing tool
      expect(result.some(mod => mod.includes('data_processor'))).toBe(true);
      
    } finally {
      // Restore the original function
      retrieveRecentOutcomesSpy.mockRestore();
    }
  });
  
  test.skip('Should store insights in the standardized memory system', async () => {
    if (!OPENAI_API_KEY) {
      return;
    }
    
    // Create test insights
    const testInsights: StrategyInsight[] = [
      {
        id: randomUUID(),
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
      filter: {
        "metadata.memoryType": MemoryType.STRATEGIC_INSIGHTS
      },
      limit: 5
    });
    
    // Expect to find our insight
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults.some(result => 
      result.point.payload.text.includes('web search') && 
      result.point.payload.text.includes('research tasks')
    )).toBe(true);
  });
  
  test.skip('Should store behavior modifiers in the standardized memory system', async () => {
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
      filter: {
        "metadata.memoryType": MemoryType.BEHAVIOR_MODIFIERS
      },
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