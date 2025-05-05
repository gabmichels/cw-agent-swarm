/**
 * Integration tests for scheduler persistence with new memory system
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { MemoryService } from '../../services/memory/memory-service';
import { SearchService } from '../../services/search/search-service';
import { QdrantMemoryClient } from '../../services/client/qdrant-client';
import { EmbeddingService } from '../../services/client/embedding-service';
import { MemoryType } from '../../config';

// Use environment variables or defaults
const QDRANT_URL = process.env.TEST_QDRANT_URL || 'http://localhost:6333';
const OPENAI_API_KEY = process.env.TEST_OPENAI_API_KEY;

describe('Scheduler Persistence with Memory System', () => {
  // Setup clients and services
  let client: QdrantMemoryClient;
  let embeddingService: EmbeddingService;
  let memoryService: MemoryService;
  let searchService: SearchService;
  
  // Track created memory IDs for cleanup
  const createdMemoryIds: string[] = [];
  
  beforeAll(async () => {
    // Skip tests if OpenAI API key is not available
    if (!OPENAI_API_KEY) {
      console.warn('Skipping scheduler persistence tests: No OpenAI API key provided');
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
  });
  
  afterAll(async () => {
    // Clean up test data
    if (OPENAI_API_KEY) {
      for (const id of createdMemoryIds) {
        try {
          await memoryService.deleteMemory({
            id,
            type: MemoryType.TASK
          });
        } catch (err) {
          console.warn(`Failed to delete test memory ${id}:`, err);
        }
      }
    }
  });
  
  test('Should store and retrieve scheduled tasks in memory system', async () => {
    if (!OPENAI_API_KEY) {
      return;
    }
    
    // Create sample scheduled tasks
    const scheduledTasks = [
      {
        id: 'scheduled_task_1',
        title: 'Daily system health check',
        description: 'Check system health metrics and report issues',
        scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
        priority: 'high',
        status: 'scheduled',
        recurrence: 'daily'
      },
      {
        id: 'scheduled_task_2',
        title: 'Weekly data backup',
        description: 'Perform weekly backup of important user data',
        scheduledTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // next week
        priority: 'medium',
        status: 'scheduled',
        recurrence: 'weekly'
      }
    ];
    
    // Store tasks in memory
    for (const task of scheduledTasks) {
      const result = await memoryService.addMemory({
        type: MemoryType.TASK,
        content: `SCHEDULED TASK: ${task.title}\n${task.description}`,
        metadata: {
          taskId: task.id,
          scheduledTime: task.scheduledTime.toISOString(),
          priority: task.priority,
          status: task.status,
          recurrence: task.recurrence,
          isScheduledTask: true
        }
      });
      
      if (result.success) {
        createdMemoryIds.push(result.id);
      }
      
      expect(result.success).toBe(true);
    }
    
    // Retrieve upcoming scheduled tasks
    const now = new Date();
    const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    
    // Use search to find scheduled tasks within date range
    const filter = {
      type: MemoryType.TASK,
      "metadata.isScheduledTask": true,
      "metadata.scheduledTime": {
        $gte: now.toISOString(),
        $lte: futureDate.toISOString()
      }
    };
    
    const searchResults = await searchService.search('scheduled task', {
      filter,
      limit: 10
    });
    
    // Verify search results
    expect(searchResults.length).toBe(2);
    
    // Sort results by scheduled time
    const sortedResults = searchResults.sort((a, b) => {
      const timeA = new Date(a.point.payload.metadata.scheduledTime).getTime();
      const timeB = new Date(b.point.payload.metadata.scheduledTime).getTime();
      return timeA - timeB;
    });
    
    // Check daily task is first (sooner)
    expect(sortedResults[0].point.payload.text).toContain('Daily system health check');
    expect(sortedResults[0].point.payload.metadata.recurrence).toBe('daily');
    
    // Check weekly task is second
    expect(sortedResults[1].point.payload.text).toContain('Weekly data backup');
    expect(sortedResults[1].point.payload.metadata.recurrence).toBe('weekly');
  });
  
  test('Should update scheduled task status in memory system', async () => {
    if (!OPENAI_API_KEY) {
      return;
    }
    
    // Create a task
    const taskResult = await memoryService.addMemory({
      type: MemoryType.TASK,
      content: 'SCHEDULED TASK: One-time maintenance task',
      metadata: {
        taskId: 'maintenance_task_1',
        scheduledTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
        priority: 'high',
        status: 'scheduled',
        isScheduledTask: true
      }
    });
    
    if (taskResult.success) {
      createdMemoryIds.push(taskResult.id);
    }
    
    // Now update the task status to "in_progress"
    const updateResult = await memoryService.updateMemory({
      id: taskResult.id,
      type: MemoryType.TASK,
      metadata: {
        status: 'in_progress',
        startedAt: new Date().toISOString()
      }
    });
    
    expect(updateResult.success).toBe(true);
    
    // Retrieve the updated task
    const retrievedTask = await memoryService.getMemory({
      id: taskResult.id,
      type: MemoryType.TASK
    });
    
    // Verify update
    expect(retrievedTask).not.toBeNull();
    expect(retrievedTask?.payload.metadata.status).toBe('in_progress');
    expect(retrievedTask?.payload.metadata.startedAt).toBeDefined();
  });
  
  test('Should track task execution history with relationships in memory system', async () => {
    if (!OPENAI_API_KEY) {
      return;
    }
    
    // Create a recurring task
    const recurringTaskResult = await memoryService.addMemory({
      type: MemoryType.TASK,
      content: 'SCHEDULED TASK: Content indexing task',
      metadata: {
        taskId: 'content_indexing',
        scheduledTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // yesterday
        priority: 'medium',
        status: 'complete',
        isScheduledTask: true,
        recurrence: 'daily',
        executionCount: 1
      }
    });
    
    if (recurringTaskResult.success) {
      createdMemoryIds.push(recurringTaskResult.id);
    }
    
    // Create a new instance of the task (for the next scheduled time)
    const nextOccurrenceResult = await memoryService.addMemory({
      type: MemoryType.TASK,
      content: 'SCHEDULED TASK: Content indexing task',
      metadata: {
        taskId: 'content_indexing',
        scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // tomorrow
        priority: 'medium',
        status: 'scheduled',
        isScheduledTask: true,
        recurrence: 'daily',
        executionCount: 0,
        previousExecutionId: recurringTaskResult.id
      }
    });
    
    if (nextOccurrenceResult.success) {
      createdMemoryIds.push(nextOccurrenceResult.id);
    }
    
    // Create a relationship between the task executions
    const relationshipResult = await searchService.createRelationship(
      recurringTaskResult.id,
      nextOccurrenceResult.id,
      { 
        type: 'recurring_task_sequence', 
        metadata: { 
          recurrence: 'daily',
          taskId: 'content_indexing'
        }
      }
    );
    
    expect(relationshipResult.success).toBe(true);
    
    // Search for the task execution history
    const relationships = await searchService.getRelationships(
      recurringTaskResult.id,
      { 
        types: ['recurring_task_sequence'],
        direction: 'outgoing'
      }
    );
    
    // Verify the relationship
    expect(relationships.length).toBe(1);
    expect(relationships[0].targetId).toBe(nextOccurrenceResult.id);
    expect(relationships[0].relationship.type).toBe('recurring_task_sequence');
  });
}); 