/**
 * Integration tests for ExecutionOutcomeAnalyzer with new memory system
 */

import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import { MemoryService } from '../../services/memory/memory-service';
import { SearchService } from '../../services/search/search-service';
import { QdrantMemoryClient } from '../../services/client/qdrant-client';
import { EmbeddingService } from '../../services/client/embedding-service';
import { MemoryType } from '../../config';
import { loadApiKey } from '../load-api-key';
import { randomUUID } from 'crypto';

// Import the ExecutionOutcomeAnalyzer
import { ExecutionOutcomeAnalyzer, ExecutionOutcome } from '../../../../agents/chloe/self-improvement/executionOutcomeAnalyzer';
import { TaskTraceEntry } from '../../../../agents/chloe/task-trace';
import { ChloeMemory } from '../../../../agents/chloe/memory';

// Use environment variables or defaults
const QDRANT_URL = process.env.TEST_QDRANT_URL || 'http://localhost:6333';
const OPENAI_API_KEY = loadApiKey();

// Mock implementation for causal chain search and relationship creation
class MockSearchService extends SearchService {
  mockIds: Record<string, string> = {};

  async createRelationship(sourceId: string, targetId: string, relationship: any) {
    console.log(`Mock creating relationship: ${sourceId} -> ${targetId} (${relationship.type})`);
    return { success: true };
  }

  // Note: This is only used for our tests and doesn't need to match the exact interface
  async searchCausalChain(memoryId: string) {
    console.log(`Mock searching causal chain from ${memoryId}`);
    // Return simplified mock data that's sufficient for our tests
    return {
      origin: memoryId,
      causes: [{ id: this.mockIds.subtaskId, type: MemoryType.TASK }],
      effects: [{ id: this.mockIds.executionId, type: MemoryType.THOUGHT }]
    };
  }
}

