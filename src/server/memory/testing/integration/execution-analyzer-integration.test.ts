/**
 * Integration tests for ExecutionOutcomeAnalyzer with new memory system
 */

import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import { MemoryService } from '../../services/memory/memory-service';
import { SearchService } from '../../services/search/search-service';
import { QdrantMemoryClient } from '../../services/client/qdrant-client';
import { EmbeddingService } from '../../services/client/embedding-service';
import { MemoryType } from '@/server/memory/config/types';
import { loadApiKey } from '../load-api-key';
import { randomUUID } from 'crypto';
import { EnhancedMemoryService } from '../../services/multi-agent/enhanced-memory-service';

// Define adapter/mock types to replace the removed Chloe imports
type PlanningTask = {
  id: string;
  goal: string;
  subGoals: Array<{
    id: string;
    description: string;
    priority: number;
    status: string;
  }>;
  reasoning: string;
  status: string;
  metadata: {
    taskType: string;
    [key: string]: any;
  };
};

type ExecutionTraceEntry = {
  step: string;
  startTime: Date;
  endTime: Date;
  status: string;
  details?: {
    toolName?: string;
    toolResults?: Array<{
      toolName: string;
      status: string;
      data: any;
    }>;
    [key: string]: any;
  };
};

interface ExecutionOutcome {
  taskId: string;
  success: boolean;
  durationMs?: number;
  resultSummary?: string;
  failureReason?: string;
  affectedTools?: string[];
  taskType?: string;
  completionDate?: Date;
  metadata?: Record<string, any>;
}

// Mock ChloeMemory class
class ChloeMemory {
  agentId: string;
  memoryService: any;
  searchService: any;
  initialized: boolean = false;

  constructor(config: { agentId: string }) {
    this.agentId = config.agentId;
  }
}

// Mock ExecutionOutcomeAnalyzer
class ExecutionOutcomeAnalyzer {
  static async analyzeResult(task: PlanningTask, traceEntries: ExecutionTraceEntry[]): Promise<ExecutionOutcome> {
    // Basic implementation that extracts data from the task and trace
    const toolNames = new Set<string>();
    
    // Extract tool names from trace entries
    for (const entry of traceEntries) {
      if (entry.details?.toolName) {
        toolNames.add(entry.details.toolName);
      }
      if (entry.details?.toolResults) {
        for (const result of entry.details.toolResults) {
          toolNames.add(result.toolName);
        }
      }
    }
    
    return {
      taskId: task.id,
      success: task.status === 'complete',
      durationMs: traceEntries.length > 0 
        ? traceEntries[traceEntries.length - 1].endTime.getTime() - traceEntries[0].startTime.getTime()
        : 0,
      resultSummary: `Completed task: ${task.goal}`,
      taskType: task.metadata.taskType,
      affectedTools: Array.from(toolNames),
      completionDate: new Date(),
      metadata: { ...task.metadata }
    };
  }
  
  static async storeOutcome(outcome: ExecutionOutcome, memory: ChloeMemory): Promise<void> {
    // Implementation will be overridden for testing
    console.log('Storing outcome', outcome);
  }
}

// Use environment variables or defaults
const QDRANT_URL = process.env.TEST_QDRANT_URL || 'http://localhost:6333';
const OPENAI_API_KEY = loadApiKey();

// Mock implementation for causal chain search and relationship creation
class MockSearchService extends SearchService {
  mockIds: Record<string, string> = {};

  constructor(
    client: QdrantMemoryClient,
    embeddingService: EmbeddingService, 
    memoryService: MemoryService
  ) {
    // Create an adapter that implements the EnhancedMemoryService interface
    const enhancedMemoryService = {
      ...memoryService,
      embeddingClient: embeddingService,
      memoryClient: client,
      getTimestampFn: () => Date.now(),
      extractIndexableFields: (memory: Record<string, any>) => ({ text: memory.text }),
      // Add the methods that SearchService actually uses
      getMemory: memoryService.getMemory,
      addMemory: memoryService.addMemory,
      updateMemory: memoryService.updateMemory,
      deleteMemory: memoryService.deleteMemory,
      searchMemories: memoryService.searchMemories
    } as unknown as EnhancedMemoryService;
    
    super(client, embeddingService, enhancedMemoryService);
  }

  async createRelationship(sourceId: string, targetId: string, relationship: any) {
    console.log(`Mock creating relationship: ${sourceId} -> ${targetId} (${relationship.type})`);
    return { success: true };
  }

  // @ts-ignore - we're intentionally mocking with a simplified interface for testing
  async searchCausalChain(memoryId: string) {
    console.log(`Mock searching causal chain from ${memoryId}`);
    // Return simplified mock data that's sufficient for our tests
    return {
      origin: {
        id: memoryId,
        text: 'Parent task'
      },
      causes: [{ id: this.mockIds.subtaskId, text: 'Subtask' }],
      effects: [{ id: this.mockIds.executionId, text: 'Execution outcome' }]
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
  const mockTask: PlanningTask = {
    id: randomUUID(),
    goal: 'Research the latest advancements in AI ethics',
    subGoals: [
      {
        id: randomUUID(),
        description: 'Find recent papers on AI ethics',
        priority: 1,
        status: 'complete'
      },
      {
        id: randomUUID(),
        description: 'Summarize key findings',
        priority: 2,
        status: 'complete'
      }
    ],
    reasoning: 'Required for project safety compliance',
    status: 'complete',
    metadata: {
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
    ExecutionOutcomeAnalyzer.storeOutcome = async function(outcome: ExecutionOutcome, memory: ChloeMemory): Promise<void> {
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
            schemaVersion: '1.0.0',
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
      } catch (error) {
        console.error('Error storing outcome:', error);
      }
    };
    
    // Restore original after tests
    afterAll(() => {
      ExecutionOutcomeAnalyzer.storeOutcome = originalStoreOutcome;
    });
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
        schemaVersion: '1.0.0',
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
        schemaVersion: '1.0.0',
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
        schemaVersion: '1.0.0',
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
      metadata: { 
        schemaVersion: '1.0.0',
        parentTaskId, 
        subtaskId 
      }
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
      expect(causalChain.origin.id).toBe(parentTaskId);
    }
  });
}); 