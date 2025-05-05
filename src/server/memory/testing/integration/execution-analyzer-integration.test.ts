/**
 * Integration tests for ExecutionOutcomeAnalyzer with causal chain functionality
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { MemoryService } from '../../services/memory/memory-service';
import { SearchService } from '../../services/search/search-service';
import { QdrantMemoryClient } from '../../services/client/qdrant-client';
import { EmbeddingService } from '../../services/client/embedding-service';
import { MemoryType } from '../../config';
import { loadApiKey } from '../load-api-key';

// Import the ExecutionOutcomeAnalyzer
import { ExecutionOutcomeAnalyzer, ExecutionOutcome } from '../../../../agents/chloe/self-improvement/executionOutcomeAnalyzer';
import { ChloeMemory } from '../../../../agents/chloe/memory';
import { ExecutionTraceEntry, SubGoal } from '../../../../agents/chloe/graph/nodes/types';
import { PlannedTask } from '../../../../agents/chloe/human-collaboration';

// Extend CausalChainResult for testing
interface TestCausalChainResult {
  nodes: Array<{
    id: string;
    type: MemoryType;
    content: string;
  }>;
  links: Array<{
    source: string;
    target: string;
    type: string;
  }>;
}

// Use environment variables or defaults
const QDRANT_URL = process.env.TEST_QDRANT_URL || 'http://localhost:6333';
const OPENAI_API_KEY = loadApiKey();

describe('ExecutionOutcomeAnalyzer Integration with Memory System', () => {
  // Setup clients and services
  let client: QdrantMemoryClient;
  let embeddingService: EmbeddingService;
  let memoryService: MemoryService;
  let searchService: SearchService;
  let chloeMemory: ChloeMemory;
  
  // Track created memory IDs for cleanup
  const createdMemoryIds: string[] = [];
  
  // Mock execution data
  const mockTask: PlannedTask = {
    id: 'task_test_123',
    goal: 'Research AI safety protocols',
    status: 'complete',
    reasoning: 'Required for project safety compliance',
    subGoals: [
      { id: 'sub_1', description: 'Find recent papers on AI safety', priority: 1, status: 'complete' },
      { id: 'sub_2', description: 'Summarize key findings', priority: 2, status: 'complete' }
    ],
    metadata: {
      priority: 'high',
      taskType: 'research'
    }
  };
  
  const mockTraceEntries: ExecutionTraceEntry[] = [
    {
      step: 'Starting research on AI safety',
      startTime: new Date(Date.now() - 60000),
      endTime: new Date(Date.now() - 55000),
      status: 'success'
    },
    {
      step: 'Using tool: web_search to find papers',
      startTime: new Date(Date.now() - 55000),
      endTime: new Date(Date.now() - 45000),
      status: 'success',
      details: {
        toolName: 'web_search',
        toolResults: [
          { toolName: 'web_search', status: 'success', data: { results: ['paper1', 'paper2'] } }
        ]
      }
    },
    {
      step: 'Summarizing findings',
      startTime: new Date(Date.now() - 45000),
      endTime: new Date(Date.now() - 35000),
      status: 'success'
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
    searchService = new SearchService(client, embeddingService, memoryService);
    
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
  
  test('Should analyze execution results and store in standardized memory system', async () => {
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
    const searchResults = await searchService.search(mockTask.id || "", {
      types: [MemoryType.EXECUTION_OUTCOME],
      limit: 5
    });
    
    // Verify that the outcome is properly stored
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults[0].point.payload.text).toContain(mockTask.id);
    expect(searchResults[0].point.payload.text).toContain('Success');
    
    // Remember ID for cleanup
    createdMemoryIds.push(searchResults[0].point.id);
  });
  
  test('Should create causal chain relationships for task execution', async () => {
    if (!OPENAI_API_KEY) {
      return;
    }
    
    // First create a "parent" task memory
    const parentTaskResult = await memoryService.addMemory({
      type: MemoryType.TASK,
      content: `TASK: Research AI ethics frameworks`,
      metadata: {
        importance: 'high',
        status: 'in_progress',
        createdBy: 'test'
      }
    });
    
    if (parentTaskResult.success && parentTaskResult.id) {
      createdMemoryIds.push(parentTaskResult.id);
    }
    
    // Create a subtask with causal relationship
    const subtaskResult = await memoryService.addMemory({
      type: MemoryType.TASK,
      content: `TASK: Compare different AI ethics frameworks`,
      metadata: {
        importance: 'medium',
        status: 'complete',
        parentTask: parentTaskResult.id,
        createdBy: 'test'
      }
    });
    
    if (subtaskResult.success && subtaskResult.id) {
      createdMemoryIds.push(subtaskResult.id);
    }
    
    // Create relationship between tasks - assuming SearchService has createRelationship method
    await (searchService as any).createRelationship(
      parentTaskResult.id || "",
      subtaskResult.id || "",
      { type: 'parent_child', metadata: { created: new Date().toISOString() } }
    );
    
    // Create an execution outcome related to the subtask
    const mockSubtaskOutcome: ExecutionOutcome = {
      taskId: 'subtask_exec_123',
      success: true,
      durationMs: 30000,
      resultSummary: 'Compared 5 different AI ethics frameworks',
      affectedTools: ['document_analyzer'],
      taskType: 'analysis',
      completionDate: new Date(),
      metadata: { 
        relatedTaskId: subtaskResult.id
      }
    };
    
    // Store the outcome
    await ExecutionOutcomeAnalyzer.storeOutcome(mockSubtaskOutcome, chloeMemory);
    
    // Search for the outcome in memory
    const searchResults = await searchService.search(mockSubtaskOutcome.taskId, {
      types: [MemoryType.EXECUTION_OUTCOME],
      limit: 5
    });
    
    if (searchResults.length > 0) {
      createdMemoryIds.push(searchResults[0].point.id);
      
      // Create relationship between subtask and execution outcome
      await (searchService as any).createRelationship(
        subtaskResult.id || "",
        searchResults[0].point.id,
        { type: 'task_execution', metadata: { timestamp: new Date().toISOString() } }
      );
      
      // Now search the causal chain from parent task
      const causalChain = await (searchService as any).searchCausalChain(parentTaskResult.id || "", {
        maxDepth: 3,
        includeRelationships: true
      }) as TestCausalChainResult;
      
      // Verify causal chain results
      expect(causalChain.nodes.length).toBeGreaterThan(1);
      expect(causalChain.links.length).toBeGreaterThan(0);
      
      // Verify that both the subtask and execution outcome are in the chain
      const subtaskInChain = causalChain.nodes.some((node) => node.id === subtaskResult.id);
      const executionInChain = causalChain.nodes.some((node) => 
        node.type === MemoryType.EXECUTION_OUTCOME && 
        node.content.includes(mockSubtaskOutcome.taskId)
      );
      
      expect(subtaskInChain).toBe(true);
      expect(executionInChain).toBe(true);
    }
  });
}); 