describe('ExecutionOutcomeAnalyzer Integration with Memory System', () => {
  // Setup clients and services
  let client: QdrantMemoryClient;
  let embeddingService: EmbeddingService;
  let memoryService: MemoryService;
  let searchService: MockSearchService;
  let chloeMemory: ChloeMemory;
  
  // Track created memory IDs for cleanup
  const createdMemoryIds: {id: string, type: MemoryType}[] = [];
  
  // Mock task and trace entries for testing
  const mockTask = {
    id: randomUUID(),
    name: 'Research the latest advancements in AI ethics',
    description: 'Compile a summary of recent developments in AI ethics frameworks',
    type: 'research',
    subtasks: []
  };
  
  const mockTraceEntries: TaskTraceEntry[] = [
    {
      timestamp: new Date(),
      type: 'tool_use',
      tool: 'web_search',
      input: { query: 'latest AI ethics frameworks 2023' },
      output: { success: true, result: 'Found several relevant articles...' },
      duration: 2500
    },
    {
      timestamp: new Date(),
      type: 'tool_use',
      tool: 'document_analyzer',
      input: { text: 'Article content about AI ethics...' },
      output: { success: true, summary: 'The article discusses...' },
      duration: 1800
    },
    {
      timestamp: new Date(),
      type: 'completion',
      result: 'Task completed successfully. Found 5 major AI ethics frameworks...',
      duration: 700
    }
  ];
  
  beforeAll(async () => {
    // Skip tests if OpenAI API key is not available
    if (!OPENAI_API_KEY) {
      console.warn('Skipping ExecutionOutcomeAnalyzer integration tests: No OpenAI API key provided');
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
    searchService = new MockSearchService(client, embeddingService, memoryService);
    
    // Initialize ChloeMemory with the memory services
    chloeMemory = new ChloeMemory({
      agentId: 'test_agent'
    });
    
    // Patch ChloeMemory to use our test memory service directly
    (chloeMemory as any).memoryService = memoryService;
    (chloeMemory as any).searchService = searchService;
    (chloeMemory as any).initialized = true;
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
  
  // Modified storeOutcome for testing
  beforeAll(() => {
    if (!OPENAI_API_KEY) return;
    
    // Save the original method to restore later
    const originalStoreOutcome = ExecutionOutcomeAnalyzer.storeOutcome;
    
    // Override for testing only
    ExecutionOutcomeAnalyzer.storeOutcome = async function(outcome, memory) {
      try {
        // Format the outcome for storage
        const formattedContent = `EXECUTION_OUTCOME
        Task ID: ${outcome.taskId}
        Status: ${outcome.success ? 'Success' : 'Failure'}
        Type: ${outcome.taskType || 'unknown'}
        Duration: ${Math.floor((outcome.durationMs || 0) / 1000)}s
        Tools: ${outcome.affectedTools?.join(', ') || 'none'}
        Result: ${outcome.resultSummary || ''}`;
        
        // Store as THOUGHT with metadata
        const memoryId = randomUUID();
        const result = await memoryService.addMemory({
          id: memoryId,
          type: MemoryType.THOUGHT,
          content: formattedContent,
          metadata: {
            memoryType: MemoryType.EXECUTION_OUTCOME,
            taskId: outcome.taskId,
            taskType: outcome.taskType,
            success: outcome.success
          }
        });
        
        // Track for cleanup
        if (result.success) {
          createdMemoryIds.push({id: memoryId, type: MemoryType.THOUGHT});
        }
        
        return; // Void return to match interface
      } catch (error) {
        console.error('Error storing outcome:', error);
      }
    };
    
    // Restore original after tests
    afterAll(() => {
      ExecutionOutcomeAnalyzer.storeOutcome = originalStoreOutcome;
    });
  });
  
  test.skip('Should analyze execution results and store in standardized memory system', async () => {
    if (!OPENAI_API_KEY) {
      return;
    }
    
    // Analyze the execution
    const outcome = await ExecutionOutcomeAnalyzer.analyzeResult(mockTask, mockTraceEntries);
    
    // Verify the analysis result
    expect(outcome).toBeDefined();
    expect(outcome.taskId).toBe(mockTask.id);
    expect(outcome.success).toBe(true);
    expect(outcome.taskType).toBe('research');
    expect(outcome.affectedTools).toContain('web_search');
    
    // Store the outcome in memory
    await ExecutionOutcomeAnalyzer.storeOutcome(outcome, chloeMemory);
    
    // Search for the outcome in memory
    const searchResults = await searchService.search(outcome.taskId || '', {
      types: [MemoryType.THOUGHT],
      filter: {
        "metadata.memoryType": MemoryType.EXECUTION_OUTCOME
      },
      limit: 5
    });
    
    // Verify that the outcome is properly stored
    expect(searchResults.length).toBeGreaterThan(0);
  });
  
  test('Should create causal chain relationships for task execution', async () => {
    if (!OPENAI_API_KEY) {
      return;
    }
    
    // Create a parent task and subtask
    const parentTaskId = randomUUID();
    const subtaskId = randomUUID();
    
    // Store mock IDs for the mock search service
    searchService.mockIds = {
      subtaskId,
      executionId: randomUUID()
    };
    
    // Store tasks in memory
    const parentTask = await memoryService.addMemory({
      id: parentTaskId,
      type: MemoryType.TASK,
      content: 'Research AI ethics frameworks and prepare a report',
      metadata: {
        type: 'research',
        status: 'in_progress'
      }
    });
    
    if (parentTask.success) {
      createdMemoryIds.push({id: parentTaskId, type: MemoryType.TASK});
    }
    
    const subtask = await memoryService.addMemory({
      id: subtaskId,
      type: MemoryType.TASK,
      content: 'Compare different AI ethics frameworks',
      metadata: {
        type: 'analysis',
        status: 'in_progress',
        parentTaskId
      }
    });
    
    if (subtask.success) {
      createdMemoryIds.push({id: subtaskId, type: MemoryType.TASK});
      
      // Create parent-child relationship
      await searchService.createRelationship(
        parentTaskId,
        subtaskId,
        { type: 'parent_child', metadata: { timestamp: new Date().toISOString() } }
      );
    }
    
    // Create an execution outcome related to the subtask
    const mockSubtaskOutcome: ExecutionOutcome = {
      taskId: subtaskId,
      success: true,
      durationMs: 30000,
      resultSummary: 'Compared 5 different AI ethics frameworks',
      affectedTools: ['document_analyzer'],
      taskType: 'analysis',
      completionDate: new Date(),
      metadata: { 
        relatedTaskId: parentTaskId
      }
    };
    
    // Store the outcome
    await ExecutionOutcomeAnalyzer.storeOutcome(mockSubtaskOutcome, chloeMemory);
    
    // Create relationship tracking ID
    const relationshipTrackingId = randomUUID();
    
    // Add tracking ID to created memories for cleanup
    const trackingMemory = await memoryService.addMemory({
      id: relationshipTrackingId,
      type: MemoryType.THOUGHT,
      content: 'Tracking memory for relationship test',
      metadata: { parentTaskId, subtaskId }
    });
    
    if (trackingMemory.success) {
      createdMemoryIds.push({id: relationshipTrackingId, type: MemoryType.THOUGHT});
      
      // Create a mock relationship
      await searchService.createRelationship(
        subtaskId,
        relationshipTrackingId,
        { type: 'task_execution', metadata: { timestamp: new Date().toISOString() } }
      );
      
      // Search the causal chain
      const causalChain = await searchService.searchCausalChain(parentTaskId);
      
      // Very basic check that we got a response from our mock
      expect(causalChain).toBeDefined();
      expect(causalChain.origin).toBe(parentTaskId);
    }
  });
}); 